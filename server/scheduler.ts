import { storage, db } from "./storage";
import { activityLogs } from "@shared/schema";
import { postTweet, validateTwitterCredentials } from "./twitter";
import { assemblePrompt, buildMessagesArray, selectNextContentType, formatContentType, type ContentType } from "./promptAssembly";
import { sendPostCreatedWebhook, sendPostFailedWebhook } from "./webhook";
import { buildOpenAIParams, safeOpenAICall } from "./openaiHelpers";
import type { Agent } from "@shared/schema";

interface SchedulerState {
  isRunning: boolean;
  activeAgents: Map<string, NodeJS.Timeout>;
  lastPostTime: Map<string, Date>;
  postsToday: Map<string, number>;
  lastCleanupDate: string;
}

const state: SchedulerState = {
  isRunning: false,
  activeAgents: new Map(),
  lastPostTime: new Map(),
  postsToday: new Map(),
  lastCleanupDate: new Date().toISOString().split("T")[0],
};

function cleanupOldPostCounts(): void {
  const today = new Date().toISOString().split("T")[0];
  if (state.lastCleanupDate !== today) {
    const keysToDelete: string[] = [];
    state.postsToday.forEach((_, key) => {
      if (!key.endsWith(`_${today}`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => state.postsToday.delete(key));
    state.lastCleanupDate = today;
    console.log(`[Scheduler] Cleaned up ${keysToDelete.length} old post count entries`);
  }
}

/**
 * Detect the content type from post content based on labels and patterns
 */
function detectContentType(content: string): string | null {
  const upperContent = content.toUpperCase();
  const lowerContent = content.toLowerCase();
  
  // Check for explicit labels first (most reliable)
  if (upperContent.includes("[EVENT-BASED]") || upperContent.includes("[EVENT_BASED]")) {
    return "EVENT_BASED";
  }
  if (upperContent.includes("[VERSE REFLECTION]") || upperContent.includes("[VERSE_REFLECTION]")) {
    return "VERSE_REFLECTION";
  }
  if (upperContent.includes("[DEEP QUESTION]") || upperContent.includes("[DEEP_QUESTION]")) {
    return "DEEP_QUESTION";
  }
  if (upperContent.includes("[WISDOM BITE]") || upperContent.includes("[WISDOM_BITE]")) {
    return "WISDOM_BITE";
  }
  if (upperContent.includes("[CULTURAL INSIGHT]") || upperContent.includes("[CULTURAL_INSIGHT]")) {
    return "CULTURAL_INSIGHT";
  }
  if (upperContent.includes("[ENCOURAGEMENT]")) {
    return "ENCOURAGEMENT";
  }
  if (upperContent.includes("[ETERNITY ANCHOR]") || upperContent.includes("[ETERNITY_ANCHOR]")) {
    return "ETERNITY_ANCHOR";
  }
  
  // Pattern-based detection as fallback
  const lines = content.split("\n").filter(l => l.trim());
  const firstLine = lines[0]?.toLowerCase() || "";
  
  // Event-based: Often starts with news emoji or mentions specific events/stats
  if (/^[📉📈🤖💧🔥👀📰🌍]/.test(content) && /\d+%|\$\d|billion|million|today|yesterday|this week/.test(lowerContent)) {
    return "EVENT_BASED";
  }
  
  // Verse reflection: Starts with a quoted verse
  if (/^[""]/.test(content) && /—\s*(matthew|mark|luke|john|psalm|proverbs|romans|genesis|isaiah|hebrews|philippians|corinthians|peter|james|revelation)/i.test(content)) {
    return "VERSE_REFLECTION";
  }
  
  // Deep question: Usually short, ends with ?
  if (content.includes("?") && lines.length <= 4 && content.length < 300) {
    return "DEEP_QUESTION";
  }
  
  // Wisdom bite: Short, punchy, no verse, often uses "isn't" or metaphors
  if (lines.length <= 4 && content.length < 200 && !content.includes("—")) {
    return "WISDOM_BITE";
  }
  
  // Encouragement: Contains "you" addressed to reader, comfort language
  if (/to the one|if you|you don't have to|you are|you're not/i.test(lowerContent)) {
    return "ENCOURAGEMENT";
  }
  
  // Eternity anchor: Contains themes of permanence vs. temporality
  if (/forever|eternal|throne|kingdom|unshakable|never change|yesterday.*today.*forever/i.test(lowerContent)) {
    return "ETERNITY_ANCHOR";
  }
  
  // Cultural insight: References modern culture, tech, patterns
  if (/we optimize|we scroll|algorithm|modern|culture|generation|trend/i.test(lowerContent)) {
    return "CULTURAL_INSIGHT";
  }
  
  // Default: If we can't detect, return null
  return null;
}

/**
 * Strip content type labels and decorative elements from generated content
 * Removes: [EVENT-BASED], EVENT-BASED, em-dashes, double-dashes used as separators
 */
function stripContentTypeLabels(content: string): string {
  return content
    // Bracketed labels
    .replace(/\s*\[(EVENT[-_]BASED|VERSE[-_ ]REFLECTION|DEEP[-_ ]QUESTION|WISDOM[-_ ]BITE|CULTURAL[-_ ]INSIGHT|ENCOURAGEMENT|ETERNITY[-_ ]ANCHOR)\]\s*/gi, " ")
    // Plain text labels
    .replace(/^\s*(EVENT[-_\s]?BASED|VERSE[-_\s]?REFLECTION|DEEP[-_\s]?QUESTION|WISDOM[-_\s]?BITE|CULTURAL[-_\s]?INSIGHT|ENCOURAGEMENT|ETERNITY[-_\s]?ANCHOR)\s+/gi, "")
    .replace(/\s+(EVENT[-_\s]?BASED|VERSE[-_\s]?REFLECTION|DEEP[-_\s]?QUESTION|WISDOM[-_\s]?BITE|CULTURAL[-_\s]?INSIGHT|ENCOURAGEMENT|ETERNITY[-_\s]?ANCHOR)\s+/gi, " ")
    // Remove decorative separators (em-dashes, double-dashes used as dividers)
    .replace(/\n\s*[-–—]{2,}\s*\n/g, "\n") // Lines with only dashes
    .replace(/\s+[-–—]\s+/g, " ") // Em-dashes or dashes as separators (but keep single dash in context like "don't")
    .replace(/\s+/g, " ") // Normalize multiple spaces
    .trim();
}

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

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
  
  const timeParts = formatter.formatToParts(now);
  const hour = parseInt(timeParts.find(p => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(timeParts.find(p => p.type === "minute")?.value || "0", 10);
  const currentMinutes = hour * 60 + minute;
  
  const startMinutes = parseTimeToMinutes(agent.quietHoursStart || "22:00");
  const endMinutes = parseTimeToMinutes(agent.quietHoursEnd || "08:00");
  
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
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
  
  cleanupOldPostCounts();
  
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

async function generateTweetContent(agent: Agent): Promise<{ content: string; kbIds: string[]; contentType: ContentType } | null> {
  try {
    const knowledgeEntries = await storage.getActiveKnowledgeBase(agent.id);
    
    // Get recent verse usages for avoidance (based on agent's verse window setting)
    const verseWindow = agent.verseReuseWindow || 10;
    const recentVerses = await storage.getRecentVerseUsages(agent.id, verseWindow);
    
    // Get recent content type usages for avoidance
    const contentTypeWindow = (agent as any).contentTypeWindow || 7;
    const recentContentTypes = await storage.getRecentContentTypeUsages(agent.id, contentTypeWindow);
    
    // SERVER-SIDE CONTENT TYPE SELECTION (critical for proper rotation)
    const hasKnowledgeBase = knowledgeEntries.length > 0;
    const rotationPolicy = ((agent as any).contentTypeReusePolicy || "rotate_all") as "rotate_all" | "avoid_last" | "allow";
    const selectedContentType = selectNextContentType(recentContentTypes, hasKnowledgeBase, rotationPolicy);
    
    console.log(`[SCHEDULER] Content type rotation: Selected "${formatContentType(selectedContentType)}" for agent ${agent.id}`);
    
    const assembledPrompt = await assemblePrompt(agent, knowledgeEntries, {
      includeKnowledge: true,
      includeExamples: true,
      includePersonality: true,
      maxKbEntries: 20,
      maxKbTokens: 2000,
      recentVerses,
      recentContentTypes,
      selectedContentType, // CRITICAL: Pass server-selected type
    });
    
    // Simplified prompt - content type is already selected server-side
    const selectedTypeLabel = formatContentType(selectedContentType);
    const needsKB = selectedContentType === "EVENT_BASED" || selectedContentType === "CULTURAL_INSIGHT";
    
    const tweetPrompt = `Generate a "${selectedTypeLabel}" post.

CRITICAL INSTRUCTIONS:
1. Follow the EXACT format shown in the example above - copy its structure precisely
2. Match all line breaks, spacing, and paragraph structure exactly
3. ${needsKB ? "Use the Knowledge Base content provided" : "Write from Scripture and spiritual wisdom"}
4. Avoid recently used Bible verses (see guidelines above)
5. Keep under 280 characters unless the example shows multi-paragraph format

OUTPUT: Write ONLY the tweet content, nothing else.`;
    
    const messages = buildMessagesArray(assembledPrompt, [], tweetPrompt);
    
    const postModelProvider = agent.postModelProvider || agent.modelProvider || "openai";
    const postModelName = agent.postModelName || agent.modelName || "gpt-4-turbo-preview";
    // Lower temperature (0.2) for highly deterministic output that closely follows message examples
    const postTemperature = agent.postTemperature !== null ? Number(agent.postTemperature) : Number(agent.temperature) || 0.2;
    // Increased max_tokens to 600 for thorough content generation
    const postMaxTokens = agent.postMaxTokens || 600;
    
    let content = "";
    
    if (postModelProvider === "openai") {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      // Use same wrapper functions as test-tweet for consistency
      const params = buildOpenAIParams(postModelName, {
        model: postModelName,
        messages: messages as any,
        temperature: postTemperature,
        max_completion_tokens: postMaxTokens,
      });
      
      const completion = await safeOpenAICall(openai, params);
      
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
      contentType: selectedContentType, // Return the server-selected content type
    };
  } catch (error) {
    console.error(`Failed to generate tweet for agent ${agent.id}:`, error);
    return null;
  }
}

async function logActivity(data: {
  agentId: string;
  eventType: "post" | "reply" | "mention" | "error" | "scheduled";
  status: "success" | "failed" | "rate_limited" | "pending";
  tweetId?: string;
  content?: string;
  characterCount?: number;
  modelProvider?: string | null;
  modelName?: string | null;
  kbEntriesUsed?: string[];
  errorMessage?: string;
  errorCode?: string;
  postedAt?: Date;
}): Promise<void> {
  try {
    await db.insert(activityLogs).values(data as any);
  } catch (error) {
    console.error(`[Scheduler] Failed to log activity for agent ${data.agentId}:`, error);
  }
}

async function executePost(agent: Agent): Promise<void> {
  try {
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
      
      await logActivity({
        agentId: agent.id,
        eventType: "post",
        status: "failed",
        content: "",
        errorMessage: "Failed to generate tweet content",
        errorCode: "GENERATION_FAILED",
      });
      
      return;
    }
    
    // Use server-selected content type (not detection) for accurate rotation tracking
    const contentTypeToLog = generated.contentType;
    
    // Strip content type labels from content before posting
    const cleanedContent = stripContentTypeLabels(generated.content);
    
    console.log(`[Scheduler] Posting to Twitter for agent: ${agent.name}`);
    
    const result = await postTweet(agent, cleanedContent);
    
    const today = new Date().toISOString().split("T")[0];
    const postsKey = `${agent.id}_${today}`;
    
    if (result.success) {
      state.lastPostTime.set(agent.id, new Date());
      state.postsToday.set(postsKey, (state.postsToday.get(postsKey) || 0) + 1);
      
      // Extract and log Bible verses from the tweet (if verse tracking enabled)
      if (result.tweetId && agent.verseTrackingEnabled !== false) {
        const { extractVerses } = await import("./verseExtractor");
        const detectedVerses = extractVerses(cleanedContent);
        for (const verse of detectedVerses) {
          await storage.logVerseUsage(
            agent.id,
            verse.verseRef,
            verse.book,
            verse.chapter,
            verse.verseStart,
            verse.verseEnd,
            result.tweetId
          );
        }
        if (detectedVerses.length > 0) {
          console.log(`[Scheduler] Logged ${detectedVerses.length} verse(s): ${detectedVerses.map(v => v.verseRef).join(", ")}`);
        }
      }
      
      // Log server-selected content type (CRITICAL for rotation to work)
      if (result.tweetId && contentTypeToLog) {
        await storage.logContentTypeUsage(agent.id, contentTypeToLog, result.tweetId);
        console.log(`[Scheduler] Logged content type: ${contentTypeToLog}`);
      }
      
      await logActivity({
        agentId: agent.id,
        eventType: "post",
        status: "success",
        tweetId: result.tweetId,
        content: cleanedContent,
        characterCount: cleanedContent.length,
        modelProvider: agent.postModelProvider || agent.modelProvider,
        modelName: agent.postModelName || agent.modelName,
        kbEntriesUsed: generated.kbIds,
        postedAt: new Date(),
      });
      
      console.log(`[Scheduler] Posted successfully: ${result.tweetId}`);
      
      if (agent.webhookEnabled && agent.webhookUrl) {
        sendPostCreatedWebhook(agent, cleanedContent, result.tweetId).catch((err) =>
          console.error("Webhook error:", err)
        );
      }
    } else {
      await logActivity({
        agentId: agent.id,
        eventType: "post",
        status: result.rateLimited ? "rate_limited" : "failed",
        content: cleanedContent,
        characterCount: cleanedContent.length,
        modelProvider: agent.postModelProvider || agent.modelProvider,
        modelName: agent.postModelName || agent.modelName,
        kbEntriesUsed: generated.kbIds,
        errorMessage: result.error,
        errorCode: result.errorCode,
      });
      
      console.error(`[Scheduler] Failed to post: ${result.error}`);
      
      if (agent.webhookEnabled && agent.webhookUrl) {
        sendPostFailedWebhook(agent, result.error || "Unknown error", cleanedContent).catch((err) =>
          console.error("Webhook error:", err)
        );
      }
    }
  } catch (error) {
    console.error(`[Scheduler] Unexpected error during post for agent ${agent.name}:`, error);
    
    await logActivity({
      agentId: agent.id,
      eventType: "error",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorCode: "SCHEDULER_ERROR",
    });
  }
}

function scheduleAgent(agent: Agent): void {
  if (state.activeAgents.has(agent.id)) {
    clearInterval(state.activeAgents.get(agent.id)!);
  }
  
  const intervalMs = getPostIntervalMs(agent);
  console.log(`[Scheduler] Scheduling agent ${agent.name} with interval ${intervalMs / 1000}s`);
  
  executePost(agent).catch(err => 
    console.error(`[Scheduler] Initial post failed for ${agent.name}:`, err)
  );
  
  const timer = setInterval(async () => {
    try {
      const currentAgent = await storage.getAgent(agent.id);
      if (currentAgent && currentAgent.status === "active" && currentAgent.postingEnabled) {
        await executePost(currentAgent);
      } else {
        stopAgent(agent.id);
      }
    } catch (error) {
      console.error(`[Scheduler] Error in scheduled post for agent ${agent.id}:`, error);
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
    
    // Start KB refresh service for agents with auto-refresh enabled
    const kbRefreshAgents = agents.filter(a => a.kbAutoRefreshEnabled);
    if (kbRefreshAgents.length > 0) {
      const { startKBRefreshService } = await import("./kbRefresh");
      console.log(`[Scheduler] Starting KB refresh for ${kbRefreshAgents.length} agents`);
      for (const agent of kbRefreshAgents) {
        startKBRefreshService(agent.id);
      }
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
