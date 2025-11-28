# Knowledge Base Management Guide

## Overview

The Knowledge Base system allows your AI agents to access up-to-date information from external APIs (news, crypto prices, market data, etc.). This guide explains the simplified workflow for setting up and managing your agent's knowledge.

---

## 🎯 Quick Start: 4-Step Workflow

### Step 1: Set Up API Sources

**Where:** `Knowledge Sources` page (in the sidebar under "Data Sources")

1. Click **"Add API Source"**
2. Fill in basic details:
   - **Name**: e.g., "GNews Headlines", "CoinGecko Prices"
   - **Description**: What this API provides
   - **Base URL**: The API endpoint (e.g., `https://gnews.io/api/v4/top-headlines`)
   - **Method**: Usually `GET`

3. Configure authentication (if needed):
   - **Auth Type**: Choose `none`, `bearer`, `api_key`, or `basic`
   - **Auth Key Environment Variable**: Enter your API key name from Replit Secrets (e.g., `GNEWS_API_KEY`)
   - The system will automatically use the secret value from your environment

4. Set up data extraction:
   - **JSON Path**: Extract the array of items (e.g., `$.articles[*]`)
   - **Title Path**: Extract title from each item (e.g., `$.title`)
   - **Content Path**: Extract content from each item (e.g., `$.description`)

5. Click **"Create API Source"**

---

### Step 2: Test & Fetch Data

**Where:** `Knowledge Sources` page

1. Find your newly created API source in the list
2. Click the **"Test"** button (▶️ icon)
3. Review the test results:
   - ✅ **Status: 200 OK** = Working correctly
   - ✅ **Items Extracted**: Shows how many articles/items were found
   - ✅ **Preview**: See sample data that will be ingested

4. Once the test succeeds, scroll down to find the **"Ingest to Agent"** section
5. Select your agent from the dropdown
6. Click **"Ingest Now"** to pull fresh content into the agent's knowledge base

---

### Step 3: Review & Approve Content

**Where:** Your Agent → Configure → `Knowledge Base` tab → `Review Queue`

1. Navigate to your agent's configuration page
2. Click the **"Knowledge Base"** tab
3. Select the **"Review Queue"** sub-tab
4. You'll see all newly ingested entries waiting for approval:
   - Each entry shows: **Title**, **Content preview**, **Tags**, **Source**
   - Check the boxes next to entries you want to approve
   - Click **"Approve"** to activate them (they'll be used in conversations)
   - Click **"Archive"** to remove unwanted entries

**Tip:** Use "Select All" for batch operations if you trust the source

---

### Step 4: Manage Active Knowledge

**Where:** Your Agent → Configure → `Knowledge Base` tab → `Active Knowledge`

1. Switch to the **"Active Knowledge"** sub-tab
2. Here you'll see all approved entries that your agent can use
3. To remove outdated knowledge:
   - Click the trash icon (🗑️) next to any entry
   - Confirm deletion

4. To refresh knowledge:
   - Go back to `Knowledge Sources`
   - Click **"Ingest Now"** again on your API source
   - New/updated entries will appear in the Review Queue

---

## 🔧 Advanced Configuration

### Auto-Refresh (Polling)

**Where:** `Knowledge Sources` page → Edit your API source

1. Edit an existing API source
2. Scroll to **"Refresh Interval"**
3. Set the interval in minutes (e.g., `60` = refresh every hour)
4. The system will automatically fetch new data and add it to the Review Queue
5. You'll still need to manually approve new entries

### Query Parameters

For APIs that require parameters (e.g., `?apikey=xxx&country=us`):

1. In the API source form, find **"Query Parameters"**
2. Enter as JSON:
   ```json
   {
     "apikey": "your-key-here",
     "country": "us",
     "max": 10
   }
   ```

### Custom Headers

For APIs requiring custom headers:

1. Find **"Headers"** in the API source form
2. Enter as JSON:
   ```json
   {
     "User-Agent": "ElizaOS-Agent/1.0",
     "Accept": "application/json"
   }
   ```

---

## 🌐 Recommended API Sources

### News APIs
- **GNews API** - `https://gnews.io/api/v4/top-headlines`
  - JSONPath: `$.articles[*]`
  - Title: `$.title`
  - Content: `$.description`

- **NewsAPI** - `https://newsapi.org/v2/top-headlines`
  - JSONPath: `$.articles[*]`
  - Title: `$.title`
  - Content: `$.content`

### Crypto Data
- **CoinGecko** - `https://api.coingecko.com/api/v3/coins/markets`
  - JSONPath: `$[*]`
  - Title: `$.name`
  - Content: Combine `$.current_price` and `$.price_change_percentage_24h`

- **DexScreener** - `https://api.dexscreener.com/latest/dex/tokens/{address}`
  - JSONPath: `$.pairs[*]`
  - Title: `$.baseToken.name`
  - Content: Combine `$.priceUsd` and `$.volume.h24`

---

## 🔐 API Key Management

**Where:** Replit Secrets (not in the app UI)

1. Go to your Replit project
2. Click the **"Secrets"** tab (🔐 icon in sidebar)
3. Add your API keys:
   - Key name: `GNEWS_API_KEY`
   - Value: `your-actual-api-key-here`

4. Reference them in API sources using the key name (e.g., `GNEWS_API_KEY`)
5. The system will automatically fetch the value from Replit Secrets

**Why this approach?**
- 🔒 Secrets never appear in your code or UI
- 🔄 Easy to rotate keys without changing configuration
- 👥 Works seamlessly with team members

---

## 📊 Knowledge Entry Lifecycle

```
API Source (configured)
     ↓
Test Connection (verify it works)
     ↓
Ingest to Agent (fetch fresh data)
     ↓
Review Queue (pending approval) ← You are here
     ↓
Approve/Archive (your decision)
     ↓
Active Knowledge (used in conversations)
     ↓
Delete (when outdated)
```

---

## ❓ Common Issues

### "jp.query is not a function" Error
**Fixed!** This was caused by incorrect JSONPath import. The latest version resolves this automatically.

### "0 Items Extracted"
**Causes:**
- Incorrect JSON Path - Use the Test feature to preview your API response structure
- API returned no data - Check if the API endpoint is working
- Auth failed - Verify your API key is correct in Replit Secrets

**Solution:**
1. Click "Show Raw Response" in test results
2. Inspect the JSON structure
3. Adjust your JSON Path accordingly (use online JSONPath testers if needed)

### No Entries in Review Queue
**Causes:**
- You haven't run "Ingest to Agent" yet
- All entries were already approved/archived

**Solution:**
- Go to Knowledge Sources → Click "Ingest Now" on your API source
- New entries will appear in Review Queue immediately

---

## 💡 Best Practices

1. **Test First, Ingest Later**
   - Always test your API source before ingesting
   - Verify the extracted data looks correct

2. **Review Regularly**
   - Check your Review Queue daily if you have auto-refresh enabled
   - Archive low-quality or irrelevant entries

3. **Organize with Tags**
   - Manually added entries should have clear tags
   - Use categories like: `crypto`, `news`, `market-analysis`

4. **Refresh Strategically**
   - News: Every 30-60 minutes
   - Crypto prices: Every 5-15 minutes
   - General data: Every 1-24 hours

5. **Monitor Active Knowledge Size**
   - Keep it under 50-100 entries for optimal performance
   - Delete outdated entries regularly

---

## 🚀 Next Steps

1. **Set up your first API source** - Try GNews API (free tier available)
2. **Test the connection** - Verify data extraction works
3. **Ingest to your agent** - Pull in fresh content
4. **Approve entries** - Review and activate knowledge
5. **Test in Playground** - See your agent use the knowledge in conversations!

Need help? The in-app workflow guide (in the Knowledge Base tab) provides quick reference.
