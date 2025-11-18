# Quick Start Guide - ElizaOS Admin Dashboard

Get your first AI agent running in 5 minutes.

## Step 1: Add Your API Key (2 minutes)

1. Navigate to **API Keys** page
2. Click **Add API Key**
3. Enter:
   - Service Name: `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`)
   - API Key: Your actual key from the provider
4. Click **Add API Key**

**Get API Keys**:
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys

---

## Step 2: Create Your First Agent (1 minute)

1. Go to **Agents** page
2. Click **Create New Agent**
3. Fill in basics:
   - Name: `Test Bot`
   - Username: `@testbot`
   - Bio: `A helpful AI assistant`
   - Status: `Active`
4. Click **Create Agent**

---

## Step 3: Configure LLM Settings (1 minute)

1. Click on your new agent to open configuration
2. Go to **Credentials** tab
3. Set:
   - **Provider**: `openai` (or `anthropic`)
   - **Model Name**: `gpt-3.5-turbo` (or `claude-3-5-sonnet-20241022`)
   - **API Key Reference**: `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`)
4. Go to **Settings** tab
5. Set (or leave defaults):
   - **Temperature**: `0.7`
   - **Max Tokens**: `280`
6. Click **Save**

---

## Step 4: Test in Playground (1 minute)

1. Go to **Playground** page
2. Select your agent from dropdown
3. Type a message: `What can you help me with?`
4. Click **Send**
5. See real AI response! 🎉

---

## Next Steps

### Add Knowledge Base

**Option A: Manual Entry**
1. Go to **KB Snippets**
2. Click **Add New Entry**
3. Fill in Title and Content
4. Select your agent
5. Test in Playground - agent will use this knowledge!

**Option B: API Integration**
1. Go to **API Management**
2. Click **Add Custom API**
3. Example: CoinGecko
   - Name: `Bitcoin Price`
   - URL: `https://api.coingecko.com/api/v3/coins/markets`
   - Method: `GET`
   - Query Params: `vs_currency=usd`, `per_page=1`
   - JSON Path: `$[*]`
   - Title Path: `$.name`
   - Content Path: `$.current_price`
4. Click **Test** - verify extraction works
5. Click **Ingest to KB** - select your agent
6. Go to Playground and ask: `What's the Bitcoin price?`

### Fine-Tune Personality

Go to **Prompts** tab on your agent:
- **System Prompt**: `You are a friendly crypto expert who explains things simply`
- **Personality**: `Helpful, enthusiastic, uses analogies`
- **Style Guidelines**: `Keep tweets under 280 characters, use emojis sparingly`

Test changes immediately in Playground!

### Configure Posting Behavior

Go to **Behavior** tab:
- **Posting Frequency**: `Every 4 hours`
- **Reply Rate**: `20%` (conservative start)
- **Quiet Hours**: `11:00 PM - 6:00 AM`
- **Timezone**: Your timezone

---

## Important Quick Tips

### ✅ DO
- **Test in Playground first** before deploying to Twitter
- **Start with low reply rates** (10-20%)
- **Use Test button** on APIs before ingesting
- **Keep max tokens low** (280) to save costs
- **Review extracted data** before creating KB entries

### ❌ DON'T
- Deploy to Twitter without testing responses
- Use 100% reply rate (you'll hit rate limits)
- Skip API testing (bad extraction = bad knowledge)
- Set max tokens too high (expensive!)
- Forget to add API keys first

---

## Common First-Time Issues

### Problem: Playground Shows Error
**Fix**: Did you add an API key? Go to **API Keys** page first.

### Problem: Agent Doesn't Know Things
**Fix**: Add knowledge! Either manually (KB Snippets) or via API ingestion.

### Problem: JSONPath Returns Nothing
**Fix**: Click **Test** button first. Check the raw response. Adjust paths to match actual structure.

### Problem: Responses Too Random
**Fix**: Lower temperature to 0.3-0.5 in Settings tab.

### Problem: Responses Too Boring
**Fix**: Increase temperature to 1.0-1.2 in Settings tab.

---

## JSONPath Cheat Sheet

Most APIs return arrays of items. Use these patterns:

```
Root array:           $[*]
Nested array:         $.data.articles[*]
Deep nested:          $.response.data.items[*]
All prices anywhere:  $..price
```

**Title/Content paths** extract from EACH item:
```
Title Path:    $.title
Content Path:  $.description
```

**Example**:
```json
{
  "data": {
    "articles": [
      {"title": "News 1", "body": "Content 1"},
      {"title": "News 2", "body": "Content 2"}
    ]
  }
}
```

Configuration:
- JSON Path: `$.data.articles[*]`
- Title Path: `$.title`
- Content Path: `$.body`

Result: 2 KB entries with titles "News 1" and "News 2"

---

## Success Checklist

After 5 minutes you should have:
- ✅ API key added
- ✅ Agent created and configured
- ✅ Successfully tested in Playground
- ✅ (Optional) Knowledge base populated
- ✅ (Optional) Personality customized

Ready to go deeper? Read [USER_GUIDE.md](./USER_GUIDE.md) for complete documentation!

---

**Need Help?**
- Full guide: [USER_GUIDE.md](./USER_GUIDE.md)
- Technical docs: [README.md](./README.md)
- JSONPath tester: https://jsonpath.com
