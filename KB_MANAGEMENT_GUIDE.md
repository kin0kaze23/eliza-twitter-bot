# Knowledge Base Management Guide

## Overview

The Knowledge Base (KB) is your agent's memory and information source. It stores facts, data, and context that your agent uses when generating responses. This guide covers everything you need to know about adding, reviewing, and managing knowledge for your AI agents.

## Table of Contents

1. [Understanding the Knowledge Base](#understanding-the-knowledge-base)
2. [Adding Knowledge Manually](#adding-knowledge-manually)
3. [Using Custom APIs for Automatic Data Ingestion](#using-custom-apis-for-automatic-data-ingestion)
4. [Reviewing Pending Entries](#reviewing-pending-entries)
5. [Managing Active Knowledge](#managing-active-knowledge)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Understanding the Knowledge Base

### What is the Knowledge Base?

Your agent's Knowledge Base is a collection of information entries that the agent can reference when creating tweets or replies. Each entry contains:

- **Content**: The actual information (fact, data point, news, etc.)
- **Category**: How the entry is organized (e.g., "market_data", "news", "facts")
- **Tags**: Keywords for easy filtering
- **Priority**: How important this entry is (1-10, where 10 is highest)
- **Source**: Where this information came from
- **Status**: pending, approved, or archived

### The Review Workflow

The KB uses a review system similar to aixbt to ensure quality:

```
API Ingestion → Pending Review → Manual Approval → Active Knowledge → Used in Conversations
```

**Key Points:**
- New entries start as **pending** and are NOT used by your agent
- You must **manually review and approve** entries before they become active
- Only **approved** entries are used when your agent generates responses
- You can **archive** entries you don't want without deleting them

---

## Adding Knowledge Manually

### Step 1: Navigate to Knowledge Base Tab

1. Go to **Agents** page
2. Click on your agent
3. Click the **Knowledge Base** tab

### Step 2: Add a New Entry

1. Scroll to the "Add New Knowledge Entry" form
2. Fill in the fields:
   - **Content**: The information you want to add (required)
   - **Category**: Group similar entries together (e.g., "crypto_facts", "news")
   - **Tags**: Comma-separated keywords (e.g., "bitcoin, price, bullish")
   - **Priority**: 1-10 (higher = more important, more likely to be included)
   - **Source**: Where this info came from (optional)
   - **Active**: Check to make it immediately available to your agent

3. Click **Add Entry**

### Manual Entry Best Practices

**Good Example:**
```
Content: Bitcoin reached an all-time high of $69,000 in November 2021
Category: market_data
Tags: bitcoin, ATH, 2021, price
Priority: 8
Source: CoinGecko Historical Data
```

**Tips:**
- Be specific and factual
- Use consistent categories across entries
- Higher priority for time-sensitive or critical information
- Lower priority for general background information

---

## Using Custom APIs for Automatic Data Ingestion

Custom APIs allow you to automatically fetch and ingest data from external sources into your Knowledge Base. This is perfect for staying updated with live market data, news, or any other real-time information.

### Step 1: Set Up a Custom API

1. Go to the **Custom APIs** page
2. Click **Add New API**
3. Configure your API:
   - **Name**: Descriptive name (e.g., "Bitcoin Price Feed")
   - **URL**: The API endpoint (e.g., `https://api.coingecko.com/api/v3/simple/price`)
   - **Method**: Usually GET for data fetching
   - **Headers**: Any required headers (API keys, content-type, etc.)
   - **Query Parameters**: URL parameters (e.g., `ids=bitcoin&vs_currencies=usd`)
   - **Body**: For POST requests (usually not needed for data fetching)

### Step 2: Test the API Response

1. Click **Test API** to see the raw response
2. Review the JSON structure to identify what data you want to extract

**Example Response:**
```json
{
  "bitcoin": {
    "usd": 43250.50
  }
}
```

### Step 3: Configure Data Extraction

Use **JSONPath** to extract specific values from the API response:

1. In the **JSONPath Expression** field, enter a path to the data you want
2. Click **Test Extraction** to preview what will be extracted

**Example JSONPath Expressions:**
```
$.bitcoin.usd                    → Extracts: 43250.50
$.data[*].title                  → Extracts all titles from a data array
$.news[0].headline               → Extracts first news headline
$..price                         → Extracts all "price" fields recursively
```

**JSONPath Syntax Quick Reference:**
- `$` = root of the document
- `.` = child element
- `[0]` = first array element
- `[*]` = all array elements
- `..` = recursive descent (search all levels)

### Step 4: Configure Ingestion

1. **Target Agent**: Select which agent should receive this data
2. **Category**: What category to assign ingested entries (e.g., "price_data")
3. **Tags**: Tags to automatically apply (e.g., "bitcoin, live_price")
4. **Priority**: Default priority for ingested entries (1-10)
5. **Polling Interval**: How often to fetch data (in minutes)
   - 5 minutes = very frequent updates
   - 60 minutes = hourly updates
   - 1440 minutes = daily updates

6. Click **Save API Configuration**

### Step 5: Enable Polling

1. Toggle **Enable Polling** to ON
2. The system will now automatically fetch data at your specified interval
3. New entries will be created as **pending** and appear in the Review Queue

### Real-World Example: Bitcoin Price Tracking

**API Configuration:**
```
Name: CoinGecko Bitcoin Price
URL: https://api.coingecko.com/api/v3/simple/price
Method: GET
Query Params: ids=bitcoin&vs_currencies=usd
JSONPath: $.bitcoin.usd
Target Agent: @crypto_analyst
Category: market_data
Tags: bitcoin, price, live
Priority: 9
Polling Interval: 15 minutes
```

**Result:** Every 15 minutes, a new pending KB entry is created:
```
Content: 43250.50
Category: market_data
Tags: bitcoin, price, live
Priority: 9
Status: pending
```

### Advanced Example: News Headlines

**API Configuration:**
```
Name: Crypto News Feed
URL: https://api.cryptonews.com/v1/headlines
Method: GET
Headers: X-API-Key: your_api_key_here
JSONPath: $.articles[*].headline
Target Agent: @crypto_news_bot
Category: news
Tags: crypto, headlines, breaking
Priority: 8
Polling Interval: 30 minutes
```

**Result:** Creates multiple pending entries, one for each headline extracted.

---

## Reviewing Pending Entries

All automatically ingested data (and manually added pending entries) must be reviewed before they become active.

### Step 1: Access Review Queue

1. Go to your agent's **Knowledge Base** tab
2. Click the **Review Queue** sub-tab
3. You'll see all pending entries waiting for review

### Step 2: Review Each Entry

For each pending entry, check:
- **Content**: Is the information accurate and useful?
- **Category**: Is it categorized correctly?
- **Tags**: Are the tags appropriate?
- **Priority**: Does the priority level make sense?
- **Source**: Where did this come from?

### Step 3: Approve or Archive

**To Approve Single Entries:**
1. Click the checkbox next to entries you want to approve
2. Click **Approve Selected** button
3. Entries move to Active Knowledge and become available to your agent

**To Archive Unwanted Entries:**
1. Click the checkbox next to entries you want to remove
2. Click **Archive Selected** button
3. Entries are archived and won't appear in either tab

**Keyboard Shortcuts:**
- Click checkbox while holding Shift to select a range
- Click "Select All" to review everything at once

### Review Tips

**Approve entries that are:**
- Factually accurate
- Relevant to your agent's purpose
- Well-formatted and clear
- Recent and timely (for time-sensitive data)

**Archive entries that are:**
- Duplicate information
- Outdated or stale
- Irrelevant to your agent's topics
- Poorly formatted or confusing
- From unreliable sources

### Batch Operations

For efficiency, you can review multiple entries at once:

1. **Select multiple entries** using checkboxes
2. **Approve all selected** to bulk-approve quality entries
3. **Archive all selected** to bulk-remove unwanted entries

**Example Workflow:**
```
Morning Review:
1. Check Review Queue (50 new entries from overnight)
2. Scan for duplicates → Archive (10 entries)
3. Scan for irrelevant data → Archive (5 entries)
4. Approve remaining quality entries → Approve (35 entries)
Total time: 5-10 minutes
```

---

## Managing Active Knowledge

Once entries are approved, they appear in the **Active Knowledge** tab and are used by your agent.

### Viewing Active Entries

1. Go to **Knowledge Base** → **Active Knowledge** tab
2. See all currently active knowledge entries
3. Entries are sorted by priority (highest first)

### Understanding Priority

When your agent generates a response, it:
1. Looks at ALL active knowledge entries
2. Selects the most relevant entries based on:
   - **Priority level** (higher = more likely to be included)
   - **Relevance to the conversation context**
   - **KB limit** (you can set max entries per conversation)

**Priority Guidelines:**
- **10**: Critical information, always include if relevant
- **8-9**: Very important, high relevance
- **6-7**: Standard important information
- **4-5**: Background context, nice to have
- **1-3**: Low priority, filler information

### Editing Active Entries

You cannot directly edit entries from the Knowledge Base tab. To modify:

1. **Archive the old entry** (select it and click Archive)
2. **Add a new entry** with the updated information

This maintains a clear audit trail of what information was used when.

### Archiving Outdated Information

As information becomes stale:

1. Go to **Active Knowledge** tab
2. Select outdated entries
3. Click **Archive Selected**
4. The entries are removed from active use but not deleted

**Example: Archiving Old Price Data**
```
Archive entries like:
- "Bitcoin price: $30,000" (if current price is $43,000)
- "Ethereum ATH: $4,800" (if new ATH is reached)
- "Q1 2023 market analysis" (when you're in Q4 2023)
```

---

## Best Practices

### 1. Organize with Consistent Categories

Use a consistent categorization system across your knowledge base:

**Good Category System:**
```
market_data      → Prices, volumes, market caps
news             → Headlines, articles, announcements  
facts            → General crypto facts and information
technical        → Technical analysis, indicators
sentiment        → Market sentiment, social metrics
fundamentals     → Project fundamentals, metrics
```

**Avoid:**
```
random           → Too vague
miscellaneous    → Lacks structure
data             → Too broad
```

### 2. Use Descriptive Tags

Tags make filtering and retrieval easier:

**Good Tags:**
```
bitcoin, btc, price, bullish, breakout
ethereum, eth, upgrade, merge, pos
regulation, sec, legal, compliance
```

**Avoid:**
```
crypto          → Too broad
important       → Not descriptive
news           → Already covered by category
```

### 3. Set Appropriate Priorities

Balance your priority levels:

**Suggested Distribution:**
- 10% of entries at priority 9-10 (critical info)
- 30% of entries at priority 7-8 (very important)
- 40% of entries at priority 5-6 (standard)
- 20% of entries at priority 1-4 (background)

This ensures variety in your agent's responses while prioritizing key information.

### 4. Regular Maintenance

Schedule regular KB maintenance:

**Daily:**
- Review pending entries from API ingestion (5-10 min)
- Archive obviously outdated price data

**Weekly:**
- Review active knowledge for stale information
- Check if priority levels still make sense
- Update categories/tags if needed

**Monthly:**
- Full KB audit
- Archive entries older than X days (depending on your needs)
- Review API configurations for changes

### 5. Set Reasonable KB Limits

In your agent's Settings tab, configure the KB limit:

- **Limit = 10**: Agent uses up to 10 highest-priority relevant entries per conversation
- **Limit = 50**: More context, but longer prompts and higher API costs
- **Limit = 100**: Maximum context, highest costs

**Recommended Settings:**
```
General purpose bot: 20-30 entries
News/analysis bot: 40-60 entries  
Data-heavy bot: 60-100 entries
Simple bot: 10-20 entries
```

### 6. Monitor Your Agent's Usage

Use the **Playground** to test how your agent uses KB:

1. Go to **Playground** tab
2. Select your agent
3. Enter a test prompt
4. Click **Test Conversation**
5. Review which KB entries were included in the response

This helps you understand if your priority levels and categories are working well.

### 7. Quality Over Quantity

**Better to have:**
- 50 high-quality, well-categorized, accurate entries
- That are regularly reviewed and updated

**Than:**
- 500 low-quality entries
- With duplicates, outdated info, and poor organization

---

## Troubleshooting

### Problem: API Ingestion Not Creating Entries

**Check:**
1. Is polling enabled? (Toggle should be ON)
2. Is the API returning data? (Click "Test API")
3. Is your JSONPath expression correct? (Click "Test Extraction")
4. Check for API errors in the Custom APIs table (Status column)

**Solution:**
- Verify API credentials and URL
- Test JSONPath expression with the actual response structure
- Check API rate limits (you might be polling too frequently)

### Problem: Too Many Pending Entries

**Causes:**
- API polling too frequently
- Multiple APIs ingesting similar data
- Not reviewing regularly

**Solution:**
- Increase polling interval (e.g., from 5 min to 15 min)
- Consolidate duplicate APIs
- Set up a daily review routine
- Use batch approval/archive to clear backlog quickly

### Problem: Agent Not Using My Knowledge

**Check:**
1. Are entries **approved** and in Active Knowledge?
2. Is priority high enough? (Try 8-9 for important info)
3. Is the KB limit too low? (Increase in Settings tab)
4. Are tags/categories relevant to your agent's topics?

**Solution:**
- Move important entries to priority 9-10
- Increase KB limit from 20 to 50
- Test in Playground to see which entries are being used

### Problem: Duplicate Entries

**Causes:**
- API polling creating the same data repeatedly
- Manual entries duplicating ingested data

**Solution:**
- Review and archive duplicates in batches
- Adjust API polling interval
- Check if JSONPath is extracting unique values
- Consider using timestamps in entry content to differentiate

### Problem: Outdated Information

**Causes:**
- Old entries not being archived
- APIs not updating
- Not reviewing Active Knowledge regularly

**Solution:**
- Schedule weekly KB maintenance
- Check API status and polling
- Archive entries older than X days based on your use case
- For price data, keep only the most recent entry

---

## Quick Reference

### Common JSONPath Patterns

```javascript
$.price                           // Single value
$.data[0]                        // First item in array
$.data[*]                        // All items in array
$.data[*].title                  // All titles from array
$..price                         // All "price" fields anywhere
$.data[?(@.verified == true)]    // Filtered items (verified only)
```

### Workflow Cheat Sheet

**Setting Up Automatic Ingestion:**
```
1. Custom APIs → Add New API
2. Configure URL, headers, params
3. Test API response
4. Set JSONPath expression
5. Test extraction
6. Configure target agent, category, tags
7. Enable polling
```

**Daily Review Routine:**
```
1. Knowledge Base → Review Queue
2. Scan for duplicates → Archive
3. Scan for irrelevant → Archive  
4. Approve quality entries
5. Check Active Knowledge for outdated info
```

**Testing Your KB:**
```
1. Playground → Select Agent
2. Enter test prompt
3. Review KB entries included
4. Adjust priorities if needed
5. Test again
```

---

## Additional Resources

- **TWITTER_SETUP_GUIDE.md**: Setting up Twitter API credentials
- **TWITTER_AUTH_GUIDE.md**: Understanding OAuth authentication
- **USER_GUIDE.md**: Complete platform usage guide
- **README.md**: Technical documentation and API reference

---

## Support

If you encounter issues not covered in this guide:

1. Check the browser console for error messages
2. Verify API endpoints are accessible
3. Test JSONPath expressions with online validators
4. Review the Playground to see how your agent uses KB entries

The Knowledge Base is the foundation of your agent's intelligence. Regular maintenance and quality control will result in better, more accurate responses from your AI agent.
