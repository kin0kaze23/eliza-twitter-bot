# ElizaOS Twitter AI Agent Dashboard - User Guide

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Core Features](#core-features)
4. [Agent Configuration](#agent-configuration)
5. [API Management](#api-management)
6. [Knowledge Base](#knowledge-base)
7. [Playground Testing](#playground-testing)
8. [Important Notes](#important-notes)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The ElizaOS Admin Dashboard is a complete no-code interface for building and managing Twitter AI agents. It allows you to:

- Create and configure multiple AI agents with distinct personalities
- Integrate external data sources (news APIs, crypto prices, any REST API)
- Build knowledge bases from API data or manual entries
- Test agent responses in real-time using actual LLM providers
- Configure posting schedules, reply behaviors, and content modules
- Monitor agent activity and performance

---

## Getting Started

### Prerequisites

Before using the dashboard, you need:

1. **AI Model API Key** (at least one):
   - OpenAI API key (from https://platform.openai.com)
   - OR Anthropic API key (from https://console.anthropic.com)
   - OR other supported providers (Groq, Together AI, Mistral, etc.)

2. **Twitter API Credentials** (for production agents):
   - API Key and Secret
   - Access Token and Secret
   - Bearer Token
   - App ID
   
   Get these from https://developer.twitter.com/en/portal/dashboard

### Initial Setup

1. Navigate to **API Keys** page
2. Add your AI provider credentials:
   - Service Name: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
   - API Key: Your actual key
   - Click **Add API Key**

3. (Optional) Add Twitter credentials for each agent when ready to deploy

---

## Core Features

### Dashboard
- View all configured agents at a glance
- Quick status overview (active/inactive)
- Navigation hub to other features

### Agents Page
- Create new agents
- View all agents in a list
- Edit or delete existing agents
- Click any agent to access detailed configuration

---

## Agent Configuration

### Creating an Agent

1. Go to **Agents** page
2. Click **Create New Agent**
3. Fill in basic information:
   - **Name**: Agent's display name (e.g., "Crypto Commentary Bot")
   - **Username**: Twitter handle (e.g., "@cryptobot")
   - **Bio**: Short description
   - **Status**: Active/Inactive

### Draft Mode - Save Partial Configurations

**NEW FEATURE**: You can now save agents as drafts without filling in all required fields!

**How it Works**:
- Only **Name** and **Username** are required to save an agent
- All other fields (prompts, credentials, model config) are optional
- Click **Save Configuration** at any time to persist your progress
- Return later to complete the configuration

**Use Cases**:
- Start configuring an agent and finish later
- Test different configurations incrementally
- Save Twitter credentials first, then add prompts
- Build configurations step-by-step without pressure

**Important**: Set status to "Active" only when you're ready to deploy. Keep it as "Draft" or "Inactive" while still configuring.

### Configuration Tabs

#### 1. Prompts Tab
Define your agent's personality and behavior:

- **System Prompt**: Core instructions for the AI (e.g., "You are a helpful crypto analyst")
- **Personality**: Character traits (e.g., "Professional, analytical, slightly humorous")
- **Style Guidelines**: Writing style (e.g., "Use short sentences, avoid jargon")
- **Topics**: Areas of expertise (e.g., "Bitcoin, Ethereum, DeFi, NFTs")
- **Adjectives**: Tone descriptors (e.g., "insightful, balanced, data-driven")
- **Message Examples**: Sample tweets to mimic (one per line)
- **Custom Prompts**: Additional instructions in JSON format

**Best Practice**: Be specific and consistent in your prompts. The AI will follow these guidelines closely.

#### 2. Credentials Tab
API authentication for Twitter and AI models:

**Twitter API** (all 6 required for production):
- API Key
- API Secret
- Access Token
- Access Token Secret
- Bearer Token
- App ID

**Testing Twitter Credentials**:
1. Fill in your Twitter Bearer Token in the form
2. Click **Save Configuration** to persist the credentials
3. Click **Test Connection** button at the bottom of the Twitter Credentials section
4. The system will authenticate with Twitter API v2 to verify your credentials
5. Success: Shows your Twitter username and user ID
6. Error: Displays helpful hints (e.g., "Bearer token is invalid or expired")

**Note**: You must save your credentials before testing them. The test validates the saved credentials in the database, not just what's in the form.

**AI Model Configuration**:
- **Provider**: Select from 11 supported providers
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic (Claude 3.5, Claude 3)
  - Groq, Together AI, Mistral, Cohere
  - Replicate, Hugging Face
  - Ollama, vLLM, LocalAI (for self-hosted)
  
- **Model Name**: Specific model (e.g., "gpt-4", "claude-3-5-sonnet-20241022")
- **API Key Reference**: Name of the environment variable storing your key

**Important**: The dashboard stores API key references (like `OPENAI_API_KEY`), not the actual keys. Add your real keys via the **API Keys** page first.

#### 3. Behavior Tab
Control posting and engagement patterns:

**Posting Schedule**:
- **Frequency**: How often to post (hourly, daily, custom)
- **Intervals**: Specific times or randomized
- **Quiet Hours**: When NOT to post (e.g., 11pm-6am)
- **Timezone**: Your local timezone

**Reply Behavior**:
- **Reply Rate**: % of mentions to respond to (0-100%)
- **Min/Max Delay**: Humanize response timing
- **Reply to Verified Only**: Filter by account verification
- **Keyword Whitelist**: Only reply to tweets with these words
- **Keyword Blacklist**: Never reply to tweets with these words

**Best Practice**: Start conservative (low reply rate, narrow keywords) and increase gradually.

#### 4. Knowledge Base Tab
Link to the main Knowledge Base feature for this agent's specific knowledge entries.

#### 5. Settings Tab
Advanced configurations:

**LLM Parameters** (fine-tune model behavior):
- **Temperature**: Creativity level (0.0-2.0)
  - 0.0 = Deterministic, factual
  - 0.7 = Balanced (recommended)
  - 1.5+ = Very creative, unpredictable
  
- **Max Tokens**: Response length limit (100-4000)
  - 100 = Short tweets
  - 280 = Standard tweet length
  - 1000+ = Threads/long responses
  
- **Top P**: Diversity of word choice (0.0-1.0)
  - 0.9 = Recommended default
  
- **Frequency Penalty**: Avoid repetition (-2.0 to 2.0)
  - 0.5 = Slight variation
  
- **Presence Penalty**: Explore new topics (-2.0 to 2.0)
  - 0.5 = Moderate exploration

- **Context Window**: Memory size (1000-128000 tokens)
  - 4000 = Basic conversations
  - 16000+ = Long context memory

**Content Modules** (enable/disable features):
- Crypto Commentary
- Market Analysis
- News Aggregation
- Thread Creation
- Meme Generation

**Triggers** (automated actions):
- Price thresholds (e.g., "Tweet when BTC moves 5%")
- Volume alerts
- Auto-tweet on breaking news

---

## API Management

Connect external data sources to populate your agent's knowledge base.

### Adding a Custom API

1. Go to **API Management** page
2. Click **Add Custom API**
3. Configure the API:

**Basic Information**:
- **Name**: Descriptive name (e.g., "CoinGecko BTC Price")
- **Category**: Organization tag (e.g., "crypto", "news")
- **URL**: Full API endpoint
- **Method**: GET, POST, PUT, PATCH, DELETE

**Authentication** (if required):
- **Auth Type**: None, Header, Bearer, Basic
- **Header Name**: Custom header (e.g., "X-API-Key")
- **API Key Reference**: Environment variable name

**Query Parameters** (optional):
Add key-value pairs to append to URL
- Example: `currency=usd`, `limit=10`

**Request Body** (for POST/PUT/PATCH):
JSON payload to send with request

### JSONPath Extraction

**Critical Feature**: Extract specific data from API responses using JSONPath syntax.

**How It Works**:
- API returns nested JSON
- JSONPath extracts only the data you need
- Data becomes knowledge base entries

**JSONPath Patterns**:

| Pattern | Description | Example Use |
|---------|-------------|-------------|
| `$` | Root object | Entire response |
| `$.data` | Single field | Get data object |
| `$.data.articles` | Nested field | Get articles array |
| `$.data.articles[*]` | **Array wildcard** | Get all articles |
| `$.items[*].title` | Nested array item | Get all titles |
| `$..price` | Recursive search | Find all price fields |
| `$.data[0]` | Array index | Get first item |

**Common API Response Structure**:
```json
{
  "status": "success",
  "data": {
    "articles": [
      {
        "id": 1,
        "title": "Breaking News",
        "content": "Full article text...",
        "published_at": "2024-01-15"
      },
      {
        "id": 2,
        "title": "Another Story",
        "content": "More content...",
        "published_at": "2024-01-16"
      }
    ]
  }
}
```

**JSONPath Configuration**:
- **JSON Path**: `$.data.articles[*]` (extracts array of articles)
- **Title Path**: `$.title` (extracts title from each article)
- **Content Path**: `$.content` (extracts content from each article)

**⚠️ Important Notes**:
- Always use `[*]` for arrays (not `[0]` unless you want only first item)
- Test your JSONPath before ingesting (use **Test** button)
- Title/Content paths are relative to each extracted item
- Paths are case-sensitive (`$.Title` ≠ `$.title`)

### Testing APIs

**Before ingesting data**, always test:

1. Click **Test** button on any API
2. Review the response:
   - **Raw Response**: Full API output
   - **Extracted Data**: What JSONPath captured
   - **Extracted Count**: Number of items found
   - **Preview KB Entry**: Sample of how it will be stored

3. Verify extraction is correct:
   - Title should be meaningful (not "Untitled")
   - Content should be the full data you want
   - Count should match expected number of items

**Common Issues**:
- ❌ Count = 0: JSONPath is incorrect
- ❌ Title = "Untitled": Title path doesn't match response structure
- ❌ Content = raw JSON: Content path not specified or wrong

### Ingesting Data to Knowledge Base

Once testing confirms correct extraction:

1. Select target agent from dropdown
2. Click **Ingest to KB** button
3. System will:
   - Fetch latest API data
   - Extract items using JSONPath
   - Create up to 20 knowledge base entries
   - Tag them as "auto-generated" and "api-ingestion"

**Result**: Agent now has access to this data in conversations!

### Real-World Examples

**Example 1: CoinGecko Crypto Prices**
```
URL: https://api.coingecko.com/api/v3/coins/markets
Method: GET
Query Params:
  vs_currency: usd
  order: market_cap_desc
  per_page: 10

JSON Path: $[*]
Title Path: $.name
Content Path: $.current_price
```

**Example 2: News API**
```
URL: https://newsapi.org/v2/top-headlines
Method: GET
Auth Type: Header
Header Name: X-Api-Key
API Key Reference: NEWS_API_KEY
Query Params:
  category: technology
  country: us

JSON Path: $.articles[*]
Title Path: $.title
Content Path: $.description
```

**Example 3: Custom REST API**
```
URL: https://api.example.com/v1/data
Method: POST
Auth Type: Bearer
API Key Reference: CUSTOM_API_TOKEN
Request Body:
{
  "filters": {
    "category": "crypto",
    "limit": 20
  }
}

JSON Path: $.response.items[*]
Title Path: $.heading
Content Path: $.body_text
```

---

## Knowledge Base

Manage what your agents know.

### Adding Manual Entries

1. Go to **KB Snippets** page
2. Click **Add New Entry**
3. Fill in:
   - **Title**: Short descriptor
   - **Content**: Full knowledge text
   - **Tags**: Searchable keywords (comma-separated)
   - **Category**: Organization (e.g., "facts", "guidelines")
   - **Priority**: 1-10 (higher = more important)
   - **Agent**: Which agent this applies to
   - **Active**: Enable/disable without deleting

### Auto-Generated Entries

Entries created from API ingestion include:
- **Source**: API name
- **Source URL**: Original API endpoint
- **Last Fetched**: When data was retrieved
- **Refresh Strategy**: Manual or automatic

### Best Practices

1. **Keep entries focused**: One concept per entry
2. **Use descriptive titles**: Makes searching easier
3. **Tag consistently**: Use same tags across similar content
4. **Set appropriate priority**: 
   - 1-3: Background info
   - 4-6: Standard knowledge
   - 7-10: Critical facts the agent must know
5. **Review auto-generated entries**: Edit titles/content for clarity
6. **Archive old data**: Set inactive rather than delete

---

## Playground Testing

Test your agent's responses before deploying to Twitter.

### Using the Playground

1. Go to **Playground** page
2. Select an agent from dropdown
3. Configure test parameters:
   - **Temperature**: Override agent's default
   - **Max Tokens**: Control response length
   - **System Prompt**: Temporarily modify behavior
4. Enter a test message
5. Click **Send**
6. Review response in real-time

### What Gets Tested

- Agent's configured personality and prompts
- Knowledge base integration (agent uses its KB)
- LLM provider connection (OpenAI/Anthropic)
- Model parameters (temperature, tokens, etc.)

### Testing Scenarios

**Scenario 1: Personality Check**
- Test Message: "What's your opinion on Bitcoin?"
- Expected: Response matches personality/style from prompts

**Scenario 2: Knowledge Verification**
- Test Message: "What were the latest news headlines?"
- Expected: Agent references KB entries from ingested APIs

**Scenario 3: Parameter Tuning**
- Try different temperatures (0.3, 0.7, 1.2)
- Compare creativity and consistency
- Adjust agent settings accordingly

**⚠️ Important**: 
- Playground uses REAL API calls (costs apply)
- Responses use actual LLM providers, not mock data
- Test thoroughly but be mindful of API usage costs

---

## Important Notes

### API Keys & Security

✅ **DO**:
- Store API keys in the **API Keys** page
- Use environment variable names in agent config
- Keep keys private and never share screenshots with keys visible

❌ **DON'T**:
- Hardcode API keys in prompts or content
- Share keys in public repositories
- Use production keys for testing (use separate test keys)

### JSONPath Extraction

✅ **DO**:
- Always test extraction before ingesting
- Use `[*]` for arrays to get all items
- Verify title/content paths return expected data
- Check extracted count matches your expectations

❌ **DON'T**:
- Skip testing (you'll ingest bad data)
- Assume JSONPath syntax (it's different from JavaScript)
- Use nested paths in main JSONPath (use in title/content paths)
- Forget that paths are case-sensitive

### LLM Configuration

✅ **DO**:
- Start with defaults (temperature: 0.7, top_p: 0.9)
- Test in Playground before deploying
- Use context window appropriate for your use case
- Set max tokens to control costs

❌ **DON'T**:
- Use temperature > 1.5 for factual content
- Set max tokens too low (responses get cut off)
- Ignore frequency/presence penalties (causes repetition)
- Use tiny context windows for complex conversations

### Agent Deployment

✅ **DO**:
- Test thoroughly in Playground first
- Start with conservative reply rates (10-20%)
- Use quiet hours to avoid late-night posting
- Monitor initial deployments closely
- Build robust knowledge base before going live

❌ **DON'T**:
- Deploy with incomplete Twitter credentials
- Set 100% reply rate initially (rate limits)
- Use production agents for testing
- Forget to set appropriate content filters
- Deploy without testing knowledge base integration

### Knowledge Base Management

✅ **DO**:
- Regularly refresh API data
- Archive outdated entries (set inactive)
- Use consistent tagging
- Prioritize critical information (priority 8-10)
- Review auto-generated titles for clarity

❌ **DON'T**:
- Let stale data accumulate
- Delete entries (set inactive instead)
- Overload with low-priority content
- Ignore source attribution
- Duplicate information across entries

---

## Troubleshooting

### Problem: API Test Returns Zero Items

**Causes**:
- Incorrect JSONPath syntax
- Wrong field names (case-sensitive)
- API returned different structure than expected

**Solutions**:
1. Check raw response structure in test results
2. Verify field names match exactly (case-sensitive)
3. Use `$[*]` for root-level arrays
4. Use `$.data.items[*]` for nested arrays
5. Try simpler path first (e.g., `$.data` to see structure)

### Problem: Playground Returns Error

**Causes**:
- No API key configured for selected provider
- Invalid API key
- No agent selected
- Rate limiting

**Solutions**:
1. Go to **API Keys** page and verify key exists
2. Check agent has model provider configured
3. Verify API key is valid (test on provider's website)
4. Wait a few minutes if rate limited
5. Check browser console for detailed error messages

### Problem: Knowledge Base Entries Have "Untitled"

**Causes**:
- Title Path doesn't match response structure
- Title field is empty in source data
- Path typo or incorrect case

**Solutions**:
1. Test API first and check preview entry
2. Look at raw response to find correct field name
3. Update Title Path to match actual field
4. Re-test before ingesting
5. Manually edit entries if needed

### Problem: Agent Responses Are Too Random/Repetitive

**Causes**:
- Temperature setting too high/low
- Frequency/presence penalties not configured
- Insufficient knowledge base

**Solutions**:
- **Too random**: Lower temperature to 0.5-0.7
- **Too repetitive**: Increase frequency penalty to 0.5-1.0
- **Too similar**: Increase presence penalty to 0.3-0.5
- **Off-topic**: Add more knowledge base entries
- **Ignoring prompts**: Make system prompt more specific

### Problem: API Authentication Fails

**Causes**:
- Wrong auth type selected
- API key not added to API Keys page
- Header name incorrect
- Bearer/Basic format issues

**Solutions**:
1. Check API documentation for auth requirements
2. Add API key via **API Keys** page first
3. Use exact header name from API docs
4. For Bearer: Select "Bearer" type (dashboard adds "Bearer " prefix)
5. For Custom: Select "Header" and specify exact header name
6. Test with a tool like Postman first to confirm auth works

### Problem: Rate Limiting or High Costs

**Causes**:
- Too many API calls
- High max tokens setting
- Reply rate too aggressive
- Testing too frequently

**Solutions**:
1. Reduce max tokens (280 for tweets, not 4000)
2. Lower reply rate in agent config
3. Use quiet hours effectively
4. Add delays between responses
5. Test in Playground sparingly
6. Monitor API usage dashboards (OpenAI/Anthropic)
7. Set up billing alerts on your LLM provider account

---

## Quick Reference

### Recommended Starting Configuration

**For News/Commentary Bot**:
```
Temperature: 0.7
Max Tokens: 280
Top P: 0.9
Frequency Penalty: 0.5
Reply Rate: 15%
Posting Frequency: Every 4 hours
```

**For Customer Support Bot**:
```
Temperature: 0.3
Max Tokens: 500
Top P: 0.9
Frequency Penalty: 0.3
Reply Rate: 80%
Response Delay: 1-5 minutes
```

**For Creative Content Bot**:
```
Temperature: 1.0
Max Tokens: 280
Top P: 0.95
Presence Penalty: 0.6
Posting Frequency: Daily
```

### Common JSONPath Patterns

```
Root array:           $[*]
Nested array:         $.data.items[*]
Deep nested:          $.response.data.articles[*]
All prices:           $..price
First item:           $.items[0]
Last item:            $.items[-1]
Specific indices:     $.items[0,2,4]
Conditional:          $.items[?(@.price < 100)]
```

### API Provider Model Names

**OpenAI**:
- `gpt-4-turbo-preview`
- `gpt-4`
- `gpt-3.5-turbo`

**Anthropic**:
- `claude-3-5-sonnet-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`

**Groq**:
- `mixtral-8x7b-32768`
- `llama2-70b-4096`

---

## Support & Resources

- **JSONPath Tester**: https://jsonpath.com (test your paths)
- **API Testing**: Use Postman or curl before configuring
- **OpenAI Models**: https://platform.openai.com/docs/models
- **Anthropic Models**: https://docs.anthropic.com/claude/docs/models-overview
- **Twitter API**: https://developer.twitter.com/en/docs

---

**Dashboard Version**: 1.0  
**Last Updated**: November 2024

For additional help, consult the error messages in the application - they provide specific guidance for most common issues.
