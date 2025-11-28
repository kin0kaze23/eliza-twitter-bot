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
