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

// Login guard to prevent concurrent login attempts for the same agent
const loginInProgress = new Map<string, Promise<{ scraper: Scraper; error?: string }>>();

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
  
  // Check cache first (fast path)
  const cached = scraperCache.get(agentId);
  if (cached && (Date.now() - cached.lastLogin) < LOGIN_CACHE_DURATION) {
    try {
      const isLoggedIn = await cached.scraper.isLoggedIn();
      if (isLoggedIn) {
        return { scraper: cached.scraper };
      }
    } catch (e) {
      console.log(`[Scraper] Cache check failed for ${agent.name}, will re-login`);
    }
  }
  
  // Check if login is already in progress for this agent (prevent duplicate concurrent logins)
  const existingLoginPromise = loginInProgress.get(agentId);
  if (existingLoginPromise) {
    console.log(`[Scraper] Login already in progress for ${agent.name}, waiting...`);
    return existingLoginPromise;
  }
  
  // Start new login and store the promise
  const loginPromise = performScraperLogin(agent, !!hasCookies, !!hasLoginCredentials);
  loginInProgress.set(agentId, loginPromise);
  
  try {
    const result = await loginPromise;
    return result;
  } finally {
    // Always clean up the login guard when done
    loginInProgress.delete(agentId);
  }
}

// Internal function that performs the actual login
async function performScraperLogin(
  agent: Agent,
  hasCookies: boolean,
  hasLoginCredentials: boolean
): Promise<{ scraper: Scraper; error?: string }> {
  const agentId = agent.id;
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
                // Use raw value - don't URI-encode as it corrupts auth tokens
                const value = c.value;
                // Normalize x.com domain to twitter.com - the agent-twitter-client library
                // makes requests to twitter.com internally, so x.com cookies won't match
                let domain = c.domain || '.twitter.com';
                if (domain === '.x.com' || domain === 'x.com') {
                  domain = '.twitter.com';
                }
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
                
                // Debug: log first few chars of important cookies
                if (name === 'auth_token' || name === 'ct0') {
                  console.log(`[Scraper] Cookie ${name}: ${value.substring(0, 10)}... (len=${value.length})`);
                }
                
                return cookieStr;
              });
          }
          
          console.log(`[Scraper] Restoring session from ${cookies.length} cookies for ${agent.name}...`);
          // Debug: log cookie names being restored
          const cookieNames = cookies.map(c => typeof c === 'string' ? c.split('=')[0] : 'invalid');
          console.log(`[Scraper] Cookie names: ${cookieNames.join(', ')}`);
          
          // Validate that we have enough cookies - the scraper needs more than just auth_token and ct0
          const requiredCookies = ['auth_token', 'ct0'];
          const recommendedCookies = ['kdt', 'twid', 'lang', 'guest_id'];
          const hasRequired = requiredCookies.every(req => cookieNames.includes(req));
          const hasRecommended = recommendedCookies.filter(rec => cookieNames.includes(rec));
          
          if (!hasRequired) {
            console.log(`[Scraper] WARNING: Missing required cookies (auth_token, ct0) for ${agent.name}`);
          } else if (hasRecommended.length < 2) {
            console.log(`[Scraper] WARNING: Only ${cookies.length} cookies provided for ${agent.name}. For best results, export ALL cookies from your browser, not just auth_token and ct0. The scraper needs additional cookies (kdt, twid, lang, guest_id, etc.) to work reliably.`);
          }
          
          await scraper.setCookies(cookies);
          
          // Try multiple methods to verify cookies are valid
          let isLoggedIn = false;
          let verificationMethod = '';
          
          // Method 1: Try isLoggedIn() first
          try {
            isLoggedIn = await scraper.isLoggedIn();
            if (isLoggedIn) {
              verificationMethod = 'isLoggedIn';
            }
          } catch (e: any) {
            console.log(`[Scraper] isLoggedIn() check failed for ${agent.name}: ${e.message}`);
          }
          
          // Method 2: If isLoggedIn fails, try me() to verify session
          if (!isLoggedIn) {
            try {
              const me = await scraper.me();
              if (me?.username || (me as any)?.screen_name) {
                isLoggedIn = true;
                verificationMethod = 'me()';
              }
            } catch (e: any) {
              console.log(`[Scraper] me() check failed for ${agent.name}: ${e.message}`);
            }
          }
          
          // Method 3: Check if required cookies exist structurally
          // Trust the cookie structure if we have auth_token and ct0 - Twitter often blocks
          // API verification calls (isLoggedIn, me) but the cookies still work for scraping
          if (!isLoggedIn) {
            const hasAuthToken = cookieNames.includes('auth_token');
            const hasCt0 = cookieNames.includes('ct0');
            if (hasAuthToken && hasCt0) {
              console.log(`[Scraper] Required cookies present (auth_token, ct0) for ${agent.name}, trusting cookie structure`);
              console.log(`[Scraper] Note: API verification failed but cookies may still work for scraping operations`);
              isLoggedIn = true;
              verificationMethod = 'cookie-structure';
            }
          }
          
          console.log(`[Scraper] Session validation for ${agent.name}: ${isLoggedIn ? 'VALID' : 'INVALID'} (method: ${verificationMethod || 'none'})`);
          
          if (isLoggedIn) {
            console.log(`[Scraper] Session restored from cookies for ${agent.name}`);
            scraperCache.set(agentId, {
              scraper,
              lastLogin: Date.now(),
              username: agent.twitterUsername || 'cookie-session',
            });
            return { scraper };
          }
          
          // Cookies don't have required fields - need fresh login
          console.log(`[Scraper] Cookies missing required fields (auth_token, ct0) for ${agent.name}`);
          
          // If no login credentials available, we can't proceed
          if (!hasLoginCredentials) {
            console.log(`[Scraper] No login credentials available for ${agent.name}`);
          }
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
        error: 'SCRAPER_LOGIN_BLOCKED: Twitter is blocking automated logins. Use "Import Session Cookies" instead - export cookies from your browser while logged into Twitter.',
      };
    }
    
    if (lastError.includes('ArkoseLogin') || lastError.includes('challenge')) {
      return {
        scraper: null as any,
        error: 'SCRAPER_CAPTCHA_REQUIRED: Twitter requires CAPTCHA verification. Use "Import Session Cookies" instead - log into Twitter in your browser and export the cookies.',
      };
    }
    
    if (lastError.includes('Unauthorized') || lastError.includes('401')) {
      return {
        scraper: null as any,
        error: 'SCRAPER_AUTH_FAILED: Username or password is incorrect. Check your credentials or use "Import Session Cookies" for more reliable authentication.',
      };
    }
    
    if (lastError.includes('suspended') || lastError.includes('locked')) {
      return {
        scraper: null as any,
        error: 'SCRAPER_ACCOUNT_ISSUE: Your Twitter account may be suspended or locked. Check your account status at twitter.com.',
      };
    }
    
    return {
      scraper: null as any,
      error: `SCRAPER_LOGIN_FAILED: Login failed after ${maxRetries} attempts. Use "Import Session Cookies" for more reliable authentication. Details: ${lastError}`,
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
    // Debug: Check if we're properly authenticated before sending
    const isLoggedIn = await scraper.isLoggedIn();
    console.log(`[Scraper] Pre-tweet auth check for ${agent.name}: isLoggedIn=${isLoggedIn}`);
    
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
          // Use raw value - don't URI-encode as it corrupts auth tokens
          const value = c.value;
          // Normalize x.com domain to twitter.com - the agent-twitter-client library
          // makes requests to twitter.com internally, so x.com cookies won't match
          let domain = c.domain || '.twitter.com';
          if (domain === '.x.com' || domain === 'x.com') {
            domain = '.twitter.com';
          }
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
    
    // Try multiple methods to verify cookies are valid
    // isLoggedIn() can return false even with valid cookies due to rate limiting
    let isLoggedIn = false;
    let resolvedUsername = providedUsername;
    let verificationMethod = '';
    
    // Method 1: Try isLoggedIn() first (quickest check)
    try {
      isLoggedIn = await scraper.isLoggedIn();
      if (isLoggedIn) {
        verificationMethod = 'isLoggedIn';
        console.log(`[Scraper] Cookie validation: isLoggedIn() returned true`);
      }
    } catch (e: any) {
      console.log(`[Scraper] Cookie validation: isLoggedIn() threw error: ${e.message}`);
    }
    
    // Method 2: If isLoggedIn fails, try to get user profile (more reliable with valid cookies)
    if (!isLoggedIn && !resolvedUsername) {
      try {
        const me = await scraper.me();
        const detectedHandle = me?.username || (me as any)?.screen_name || (me as any)?.screenName;
        if (detectedHandle) {
          resolvedUsername = detectedHandle;
          isLoggedIn = true; // If we can fetch profile, session is valid
          verificationMethod = 'me()';
          console.log(`[Scraper] Cookie validation: me() returned profile for @${resolvedUsername}`);
        }
      } catch (e: any) {
        console.log(`[Scraper] Cookie validation: me() threw error: ${e.message}`);
      }
    }
    
    // Method 3: Check if required cookies exist (auth_token and ct0 are essential)
    if (!isLoggedIn) {
      const cookieNames = cookieArray.map(c => c.split('=')[0]);
      const hasAuthToken = cookieNames.includes('auth_token');
      const hasCt0 = cookieNames.includes('ct0');
      
      if (hasAuthToken && hasCt0) {
        // Cookies appear valid structurally - may work even if isLoggedIn fails
        console.log(`[Scraper] Cookie validation: Required cookies present (auth_token, ct0), assuming valid`);
        verificationMethod = 'cookie-structure';
        isLoggedIn = true;
      }
    }
    
    if (isLoggedIn) {
      // Try to detect username if not already resolved
      if (!resolvedUsername) {
        try {
          const me = await scraper.me();
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
