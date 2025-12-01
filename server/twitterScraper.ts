import { Scraper, SearchMode } from 'agent-twitter-client';
import type { Agent } from '@shared/schema';
import { storage } from './storage';

interface ScraperInstance {
  scraper: Scraper;
  lastLogin: number;
  username: string;
}

const scraperCache = new Map<string, ScraperInstance>();
const LOGIN_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export interface ScrapedTweet {
  id: string;
  text: string;
  username: string;
  userId: string;
  timeParsed?: Date;
  isReply: boolean;
  isRetweet: boolean;
  inReplyToStatusId?: string;
  conversationId?: string;
}

export interface ScraperResult {
  success: boolean;
  error?: string;
}

export interface FetchRepliesResult extends ScraperResult {
  replies?: ScrapedTweet[];
}

export interface FetchMentionsResult extends ScraperResult {
  mentions?: ScrapedTweet[];
}

export interface SendReplyResult extends ScraperResult {
  tweetId?: string;
}

export interface SendTweetResult extends ScraperResult {
  tweetId?: string;
}

async function getOrCreateScraper(agent: Agent): Promise<{ scraper: Scraper; error?: string }> {
  const agentId = agent.id;
  
  // Check if we have valid login credentials
  if (!agent.twitterUsername || !agent.twitterPassword) {
    return {
      scraper: null as any,
      error: 'SCRAPER_CREDENTIALS_MISSING: Twitter username and password are required for comment/mention detection. Add them in the Credentials tab.',
    };
  }
  
  // Check cache
  const cached = scraperCache.get(agentId);
  if (cached && (Date.now() - cached.lastLogin) < LOGIN_CACHE_DURATION) {
    try {
      // Verify still logged in
      const isLoggedIn = await cached.scraper.isLoggedIn();
      if (isLoggedIn) {
        return { scraper: cached.scraper };
      }
    } catch (e) {
      console.log(`[Scraper] Cache check failed for ${agent.name}, will re-login`);
    }
  }
  
  // Create new scraper and login
  const scraper = new Scraper();
  
  try {
    // Try to restore from cached cookies first
    if (agent.twitterCookies) {
      try {
        const cookies = JSON.parse(agent.twitterCookies);
        await scraper.setCookies(cookies);
        
        const isLoggedIn = await scraper.isLoggedIn();
        if (isLoggedIn) {
          console.log(`[Scraper] Restored session from cookies for ${agent.name}`);
          scraperCache.set(agentId, {
            scraper,
            lastLogin: Date.now(),
            username: agent.twitterUsername,
          });
          return { scraper };
        }
      } catch (e) {
        console.log(`[Scraper] Cookie restore failed for ${agent.name}, will login fresh`);
      }
    }
    
    // Fresh login
    console.log(`[Scraper] Logging in as @${agent.twitterUsername}...`);
    await scraper.login(
      agent.twitterUsername,
      agent.twitterPassword,
      agent.twitterEmail || undefined,
      agent.twitter2faSecret || undefined
    );
    
    // Verify login
    const isLoggedIn = await scraper.isLoggedIn();
    if (!isLoggedIn) {
      return {
        scraper: null as any,
        error: 'SCRAPER_LOGIN_FAILED: Could not log in to Twitter. Check username, password, and email are correct.',
      };
    }
    
    // Cache the cookies for next time
    try {
      const cookies = await scraper.getCookies();
      const cookiesJson = JSON.stringify(cookies);
      await storage.updateAgent(agentId, { twitterCookies: cookiesJson });
      console.log(`[Scraper] Cached session cookies for ${agent.name}`);
    } catch (e) {
      console.log(`[Scraper] Failed to cache cookies: ${e}`);
    }
    
    // Cache the scraper instance
    scraperCache.set(agentId, {
      scraper,
      lastLogin: Date.now(),
      username: agent.twitterUsername,
    });
    
    console.log(`[Scraper] Successfully logged in as @${agent.twitterUsername}`);
    return { scraper };
    
  } catch (error: any) {
    const message = error.message || 'Unknown error';
    console.error(`[Scraper] Login failed for ${agent.name}: ${message}`);
    
    // Check for common error types
    if (message.includes('locked') || message.includes('suspended')) {
      return {
        scraper: null as any,
        error: 'TWITTER_ACCOUNT_LOCKED: Your Twitter account may be locked or suspended. Check your account status.',
      };
    }
    
    if (message.includes('2fa') || message.includes('verification')) {
      return {
        scraper: null as any,
        error: 'TWITTER_2FA_REQUIRED: Two-factor authentication is required. Add your 2FA secret in the Credentials tab.',
      };
    }
    
    return {
      scraper: null as any,
      error: `SCRAPER_LOGIN_ERROR: ${message}`,
    };
  }
}

export async function fetchRepliesViaScraper(
  agent: Agent,
  tweetId: string
): Promise<FetchRepliesResult> {
  const { scraper, error } = await getOrCreateScraper(agent);
  if (error) {
    return { success: false, error };
  }
  
  try {
    // Get the original tweet to find the conversation
    const originalTweet = await scraper.getTweet(tweetId);
    if (!originalTweet) {
      return { success: false, error: 'Could not fetch original tweet' };
    }
    
    // Search for replies to this tweet
    // We search for tweets replying to this specific tweet ID
    const searchQuery = `conversation_id:${tweetId} -from:${agent.twitterUsername}`;
    const replies: ScrapedTweet[] = [];
    
    // Use searchTweets to find replies in the conversation
    const searchResults = scraper.searchTweets(searchQuery, 50, SearchMode.Latest);
    
    for await (const tweet of searchResults) {
      // Only include direct replies (not the original tweet)
      if (tweet.id !== tweetId && tweet.inReplyToStatusId === tweetId) {
        replies.push({
          id: tweet.id || '',
          text: tweet.text || '',
          username: tweet.username || '',
          userId: tweet.userId || '',
          timeParsed: tweet.timeParsed,
          isReply: tweet.isReply || false,
          isRetweet: tweet.isRetweet || false,
          inReplyToStatusId: tweet.inReplyToStatusId,
          conversationId: tweet.conversationId,
        });
      }
    }
    
    console.log(`[Scraper] Found ${replies.length} replies to tweet ${tweetId}`);
    return { success: true, replies };
    
  } catch (error: any) {
    console.error(`[Scraper] Error fetching replies: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function fetchMentionsViaScraper(
  agent: Agent,
  limit: number = 20
): Promise<FetchMentionsResult> {
  const { scraper, error } = await getOrCreateScraper(agent);
  if (error) {
    return { success: false, error };
  }
  
  try {
    // Search for mentions of the bot's username
    const searchQuery = `@${agent.twitterUsername}`;
    const mentions: ScrapedTweet[] = [];
    
    const searchResults = scraper.searchTweets(searchQuery, limit, SearchMode.Latest);
    
    for await (const tweet of searchResults) {
      // Skip tweets from the bot itself
      if (tweet.username?.toLowerCase() === agent.twitterUsername?.toLowerCase()) {
        continue;
      }
      
      mentions.push({
        id: tweet.id || '',
        text: tweet.text || '',
        username: tweet.username || '',
        userId: tweet.userId || '',
        timeParsed: tweet.timeParsed,
        isReply: tweet.isReply || false,
        isRetweet: tweet.isRetweet || false,
        inReplyToStatusId: tweet.inReplyToStatusId,
        conversationId: tweet.conversationId,
      });
    }
    
    console.log(`[Scraper] Found ${mentions.length} mentions for @${agent.twitterUsername}`);
    return { success: true, mentions };
    
  } catch (error: any) {
    console.error(`[Scraper] Error fetching mentions: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function sendReplyViaScraper(
  agent: Agent,
  replyText: string,
  replyToTweetId: string
): Promise<SendReplyResult> {
  const { scraper, error } = await getOrCreateScraper(agent);
  if (error) {
    return { success: false, error };
  }
  
  try {
    // Send the reply
    const response = await scraper.sendTweet(replyText, replyToTweetId);
    
    // The sendTweet may not return a proper ID, just log success
    console.log(`[Scraper] Reply sent to tweet ${replyToTweetId}`);
    return { success: true };
    
  } catch (error: any) {
    console.error(`[Scraper] Error sending reply: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function sendTweetViaScraper(
  agent: Agent,
  tweetText: string
): Promise<SendTweetResult> {
  const { scraper, error } = await getOrCreateScraper(agent);
  if (error) {
    return { success: false, error };
  }
  
  try {
    // Send the tweet (no replyToTweetId means it's a new tweet)
    const response = await scraper.sendTweet(tweetText);
    
    console.log(`[Scraper] Tweet posted successfully for ${agent.name}`);
    return { success: true };
    
  } catch (error: any) {
    console.error(`[Scraper] Error posting tweet: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function verifyScraperCredentials(agent: Agent): Promise<ScraperResult> {
  const { scraper, error } = await getOrCreateScraper(agent);
  if (error) {
    return { success: false, error };
  }
  
  try {
    const isLoggedIn = await scraper.isLoggedIn();
    if (isLoggedIn) {
      return { success: true };
    } else {
      return { success: false, error: 'Not logged in' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function clearScraperCache(agentId: string): void {
  scraperCache.delete(agentId);
  console.log(`[Scraper] Cleared cache for agent ${agentId}`);
}
