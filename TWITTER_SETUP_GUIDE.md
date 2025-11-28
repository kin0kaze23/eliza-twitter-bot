# Twitter Developer Portal Setup Guide

This guide explains how to set up your Twitter Developer account and configure the necessary credentials for the ElizaOS Twitter AI Agent.

## Prerequisites

- A Twitter account
- Access to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)

## Step 1: Create a Twitter Developer Account

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Sign in with your Twitter account
3. Apply for a developer account if you don't have one
4. Fill out the required information about your use case

## Step 2: Create a New Project and App

1. In the Developer Portal, click **"Create Project"**
2. Name your project (e.g., "AI Twitter Bot")
3. Select use case: **"Making a bot"** or **"Building tools for Twitter users"**
4. Provide a description of what your bot will do
5. Click **"Create App"** and name your app

## Step 3: Configure App Permissions

**CRITICAL:** Your app needs the correct permissions to post tweets and interact.

1. Go to your app settings
2. Navigate to **"User authentication settings"**
3. Click **"Set up"** or **"Edit"**
4. Configure the following:

   - **App permissions:** Select **"Read and Write"** (required for posting tweets)
   - **Type of App:** Select **"Web App, Automated App or Bot"**
   - **Callback URI:** Enter any valid URL (e.g., `http://localhost:3000/callback`)
   - **Website URL:** Enter your website or `https://example.com`

5. Save the settings

## Step 4: Obtain Your Credentials

After setting up authentication, you'll get access to your credentials:

### Required OAuth 1.0a Credentials (6 fields):

1. **App ID**
   - Found in: App Settings → App Details
   - Example: `31849033`

2. **API Key (Consumer Key)**
   - Found in: Keys and Tokens → Consumer Keys
   - Example: `xvz1evFS4wEEPTGEFPHBog`

3. **API Key Secret (Consumer Secret)**
   - Found in: Keys and Tokens → Consumer Keys
   - Click **"Regenerate"** if needed
   - Example: `L8qq9PZyRg6ieKGEKhZolGC0vJWLw8iEJ88DRdyOg`

4. **Access Token**
   - Found in: Keys and Tokens → Authentication Tokens
   - Click **"Generate"** if you don't have one
   - Example: `1234567890-xvz1evFS4wEEPTGEFPHBog`

5. **Access Token Secret**
   - Found in: Keys and Tokens → Authentication Tokens
   - Generated along with Access Token
   - Example: `kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw`

6. **Bearer Token**
   - Found in: Keys and Tokens → Bearer Token
   - Click **"Generate"** if you don't have one
   - Example: `AAAAAAAAAAAAAAAAAAAAAMLheAAAAAAA0%2BuSeid...`

### Optional OAuth 2.0 Credentials:

Only needed if you're implementing user authorization flows (3-legged OAuth).

7. **OAuth 2.0 Client ID** (Optional)
   - Found in: Keys and Tokens → OAuth 2.0 Client ID
   - Example: `VGNibzRvbkY3ZjN2MjRIZ206MTpjaQ`

8. **OAuth 2.0 Client Secret** (Optional)
   - Found in: Keys and Tokens → OAuth 2.0 Client ID and Secret
   - Example: `7aBc1dEf2gHi3jKl4mNo5pQr6sT...`

## Step 5: Enter Credentials in Dashboard

1. Navigate to your agent's configuration page
2. Click on the **"Twitter API"** tab
3. Fill in all 6 required OAuth 1.0a credentials:
   - App ID
   - API Key (Consumer Key)
   - API Key Secret
   - Access Token
   - Access Token Secret
   - Bearer Token

4. Leave OAuth 2.0 fields empty (unless you need them)
5. Click **"Test Connection"** to verify your credentials
6. If successful, you'll see your Twitter account details

## Troubleshooting

### Authentication Failed (401 Error)

**Problem:** One or more credentials are incorrect or expired.

**Solutions:**
- Double-check all credentials are copied correctly (no extra spaces)
- Regenerate your Access Token and Access Token Secret
- Make sure you're using the correct API Key and Secret

### Access Forbidden (403 Error)

**Problem:** Your app doesn't have the required permissions.

**Solutions:**
- Go to app settings → User authentication settings
- Change permissions to **"Read and Write"**
- After changing permissions, **regenerate** your Access Token and Secret
- Old tokens don't inherit new permissions!

### Rate Limit Errors (429 Error)

**Problem:** You've exceeded Twitter's API rate limits.

**Solutions:**
- Wait 15 minutes before trying again
- Check your app's rate limit status in Developer Portal
- Reduce posting frequency in your bot configuration

### App Suspended

**Problem:** Your app was suspended for violating Twitter's policies.

**Solutions:**
- Review [Twitter's Developer Policy](https://developer.twitter.com/en/developer-terms/policy)
- Appeal the suspension through Developer Portal
- Create a new app if appeal is denied

## Security Best Practices

1. **Never share your credentials** publicly or commit them to version control
2. **Regenerate tokens** if you suspect they've been compromised
3. **Use environment variables** or secure storage for production deployments
4. **Monitor your app** for unusual activity in the Developer Portal
5. **Rotate credentials** periodically for enhanced security

## API Access Levels

Twitter offers different API access tiers:

- **Free:** Basic access with rate limits
- **Basic ($100/month):** Higher rate limits
- **Pro ($5,000/month):** Professional-level access
- **Enterprise:** Custom pricing for high-volume use

For most AI bot use cases, the **Free tier** is sufficient for testing and moderate usage.

## Next Steps

After successfully testing your Twitter credentials:

1. Configure your AI model settings (OpenAI, Anthropic, etc.)
2. Set up your character prompts and personality
3. Configure posting schedule and behavior
4. Add knowledge base entries
5. Test conversations in the Playground
6. Deploy your bot!

## Additional Resources

- [Twitter API Documentation](https://developer.twitter.com/en/docs)
- [OAuth 1.0a Documentation](https://developer.twitter.com/en/docs/authentication/oauth-1-0a)
- [Rate Limits Reference](https://developer.twitter.com/en/docs/twitter-api/rate-limits)
- [Developer Policy](https://developer.twitter.com/en/developer-terms/policy)

## Support

If you encounter issues not covered in this guide:

1. Check the Twitter Developer Community forums
2. Review the API status page
3. Contact Twitter Developer Support
4. Check this dashboard's error messages for specific hints
