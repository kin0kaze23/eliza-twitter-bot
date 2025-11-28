import { storage, db } from "./storage";
import { activityLogs } from "@shared/schema";
import { postTweet, validateTwitterCredentials } from "./twitter";
import { assemblePrompt, buildMessagesArray } from "./promptAssembly";
import { sendPostCreatedWebhook, sendPostFailedWebhook } from "./webhook";
import type { Agent } from "@shared/schema";

interface SchedulerState {
  isRunning: boolean;
  activeAgents: Map<string, NodeJS.Timeout>;
  lastPostTime: Map<string, Date>;
  postsToday: Map<string, number>;
}

const state: SchedulerState = {
  isRunning: false,
  activeAgents: new Map(),
  lastPostTime: new Map(),
  postsToday: new Map(),
};

function isInQuietHours(agent: Agent): boolean {
  if (!agent.quietHoursEnabled) return false;
  
  const now = new Date();
  const timezone = agent.timezone || "UTC";
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
  
  const currentTime = formatter.format(now);
  const startTime = agent.quietHoursStart || "22:00";
  const endTime = agent.quietHoursEnd || "08:00";
  
  if (startTime < endTime) {
    return currentTime >= startTime && currentTime < endTime;
  } else {
    return currentTime >= startTime || currentTime < endTime;
  }
}

function getPostIntervalMs(agent: Agent): number {
  const frequency = agent.postFrequency || 2;
  const interval = agent.postInterval || "hours";
  
  if (interval === "minutes") {
    return frequency * 60 * 1000;
  }
  return frequency * 60 * 60 * 1000;
}

function canPostNow(agent: Agent): boolean {
  if (!agent.postingEnabled) return false;
  if (isInQuietHours(agent)) return false;
  
  const today = new Date().toISOString().split("T")[0];
  const postsKey = `${agent.id}_${today}`;
  const postsToday = state.postsToday.get(postsKey) || 0;
  
  if (agent.maxPostsPerDay && postsToday >= agent.maxPostsPerDay) {
    return false;
  }
  
  const lastPost = state.lastPostTime.get(agent.id);
  if (lastPost) {
    const intervalMs = getPostIntervalMs(agent);
    const timeSinceLastPost = Date.now() - lastPost.getTime();
    if (timeSinceLastPost < intervalMs) {
      return false;
    }
  }
  
  return true;
}

async function generateTweetContent(agent: Agent): Promise<{ content: string; kbIds: string[] } | null> {
  try {
    const knowledgeEntries = await storage.getActiveKnowledgeBase(agent.id);
    
    const assembledPrompt = await assemblePrompt(agent, knowledgeEntries, {
      includeKnowledge: true,
      includeExamples: true,
      includePersonality: true,
      maxKbEntries: agent.kbMaxEntries || 20,
      maxKbTokens: agent.kbMaxTokens || 2000,
    });
    
    const tweetPrompt = "Generate an engaging tweet for your audience based on your knowledge base. Be authentic and insightful. Keep it under 280 characters.";
    
    const messages = buildMessagesArray(assembledPrompt, [], tweetPrompt);
    
    const postModelProvider = agent.postModelProvider || agent.modelProvider || "openai";
    const postModelName = agent.postModelName || agent.modelName || "gpt-4-turbo-preview";
    const postTemperature = agent.postTemperature !== null ? Number(agent.postTemperature) : Number(agent.temperature) || 0.7;
    const postMaxTokens = agent.postMaxTokens || 280;
    
    let content = "";
    
    if (postModelProvider === "openai") {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const completion = await openai.chat.completions.create({
        model: postModelName,
        messages: messages as any,
        temperature: postTemperature,
        max_completion_tokens: postMaxTokens,
      });
      
      content = completion.choices[0]?.message?.content || "";
    } else if (postModelProvider === "anthropic") {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      
      const systemMessage = messages.find((m) => m.role === "system");
      const userMessages = messages.filter((m) => m.role !== "system");
      
      const completion = await anthropic.messages.create({
        model: postModelName,
        system: systemMessage?.content || "You are a helpful AI assistant.",
        messages: userMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        max_tokens: postMaxTokens,
        temperature: postTemperature,
      });
      
      const textContent = completion.content.find((c) => c.type === "text") as any;
      content = textContent?.text || "";
    }
    
    if (!content) return null;
    
    return {
      content: content.trim(),
      kbIds: assembledPrompt.metadata.kbEntriesUsedIds || [],
    };
  } catch (error) {
    console.error(`Failed to generate tweet for agent ${agent.id}:`, error);
    return null;
  }
}

async function executePost(agent: Agent): Promise<void> {
  if (!canPostNow(agent)) {
    return;
  }
  
  const validation = validateTwitterCredentials(agent);
  if (!validation.valid) {
    console.log(`Agent ${agent.name}: Missing Twitter credentials`);
    return;
  }
  
  console.log(`[Scheduler] Generating post for agent: ${agent.name}`);
  
  const generated = await generateTweetContent(agent);
  if (!generated) {
    console.error(`[Scheduler] Failed to generate content for agent: ${agent.name}`);
    
    await db.insert(activityLogs).values({
      agentId: agent.id,
      eventType: "post",
      status: "failed",
      content: "",
      errorMessage: "Failed to generate tweet content",
      errorCode: "GENERATION_FAILED",
    });
    
    return;
  }
  
  console.log(`[Scheduler] Posting to Twitter for agent: ${agent.name}`);
  
  const result = await postTweet(agent, generated.content);
  
  const today = new Date().toISOString().split("T")[0];
  const postsKey = `${agent.id}_${today}`;
  
  if (result.success) {
    state.lastPostTime.set(agent.id, new Date());
    state.postsToday.set(postsKey, (state.postsToday.get(postsKey) || 0) + 1);
    
    await db.insert(activityLogs).values({
      agentId: agent.id,
      eventType: "post",
      status: "success",
      tweetId: result.tweetId,
      content: generated.content,
      characterCount: generated.content.length,
      modelProvider: agent.postModelProvider || agent.modelProvider,
      modelName: agent.postModelName || agent.modelName,
      kbEntriesUsed: generated.kbIds,
      postedAt: new Date(),
    });
    
    console.log(`[Scheduler] Posted successfully: ${result.tweetId}`);
    
    if (agent.webhookEnabled && agent.webhookUrl) {
      sendPostCreatedWebhook(agent, generated.content, result.tweetId).catch((err) =>
        console.error("Webhook error:", err)
      );
    }
  } else {
    await db.insert(activityLogs).values({
      agentId: agent.id,
      eventType: "post",
      status: result.rateLimited ? "rate_limited" : "failed",
      content: generated.content,
      characterCount: generated.content.length,
      modelProvider: agent.postModelProvider || agent.modelProvider,
      modelName: agent.postModelName || agent.modelName,
      kbEntriesUsed: generated.kbIds,
      errorMessage: result.error,
      errorCode: result.errorCode,
    });
    
    console.error(`[Scheduler] Failed to post: ${result.error}`);
    
    if (agent.webhookEnabled && agent.webhookUrl) {
      sendPostFailedWebhook(agent, result.error || "Unknown error", generated.content).catch((err) =>
        console.error("Webhook error:", err)
      );
    }
  }
}

function scheduleAgent(agent: Agent): void {
  if (state.activeAgents.has(agent.id)) {
    clearInterval(state.activeAgents.get(agent.id)!);
  }
  
  const intervalMs = getPostIntervalMs(agent);
  console.log(`[Scheduler] Scheduling agent ${agent.name} with interval ${intervalMs / 1000}s`);
  
  executePost(agent);
  
  const timer = setInterval(async () => {
    const currentAgent = await storage.getAgent(agent.id);
    if (currentAgent && currentAgent.status === "active" && currentAgent.postingEnabled) {
      executePost(currentAgent);
    } else {
      stopAgent(agent.id);
    }
  }, intervalMs);
  
  state.activeAgents.set(agent.id, timer);
}

export function startAgent(agent: Agent): void {
  if (!agent.postingEnabled) {
    console.log(`[Scheduler] Agent ${agent.name} has posting disabled`);
    return;
  }
  
  console.log(`[Scheduler] Starting agent: ${agent.name}`);
  scheduleAgent(agent);
}

export function stopAgent(agentId: string): void {
  const timer = state.activeAgents.get(agentId);
  if (timer) {
    clearInterval(timer);
    state.activeAgents.delete(agentId);
    console.log(`[Scheduler] Stopped agent: ${agentId}`);
  }
}

export function isAgentRunning(agentId: string): boolean {
  return state.activeAgents.has(agentId);
}

export function getSchedulerStatus(): {
  isRunning: boolean;
  activeAgentCount: number;
  activeAgentIds: string[];
} {
  return {
    isRunning: state.isRunning,
    activeAgentCount: state.activeAgents.size,
    activeAgentIds: Array.from(state.activeAgents.keys()),
  };
}

export async function initializeScheduler(): Promise<void> {
  if (state.isRunning) {
    console.log("[Scheduler] Already running");
    return;
  }
  
  console.log("[Scheduler] Initializing...");
  state.isRunning = true;
  
  try {
    const agents = await storage.getAllAgents();
    const activeAgents = agents.filter(
      (a) => a.status === "active" && a.postingEnabled
    );
    
    console.log(`[Scheduler] Found ${activeAgents.length} active agents with posting enabled`);
    
    for (const agent of activeAgents) {
      startAgent(agent);
    }
  } catch (error) {
    console.error("[Scheduler] Failed to initialize:", error);
  }
}

export function shutdownScheduler(): void {
  console.log("[Scheduler] Shutting down...");
  
  const entries = Array.from(state.activeAgents.entries());
  for (const [agentId, timer] of entries) {
    clearInterval(timer);
    console.log(`[Scheduler] Stopped agent: ${agentId}`);
  }
  
  state.activeAgents.clear();
  state.isRunning = false;
}
