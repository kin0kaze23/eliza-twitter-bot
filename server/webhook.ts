import crypto from "crypto";
import type { Agent } from "@shared/schema";

export type WebhookEventType = 
  | "post_created"
  | "post_failed" 
  | "reply_created"
  | "reply_failed"
  | "error"
  | "agent_started"
  | "agent_stopped"
  | "rate_limit_warning";

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  agentId: string;
  agentName: string;
  data: Record<string, unknown>;
}

interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  responseTime?: number;
}

function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

export async function sendWebhook(
  agent: Agent,
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<WebhookResult> {
  if (!agent.webhookEnabled || !agent.webhookUrl) {
    return { success: false, error: "Webhook not enabled or URL not configured" };
  }

  const allowedEvents = agent.webhookEvents || ["post_created", "post_failed", "error"];
  if (!allowedEvents.includes(event)) {
    return { success: false, error: `Event ${event} not enabled for this webhook` };
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    agentId: agent.id,
    agentName: agent.name,
    data,
  };

  const payloadString = JSON.stringify(payload);
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": event,
      "X-Webhook-Timestamp": payload.timestamp,
      "X-Agent-Id": agent.id,
    };

    if (agent.webhookSecret) {
      const signature = generateSignature(payloadString, agent.webhookSecret);
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    const response = await fetch(agent.webhookUrl, {
      method: "POST",
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(10000),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
      };
    }

    return {
      success: true,
      statusCode: response.status,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return {
      success: false,
      error: errorMessage,
      responseTime,
    };
  }
}

export async function sendPostCreatedWebhook(
  agent: Agent,
  tweetContent: string,
  tweetId?: string,
  metadata?: Record<string, unknown>
): Promise<WebhookResult> {
  return sendWebhook(agent, "post_created", {
    content: tweetContent,
    tweetId,
    characterCount: tweetContent.length,
    ...metadata,
  });
}

export async function sendPostFailedWebhook(
  agent: Agent,
  error: string,
  attemptedContent?: string,
  metadata?: Record<string, unknown>
): Promise<WebhookResult> {
  return sendWebhook(agent, "post_failed", {
    error,
    attemptedContent,
    ...metadata,
  });
}

export async function sendReplyCreatedWebhook(
  agent: Agent,
  replyContent: string,
  inReplyToTweetId: string,
  replyTweetId?: string,
  metadata?: Record<string, unknown>
): Promise<WebhookResult> {
  return sendWebhook(agent, "reply_created", {
    content: replyContent,
    inReplyToTweetId,
    replyTweetId,
    characterCount: replyContent.length,
    ...metadata,
  });
}

export async function sendReplyFailedWebhook(
  agent: Agent,
  error: string,
  inReplyToTweetId: string,
  attemptedContent?: string,
  metadata?: Record<string, unknown>
): Promise<WebhookResult> {
  return sendWebhook(agent, "reply_failed", {
    error,
    inReplyToTweetId,
    attemptedContent,
    ...metadata,
  });
}

export async function sendErrorWebhook(
  agent: Agent,
  errorType: string,
  errorMessage: string,
  metadata?: Record<string, unknown>
): Promise<WebhookResult> {
  return sendWebhook(agent, "error", {
    errorType,
    errorMessage,
    ...metadata,
  });
}

export async function sendRateLimitWarningWebhook(
  agent: Agent,
  currentUsage: number,
  limit: number,
  metadata?: Record<string, unknown>
): Promise<WebhookResult> {
  return sendWebhook(agent, "rate_limit_warning", {
    currentUsage,
    limit,
    percentUsed: Math.round((currentUsage / limit) * 100),
    ...metadata,
  });
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = `sha256=${generateSignature(payload, secret)}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function testWebhookConnection(
  webhookUrl: string,
  webhookSecret?: string
): Promise<WebhookResult> {
  const testPayload: WebhookPayload = {
    event: "error",
    timestamp: new Date().toISOString(),
    agentId: "test",
    agentName: "Webhook Test",
    data: {
      message: "This is a test webhook to verify your endpoint configuration.",
      testId: crypto.randomUUID(),
    },
  };

  const payloadString = JSON.stringify(testPayload);
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": "error",
      "X-Webhook-Timestamp": testPayload.timestamp,
      "X-Agent-Id": "test",
    };

    if (webhookSecret) {
      const signature = generateSignature(payloadString, webhookSecret);
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(10000),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
      };
    }

    return {
      success: true,
      statusCode: response.status,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return {
      success: false,
      error: errorMessage,
      responseTime,
    };
  }
}
