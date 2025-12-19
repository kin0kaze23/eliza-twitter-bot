import { storage, db } from "./storage";
import { activityLogs } from "@shared/schema";
import { postTweet, validateTwitterCredentials, replyToTweet, fetchMentions, fetchRepliesToTweet, type TwitterMention } from "./twitter";
import { fetchMentionsViaScraper, fetchRepliesViaScraper, sendReplyViaScraper, sendTweetViaScraper, type ScrapedTweet } from "./twitterScraper";
import { assemblePrompt, buildMessagesArray, selectNextContentType, formatContentType, assembleConversationPrompt, buildConversationMessages, type ContentType } from "./promptAssembly";
import { sendPostCreatedWebhook, sendPostFailedWebhook, sendReplyCreatedWebhook, sendReplyFailedWebhook } from "./webhook";
import { buildOpenAIParams, safeOpenAICall } from "./openaiHelpers";
import type { Agent } from "@shared/schema";

// Helper to check if scraper credentials are available
function hasScraperCredentials(agent: Agent): boolean {
  return !!(agent.twitterUsername && agent.twitterPassword);
}

// Helper to check if API credentials are available
// Checks BOTH environment secrets AND database values
import { getTwitterCredentials } from "./twitter";

function hasApiCredentials(agent: Agent): boolean {
  const creds = getTwitterCredentials(agent);
  return !!(creds.apiKey && creds.apiSecret && 
            creds.accessToken && creds.accessSecret);
}

// Convert scraped tweet to TwitterMention format
function scrapedToMention(tweet: ScrapedTweet): TwitterMention {
  return {
    id: tweet.id,
    text: tweet.text,
    authorId: tweet.userId,
    authorUsername: tweet.username,
    authorName: tweet.username,
    createdAt: tweet.timeParsed?.toISOString(),
    conversationId: tweet.conversationId,
    referencedTweetId: tweet.inReplyToStatusId,
  };
}

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
  // NEW: Rate limit backoff and posting lock
  rateLimitBackoff: Map<string, Date>; // When rate limited, store the time to resume
  postingLock: Map<string, boolean>; // Prevent concurrent posting attempts
}

// Rate limit backoff settings - conservative to ensure stability
// Twitter Free tier: ~17 posts/24h = 1 post per 1.4 hours
// Basic tier ($200/mo): 50 posts/24h = 1 post per ~30 minutes
const INITIAL_RATE_LIMIT_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes base backoff
const MAX_RATE_LIMIT_BACKOFF_MS = 6 * 60 * 60 * 1000; // 6 hours max (prevents lockout)
const PERMISSION_ERROR_BACKOFF_MS = 60 * 60 * 1000; // 1 hour for "not permitted" errors
const consecutiveFailures = new Map<string, number>(); // Track failures per agent for exponential backoff

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
  rateLimitBackoff: new Map(),
  postingLock: new Map(),
};

/**
 * Reset all backoff state for an agent (call on successful post)
 */
function resetBackoff(agentId: string): void {
  consecutiveFailures.delete(agentId);
  state.rateLimitBackoff.delete(agentId);
  console.log(`[Scheduler] Reset backoff state for agent ${agentId} after successful post`);
}

/**
 * Track consecutive failures for adaptive behavior
 */
function recordFailure(agentId: string): number {
  const count = (consecutiveFailures.get(agentId) || 0) + 1;
  consecutiveFailures.set(agentId, count);
  return count;
}

/**
 * Get adaptive backoff based on failure count
 * Uses exponential backoff with jitter for stability
 */
function getAdaptiveBackoff(agentId: string, isRateLimit: boolean): number {
  const failures = consecutiveFailures.get(agentId) || 1;
  const baseBackoff = isRateLimit ? INITIAL_RATE_LIMIT_BACKOFF_MS : PERMISSION_ERROR_BACKOFF_MS;
  
  // Exponential backoff: base * 2^(failures-1), capped at max
  const backoff = Math.min(
    baseBackoff * Math.pow(2, failures - 1),
    MAX_RATE_LIMIT_BACKOFF_MS
  );
  
  // Add jitter (0-10% of backoff) to prevent synchronized retries
  const jitter = Math.random() * 0.1 * backoff;
  
  return Math.floor(backoff + jitter);
}

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
 * PRESERVES: Newlines and paragraph structure for proper Twitter formatting
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
    // CRITICAL: Only normalize horizontal whitespace (spaces/tabs), NOT newlines
    // This preserves paragraph structure for Twitter formatting
    .replace(/[^\S\n]+/g, " ") // Replace multiple spaces/tabs with single space, but keep newlines
    .replace(/\n{3,}/g, "\n\n") // Limit to maximum 2 consecutive newlines
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

// Minimum safe posting intervals to avoid Twitter rate limits
const MIN_POSTING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes minimum between posts
const RECOMMENDED_POSTING_INTERVAL_MS = 60 * 60 * 1000; // 1 hour recommended

function getPostIntervalMs(agent: Agent): number {
  const frequency = agent.postFrequency || 2;
  const interval = agent.postInterval || "hours";
  
  let calculatedInterval: number;
  if (interval === "minutes") {
    calculatedInterval = frequency * 60 * 1000;
  } else {
    calculatedInterval = frequency * 60 * 60 * 1000;
  }
  
  // Enforce minimum interval to prevent rate limiting
  // Twitter Free tier allows ~17 posts/24h (1 per 1.4 hours)
  // To be safe, we enforce at least 30 minutes between posts
  if (calculatedInterval < MIN_POSTING_INTERVAL_MS) {
    console.log(`[Scheduler] Warning: Posting interval of ${calculatedInterval/60000}m is too aggressive. Enforcing minimum of ${MIN_POSTING_INTERVAL_MS/60000}m to prevent rate limits.`);
    return MIN_POSTING_INTERVAL_MS;
  }
  
  return calculatedInterval;
}

function canPostNow(agent: Agent): boolean {
  if (!agent.postingEnabled) return false;
  if (isInQuietHours(agent)) return false;
  
  // Check if we're in rate limit backoff
  const backoffUntil = state.rateLimitBackoff.get(agent.id);
  if (backoffUntil && Date.now() < backoffUntil.getTime()) {
    const remainingMs = backoffUntil.getTime() - Date.now();
    // Only log once every minute per agent to avoid spamming
    if (!(state as any).lastBackoffLog) (state as any).lastBackoffLog = new Map();
    const lastLogTime = (state as any).lastBackoffLog.get(agent.id);
    if (!lastLogTime || (Date.now() - lastLogTime.getTime() > 60000)) {
      console.log(`[Scheduler] Agent ${agent.name} in rate limit backoff for ${Math.ceil(remainingMs / 60000)} more minutes`);
      (state as any).lastBackoffLog.set(agent.id, new Date());
    }
    return false;
  }
  
  // Check if already posting (prevent duplicates)
  if (state.postingLock.get(agent.id)) {
    console.log(`[Scheduler] Agent ${agent.name} already posting, skipping`);
    return false;
  }
  
  cleanupOldPostCounts();
  
  const today = new Date().toISOString().split("T")[0];
  const postsKey = `${agent.id}_${today}`;
  const postsToday = state.postsToday.get(postsKey) || 0;
  
  if (agent.maxPostsPerDay && postsToday >= agent.maxPostsPerDay) {
    return false;
  }
  
  // Check posting interval - use BOTH in-memory AND persisted lastPostedAt
  // This ensures we respect the interval even after server restarts
  const inMemoryLastPost = state.lastPostTime.get(agent.id);
  // Normalize persisted timestamp to Date object (could be string from DB)
  const persistedLastPostDate = agent.lastPostedAt ? new Date(agent.lastPostedAt) : null;
  
  // Use the most recent of the two timestamps
  let lastPost: Date | null = null;
  if (inMemoryLastPost && persistedLastPostDate) {
    lastPost = inMemoryLastPost.getTime() > persistedLastPostDate.getTime() ? inMemoryLastPost : persistedLastPostDate;
  } else {
    lastPost = inMemoryLastPost || persistedLastPostDate;
  }
  
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
  // Check if we can post (includes rate limit backoff and lock check)
  if (!canPostNow(agent)) {
    return;
  }
  
  // Acquire posting lock to prevent duplicate posts
  state.postingLock.set(agent.id, true);
  
  try {
    // Check if either API or scraper credentials are available for posting
    const hasApi = hasApiCredentials(agent);
    const hasScraper = hasScraperCredentials(agent);
    
    if (!hasApi && !hasScraper) {
      console.log(`Agent ${agent.name}: Missing Twitter credentials (no API or scraper credentials)`);
      return; // finally block will release lock
    }
    
    console.log(`[Scheduler] Generating post for agent: ${agent.name} (method: ${hasApi ? 'API' : 'Scraper'})`);
    
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
    
    // Try API first if available, otherwise use scraper
    let result: { success: boolean; tweetId?: string; error?: string; errorCode?: string; rateLimited?: boolean };
    
    if (hasApi) {
      // Use official Twitter API
      result = await postTweet(agent, cleanedContent);
      
      // If API fails and scraper is available, try scraper as fallback
      if (!result.success && hasScraper) {
        console.log(`[Scheduler] API failed, trying scraper fallback for ${agent.name}`);
        const scraperResult = await sendTweetViaScraper(agent, cleanedContent);
        if (scraperResult.success) {
          result = {
            success: true,
            tweetId: scraperResult.tweetId,
          };
        }
      }
    } else {
      // No API credentials, use scraper
      const scraperResult = await sendTweetViaScraper(agent, cleanedContent);
      result = {
        success: scraperResult.success,
        tweetId: scraperResult.tweetId,
        error: scraperResult.error,
        errorCode: scraperResult.error ? 'SCRAPER_ERROR' : undefined,
      };
    }
    
    const today = new Date().toISOString().split("T")[0];
    const postsKey = `${agent.id}_${today}`;
    
    if (result.success) {
      state.lastPostTime.set(agent.id, new Date());
      state.postsToday.set(postsKey, (state.postsToday.get(postsKey) || 0) + 1);
      
      // Clear any rate limit backoff on success - posting is working again
      resetBackoff(agent.id);
      
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
      
      // Update BOTH in-memory state AND persist to database
      // This prevents duplicate posts within the same session AND after restarts
      const now = new Date();
      state.lastPostTime.set(agent.id, now);
      
      try {
        await storage.updateAgent(agent.id, { lastPostedAt: now });
        console.log(`[Scheduler] Persisted lastPostedAt for ${agent.name}`);
      } catch (err) {
        console.error(`[Scheduler] Failed to persist lastPostedAt:`, err);
      }
      
      if (agent.webhookEnabled && agent.webhookUrl) {
        sendPostCreatedWebhook(agent, cleanedContent, result.tweetId).catch((err) =>
          console.error("Webhook error:", err)
        );
      }
    } else {
      // Track failure for adaptive backoff
      const failureCount = recordFailure(agent.id);
      
      // Determine error type and apply appropriate backoff
      const isRateLimit = Boolean(result.rateLimited) || Boolean(result.error && (result.error.includes("Rate limit") || result.error.includes("429")));
      const isPermissionError = Boolean(result.error && (result.error.includes("not permitted") || result.error.includes("permission") || result.error.includes("32") || result.errorCode === "AUTH_ERROR"));
      
      if (isRateLimit || isPermissionError) {
        const duration = getAdaptiveBackoff(agent.id, isRateLimit);
        const backoffUntil = new Date(Date.now() + duration);
        state.rateLimitBackoff.set(agent.id, backoffUntil);
        
        if (isRateLimit) {
          console.log(`[Scheduler] Rate limited! Agent ${agent.name} in backoff until ${backoffUntil.toISOString()} (Duration: ${Math.ceil(duration/60000)}m, Failures: ${failureCount})`);
        } else {
          console.log(`[Scheduler] Permission error! Agent ${agent.name} in backoff until ${backoffUntil.toISOString()} (Duration: ${Math.ceil(duration/60000)}m, Failures: ${failureCount})`);
          console.log(`[Scheduler] TIP: "Not permitted" errors usually mean stale cookies or account restrictions. Try exporting fresh cookies from x.com.`);
        }
      }
      
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
  } finally {
    // Always release the posting lock
    state.postingLock.set(agent.id, false);
  }
}

function scheduleAgent(agent: Agent): void {
  if (state.activeAgents.has(agent.id)) {
    clearInterval(state.activeAgents.get(agent.id)!);
  }
  
  const intervalMs = getPostIntervalMs(agent);
  
  // Check if we should skip the initial post based on persisted lastPostedAt
  // This prevents duplicate posts after server restarts
  const persistedLastPost = agent.lastPostedAt;
  let initialDelayMs = 0;
  
  if (persistedLastPost) {
    const timeSinceLastPost = Date.now() - new Date(persistedLastPost).getTime();
    const remainingTime = intervalMs - timeSinceLastPost;
    
    if (remainingTime > 0) {
      // Not enough time has passed since last post, wait for remaining interval
      initialDelayMs = remainingTime + Math.floor(Math.random() * 60 * 1000); // Add 0-1 min jitter
      console.log(`[Scheduler] Agent ${agent.name}: Last post was ${Math.round(timeSinceLastPost/60000)}m ago. Waiting ${Math.round(initialDelayMs/60000)}m before first post (interval: ${Math.round(intervalMs/60000)}m)`);
    } else {
      // Interval has elapsed, can post with small jitter
      initialDelayMs = Math.floor(Math.random() * 5 * 60 * 1000); // 0-5 min jitter
      console.log(`[Scheduler] Agent ${agent.name}: Interval elapsed since last post. First post in ${Math.round(initialDelayMs/1000)}s`);
    }
  } else {
    // No previous post recorded, use small jitter for first post
    initialDelayMs = Math.floor(Math.random() * 5 * 60 * 1000); // 0-5 min jitter
    console.log(`[Scheduler] Agent ${agent.name}: No previous post found. First post in ${Math.round(initialDelayMs/1000)}s (interval: ${Math.round(intervalMs/60000)}m)`);
  }
  
  // Hydrate in-memory state from persisted value if available
  if (persistedLastPost) {
    state.lastPostTime.set(agent.id, new Date(persistedLastPost));
  }
  
  // Schedule initial post with calculated delay
  setTimeout(() => {
    executePost(agent).catch(err => 
      console.error(`[Scheduler] Initial post failed for ${agent.name}:`, err)
    );
  }, initialDelayMs);
  
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
    
    // Post the reply - use API first, fall back to scraper (consistent with posting)
    const hasApi = hasApiCredentials(agent);
    const hasScraper = hasScraperCredentials(agent);
    
    let result: { success: boolean; tweetId?: string; error?: string };
    
    if (hasApi) {
      result = await replyToTweet(agent, replyText, mention.id);
      
      // If API fails and scraper is available, try scraper as fallback
      if (!result.success && hasScraper) {
        console.log(`[MentionBot] API reply failed, trying scraper fallback`);
        const scraperResult = await sendReplyViaScraper(agent, replyText, mention.id);
        if (scraperResult.success) {
          result = { success: true, tweetId: scraperResult.tweetId };
        }
      }
    } else if (hasScraper) {
      // No API credentials, use scraper directly
      const scraperResult = await sendReplyViaScraper(agent, replyText, mention.id);
      result = {
        success: scraperResult.success,
        tweetId: scraperResult.tweetId,
        error: scraperResult.error,
      };
    } else {
      result = { success: false, error: "No Twitter credentials available" };
    }
    
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
 * Prefers OAuth API when credentials available, falls back to scraper
 */
async function pollMentions(agent: Agent): Promise<void> {
  console.log(`[MentionBot] Polling mentions for agent: ${agent.name}`);
  
  // Get the last processed mention ID - prefer in-memory, fallback to DB
  const sinceId = state.lastMentionId.get(agent.id) || agent.lastMentionId || undefined;
  
  try {
    let mentions: TwitterMention[] = [];
    let newestId: string | undefined;
    
    // Prefer OAuth API when credentials available (more reliable than scraper)
    const hasApi = hasApiCredentials(agent);
    const hasScraper = hasScraperCredentials(agent);
    
    if (hasApi) {
      // Use Twitter API (OAuth) - most reliable method
      console.log(`[MentionBot] Using Twitter API (OAuth) for ${agent.name}`);
      const result = await fetchMentions(agent, sinceId, 10);
      
      if (!result.success) {
        console.error(`[MentionBot] API failed for ${agent.name}: ${result.error}`);
        // Try scraper as fallback if available
        if (hasScraper) {
          console.log(`[MentionBot] Falling back to scraper for ${agent.name}`);
          const scraperResult = await fetchMentionsViaScraper(agent, 20);
          if (scraperResult.success && scraperResult.mentions) {
            mentions = scraperResult.mentions.map(scrapedToMention);
            if (sinceId) {
              mentions = mentions.filter(m => m.id > sinceId);
            }
            if (mentions.length > 0) {
              newestId = mentions[0].id;
            }
          } else {
            console.log(`[MentionBot] Scraper also failed: ${scraperResult.error}`);
            return;
          }
        } else {
          return;
        }
      } else {
        mentions = result.mentions || [];
        newestId = result.newestId;
      }
    } else if (hasScraper) {
      // Fall back to scraper (cookie-based)
      console.log(`[MentionBot] Using scraper (cookie-based) for ${agent.name} - no API credentials`);
      const scraperResult = await fetchMentionsViaScraper(agent, 20);
      
      if (scraperResult.success && scraperResult.mentions) {
        mentions = scraperResult.mentions.map(scrapedToMention);
        if (sinceId) {
          mentions = mentions.filter(m => m.id > sinceId);
        }
        if (mentions.length > 0) {
          newestId = mentions[0].id;
        }
        console.log(`[MentionBot] Scraper found ${mentions.length} new mentions for ${agent.name}`);
      } else {
        console.log(`[MentionBot] Scraper failed: ${scraperResult.error}`);
        return;
      }
    } else {
      console.log(`[MentionBot] No Twitter credentials available for ${agent.name}`);
      return;
    }
    
    console.log(`[MentionBot] Found ${mentions.length} new mentions for ${agent.name}`);
    
    // Update the last mention ID for pagination - both in-memory and DB
    if (newestId) {
      state.lastMentionId.set(agent.id, newestId);
      // Persist to database for restart recovery
      try {
        await storage.updateAgent(agent.id, {
          lastMentionId: newestId,
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
 * Prefers OAuth API when credentials available, falls back to scraper
 */
async function pollComments(agent: Agent): Promise<void> {
  const trackedTweets = getRecentBotTweetsWithState(agent.id);
  
  if (trackedTweets.length === 0) {
    console.log(`[CommentBot] No recent tweets to check for ${agent.name}`);
    return;
  }
  
  console.log(`[CommentBot] Checking ${trackedTweets.length} recent tweets for comments for ${agent.name}`);
  
  // Prefer OAuth API when credentials available (more reliable than scraper)
  const hasApi = hasApiCredentials(agent);
  const hasScraper = hasScraperCredentials(agent);
  
  if (hasApi) {
    console.log(`[CommentBot] Using Twitter API (OAuth) for ${agent.name}`);
  } else if (hasScraper) {
    console.log(`[CommentBot] Using scraper (cookie-based) for ${agent.name} - no API credentials`);
  } else {
    console.log(`[CommentBot] No Twitter credentials available for ${agent.name}`);
    return;
  }
  
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
      let replies: TwitterMention[] = [];
      
      if (hasApi) {
        // Use Twitter API (OAuth) - most reliable method
        const result = await fetchRepliesToTweet(agent, trackedTweet.tweetId, trackedTweet.lastReplyId, 10);
        
        if (!result.success) {
          console.error(`[CommentBot] API failed for tweet ${trackedTweet.tweetId}:`, result.error);
          // Try scraper as fallback if available
          if (hasScraper) {
            const scraperResult = await fetchRepliesViaScraper(agent, trackedTweet.tweetId);
            if (scraperResult.success) {
              const scraperReplies = scraperResult.replies || [];
              replies = scraperReplies.map(scrapedToMention);
              if (trackedTweet.lastReplyId) {
                replies = replies.filter(r => r.id > trackedTweet.lastReplyId!);
              }
            } else {
              console.log(`[CommentBot] Scraper also failed: ${scraperResult.error}`);
              continue;
            }
          } else {
            continue;
          }
        } else {
          replies = result.mentions || [];
        }
      } else if (hasScraper) {
        // Use scraper (cookie-based) as fallback
        const scraperResult = await fetchRepliesViaScraper(agent, trackedTweet.tweetId);
        
        if (!scraperResult.success) {
          console.error(`[CommentBot] Scraper failed for tweet ${trackedTweet.tweetId}:`, scraperResult.error);
          continue;
        }
        
        // Convert scraped replies to TwitterMention format
        const scraperReplies = scraperResult.replies || [];
        replies = scraperReplies.map(scrapedToMention);
        
        // Filter out already processed replies
        if (trackedTweet.lastReplyId) {
          replies = replies.filter(r => r.id > trackedTweet.lastReplyId!);
        }
      }
      
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
  
  // Check if we have either scraper credentials OR API credentials
  const hasScraper = hasScraperCredentials(agent);
  const hasApi = validateTwitterCredentials(agent).valid;
  
  if (!hasScraper && !hasApi) {
    console.log(`[MentionBot] No Twitter credentials for ${agent.name}. Add username/password for scraper or API keys for API access.`);
    return;
  }
  
  if (hasApi) {
    console.log(`[MentionBot] Will use Twitter API (OAuth) for ${agent.name}`);
  } else if (hasScraper) {
    console.log(`[MentionBot] Will use scraper (cookie-based) for ${agent.name} - no API credentials`);
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
      // Only require replyEnabled - don't require "active" status for single-agent dashboard
      // This allows comment detection to work regardless of posting schedule status
      if (currentAgent && currentAgent.replyEnabled) {
        // Poll for direct @mentions
        await pollMentions(currentAgent);
        
        // Also poll for comments on bot's recent tweets (replies without @mention)
        await pollComments(currentAgent);
      } else {
        console.log(`[MentionBot] Replies disabled for agent ${agent.id}, stopping polling`);
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
    
    // Start posting scheduler for active agents with posting enabled
    const postingAgents = agents.filter(
      (a) => a.status === "active" && a.postingEnabled
    );
    
    console.log(`[Scheduler] Found ${postingAgents.length} active agents with posting enabled`);
    
    for (const agent of postingAgents) {
      startAgent(agent);
    }
    
    // CRITICAL: Also start mention polling for agents with replyEnabled
    // This enables comment detection even if posting isn't enabled or agent isn't "active"
    const replyAgents = agents.filter(a => a.replyEnabled);
    console.log(`[Scheduler] Found ${replyAgents.length} agents with replies enabled`);
    
    for (const agent of replyAgents) {
      // Only start if not already started (posting agents already have mention polling)
      if (!state.mentionPollers.has(agent.id)) {
        startMentionPolling(agent);
      }
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
