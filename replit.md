# ElizaOS Twitter AI Agent Dashboard

## Overview
This is a full-stack admin dashboard for configuring and managing Twitter AI agents powered by ElizaOS. It provides a no-code interface to build, tune, and customize AI agents for autonomous Twitter posting and interaction, with specialized support for cryptocurrency market analysis. The dashboard allows users to manage agent prompts, knowledge bases, API integrations, posting schedules, reply behaviors, and real-time monitoring.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, Radix UI primitives, and shadcn/ui (TailwindCSS). The design follows a modern admin dashboard pattern, emphasizing clarity with consistent spacing, typography hierarchy, and scannable layouts. Inter is used for UI text, and JetBrains Mono for code snippets.

### Technical Implementations
**Frontend**:
- **State Management**: TanStack Query for server state with automatic caching.
- **Routing**: Wouter for lightweight client-side routing.
- **Key Pages**: Dashboard, Agents, Agent Configuration (Prompts, Credentials, Behavior, Knowledge Base, Settings), Monitoring, API Keys, Integrations, Custom APIs, Live Feeds, Playground.

**Backend**:
- **Runtime**: Node.js with Express.js and TypeScript (ESM modules).
- **API Pattern**: RESTful API with routes defined in `server/routes.ts`.
- **Request Handling**: JSON body parsing, logging middleware, and centralized error handling with Zod validation.
- **Storage Layer**: Abstracted interface (`server/storage.ts`) for CRUD operations across all entities.
- **Key Routes**: `/api/agents`, `/api/agents/:id/test/twitter`, `/api/agents/:id/test/model`, `/api/agents/:id/conversation`, `/api/knowledge-base`, `/api/custom-apis`, `/api/api-keys`, `/api/activity`.

### System Design Choices
**Database**: PostgreSQL via Neon serverless, using Drizzle ORM with a schema-first approach (`shared/schema.ts`).
- **Agents Table**: Stores comprehensive agent configurations including metadata, Twitter API credentials (OAuth 1.0a and 2.0), character prompts, AI model configurations (11 providers), model parameters, posting/reply behaviors, content modules, triggers, and mention polling state (lastMentionId, lastMentionCheckAt). Most fields are optional to support draft mode.
- **Knowledge Base Table**: Agent-specific knowledge entries with categories, tags, priority, active status, and refresh strategies, supporting a pending/approved/archived workflow. Includes Smart Priority Learning with `originalPriority` and `priorityCorrectedAt` fields to track user corrections and improve future auto-prioritization.
- **Processed Mentions Table**: Tracks Twitter mentions received and responses sent, with unique constraint on (agentId, mentionTweetId) to prevent duplicate processing.
- **Custom APIs Table**: External data source configurations.
- **API Keys Table**: Encrypted credential storage.
- **Agent Activity Table**: Monitoring data.
- **Type Safety**: Zod schemas generated from Drizzle for runtime validation and TypeScript types for compile-time safety.

### Mention Detection & Auto-Reply System
The bot automatically detects and responds to Twitter mentions:
- **Polling**: Every 3 minutes, fetches new mentions using Twitter API v2 `/users/:id/mentions` endpoint
- **Duplicate Prevention**: Two-layer protection via database lookup + unique constraint on (agentId, mentionTweetId)
- **Rate Limiting**: Respects `maxRepliesPerHour` configuration and `replyRate` percentage
- **Reply Delays**: Configurable delays (replyDelayMin/replyDelayMax) before responding to appear more human-like
- **AI Generation**: Uses conversation model (or falls back to post model) with agent personality and KB context
- **Persistence**: lastMentionId stored in agents table to survive server restarts
- **Monitoring**: API routes `/api/agents/:agentId/mentions` and `/api/agents/:agentId/mentions/stats` for viewing activity

**Authentication & Security**: Login required (admin/graceimmutable). API keys stored encrypted in database.

### Twitter Authentication (Simplified - ElizaOS-style)
The bot uses a simplified credential flow similar to ElizaOS:
- **Required**: Username, Password (Email often required for verification)
- **Optional**: 2FA TOTP Secret (if you have 2FA enabled)
- **Auto-Caching**: Session cookies cached after successful login
- **Retry Logic**: 3 attempts with exponential backoff
- **CRITICAL**: User must mark Twitter account as "Automated" in Twitter Settings → Account Information → Automation
- **Advanced**: API credentials (collapsible) for developers with Twitter API access

## External Dependencies

### Third-Party Services
- **AI Model Providers**: OpenAI, Anthropic (Claude), Groq, Together AI, Mistral, Cohere, Replicate, Hugging Face, Ollama, vLLM, LocalAI.
- **Twitter Scraper**: Uses `agent-twitter-client` for login-based authentication (ElizaOS approach)
- **Twitter API** (optional): OAuth 1.0a for advanced features
- **Data Sources** (configurable): CoinGecko API, DexScreener, Crypto News APIs, Custom API endpoints.

### Database & Infrastructure
- **Neon Serverless PostgreSQL**: Utilizes `@neondatabase/serverless` for WebSocket-based connection pooling.

### UI Component Library
- **Radix UI**: Unstyled, accessible UI primitives.
- **shadcn/ui**: Pre-styled components built on Radix UI with TailwindCSS.

### Additional Libraries
- `class-variance-authority`: For type-safe component styling.
- `cmdk`: Command palette component.
- `date-fns`: Date manipulation.
- `react-day-picker`: Calendar/date picker.
- `recharts`: Charts and data visualization.
- `embla-carousel-react`: Carousel component.

### Form Handling
- **React Hook Form**: For form state management, integrated with Zod for validation.

## Rate Limiting & Backoff Configuration

### Hardcoded Values (server/scheduler.ts)
| Setting | Value | Description |
|---------|-------|-------------|
| `INITIAL_RATE_LIMIT_BACKOFF_MS` | 30 minutes | Base backoff for rate limits |
| `MAX_RATE_LIMIT_BACKOFF_MS` | 6 hours | Maximum backoff (prevents lockout) |
| `PERMISSION_ERROR_BACKOFF_MS` | 1 hour | Backoff for "not permitted" errors |
| `MIN_POSTING_INTERVAL_MS` | 30 minutes | Enforced minimum between posts |
| `RECOMMENDED_POSTING_INTERVAL_MS` | 1 hour | Suggested interval |
| `LOGIN_CACHE_DURATION` | 30 minutes | Scraper session cache (twitterScraper.ts) |
| `MENTION_POLL_INTERVAL` | 3 minutes | How often to check for new mentions |

### Database-Configurable Values (per agent)
| Field | Current Default | Description |
|-------|-----------------|-------------|
| `post_frequency` | 1 | Number of time units between posts |
| `post_interval` | "hours" | Time unit (minutes/hours) |
| `max_posts_per_day` | 12 | Daily post limit (Twitter Free tier: 17) |
| `reply_enabled` | true | Enable auto-replies to mentions |
| `reply_rate` | 70 | % chance to respond to a mention |
| `reply_delay` | 30 | Base delay (seconds) before replying |
| `max_replies_per_hour` | 10 | Hourly reply limit |
| `recent_post_context_enabled` | true | Show AI recent posts for anti-repetition |
| `recent_post_context_count` | 5 | Number of recent posts to show AI |

### Atomic Posting Lock (Prevents Double Posts)
The scheduler uses an atomic database lock to prevent race conditions:
- `lastPostAttemptAt` column tracks when posting STARTED (not finished)
- `acquirePostingLock()` performs atomic UPDATE that only succeeds if interval has elapsed
- `shouldTriggerPost()` checks both `lastPostAttemptAt` and `lastPostedAt`
- Prevents multiple scheduler ticks from entering posting flow simultaneously

### Error Recovery Behavior
- **Rate Limits (429)**: Exponential backoff with jitter, resets on success
- **Permission Errors**: 1-hour backoff, does NOT clear cookies (account restriction, not auth failure)
- **Auth Failures (401)**: Clears cached cookies, triggers re-login on next attempt
- **Network Errors**: 3 retries with short delays

### Dual Authentication Fallback
1. **Posting**: API first → Scraper fallback if API fails
2. **Replies**: API first → Scraper fallback if API fails
3. **Mention Polling**: API first → Scraper fallback if API fails

### Safe Mode Auto-Pause
The scheduler automatically pauses agents after repeated authentication failures to prevent wasted API calls and potential account issues:
- **Threshold**: 5 consecutive auth failures triggers safe mode
- **Behavior**: Agent status changed to "paused", scheduler stops posting attempts
- **Recovery**: User must fix credentials and manually redeploy the agent
- **Failure Reset**: Consecutive failure counter resets when agent is stopped or restarted
- **Logged Events**: `safe_mode` eventType with `SAFE_MODE_TRIGGERED` errorCode in activity logs

### Scheduler State Persistence
The scheduler persists its state to survive server restarts:
- **Database Table**: `scheduler_state` stores posting history, rate limit backoff, circuit breaker state, and recent tweets
- **Saved On**: Successful posts, failed posts, and agent stop
- **Restored On**: Agent startup via `loadSchedulerState()`
- **Fields Persisted**:
  - `lastPostTime`, `postsToday`, `postsResetDate`
  - `rateLimitBackoffUntil`, `consecutiveFailures`
  - `repliesThisHour`, `repliesHourStart`
  - `recentBotTweets` (JSON array for comment detection)
  - `apiBackoffUntil`, `scraperBackoffUntil` (circuit breaker)
  - `lastDiversityCheck`

### Circuit Breaker System
Automatically switches between API and scraper methods after repeated failures:
- **Failure Threshold**: 3 consecutive failures triggers 30-minute backoff
- **Method Selection**: Checks `apiBackoffUntil`/`scraperBackoffUntil` before selecting auth method
- **Success Reset**: Resets failure count and backoff on successful operation
- **Coverage**: Both posting and reply flows use circuit breaker protection
- **Storage Methods**: 
  - `getCircuitBreakerState()` - Returns current backoff windows
  - `recordCircuitBreakerFailure()` - Increments failures, sets backoff after threshold
  - `recordCircuitBreakerSuccess()` - Resets counters on success

### Diversity Auto-Alerts
Monitors content diversity and auto-pauses agents when content becomes repetitive:
- **Warning Threshold**: 60% - Logs warning when diversity drops below 60%
- **Pause Threshold**: 40% - Auto-pauses agent when diversity drops below 40%
- **Check Interval**: Every 30 minutes to avoid database overhead
- **Metric**: Percentage of unique content types used in recent 50 posts
- **Persistence**: `lastDiversityCheck` timestamp survives restarts

### Health Monitoring System
Real-time agent health monitoring via API and UI dashboard:
- **API Endpoint**: `GET /api/agents/:agentId/health` returns comprehensive health data
- **Credential Status**: Shows API credentials, session cookies, scraper login availability
- **Posting Stats**: 24-hour success/failure counts, success rate percentage
- **Stall Detection**: Alerts when posting has stopped unexpectedly (2x posting interval)
- **Safe Mode Indicator**: Shows when agent was auto-paused due to auth failures
- **UI Component**: `AgentHealthDashboard` component on Monitoring page with auto-refresh (30s)

## Troubleshooting

### "Not Permitted" Errors
This indicates Twitter account restrictions, NOT authentication issues:
1. Go to Twitter Settings → Account Information → Automation
2. Check the box to mark account as "Automated"
3. Wait 24-48 hours if recently flagged
4. Ensure account is in good standing (no suspensions)

### OAuth 401 Errors
The OAuth credentials are mismatched or expired:
1. Regenerate tokens in Twitter Developer Portal
2. Update dashboard with new API Key, API Secret, Access Token, Access Token Secret
3. Verify the app has Read+Write permissions