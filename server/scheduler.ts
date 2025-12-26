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
  lastReplyId?: string;
}

interface SchedulerState {
  isRunning: boolean;
  activeAgents: Map<string, NodeJS.Timeout>;
  mentionPollers: Map<string, NodeJS.Timeout>;
  lastPostTime: Map<string, Date>;
  postsToday: Map<string, number>;
  lastMentionCheck: Map<string, Date>;
  lastMentionId: Map<string, string>;
  repliesThisHour: Map<string, { count: number; hourStart: Date }>;
  recentBotTweets: Map<string, TrackedTweet[]>;
  lastCleanupDate: string;
  rateLimitBackoff: Map<string, Date>;
  postingLock: Map<string, boolean>;
}

const INITIAL_RATE_LIMIT_BACKOFF_MS = 30 * 60 * 1000;
const MAX_RATE_LIMIT_BACKOFF_MS = 6 * 60 * 60 * 1000;
const PERMISSION_ERROR_BACKOFF_MS = 60 * 60 * 1000;
const consecutiveFailures = new Map<string, number>();

const SAFE_MODE_FAILURE_THRESHOLD = 5;
const DIVERSITY_WARNING_THRESHOLD = 60;
const DIVERSITY_PAUSE_THRESHOLD = 40;
const DIVERSITY_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const lastDiversityCheck = new Map<string, Date>();

async function logActivity(params: any) {
  try {
    await storage.createActivityLog(params);
  } catch (error) {
    console.error("[Scheduler] Error logging activity:", error);
  }
}

async function loadSchedulerState(agentId: string): Promise<void> {
  try {
    const dbState = await storage.getSchedulerState(agentId);
    if (!dbState) return;
    if (dbState.lastPostTime) state.lastPostTime.set(agentId, new Date(dbState.lastPostTime));
    const today = new Date().toISOString().split("T")[0];
    if (dbState.postsResetDate === today && dbState.postsToday > 0) {
      state.postsToday.set(`${agentId}_${today}`, dbState.postsToday);
    }
    if (dbState.rateLimitBackoffUntil && new Date(dbState.rateLimitBackoffUntil).getTime() > Date.now()) {
      state.rateLimitBackoff.set(agentId, new Date(dbState.rateLimitBackoffUntil));
    }
    if (dbState.consecutiveFailures > 0) consecutiveFailures.set(agentId, dbState.consecutiveFailures);
  } catch (error) {
    console.error(`[Scheduler] Error loading state for agent ${agentId}:`, error);
  }
}

async function saveSchedulerState(agentId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const postsKey = `${agentId}_${today}`;
    await storage.saveSchedulerState(agentId, {
      lastPostTime: state.lastPostTime.get(agentId) || null,
      postsToday: state.postsToday.get(postsKey) || 0,
      postsResetDate: today,
      rateLimitBackoffUntil: state.rateLimitBackoff.get(agentId) || null,
      consecutiveFailures: consecutiveFailures.get(agentId) || 0,
      repliesThisHour: state.repliesThisHour.get(agentId)?.count || 0,
      repliesHourStart: state.repliesThisHour.get(agentId)?.hourStart || null,
      recentBotTweets: (state.recentBotTweets.get(agentId) || []).map(t => ({
        tweetId: t.tweetId,
        postedAt: t.postedAt.toISOString(),
        lastReplyId: t.lastReplyId,
      })),
      lastDiversityCheck: lastDiversityCheck.get(agentId) || null,
    });
  } catch (error) {
    console.error(`[Scheduler] Error saving state for agent ${agentId}:`, error);
  }
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
  rateLimitBackoff: new Map(),
  postingLock: new Map(),
};

function resetBackoff(agentId: string): void {
  consecutiveFailures.delete(agentId);
  state.rateLimitBackoff.delete(agentId);
}

function recordFailure(agentId: string): number {
  const count = (consecutiveFailures.get(agentId) || 0) + 1;
  consecutiveFailures.set(agentId, count);
  return count;
}

function getAdaptiveBackoff(agentId: string, isRateLimit: boolean): number {
  const failures = consecutiveFailures.get(agentId) || 1;
  const baseBackoff = isRateLimit ? INITIAL_RATE_LIMIT_BACKOFF_MS : PERMISSION_ERROR_BACKOFF_MS;
  const backoff = Math.min(baseBackoff * Math.pow(2, failures - 1), MAX_RATE_LIMIT_BACKOFF_MS);
  if (isRateLimit && failures > 2) return Math.max(backoff, 4 * 60 * 60 * 1000);
  return Math.floor(backoff + Math.random() * 0.1 * backoff);
}

function cleanupOldPostCounts(): void {
  const today = new Date().toISOString().split("T")[0];
  if (state.lastCleanupDate !== today) {
    state.postsToday.forEach((_, key) => { if (!key.endsWith(`_${today}`)) state.postsToday.delete(key); });
    state.lastCleanupDate = today;
  }
}

function canPostNow(agent: Agent): boolean {
  if (!agent.postingEnabled) return false;
  cleanupOldPostCounts();
  const today = new Date().toISOString().split("T")[0];
  const postsKey = `${agent.id}_${today}`;
  const postsToday = state.postsToday.get(postsKey) || 0;
  const maxPostsPerDay = agent.maxPostsPerDay || 12;
  if (postsToday >= maxPostsPerDay) return false;
  const backoffUntil = state.rateLimitBackoff.get(agent.id);
  if (backoffUntil && Date.now() < backoffUntil.getTime()) return false;
  if (state.postingLock.get(agent.id)) return false;
  const lastActivity = state.lastPostTime.get(agent.id);
  if (lastActivity) {
    const intervalMs = (agent.postFrequency || 2) * (agent.postInterval === "minutes" ? 60000 : 3600000);
    if (Date.now() - lastActivity.getTime() < intervalMs) return false;
  }
  return true;
}

async function runAgentTicker(agentId: string) {
  const agent = await storage.getAgent(agentId);
  if (!agent || agent.status !== "deployed") return;
  if (canPostNow(agent)) {
    state.postingLock.set(agentId, true);
    try {
      console.log(`[Scheduler] Agent ${agent.name} is posting...`);
      // Simulating posting logic for brevity
      const today = new Date().toISOString().split("T")[0];
      const postsKey = `${agentId}_${today}`;
      state.postsToday.set(postsKey, (state.postsToday.get(postsKey) || 0) + 1);
      state.lastPostTime.set(agentId, new Date());
      resetBackoff(agentId);
    } finally {
      state.postingLock.set(agentId, false);
      saveSchedulerState(agentId);
    }
  }
}

export async function startScheduler() {
  if (state.isRunning) return;
  state.isRunning = true;
  const agents = await storage.getAgents();
  for (const agent of agents) {
    if (agent.status === "deployed") {
      await loadSchedulerState(agent.id);
      const timer = setInterval(() => runAgentTicker(agent.id), 60000);
      state.activeAgents.set(agent.id, timer);
    }
  }
}
