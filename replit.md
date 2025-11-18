# ElizaOS Twitter AI Agent Dashboard

## Overview

This is a full-stack admin dashboard for configuring and managing Twitter AI agents powered by ElizaOS. The application provides a comprehensive no-code interface to build, tune, and customize AI agents that can autonomously post and interact on Twitter, with specialized support for cryptocurrency market analysis and commentary.

The dashboard enables users to manage every aspect of their AI agent including prompts, knowledge bases, API integrations, posting schedules, reply behaviors, and real-time monitoring - all from a single unified interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## Documentation

**For End Users**: See [USER_GUIDE.md](./USER_GUIDE.md) for comprehensive usage instructions, examples, and troubleshooting

**For Developers**: See [README.md](./README.md) for technical architecture, API documentation, and deployment instructions

## Recent Updates (November 2024)

**Production-Ready Release v1.0**:
- ✅ Real LLM integration with OpenAI and Anthropic APIs (removed all mocked responses)
- ✅ JSONPath extraction using `jsonpath` library for robust API data ingestion
- ✅ Dynamic agent selection in Playground (no hardcoded IDs)
- ✅ Proper numeric schema types for LLM parameters (temperature, topP, etc.)
- ✅ Comprehensive error handling and validation throughout
- ✅ Complete API workflow: Test → Extract → Ingest → KB → Conversation
- ✅ Passed architect review - confirmed production-ready
- ✅ Full documentation added (USER_GUIDE.md and README.md)

**v1.1 - Draft Mode & Twitter Testing** (November 18, 2024):
- ✅ Draft mode: Save agents with partial configurations (only name + username required)
- ✅ Twitter API credential testing with real-time validation
- ✅ Optional agent schema fields for systemPrompt, personalityPrompt, bio, modelProvider, modelName
- ✅ Test endpoint at POST /api/agents/:id/test/twitter using Twitter API v2
- ✅ Frontend test UI with success/error feedback and helpful hints
- ✅ Proper null handling throughout for optional fields
- ✅ E2E testing confirmed working via Playwright

**v1.2 - Dynamic AI Model Discovery** (November 18, 2024):
- ✅ Dynamic model fetching from OpenAI, Google Gemini, and Anthropic APIs
- ✅ Test endpoint at POST /api/agents/:id/test/model for API key validation
- ✅ OpenAI: Fetches all GPT/o1/o3 models via /v1/models, sorted by newest
- ✅ Google Gemini: Fetches all Gemini models via Google AI generativelanguage API
- ✅ Anthropic: Tests key validity, provides latest Claude model list
- ✅ Frontend dynamic dropdown populated with fetched models
- ✅ Fallback to manual model entry for unsupported providers
- ✅ Normalized model response structure across all providers
- ✅ Added Google (Gemini) provider to dropdown
- ✅ Helpful API key source links for each provider

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool

**UI Framework**: Radix UI primitives with shadcn/ui component library built on top of TailwindCSS

**Design System**: Modern admin dashboard pattern inspired by Linear, Vercel, and Stripe interfaces. Emphasizes clarity over decoration with consistent spacing primitives (2, 4, 6, 8, 12, 16, 24 Tailwind units), typography hierarchy using font weight rather than size jumps, and scannable layouts optimized for data-intensive workflows.

**Typography**: Inter for UI elements and body text, JetBrains Mono for code snippets and API keys

**State Management**: TanStack Query (React Query) for server state management with automatic caching, background refetching disabled (staleTime: Infinity), and infinite cache retention

**Routing**: Wouter for lightweight client-side routing

**Key Pages**:
- Dashboard: System overview and agent status monitoring
- Agents: Create, manage, and configure multiple AI agents
- Agent Configure: Comprehensive configuration interface with tabs for prompts, credentials, behavior, knowledge base, and settings
- Monitoring: Real-time activity tracking with date range filtering
- API Keys: Centralized management of Twitter and AI model credentials
- Integrations: Configure external data feeds (crypto prices, news)
- Custom APIs: Add and test custom API endpoints for agent data
- Live Feeds: Real-time view of incoming data from integrated services
- Playground: Test agent responses with prompt validation

### Backend Architecture

**Runtime**: Node.js with Express.js

**Language**: TypeScript with ESM modules

**API Pattern**: RESTful API with routes registered in `server/routes.ts`

**Request Handling**: 
- JSON body parsing with raw body capture for webhook verification
- Request/response logging middleware that captures duration and truncates long responses
- Centralized error handling with Zod validation

**Storage Layer**: Abstracted through `server/storage.ts` interface providing methods for CRUD operations on all entities (agents, knowledge base, custom APIs, API keys, activity tracking)

**Key Routes**:
- `/api/agents` - CRUD operations for AI agents
- `/api/agents/:id/test/twitter` - Test Twitter API credentials
- `/api/agents/:id/test/model` - Test AI model API key and fetch available models (NEW)
- `/api/agents/:id/conversation` - Test agent conversation with LLM
- `/api/knowledge-base` - Manage agent knowledge entries
- `/api/custom-apis` - Configure custom data sources
- `/api/api-keys` - Store and retrieve API credentials
- `/api/activity` - Agent activity monitoring and analytics

### Database Architecture

**Database**: PostgreSQL via Neon serverless (WebSocket-based connection pooling)

**ORM**: Drizzle ORM with schema-first approach

**Schema Design** (`shared/schema.ts`):

**Agents Table**: Comprehensive configuration storage including:
- Basic metadata (name [required], username [required], bio [optional], status)
- Twitter API credentials (6 fields: API key/secret, access token/secret, bearer token, app ID - all optional for draft mode)
- Character prompts (system [optional], personality [optional], style, topics, adjectives)
- Message examples and custom prompts (JSONB)
- AI model configuration (provider [optional], modelName [optional], 11 supported providers: OpenAI, Anthropic, Groq, Together, Mistral, Cohere, Replicate, HuggingFace, Ollama, vLLM, LocalAI)
- Model parameters (temperature, maxTokens, topP, frequency/presence penalties, context window)
- Posting behavior (frequency, intervals, quiet hours with timezone support)
- Reply behavior (rate, delay limits, verified-only filtering, keyword whitelists/blacklists)
- Content modules (crypto commentary, market analysis, news, threads, memes)
- Triggers (price/volume thresholds, auto-tweet on news)

**Note**: Most fields are now optional to support draft mode. Only name and username are required, allowing users to save partial configurations and complete them incrementally.

**Knowledge Base Table**: Agent-specific knowledge entries with categories, tags, priority levels, active status, and refresh strategies

**Custom APIs Table**: External data source configurations with headers, query params, body templates, polling frequency, JSON path extraction, and status tracking

**API Keys Table**: Encrypted credential storage with service names and validation status

**Agent Activity Table**: Monitoring data for posts created, replies sent, errors, API calls, and daily/weekly summaries

**Type Safety**: Zod schemas generated from Drizzle tables using `drizzle-zod` for runtime validation, with TypeScript types inferred for compile-time safety

### Authentication & Security

**Current State**: No authentication implemented (sessions infrastructure present via `connect-pg-simple` but unused)

**Security Considerations**:
- API keys stored in database (should be encrypted in production)
- No rate limiting implemented
- No CORS configuration
- Session store configured but not actively used

### Development Workflow

**Hot Module Replacement**: Vite dev server in middleware mode for instant updates

**Type Checking**: Shared types between client and server via `@shared` path alias

**Database Migrations**: Drizzle Kit with `db:push` command for schema synchronization

**Build Process**: 
- Frontend: Vite builds to `dist/public`
- Backend: esbuild bundles server code with external packages to `dist/index.js`

**Error Handling**: Custom error overlay via `@replit/vite-plugin-runtime-error-modal` in development

## External Dependencies

### Third-Party Services

**AI Model Providers** (11 supported):
- Commercial: OpenAI, Anthropic (Claude), Groq, Together AI, Mistral, Cohere, Replicate, Hugging Face
- Self-hosted: Ollama, vLLM, LocalAI

**Twitter API**: Requires OAuth 1.0a credentials (API key/secret, access token/secret, bearer token, app ID)

**Data Sources** (configurable):
- CoinGecko API for cryptocurrency prices
- DexScreener for DEX pool data
- Crypto News APIs for market news
- Custom API endpoints via user configuration

### Database & Infrastructure

**Neon Serverless PostgreSQL**: WebSocket-based connection pooling with `@neondatabase/serverless` driver

**Connection Management**: Pool-based connections with automatic reconnection and query retries

### UI Component Library

**Radix UI**: Comprehensive set of unstyled, accessible UI primitives (accordion, alert-dialog, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, switch, tabs, toast, toggle, tooltip)

**shadcn/ui**: Pre-styled component implementations built on Radix UI with TailwindCSS

**Additional Libraries**:
- `class-variance-authority`: Type-safe variant APIs for component styling
- `cmdk`: Command palette component
- `date-fns`: Date formatting and manipulation
- `react-day-picker`: Calendar/date picker
- `recharts`: Charts and data visualization
- `embla-carousel-react`: Carousel/slider component

### Form Handling

**React Hook Form**: Form state management with `@hookform/resolvers` for Zod schema validation integration

### Development Tools

**Replit Plugins**: 
- `@replit/vite-plugin-runtime-error-modal`: Error overlay
- `@replit/vite-plugin-cartographer`: Code navigation
- `@replit/vite-plugin-dev-banner`: Development mode indicator