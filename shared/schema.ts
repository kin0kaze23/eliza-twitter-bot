import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, boolean, integer, timestamp, real } from "drizzle-orm/pg-core";
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
  bio: text("bio"),
  status: text("status").notNull().default("draft"), // draft, testing, deployed, paused
  
  // Twitter API credentials (encrypted in production)
  // OAuth 1.0a (for automated bots/agents)
  twitterApiKey: text("twitter_api_key"),
  twitterApiSecret: text("twitter_api_secret"),
  twitterAccessToken: text("twitter_access_token"),
  twitterAccessSecret: text("twitter_access_secret"),
  twitterBearerToken: text("twitter_bearer_token"),
  twitterAppId: text("twitter_app_id"),
  
  // OAuth 2.0 (for user authorization flows)
  twitterOAuthClientId: text("twitter_oauth_client_id"),
  twitterOAuthClientSecret: text("twitter_oauth_client_secret"),
  
  // Character & Prompts
  systemPrompt: text("system_prompt"),
  personalityPrompt: text("personality_prompt"),
  postStyle: text("post_style"),
  topics: text("topics"),
  adjectives: text("adjectives"),
  messageExamples: jsonb("message_examples").$type<string[]>().default(sql`'[]'`),
  
  // Custom prompts (layered on top of ElizaOS)
  customPrompts: jsonb("custom_prompts").$type<Record<string, string>>().default(sql`'{}'`),
  
  // AI Model configuration (default/fallback)
  modelProvider: text("model_provider").default("openai"),
  modelName: text("model_name").default("gpt-4-turbo-preview"),
  modelFamily: text("model_family").default("gpt-4"), // gpt-4, gpt-5, claude-3, claude-4
  autoDetectLatest: boolean("auto_detect_latest").default(true), // auto-use latest in family
  modelApiKey: text("model_api_key"),
  temperature: real("temperature").default(0.7),
  maxTokens: integer("max_tokens").default(500),
  topP: real("top_p").default(0.9),
  frequencyPenalty: real("frequency_penalty").default(0.5),
  presencePenalty: real("presence_penalty").default(0.5),
  contextWindow: integer("context_window").default(8000),
  
  // Post generation specific model
  postModelProvider: text("post_model_provider"),
  postModelName: text("post_model_name"),
  postTemperature: real("post_temperature"),
  postMaxTokens: integer("post_max_tokens"),
  
  // Conversation specific model
  conversationModelProvider: text("conversation_model_provider"),
  conversationModelName: text("conversation_model_name"),
  conversationTemperature: real("conversation_temperature"),
  conversationMaxTokens: integer("conversation_max_tokens"),
  
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
  
  // Knowledge Base Selection Settings
  kbMaxEntries: integer("kb_max_entries").default(5), // max KB entries per generation
  kbMaxTokens: integer("kb_max_tokens").default(2000), // max tokens from KB
  kbCategoryWeights: jsonb("kb_category_weights").$type<Record<string, number>>().default(sql`'{}'`), // category priority weights
  kbPriorityBias: text("kb_priority_bias").default("0.5"), // 0-1, how much to favor high-priority
  kbInjectionMethod: text("kb_injection_method").default("prepend"), // prepend, append, context
  kbReusePolicy: text("kb_reuse_policy").default("deprioritize"), // never (exclude used), deprioritize (lower priority), allow (no restriction)
  kbReuseCooldownHours: integer("kb_reuse_cooldown_hours").default(24), // hours before entry can be reused (for 'never' policy)
  
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
}).extend({
  systemPrompt: z.string().optional(),
  personalityPrompt: z.string().optional(),
  modelProvider: z.string().optional(),
  modelName: z.string().optional(),
  twitterOAuthClientId: z.string().optional(),
  twitterOAuthClientSecret: z.string().optional(),
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Knowledge Base entries (per-agent) - Enhanced with categories and refresh logic
export const knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  
  // Core fields
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'`),
  
  // Source tracking
  source: text("source").notNull().default("manual"), // manual, api, integration, custom_api
  sourceId: text("source_id"), // ID of integration/custom_api if applicable
  sourceUrl: text("source_url"), // Original URL if from API
  lastFetchedAt: timestamp("last_fetched_at"), // For API-sourced entries
  
  // Enhanced management
  category: text("category").notNull().default("general"), // crypto, theology, narratives, solana, mental_models, memes, general
  priority: integer("priority").default(5).notNull(), // 1-10, higher = more important
  status: text("status").default("approved").notNull(), // pending, approved, archived
  active: boolean("active").default(true).notNull(), // toggle on/off (only applies to approved entries)
  refreshStrategy: text("refresh_strategy").default("static").notNull(), // static, daily, weekly, on_demand
  lastRefreshedAt: timestamp("last_refreshed_at"),
  expiresAt: timestamp("expires_at"), // Optional expiration for time-sensitive content
  
  // Usage tracking (for preventing reuse after posting)
  usedAt: timestamp("used_at"), // Last time this entry was used in a generation
  usedCount: integer("used_count").default(0).notNull(), // How many times used
  usedInTweetIds: jsonb("used_in_tweet_ids").$type<string[]>().default(sql`'[]'`), // IDs of tweets that used this entry
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"), // When entry was approved (if applicable)
  approvedBy: text("approved_by"), // User/system that approved (future: user ID)
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;

// Knowledge Ingestion Log - Track raw API fetches and batch imports
export const knowledgeIngestions = pgTable("knowledge_ingestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  sourceId: text("source_id").notNull(), // ID of custom_api or integration
  sourceName: text("source_name").notNull(), // Name for display
  sourceType: text("source_type").notNull(), // custom_api, crypto_price, news, etc.
  
  // Ingestion details
  status: text("status").notNull().default("success"), // success, partial, failed
  rawPayload: jsonb("raw_payload"), // Raw API response for reconciliation
  itemsFound: integer("items_found").default(0).notNull(), // Total items in response
  itemsCreated: integer("items_created").default(0).notNull(), // KB entries created
  itemsUpdated: integer("items_updated").default(0).notNull(), // KB entries updated
  itemsFailed: integer("items_failed").default(0).notNull(), // Failed to process
  errorMessage: text("error_message"), // Error details if failed
  
  // Metadata
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  durationMs: integer("duration_ms"), // How long the fetch took
});

export const insertKnowledgeIngestionSchema = createInsertSchema(knowledgeIngestions).omit({
  id: true,
  fetchedAt: true,
});

export type InsertKnowledgeIngestion = z.infer<typeof insertKnowledgeIngestionSchema>;
export type KnowledgeIngestion = typeof knowledgeIngestions.$inferSelect;

// Custom API configurations (global, shared across agents)
export const customApis = pgTable("custom_apis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  baseUrl: text("base_url").notNull(),
  method: text("method").notNull().default("GET"),
  headers: jsonb("headers").$type<Record<string, string>>().default(sql`'{}'`),
  authType: text("auth_type").default("none"), // none, bearer, api_key, basic
  authKeyEnvVar: text("auth_key_env_var"), // Name of environment variable storing API key
  authHeaderName: text("auth_header_name"), // Header name for API key (e.g., "X-API-Key", "Authorization")
  queryParams: jsonb("query_params").$type<Record<string, string>>().default(sql`'{}'`),
  requestBody: text("request_body"), // JSON string for POST/PUT requests
  jsonPath: text("json_path"), // JSONPath to extract data from response (e.g., "$.data.articles[*]")
  titlePath: text("title_path"), // JSONPath for KB entry title
  contentPath: text("content_path"), // JSONPath for KB entry content
  filterPrompt: text("filter_prompt"), // Custom AI filter prompt for relevance evaluation
  responseFormat: text("response_format").default("json"), // json, xml, text
  refreshInterval: integer("refresh_interval").default(60), // minutes
  enabled: boolean("enabled").default(true),
  lastTestedAt: timestamp("last_tested_at"),
  testStatus: text("test_status"), // success, failed, never_tested
  testError: text("test_error"),
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

// Agent Activity Tracking (monitoring/analytics)
export const agentActivity = pgTable("agent_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  
  // Time window
  date: text("date").notNull(), // YYYY-MM-DD format for daily aggregation
  hour: integer("hour"), // 0-23 for hourly granularity (optional)
  
  // Activity metrics
  postsGenerated: integer("posts_generated").default(0).notNull(),
  repliesSent: integer("replies_sent").default(0).notNull(),
  twitterApiCalls: integer("twitter_api_calls").default(0).notNull(),
  aiModelCalls: integer("ai_model_calls").default(0).notNull(),
  tokensUsed: integer("tokens_used").default(0).notNull(),
  errorsCount: integer("errors_count").default(0).notNull(),
  
  // Knowledge base usage
  kbEntriesUsed: jsonb("kb_entries_used").$type<string[]>().default(sql`'[]'`), // IDs of KB entries actually used
  kbCategoriesUsed: jsonb("kb_categories_used").$type<Record<string, number>>().default(sql`'{}'`), // category usage counts
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAgentActivitySchema = createInsertSchema(agentActivity).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentActivity = z.infer<typeof insertAgentActivitySchema>;
export type AgentActivity = typeof agentActivity.$inferSelect;
