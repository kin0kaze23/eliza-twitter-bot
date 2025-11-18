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
