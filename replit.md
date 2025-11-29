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

**Authentication & Security**: Currently, no authentication is implemented. API keys are stored in the database.

## External Dependencies

### Third-Party Services
- **AI Model Providers**: OpenAI, Anthropic (Claude), Groq, Together AI, Mistral, Cohere, Replicate, Hugging Face, Ollama, vLLM, LocalAI.
- **Twitter API**: Requires OAuth 1.0a credentials.
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