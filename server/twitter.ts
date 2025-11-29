import OAuth from "oauth-1.0a";
import crypto from "crypto";
import type { Agent } from "@shared/schema";

export interface TwitterPostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  errorCode?: string;
  rateLimited?: boolean;
  hint?: string;
}

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

function createOAuthClient(agent: Agent): OAuth {
  return new OAuth({
    consumer: {
      key: agent.twitterApiKey!,
      secret: agent.twitterApiSecret!,
    },
    signature_method: "HMAC-SHA1",
    hash_function(base_string: string, key: string) {
      return crypto.createHmac("sha1", key).update(base_string).digest("base64");
    },
  });
}

function getToken(agent: Agent) {
  return {
    key: agent.twitterAccessToken!,
    secret: agent.twitterAccessSecret!,
  };
}

export function validateTwitterCredentials(agent: Agent): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!agent.twitterApiKey) missing.push("API Key");
  if (!agent.twitterApiSecret) missing.push("API Secret");
  if (!agent.twitterAccessToken) missing.push("Access Token");
  if (!agent.twitterAccessSecret) missing.push("Access Token Secret");
  return { valid: missing.length === 0, missing };
}

export async function postTweet(agent: Agent, content: string): Promise<TwitterPostResult> {
  const validation = validateTwitterCredentials(agent);
  if (!validation.valid) {
    return {
      success: false,
      error: `Missing Twitter credentials: ${validation.missing.join(", ")}`,
    };
  }

  const oauth = createOAuthClient(agent);
  const token = getToken(agent);

  const requestData = {
    url: "https://api.twitter.com/2/tweets",
    method: "POST",
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  try {
    const response = await fetch(requestData.url, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: content }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded",
          errorCode: "RATE_LIMIT",
          rateLimited: true,
        };
      }

      if (response.status === 403) {
        // Parse Twitter's specific error format
        const errorDetail = errorData.detail || 
                           errorData.errors?.[0]?.message ||
                           errorData.title ||
                           "Forbidden";
        
        // Check for common 403 error patterns
        let userFriendlyError = errorDetail;
        let hint = "";
        
        if (errorDetail.includes("not permitted") || errorDetail.includes("permission")) {
          userFriendlyError = "You are not permitted to perform this action";
          hint = "Your Twitter app may not have write permissions. Go to Twitter Developer Portal → Your App → Settings → App permissions → Enable 'Read and Write'. Then regenerate your Access Token and Secret.";
        } else if (errorDetail.includes("suspended") || errorDetail.includes("locked")) {
          userFriendlyError = "Twitter account is suspended or locked";
          hint = "Check your Twitter account status at twitter.com";
        } else if (errorDetail.includes("duplicate")) {
          userFriendlyError = "Duplicate tweet detected";
          hint = "Twitter doesn't allow posting the exact same content twice. The system will try a different post next time.";
        }
        
        console.error(`[Twitter] 403 Error: ${errorDetail}${hint ? ` | Hint: ${hint}` : ""}`);
        
        return {
          success: false,
          error: hint ? `${userFriendlyError} - ${hint}` : userFriendlyError,
          errorCode: "FORBIDDEN",
          hint: hint || undefined,
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          error: "Authentication failed - check Twitter credentials",
          errorCode: "AUTH_FAILED",
        };
      }

      return {
        success: false,
        error: errorData.detail || errorData.title || `HTTP ${response.status}`,
        errorCode: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      tweetId: data.data?.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
      errorCode: "NETWORK_ERROR",
    };
  }
}

export async function replyToTweet(
  agent: Agent,
  content: string,
  inReplyToTweetId: string
): Promise<TwitterPostResult> {
  const validation = validateTwitterCredentials(agent);
  if (!validation.valid) {
    return {
      success: false,
      error: `Missing Twitter credentials: ${validation.missing.join(", ")}`,
    };
  }

  const oauth = createOAuthClient(agent);
  const token = getToken(agent);

  const requestData = {
    url: "https://api.twitter.com/2/tweets",
    method: "POST",
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  try {
    const response = await fetch(requestData.url, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: content,
        reply: {
          in_reply_to_tweet_id: inReplyToTweetId,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded",
          errorCode: "RATE_LIMIT",
          rateLimited: true,
        };
      }

      return {
        success: false,
        error: errorData.detail || errorData.title || `HTTP ${response.status}`,
        errorCode: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      tweetId: data.data?.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
      errorCode: "NETWORK_ERROR",
    };
  }
}

export interface TwitterMention {
  id: string;
  text: string;
  authorId: string;
  authorUsername?: string;
  authorName?: string;
  createdAt?: string;
  conversationId?: string;
  inReplyToUserId?: string;
  referencedTweetId?: string;
}

export interface FetchMentionsResult {
  success: boolean;
  mentions?: TwitterMention[];
  newestId?: string;
  error?: string;
}

/**
 * Fetch mentions for the bot's Twitter account
 * Uses Twitter API v2 GET /2/users/:id/mentions
 */
export async function fetchMentions(
  agent: Agent,
  sinceId?: string,
  maxResults: number = 10
): Promise<FetchMentionsResult> {
  const validation = validateTwitterCredentials(agent);
  if (!validation.valid) {
    return {
      success: false,
      error: `Missing Twitter credentials: ${validation.missing.join(", ")}`,
    };
  }

  // First, get the bot's user ID if we don't have it cached
  const userResult = await verifyCredentials(agent);
  if (!userResult.success || !userResult.user) {
    return {
      success: false,
      error: userResult.error || "Failed to get user info",
    };
  }

  const userId = userResult.user.id;
  const oauth = createOAuthClient(agent);
  const token = getToken(agent);

  // Build the mentions URL with query params
  const params = new URLSearchParams({
    max_results: Math.min(maxResults, 100).toString(),
    "tweet.fields": "created_at,author_id,conversation_id,in_reply_to_user_id,referenced_tweets",
    "expansions": "author_id,referenced_tweets.id",
    "user.fields": "username,name",
  });
  
  if (sinceId) {
    params.set("since_id", sinceId);
  }

  const url = `https://api.twitter.com/2/users/${userId}/mentions?${params.toString()}`;
  
  const requestData = {
    url,
    method: "GET",
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded",
        };
      }

      return {
        success: false,
        error: errorData.detail || errorData.title || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Parse the response
    const mentions: TwitterMention[] = [];
    const usersMap = new Map<string, { username: string; name: string }>();
    
    // Build users lookup map from includes
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        usersMap.set(user.id, { username: user.username, name: user.name });
      }
    }
    
    // Process tweets
    if (data.data) {
      for (const tweet of data.data) {
        const author = usersMap.get(tweet.author_id);
        const referencedTweet = tweet.referenced_tweets?.find((rt: any) => rt.type === "replied_to");
        
        mentions.push({
          id: tweet.id,
          text: tweet.text,
          authorId: tweet.author_id,
          authorUsername: author?.username,
          authorName: author?.name,
          createdAt: tweet.created_at,
          conversationId: tweet.conversation_id,
          inReplyToUserId: tweet.in_reply_to_user_id,
          referencedTweetId: referencedTweet?.id,
        });
      }
    }
    
    // Get the newest ID for pagination
    const newestId = data.meta?.newest_id;
    
    return {
      success: true,
      mentions,
      newestId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Fetch replies to a specific tweet (comments on the bot's tweets)
 * Uses Twitter API v2 Recent Search with conversation_id
 */
export async function fetchRepliesToTweet(
  agent: Agent,
  tweetId: string,
  sinceId?: string,
  maxResults: number = 10
): Promise<FetchMentionsResult> {
  const validation = validateTwitterCredentials(agent);
  if (!validation.valid) {
    return {
      success: false,
      error: `Missing Twitter credentials: ${validation.missing.join(", ")}`,
    };
  }

  // Get the bot's user ID to exclude self-replies
  const userResult = await verifyCredentials(agent);
  if (!userResult.success || !userResult.user) {
    return {
      success: false,
      error: userResult.error || "Failed to get user info",
    };
  }

  const botUserId = userResult.user.id;
  const oauth = createOAuthClient(agent);
  const token = getToken(agent);

  // Build the search query - get replies in this conversation, excluding the bot's own tweets
  const query = `conversation_id:${tweetId} is:reply -from:${userResult.user.username}`;
  
  const params = new URLSearchParams({
    query,
    max_results: Math.min(maxResults, 100).toString(),
    "tweet.fields": "created_at,author_id,conversation_id,in_reply_to_user_id,referenced_tweets",
    "expansions": "author_id",
    "user.fields": "username,name",
  });
  
  if (sinceId) {
    params.set("since_id", sinceId);
  }

  const url = `https://api.twitter.com/2/tweets/search/recent?${params.toString()}`;
  
  const requestData = {
    url,
    method: "GET",
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded",
        };
      }

      return {
        success: false,
        error: errorData.detail || errorData.title || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Parse the response (same format as mentions)
    const mentions: TwitterMention[] = [];
    const usersMap = new Map<string, { username: string; name: string }>();
    
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        usersMap.set(user.id, { username: user.username, name: user.name });
      }
    }
    
    if (data.data) {
      for (const tweet of data.data) {
        // Skip the bot's own replies
        if (tweet.author_id === botUserId) continue;
        
        const author = usersMap.get(tweet.author_id);
        const referencedTweet = tweet.referenced_tweets?.find((rt: any) => rt.type === "replied_to");
        
        mentions.push({
          id: tweet.id,
          text: tweet.text,
          authorId: tweet.author_id,
          authorUsername: author?.username,
          authorName: author?.name,
          createdAt: tweet.created_at,
          conversationId: tweet.conversation_id,
          inReplyToUserId: tweet.in_reply_to_user_id,
          referencedTweetId: referencedTweet?.id,
        });
      }
    }
    
    const newestId = data.meta?.newest_id;
    
    return {
      success: true,
      mentions,
      newestId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
    };
  }
}

export async function verifyCredentials(agent: Agent): Promise<{ success: boolean; user?: TwitterUser; error?: string }> {
  const validation = validateTwitterCredentials(agent);
  if (!validation.valid) {
    return {
      success: false,
      error: `Missing: ${validation.missing.join(", ")}`,
    };
  }

  const oauth = createOAuthClient(agent);
  const token = getToken(agent);

  const requestData = {
    url: "https://api.twitter.com/1.1/account/verify_credentials.json",
    method: "GET",
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  try {
    const response = await fetch(requestData.url, {
      method: "GET",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const userData = await response.json();
    
    return {
      success: true,
      user: {
        id: userData.id_str,
        name: userData.name,
        username: userData.screen_name,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
    };
  }
}
