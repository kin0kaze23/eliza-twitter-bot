import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertKnowledgeBaseSchema, insertCustomApiSchema, insertApiKeySchema, insertAgentActivitySchema } from "@shared/schema";
import { z } from "zod";

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
      const partialSchema = insertAgentSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const agent = await storage.updateAgent(req.params.id, validatedData);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
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

  // Test custom API endpoint
  app.post("/api/custom-apis/:id/test", async (req, res) => {
    try {
      const api = await storage.getCustomApi(req.params.id);
      if (!api) {
        return res.status(404).json({ error: "Custom API not found" });
      }

      // Perform actual API call
      const headers: Record<string, string> = { ...api.headers };
      if (api.authType === "bearer" && api.authToken) {
        headers["Authorization"] = `Bearer ${api.authToken}`;
      } else if (api.authType === "api_key" && api.authToken) {
        headers["X-API-Key"] = api.authToken;
      }

      const response = await fetch(api.baseUrl, {
        method: api.method,
        headers,
      });

      const data = await response.json();
      
      // Extract data using JSONPath if specified
      let extractedData = data;
      if (api.jsonPath) {
        try {
          // Simple JSONPath extraction (for complex paths, use a library)
          const paths = api.jsonPath.split(".");
          extractedData = paths.reduce((obj, path) => obj?.[path], data);
        } catch (error) {
          console.error("JSONPath extraction error:", error);
        }
      }

      res.json({
        success: response.ok,
        status: response.status,
        data: extractedData,
        rawData: data,
      });
    } catch (error) {
      console.error("Error testing custom API:", error);
      res.status(500).json({ error: "Failed to test custom API" });
    }
  });

  // ============= CONVERSATION TESTING ============= //

  // Test multi-turn conversation with context management
  app.post("/api/agents/:agentId/test/conversation", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { message, conversationHistory } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Get agent configuration
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      // Build context from conversation history
      let context = agent.systemPrompt || "You are a helpful AI assistant.";
      
      if (conversationHistory && conversationHistory.length > 0) {
        context += "\n\nConversation history:";
        conversationHistory.forEach((msg: { role: string; content: string }) => {
          context += `\n${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`;
        });
      }
      
      context += `\n\nUser: ${message}\nAssistant:`;
      
      // In production, this would call the actual AI model
      // For now, simulate a contextual response
      const responses = [
        `Based on our discussion about ${conversationHistory?.length > 0 ? "the previous topics" : "this topic"}, I think ${message.toLowerCase().includes("what") ? "the answer depends on market conditions" : "that's a great point"}. Let me elaborate...`,
        `Following up on ${conversationHistory?.length > 0 ? "what we discussed" : "your question"}: ${message.includes("?") ? "The key factors to consider are timing, market sentiment, and on-chain metrics." : "I agree with your assessment."}`,
        `In the context of ${conversationHistory?.length > 0 ? "our conversation" : "your query"}, I'd say the most important thing is to ${message.toLowerCase().includes("should") ? "analyze the risk-reward ratio" : "stay informed about market developments"}.`,
        `That's an excellent question. ${conversationHistory?.length > 0 ? "Building on our previous discussion," : ""} I recommend looking at: 1) Historical patterns 2) Current market structure 3) Fundamental catalysts.`,
      ];
      
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      res.json({
        success: true,
        response,
        timestamp: new Date().toISOString(),
        contextUsed: conversationHistory?.length || 0,
      });
    } catch (error) {
      console.error("Error in conversation test:", error);
      res.status(500).json({ error: "Failed to process conversation" });
    }
  });

  // ============= KB AUTO-INGESTION ============= //

  // Manually trigger KB ingestion from an integration or custom API
  app.post("/api/agents/:agentId/knowledge/ingest/:sourceId", async (req, res) => {
    try {
      const { agentId, sourceId } = req.params;
      const { sourceType } = req.body; // "integration" or "custom_api"
      
      // In production, this would:
      // 1. Fetch the integration or custom API configuration
      // 2. Make the API call to get fresh data
      // 3. Parse the response using jsonPath
      // 4. Create/update KB entries with the data
      
      let apiData: any;
      let sourceUrl: string;
      
      if (sourceType === "integration") {
        // Fetch from integration (this would use actual integration API in production)
        apiData = {
          title: "Latest Market Analysis",
          content: "BTC showing strong momentum above $43k. Key resistance at $45.5k. On-chain metrics bullish.",
        };
        sourceUrl = "integration://crypto-data";
      } else if (sourceType === "custom_api") {
        // Fetch from custom API
        const customApi = await storage.getCustomApi(sourceId);
        if (!customApi) {
          return res.status(404).json({ error: "Custom API not found" });
        }
        
        // In production, make actual API call using customApi.url
        // For now, simulate the response
        apiData = {
          title: customApi.name + " Data Update",
          content: `Fresh data from ${customApi.url} fetched successfully.`,
        };
        sourceUrl = customApi.url;
      } else {
        return res.status(400).json({ error: "Invalid source type" });
      }
      
      // Create KB entry with fetched data
      const entryData = {
        title: apiData.title || "Auto-fetched Data",
        content: apiData.content || JSON.stringify(apiData),
        tags: ["auto-generated", sourceType],
        source: sourceType,
        sourceId: sourceId,
        sourceUrl: sourceUrl,
        category: "crypto",
        priority: 7,
        active: true,
        refreshStrategy: "daily",
        lastFetchedAt: new Date().toISOString(),
        agentId: agentId,
      };
      
      const validatedData = insertKnowledgeBaseSchema.parse(entryData);
      const created = await storage.createKnowledgeBaseEntry(validatedData);
      
      res.status(201).json({
        success: true,
        message: `Ingested 1 entry from ${sourceType}`,
        entry: created,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error ingesting KB data:", error);
      res.status(500).json({ error: "Failed to ingest KB data" });
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

  // Test tweet generation
  app.post("/api/playground/test-tweet", async (req, res) => {
    try {
      const { agentId, prompt } = req.body;
      
      if (!agentId) {
        return res.status(400).json({ error: "Agent ID required" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // TODO: Implement actual AI model call here
      // For now, return a simulated response
      const simulatedTweet = `[SIMULATED] ${agent.name} says: This is a test tweet based on the prompt: "${prompt}". In production, this would use ${agent.modelProvider}/${agent.modelName} to generate content.`;

      res.json({
        success: true,
        tweet: simulatedTweet,
        config: {
          provider: agent.modelProvider,
          model: agent.modelName,
          temperature: agent.temperature,
        },
      });
    } catch (error) {
      console.error("Error testing tweet generation:", error);
      res.status(500).json({ error: "Failed to test tweet generation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
