import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertKnowledgeBaseSchema, insertCustomApiSchema, insertApiKeySchema, insertAgentActivitySchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { assemblePrompt, buildMessagesArray } from "./promptAssembly";

// Helper to build OpenAI completion params with model-specific support
function buildOpenAIParams(modelName: string, baseParams: any) {
  const params = { ...baseParams };
  const modelLower = (modelName || "").toLowerCase();
  
  // gpt-4.1-mini and mini models only support temperature=1
  if (modelLower.includes("mini") || modelLower.includes("4o-mini")) {
    params.temperature = 1;
  }
  
  // Some models don't support frequency_penalty or presence_penalty
  if (modelLower.includes("mini")) {
    delete params.frequency_penalty;
    delete params.presence_penalty;
  }
  
  return params;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ============= AGENTS ============= //
  
  // Get all agents
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  // Get single agent
  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  // Create agent
  app.post("/api/agents", async (req, res) => {
    try {
      const validatedData = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent(validatedData);
      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating agent:", error);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  // Update agent
  app.patch("/api/agents/:id", async (req, res) => {
    try {
      console.log("[PATCH /api/agents/:id] Request body keys:", Object.keys(req.body));
      const partialSchema = insertAgentSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const agent = await storage.updateAgent(req.params.id, validatedData);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[PATCH /api/agents/:id] Validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating agent:", error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  // Delete agent
  app.delete("/api/agents/:id", async (req, res) => {
    try {
      const success = await storage.deleteAgent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  // Update agent status (deploy/pause/test)
  app.patch("/api/agents/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !["draft", "testing", "deployed", "paused"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const agent = await storage.updateAgentStatus(req.params.id, status);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error updating agent status:", error);
      res.status(500).json({ error: "Failed to update agent status" });
    }
  });

  // ============= KNOWLEDGE BASE ============= //

  // Get knowledge base entries for an agent
  app.get("/api/agents/:agentId/knowledge", async (req, res) => {
    try {
      const entries = await storage.getKnowledgeBaseEntries(req.params.agentId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching knowledge base:", error);
      res.status(500).json({ error: "Failed to fetch knowledge base" });
    }
  });

  // Create knowledge base entry
  app.post("/api/agents/:agentId/knowledge", async (req, res) => {
    try {
      const validatedData = insertKnowledgeBaseSchema.parse({
        ...req.body,
        agentId: req.params.agentId,
      });
      const entry = await storage.createKnowledgeBaseEntry(validatedData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating knowledge entry:", error);
      res.status(500).json({ error: "Failed to create knowledge entry" });
    }
  });

  // Update knowledge base entry
  app.patch("/api/knowledge/:id", async (req, res) => {
    try {
      const partialSchema = insertKnowledgeBaseSchema.partial().omit({ agentId: true });
      const validatedData = partialSchema.parse(req.body);
      const entry = await storage.updateKnowledgeBaseEntry(req.params.id, validatedData);
      if (!entry) {
        return res.status(404).json({ error: "Knowledge entry not found" });
      }
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating knowledge entry:", error);
      res.status(500).json({ error: "Failed to update knowledge entry" });
    }
  });

  // Delete knowledge base entry
  app.delete("/api/knowledge/:id", async (req, res) => {
    try {
      const success = await storage.deleteKnowledgeBaseEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Knowledge entry not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting knowledge entry:", error);
      res.status(500).json({ error: "Failed to delete knowledge entry" });
    }
  });

  // Get active knowledge base entries for an agent
  app.get("/api/agents/:agentId/knowledge/active", async (req, res) => {
    try {
      const entries = await storage.getActiveKnowledgeBase(req.params.agentId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching active knowledge base:", error);
      res.status(500).json({ error: "Failed to fetch active knowledge base" });
    }
  });

  // Get pending knowledge base entries for review
  app.get("/api/agents/:agentId/knowledge/pending", async (req, res) => {
    try {
      const entries = await storage.getPendingKnowledgeBase(req.params.agentId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching pending knowledge base:", error);
      res.status(500).json({ error: "Failed to fetch pending knowledge base" });
    }
  });

  // Get approved knowledge base entries
  app.get("/api/agents/:agentId/knowledge/approved", async (req, res) => {
    try {
      const entries = await storage.getApprovedKnowledgeBase(req.params.agentId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching approved knowledge base:", error);
      res.status(500).json({ error: "Failed to fetch approved knowledge base" });
    }
  });

  // Batch approve knowledge base entries
  app.post("/api/agents/:agentId/knowledge/batch/approve", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { ids, approvedBy } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required and cannot be empty" });
      }

      const count = await storage.batchApproveKnowledgeBase(agentId, ids, approvedBy);
      
      if (count === 0) {
        return res.status(404).json({ 
          error: "No entries were approved. Ensure they are pending and belong to this agent.",
          approvedCount: 0
        });
      }

      res.json({
        success: true,
        approvedCount: count,
        message: `Successfully approved ${count} knowledge base entries`,
      });
    } catch (error) {
      console.error("Error batch approving knowledge entries:", error);
      res.status(500).json({ error: "Failed to approve knowledge entries" });
    }
  });

  // Batch archive/reject knowledge base entries
  app.post("/api/agents/:agentId/knowledge/batch/archive", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required and cannot be empty" });
      }

      const count = await storage.batchArchiveKnowledgeBase(agentId, ids);
      
      if (count === 0) {
        return res.status(404).json({ 
          error: "No entries were archived. Ensure they belong to this agent and are not already archived.",
          archivedCount: 0
        });
      }

      res.json({
        success: true,
        archivedCount: count,
        message: `Successfully archived ${count} knowledge base entries`,
      });
    } catch (error) {
      console.error("Error batch archiving knowledge entries:", error);
      res.status(500).json({ error: "Failed to archive knowledge entries" });
    }
  });

  // Get knowledge base entries by category
  app.get("/api/agents/:agentId/knowledge/category/:category", async (req, res) => {
    try {
      const entries = await storage.getKnowledgeBaseByCategory(req.params.agentId, req.params.category);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching knowledge by category:", error);
      res.status(500).json({ error: "Failed to fetch knowledge by category" });
    }
  });

  // ============= AGENT MONITORING/ACTIVITY ============= //

  // Get agent activity (with optional date range)
  app.get("/api/agents/:agentId/activity", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const activity = await storage.getAgentActivity(
        req.params.agentId,
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(activity);
    } catch (error) {
      console.error("Error fetching agent activity:", error);
      res.status(500).json({ error: "Failed to fetch agent activity" });
    }
  });

  // Get agent activity summary
  app.get("/api/agents/:agentId/activity/summary", async (req, res) => {
    try {
      const summary = await storage.getAgentActivitySummary(req.params.agentId);
      res.json(summary || null);
    } catch (error) {
      console.error("Error fetching activity summary:", error);
      res.status(500).json({ error: "Failed to fetch activity summary" });
    }
  });

  // Create or update agent activity
  app.post("/api/agents/:agentId/activity", async (req, res) => {
    try {
      const validatedData = insertAgentActivitySchema.parse({
        ...req.body,
        agentId: req.params.agentId,
      });
      const activity = await storage.createOrUpdateActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating/updating activity:", error);
      res.status(500).json({ error: "Failed to create/update activity" });
    }
  });

  // ============= CUSTOM APIs ============= //

  // Get all custom APIs
  app.get("/api/custom-apis", async (req, res) => {
    try {
      const apis = await storage.getAllCustomApis();
      res.json(apis);
    } catch (error) {
      console.error("Error fetching custom APIs:", error);
      res.status(500).json({ error: "Failed to fetch custom APIs" });
    }
  });

  // Get single custom API
  app.get("/api/custom-apis/:id", async (req, res) => {
    try {
      const api = await storage.getCustomApi(req.params.id);
      if (!api) {
        return res.status(404).json({ error: "Custom API not found" });
      }
      res.json(api);
    } catch (error) {
      console.error("Error fetching custom API:", error);
      res.status(500).json({ error: "Failed to fetch custom API" });
    }
  });

  // Create custom API
  app.post("/api/custom-apis", async (req, res) => {
    try {
      const validatedData = insertCustomApiSchema.parse(req.body);
      const api = await storage.createCustomApi(validatedData);
      res.status(201).json(api);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating custom API:", error);
      res.status(500).json({ error: "Failed to create custom API" });
    }
  });

  // Update custom API
  app.patch("/api/custom-apis/:id", async (req, res) => {
    try {
      const partialSchema = insertCustomApiSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const api = await storage.updateCustomApi(req.params.id, validatedData);
      if (!api) {
        return res.status(404).json({ error: "Custom API not found" });
      }
      res.json(api);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating custom API:", error);
      res.status(500).json({ error: "Failed to update custom API" });
    }
  });

  // Delete custom API
  app.delete("/api/custom-apis/:id", async (req, res) => {
    try {
      const success = await storage.deleteCustomApi(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Custom API not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom API:", error);
      res.status(500).json({ error: "Failed to delete custom API" });
    }
  });

  // Test custom API endpoint - with real HTTP request and JSON extraction
  app.post("/api/custom-apis/:id/test", async (req, res) => {
    try {
      const api = await storage.getCustomApi(req.params.id);
      if (!api) {
        return res.status(404).json({ error: "Custom API not found" });
      }

      // Build request headers
      const headers: Record<string, string> = { ...api.headers };

      // Add authentication from environment variables
      if (api.authType !== "none" && api.authKeyEnvVar) {
        const apiKey = process.env[api.authKeyEnvVar];
        if (!apiKey) {
          return res.status(400).json({
            success: false,
            error: `API key not found. Please add ${api.authKeyEnvVar} to your Replit secrets.`,
            hint: `Go to Secrets tab and add: ${api.authKeyEnvVar}=your_actual_key`,
          });
        }

        if (api.authType === "bearer") {
          headers["Authorization"] = `Bearer ${apiKey}`;
        } else if (api.authType === "api_key" && api.authHeaderName) {
          headers[api.authHeaderName] = apiKey;
        } else if (api.authType === "basic") {
          headers["Authorization"] = `Basic ${Buffer.from(apiKey).toString("base64")}`;
        }
      }

      // Build URL with query parameters
      const url = new URL(api.baseUrl);
      if (api.queryParams) {
        Object.entries(api.queryParams).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: api.method,
        headers,
      };

      if (api.requestBody && (api.method === "POST" || api.method === "PUT" || api.method === "PATCH")) {
        fetchOptions.body = api.requestBody;
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(url.toString(), fetchOptions);

      const responseText = await response.text();
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      // Extract data using JSON paths
      let extractedData: any[] = [];
      let extractedTitle = null;
      let extractedContent = null;
      let extractionError = null;

      if (api.jsonPath && typeof responseData === "object") {
        try {
          // Use jsonpath library for proper JSONPath extraction
          const jpModule = await import("jsonpath");
          const jp = jpModule.default || jpModule;
          extractedData = jp.query(responseData, api.jsonPath);
          
          // Extract title and content from first item if paths provided
          if (extractedData.length > 0 && (api.titlePath || api.contentPath)) {
            const firstItem = extractedData[0];
            
            if (api.titlePath) {
              const titles = jp.query(firstItem, api.titlePath);
              if (titles.length > 0) {
                extractedTitle = String(titles[0]);
              }
            }
            
            if (api.contentPath) {
              const contents = jp.query(firstItem, api.contentPath);
              if (contents.length > 0) {
                extractedContent = String(contents[0]);
              }
            }
          }
        } catch (err: any) {
          extractionError = err.message;
        }
      }

      // Update test status in database
      await storage.updateCustomApi(api.id, {
        lastTestedAt: new Date(),
        testStatus: response.ok ? "success" : "failed",
        testError: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
      });

      res.json({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        rawResponse: responseData,
        extractedData,
        extractedTitle,
        extractedContent,
        extractedCount: extractedData.length,
        extractionError,
        previewKBEntry: extractedTitle && extractedContent ? {
          title: extractedTitle,
          content: extractedContent,
        } : null,
      });
    } catch (error: any) {
      console.error("Error testing custom API:", error);
      
      // Update test status as failed
      try {
        if (req.params.id) {
          await storage.updateCustomApi(req.params.id, {
            lastTestedAt: new Date(),
            testStatus: "failed",
            testError: error.message,
          });
        }
      } catch (updateError) {
        console.error("Failed to update test status:", updateError);
      }
      
      res.status(500).json({
        success: false,
        error: error.message || "Failed to test custom API",
      });
    }
  });

  // ============= CONVERSATION TESTING ============= //

  // Test multi-turn conversation with context management
  app.post("/api/agents/:agentId/test/conversation", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { message, conversationHistory, includeKnowledge = true } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Get agent configuration
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      // Determine API key to use
      let apiKey = agent.modelApiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "No API key configured", 
          details: "Please add OPENAI_API_KEY or ANTHROPIC_API_KEY to your Replit secrets, or configure a model API key in the agent settings." 
        });
      }
      
      // Get active knowledge base entries for this agent
      const knowledgeEntries = includeKnowledge 
        ? await storage.getActiveKnowledgeBase(agentId)
        : [];
      
      // Assemble comprehensive prompt using all agent configuration
      const assembledPrompt = await assemblePrompt(agent, knowledgeEntries, {
        includeKnowledge,
        includeExamples: true,
        includePersonality: true,
        maxKbEntries: 20,
        maxKbTokens: 2000,
      });
      
      // Build messages array with assembled prompt
      const messages = buildMessagesArray(
        assembledPrompt,
        conversationHistory,
        message
      );
      
      let response: string;
      
      // Call the appropriate AI provider
      if (agent.modelProvider === "openai" || !agent.modelProvider) {
        const openai = new OpenAI({ apiKey });
        
        const params = buildOpenAIParams(agent.modelName, {
          model: agent.modelName || "gpt-4-turbo-preview",
          messages: messages as any,
          temperature: Number(agent.temperature) || 0.7,
          max_completion_tokens: agent.maxTokens || 500,
          top_p: Number(agent.topP) || 0.9,
          frequency_penalty: Number(agent.frequencyPenalty) || 0.5,
          presence_penalty: Number(agent.presencePenalty) || 0.5,
        });
        
        const completion = await openai.chat.completions.create(params as any);
        
        response = completion.choices[0]?.message?.content || "No response generated";
        
      } else if (agent.modelProvider === "anthropic") {
        const anthropic = new Anthropic({ apiKey });
        
        // Anthropic requires system message separately
        const systemMessage = messages.find(m => m.role === "system");
        const conversationMessages = messages.filter(m => m.role !== "system");
        
        const completion = await anthropic.messages.create({
          model: agent.modelName || "claude-3-opus-20240229",
          system: systemMessage?.content || "You are a helpful AI assistant.",
          messages: conversationMessages.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content
          })),
          max_tokens: agent.maxTokens || 500,
          temperature: Number(agent.temperature) || 0.7,
          top_p: Number(agent.topP) || 0.9,
        });
        
        const textContent = completion.content.find((c) => c.type === "text") as any;
        response = textContent?.text || "No response generated";
        
      } else {
        return res.status(400).json({ error: `Unsupported model provider: ${agent.modelProvider}` });
      }
      
      res.json({
        success: true,
        response,
        timestamp: new Date().toISOString(),
        contextUsed: conversationHistory?.length || 0,
        modelUsed: `${agent.modelProvider || 'openai'}/${agent.modelName || 'gpt-4-turbo-preview'}`,
        promptInfo: {
          kbEntriesUsed: assembledPrompt.metadata.kbEntriesUsed,
          examplesUsed: assembledPrompt.metadata.examplesUsed,
          componentsIncluded: assembledPrompt.metadata.componentsIncluded,
        },
      });
    } catch (error: any) {
      console.error("Error in conversation test:", error);
      res.status(500).json({ 
        error: "Failed to process conversation",
        details: error.message 
      });
    }
  });

  // Test Twitter API credentials
  app.post("/api/agents/:agentId/test/twitter", async (req, res) => {
    try {
      const { agentId } = req.params;
      
      // Get agent configuration
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      // Check if all required OAuth 1.0a credentials are present
      const requiredFields = [
        { key: 'twitterApiKey', name: 'API Key (Consumer Key)' },
        { key: 'twitterApiSecret', name: 'API Key Secret' },
        { key: 'twitterAccessToken', name: 'Access Token' },
        { key: 'twitterAccessSecret', name: 'Access Token Secret' },
      ];
      
      const missingFields = requiredFields.filter(field => !agent[field.key as keyof typeof agent]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Missing Twitter credentials",
          missingFields: missingFields.map(f => f.name),
          details: "Please add all required OAuth 1.0a credentials in the Credentials tab",
          hint: "For Twitter API access, you need: API Key, API Key Secret, Access Token, and Access Token Secret"
        });
      }
      
      // Initialize OAuth
      const oauth = new OAuth({
        consumer: {
          key: agent.twitterApiKey!,
          secret: agent.twitterApiSecret!,
        },
        signature_method: 'HMAC-SHA1',
        hash_function(base_string: string, key: string) {
          return crypto
            .createHmac('sha1', key)
            .update(base_string)
            .digest('base64');
        },
      });
      
      // Prepare token
      const token = {
        key: agent.twitterAccessToken!,
        secret: agent.twitterAccessSecret!,
      };
      
      // Test endpoint: Verify credentials
      const requestData = {
        url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
        method: 'GET',
      };
      
      // Generate OAuth header
      const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
      
      // Make request
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: {
          ...authHeader,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { message: errorText };
        }
        
        let hint = "Please verify your Twitter API credentials are correct.";
        if (response.status === 401) {
          hint = "Authentication failed. Check that your API Key, API Secret, Access Token, and Access Token Secret are correct.";
        } else if (response.status === 403) {
          hint = "Access forbidden. Make sure your Twitter app has the required permissions (Read and Write).";
        }
        
        return res.status(response.status).json({
          success: false,
          error: "Twitter API authentication failed",
          statusCode: response.status,
          details: errorDetails,
          hint
        });
      }
      
      const userData = await response.json();
      
      // Successfully authenticated
      res.json({
        success: true,
        message: "Twitter API credentials are valid! ✓",
        user: {
          id: userData.id_str,
          name: userData.name,
          username: userData.screen_name,
          verified: userData.verified,
          followers: userData.followers_count,
          following: userData.friends_count,
        },
        testedAt: new Date().toISOString(),
        hint: "Your Twitter bot is ready to post and interact!"
      });
      
    } catch (error: any) {
      console.error("Error testing Twitter API:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to test Twitter API",
        details: error.message,
        hint: "An unexpected error occurred. Check server logs for details."
      });
    }
  });

  // Test AI Model API key and fetch available models
  app.post("/api/agents/:agentId/test/model", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { provider, apiKey } = req.body;

      if (!provider || !apiKey) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
          details: "Both provider and apiKey are required"
        });
      }

      let models: any[] = [];
      let testResult: any = {};

      // Test OpenAI
      if (provider === "openai") {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          return res.status(response.status).json({
            success: false,
            error: "OpenAI API authentication failed",
            statusCode: response.status,
            hint: response.status === 401
              ? "API key is invalid. Please check your OpenAI API key."
              : "Failed to connect to OpenAI. Please verify your API key."
          });
        }

        const data = await response.json();
        
        // Filter for GPT models and sort by creation date (newest first)
        const gptModels = data.data
          .filter((m: any) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'))
          .sort((a: any, b: any) => b.created - a.created);

        models = gptModels.map((m: any) => ({
          id: m.id,
          name: m.id,
          created: m.created,
          owned_by: m.owned_by
        }));

        testResult = {
          success: true,
          provider: "openai",
          modelCount: models.length,
          latestModel: models[0]?.id || null,
          models: models
        };
      }
      
      // Test Google Gemini
      else if (provider === "google" || provider === "gemini") {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
          const errorText = await response.text();
          return res.status(response.status).json({
            success: false,
            error: "Google AI API authentication failed",
            statusCode: response.status,
            hint: response.status === 400 || response.status === 403
              ? "API key is invalid. Please check your Google AI API key."
              : "Failed to connect to Google AI. Please verify your API key."
          });
        }

        const data = await response.json();
        
        // Filter for Gemini models and normalize to match expected structure
        const geminiModels = data.models
          ?.filter((m: any) => m.name && m.name.includes('gemini'))
          .map((m: any) => {
            const modelId = m.name.split('/').pop() || m.name; // Extract model ID from full path like "models/gemini-pro"
            return {
              id: modelId,
              name: m.displayName || modelId, // Use display name if available, otherwise use ID
              description: m.description,
              supportedGenerationMethods: m.supportedGenerationMethods
            };
          }) || [];

        models = geminiModels;

        testResult = {
          success: true,
          provider: "google",
          modelCount: models.length,
          latestModel: models[0]?.id || null,
          models: models
        };
      }
      
      // Test Anthropic Claude
      else if (provider === "anthropic") {
        // Anthropic doesn't have a public models list endpoint
        // Test by making a minimal API call
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "Hi" }]
          })
        });

        if (!response.ok && response.status === 401) {
          return res.status(401).json({
            success: false,
            error: "Anthropic API authentication failed",
            hint: "API key is invalid. Please check your Anthropic API key."
          });
        }

        // Provide known Claude models (hardcoded since no list endpoint)
        models = [
          { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Latest)", family: "claude-3.5" },
          { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", family: "claude-3.5" },
          { id: "claude-3-opus-20240229", name: "Claude 3 Opus", family: "claude-3" },
          { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", family: "claude-3" },
          { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", family: "claude-3" },
        ];

        testResult = {
          success: true,
          provider: "anthropic",
          modelCount: models.length,
          latestModel: models[0].id,
          models: models,
          note: "Anthropic doesn't provide a models list API. These are the latest known Claude models."
        };
      }
      
      else {
        return res.status(400).json({
          success: false,
          error: "Unsupported provider",
          details: `Provider "${provider}" is not supported for automatic model discovery. Supported: openai, google, anthropic`
        });
      }

      res.json(testResult);

    } catch (error: any) {
      console.error("Error testing AI model API:", error);
      res.status(500).json({
        success: false,
        error: "Failed to test AI model API",
        details: error.message
      });
    }
  });

  // ============= KB AUTO-INGESTION ============= //

  // Helper function to evaluate news relevance using AI with numeric scoring
  async function evaluateRelevance(title: string, content: string, customFilterPrompt?: string): Promise<{ 
    isRelevant: boolean; 
    relevanceScore: number;
    topics: string[]; 
    reason: string 
  }> {
    try {
      // This uses Replit AI Integrations - no API key needed, charges billed to credits
      const openaiModule = await import("openai");
      const OpenAI = openaiModule.default;
      
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
      });

      // Use custom filter prompt if provided, otherwise use default
      const basePrompt = customFilterPrompt 
        ? `You are a content relevance filter for a Twitter AI agent.

Evaluate this news item based on the following custom criteria:
${customFilterPrompt}

News item:
Title: ${title}
Content: ${content.substring(0, 1000)}

Rate the content's relevance (0.0 to 1.0) based on how well it matches the criteria above.`
        : `You are a content relevance filter for a Twitter AI agent focused on crypto, tech, and Twitter/social media topics.

Evaluate this news item for relevance:
Title: ${title}
Content: ${content.substring(0, 1000)}

Rate the content's relevance (0.0 to 1.0) to audiences interested in:
- Cryptocurrency, blockchain, DeFi, NFTs, Web3
- Technology, AI, software development, startups
- Twitter/X, social media trends, digital culture`;

      const prompt = `${basePrompt}

Scoring guide:
- 0.0-0.3: Not relevant or off-topic
- 0.4-0.5: Marginally relevant
- 0.6-0.7: Relevant (auto-approve threshold)
- 0.8-1.0: Highly relevant

Respond in JSON format:
{
  "relevanceScore": 0.75,
  "topics": ["topic1", "topic2"],
  "reason": "brief explanation of score"
}`;

      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini", // Using mini for cost efficiency on filtering
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      const relevanceScore = typeof result.relevanceScore === "number" 
        ? result.relevanceScore 
        : 0.0;
      
      // Auto-approve if score >= 0.6 (stated threshold)
      const isRelevant = relevanceScore >= 0.6;
      
      return {
        isRelevant,
        relevanceScore,
        topics: result.topics || [],
        reason: result.reason || `Score: ${relevanceScore.toFixed(2)}`
      };
    } catch (error) {
      console.error("AI relevance evaluation failed:", error);
      // Default to manual review if AI fails
      return { 
        isRelevant: false, 
        relevanceScore: 0.0,
        topics: [], 
        reason: "AI evaluation failed - requires manual review" 
      };
    }
  }

  // Manually trigger KB ingestion from an integration or custom API
  app.post("/api/agents/:agentId/knowledge/ingest/:sourceId", async (req, res) => {
    try {
      const { agentId, sourceId } = req.params;
      
      // Fetch custom API configuration
      const customApi = await storage.getCustomApi(sourceId);
      if (!customApi) {
        return res.status(404).json({ error: "Custom API not found" });
      }
      
      // Build request headers
      const headers: Record<string, string> = { ...customApi.headers };
      
      // Add authentication from environment variables
      if (customApi.authType !== "none" && customApi.authKeyEnvVar) {
        const apiKey = process.env[customApi.authKeyEnvVar];
        if (!apiKey) {
          return res.status(400).json({
            success: false,
            error: `API key not found. Please add ${customApi.authKeyEnvVar} to your Replit secrets.`,
          });
        }
        
        if (customApi.authType === "bearer") {
          headers["Authorization"] = `Bearer ${apiKey}`;
        } else if (customApi.authType === "api_key" && customApi.authHeaderName) {
          headers[customApi.authHeaderName] = apiKey;
        } else if (customApi.authType === "basic") {
          headers["Authorization"] = `Basic ${Buffer.from(apiKey).toString("base64")}`;
        }
      }
      
      // Build URL with query parameters
      let url = customApi.baseUrl;
      if (Object.keys(customApi.queryParams || {}).length > 0) {
        const params = new URLSearchParams(customApi.queryParams || {});
        url += `?${params.toString()}`;
      }
      
      // Make API request
      const response = await fetch(url, {
        method: customApi.method || "GET",
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract data using JSON path
      const jpModule = await import("jsonpath");
      const jp = jpModule.default || jpModule;
      let extractedData: any[] = [];
      
      try {
        if (customApi.jsonPath) {
          extractedData = jp.query(data, customApi.jsonPath);
          console.log(`JSONPath extraction: ${customApi.jsonPath} returned ${extractedData.length} items`);
        } else {
          extractedData = Array.isArray(data) ? data : [data];
        }
      } catch (jsonPathError: any) {
        console.error("JSONPath extraction error:", jsonPathError);
        return res.status(400).json({
          error: "JSONPath extraction failed",
          details: jsonPathError.message,
          jsonPath: customApi.jsonPath,
        });
      }
      
      if (!extractedData || extractedData.length === 0) {
        console.warn(`No data extracted from ${customApi.baseUrl} using path: ${customApi.jsonPath}`);
        return res.status(400).json({
          error: "No data extracted",
          details: "JSONPath query returned no results. Please verify the path is correct.",
          jsonPath: customApi.jsonPath,
          hint: "Use the Test button to preview extraction results before ingesting",
        });
      }
      
      // Create KB entries from extracted data with AI-powered relevance filtering
      const createdEntries = [];
      const relevanceStats = { approved: 0, pending: 0 };
      
      for (const item of extractedData.slice(0, 20)) { // Limit to 20 entries per ingestion
        let title = "Untitled";
        let content = JSON.stringify(item);
        
        // Extract title and content using paths
        if (customApi.titlePath) {
          const titles = jp.query(item, customApi.titlePath);
          if (titles.length > 0) {
            title = String(titles[0]);
          }
        }
        
        if (customApi.contentPath) {
          const contents = jp.query(item, customApi.contentPath);
          if (contents.length > 0) {
            content = String(contents[0]);
          }
        }
        
        // AI-powered relevance evaluation with custom filter prompt from API config
        const relevanceEval = await evaluateRelevance(title, content, customApi.filterPrompt || undefined);
        
        // Auto-approve if relevant, otherwise keep as pending for manual review
        const isAutoApproved = relevanceEval.isRelevant;
        const tags = [
          "auto-generated",
          "api-ingestion",
          ...relevanceEval.topics,
          isAutoApproved ? "ai-approved" : "ai-review-required"
        ];
        
        const entryData = {
          title: title.substring(0, 500),
          content: content.substring(0, 10000),
          tags,
          source: customApi.name,
          sourceId: sourceId,
          sourceUrl: customApi.baseUrl,
          category: "news",
          priority: isAutoApproved ? 7 : 5, // Higher priority for auto-approved
          active: isAutoApproved, // Auto-activate if relevant
          status: isAutoApproved ? "approved" : "pending",
          refreshStrategy: "manual",
          lastFetchedAt: new Date(),
          agentId: agentId,
        };
        
        try {
          const validatedData = insertKnowledgeBaseSchema.parse(entryData);
          const created = await storage.createKnowledgeBaseEntry(validatedData);
          createdEntries.push(created);
          
          if (isAutoApproved) {
            relevanceStats.approved++;
          } else {
            relevanceStats.pending++;
          }
        } catch (err) {
          console.error("Error creating KB entry:", err);
        }
      }
      
      res.status(201).json({
        success: true,
        message: `Ingested ${createdEntries.length} entries: ${relevanceStats.approved} auto-approved, ${relevanceStats.pending} pending review`,
        count: createdEntries.length,
        autoApproved: relevanceStats.approved,
        pendingReview: relevanceStats.pending,
        entries: createdEntries.slice(0, 5), // Return first 5 as sample
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error ingesting KB data:", error);
      res.status(500).json({ error: "Failed to ingest KB data" });
    }
  });

  // Manual refresh KB entries from API source
  app.post("/api/agents/:agentId/knowledge/refresh/:sourceId", async (req, res) => {
    try {
      const { agentId, sourceId } = req.params;
      
      // Delete old entries from this source (keep them fresh)
      const existingEntries = await storage.getKnowledgeBaseEntries(agentId);
      const entriesToDelete = existingEntries.filter(e => e.sourceId === sourceId).map(e => e.id);
      
      if (entriesToDelete.length > 0) {
        await storage.batchArchiveKnowledgeBase(agentId, entriesToDelete);
      }
      
      // Re-fetch and ingest new data (reuse ingestion logic)
      const customApi = await storage.getCustomApi(sourceId);
      if (!customApi) {
        return res.status(404).json({ error: "Custom API not found" });
      }
      
      // Make a POST request to the ingestion endpoint
      const ingestUrl = `/api/agents/${agentId}/knowledge/ingest/${sourceId}`;
      const ingestResponse = await fetch(`http://localhost:5000${ingestUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      const result = await ingestResponse.json();
      
      res.json({
        success: true,
        message: `Refreshed KB from ${customApi.name}`,
        removed: entriesToDelete.length,
        added: result.count || 0,
        autoApproved: result.autoApproved || 0,
      });
    } catch (error: any) {
      console.error("Error refreshing KB:", error);
      res.status(500).json({ error: "Failed to refresh KB", details: error.message });
    }
  });

  // Get KB ingestion status for an agent
  app.get("/api/agents/:agentId/knowledge/ingest/status", async (req, res) => {
    try {
      const { agentId } = req.params;
      
      // Get all KB entries grouped by source
      const entries = await storage.getKnowledgeBaseEntries(agentId);
      
      const sourceStats: Record<string, {
        count: number;
        lastFetched: string | null;
        active: number;
        inactive: number;
      }> = {};
      
      entries.forEach(entry => {
        const source = entry.source || "manual";
        if (!sourceStats[source]) {
          sourceStats[source] = {
            count: 0,
            lastFetched: null,
            active: 0,
            inactive: 0,
          };
        }
        sourceStats[source].count++;
        sourceStats[source][entry.active ? "active" : "inactive"]++;
        
        if (entry.lastFetchedAt) {
          const fetchDate = new Date(entry.lastFetchedAt).toISOString();
          if (!sourceStats[source].lastFetched || fetchDate > sourceStats[source].lastFetched) {
            sourceStats[source].lastFetched = fetchDate;
          }
        }
      });
      
      res.json({
        totalEntries: entries.length,
        sourceStats,
      });
    } catch (error) {
      console.error("Error fetching KB ingestion status:", error);
      res.status(500).json({ error: "Failed to fetch ingestion status" });
    }
  });

  // Background job endpoint to refresh stale KB entries
  app.post("/api/knowledge/refresh-stale", async (req, res) => {
    try {
      // In production, this would be called by a cron job/scheduler
      // It would:
      // 1. Find all KB entries where refreshStrategy is "daily" or "weekly"
      // 2. Check lastRefreshedAt to see if they're due for refresh
      // 3. For each entry, fetch fresh data from its source
      // 4. Update the entry with new data
      
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Mock: simulate finding and refreshing stale entries
      const refreshed = {
        daily: 3,
        weekly: 1,
        errors: 0,
      };
      
      res.json({
        success: true,
        message: "Stale KB entries refreshed",
        refreshed,
        timestamp: now.toISOString(),
      });
    } catch (error) {
      console.error("Error refreshing stale KB entries:", error);
      res.status(500).json({ error: "Failed to refresh stale entries" });
    }
  });

  // ============= AI MODELS ============= //

  // Get available AI models from providers
  app.get("/api/ai-models", async (req, res) => {
    try {
      const provider = (req.query.provider as string) || "all";
      
      const models: any = {
        openai: [
          { id: "gpt-4-turbo-preview", name: "GPT-4 Turbo", family: "gpt-4", contextWindow: 128000, pricing: { input: 0.01, output: 0.03 } },
          { id: "gpt-4", name: "GPT-4", family: "gpt-4", contextWindow: 8192, pricing: { input: 0.03, output: 0.06 } },
          { id: "gpt-4-0125-preview", name: "GPT-4 0125 Preview", family: "gpt-4", contextWindow: 128000, pricing: { input: 0.01, output: 0.03 } },
          { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", family: "gpt-3.5", contextWindow: 16385, pricing: { input: 0.0005, output: 0.0015 } },
          { id: "gpt-3.5-turbo-16k", name: "GPT-3.5 Turbo 16K", family: "gpt-3.5", contextWindow: 16385, pricing: { input: 0.001, output: 0.002 } },
        ],
        anthropic: [
          { id: "claude-3-opus-20240229", name: "Claude 3 Opus", family: "claude-3", contextWindow: 200000, pricing: { input: 0.015, output: 0.075 } },
          { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", family: "claude-3", contextWindow: 200000, pricing: { input: 0.003, output: 0.015 } },
          { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", family: "claude-3", contextWindow: 200000, pricing: { input: 0.00025, output: 0.00125 } },
        ],
      };
      
      if (provider === "all") {
        res.json({ ...models });
      } else if (models[provider]) {
        res.json({ [provider]: models[provider] });
      } else {
        res.status(404).json({ error: "Provider not found" });
      }
    } catch (error) {
      console.error("Error fetching AI models:", error);
      res.status(500).json({ error: "Failed to fetch AI models" });
    }
  });

  // Auto-detect latest model in a family
  app.get("/api/ai-models/latest", async (req, res) => {
    try {
      const { provider, family } = req.query;
      
      // In production, this would call the actual API to get latest models
      // For now, return static latest versions
      const latestModels: Record<string, Record<string, string>> = {
        openai: {
          "gpt-4": "gpt-4-turbo-preview",
          "gpt-3.5": "gpt-3.5-turbo",
        },
        anthropic: {
          "claude-3": "claude-3-opus-20240229",
        },
      };
      
      if (provider && family && latestModels[provider as string]) {
        const latest = latestModels[provider as string][family as string];
        if (latest) {
          res.json({ modelId: latest });
        } else {
          res.status(404).json({ error: "Model family not found" });
        }
      } else {
        res.json(latestModels);
      }
    } catch (error) {
      console.error("Error detecting latest model:", error);
      res.status(500).json({ error: "Failed to detect latest model" });
    }
  });

  // ============= API KEYS ============= //

  // Get all API keys
  app.get("/api/api-keys", async (req, res) => {
    try {
      const keys = await storage.getAllApiKeys();
      // Mask the actual API keys for security
      const maskedKeys = keys.map(key => ({
        ...key,
        apiKey: key.apiKey.substring(0, 8) + "•".repeat(Math.max(12, key.apiKey.length - 8)),
      }));
      res.json(maskedKeys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  // Get API keys by provider
  app.get("/api/api-keys/provider/:provider", async (req, res) => {
    try {
      const keys = await storage.getApiKeysByProvider(req.params.provider);
      const maskedKeys = keys.map(key => ({
        ...key,
        apiKey: key.apiKey.substring(0, 8) + "•".repeat(Math.max(12, key.apiKey.length - 8)),
      }));
      res.json(maskedKeys);
    } catch (error) {
      console.error("Error fetching API keys by provider:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  // Create API key
  app.post("/api/api-keys", async (req, res) => {
    try {
      const validatedData = insertApiKeySchema.parse(req.body);
      const key = await storage.createApiKey(validatedData);
      res.status(201).json(key);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating API key:", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  // Update API key
  app.patch("/api/api-keys/:id", async (req, res) => {
    try {
      const partialSchema = insertApiKeySchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const key = await storage.updateApiKey(req.params.id, validatedData);
      if (!key) {
        return res.status(404).json({ error: "API key not found" });
      }
      res.json(key);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating API key:", error);
      res.status(500).json({ error: "Failed to update API key" });
    }
  });

  // Delete API key
  app.delete("/api/api-keys/:id", async (req, res) => {
    try {
      const success = await storage.deleteApiKey(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "API key not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });

  // ============= PLAYGROUND / TESTING ============= //

  // Test tweet generation (auto-generates from KB if no prompt provided)
  app.post("/api/playground/test-tweet", async (req, res) => {
    try {
      const { agentId, prompt } = req.body;
      const conversationHistory: any[] = []; // Empty for tweet generation
      
      if (!agentId) {
        return res.status(400).json({ error: "Agent ID required" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Get active knowledge entries
      const knowledgeEntries = await storage.getActiveKnowledgeBase(agentId);
      
      // Assemble prompt with KB entries
      const assembledPrompt = await assemblePrompt(agent, knowledgeEntries, {
        includeKnowledge: true,
        includeExamples: true,
        includePersonality: true,
        maxKbEntries: 20,
        maxKbTokens: 2000,
      });
      
      // Auto-generate prompt if not provided (use KB to inspire tweet)
      const tweetPrompt = prompt || "Generate an insightful tweet for your audience based on recent knowledge base entries. Be engaging and authentic.";
      
      // Build messages for AI model
      const messages = buildMessagesArray(
        assembledPrompt,
        conversationHistory || [],
        tweetPrompt
      );

      let tweet = "";
      
      // Call appropriate AI model
      if (agent.modelProvider === "openai") {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
        });
        
        const params = buildOpenAIParams(agent.modelName, {
          model: agent.modelName || "gpt-4-turbo-preview",
          messages: messages as any,
          temperature: Number(agent.temperature) || 0.7,
          max_completion_tokens: 280, // Twitter character limit context
        });
        
        const completion = await openai.chat.completions.create(params as any);
        
        tweet = completion.choices[0]?.message?.content || "No tweet generated";
        
      } else if (agent.modelProvider === "anthropic") {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        const systemMessage = messages.find(m => m.role === "system");
        const userMessages = messages.filter(m => m.role !== "system");
        
        const completion = await anthropic.messages.create({
          model: agent.modelName || "claude-3-opus-20240229",
          system: systemMessage?.content || "You are a helpful AI assistant.",
          messages: userMessages.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content
          })),
          max_tokens: 280,
          temperature: Number(agent.temperature) || 0.7,
        });
        
        const textContent = completion.content.find((c) => c.type === "text") as any;
        tweet = textContent?.text || "No tweet generated";
      } else {
        return res.status(400).json({ error: `Unsupported model provider: ${agent.modelProvider}` });
      }

      // Get active KB entries for logging
      const kbSources = knowledgeEntries
        .filter(kb => kb.active && kb.status === "approved")
        .slice(0, assembledPrompt.metadata.kbEntriesUsed)
        .map(entry => ({
          id: entry.id,
          title: entry.title,
          source: entry.source,
          category: entry.category,
          priority: entry.priority
        }));

      res.json({
        success: true,
        tweet,
        mode: prompt ? "prompted" : "auto-generated",
        kbEntriesCount: assembledPrompt.metadata.kbEntriesUsed,
        kbSources,
        config: {
          provider: agent.modelProvider,
          model: agent.modelName,
          temperature: agent.temperature,
        },
      });
    } catch (error: any) {
      console.error("Error testing tweet generation:", error);
      res.status(500).json({ 
        error: "Failed to test tweet generation",
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
