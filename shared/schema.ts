import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Agents table - comprehensive Twitter AI agent configuration
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic info
  name: text("name").notNull(),
  username: text("username").notNull(),
  bio: text("bio").notNull(),
  status: text("status").notNull().default("draft"), // draft, testing, deployed, paused
  
  // Twitter API credentials (encrypted in production)
  twitterApiKey: text("twitter_api_key"),
  twitterApiSecret: text("twitter_api_secret"),
  twitterAccessToken: text("twitter_access_token"),
  twitterAccessSecret: text("twitter_access_secret"),
  twitterBearerToken: text("twitter_bearer_token"),
  twitterAppId: text("twitter_app_id"),
  
  // Character & Prompts
  systemPrompt: text("system_prompt").notNull(),
  personalityPrompt: text("personality_prompt").notNull(),
  postStyle: text("post_style"),
  topics: text("topics"),
  adjectives: text("adjectives"),
  messageExamples: jsonb("message_examples").$type<string[]>().default(sql`'[]'`),
  
  // Custom prompts (layered on top of ElizaOS)
  customPrompts: jsonb("custom_prompts").$type<Record<string, string>>().default(sql`'{}'`),
  
  // AI Model configuration
  modelProvider: text("model_provider").notNull().default("openai"),
  modelName: text("model_name").notNull().default("gpt-4-turbo-preview"),
  modelApiKey: text("model_api_key"),
  temperature: text("temperature").default("0.7"),
  maxTokens: integer("max_tokens").default(500),
  topP: text("top_p").default("0.9"),
  frequencyPenalty: text("frequency_penalty").default("0.5"),
  presencePenalty: text("presence_penalty").default("0.5"),
  contextWindow: integer("context_window").default(8000),
  
  // Posting behavior
  postingEnabled: boolean("posting_enabled").default(true),
  postFrequency: integer("post_frequency").default(2), // in minutes/hours based on postInterval
  postInterval: text("post_interval").default("hours"), // minutes, hours
  maxPostsPerDay: integer("max_posts_per_day").default(12),
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
  quietHoursStart: text("quiet_hours_start").default("22:00"),
  quietHoursEnd: text("quiet_hours_end").default("08:00"),
  timezone: text("timezone").default("UTC"),
  
  // Reply behavior
  replyEnabled: boolean("reply_enabled").default(true),
  replyRate: integer("reply_rate").default(70), // percentage
  replyDelay: integer("reply_delay").default(30), // seconds
  maxRepliesPerHour: integer("max_replies_per_hour").default(10),
  onlyReplyVerified: boolean("only_reply_verified").default(false),
  replyKeywords: text("reply_keywords"),
  ignoreKeywords: text("ignore_keywords"),
  
  // Content modules
  cryptoCommentary: boolean("crypto_commentary").default(true),
  marketAnalysis: boolean("market_analysis").default(true),
  newsCommentary: boolean("news_commentary").default(true),
  technicalAnalysis: boolean("technical_analysis").default(false),
  threads: boolean("threads").default(true),
  memes: boolean("memes").default(false),
  
  // Triggers
  priceChangeThreshold: integer("price_change_threshold").default(5),
  volumeChangeThreshold: integer("volume_change_threshold").default(50),
  autoTweetOnNews: boolean("auto_tweet_on_news").default(true),
  minNewsSentiment: text("min_news_sentiment").default("0.6"),
  
  // Safety & Production controls
  dryRunMode: boolean("dry_run_mode").default(true), // TEST before deploying
  rateLimitPerHour: integer("rate_limit_per_hour").default(20),
  contentFilterEnabled: boolean("content_filter_enabled").default(true),
  requireApproval: boolean("require_approval").default(false),
  webhookUrl: text("webhook_url"), // for monitoring/alerts
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastDeployedAt: timestamp("last_deployed_at"),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastDeployedAt: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Knowledge Base entries (per-agent)
export const knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;

// Custom API configurations (global, shared across agents)
export const customApis = pgTable("custom_apis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  baseUrl: text("base_url").notNull(),
  method: text("method").notNull().default("GET"),
  headers: jsonb("headers").$type<Record<string, string>>().default(sql`'{}'`),
  authType: text("auth_type").default("none"), // none, bearer, api_key, oauth2
  authToken: text("auth_token"),
  jsonPath: text("json_path"), // for data extraction
  refreshInterval: integer("refresh_interval").default(60), // minutes
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomApiSchema = createInsertSchema(customApis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomApi = z.infer<typeof insertCustomApiSchema>;
export type CustomApi = typeof customApis.$inferSelect;

// API Keys (global, shared model provider keys)
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(), // openai, anthropic, groq, etc.
  apiKey: text("api_key").notNull(),
  label: text("label"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
