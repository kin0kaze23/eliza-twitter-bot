# ElizaOS Twitter AI Agent Dashboard

A production-ready full-stack admin dashboard for managing Twitter AI agents powered by ElizaOS. Build, configure, and deploy autonomous Twitter bots with a complete no-code interface.

## 🚀 Features

- **Multi-Agent Management**: Create and configure unlimited AI agents with distinct personalities
- **Universal API Integration**: Connect ANY REST API as a data source (news, crypto, weather, custom APIs)
- **Intelligent Knowledge Base**: Auto-populate from APIs using JSONPath extraction or add manual entries
- **Real-Time Testing**: Test agent responses with actual LLM providers (OpenAI, Anthropic, etc.)
- **Advanced Configuration**: Fine-tune LLM parameters, posting schedules, reply behaviors, and content modules
- **Production Ready**: Complete database persistence, error handling, and validation

## 📚 Documentation

**For Users**: See [USER_GUIDE.md](./USER_GUIDE.md) for complete usage instructions

**For Developers**: Continue reading below

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **UI**: Radix UI + shadcn/ui + TailwindCSS
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js + Express
- **Language**: TypeScript (ESM)
- **Database**: PostgreSQL via Neon Serverless
- **ORM**: Drizzle ORM
- **Validation**: Zod schemas

### Key Dependencies
- `jsonpath`: JSONPath extraction from API responses
- `@neondatabase/serverless`: WebSocket-based DB connections
- `openai` & `@anthropic-ai/sdk`: LLM integrations

## 🚦 Getting Started

### Prerequisites

1. **Node.js** 18+ installed
2. **PostgreSQL database** (Neon Serverless recommended)
3. **API Keys**:
   - At least one LLM provider (OpenAI or Anthropic)
   - Twitter API credentials (for production agents)

### Installation

```bash
# Install dependencies
npm install

# Set up database (run migration)
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`

### Environment Variables

Required in `.env` or Replit Secrets:

```env
# Database (auto-configured on Replit)
DATABASE_URL=postgresql://...
PGHOST=...
PGPORT=5432
PGUSER=...
PGPASSWORD=...
PGDATABASE=...

# Session (auto-configured on Replit)
SESSION_SECRET=your-secret-key

# Optional: Add API keys here or via dashboard
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

**Note**: On Replit, database variables are automatically configured. API keys should be added via the dashboard's **API Keys** page for better security.

## 📖 Key Concepts

### 1. API Management

Connect external data sources to populate agent knowledge:

```typescript
// Example API Configuration
{
  name: "CoinGecko BTC Price",
  url: "https://api.coingecko.com/api/v3/coins/markets",
  method: "GET",
  queryParams: { vs_currency: "usd", per_page: "10" },
  jsonPath: "$[*]",           // Extract all items
  titlePath: "$.name",         // Get 'name' from each item
  contentPath: "$.current_price" // Get price from each item
}
```

### 2. JSONPath Extraction

The system uses the `jsonpath` library for robust data extraction:

- **Main Path**: Extracts items from API response (`$.data.articles[*]`)
- **Title Path**: Extracts title from each item (`$.title`)
- **Content Path**: Extracts content from each item (`$.description`)

**Important**: Always test extraction before ingesting to verify correct data structure.

### 3. Knowledge Base Integration

When you ingest API data:
1. System fetches latest API response
2. Applies JSONPath extraction
3. Creates KB entries (up to 20 per ingestion)
4. Tags entries with source and metadata
5. Agent can now reference this data in conversations

### 4. LLM Integration

Agents use real LLM providers:
- **OpenAI**: GPT-4, GPT-3.5 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus
- **Others**: Groq, Together AI, Mistral, Cohere, Replicate, Hugging Face, Ollama, vLLM, LocalAI

Configuration includes:
- Temperature (creativity)
- Max tokens (response length)
- Top P (word diversity)
- Frequency/Presence penalties (repetition control)
- Context window (memory size)

## 🏗 Architecture

### Directory Structure

```
├── client/
│   ├── src/
│   │   ├── pages/           # Route components
│   │   ├── components/      # Reusable UI components
│   │   ├── lib/            # Client utilities
│   │   └── App.tsx         # Main app with routing
├── server/
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Database interface
│   ├── index.ts            # Express server
│   └── vite.ts             # Vite middleware
├── shared/
│   └── schema.ts           # Shared types & Drizzle schema
├── USER_GUIDE.md           # End-user documentation
└── README.md               # This file
```

### Database Schema

**Main Tables**:
- `agents`: Agent configurations, prompts, credentials, LLM settings
- `knowledge_base`: Agent-specific knowledge entries
- `custom_apis`: External API configurations
- `api_keys`: Encrypted credential storage
- `agent_activity`: Monitoring and analytics

**Key Features**:
- Zod validation for type safety
- Drizzle ORM for queries
- JSONB columns for flexible data (message examples, custom prompts)
- Automatic timestamps (lastTestedAt, lastFetchedAt, etc.)

### API Routes

```
GET    /api/agents              # List all agents
POST   /api/agents              # Create agent
GET    /api/agents/:id          # Get agent details
PATCH  /api/agents/:id          # Update agent
DELETE /api/agents/:id          # Delete agent

GET    /api/knowledge-base      # List KB entries (with filters)
POST   /api/knowledge-base      # Create KB entry
PATCH  /api/knowledge-base/:id  # Update KB entry
DELETE /api/knowledge-base/:id  # Delete KB entry

GET    /api/custom-apis         # List APIs
POST   /api/custom-apis         # Create API config
POST   /api/custom-apis/:id/test    # Test API (preview extraction)
POST   /api/custom-apis/:id/ingest  # Ingest to KB
PATCH  /api/custom-apis/:id     # Update API config
DELETE /api/custom-apis/:id     # Delete API config

GET    /api/api-keys            # List API keys (names only)
POST   /api/api-keys            # Add API key
DELETE /api/api-keys/:id        # Delete API key

POST   /api/agents/:id/test/conversation  # Test agent response
```

## 🔒 Security Notes

### API Key Storage

- Keys stored in database with service name reference
- Frontend receives only references (e.g., `OPENAI_API_KEY`)
- Actual keys should be environment variables
- Never expose keys in logs or responses

### Best Practices

1. **Use Environment Variables**: Store production keys in `.env` or Replit Secrets
2. **API Keys Page**: For development/testing keys only
3. **Never Commit Keys**: Add `.env` to `.gitignore`
4. **Rotate Regularly**: Change keys periodically
5. **Monitor Usage**: Set up billing alerts on LLM provider dashboards

## 🧪 Testing

### Manual Testing

Use the **Playground** page to test agent responses:
1. Select an agent
2. Configure parameters (temperature, max tokens)
3. Send test messages
4. Verify responses match expected personality/knowledge

### API Testing

Use the **Test** button on custom APIs:
1. Verifies connection and authentication
2. Shows raw API response
3. Previews JSONPath extraction
4. Displays sample KB entry format

## 🐛 Common Issues

### Problem: JSONPath Returns Zero Items

**Solution**: 
- Check raw API response structure
- Verify field names (case-sensitive)
- Test simpler paths first (e.g., `$.data`)
- Use JSONPath tester: https://jsonpath.com

### Problem: Agent Doesn't Use Knowledge Base

**Solution**:
- Verify KB entries exist for that agent
- Check entries are marked "active"
- Increase priority on important entries
- Test in Playground to see what data agent references

### Problem: High API Costs

**Solution**:
- Reduce `maxTokens` (280 for tweets, not 4000)
- Lower temperature for more deterministic responses
- Use cheaper models for testing (gpt-3.5-turbo)
- Monitor usage on provider dashboards

## 📦 Deployment

### On Replit

1. Database auto-configured ✅
2. Add API keys via **API Keys** page
3. Click **Run** button
4. Use Replit **Publish** feature for production

### Self-Hosted

1. Set up PostgreSQL database
2. Configure environment variables
3. Run migrations: `npm run db:push`
4. Build: `npm run build`
5. Start: `npm start`

## 🤝 Contributing

This is a production application. If extending:

1. **Follow existing patterns**: Storage interface, Zod validation, React Query
2. **Update schemas**: Modify `shared/schema.ts` for database changes
3. **Run migrations**: Use `npm run db:push` (never manual SQL)
4. **Test thoroughly**: Use Playground and API test features
5. **Update documentation**: Keep USER_GUIDE.md current

## 📄 License

Proprietary - Internal Use Only

## 🔗 Resources

- **JSONPath Spec**: https://goessner.net/articles/JsonPath/
- **Drizzle ORM**: https://orm.drizzle.team/
- **OpenAI API**: https://platform.openai.com/docs
- **Anthropic API**: https://docs.anthropic.com/claude
- **shadcn/ui**: https://ui.shadcn.com/
- **TanStack Query**: https://tanstack.com/query

---

**Version**: 1.0  
**Last Updated**: November 2024

For end-user documentation, see [USER_GUIDE.md](./USER_GUIDE.md)
