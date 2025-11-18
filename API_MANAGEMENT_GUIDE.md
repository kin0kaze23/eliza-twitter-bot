# API Management System - Complete Guide

## 🎯 Overview

The ElizaOS Admin Dashboard now includes a **production-ready API Management system** that allows you to:
- Connect to **any API source** (news APIs, data feeds, financial data, etc.)
- **Test connections** before adding to KB ingestion
- **Debug extraction** with raw response preview
- **Secure key storage** using Replit Secrets
- **Auto-ingest** data into your Knowledge Base

---

## 🚀 Quick Start

### 1. Navigate to API Management
Click **"API Management"** in the sidebar under the "Data Sources" section.

### 2. Add Your First API

Click **"Add API Source"** and fill in:

**Basic Info:**
- **Name**: e.g., "CoinGecko News"
- **Description**: e.g., "Cryptocurrency news and market data"
- **API URL**: Full endpoint URL
- **HTTP Method**: GET, POST, PUT, or PATCH

**Authentication** (if required):
- **Auth Type**: None, API Key, Bearer Token, or Basic Auth
- **Secret Name**: Environment variable name (e.g., `NEWS_API_KEY`)
- **Header Name**: For API Key auth (e.g., `X-API-Key`)

**Data Extraction:**
- **JSON Path**: Path to data array (e.g., `$.data.articles[*]`)
- **Title Path**: Path to title field (e.g., `$.title`)
- **Content Path**: Path to content field (e.g., `$.description`)

**Advanced:**
- **Query Parameters**: JSON object with URL params
- **Custom Headers**: Additional HTTP headers

### 3. Add API Key to Secrets

1. Open Replit **Secrets** tab (Tools → Secrets)
2. Add your API key with the exact name you specified
3. Example: Key=`NEWS_API_KEY`, Value=`your-actual-api-key`

### 4. Test the Connection

Click **"Test"** button next to your API to:
- ✅ Verify authentication works
- ✅ Check data extraction
- ✅ Preview KB entry format
- ✅ View raw response for debugging

---

## 📖 API Examples

### Example 1: News API

```json
{
  "name": "NewsAPI Headlines",
  "baseUrl": "https://newsapi.org/v2/top-headlines",
  "method": "GET",
  "authType": "api_key",
  "authKeyEnvVar": "NEWS_API_KEY",
  "authHeaderName": "X-API-Key",
  "queryParams": {
    "category": "technology",
    "language": "en",
    "pageSize": "10"
  },
  "jsonPath": "$.articles[*]",
  "titlePath": "$.title",
  "contentPath": "$.description"
}
```

### Example 2: CoinGecko API (No Auth)

```json
{
  "name": "CoinGecko Trending",
  "baseUrl": "https://api.coingecko.com/api/v3/search/trending",
  "method": "GET",
  "authType": "none",
  "jsonPath": "$.coins[*].item",
  "titlePath": "$.name",
  "contentPath": "$.data"
}
```

### Example 3: GitHub API (Bearer Token)

```json
{
  "name": "GitHub Trending Repos",
  "baseUrl": "https://api.github.com/search/repositories",
  "method": "GET",
  "authType": "bearer",
  "authKeyEnvVar": "GITHUB_TOKEN",
  "queryParams": {
    "q": "language:javascript",
    "sort": "stars",
    "order": "desc"
  },
  "jsonPath": "$.items[*]",
  "titlePath": "$.full_name",
  "contentPath": "$.description"
}
```

---

## 🔍 Understanding JSON Paths

JSON Paths help extract data from nested API responses.

### Basic Syntax:
- `$` - Root object
- `.` - Child property
- `[*]` - All array items
- `[0]` - First array item

### Example Response:
```json
{
  "data": {
    "articles": [
      {
        "title": "Breaking News",
        "description": "Important update..."
      }
    ]
  }
}
```

### Correct Paths:
- **Data Array**: `$.data.articles[*]`
- **Title**: `$.title`
- **Content**: `$.description`

---

## 🛠️ Test Result Interpretation

When you test an API, you'll see:

### ✅ Success Indicators:
- **Status Badge**: Green "Working" badge
- **Items Extracted**: Number > 0
- **KB Preview**: Shows extracted title/content
- **Raw Response**: Full JSON for verification

### ❌ Failure Indicators:
- **Status Badge**: Red "Failed" badge
- **Error Message**: HTTP status or error details
- **Extraction Error**: JSON path issues

### Common Issues:

1. **Authentication Failed (401/403)**
   - ❌ API key not in Replit Secrets
   - ❌ Wrong secret name
   - ❌ Expired or invalid key
   
2. **Extraction Error**
   - ❌ Incorrect JSON path
   - ❌ API response structure changed
   - ❌ Missing title/content paths

3. **Network Error**
   - ❌ Invalid URL
   - ❌ API temporarily down
   - ❌ CORS issues (unlikely from backend)

---

## 🔐 Security Best Practices

### ✅ DO:
- Store API keys in Replit Secrets
- Use descriptive secret names (e.g., `COINGECKO_API_KEY`)
- Test APIs before enabling auto-ingestion
- Review extraction preview before using

### ❌ DON'T:
- Hardcode API keys in the code
- Share secret names publicly
- Use the same key for multiple purposes
- Enable untested APIs for auto-ingestion

---

## 🔄 KB Auto-Ingestion

Once your API is tested and working:

1. Navigate to **KB Snippets** page
2. Click **"Refresh from All Sources"**
3. System will:
   - Fetch data from all enabled APIs
   - Extract title/content using your paths
   - Store as KB snippets with source tracking
   - Update last refresh timestamp

### Manual Ingestion:
Use the **individual refresh buttons** next to each API source for selective updates.

---

## 🎨 API Status Badges

- **Never Tested** (Gray): API not tested yet
- **Working** (Green): Last test successful
- **Failed** (Red): Last test failed - check error message

---

## 💡 Pro Tips

1. **Start Simple**: Test with no-auth APIs first (CoinGecko, public data)
2. **Use Debug Mode**: Toggle "Show Raw Response" to understand API structure
3. **Check Limits**: Most APIs have rate limits - don't over-refresh
4. **Test Paths**: Use online JSON path testers if unsure
5. **Name Clearly**: Use descriptive names for easy management

---

## 🔧 Troubleshooting

### Problem: "Extracted 0 items"
**Solutions:**
- Check if JSON Path matches actual response structure
- View raw response to verify data location
- Ensure array path ends with `[*]`

### Problem: "Authentication Failed"
**Solutions:**
- Verify secret exists in Replit Secrets
- Check secret name matches exactly (case-sensitive)
- Ensure API key is valid and active
- For bearer tokens, don't include "Bearer " prefix

### Problem: "KB Preview shows 'undefined'"
**Solutions:**
- Title/Content paths may be incorrect
- Check raw response for actual field names
- Fields might be nested deeper than expected

---

## 📊 Architecture

### Data Flow:
```
User Config → API Test → JSON Extraction → KB Preview → Auto-Ingestion
     ↓            ↓             ↓              ↓              ↓
  Database    HTTP Request   JSONPath      Validation    KB Storage
```

### Security Flow:
```
Secret Name (DB) → Environment Variable (Replit) → HTTP Header (API)
```

---

## 🎯 Next Steps

1. ✅ Add your first API source
2. ✅ Test the connection
3. ✅ Verify extraction preview
4. ✅ Enable auto-ingestion
5. ✅ Configure refresh intervals
6. ✅ Monitor KB growth

---

## 📚 Additional Resources

- **Replit Secrets Documentation**: Learn about environment variables
- **JSON Path Evaluator**: Test your paths online
- **API Provider Docs**: Check authentication requirements
- **KB Snippets Page**: Manage ingested data

---

**Built with ❤️ for ElizaOS Twitter AI Agent Management**
