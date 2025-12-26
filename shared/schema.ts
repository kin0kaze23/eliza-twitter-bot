import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, boolean, integer, timestamp, real, unique } from "drizzle-orm/pg-core";
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
  
  // Cookie-based authentication (for scraping - like ElizaOS)
  // This bypasses Twitter API limitations for reading mentions/replies
  twitterUsername: text("twitter_username"), // @username (without @)
  twitterPassword: text("twitter_password"), // account password
  twitterEmail: text("twitter_email"), // account email (for login)
  twitter2faSecret: text("twitter_2fa_secret"), // optional 2FA TOTP secret
  twitterCookies: text("twitter_cookies"), // cached session cookies (JSON)
  
  // Character & Prompts
  systemPrompt: text("system_prompt"),
  personalityPrompt: text("personality_prompt"),
  postStyle: text("post_style"),
  topics: text("topics"),
  adjectives: text("adjectives"),
  messageExamples: jsonb("message_examples").$type<MessageExamples>().default(sql`'[]'`),
  
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
  // Webhook configuration
  webhookUrl: text("webhook_url"), // for monitoring/alerts
  webhookSecret: text("webhook_secret"), // HMAC secret for signature verification
  webhookEvents: jsonb("webhook_events").$type<string[]>().default(sql`'["post_created", "post_failed", "error"]'`), // events to send
  webhookEnabled: boolean("webhook_enabled").default(false),
  
  // Knowledge Base Selection Settings
  kbCategoryWeights: jsonb("kb_category_weights").$type<Record<string, number>>().default(sql`'{}'`), // category priority weights
  kbPriorityBias: text("kb_priority_bias").default("0.5"), // 0-1, how much to favor high-priority
  kbInjectionMethod: text("kb_injection_method").default("prepend"), // prepend, append, context
  kbReusePolicy: text("kb_reuse_policy").default("deprioritize"), // never (exclude used), deprioritize (lower priority), allow (no restriction)
  kbReuseCooldownHours: integer("kb_reuse_cooldown_hours").default(24), // hours before entry can be reused (for 'never' policy)
  kbMaxEntries: integer("kb_max_entries").default(10), // max KB entries to include per post
  
  // KB Auto-Refresh Settings
  kbAutoRefreshEnabled: boolean("kb_auto_refresh_enabled").default(false),
  kbAutoRefreshIntervalHours: integer("kb_auto_refresh_interval_hours").default(6), // hours between auto-refresh
  kbLastAutoRefreshedAt: timestamp("kb_last_auto_refreshed_at"),
  
  // KB Priority Rules - auto-update priority based on content rules
  kbPriorityRuleEnabled: boolean("kb_priority_rule_enabled").default(false),
  kbPriorityRule: text("kb_priority_rule"), // Rule text like "if content contains 'breaking' then priority 10"
  kbPriorityRuleLastAppliedAt: timestamp("kb_priority_rule_last_applied_at"),
  
  // Event Priority Mode - prioritize EVENT_BASED content when fresh news exists
  eventPriorityModeEnabled: boolean("event_priority_mode_enabled").default(false),
  eventPriorityFreshnessMinutes: integer("event_priority_freshness_minutes").default(360), // 6 hours default
  eventPriorityFallbackPolicy: text("event_priority_fallback_policy").default("respect_rotation"), // respect_rotation, allow_consecutive
  eventPriorityMinPriority: text("event_priority_min_priority").default("medium"), // low, medium, high - minimum priority for fresh news
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT FRESHNESS SETTINGS (Unified Anti-Repetition Config)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Global freshness cooldown (applies to all tracking)
  freshnessCooldownHours: integer("freshness_cooldown_hours").default(24), // unified cooldown period
  
  // Bible Verse Tracking - prevent repetitive verse usage
  verseTrackingEnabled: boolean("verse_tracking_enabled").default(true),
  verseReusePolicy: text("verse_reuse_policy").default("avoid_recent"), // allow, avoid_recent, unique_daily
  verseReuseWindow: integer("verse_reuse_window").default(10), // number of posts to look back (for avoid_recent)
  
  // Content Type Tracking - prevent repetitive content types
  contentTypeTrackingEnabled: boolean("content_type_tracking_enabled").default(true),
  contentTypeReusePolicy: text("content_type_reuse_policy").default("rotate_all"), // allow, avoid_last, rotate_all
  contentTypeWindow: integer("content_type_window").default(7), // number of posts to look back
  
  // Recent Post Context Injection - show AI recent posts to avoid repetition
  recentPostContextEnabled: boolean("recent_post_context_enabled").default(true),
  recentPostContextCount: integer("recent_post_context_count").default(5), // number of recent posts to include in prompt
  
  // Mention Polling Tracking - persist state across restarts
  lastMentionId: text("last_mention_id"), // Last processed mention tweet ID for pagination
  lastMentionCheckAt: timestamp("last_mention_check_at"), // When we last checked for mentions
  
  // Post Scheduling Tracking - persist state across restarts to prevent duplicate posts
  lastPostedAt: timestamp("last_posted_at"), // When the last successful post was made
  lastPostAttemptAt: timestamp("last_post_attempt_at"), // When the last post ATTEMPT started (prevents race conditions)
  
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
  maxPostsPerDay: z.coerce.number().int().min(1).max(100).optional(),
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
  priority: text("priority").default("medium").notNull(), // high, medium, low - current priority
  originalPriority: text("original_priority"), // AI-assigned priority (for learning)
  priorityCorrectedAt: timestamp("priority_corrected_at"), // when user manually corrected priority
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
  lastRefreshedAt: timestamp("last_refreshed_at"), // When KB was last refreshed from this API
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

// Activity Logs - Individual post/reply events with comprehensive tracking
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  
  // Event type: post, reply, mention_received, mention_reply, quote, retweet, error, scheduler_start, scheduler_stop
  eventType: text("event_type").notNull(),
  
  // Status: pending, success, failed, rate_limited, skipped
  status: text("status").notNull().default("pending"),
  
  // Twitter data
  tweetId: text("tweet_id"), // The posted tweet ID from Twitter
  inReplyToTweetId: text("in_reply_to_tweet_id"), // For replies
  inReplyToUserId: text("in_reply_to_user_id"), // For replies
  inReplyToUsername: text("in_reply_to_username"), // Username for display
  conversationId: text("conversation_id"), // Thread tracking
  
  // Content
  content: text("content").notNull(),
  characterCount: integer("character_count"),
  
  // Content type tracking (for 7 content variations)
  contentType: text("content_type"), // EVENT_BASED, VERSE_REFLECTION, DEEP_QUESTION, etc.
  bibleVerse: text("bible_verse"), // Verse reference if applicable
  
  // AI generation info - comprehensive model metrics
  modelProvider: text("model_provider"),
  modelName: text("model_name"),
  tokensUsed: integer("tokens_used"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  generationTimeMs: integer("generation_time_ms"), // How long AI took to generate
  temperature: real("temperature"),
  
  // Knowledge base entries used
  kbEntriesUsed: jsonb("kb_entries_used").$type<string[]>().default(sql`'[]'`),
  kbCategoriesUsed: jsonb("kb_categories_used").$type<string[]>().default(sql`'[]'`),
  
  // Error info
  errorMessage: text("error_message"),
  errorCode: text("error_code"),
  retryCount: integer("retry_count").default(0),
  
  // Engagement metrics (updated later via polling or webhooks)
  likes: integer("likes").default(0),
  retweets: integer("retweets").default(0),
  replies: integer("replies").default(0),
  impressions: integer("impressions").default(0),
  engagementRate: real("engagement_rate"), // (likes + retweets + replies) / impressions
  lastEngagementUpdate: timestamp("last_engagement_update"),
  
  // Mention/Reply specific tracking
  mentionId: text("mention_id"), // Reference to processed_mentions.id if applicable
  replyDelayMs: integer("reply_delay_ms"), // How long we waited before replying
  
  // Trigger info (what caused this action)
  triggerType: text("trigger_type"), // scheduled, manual, mention, webhook, force_generate
  triggerData: jsonb("trigger_data").$type<Record<string, unknown>>().default(sql`'{}'`), // Extra trigger context
  
  // Dry run tracking
  isDryRun: boolean("is_dry_run").default(false),
  
  // Timestamps
  scheduledAt: timestamp("scheduled_at"), // When it was supposed to post
  postedAt: timestamp("posted_at"), // When it actually posted
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Bible Verse Usage Tracking - prevent repetitive verse usage in tweets
export const bibleVerseUsages = pgTable("bible_verse_usages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  
  // Verse reference (normalized format)
  verseRef: text("verse_ref").notNull(), // e.g., "Matthew 6:21", "Psalm 23:1"
  book: text("book").notNull(), // e.g., "Matthew", "Psalm"
  chapter: integer("chapter").notNull(),
  verseStart: integer("verse_start").notNull(),
  verseEnd: integer("verse_end"), // for ranges like "Matt 5:3-12"
  
  // Usage tracking
  usageCount: integer("usage_count").default(1).notNull(),
  tweetIds: jsonb("tweet_ids").$type<string[]>().default(sql`'[]'`), // IDs of tweets that used this verse
  
  // Timestamps
  firstUsedAt: timestamp("first_used_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
});

export const insertBibleVerseUsageSchema = createInsertSchema(bibleVerseUsages).omit({
  id: true,
  firstUsedAt: true,
  lastUsedAt: true,
});

export type InsertBibleVerseUsage = z.infer<typeof insertBibleVerseUsageSchema>;
export type BibleVerseUsage = typeof bibleVerseUsages.$inferSelect;

// Content Type Usage Tracking - prevent repetitive content type selection
export const contentTypeUsages = pgTable("content_type_usages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  
  // Content type info
  contentType: text("content_type").notNull(), // EVENT_BASED, VERSE_REFLECTION, DEEP_QUESTION, WISDOM_BITE, CULTURAL_INSIGHT, ENCOURAGEMENT, ETERNITY_ANCHOR
  
  // Usage tracking
  usageCount: integer("usage_count").default(1).notNull(),
  tweetIds: jsonb("tweet_ids").$type<string[]>().default(sql`'[]'`), // IDs of tweets that used this type
  
  // Timestamps
  firstUsedAt: timestamp("first_used_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
});

export const insertContentTypeUsageSchema = createInsertSchema(contentTypeUsages).omit({
  id: true,
  firstUsedAt: true,
  lastUsedAt: true,
});

export type InsertContentTypeUsage = z.infer<typeof insertContentTypeUsageSchema>;
export type ContentTypeUsage = typeof contentTypeUsages.$inferSelect;

// Content type constants for reference
export const CONTENT_TYPES = [
  "EVENT_BASED",
  "VERSE_REFLECTION", 
  "DEEP_QUESTION",
  "WISDOM_BITE",
  "CULTURAL_INSIGHT",
  "ENCOURAGEMENT",
  "ETERNITY_ANCHOR",
] as const;

export type ContentType = typeof CONTENT_TYPES[number];

// Message example with optional content type metadata
export interface MessageExample {
  content: string;
  contentType?: ContentType;
}

// Type for message examples array (supports both legacy string[] and new object[])
export type MessageExamples = (string | MessageExample)[];

// Processed Mentions Tracking - track which Twitter mentions have been responded to
export const processedMentions = pgTable("processed_mentions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  
  // Mention info
  mentionTweetId: text("mention_tweet_id").notNull(), // The tweet ID of the mention
  authorId: text("author_id").notNull(), // Twitter user ID who mentioned the bot
  authorUsername: text("author_username"), // Twitter username
  mentionText: text("mention_text").notNull(), // The original mention text
  conversationId: text("conversation_id"), // For threading
  
  // Response tracking
  responded: boolean("responded").default(false).notNull(),
  responseTweetId: text("response_tweet_id"), // The tweet ID of our reply
  responseText: text("response_text"), // What we replied with
  
  // Error tracking
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
  
  // Type: 'mention' (direct @mention) or 'reply' (comment on our tweet)
  mentionType: text("mention_type").default("mention").notNull(),
  
  // Timestamps
  mentionedAt: timestamp("mentioned_at").defaultNow().notNull(), // When the mention was created
  processedAt: timestamp("processed_at"), // When we processed it
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Unique constraint to prevent duplicate mention processing
  uniqueMention: unique("unique_agent_mention").on(table.agentId, table.mentionTweetId),
}));

export const insertProcessedMentionSchema = createInsertSchema(processedMentions).omit({
  id: true,
  createdAt: true,
});

export type InsertProcessedMention = z.infer<typeof insertProcessedMentionSchema>;
export type ProcessedMention = typeof processedMentions.$inferSelect;

// Agent mention tracking metadata (stored on agent)
export interface MentionTrackingState {
  lastMentionId?: string; // Last processed mention ID for pagination
  lastCheckTime?: string; // ISO timestamp of last check
  recentTweetIds?: string[]; // IDs of recent bot tweets to check for replies
}

// Scheduler State Persistence - survive server restarts
export const schedulerState = pgTable("scheduler_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  
  // Posting state
  lastPostTime: timestamp("last_post_time"),
  postsToday: integer("posts_today").default(0).notNull(),
  postsResetDate: text("posts_reset_date"), // Date string (YYYY-MM-DD) when posts counter was last reset
  
  // Rate limiting state
  rateLimitBackoffUntil: timestamp("rate_limit_backoff_until"),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  
  // Reply tracking
  repliesThisHour: integer("replies_this_hour").default(0).notNull(),
  repliesHourStart: timestamp("replies_hour_start"),
  
  // Recent bot tweets (JSON array for comment detection)
  recentBotTweets: jsonb("recent_bot_tweets").$type<Array<{
    tweetId: string;
    postedAt: string;
    lastReplyId?: string;
  }>>().default(sql`'[]'`),
  
  // Circuit breaker state
  preferredAuthMethod: text("preferred_auth_method").default("api"), // 'api' or 'scraper'
  apiFailureCount: integer("api_failure_count").default(0).notNull(),
  scraperFailureCount: integer("scraper_failure_count").default(0).notNull(),
  apiBackoffUntil: timestamp("api_backoff_until"),
  scraperBackoffUntil: timestamp("scraper_backoff_until"),
  circuitBreakerTrippedAt: timestamp("circuit_breaker_tripped_at"),
  
  // Diversity tracking
  lastDiversityCheck: timestamp("last_diversity_check"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAgent: unique("unique_scheduler_agent").on(table.agentId),
}));

export const insertSchedulerStateSchema = createInsertSchema(schedulerState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSchedulerState = z.infer<typeof insertSchedulerStateSchema>;
export type SchedulerState = typeof schedulerState.$inferSelect;

// Diversity alert thresholds
export const DIVERSITY_ALERT_THRESHOLD = 40; // Auto-pause if diversity score drops below this
export const DIVERSITY_WARNING_THRESHOLD = 60; // Warn if below this
