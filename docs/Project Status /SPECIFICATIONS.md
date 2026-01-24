# SPECIFICATIONS

## Core Architecture
- **Tech Stack**: Express, React, Vite, Drizzle ORM, PostgreSQL (Neon).
- **Communication**: JSON REST API.
- **Persistence**: Neon PostgreSQL DB.

## Data Contracts
- **Agent**: Defined in `shared/schema.ts` as `agents` table.
- **Knowledge Base**: `knowledge_base` table, linked by `agentId`.
- **Character Export**: JSON manifest compatible with ElizaOS `character.json`.

## Features
- Multi-agent autonomous scheduling.
- Twitter scraping and API integration via `agent-twitter-client`.
- Knowledge base ingestion from custom APIs.
- Real-time playground for prompt testing.
