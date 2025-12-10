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
  
  // Check if we have any form of authentication (cookies OR login credentials)
  const hasCookies = agent.twitterCookies && agent.twitterCookies.trim() !== '';
  const hasLoginCredentials = agent.twitterUsername && agent.twitterPassword;
  
  if (!hasCookies && !hasLoginCredentials) {
    return {
      scraper: null as any,
      error: 'SCRAPER_CREDENTIALS_MISSING: Session cookies or Twitter login credentials required. Import cookies (recommended) or add username/password in the Credentials tab.',
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
    // Try to restore from session cookies first (most reliable method)
    if (hasCookies) {
      try {
        const rawCookies = JSON.parse(agent.twitterCookies!);
        if (Array.isArray(rawCookies) && rawCookies.length > 0) {
          // Check if cookies are already in string format (from scraper.getCookies())
          const firstCookie = rawCookies[0];
          let cookies: string[];
          
          if (typeof firstCookie === 'string') {
            // Already in string format (from getCookies() after login)
            cookies = rawCookies;
          } else {
            // Convert browser's EditThisCookie format to cookie strings
            // Format: "name=value; Domain=.twitter.com; Path=/; Secure; HttpOnly"
            cookies = rawCookies
              .filter(c => {
                // Validate required fields exist
                const name = c.key || c.name;
                if (!name || !c.value) {
                  console.log(`[Scraper] Skipping invalid cookie (missing name or value)`);
                  return false;
                }
                return true;
              })
              .map(c => {
                const name = c.key || c.name;
                // URI-encode value to handle special characters
                const value = encodeURIComponent(c.value);
                const domain = c.domain || '.twitter.com';
                const path = c.path || '/'; // Use provided path or default to '/'
                
                let cookieStr = `${name}=${value}; Domain=${domain}; Path=${path}`;
                
                if (c.secure === true) cookieStr += '; Secure';
                if (c.httpOnly === true) cookieStr += '; HttpOnly';
                if (c.sameSite) cookieStr += `; SameSite=${c.sameSite}`;
                
                // Handle expiration - support multiple formats
                if (c.expirationDate && typeof c.expirationDate === 'number') {
                  const expires = new Date(c.expirationDate * 1000).toUTCString();
                  cookieStr += `; Expires=${expires}`;
                } else if (c.expires) {
                  if (typeof c.expires === 'number') {
                    const expires = new Date(c.expires * 1000).toUTCString();
                    cookieStr += `; Expires=${expires}`;
                  } else if (typeof c.expires === 'string') {
                    // Already an ISO/date string, convert to UTC format
                    const expires = new Date(c.expires).toUTCString();
                    if (expires !== 'Invalid Date') {
                      cookieStr += `; Expires=${expires}`;
                    }
                  }
                }
                
                return cookieStr;
              });
          }
          
          console.log(`[Scraper] Restoring session from ${cookies.length} cookies for ${agent.name}...`);
          // Debug: log cookie names being restored
          const cookieNames = cookies.map(c => typeof c === 'string' ? c.split('=')[0] : 'invalid');
          console.log(`[Scraper] Cookie names: ${cookieNames.join(', ')}`);
          
          await scraper.setCookies(cookies);
          
          const isLoggedIn = await scraper.isLoggedIn();
          console.log(`[Scraper] isLoggedIn check for ${agent.name}: ${isLoggedIn}`);
          
          if (isLoggedIn) {
            console.log(`[Scraper] Session restored from cookies for ${agent.name}`);
            scraperCache.set(agentId, {
              scraper,
              lastLogin: Date.now(),
              username: agent.twitterUsername || 'cookie-session',
            });
            return { scraper };
          }
          console.log(`[Scraper] Cookies may be expired or invalid for ${agent.name}, will try login if credentials available`);
        }
      } catch (e: any) {
        console.log(`[Scraper] Cookie restore failed for ${agent.name}: ${e.message}`);
      }
    }
    
    // Fall back to username/password login (may be blocked by Twitter)
    if (!hasLoginCredentials) {
      return {
        scraper: null as any,
        error: 'Session cookies expired and no login credentials available. Please import fresh cookies from your browser.',
      };
    }
    
    const maxRetries = 3;
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[Scraper] Retry ${attempt}/${maxRetries} for ${agent.name} after ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        console.log(`[Scraper] Login attempt ${attempt} for @${agent.twitterUsername}...`);
        await scraper.login(
          agent.twitterUsername!,
          agent.twitterPassword!,
          agent.twitterEmail || undefined,
          agent.twitter2faSecret || undefined
        );
        
        // Verify login succeeded
        const isLoggedIn = await scraper.isLoggedIn();
        if (isLoggedIn) {
          console.log(`[Scraper] Login successful for @${agent.twitterUsername}`);
          
          // Cache cookies for future use
          try {
            const cookies = await scraper.getCookies();
            const cookiesJson = JSON.stringify(cookies);
            await storage.updateAgent(agentId, { twitterCookies: cookiesJson });
            console.log(`[Scraper] Session cookies cached for ${agent.name}`);
          } catch (e) {
            console.log(`[Scraper] Failed to cache cookies: ${e}`);
          }
          
          scraperCache.set(agentId, {
            scraper,
            lastLogin: Date.now(),
            username: agent.twitterUsername!,
          });
          
          return { scraper };
        }
        
        lastError = 'Login completed but session verification failed';
      } catch (e: any) {
        lastError = e.message || String(e);
        console.log(`[Scraper] Attempt ${attempt} failed: ${lastError}`);
      }
    }
    
    // All retries failed - provide helpful error message
    console.error(`[Scraper] All login attempts failed for ${agent.name}: ${lastError}`);
    
    if (lastError.includes('page does not exist') || lastError.includes('code":34')) {
      return {
        scraper: null as any,
        error: 'Login blocked by Twitter. Please: 1) Mark your account as "Automated" in Twitter Settings, 2) Log out of Twitter in all browsers, 3) Try again.',
      };
    }
    
    if (lastError.includes('ArkoseLogin') || lastError.includes('challenge')) {
      return {
        scraper: null as any,
        error: 'Twitter requires CAPTCHA verification. Log into Twitter manually in a browser first, then try again.',
      };
    }
    
    return {
      scraper: null as any,
      error: `Login failed after ${maxRetries} attempts: ${lastError}`,
    };
  } catch (error: any) {
    const message = error.message || String(error) || 'Unknown error';
    console.error(`[Scraper] Unexpected error for ${agent.name}: ${message}`);
    return {
      scraper: null as any,
      error: `Unexpected error: ${message}`,
    };
  }
}

export async function fetchRepliesViaScraper(
  agent: Agent,
  tweetId: string
): Promise<FetchRepliesResult> {
  // Guard: username is required for filtering own tweets from search results
  if (!agent.twitterUsername) {
    return { 
      success: false, 
      error: 'MISSING_USERNAME: Twitter username is required for reply detection. Add it in the Credentials tab.' 
    };
  }
  
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
  // Guard: username is required for mention detection
  if (!agent.twitterUsername) {
    return { 
      success: false, 
      error: 'MISSING_USERNAME: Twitter username is required for mention detection. Add it in the Credentials tab.' 
    };
  }
  
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

export async function verifyScraperCredentials(agent: Agent, forceRefresh: boolean = false): Promise<ScraperResult> {
  // Clear cache if force refresh is requested (for testing new credentials)
  if (forceRefresh && agent.id) {
    scraperCache.delete(agent.id);
    console.log(`[Scraper] Force refresh: cleared cache for ${agent.name || agent.id}`);
  }
  
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

// Validate session using cookies only (no login attempt)
export async function validateSessionCookies(cookies: string, providedUsername?: string): Promise<{ success: boolean; error?: string; username?: string; usernameRequired?: boolean }> {
  if (!cookies || cookies.trim() === '') {
    return { success: false, error: 'No cookies provided' };
  }
  
  try {
    const rawCookies = JSON.parse(cookies);
    if (!Array.isArray(rawCookies) || rawCookies.length === 0) {
      return { success: false, error: 'Invalid cookie format - expected JSON array' };
    }
    
    // Check if cookies are already in string format (from scraper.getCookies())
    const firstCookie = rawCookies[0];
    let cookieArray: string[];
    
    if (typeof firstCookie === 'string') {
      // Already in string format (from getCookies() after login)
      cookieArray = rawCookies;
    } else {
      // Convert browser's EditThisCookie format to cookie strings
      // Format: "name=value; Domain=.twitter.com; Path=/; Secure; HttpOnly"
      cookieArray = rawCookies
        .filter(c => {
          // Validate required fields exist
          const name = c.key || c.name;
          if (!name || !c.value) {
            console.log(`[Scraper] Skipping invalid cookie (missing name or value)`);
            return false;
          }
          return true;
        })
        .map(c => {
          const name = c.key || c.name;
          // URI-encode value to handle special characters
          const value = encodeURIComponent(c.value);
          const domain = c.domain || '.twitter.com';
          const path = c.path || '/'; // Use provided path or default to '/'
          
          let cookieStr = `${name}=${value}; Domain=${domain}; Path=${path}`;
          
          if (c.secure === true) cookieStr += '; Secure';
          if (c.httpOnly === true) cookieStr += '; HttpOnly';
          if (c.sameSite) cookieStr += `; SameSite=${c.sameSite}`;
          
          // Handle expiration - support multiple formats
          if (c.expirationDate && typeof c.expirationDate === 'number') {
            const expires = new Date(c.expirationDate * 1000).toUTCString();
            cookieStr += `; Expires=${expires}`;
          } else if (c.expires) {
            if (typeof c.expires === 'number') {
              const expires = new Date(c.expires * 1000).toUTCString();
              cookieStr += `; Expires=${expires}`;
            } else if (typeof c.expires === 'string') {
              // Already an ISO/date string, convert to UTC format
              const expires = new Date(c.expires).toUTCString();
              if (expires !== 'Invalid Date') {
                cookieStr += `; Expires=${expires}`;
              }
            }
          }
          
          return cookieStr;
        });
    }
    
    const scraper = new Scraper();
    await scraper.setCookies(cookieArray);
    
    const isLoggedIn = await scraper.isLoggedIn();
    if (isLoggedIn) {
      // Use provided username or try to detect it from the session
      let resolvedUsername = providedUsername;
      
      // If no username provided, try to detect from session via scraper.me()
      if (!resolvedUsername) {
        try {
          // scraper.me() returns user info for the authenticated account
          const me = await scraper.me();
          // Profile may have username OR screen_name depending on the scraper version
          const detectedHandle = me?.username || (me as any)?.screen_name || (me as any)?.screenName;
          if (detectedHandle) {
            resolvedUsername = detectedHandle;
            console.log(`[Scraper] Detected username from session: @${resolvedUsername}`);
          } else {
            console.log(`[Scraper] scraper.me() returned profile but no username found:`, JSON.stringify(me).substring(0, 200));
          }
        } catch (e: any) {
          console.log(`[Scraper] Could not detect username from session: ${e.message || e}`);
        }
      }
      
      // Username is required for mention/reply detection
      if (!resolvedUsername) {
        return { 
          success: true,
          usernameRequired: true,
          error: 'Session valid but username could not be detected. Please enter your Twitter username above for mention detection to work.'
        };
      }
      
      return { 
        success: true,
        username: resolvedUsername
      };
    } else {
      return { success: false, error: 'Cookies expired or invalid - please export fresh cookies from browser' };
    }
  } catch (error: any) {
    if (error.message?.includes('JSON')) {
      return { success: false, error: 'Invalid JSON format - paste the raw cookie JSON array' };
    }
    return { success: false, error: error.message };
  }
}

export function clearScraperCache(agentId: string): void {
  scraperCache.delete(agentId);
  console.log(`[Scraper] Cleared cache for agent ${agentId}`);
}
