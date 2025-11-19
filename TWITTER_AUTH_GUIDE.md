# Twitter API Authentication Guide for ElizaOS Agents

## Which Authentication Method Do I Need?

### **For ElizaOS Agents (Automated Bots)** → Use **OAuth 1.0a** ✅

Your ElizaOS agent is an **automated bot** that posts tweets on behalf of a single Twitter account. For this use case, you need:

**OAuth 1.0a Credentials (6 required fields)**:
1. ✅ App ID
2. ✅ API Key (Consumer Key)
3. ✅ API Key Secret (Consumer Secret)
4. ✅ Access Token
5. ✅ Access Token Secret
6. ✅ Bearer Token

**OAuth 2.0 Credentials (NOT needed for basic bot functionality)**:
- ❌ Client ID - Only for apps with user login flows
- ❌ Client Secret - Only for apps with user login flows

---

## Complete Setup Guide

### Step 1: Twitter Developer Portal Setup

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a new Project and App (or use existing)
3. **CRITICAL**: Configure User Authentication Settings

### Step 2: Configure App Permissions

This is the **most important step** and where most users get stuck:

1. In your app, click **Settings** → **User authentication settings**
2. Click **"Set up"** if not already configured
3. Configure as follows:

   **App permissions**: ✅ **Read and Write** (minimum)
   - Select "Read and Write" to allow posting tweets
   - Or select "Read, Write and Direct Messages" if your agent will handle DMs

   **Type of App**: ✅ **Automated App or Bot**
   - This is the correct option for ElizaOS agents
   - NOT "Web App, Automated App or Bot" (that's for user login flows)

   **App info**:
   - **Callback URL**: Use `http://localhost:3000/callback` (required but not used for bots)
   - **Website URL**: Your actual website or `http://localhost:3000`

4. Click **Save**

### Step 3: Regenerate Access Token & Secret

**CRITICAL**: After changing permissions to "Read and Write", you **MUST** regenerate your Access Token and Access Token Secret:

1. Go to **Keys and tokens** tab
2. Under **Authentication Tokens** section
3. Click **"Regenerate"** button for Access Token and Secret
4. ⚠️ **Important**: Copy both immediately - they won't be shown again!

### Step 4: Collect All 6 Credentials

Now gather all 6 credentials from the **Keys and tokens** tab:

| Credential | Where to Find | Example Format | Notes |
|------------|---------------|----------------|-------|
| **App ID** | App Settings → App ID | `12345678` | Numeric ID |
| **API Key** | Keys and tokens → Consumer Keys | `xvz1evFS4wEEPT...` | ~25 chars |
| **API Key Secret** | Keys and tokens → Consumer Keys | `L8qq9PZyRg6ieKGE...` | ~50 chars |
| **Access Token** | Keys and tokens → Authentication Tokens | `1234567890-xxxx...` | Starts with digits |
| **Access Token Secret** | Keys and tokens → Authentication Tokens | `xxxxxxxxxxxxx...` | ~45 chars |
| **Bearer Token** | Keys and tokens → Bearer Token | `AAAAAAAAAAAA...` | Very long (~115 chars) |

### Step 5: Enter Credentials in ElizaOS Dashboard

1. Open your agent in the ElizaOS dashboard
2. Go to **Credentials** tab
3. Fill in all 6 OAuth 1.0a fields
4. **Save Agent** (credentials are stored in database)
5. Click **"Test Twitter Connection"** to verify

---

## What About OAuth 2.0 Client ID & Client Secret?

### You Configured Them - Now What?

If you already set up OAuth 2.0 credentials in the Twitter Developer Portal:

**For Basic Bot Functionality**: ❌ **You DON'T need them**
- Your agent will work perfectly with just the OAuth 1.0a credentials above
- Leave the OAuth 2.0 fields empty in the dashboard

**When You WOULD Need OAuth 2.0**: ✅ **Only if** you're building:
- A web app where users click "Login with Twitter"
- An application that needs to act on behalf of multiple different Twitter accounts
- A service that requires user authorization flows

For a typical ElizaOS agent that posts autonomously to a single account, OAuth 2.0 is **not required**.

### Where to Enter OAuth 2.0 Credentials (If Needed)

If you're implementing advanced user authorization flows in the future:

1. Go to **Credentials** tab in your agent
2. Scroll down to see **"OAuth 2.0 Credentials"** section
3. Enter your Client ID and Client Secret there
4. These are stored but not used for basic posting functionality

---

## Testing Your Connection

### Expected Result: ✅ Success
```
✓ Connected as @your_username
```

This means:
- All 6 credentials are correct
- App has proper "Read and Write" permissions
- Your agent can now post tweets

### Common Errors & Solutions

#### ❌ "Read-only application cannot POST"

**Problem**: App permissions are set to "Read only"

**Solution**:
1. Go to Developer Portal → Your App → Settings
2. Change permissions to **"Read and Write"**
3. **CRITICAL**: Regenerate Access Token and Secret
4. Copy the new tokens to dashboard
5. Save and test again

---

#### ❌ "Invalid or expired token"

**Problem**: Bearer Token or Access Tokens are incorrect/outdated

**Solution**:
1. Go to Developer Portal → Keys and tokens
2. Regenerate Bearer Token
3. Regenerate Access Token and Secret
4. Copy all new values to dashboard
5. Save and test again

---

#### ❌ "Could not authenticate you"

**Problem**: One or more credentials are incorrect

**Solution**:
1. Double-check all 6 fields for typos
2. Ensure no extra spaces before/after credentials
3. Make sure you copied the full value (some are very long)
4. Regenerate all tokens if still failing

---

#### ❌ "403 Forbidden"

**Problem**: App doesn't have correct permissions or wrong API tier

**Solution**:
1. Verify app permissions are "Read and Write"
2. Check that you're using a Project-level app (not standalone)
3. Ensure your Twitter Developer account is in good standing
4. Free tier has rate limits - ensure you haven't exceeded them

---

## Quick Reference: What You Need

### For ElizaOS Bot (You) ✅
- [x] OAuth 1.0a: 6 credentials (App ID, API Key, API Secret, Access Token, Access Token Secret, Bearer Token)
- [x] App Permission: "Read and Write" or "Read, Write and Direct Messages"
- [x] App Type: "Automated App or Bot"
- [ ] OAuth 2.0: NOT needed

### For User Login Web App (Not You) ❌
- [ ] OAuth 1.0a: Optional
- [x] OAuth 2.0: Client ID + Client Secret
- [x] App Type: "Web App, Automated App or Bot"
- [x] Callback URL: Your actual callback endpoint

---

## Still Having Issues?

1. **Check App Permissions**: Must be "Read and Write"
2. **Regenerate Tokens**: After changing permissions, always regenerate
3. **Test Connection**: Use the "Test Twitter Connection" button in dashboard
4. **View Error Hints**: The dashboard shows helpful hints for each error type
5. **Twitter API Status**: Check https://api.twitterstat.us/ for API outages

## Summary

For your ElizaOS agent:
- ✅ Use OAuth 1.0a credentials (6 fields)
- ✅ Set permissions to "Read and Write"
- ✅ Regenerate tokens after permission changes
- ✅ Test connection before deploying
- ❌ Don't worry about OAuth 2.0 Client ID/Secret (not needed for bots)

Your OAuth 2.0 credentials are now available in the dashboard if you ever need them for advanced use cases, but **for testing your Twitter connection right now, just use the OAuth 1.0a credentials**.
