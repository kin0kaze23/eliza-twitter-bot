import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { insertAgentSchema, insertKnowledgeBaseSchema, insertCustomApiSchema, insertApiKeySchema, insertAgentActivitySchema, knowledgeBase } from "@shared/schema";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { assemblePrompt, buildMessagesArray, selectNextContentType, formatContentType, assembleConversationPrompt, buildConversationMessages, type ContentType } from "./promptAssembly";
import { sendPostCreatedWebhook, sendPostFailedWebhook } from "./webhook";
import { buildOpenAIParams, safeOpenAICall } from "./openaiHelpers";
import { requireAuth, verifyPassword, hashPassword } from "./auth";
import { verifyScraperCredentials, validateSessionCookies } from "./twitterScraper";

/**
 * Strip content type labels and decorative elements from generated content
 * Removes: [EVENT-BASED], EVENT-BASED, em-dashes, double-dashes used as separators
 */
function stripContentTypeLabels(content: string): string {
  return content
    // Bracketed labels - replace with newline to preserve paragraph structure
    .replace(/\s*\[(EVENT[-_]BASED|VERSE[-_ ]REFLECTION|DEEP[-_ ]QUESTION|WISDOM[-_ ]BITE|CULTURAL[-_ ]INSIGHT|ENCOURAGEMENT|ETERNITY[-_ ]ANCHOR)\]\s*/gi, "\n")
    // Plain text labels at start of content
    .replace(/^\s*(EVENT[-_\s]?BASED|VERSE[-_\s]?REFLECTION|DEEP[-_\s]?QUESTION|WISDOM[-_\s]?BITE|CULTURAL[-_\s]?INSIGHT|ENCOURAGEMENT|ETERNITY[-_\s]?ANCHOR)\s+/gi, "")
    // Plain text labels mid-content
    .replace(/\s+(EVENT[-_\s]?BASED|VERSE[-_\s]?REFLECTION|DEEP[-_\s]?QUESTION|WISDOM[-_\s]?BITE|CULTURAL[-_\s]?INSIGHT|ENCOURAGEMENT|ETERNITY[-_\s]?ANCHOR)\s+/gi, "\n")
    // Remove decorative separators (em-dashes, double-dashes used as dividers)
    .replace(/\n\s*[-–—]{2,}\s*\n/g, "\n") // Lines with only dashes
    .replace(/\s+[-–—]\s+/g, " ") // Em-dashes or dashes as separators
    // Normalize multiple spaces on same line (preserve newlines!)
    .replace(/[ \t]+/g, " ") // Only collapse horizontal whitespace, NOT \n
    // Clean up multiple consecutive newlines to max 2 (one blank line)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Clean special characters from generated content
 * Replaces: em dashes (—), en dashes (–), curly/smart quotes (" " ' ')
 * With: regular dashes (-), straight quotes ("), apostrophes (')
 */
function cleanSpecialCharacters(content: string): string {
  return content
    // Replace em dashes and en dashes with regular dashes
    .replace(/[—–]/g, "-")
    // Replace curly/smart double quotes with straight quotes
    .replace(/[""]/g, '"')
    // Replace curly/smart single quotes with straight apostrophe
    .replace(/['']/g, "'");
}

/**
 * Detect content type from generated content based on labels and patterns
 */
function detectContentType(content: string): string | null {
  const upperContent = content.toUpperCase();
  
  // Check for explicit labels (most reliable)
  if (upperContent.includes("[EVENT-BASED]") || upperContent.includes("[EVENT_BASED]")) return "EVENT_BASED";
  if (upperContent.includes("[VERSE REFLECTION]") || upperContent.includes("[VERSE_REFLECTION]")) return "VERSE_REFLECTION";
  if (upperContent.includes("[DEEP QUESTION]") || upperContent.includes("[DEEP_QUESTION]")) return "DEEP_QUESTION";
  if (upperContent.includes("[WISDOM BITE]") || upperContent.includes("[WISDOM_BITE]")) return "WISDOM_BITE";
  if (upperContent.includes("[CULTURAL INSIGHT]") || upperContent.includes("[CULTURAL_INSIGHT]")) return "CULTURAL_INSIGHT";
  if (upperContent.includes("[ENCOURAGEMENT]")) return "ENCOURAGEMENT";
  if (upperContent.includes("[ETERNITY ANCHOR]") || upperContent.includes("[ETERNITY_ANCHOR]")) return "ETERNITY_ANCHOR";
  
  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ============= AUTHENTICATION ============= //
  
  // Check auth status
  app.get("/api/auth/status", (req, res) => {
    if (req.session && req.session.userId) {
      res.json({ authenticated: true, username: req.session.username });
    } else {
      res.json({ authenticated: false });
    }
  });
  
  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ success: true, username: user.username });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });
  
  // Check auth status (returns minimal info, safe for unauthenticated calls)
  // Note: This route is intentionally public to allow the frontend to check auth state
  
  // Update credentials (protected)
  app.patch("/api/auth/credentials", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword, newUsername } = req.body;
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      
      const updates: { username?: string; password?: string } = {};
      
      if (newUsername && newUsername !== user.username) {
        const existingUser = await storage.getUserByUsername(newUsername);
        if (existingUser) {
          return res.status(400).json({ error: "Username already taken" });
        }
        updates.username = newUsername;
      }
      
      if (newPassword) {
        updates.password = await hashPassword(newPassword);
      }
      
      if (Object.keys(updates).length > 0) {
        await storage.updateUser(user.id, updates);
        if (updates.username) {
          req.session.username = updates.username;
        }
      }
      
      res.json({ success: true, message: "Credentials updated successfully" });
    } catch (error) {
      console.error("Update credentials error:", error);
      res.status(500).json({ error: "Failed to update credentials" });
    }
  });
  
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

  // Get prompt analysis for debugging/inspection
  app.get("/api/agents/:id/prompt-analysis", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Get knowledge base for context
      const knowledgeEntries = await storage.getActiveKnowledgeBase(req.params.id);
      
      // Get recent verses and content types for full context
      const verseWindow = agent.verseReuseWindow || 10;
      const recentVerses = await storage.getRecentVerseUsages(req.params.id, verseWindow);
      const recentContentTypes = await storage.getRecentContentTypeUsages(req.params.id, 7);
      
      // Assemble the full system prompt
      const assembledPrompt = await assemblePrompt(agent, knowledgeEntries, {
        includeKnowledge: true,
        includeExamples: true,
        includePersonality: true,
        maxKbEntries: 20,
        maxKbTokens: 2000,
        recentVerses,
        recentContentTypes,
      });
      
      // Extract sections from the system prompt for labeling
      const sections: { name: string; content: string; category: string }[] = [];
      const systemPrompt = assembledPrompt.systemPrompt;
      
      // Identify key sections by looking for patterns
      if (systemPrompt.includes("CHARACTER PERSONALITY")) {
        sections.push({ name: "Personality", content: "", category: "voice" });
      }
      if (systemPrompt.includes("KNOWLEDGE BASE")) {
        sections.push({ name: "Knowledge Base", content: "", category: "data" });
      }
      if (systemPrompt.includes("BIBLE VERSE USAGE")) {
        sections.push({ name: "Bible Verse Guidelines", content: "", category: "rules" });
      }
      if (systemPrompt.includes("CONTENT TYPE")) {
        sections.push({ name: "Content Type Selection", content: "", category: "rules" });
      }
      if (systemPrompt.includes("FORMAT CHECKLIST") || systemPrompt.includes("FORMATTING")) {
        sections.push({ name: "Format Rules", content: "", category: "rules" });
      }
      if (systemPrompt.includes("FORBIDDEN") || systemPrompt.includes("DO NOT")) {
        sections.push({ name: "Restrictions", content: "", category: "safety" });
      }
      if (systemPrompt.includes("EXAMPLE")) {
        sections.push({ name: "Examples", content: "", category: "examples" });
      }
      if (systemPrompt.includes("HISTORICAL CONTEXT")) {
        sections.push({ name: "Historical Context", content: "", category: "rules" });
      }
      
      res.json({
        systemPrompt: assembledPrompt.systemPrompt,
        userPrompt: agent.personalityPrompt || "",
        sections,
        metadata: assembledPrompt.metadata,
        kbEntriesCount: knowledgeEntries.length,
        recentVersesCount: recentVerses.length,
        recentContentTypesCount: recentContentTypes.length,
      });
    } catch (error) {
      console.error("Error analyzing prompts:", error);
      res.status(500).json({ error: "Failed to analyze prompts" });
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

  // Update knowledge base entry (only manual entries can be edited)
  app.patch("/api/knowledge/:id", async (req, res) => {
    try {
      // First check if entry exists and is a manual entry
      const existingEntry = await storage.getKnowledgeBaseEntry(req.params.id);
      if (!existingEntry) {
        return res.status(404).json({ error: "Knowledge entry not found" });
      }
      
      // Only allow editing of manually added entries
      if (existingEntry.source !== "manual") {
        return res.status(403).json({ 
          error: "Cannot edit this entry", 
          message: "Only manually added entries can be edited. API-extracted entries are managed by the AI filter prompt."
        });
      }
      
      const partialSchema = insertKnowledgeBaseSchema.partial().omit({ agentId: true });
      const validatedData = partialSchema.parse(req.body);
      const entry = await storage.updateKnowledgeBaseEntry(req.params.id, validatedData);
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating knowledge entry:", error);
      res.status(500).json({ error: "Failed to update knowledge entry" });
    }
  });

  // Update knowledge base entry priority with feedback tracking
  app.patch("/api/knowledge/:id/priority", async (req, res) => {
    try {
      const { priority } = req.body;
      
      if (!priority || !["high", "medium", "low"].includes(priority)) {
        return res.status(400).json({ error: "Invalid priority. Must be high, medium, or low." });
      }
      
      const entry = await storage.updateKnowledgeBasePriority(req.params.id, priority);
      if (!entry) {
        return res.status(404).json({ error: "Knowledge entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error updating knowledge entry priority:", error);
      res.status(500).json({ error: "Failed to update priority" });
    }
  });

  // Get priority corrections for learning
  app.get("/api/agents/:agentId/knowledge/priority-corrections", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const corrections = await storage.getPriorityCorrections(req.params.agentId, limit);
      res.json(corrections);
    } catch (error) {
      console.error("Error fetching priority corrections:", error);
      res.status(500).json({ error: "Failed to fetch priority corrections" });
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

  // Batch deactivate knowledge base entries (toggle active status to false)
  app.post("/api/agents/:agentId/knowledge/batch/deactivate", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required and cannot be empty" });
      }

      // Update entries to set active = false
      let deactivatedCount = 0;
      for (const id of ids) {
        const entry = await storage.getKnowledgeBaseEntry(id);
        if (entry && entry.agentId === agentId && entry.active) {
          await storage.updateKnowledgeBaseEntry(id, { active: false });
          deactivatedCount++;
        }
      }

      if (deactivatedCount === 0) {
        return res.status(404).json({ 
          error: "No entries were deactivated.",
          deactivatedCount: 0
        });
      }

      res.json({
        success: true,
        deactivatedCount,
        message: `Successfully deactivated ${deactivatedCount} knowledge base entries`,
      });
    } catch (error) {
      console.error("Error batch deactivating knowledge entries:", error);
      res.status(500).json({ error: "Failed to deactivate knowledge entries" });
    }
  });

  // Batch delete knowledge base entries
  app.post("/api/agents/:agentId/knowledge/batch/delete", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required and cannot be empty" });
      }

      let deletedCount = 0;
      for (const id of ids) {
        const entry = await storage.getKnowledgeBaseEntry(id);
        if (entry && entry.agentId === agentId) {
          await storage.deleteKnowledgeBaseEntry(id);
          deletedCount++;
        }
      }

      if (deletedCount === 0) {
        return res.status(404).json({ 
          error: "No entries were deleted.",
          deletedCount: 0
        });
      }

      res.json({
        success: true,
        deletedCount,
        message: `Successfully deleted ${deletedCount} knowledge base entries`,
      });
    } catch (error) {
      console.error("Error batch deleting knowledge entries:", error);
      res.status(500).json({ error: "Failed to delete knowledge entries" });
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

  // Apply priority rules to knowledge base entries
  app.post("/api/agents/:agentId/knowledge/apply-priority-rules", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { rule } = req.body;

      if (!rule || typeof rule !== "string") {
        return res.status(400).json({ error: "Priority rule is required" });
      }

      const { applyPriorityRulesForAgent } = await import("./kbRefresh");
      const result = await applyPriorityRulesForAgent(agentId, rule);

      res.json({
        success: true,
        updated: result.updated,
        message: `Updated ${result.updated} knowledge base entry priorities`,
      });
    } catch (error) {
      console.error("Error applying priority rules:", error);
      res.status(500).json({ error: "Failed to apply priority rules" });
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

  // ============= MENTIONS ============= //

  // Get recent mentions for an agent
  app.get("/api/agents/:agentId/mentions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const mentions = await storage.getRecentMentions(req.params.agentId, limit);
      res.json(mentions);
    } catch (error) {
      console.error("Error fetching mentions:", error);
      res.status(500).json({ error: "Failed to fetch mentions" });
    }
  });

  // Get unresponded mentions for an agent
  app.get("/api/agents/:agentId/mentions/unresponded", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const mentions = await storage.getUnrespondedMentions(req.params.agentId, limit);
      res.json(mentions);
    } catch (error) {
      console.error("Error fetching unresponded mentions:", error);
      res.status(500).json({ error: "Failed to fetch unresponded mentions" });
    }
  });

  // Get mention statistics for an agent
  app.get("/api/agents/:agentId/mentions/stats", async (req, res) => {
    try {
      const mentions = await storage.getRecentMentions(req.params.agentId, 100);
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const stats = {
        total: mentions.length,
        responded: mentions.filter(m => m.responded).length,
        unresponded: mentions.filter(m => !m.responded).length,
        failed: mentions.filter(m => !m.responded && m.errorMessage).length,
        repliesLastHour: mentions.filter(m => 
          m.responded && m.processedAt && new Date(m.processedAt) > hourAgo
        ).length,
        repliesLast24h: mentions.filter(m => 
          m.responded && m.processedAt && new Date(m.processedAt) > dayAgo
        ).length,
        avgRetryCount: mentions.filter(m => m.retryCount > 0).length > 0
          ? mentions.reduce((sum, m) => sum + m.retryCount, 0) / mentions.filter(m => m.retryCount > 0).length
          : 0,
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching mention stats:", error);
      res.status(500).json({ error: "Failed to fetch mention stats" });
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
      
      // Use CONVERSATIONAL prompt (not auto-post prompt) for natural dialogue
      const conversationPrompt = await assembleConversationPrompt(agent, knowledgeEntries, {
        includeKnowledge,
        includePersonality: true,
        maxKbEntries: 15,
        maxKbTokens: 1500,
      });
      
      console.log(`[ConversationTest] Using conversational prompt with components: ${conversationPrompt.metadata.componentsIncluded.join(', ')}`);
      
      // Build messages array with conversational prompt
      const messages = buildConversationMessages(
        conversationPrompt,
        conversationHistory,
        message
      );
      
      let response: string;
      
      // Use conversation-specific model if configured, otherwise use default
      const modelProvider = agent.conversationModelProvider || agent.modelProvider || "openai";
      const modelName = agent.conversationModelName || agent.modelName || "gpt-4-turbo-preview";
      const temperature = agent.conversationTemperature !== null ? Number(agent.conversationTemperature) : Number(agent.temperature) || 0.7;
      const maxTokens = agent.conversationMaxTokens || agent.maxTokens || 500;
      
      // Call the appropriate AI provider
      if (modelProvider === "openai") {
        const openai = new OpenAI({ apiKey });
        
        const params = buildOpenAIParams(modelName, {
          model: modelName,
          messages: messages as any,
          temperature,
          max_completion_tokens: maxTokens,
          top_p: Number(agent.topP) || 0.9,
          frequency_penalty: Number(agent.frequencyPenalty) || 0.5,
          presence_penalty: Number(agent.presencePenalty) || 0.5,
        });
        
        const completion = await safeOpenAICall(openai, params);
        
        response = completion.choices[0]?.message?.content || "No response generated";
        
      } else if (modelProvider === "anthropic") {
        const anthropic = new Anthropic({ apiKey });
        
        // Anthropic requires system message separately
        const systemMessage = messages.find(m => m.role === "system");
        const conversationMessages = messages.filter(m => m.role !== "system");
        
        const completion = await anthropic.messages.create({
          model: modelName,
          system: systemMessage?.content || "You are a helpful AI assistant.",
          messages: conversationMessages.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content
          })),
          max_tokens: maxTokens,
          temperature,
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
        modelUsed: `${modelProvider}/${modelName}`,
        promptType: "conversational", // Indicates this uses the conversational prompt, not auto-post
        promptInfo: {
          kbEntriesUsed: conversationPrompt.metadata.kbEntriesUsed,
          componentsIncluded: conversationPrompt.metadata.componentsIncluded,
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

  // Diagnose Twitter credentials - check both POST and GET capabilities
  app.get("/api/agents/:agentId/diagnose/twitter", async (req, res) => {
    try {
      const { agentId } = req.params;
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      // Credential info (safe - only prefixes and lengths)
      const credentialInfo = {
        apiKey: {
          present: !!agent.twitterApiKey,
          length: agent.twitterApiKey?.length || 0,
          prefix: agent.twitterApiKey?.substring(0, 8) || "missing",
        },
        apiSecret: {
          present: !!agent.twitterApiSecret,
          length: agent.twitterApiSecret?.length || 0,
          prefix: agent.twitterApiSecret?.substring(0, 8) || "missing",
        },
        accessToken: {
          present: !!agent.twitterAccessToken,
          length: agent.twitterAccessToken?.length || 0,
          prefix: agent.twitterAccessToken?.substring(0, 12) || "missing",
        },
        accessSecret: {
          present: !!agent.twitterAccessSecret,
          length: agent.twitterAccessSecret?.length || 0,
          prefix: agent.twitterAccessSecret?.substring(0, 8) || "missing",
        },
      };
      
      // Test 1: GET /2/users/me (should work on Free tier)
      let getUserTest = { success: false, error: "", details: "" };
      try {
        const oauth = new OAuth({
          consumer: { key: agent.twitterApiKey!, secret: agent.twitterApiSecret! },
          signature_method: 'HMAC-SHA1',
          hash_function(base_string: string, key: string) {
            return crypto.createHmac('sha1', key).update(base_string).digest('base64');
          },
        });
        const token = { key: agent.twitterAccessToken!, secret: agent.twitterAccessSecret! };
        const requestData = { url: 'https://api.twitter.com/2/users/me', method: 'GET' as const };
        const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
        
        const response = await fetch(requestData.url, {
          method: 'GET',
          headers: { ...authHeader },
        });
        
        if (response.ok) {
          const data = await response.json();
          getUserTest = { success: true, error: "", details: JSON.stringify(data) };
        } else {
          const errorData = await response.json().catch(() => ({}));
          getUserTest = { success: false, error: `HTTP ${response.status}`, details: JSON.stringify(errorData) };
        }
      } catch (e: any) {
        getUserTest = { success: false, error: e.message, details: "" };
      }
      
      res.json({
        agentName: agent.name,
        credentials: credentialInfo,
        tests: {
          getUserMe: getUserTest,
        },
        recommendation: getUserTest.success 
          ? "Credentials are working! GET requests are functional."
          : `GET request failed. Check if: 1) Access Token was regenerated AFTER enabling Read+Write permissions, 2) All 4 credentials are complete (not truncated), 3) No extra spaces in credential values`,
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test Twitter credentials (API or Scraper - versatile endpoint)
  // Accepts credentials from request body (for testing unsaved form values) or falls back to database
  app.post("/api/agents/:agentId/test/twitter", async (req, res) => {
    try {
      const { agentId } = req.params;
      const bodyCredentials = req.body || {};
      
      // Get agent configuration from database
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      // Use request body credentials if provided, otherwise fall back to database
      // This allows testing unsaved form values
      const testCredentials = {
        twitterApiKey: bodyCredentials.twitterApiKey || agent.twitterApiKey,
        twitterApiSecret: bodyCredentials.twitterApiSecret || agent.twitterApiSecret,
        twitterAccessToken: bodyCredentials.twitterAccessToken || agent.twitterAccessToken,
        twitterAccessSecret: bodyCredentials.twitterAccessSecret || agent.twitterAccessSecret,
        twitterUsername: bodyCredentials.twitterUsername || agent.twitterUsername,
        twitterPassword: bodyCredentials.twitterPassword || agent.twitterPassword,
        twitterEmail: bodyCredentials.twitterEmail || agent.twitterEmail,
        twitter2faSecret: bodyCredentials.twitter2faSecret || agent.twitter2faSecret,
        twitterCookies: bodyCredentials.twitterCookies || agent.twitterCookies,
      };
      
      // Check which credentials are available (using merged credentials)
      const hasApiCredentials = testCredentials.twitterApiKey && testCredentials.twitterApiSecret && 
                                testCredentials.twitterAccessToken && testCredentials.twitterAccessSecret;
      const hasScraperCredentials = testCredentials.twitterUsername && testCredentials.twitterPassword;
      const hasCookies = testCredentials.twitterCookies && testCredentials.twitterCookies.trim() !== '';
      
      // If no credential type is present (API, login, or cookies)
      if (!hasApiCredentials && !hasScraperCredentials && !hasCookies) {
        return res.status(400).json({
          success: false,
          error: "No Twitter credentials found",
          details: "Please provide session cookies (recommended), login credentials, OR API credentials",
          hint: "Option 1 (Recommended): Import session cookies from your browser. Option 2: Add Twitter Username and Password. Option 3: Add API credentials for official posting."
        });
      }
      
      const results: any = {
        agentName: agent.name,
        testedAt: new Date().toISOString(),
        api: null,
        scraper: null,
      };
      
      // Test API credentials if present
      if (hasApiCredentials) {
        try {
          const oauth = new OAuth({
            consumer: {
              key: testCredentials.twitterApiKey!,
              secret: testCredentials.twitterApiSecret!,
            },
            signature_method: 'HMAC-SHA1',
            hash_function(base_string: string, key: string) {
              return crypto
                .createHmac('sha1', key)
                .update(base_string)
                .digest('base64');
            },
          });
          
          const token = {
            key: testCredentials.twitterAccessToken!,
            secret: testCredentials.twitterAccessSecret!,
          };
          
          const requestData = {
            url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
            method: 'GET',
          };
          
          const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
          
          const response = await fetch(requestData.url, {
            method: requestData.method,
            headers: {
              ...authHeader,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const userData = await response.json();
            results.api = {
              success: true,
              message: "API credentials valid",
              user: {
                id: userData.id_str,
                name: userData.name,
                username: userData.screen_name,
                followers: userData.followers_count,
              },
              capabilities: ["Posting tweets", "Replying (via API)"]
            };
          } else {
            const errorText = await response.text();
            results.api = {
              success: false,
              error: `HTTP ${response.status}`,
              details: errorText,
              hint: response.status === 401 
                ? "Check API Key, Secret, Access Token, and Access Secret are correct"
                : "API authentication failed"
            };
          }
        } catch (e: any) {
          results.api = {
            success: false,
            error: e.message,
            hint: "Error testing API credentials"
          };
        }
      }
      
      // Test Scraper credentials: First try cookies (most reliable), then fall back to login
      if (hasCookies) {
        // Validate session using cookies - no login attempt (avoids Twitter blocks)
        try {
          const cookieResult = await validateSessionCookies(testCredentials.twitterCookies!, testCredentials.twitterUsername || undefined);
          
          if (cookieResult.usernameRequired) {
            // Session is valid but username is missing - this is a blocking error
            results.scraper = {
              success: false,
              message: "Session cookies valid but username missing",
              method: "cookies",
              error: "Username required - please enter your Twitter username above",
              hint: "Session cookies work, but username is required for mention detection. Enter your Twitter username above and test again.",
              partialSuccess: true,
              canPost: true,
              canDetectMentions: false
            };
          } else if (cookieResult.success && cookieResult.username) {
            // If username was auto-detected and differs from what's stored, persist it
            const detectedUsername = cookieResult.username;
            if (detectedUsername && detectedUsername !== agent.twitterUsername) {
              try {
                await storage.updateAgent(parseInt(agentId), { twitterUsername: detectedUsername });
                console.log(`[Test] Updated agent ${agentId} with detected username: @${detectedUsername}`);
              } catch (e) {
                console.warn(`[Test] Could not persist detected username: ${e}`);
              }
            }
            
            results.scraper = {
              success: true,
              message: "Session cookies valid",
              username: detectedUsername,
              method: "cookies",
              capabilities: ["Detecting mentions", "Detecting comments", "Posting", "Replying"],
              usernameAutoDetected: detectedUsername !== testCredentials.twitterUsername
            };
          } else {
            results.scraper = {
              success: false,
              error: cookieResult.error,
              method: "cookies",
              hint: "Cookies expired or invalid. Export fresh cookies from your browser."
            };
          }
        } catch (e: any) {
          results.scraper = {
            success: false,
            error: e.message,
            method: "cookies",
            hint: "Error validating session cookies"
          };
        }
      } else if (hasScraperCredentials) {
        // Fall back to login credentials (may be blocked by Twitter)
        try {
          // Create a temporary agent-like object with test credentials for scraper verification
          const testAgent = {
            ...agent,
            twitterUsername: testCredentials.twitterUsername,
            twitterPassword: testCredentials.twitterPassword,
            twitterEmail: testCredentials.twitterEmail,
            twitter2faSecret: testCredentials.twitter2faSecret,
            twitterCookies: null, // Force fresh login
          };
          // Force refresh to test new credentials (bypass cache)
          const scraperResult = await verifyScraperCredentials(testAgent as any, true);
          if (scraperResult.success) {
            results.scraper = {
              success: true,
              message: "Login credentials valid",
              username: testCredentials.twitterUsername,
              method: "login",
              capabilities: ["Detecting mentions", "Detecting comments", "Posting (fallback)", "Replying"]
            };
          } else {
            results.scraper = {
              success: false,
              error: scraperResult.error,
              method: "login",
              hint: scraperResult.error?.includes('2fa') || scraperResult.error?.includes('2FA')
                ? "Two-factor authentication required. Add your 2FA secret."
                : scraperResult.error?.includes('locked') || scraperResult.error?.includes('suspended')
                ? "Account may be locked or suspended. Check your Twitter account."
                : scraperResult.error?.includes('page does not exist') || scraperResult.error?.includes('code 34')
                ? "Twitter is blocking automated logins. Use 'Import Session Cookies' below instead."
                : "Check username and password are correct. Email may also be required."
            };
          }
        } catch (e: any) {
          results.scraper = {
            success: false,
            error: e.message,
            method: "login",
            hint: "Error testing login credentials"
          };
        }
      }
      
      // Determine overall success and provide recommendation
      const apiSuccess = results.api?.success === true;
      const scraperSuccess = results.scraper?.success === true;
      const scraperPartialSuccess = (results.scraper as any)?.partialSuccess === true;
      const scraperCanPost = scraperSuccess || scraperPartialSuccess;
      const scraperCanDetectMentions = scraperSuccess; // Only true if username resolved
      
      let recommendation = "";
      if (apiSuccess && scraperSuccess) {
        recommendation = "Both credential types working. API will be used for posting, scraper for mention/comment detection.";
      } else if (apiSuccess && scraperPartialSuccess) {
        recommendation = "API working, cookies valid but username missing. Enter your Twitter username above and test again for mention detection.";
      } else if (apiSuccess && !hasScraperCredentials && !hasCookies) {
        recommendation = "API credentials working. Add Twitter username/password or cookies for free mention and comment detection.";
      } else if (scraperSuccess && !hasApiCredentials) {
        recommendation = "Login credentials working. Scraper will handle posting and replies. For more stable posting, add API credentials.";
      } else if (apiSuccess && !scraperSuccess && !scraperPartialSuccess) {
        recommendation = "API working but login failed. Fix login credentials or import cookies for mention/comment detection.";
      } else if (scraperSuccess && !apiSuccess) {
        recommendation = "Login working but API failed. Scraper will be used for all operations.";
      } else if (scraperPartialSuccess && !apiSuccess) {
        recommendation = "Cookies valid but username required. Enter your Twitter username above to enable mention detection.";
      } else {
        recommendation = "Both credential types failed. Please check your credentials.";
      }
      
      // Overall success requires at least one working credential AND username resolved for scraper
      // If using cookies and username is not provided/detected, that's a blocking error
      const overallSuccess = (apiSuccess && scraperSuccess) || // Both work = full success
                             (apiSuccess && !hasCookies && !hasScraperCredentials) || // API only, no scraper attempted
                             (scraperSuccess && !hasApiCredentials) || // Scraper only (with username)
                             (apiSuccess && scraperSuccess); // Both work
      
      // If only partial success (cookies work but no username), overall should be false
      const hasUsernameBlocker = scraperPartialSuccess && !scraperSuccess;
      
      res.json({
        success: overallSuccess && !hasUsernameBlocker,
        usernameRequired: hasUsernameBlocker,
        ...results,
        recommendation,
        summary: {
          canPost: apiSuccess || scraperCanPost,
          canDetectMentions: scraperCanDetectMentions,
          canDetectComments: scraperCanDetectMentions,
          preferredPostMethod: apiSuccess ? "API" : (scraperCanPost ? "Scraper" : "None"),
          usernameRequired: hasUsernameBlocker
        }
      });
      
    } catch (error: any) {
      console.error("Error testing Twitter credentials:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to test Twitter credentials",
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

  // Helper function to evaluate news relevance and priority using AI
  // Now includes learning from user priority corrections
  async function evaluateRelevance(
    title: string, 
    content: string, 
    customFilterPrompt?: string,
    agentId?: string
  ): Promise<{ 
    isRelevant: boolean; 
    relevanceScore: number;
    priority: "high" | "medium" | "low";
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

      // Fetch user priority corrections for learning (if agentId provided)
      let learningExamples = "";
      if (agentId) {
        try {
          const corrections = await storage.getPriorityCorrections(agentId, 10);
          if (corrections.length > 0) {
            learningExamples = `
IMPORTANT: Learn from the user's past priority corrections. They have adjusted these entries:
${corrections.slice(0, 5).map((c, i) => 
  `${i + 1}. "${c.title.substring(0, 80)}..." (Category: ${c.category})
   AI assigned: ${c.originalPriority} → User corrected to: ${c.priority}`
).join('\n')}

Use these corrections to better understand the user's priority preferences for similar content.
`;
          }
        } catch (err) {
          console.log("Could not fetch priority corrections for learning:", err);
        }
      }

      // Use custom filter prompt if provided, otherwise use default
      const basePrompt = customFilterPrompt 
        ? `You are a content relevance filter for a Twitter AI agent.

Evaluate this news item based on the following custom criteria:
${customFilterPrompt}
${learningExamples}
News item:
Title: ${title}
Content: ${content.substring(0, 1000)}

Based on the criteria above:
1. Rate the content's relevance (0.0 to 1.0)
2. Assign a priority tag: "high" (breaking news, urgent, highly actionable), "medium" (interesting, worth posting), or "low" (general info, backup content)`
        : `You are a content relevance filter for a Twitter AI agent focused on crypto, tech, and Twitter/social media topics.
${learningExamples}
Evaluate this news item for relevance:
Title: ${title}
Content: ${content.substring(0, 1000)}

Rate the content's relevance (0.0 to 1.0) to audiences interested in:
- Cryptocurrency, blockchain, DeFi, NFTs, Web3
- Technology, AI, software development, startups
- Twitter/X, social media trends, digital culture

Also assign a priority tag: "high" (breaking news, urgent, highly actionable), "medium" (interesting, worth posting), or "low" (general info, backup content)`;

      const prompt = `${basePrompt}

Scoring guide:
- 0.0-0.3: Not relevant or off-topic
- 0.4-0.5: Marginally relevant
- 0.6-0.7: Relevant (auto-approve threshold)
- 0.8-1.0: Highly relevant

Priority guide:
- "high": Breaking news, major announcements, time-sensitive, highly engaging
- "medium": Standard relevant content, interesting insights, good for regular posting
- "low": General information, filler content, low urgency

Respond in JSON format:
{
  "relevanceScore": 0.75,
  "priority": "medium",
  "topics": ["topic1", "topic2"],
  "reason": "brief explanation of score and priority"
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
      
      // Get priority from AI response, default based on relevance if not provided
      const priority: "high" | "medium" | "low" = 
        result.priority === "high" || result.priority === "medium" || result.priority === "low"
          ? result.priority
          : relevanceScore >= 0.8 ? "high" : relevanceScore >= 0.6 ? "medium" : "low";
      
      return {
        isRelevant,
        relevanceScore,
        priority,
        topics: result.topics || [],
        reason: result.reason || `Score: ${relevanceScore.toFixed(2)}, Priority: ${priority}`
      };
    } catch (error) {
      console.error("AI relevance evaluation failed:", error);
      // Default to manual review if AI fails
      return { 
        isRelevant: false, 
        relevanceScore: 0.0,
        priority: "low",
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
        // Pass agentId to enable learning from user's priority corrections
        const relevanceEval = await evaluateRelevance(title, content, customApi.filterPrompt || undefined, agentId);
        
        // Auto-approve if relevant, otherwise keep as pending for manual review
        const isAutoApproved = relevanceEval.isRelevant;
        const tags = [
          "auto-generated",
          "api-ingestion",
          ...relevanceEval.topics,
          isAutoApproved ? "ai-approved" : "ai-review-required",
          `priority-${relevanceEval.priority}` // Tag with priority for easy filtering
        ];
        
        const entryData = {
          title: title.substring(0, 500),
          content: content.substring(0, 10000),
          tags,
          source: customApi.name,
          sourceId: sourceId,
          sourceUrl: customApi.baseUrl,
          category: "news",
          priority: relevanceEval.priority, // AI-determined priority (high/medium/low)
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
      const startTime = Date.now();
      const auditLog: any = {
        timestamp: new Date().toISOString(),
        agentId,
        promptMode: prompt ? "custom" : "auto-generated",
      };
      
      if (!agentId) {
        return res.status(400).json({ error: "Agent ID required" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      auditLog.agentName = agent.name;
      console.log(`[TWEET TEST] Starting for agent: ${agent.name} (${agentId})`);

      // Get active knowledge entries
      const knowledgeEntries = await storage.getActiveKnowledgeBase(agentId);
      auditLog.totalAvailableKBEntries = knowledgeEntries.length;
      console.log(`[TWEET TEST] Found ${knowledgeEntries.length} available KB entries`);
      
      // Get recent verse usages for avoidance (based on agent's verse window setting)
      const verseWindow = agent.verseReuseWindow || 10;
      const recentVerses = await storage.getRecentVerseUsages(agentId, verseWindow);
      auditLog.recentVersesAvoidance = {
        window: verseWindow,
        versesInWindow: recentVerses.length,
        verses: recentVerses.map(v => v.verseRef),
        reusePolicy: agent.verseReusePolicy || "avoid_recent",
      };
      console.log(`[TWEET TEST] Bible verse avoidance: ${recentVerses.length} recent verses to avoid`);
      
      // SERVER-SIDE CONTENT TYPE SELECTION (critical for proper rotation)
      const recentContentTypes = await storage.getRecentContentTypeUsages(agentId, 7);
      const hasKnowledgeBase = knowledgeEntries.length > 0;
      const rotationPolicy = ((agent as any).contentTypeReusePolicy || "rotate_all") as "rotate_all" | "avoid_last" | "allow";
      
      // Select next content type based on rotation history
      const selectedContentType = selectNextContentType(recentContentTypes, hasKnowledgeBase, rotationPolicy);
      
      auditLog.contentTypeSelection = {
        recentTypes: recentContentTypes.map(ct => ct.contentType),
        hasKB: hasKnowledgeBase,
        rotationPolicy,
        selectedType: selectedContentType,
        selectedTypeLabel: formatContentType(selectedContentType),
      };
      console.log(`[TWEET TEST] Content type rotation: Selected "${formatContentType(selectedContentType)}" (recent: ${recentContentTypes.map(ct => ct.contentType).join(", ") || "none"})`);
      
      // Assemble prompt with KB entries, verse avoidance, and SERVER-SELECTED content type
      const assembledPrompt = await assemblePrompt(agent, knowledgeEntries, {
        includeKnowledge: true,
        includeExamples: true,
        includePersonality: true,
        maxKbEntries: 20,
        maxKbTokens: 2000,
        recentVerses,
        recentContentTypes,
        selectedContentType, // CRITICAL: Pass server-selected type
      });
      
      const kbUsedIds = assembledPrompt.metadata.kbEntriesUsedIds || [];
      auditLog.kbEntriesSelected = {
        count: assembledPrompt.metadata.kbEntriesUsed,
        ids: kbUsedIds,
        details: knowledgeEntries
          .filter(kb => kbUsedIds.includes(kb.id))
          .map(kb => ({
            id: kb.id,
            title: kb.title,
            category: kb.category,
            priority: kb.priority,
            source: kb.source,
          })),
      };
      auditLog.promptComponents = assembledPrompt.metadata.componentsIncluded;
      console.log(`[TWEET TEST] KB entries selected: ${assembledPrompt.metadata.kbEntriesUsed}`);
      console.log(`[TWEET TEST] Prompt components: ${assembledPrompt.metadata.componentsIncluded.join(", ")}`);
      
      // Simplified prompt - content type is already selected server-side
      const selectedTypeLabel = formatContentType(selectedContentType);
      const needsKB = selectedContentType === "EVENT_BASED" || selectedContentType === "CULTURAL_INSIGHT";
      
      const defaultPrompt = `Generate a "${selectedTypeLabel}" post.

CRITICAL FORMAT REQUIREMENTS:
1. Use BLANK LINES between paragraphs for easy reading
2. Match the EXACT structure from the example above
3. Keep paragraphs SHORT (2-3 sentences max)
4. ${needsKB ? "Reference the Knowledge Base content provided" : "Draw from Scripture and spiritual wisdom"}

BIBLE VERSE REQUIREMENT:
- When quoting Scripture, include brief HISTORICAL CONTEXT
- Example: "Paul wrote to the Corinthians during a time when..."
- Explain who wrote it, to whom, and why it matters

DO NOT:
- Write one long cramped paragraph
- Use em dashes or smart quotes
- Add hashtags or decorations

OUTPUT: Write ONLY the tweet content with proper spacing.`;
      const tweetPrompt = prompt || defaultPrompt;
      auditLog.prompt = tweetPrompt;
      console.log(`[TWEET TEST] Using ${prompt ? "custom" : "default"} prompt`);
      
      // Build messages for AI model
      const messages = buildMessagesArray(
        assembledPrompt,
        conversationHistory || [],
        tweetPrompt
      );
      
      auditLog.systemPrompt = assembledPrompt.systemPrompt;
      auditLog.messagesCount = messages.length;
      console.log(`[TWEET TEST] System prompt assembled with ${messages.length} total messages`);

      let tweet = "";
      
      // Use post-specific model if configured, otherwise use default
      const postModelProvider = agent.postModelProvider || agent.modelProvider || "openai";
      const postModelName = agent.postModelName || agent.modelName || "gpt-4-turbo-preview";
      // Lower temperature (0.2) for highly deterministic output that closely follows message examples
      const postTemperature = agent.postTemperature !== null ? Number(agent.postTemperature) : Number(agent.temperature) || 0.2;
      // Increased max_tokens to 600 for thorough content generation
      const postMaxTokens = agent.postMaxTokens || 600;
      
      auditLog.modelConfig = {
        provider: postModelProvider,
        model: postModelName,
        temperature: postTemperature,
        maxTokens: postMaxTokens,
      };
      console.log(`[TWEET TEST] Model config: ${postModelProvider}/${postModelName} (temp: ${postTemperature}, max: ${postMaxTokens})`);
      
      // Call appropriate AI model
      if (postModelProvider === "openai") {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
        });
        
        const params = buildOpenAIParams(postModelName, {
          model: postModelName,
          messages: messages as any,
          temperature: postTemperature,
          max_completion_tokens: postMaxTokens,
        });
        
        const completion = await safeOpenAICall(openai, params);
        
        tweet = completion.choices[0]?.message?.content || "No tweet generated";
        
      } else if (postModelProvider === "anthropic") {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        const systemMessage = messages.find(m => m.role === "system");
        const userMessages = messages.filter(m => m.role !== "system");
        
        const completion = await anthropic.messages.create({
          model: postModelName,
          system: systemMessage?.content || "You are a helpful AI assistant.",
          messages: userMessages.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content
          })),
          max_tokens: postMaxTokens,
          temperature: postTemperature,
        });
        
        const textContent = completion.content.find((c) => c.type === "text") as any;
        tweet = textContent?.text || "No tweet generated";
      } else {
        return res.status(400).json({ error: `Unsupported model provider: ${agent.modelProvider}` });
      }

      const generationTime = Date.now() - startTime;
      console.log(`[TWEET TEST] Generation took ${generationTime}ms`);
      console.log(`[TWEET TEST] Raw output (before cleanup): ${tweet.substring(0, 100)}...`);
      
      // Content type is already known from server-side selection
      // Detect only for verification/logging purposes
      const detectedContentType = detectContentType(tweet);
      const actualContentType = selectedContentType; // Use server-selected type for tracking
      auditLog.contentTypeDetected = detectedContentType;
      auditLog.contentTypeUsed = actualContentType;
      console.log(`[TWEET TEST] Content type: selected=${actualContentType}, detected=${detectedContentType}`);
      
      // Strip content type labels from generated content (labels are for detection, not output)
      tweet = stripContentTypeLabels(tweet);
      // Clean special characters (em dashes, smart quotes)
      tweet = cleanSpecialCharacters(tweet);
      auditLog.finalTweetLength = tweet.length;
      auditLog.generationTimeMs = generationTime;
      console.log(`[TWEET TEST] Final tweet (${tweet.length} chars): ${tweet}`);
      
      // LOG CONTENT TYPE USAGE for rotation tracking (CRITICAL for rotation to work)
      try {
        const tweetId = `tweet_test_${Date.now()}`;
        await storage.logContentTypeUsage(agentId, actualContentType, tweetId);
        console.log(`[TWEET TEST] Logged content type usage: ${actualContentType}`);
        auditLog.contentTypeLogged = true;
      } catch (err) {
        console.error(`[TWEET TEST] Failed to log content type usage:`, err);
        auditLog.contentTypeLogged = false;
      }

      // Get active KB entries for logging using the IDs from prompt assembly
      const kbSources = knowledgeEntries
        .filter(kb => kbUsedIds.includes(kb.id))
        .map(entry => ({
          id: entry.id,
          title: entry.title,
          source: entry.source,
          category: entry.category,
          priority: entry.priority
        }));

      // Mark KB entries as used (prevent reuse based on agent's kbReusePolicy)
      if (kbUsedIds.length > 0) {
        const tweetId = `tweet_${Date.now()}`;
        for (const kbId of kbUsedIds) {
          try {
            await db.update(knowledgeBase)
              .set({
                usedAt: new Date(),
                usedCount: sql`COALESCE(${knowledgeBase.usedCount}, 0) + 1`,
                usedInTweetIds: sql`COALESCE(${knowledgeBase.usedInTweetIds}, '[]'::jsonb) || ${JSON.stringify([tweetId])}::jsonb`,
              })
              .where(eq(knowledgeBase.id, kbId));
          } catch (err) {
            console.error(`Failed to mark KB entry ${kbId} as used:`, err);
          }
        }
        console.log(`[TWEET TEST] Marked ${kbUsedIds.length} KB entries as used for reuse tracking`);
      }

      // Send webhook notification for successful tweet generation
      if (agent.webhookEnabled && agent.webhookUrl) {
        sendPostCreatedWebhook(agent, tweet, undefined, {
          mode: prompt ? "prompted" : "auto-generated",
          kbEntriesUsed: assembledPrompt.metadata.kbEntriesUsed,
          kbSources: kbSources.map(kb => kb.title),
        }).catch(err => console.error("Webhook error:", err));
      }

      console.log(`[TWEET TEST] COMPLETE - Success`);
      console.log(`[TWEET TEST] Full audit log:`, JSON.stringify(auditLog, null, 2));

      res.json({
        success: true,
        tweet,
        contentType: actualContentType, // Server-selected content type
        contentTypeLabel: formatContentType(actualContentType),
        mode: prompt ? "prompted" : "auto-generated",
        kbEntriesCount: assembledPrompt.metadata.kbEntriesUsed,
        kbSources,
        kbMarkedAsUsed: kbUsedIds.length,
        generationTimeMs: generationTime,
        config: {
          provider: postModelProvider,
          model: postModelName,
          temperature: postTemperature,
          maxTokens: postMaxTokens,
        },
        // Comprehensive audit log for debugging
        audit: auditLog,
      });
    } catch (error: any) {
      console.error("Error testing tweet generation:", error);
      
      // Send webhook notification for failed tweet generation
      try {
        const agent = await storage.getAgent(req.body.agentId);
        if (agent?.webhookEnabled && agent?.webhookUrl) {
          sendPostFailedWebhook(agent, error.message, req.body.prompt).catch(err => 
            console.error("Webhook error:", err)
          );
        }
      } catch (webhookErr) {
        console.error("Failed to send error webhook:", webhookErr);
      }
      
      res.status(500).json({ 
        error: "Failed to test tweet generation",
        details: error.message 
      });
    }
  });

  // Test webhook endpoint
  app.post("/api/agents/:id/test-webhook", async (req, res) => {
    try {
      const { id } = req.params;
      const { webhookUrl, webhookSecret } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({ error: "Webhook URL is required" });
      }

      const { testWebhookConnection } = await import("./webhook");
      const result = await testWebhookConnection(webhookUrl, webhookSecret);

      if (result.success) {
        res.json({
          success: true,
          message: "Webhook test successful",
          statusCode: result.statusCode,
          responseTime: result.responseTime,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          statusCode: result.statusCode,
          responseTime: result.responseTime,
        });
      }
    } catch (error: any) {
      console.error("Error testing webhook:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to test webhook",
      });
    }
  });

  // ============= TWITTER POSTING ============= //
  
  // Force Generate & Post - generates tweet and posts to Twitter in one action
  app.post("/api/agents/:id/force-post", async (req, res) => {
    try {
      const { id } = req.params;
      
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const { postTweet, validateTwitterCredentials } = await import("./twitter");
      
      // Validate Twitter credentials
      const validation = validateTwitterCredentials(agent);
      if (!validation.valid) {
        return res.status(400).json({
          error: "Missing Twitter credentials",
          missing: validation.missing,
        });
      }
      
      // Get active KB entries
      const knowledgeEntries = await storage.getActiveKnowledgeBase(id);
      
      // Get recent verse usages for avoidance (based on agent's verse window setting)
      const verseWindow = agent.verseReuseWindow || 10;
      const recentVerses = await storage.getRecentVerseUsages(id, verseWindow);
      
      // Assemble prompt and generate tweet (with verse avoidance)
      const assembledPrompt = await assemblePrompt(agent, knowledgeEntries, {
        includeKnowledge: true,
        includeExamples: true,
        includePersonality: true,
        maxKbEntries: 20,
        maxKbTokens: 2000,
        recentVerses,
      });
      
      const tweetPrompt = `Generate a single post following these critical rules:

FORMAT REQUIREMENTS:
1. Use BLANK LINES between paragraphs for easy reading
2. Match the EXACT structure from the message examples
3. Keep paragraphs SHORT (2-3 sentences max)

CONTENT REQUIREMENTS:
1. For Event-based or Cultural posts: USE Knowledge Base content
2. For other types: Draw from Scripture and spiritual wisdom
3. AVOID recently used Bible verses (see guidelines)

BIBLE VERSE REQUIREMENT:
- Include brief HISTORICAL CONTEXT when quoting Scripture
- Explain who wrote it, to whom, and why

DO NOT write one long paragraph - use proper spacing!`;
      const messages = buildMessagesArray(assembledPrompt, [], tweetPrompt);
      
      const postModelProvider = agent.postModelProvider || agent.modelProvider || "openai";
      const postModelName = agent.postModelName || agent.modelName || "gpt-4-turbo-preview";
      // Lower temperature (0.2) for highly deterministic output that closely follows message examples
      const postTemperature = agent.postTemperature !== null ? Number(agent.postTemperature) : Number(agent.temperature) || 0.2;
      // Increased max_tokens to 600 for thorough content generation
      const postMaxTokens = agent.postMaxTokens || 600;
      
      let tweetContent = "";
      
      if (postModelProvider === "openai") {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
        
        // Use same wrapper functions as test-tweet for consistency
        const params = buildOpenAIParams(postModelName, {
          model: postModelName,
          messages: messages as any,
          temperature: postTemperature,
          max_completion_tokens: postMaxTokens,
        });
        
        const completion = await safeOpenAICall(openai, params);
        
        tweetContent = completion.choices[0]?.message?.content || "";
      } else if (postModelProvider === "anthropic") {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        const systemMessage = messages.find((m) => m.role === "system");
        const userMessages = messages.filter((m) => m.role !== "system");
        
        const completion = await anthropic.messages.create({
          model: postModelName,
          system: systemMessage?.content || "You are a helpful AI assistant.",
          messages: userMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          max_tokens: postMaxTokens,
          temperature: postTemperature,
        });
        
        const textContent = completion.content.find((c) => c.type === "text") as any;
        tweetContent = textContent?.text || "";
      }
      
      if (!tweetContent.trim()) {
        return res.status(500).json({ error: "Failed to generate tweet content" });
      }
      
      // Detect content type BEFORE stripping labels (for accurate tracking)
      const detectedContentType = (agent as any).contentTypeTrackingEnabled !== false 
        ? detectContentType(tweetContent) 
        : null;
      
      // Strip content type labels from generated content (labels are for detection, not output)
      tweetContent = stripContentTypeLabels(tweetContent);
      // Clean special characters (em dashes, smart quotes)
      tweetContent = cleanSpecialCharacters(tweetContent);
      
      // Post to Twitter
      const result = await postTweet(agent, tweetContent);
      
      // Mark KB entries as used
      const kbUsedIds = assembledPrompt.metadata.kbEntriesUsedIds || [];
      if (kbUsedIds.length > 0 && result.success && result.tweetId) {
        await storage.markKnowledgeBaseAsUsed(kbUsedIds, result.tweetId);
      }
      
      // Extract and log Bible verses from the tweet (if verse tracking enabled)
      if (result.success && result.tweetId && agent.verseTrackingEnabled !== false) {
        const { extractVerses } = await import("./verseExtractor");
        const detectedVerses = extractVerses(tweetContent);
        for (const verse of detectedVerses) {
          await storage.logVerseUsage(
            id,
            verse.verseRef,
            verse.book,
            verse.chapter,
            verse.verseStart,
            verse.verseEnd,
            result.tweetId
          );
        }
      }
      
      // Log detected content type
      if (result.success && result.tweetId && detectedContentType) {
        await storage.logContentTypeUsage(id, detectedContentType, result.tweetId);
      }
      
      // Log activity
      await storage.createActivityLog({
        agentId: id,
        eventType: "post",
        status: result.success ? "success" : "failed",
        tweetId: result.tweetId,
        content: tweetContent,
        characterCount: tweetContent.length,
        modelProvider: postModelProvider,
        modelName: postModelName,
        kbEntriesUsed: kbUsedIds,
        errorMessage: result.error,
        errorCode: result.errorCode,
        postedAt: result.success ? new Date() : undefined,
      });
      
      if (result.success) {
        if (agent.webhookEnabled && agent.webhookUrl) {
          sendPostCreatedWebhook(agent, tweetContent, result.tweetId).catch(err =>
            console.error("Webhook error:", err)
          );
        }
        
        res.json({
          success: true,
          tweet: tweetContent,
          contentType: detectedContentType,
          tweetId: result.tweetId,
          tweetUrl: `https://twitter.com/i/status/${result.tweetId}`,
          kbEntriesUsed: kbUsedIds.length,
          message: "Tweet generated and posted successfully",
        });
      } else {
        if (agent.webhookEnabled && agent.webhookUrl) {
          sendPostFailedWebhook(agent, result.error || "Unknown error", tweetContent).catch(err =>
            console.error("Webhook error:", err)
          );
        }
        
        res.status(400).json({
          success: false,
          tweet: tweetContent,
          error: result.error,
          errorCode: result.errorCode,
          rateLimited: result.rateLimited,
        });
      }
    } catch (error: any) {
      console.error("Error in force-post:", error);
      res.status(500).json({
        error: "Failed to generate and post tweet",
        details: error.message,
      });
    }
  });
  
  // Post tweet directly to Twitter
  app.post("/api/agents/:id/post-tweet", async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Tweet content is required" });
      }
      
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const { postTweet, validateTwitterCredentials } = await import("./twitter");
      
      const validation = validateTwitterCredentials(agent);
      if (!validation.valid) {
        return res.status(400).json({
          error: "Missing Twitter credentials",
          missing: validation.missing,
        });
      }
      
      const result = await postTweet(agent, content);
      
      // Extract and log Bible verses from the tweet (if verse tracking enabled)
      if (result.success && result.tweetId && agent.verseTrackingEnabled !== false) {
        const { extractVerses } = await import("./verseExtractor");
        const detectedVerses = extractVerses(content);
        for (const verse of detectedVerses) {
          await storage.logVerseUsage(
            id,
            verse.verseRef,
            verse.book,
            verse.chapter,
            verse.verseStart,
            verse.verseEnd,
            result.tweetId
          );
        }
      }
      
      // Log the activity
      await storage.createActivityLog({
        agentId: id,
        eventType: "post",
        status: result.success ? "success" : "failed",
        tweetId: result.tweetId,
        content,
        characterCount: content.length,
        modelProvider: agent.postModelProvider || agent.modelProvider,
        modelName: agent.postModelName || agent.modelName,
        errorMessage: result.error,
        errorCode: result.errorCode,
        postedAt: result.success ? new Date() : undefined,
      });
      
      if (result.success) {
        // Send webhook notification
        if (agent.webhookEnabled && agent.webhookUrl) {
          sendPostCreatedWebhook(agent, content, result.tweetId).catch(err =>
            console.error("Webhook error:", err)
          );
        }
        
        res.json({
          success: true,
          tweetId: result.tweetId,
          message: "Tweet posted successfully",
          tweetUrl: `https://twitter.com/i/status/${result.tweetId}`,
        });
      } else {
        if (agent.webhookEnabled && agent.webhookUrl) {
          sendPostFailedWebhook(agent, result.error || "Unknown error", content).catch(err =>
            console.error("Webhook error:", err)
          );
        }
        
        res.status(400).json({
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          rateLimited: result.rateLimited,
        });
      }
    } catch (error: any) {
      console.error("Error posting tweet:", error);
      res.status(500).json({
        error: "Failed to post tweet",
        details: error.message,
      });
    }
  });

  // ============= SCHEDULER CONTROL ============= //
  
  // Start agent scheduler
  app.post("/api/agents/:id/scheduler/start", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const { startAgent, isAgentRunning } = await import("./scheduler");
      
      if (isAgentRunning(agent.id)) {
        return res.json({ success: true, message: "Agent is already running" });
      }
      
      // Update agent status to active
      await storage.updateAgentStatus(agent.id, "active");
      startAgent(agent);
      
      res.json({
        success: true,
        message: `Agent ${agent.name} started`,
        status: "active",
      });
    } catch (error: any) {
      console.error("Error starting agent scheduler:", error);
      res.status(500).json({ error: "Failed to start agent", details: error.message });
    }
  });
  
  // Stop agent scheduler
  app.post("/api/agents/:id/scheduler/stop", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const { stopAgent, isAgentRunning } = await import("./scheduler");
      
      // Update agent status to inactive
      await storage.updateAgentStatus(agent.id, "inactive");
      stopAgent(agent.id);
      
      res.json({
        success: true,
        message: `Agent ${agent.name} stopped`,
        status: "inactive",
      });
    } catch (error: any) {
      console.error("Error stopping agent scheduler:", error);
      res.status(500).json({ error: "Failed to stop agent", details: error.message });
    }
  });
  
  // Get scheduler status
  app.get("/api/scheduler/status", async (req, res) => {
    try {
      const { getSchedulerStatus } = await import("./scheduler");
      const status = getSchedulerStatus();
      res.json(status);
    } catch (error: any) {
      console.error("Error getting scheduler status:", error);
      res.status(500).json({ error: "Failed to get scheduler status" });
    }
  });

  // ============= ACTIVITY LOGS ============= //
  
  // Get all activity logs
  app.get("/api/activity-logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const agentId = req.query.agentId as string | undefined;
      
      const logs = await storage.getActivityLogs(agentId, limit);
      
      // Enrich logs with agent names
      const agents = await storage.getAllAgents();
      const agentMap = new Map(agents.map(a => [a.id, a.name]));
      
      const enrichedLogs = logs.map(log => ({
        ...log,
        agentName: agentMap.get(log.agentId) || "Unknown Agent",
      }));
      
      res.json(enrichedLogs);
    } catch (error: any) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // Get activity logs for specific agent
  app.get("/api/agents/:id/activity-logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getActivityLogs(req.params.id, limit);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching agent activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // Initialize scheduler on server start
  (async () => {
    try {
      const { initializeScheduler } = await import("./scheduler");
      await initializeScheduler();
    } catch (error) {
      console.error("Failed to initialize scheduler:", error);
    }
  })();

  const httpServer = createServer(app);
  return httpServer;
}
