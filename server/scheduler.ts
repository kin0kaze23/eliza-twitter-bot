import { storage, db } from "./storage";
import { activityLogs } from "@shared/schema";
import { postTweet, validateTwitterCredentials, replyToTweet, fetchMentions, fetchRepliesToTweet, type TwitterMention } from "./twitter";
import { assemblePrompt, buildMessagesArray, selectNextContentType, formatContentType, assembleConversationPrompt, buildConversationMessages, type ContentType } from "./promptAssembly";
import { sendPostCreatedWebhook, sendPostFailedWebhook, sendReplyCreatedWebhook, sendReplyFailedWebhook } from "./webhook";
import { buildOpenAIParams, safeOpenAICall } from "./openaiHelpers";
import type { Agent } from "@shared/schema";

// Maximum number of recent tweets to track per agent
const MAX_RECENT_TWEETS = 20;
// Maximum age of tweets to check for replies (7 days in ms)
const MAX_TWEET_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface TrackedTweet {
  tweetId: string;
  postedAt: Date;
  lastReplyId?: string; // Track last processed reply ID for each tweet
}

interface SchedulerState {
  isRunning: boolean;
  activeAgents: Map<string, NodeJS.Timeout>;
  mentionPollers: Map<string, NodeJS.Timeout>; // Separate timers for mention polling
  lastPostTime: Map<string, Date>;
  postsToday: Map<string, number>;
  lastMentionCheck: Map<string, Date>;
  lastMentionId: Map<string, string>; // Track last processed mention ID for pagination
  repliesThisHour: Map<string, { count: number; hourStart: Date }>; // Track replies per hour per agent
  recentBotTweets: Map<string, TrackedTweet[]>; // Track recent bot tweets for comment detection
  lastCleanupDate: string;
}

const state: SchedulerState = {
  isRunning: false,
  activeAgents: new Map(),
  mentionPollers: new Map(),
  lastPostTime: new Map(),
  postsToday: new Map(),
  lastMentionCheck: new Map(),
  lastMentionId: new Map(),
  repliesThisHour: new Map(),
  recentBotTweets: new Map(),
  lastCleanupDate: new Date().toISOString().split("T")[0],
};

/**
 * Track a newly posted tweet for comment detection
 */
function trackBotTweet(agentId: string, tweetId: string): void {
  const tweets = state.recentBotTweets.get(agentId) || [];
  
  // Check if this tweet is already tracked (don't overwrite existing state)
  const existing = tweets.find(t => t.tweetId === tweetId);
  if (existing) {
    console.log(`[CommentBot] Tweet ${tweetId} already tracked, preserving state`);
    return;
  }
  
  // Add new tweet at the beginning
  tweets.unshift({ tweetId, postedAt: new Date() });
  
  // Remove old tweets (older than 7 days or beyond limit)
  const cutoff = Date.now() - MAX_TWEET_AGE_MS;
  const filtered = tweets
    .filter(t => t.postedAt.getTime() > cutoff)
    .slice(0, MAX_RECENT_TWEETS);
  
  state.recentBotTweets.set(agentId, filtered);
  console.log(`[CommentBot] Tracking tweet ${tweetId} for agent. Total tracked: ${filtered.length}`);
}

/**
 * Get recent bot tweets for comment detection (with their tracking state)
 */
function getRecentBotTweetsWithState(agentId: string): TrackedTweet[] {
  const tweets = state.recentBotTweets.get(agentId) || [];
  const cutoff = Date.now() - MAX_TWEET_AGE_MS;
  return tweets.filter(t => t.postedAt.getTime() > cutoff);
}

/**
 * Update the last processed reply ID for a tweet
 */
function updateLastReplyId(agentId: string, tweetId: string, lastReplyId: string): void {
  const tweets = state.recentBotTweets.get(agentId) || [];
  const tweet = tweets.find(t => t.tweetId === tweetId);
  if (tweet) {
    tweet.lastReplyId = lastReplyId;
  }
}

/**
 * Get recent bot tweets for comment detection (just IDs)
 */
function getRecentBotTweets(agentId: string): string[] {
  return getRecentBotTweetsWithState(agentId).map(t => t.tweetId);
}

/**
 * Backfill recentBotTweets from activity log on startup
 * This ensures comment detection works even after server restarts
 */
async function backfillRecentTweets(agentId: string): Promise<void> {
  try {
    // Check if we already have tweets tracked for this agent
    const existing = state.recentBotTweets.get(agentId) || [];
    if (existing.length > 0) {
      console.log(`[CommentBot] Agent ${agentId} already has ${existing.length} tracked tweets, skipping backfill`);
      return;
    }
    
    // Get recent successful posts from activity log
    const logs = await storage.getActivityLogs(agentId, 50);
    const cutoff = Date.now() - MAX_TWEET_AGE_MS;
    
    const recentPosts = logs
      .filter(log => 
        log.eventType === 'post' && 
        log.status === 'success' && 
        log.tweetId && 
        log.postedAt && 
        new Date(log.postedAt).getTime() > cutoff
      )
      .slice(0, MAX_RECENT_TWEETS);
    
    if (recentPosts.length > 0) {
      const tweets: TrackedTweet[] = recentPosts.map(log => ({
        tweetId: log.tweetId!,
        postedAt: new Date(log.postedAt!),
        lastReplyId: undefined, // Will be set when we process replies
      }));
      
      state.recentBotTweets.set(agentId, tweets);
      console.log(`[CommentBot] Backfilled ${tweets.length} recent tweets for agent ${agentId} from activity log`);
    } else {
      console.log(`[CommentBot] No recent tweets found in activity log for agent ${agentId}`);
    }
  } catch (error) {
    console.error(`[CommentBot] Error backfilling recent tweets for agent ${agentId}:`, error);
  }
}

/**
 * Check if agent can send more replies this hour
 */
function canReplyThisHour(agentId: string, maxRepliesPerHour: number): boolean {
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  
  const replyData = state.repliesThisHour.get(agentId);
  
  // If no data or hour has changed, reset counter
  if (!replyData || replyData.hourStart.getTime() !== hourStart.getTime()) {
    state.repliesThisHour.set(agentId, { count: 0, hourStart });
    return true;
  }
  
  return replyData.count < maxRepliesPerHour;
}

/**
 * Increment reply count for this hour
 */
function incrementReplyCount(agentId: string): void {
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  
  const replyData = state.repliesThisHour.get(agentId);
  
  if (!replyData || replyData.hourStart.getTime() !== hourStart.getTime()) {
    state.repliesThisHour.set(agentId, { count: 1, hourStart });
  } else {
    replyData.count++;
  }
}

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

/**
 * Clean special characters from generated content
 * Replaces: em dashes (—), en dashes (–), curly/smart quotes (" " ' ')
 * With: regular dashes (-), straight quotes ("), apostrophes (')
 */
function cleanSpecialCharacters(content: string): string {
  return content
    // Replace em dashes and en dashes with regular dashes
    .replace(/[—–]/g, "-")
    // Replace curly/smart double quotes with straight quotes
    .replace(/[""]/g, '"')
    // Replace curly/smart single quotes with straight apostrophe
    .replace(/['']/g, "'");
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
    let cleanedContent = stripContentTypeLabels(generated.content);
    // Clean special characters (em dashes, smart quotes)
    cleanedContent = cleanSpecialCharacters(cleanedContent);
    
    console.log(`[Scheduler] Posting to Twitter for agent: ${agent.name}`);
    
    const result = await postTweet(agent, cleanedContent);
    
    const today = new Date().toISOString().split("T")[0];
    const postsKey = `${agent.id}_${today}`;
    
    if (result.success) {
      state.lastPostTime.set(agent.id, new Date());
      state.postsToday.set(postsKey, (state.postsToday.get(postsKey) || 0) + 1);
      
      // Track this tweet for comment detection (replies without @mention)
      if (result.tweetId) {
        trackBotTweet(agent.id, result.tweetId);
      }
      
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
  } else {
    console.log(`[Scheduler] Starting agent: ${agent.name}`);
    scheduleAgent(agent);
  }
  
  // Also start mention polling if replies are enabled
  if (agent.replyEnabled) {
    startMentionPolling(agent);
  }
}

export function stopAgent(agentId: string): void {
  const timer = state.activeAgents.get(agentId);
  if (timer) {
    clearInterval(timer);
    state.activeAgents.delete(agentId);
    console.log(`[Scheduler] Stopped agent: ${agentId}`);
  }
  // Also stop mention polling
  stopMentionPolling(agentId);
}

// ============= MENTION POLLING SYSTEM ============= //

/**
 * Generate a reply to a mention using the AI model
 * Uses CONVERSATIONAL prompt (not auto-post prompt) for natural dialogue
 */
async function generateReply(agent: Agent, mention: TwitterMention): Promise<string> {
  console.log(`[MentionBot] Generating CONVERSATIONAL reply for mention from @${mention.authorUsername}: "${mention.text.substring(0, 50)}..."`);
  
  // Get knowledge base entries for context
  const knowledgeEntries = await storage.getActiveKnowledgeBase(agent.id);
  
  // Use CONVERSATIONAL prompt builder (not auto-post builder)
  const conversationPrompt = await assembleConversationPrompt(agent, knowledgeEntries, {
    includeKnowledge: true,
    includePersonality: true,
    maxKbEntries: 10,
    maxKbTokens: 1000,
  });
  
  console.log(`[MentionBot] Using conversational prompt with components: ${conversationPrompt.metadata.componentsIncluded.join(', ')}`);
  
  // Build the user message for the reply context
  const replyContext = `@${mention.authorUsername} said: "${mention.text}"

Respond naturally to this person. Keep your reply under 280 characters, no hashtags.`;

  const messages = buildConversationMessages(
    conversationPrompt,
    [],
    replyContext
  );
  
  // Use conversation model if available, otherwise use post model
  const modelProvider = agent.conversationModelProvider || agent.postModelProvider || agent.modelProvider || "openai";
  const modelName = agent.conversationModelName || agent.postModelName || agent.modelName || "gpt-4-turbo-preview";
  const temperature = agent.conversationTemperature ?? agent.postTemperature ?? agent.temperature ?? 0.7;
  const maxTokens = 300;
  
  console.log(`[MentionBot] Using model: ${modelProvider}/${modelName} (temp: ${temperature})`);
  
  let reply = "";
  
  if (modelProvider === "openai") {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    });
    
    const params = buildOpenAIParams(modelName, {
      model: modelName,
      messages: messages as any,
      temperature,
      max_tokens: maxTokens,
    });
    
    const response = await safeOpenAICall(openai, params);
    reply = response.choices[0]?.message?.content || "";
  } else if (modelProvider === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic();
    
    const systemMessage = messages.find((m: any) => m.role === "system")?.content || "";
    const userMessages = messages.filter((m: any) => m.role !== "system");
    
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: maxTokens,
      system: systemMessage,
      messages: userMessages as any,
    });
    
    reply = (response.content[0] as any)?.text || "";
  }
  
  // Clean up the reply
  reply = cleanSpecialCharacters(reply.trim());
  
  // Ensure it's under 280 characters
  if (reply.length > 280) {
    reply = reply.substring(0, 277) + "...";
  }
  
  console.log(`[MentionBot] Generated reply (${reply.length} chars): "${reply.substring(0, 50)}..."`);
  
  return reply;
}

/**
 * Process a single mention and post a reply
 * @param mentionType - 'mention' for direct @mentions, 'reply' for comments on bot's tweets
 */
async function processMention(agent: Agent, mention: TwitterMention, mentionType: 'mention' | 'reply' = 'mention'): Promise<void> {
  const typeLabel = mentionType === 'reply' ? 'CommentBot' : 'MentionBot';
  console.log(`[${typeLabel}] Processing ${mentionType} ${mention.id} from @${mention.authorUsername}`);
  
  // Check if we've already processed this mention
  const existing = await storage.getProcessedMention(agent.id, mention.id);
  if (existing) {
    console.log(`[${typeLabel}] ${mentionType} ${mention.id} already processed, skipping`);
    return;
  }
  
  // Create a record for this mention
  const mentionRecord = await storage.createProcessedMention({
    agentId: agent.id,
    mentionTweetId: mention.id,
    authorId: mention.authorId,
    authorUsername: mention.authorUsername,
    mentionText: mention.text,
    conversationId: mention.conversationId,
    mentionType: mentionType,
    mentionedAt: mention.createdAt ? new Date(mention.createdAt) : new Date(),
  });
  
  try {
    // Check reply rate limit
    const maxRepliesPerHour = agent.maxRepliesPerHour || 10;
    const recentMentions = await storage.getRecentMentions(agent.id, maxRepliesPerHour);
    const repliesInLastHour = recentMentions.filter(m => {
      if (!m.processedAt) return false;
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return m.responded && new Date(m.processedAt) > hourAgo;
    }).length;
    
    if (repliesInLastHour >= maxRepliesPerHour) {
      console.log(`[MentionBot] Rate limit reached (${repliesInLastHour}/${maxRepliesPerHour} replies/hour), skipping`);
      await storage.markMentionFailed(mentionRecord.id, "Rate limit reached");
      return;
    }
    
    // Check if reply is enabled
    if (!agent.replyEnabled) {
      console.log(`[MentionBot] Replies disabled for agent, skipping`);
      await storage.markMentionFailed(mentionRecord.id, "Replies disabled");
      return;
    }
    
    // Check reply rate (percentage of mentions to respond to)
    const replyRate = agent.replyRate || 100;
    if (Math.random() * 100 > replyRate) {
      console.log(`[MentionBot] Skipping mention due to reply rate (${replyRate}%)`);
      await storage.markMentionFailed(mentionRecord.id, `Skipped by reply rate (${replyRate}%)`);
      return;
    }
    
    // Add delay before replying (if configured)
    // Use replyDelay as base, add some randomness
    const baseDelay = agent.replyDelay || 30; // Default 30 seconds
    const minDelay = baseDelay;
    const maxDelay = baseDelay * 2; // Double the base delay for max
    const delayMs = (Math.random() * (maxDelay - minDelay) + minDelay) * 1000;
    
    console.log(`[MentionBot] Waiting ${Math.round(delayMs / 1000)}s before replying...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    // Generate the reply
    const replyText = await generateReply(agent, mention);
    
    // Post the reply
    const result = await replyToTweet(agent, replyText, mention.id);
    
    if (result.success && result.tweetId) {
      console.log(`[MentionBot] Successfully replied to mention ${mention.id} with tweet ${result.tweetId}`);
      await storage.markMentionResponded(mentionRecord.id, result.tweetId, replyText);
      
      // Increment reply count for rate limiting
      incrementReplyCount(agent.id);
      
      // Send webhook
      await sendReplyCreatedWebhook(agent, replyText, result.tweetId, mention.id);
      
      // Log activity
      await logActivity({
        agentId: agent.id,
        eventType: "reply",
        status: "success",
        tweetId: result.tweetId,
        content: replyText,
        modelProvider: agent.conversationModelProvider || agent.modelProvider,
        modelName: agent.conversationModelName || agent.modelName,
      });
    } else {
      console.error(`[MentionBot] Failed to reply to mention ${mention.id}:`, result.error);
      await storage.markMentionFailed(mentionRecord.id, result.error || "Unknown error");
      
      // Send webhook
      await sendReplyFailedWebhook(agent, result.error || "Unknown error", mention.id, replyText);
      
      // Log activity
      await logActivity({
        agentId: agent.id,
        eventType: "reply",
        status: "failed",
        errorMessage: result.error,
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[MentionBot] Error processing mention ${mention.id}:`, error);
    await storage.markMentionFailed(mentionRecord.id, errorMsg);
  }
}

/**
 * Poll for new mentions and process them
 */
async function pollMentions(agent: Agent): Promise<void> {
  console.log(`[MentionBot] Polling mentions for agent: ${agent.name}`);
  
  // Get the last processed mention ID - prefer in-memory, fallback to DB
  const sinceId = state.lastMentionId.get(agent.id) || agent.lastMentionId || undefined;
  
  try {
    // Fetch new mentions
    const result = await fetchMentions(agent, sinceId, 10);
    
    if (!result.success) {
      console.error(`[MentionBot] Failed to fetch mentions for ${agent.name}:`, result.error);
      return;
    }
    
    const mentions = result.mentions || [];
    console.log(`[MentionBot] Found ${mentions.length} new mentions for ${agent.name}`);
    
    // Update the last mention ID for pagination - both in-memory and DB
    if (result.newestId) {
      state.lastMentionId.set(agent.id, result.newestId);
      // Persist to database for restart recovery
      try {
        await storage.updateAgent(agent.id, {
          lastMentionId: result.newestId,
          lastMentionCheckAt: new Date(),
        });
      } catch (e) {
        console.error(`[MentionBot] Failed to persist lastMentionId:`, e);
      }
    }
    
    // Process each mention (with rate limiting)
    const maxReplies = agent.maxRepliesPerHour || 10;
    for (const mention of mentions) {
      // Check max replies per hour limit
      if (!canReplyThisHour(agent.id, maxReplies)) {
        console.log(`[MentionBot] Rate limit reached (${maxReplies}/hour) for ${agent.name}, stopping processing`);
        break;
      }
      
      try {
        await processMention(agent, mention);
      } catch (error) {
        console.error(`[MentionBot] Error processing mention ${mention.id}:`, error);
      }
    }
    
    state.lastMentionCheck.set(agent.id, new Date());
  } catch (error) {
    console.error(`[MentionBot] Error polling mentions for ${agent.name}:`, error);
  }
}

/**
 * Poll for comments on the bot's recent tweets (replies without @mention)
 */
async function pollComments(agent: Agent): Promise<void> {
  const trackedTweets = getRecentBotTweetsWithState(agent.id);
  
  if (trackedTweets.length === 0) {
    console.log(`[CommentBot] No recent tweets to check for ${agent.name}`);
    return;
  }
  
  console.log(`[CommentBot] Checking ${trackedTweets.length} recent tweets for comments for ${agent.name}`);
  
  const maxReplies = agent.maxRepliesPerHour || 10;
  
  // Check each recent tweet for replies (limit to 5 most recent to avoid rate limits)
  const tweetsToCheck = trackedTweets.slice(0, 5);
  
  for (const trackedTweet of tweetsToCheck) {
    // Check rate limit before processing more tweets
    if (!canReplyThisHour(agent.id, maxReplies)) {
      console.log(`[CommentBot] Rate limit reached (${maxReplies}/hour) for ${agent.name}, stopping comment check`);
      break;
    }
    
    try {
      // Pass the lastReplyId to only get new replies since last check
      const result = await fetchRepliesToTweet(agent, trackedTweet.tweetId, trackedTweet.lastReplyId, 10);
      
      if (!result.success) {
        console.error(`[CommentBot] Failed to fetch replies for tweet ${trackedTweet.tweetId}:`, result.error);
        continue;
      }
      
      const replies = result.mentions || [];
      if (replies.length > 0) {
        console.log(`[CommentBot] Found ${replies.length} new comments on tweet ${trackedTweet.tweetId}`);
      }
      
      // Track the newest reply ID we've seen for this tweet
      let newestReplyId: string | undefined = trackedTweet.lastReplyId;
      
      // Process each reply as a mention (same flow)
      for (const reply of replies) {
        // Update newest reply ID (replies are typically ordered by time)
        if (!newestReplyId || reply.id > newestReplyId) {
          newestReplyId = reply.id;
        }
        
        // Check rate limit for each reply
        if (!canReplyThisHour(agent.id, maxReplies)) {
          console.log(`[CommentBot] Rate limit reached while processing comments`);
          break;
        }
        
        try {
          // Mark the mention type as 'reply' (comment on bot's post)
          await processMention(agent, reply, 'reply');
        } catch (error) {
          console.error(`[CommentBot] Error processing comment ${reply.id}:`, error);
        }
      }
      
      // Update the lastReplyId for this tweet to prevent reprocessing
      if (newestReplyId && newestReplyId !== trackedTweet.lastReplyId) {
        updateLastReplyId(agent.id, trackedTweet.tweetId, newestReplyId);
        console.log(`[CommentBot] Updated lastReplyId for tweet ${trackedTweet.tweetId} to ${newestReplyId}`);
      }
    } catch (error) {
      console.error(`[CommentBot] Error checking replies for tweet ${trackedTweet.tweetId}:`, error);
    }
  }
}

/**
 * Start mention polling for an agent
 */
export async function startMentionPolling(agent: Agent): Promise<void> {
  // Check if replies are enabled
  if (!agent.replyEnabled) {
    console.log(`[MentionBot] Replies disabled for agent ${agent.name}, not starting mention polling`);
    return;
  }
  
  // Check Twitter credentials
  const validation = validateTwitterCredentials(agent);
  if (!validation.valid) {
    console.log(`[MentionBot] Twitter credentials not valid for ${agent.name}, not starting mention polling`);
    return;
  }
  
  // Stop existing poller if running
  stopMentionPolling(agent.id);
  
  // CRITICAL: Backfill recentBotTweets from activity log before polling
  // This ensures comment detection works even after server restarts
  await backfillRecentTweets(agent.id);
  
  // Poll interval: check every 2-5 minutes (configurable)
  const intervalMs = 3 * 60 * 1000; // 3 minutes default
  
  console.log(`[MentionBot] Starting mention polling for ${agent.name} (interval: ${intervalMs / 1000}s)`);
  
  // Do an initial poll for mentions
  pollMentions(agent).catch(err => 
    console.error(`[MentionBot] Initial poll failed for ${agent.name}:`, err)
  );
  
  // Also do an initial poll for comments on recent tweets
  pollComments(agent).catch(err => 
    console.error(`[CommentBot] Initial comment poll failed for ${agent.name}:`, err)
  );
  
  // Schedule regular polling (both mentions and comments)
  const timer = setInterval(async () => {
    try {
      const currentAgent = await storage.getAgent(agent.id);
      if (currentAgent && currentAgent.status === "active" && currentAgent.replyEnabled) {
        // Poll for direct @mentions
        await pollMentions(currentAgent);
        
        // Also poll for comments on bot's recent tweets (replies without @mention)
        await pollComments(currentAgent);
      } else {
        stopMentionPolling(agent.id);
      }
    } catch (error) {
      console.error(`[MentionBot] Error in scheduled mention poll for ${agent.id}:`, error);
    }
  }, intervalMs);
  
  state.mentionPollers.set(agent.id, timer);
}

/**
 * Stop mention polling for an agent
 */
export function stopMentionPolling(agentId: string): void {
  const timer = state.mentionPollers.get(agentId);
  if (timer) {
    clearInterval(timer);
    state.mentionPollers.delete(agentId);
    console.log(`[MentionBot] Stopped mention polling for agent: ${agentId}`);
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
  
  // Stop all posting timers
  const entries = Array.from(state.activeAgents.entries());
  for (const [agentId, timer] of entries) {
    clearInterval(timer);
    console.log(`[Scheduler] Stopped agent posting: ${agentId}`);
  }
  
  // Stop all mention pollers
  const mentionEntries = Array.from(state.mentionPollers.entries());
  for (const [agentId, timer] of mentionEntries) {
    clearInterval(timer);
    console.log(`[Scheduler] Stopped mention polling: ${agentId}`);
  }
  
  state.activeAgents.clear();
  state.mentionPollers.clear();
  state.repliesThisHour.clear();
  state.isRunning = false;
}
