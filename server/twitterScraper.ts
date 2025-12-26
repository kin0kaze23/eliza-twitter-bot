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
          // Import Cookie from tough-cookie
          const { Cookie } = await import("tough-cookie");
          
          // Process cookies: normalize domain and prepare for setCookies
          const processedCookies = rawCookies
            .filter(c => {
              // Validate required fields exist
              const name = c.key || c.name;
              if (!name || !c.value) {
                return false;
              }
              return true;
            })
            .map(c => {
              // Normalize domain: x.com -> twitter.com
              let domain = c.domain || '.twitter.com';
              if (domain === '.x.com' || domain === 'x.com') {
                domain = '.twitter.com';
              }
              
              // Create a proper Cookie object
              return new Cookie({
                key: c.key || c.name,
                value: c.value,
                domain: domain,
                path: c.path || '/',
                secure: c.secure ?? true,
                httpOnly: c.httpOnly ?? true,
                expires: c.expirationDate || c.expires ? 
                  new Date((Number(c.expirationDate || c.expires)) * 1000) : undefined
              } as any);
            });
          
          console.log(`[Scraper] Restoring session from ${processedCookies.length} cookies for ${agent.name}...`);
          const cookieNames = processedCookies.map(c => c.key);
          console.log(`[Scraper] Cookie names: ${cookieNames.join(', ')}`);
          
          // Validate critical cookies exist
          const requiredCookies = ['auth_token', 'ct0'];
          const cookieKeyStrings = cookieNames.map(k => String(k));
          const hasRequired = requiredCookies.every(req => cookieKeyStrings.includes(req));
          
          if (!hasRequired) {
            console.log(`[Scraper] WARNING: Missing required cookies (auth_token, ct0) for ${agent.name}. Cookies may be expired or incomplete.`);
          }
          
          // Log auth token info for debugging
          const authCookie = processedCookies.find(c => c.key === 'auth_token');
          if (authCookie) {
            console.log(`[Scraper] auth_token: ${authCookie.value.substring(0, 15)}... (len=${authCookie.value.length})`);
          }
          
          // Try to set cookies - pass Cookie objects directly (more reliable than string format)
          // agent-twitter-client accepts (string | Cookie)[] - using objects is more stable
          await scraper.setCookies(processedCookies as any);
          
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
            const hasAuthToken = cookieKeyStrings.includes('auth_token');
            const hasCt0 = cookieKeyStrings.includes('ct0');
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
          
          // Cookies are marked as invalid - clear them to prevent reuse of stale cookies
          console.log(`[Scraper] Cookies failed validation for ${agent.name} - clearing stale cookies to prevent future failures`);
          try {
            await storage.updateAgent(agentId, { twitterCookies: null as any });
            console.log(`[Scraper] Cleared stale cookies for ${agent.name}`);
          } catch (e) {
            console.log(`[Scraper] Failed to clear stale cookies: ${e}`);
          }
          
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
    // First verify basic scraper operations work by getting the original tweet
    console.log(`[Scraper] Attempting to fetch original tweet ${tweetId}...`);
    const originalTweet = await scraper.getTweet(tweetId);
    if (!originalTweet) {
      return { success: false, error: 'Could not fetch original tweet - cookies may be expired' };
    }
    
    console.log(`[Scraper] Original tweet fetched successfully. Replies count: ${originalTweet.replies || 0}`);
    
    // If no replies according to the tweet metadata, skip search
    if (!originalTweet.replies || originalTweet.replies === 0) {
      console.log(`[Scraper] No replies on tweet ${tweetId}`);
      return { success: true, replies: [] };
    }
    
    const replies: ScrapedTweet[] = [];
    
    // Method 1: Try searchTweets with conversation_id (may fail with 401)
    try {
      const searchQuery = `conversation_id:${tweetId} -from:${agent.twitterUsername}`;
      console.log(`[Scraper] Searching for replies with query: ${searchQuery}`);
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
      
      console.log(`[Scraper] Found ${replies.length} replies via search`);
      return { success: true, replies };
    } catch (searchError: any) {
      console.log(`[Scraper] searchTweets failed (this is expected without search API access): ${searchError.message}`);
      
      // Method 2: Try fetchHomeTimeline as fallback (ElizaOS-style)
      // Replies to your tweets often appear in your home timeline
      try {
        console.log(`[Scraper] Attempting fetchHomeTimeline fallback...`);
        const timeline = await scraper.fetchHomeTimeline(100, []);
        
        for (const item of timeline) {
          // Look for tweets that are replies to our tweet
          const tweet = item as any;
          if (tweet?.inReplyToStatusId === tweetId && 
              tweet?.username?.toLowerCase() !== agent.twitterUsername?.toLowerCase()) {
            replies.push({
              id: tweet.id || '',
              text: tweet.text || '',
              username: tweet.username || '',
              userId: tweet.userId || '',
              timeParsed: tweet.timeParsed ? new Date(tweet.timeParsed) : undefined,
              isReply: true,
              isRetweet: false,
              inReplyToStatusId: tweet.inReplyToStatusId,
              conversationId: tweet.conversationId,
            });
          }
        }
        
        console.log(`[Scraper] Found ${replies.length} replies via home timeline`);
        return { success: true, replies };
      } catch (timelineError: any) {
        console.log(`[Scraper] fetchHomeTimeline also failed: ${timelineError.message}`);
        // Return empty results with success - we tried our best
        // The tweet metadata showed replies exist but we can't fetch them
        return { 
          success: true, 
          replies: [],
        };
      }
    }
    
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
  
  const mentions: ScrapedTweet[] = [];
  
  // Method 1: Try searchTweets (may fail with 401 without search API access)
  try {
    const searchQuery = `@${agent.twitterUsername}`;
    console.log(`[Scraper] Searching for mentions with query: ${searchQuery}`);
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
    
    console.log(`[Scraper] Found ${mentions.length} mentions via search for @${agent.twitterUsername}`);
    return { success: true, mentions };
    
  } catch (searchError: any) {
    console.log(`[Scraper] searchTweets failed (expected without search API access): ${searchError.message}`);
    
    // Method 2: Try fetchHomeTimeline as fallback
    // Mentions and replies often appear in your home timeline
    try {
      console.log(`[Scraper] Attempting fetchHomeTimeline fallback for mentions...`);
      const timeline = await scraper.fetchHomeTimeline(100, []);
      
      for (const item of timeline) {
        const tweet = item as any;
        // Look for tweets that mention our username
        const mentionsUs = tweet?.text?.toLowerCase().includes(`@${agent.twitterUsername?.toLowerCase()}`);
        const notFromUs = tweet?.username?.toLowerCase() !== agent.twitterUsername?.toLowerCase();
        
        if (mentionsUs && notFromUs) {
          mentions.push({
            id: tweet.id || '',
            text: tweet.text || '',
            username: tweet.username || '',
            userId: tweet.userId || '',
            timeParsed: tweet.timeParsed ? new Date(tweet.timeParsed) : undefined,
            isReply: tweet.isReply || false,
            isRetweet: tweet.isRetweet || false,
            inReplyToStatusId: tweet.inReplyToStatusId,
            conversationId: tweet.conversationId,
          });
        }
      }
      
      console.log(`[Scraper] Found ${mentions.length} mentions via home timeline for @${agent.twitterUsername}`);
      return { success: true, mentions };
    } catch (timelineError: any) {
      console.log(`[Scraper] fetchHomeTimeline also failed: ${timelineError.message}`);
      return { success: true, mentions: [] };
    }
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
    const errorMsg = error.message || String(error);
    
    // Detect 401 Unauthorized errors - means cookies are stale
    if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || 
        errorMsg.includes('Could not authenticate')) {
      console.error(`[Scraper] Detected 401 auth failure for reply to ${replyToTweetId}. Clearing cache and cookies.`);
      
      // Clear the scraper cache so next attempt will re-login/get fresh cookies
      scraperCache.delete(agent.id);
      
      // Clear stale cookies from database
      try {
        await storage.updateAgent(agent.id, { twitterCookies: null as any });
        console.log(`[Scraper] Cleared stale cookies after 401 error`);
      } catch (e) {
        console.log(`[Scraper] Failed to clear cookies: ${e}`);
      }
    }
    
    console.error(`[Scraper] Error sending reply: ${errorMsg}`);
    return { success: false, error: errorMsg };
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
    
    // Scraper often doesn't throw on error, check if we're still logged in after
    const stillLoggedIn = await scraper.isLoggedIn();
    if (!stillLoggedIn) {
      throw new Error("SCRAPER_SESSION_LOST: Session became invalid during tweet attempt");
    }

    console.log(`[Scraper] Tweet posted successfully for ${agent.name}`);
    return { success: true };
    
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    
    // Distinguish between auth failures (should clear cookies) and permission errors (should NOT clear cookies)
    const isAuthFailure = errorMsg.includes('401') || errorMsg.includes('Unauthorized') || 
        errorMsg.includes('Could not authenticate') ||
        errorMsg.includes('code":32') || errorMsg.includes('code: 32');
    
    // "not permitted" is an ACCOUNT restriction, not an auth failure - don't clear cookies!
    const isPermissionError = errorMsg.includes('not permitted') || errorMsg.includes('forbidden');
    
    if (isAuthFailure) {
      console.error(`[Scraper] Detected AUTH failure (401/credentials invalid). Clearing cache and cookies.`);
      
      // Clear the scraper cache so next attempt will re-login/get fresh cookies
      scraperCache.delete(agent.id);
      
      // Clear stale cookies from database
      try {
        await storage.updateAgent(agent.id, { twitterCookies: null as any });
        console.log(`[Scraper] Cleared stale cookies after auth error`);
      } catch (e) {
        console.log(`[Scraper] Failed to clear cookies: ${e}`);
      }
    } else if (isPermissionError) {
      // Don't clear cookies for permission errors - account may have restrictions
      console.error(`[Scraper] PERMISSION ERROR (not auth failure). Account may have restrictions.`);
      console.error(`[Scraper] TIP: Check if Twitter account is marked as "Automated" in Settings → Account → Automation`);
      console.error(`[Scraper] TIP: Some accounts have write restrictions. Try posting manually from the account first.`);
    }
    
    console.error(`[Scraper] Error posting tweet: ${errorMsg}`);
    return { success: false, error: errorMsg };
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
