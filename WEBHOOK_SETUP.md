# WaveWarz Webhooks Setup Guide

This guide explains how to configure your webhook endpoint to receive battle updates from WaveWarz.

## 🎯 Overview

**IMPORTANT: Webhook Architecture**
- ⚠️ Webhooks come from **WaveWarz's external `v2_battles` table**, not your local Supabase
- ⚠️ Do NOT configure webhooks in your Supabase Dashboard on the local `battles` table
- ✅ Your local `battles` table is the **destination** where data is stored after receiving webhooks
- ✅ You provide your webhook URL to WaveWarz for integration

The webhook system enables:
- **Real-time battle notifications** when new battles are created in WaveWarz
- **Automatic data synchronization** from WaveWarz to your analytics database
- **Event-driven architecture** for scalable analytics
- **Live battle stats** for your application

## 📋 Prerequisites

- ✅ Deployed webhook endpoint (Vercel recommended)
- ✅ Supabase project with `battles` table for storing received data
- ✅ Webhook URL to provide to WaveWarz team

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# Your Supabase credentials
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key

# API Server
PORT=3001

# Production URLs (for deployment)
FRAME_BASE_URL=https://your-api-domain.com
APP_URL=https://your-app-domain.com
```

### Step 3: Start the API Server

For local development:
```bash
# Start both frontend and API server
npm run dev:all

# Or just the API server
npm run dev:api
```

For production:
```bash
npm run build:api
npm run start:api
```

### Step 4: Expose Local Server (for testing)

If testing locally, use ngrok to expose your server:

```bash
ngrok http 3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

## 🔗 Webhook Integration with WaveWarz

### ⚠️ Critical: Do NOT Configure Webhooks in Your Supabase Dashboard

**Common Mistake:**
Users often try to configure webhooks in their own Supabase Dashboard on the local `battles` table. This will NOT work because:

1. The webhook handler **only accepts webhooks from WaveWarz's `v2_battles` table**
2. Your local `battles` table is the **destination**, not a webhook source
3. Webhooks configured on your local `battles` table will be **silently skipped** by the handler

### Correct Setup Process

**Step 1: Deploy Your Webhook Endpoint**

1. Deploy your application to Vercel (or another hosting provider)
2. Ensure your endpoint is accessible at: `https://your-domain.vercel.app/api/webhooks/battles`
3. Verify the endpoint is live (should return 405 for GET requests)

**Step 2: Configure Environment Variables**

Set these in Vercel Dashboard → Settings → Environment Variables:

```env
# Required for webhook handler
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key

# REQUIRED in Production for webhook security
# Generate with: openssl rand -base64 32
WAVEWARZ_WEBHOOK_SECRET=your-generated-secret
```

⚠️ **Important:** `WAVEWARZ_WEBHOOK_SECRET` is **REQUIRED** in production deployments. Webhooks will be rejected if this is not configured. This is optional only in development environments for easier testing.

See `VERCEL_ENV_SETUP.md` for detailed instructions.

**Step 3: Provide Your Webhook URL to WaveWarz**

Contact the WaveWarz team and provide:
- Your webhook URL: `https://your-domain.vercel.app/api/webhooks/battles`
- Your webhook secret (if using `WAVEWARZ_WEBHOOK_SECRET`)

They will configure their `v2_battles` table to send webhooks to your endpoint.

**Step 4: Verify Webhook Reception**

After WaveWarz configures your webhook:
1. Monitor Vercel logs: `vercel logs --follow`
2. Watch for webhook events from `v2_battles` table
3. Verify battles are being inserted into your local `battles` table

## 🧪 Testing Your Webhook

### Test 1: Check Server Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-25T..."
}
```

### Test 2: Manual Webhook Test

⚠️ **Important:** Use `v2_battles` as the table name (not `battles`)

```bash
curl -X POST https://your-domain.vercel.app/api/webhooks/battles \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret-here" \
  -d '{
    "type": "INSERT",
    "table": "v2_battles",
    "record": {
      "battle_id": "123456",
      "artist1_name": "Test Artist A",
      "artist2_name": "Test Artist B",
      "status": "active",
      "artist1_pool": 10.5,
      "artist2_pool": 8.3,
      "battle_duration": 3600,
      "is_quick_battle": false
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "action": "inserted",
  "battleId": "123456"
}
```

**What happens:**
1. Webhook receives data from `v2_battles` table
2. Handler inserts battle into your local `battles` table
3. Returns success response

### Test 3: Verify Battle Was Stored

Check your Supabase `battles` table:

```sql
SELECT battle_id, artist1_name, artist2_name, created_at
FROM battles
WHERE battle_id = '123456'
ORDER BY created_at DESC
LIMIT 1;
```

You should see the battle data that was sent via webhook.

## 🖼️ Farcaster Frame Endpoints

Your API server provides these endpoints for Farcaster Frames:

### Frame URLs

- **Latest Battle Frame:** `https://your-domain.com/api/frames/battle`
- **Specific Battle:** `https://your-domain.com/api/frames/battle/123456`
- **Battle Image:** `https://your-domain.com/api/frames/battle/image?battleId=123456`

### Testing the Frame

1. Visit the frame URL in your browser:
   ```
   http://localhost:3001/api/frames/battle
   ```

2. View the HTML source - you should see Frame meta tags:
   ```html
   <meta property="fc:frame" content="vNext" />
   <meta property="fc:frame:image" content="..." />
   <meta property="fc:frame:button:1" content="🔄 Refresh Stats" />
   ```

3. To test in Farcaster:
   - Deploy your API to production (Vercel, Railway, etc.)
   - Share the frame URL in Warpcast
   - The frame should render with interactive buttons

## 📊 Webhook Payload Reference

### INSERT Event (New Battle from WaveWarz)

⚠️ **Note:** Table name is `v2_battles` (WaveWarz's table), not `battles` (your table)

```json
{
  "type": "INSERT",
  "table": "v2_battles",
  "schema": "public",
  "record": {
    "id": "uuid-here",
    "battle_id": "174523",
    "created_at": "2025-11-25T...",
    "status": "active",
    "artist1_name": "Artist A",
    "artist2_name": "Artist B",
    "artist1_wallet": "wallet-address-a",
    "artist2_wallet": "wallet-address-b",
    "artist1_pool": 0,
    "artist2_pool": 0,
    "image_url": "https://...",
    "battle_duration": 3600,
    "winner_decided": false,
    "is_quick_battle": false,
    "quick_battle_queue_id": null
  }
}
```

### UPDATE Event (Stats Changed)

```json
{
  "type": "UPDATE",
  "table": "v2_battles",
  "schema": "public",
  "record": {
    "battle_id": "174523",
    "artist1_pool": 15.75,
    "artist2_pool": 12.30,
    "winner_decided": true,
    "winner_artist_a": true,
    ...
  },
  "old_record": {
    "battle_id": "174523",
    "artist1_pool": 10.50,
    "artist2_pool": 8.30,
    "winner_decided": false,
    ...
  }
}
```

**Handler Behavior:**
- INSERT: Creates new battle in your local `battles` table
- UPDATE: Only processes when `winner_decided=true` (final results)
- Active battle updates are skipped to reduce API calls

## 🔒 Security Best Practices

### 1. Webhook Secret Validation (REQUIRED in Production)

The webhook handler now **requires** webhook secret validation in production environments:

```typescript
// In api/webhooks/battles.ts
const WEBHOOK_SECRET = process.env.WAVEWARZ_WEBHOOK_SECRET;
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

// Production: Webhook secret is REQUIRED
if (!WEBHOOK_SECRET && isProduction) {
  return res.status(500).json({ error: 'Webhook secret not configured' });
}

// Validate secret if provided
if (WEBHOOK_SECRET && providedSecret !== WEBHOOK_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**Configuration:**
1. Generate a secure secret: `openssl rand -base64 32`
2. Set `WAVEWARZ_WEBHOOK_SECRET` in your production environment variables
3. Provide the same secret to the WaveWarz team for webhook configuration
4. In production, webhooks without the correct secret will be rejected

**Development:** The webhook secret is optional in development environments to allow easier testing. You'll see a warning but webhooks will still be processed.

### 2. IP Whitelisting

Restrict webhook access to Supabase IPs only (configure in your hosting provider).

### 3. HTTPS Only

Always use HTTPS in production. Never expose webhook endpoints over HTTP.

## 🚢 Deployment

### Option 1: Vercel (Recommended)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel --prod
   ```
   
   Or use the newer syntax:
   ```bash
   vercel deploy --prod
   ```

3. Set environment variables in Vercel Dashboard (see `VERCEL_ENV_SETUP.md`)

4. **Provide your webhook URL to WaveWarz team:**
   - URL: `https://your-domain.vercel.app/api/webhooks/battles`
   - Secret: Your `WAVEWARZ_WEBHOOK_SECRET` value (if using)

### Option 2: Railway

1. Connect your GitHub repo to Railway
2. Set environment variables
3. Deploy automatically on push

### Option 3: Any Node.js Host

Build and deploy:
```bash
npm run build:api
npm run start:api
```

## 📝 Troubleshooting

### Webhook Not Triggering

**First, verify the architecture:**
- ❌ Did you configure webhooks in YOUR Supabase Dashboard? (This won't work)
- ✅ Did you provide your webhook URL to WaveWarz? (This is required)

**If webhook URL was provided to WaveWarz:**
1. **Check Vercel logs** for incoming webhook requests
2. **Verify environment variables** are set correctly (especially `SUPABASE_SERVICE_ROLE_KEY`)
3. **Test with curl** using `table: "v2_battles"` (not `"battles"`)
4. **Check your endpoint is accessible** (should return 405 for GET requests)

### Webhooks Being Skipped with Misconfiguration Warning

**Log message:** 
```
⚠️ WEBHOOK MISCONFIGURATION DETECTED
❌ Received webhook for table: 'battles'
✅ Expected table: 'v2_battles' (WaveWarz source)
```

**What this means:** 
The webhook handler received a webhook from your local `battles` table, but it only processes webhooks from WaveWarz's `v2_battles` table. This indicates you've configured webhooks in the wrong place.

**Why this is a problem:**
- Webhooks on your local `battles` table create unnecessary load and log spam
- They won't process any data because they're from the wrong table
- You're still missing the actual webhooks from WaveWarz

**Cause:** 
You configured webhooks in your own Supabase Dashboard on the local `battles` table. This doesn't work with the current architecture because:
1. Your `battles` table is the **destination** where webhook data is stored
2. WaveWarz's `v2_battles` table is the **source** where webhooks should originate
3. When WaveWarz sends a webhook from `v2_battles`, this handler copies it to your `battles` table

**Solution:**
1. **Go to your Supabase Dashboard**
2. **Navigate to:** Database → Webhooks
3. **Delete** any webhooks configured on the `battles` table
4. **Contact the WaveWarz team** to configure webhooks from their `v2_battles` table to your endpoint
5. **Verify** the webhook URL you provide to WaveWarz is: `https://your-domain.vercel.app/api/webhooks/battles`

After fixing:
- You should see `Source: WaveWarz v2_battles` in logs instead of skip messages
- Battles will be properly inserted into your database
- No more misconfiguration warnings

### Webhooks Returning 200 OK But No Data

**Symptom:** Webhook returns success but battles aren't appearing in database

**Cause:** Same as above - webhooks configured on wrong table

**Solution:** See "Webhooks Being Skipped with Misconfiguration Warning" above

### Frame Not Displaying in Farcaster

1. **Verify meta tags** are correct (view HTML source)
2. **Check image URL** is accessible (must be HTTPS in production)
3. **Use Frame Validator:** https://warpcast.com/~/developers/frames
4. **Ensure base URL** is set correctly in .env

### Connection Errors

1. **Verify Supabase credentials** in .env
2. **Check network access** - some hosts block Supabase
3. **Test connection:**
   ```bash
   curl "https://your-project.supabase.co/rest/v1/battles?limit=1" \
     -H "apikey: your-anon-key"
   ```

## 📚 Next Steps

Now that webhooks are set up:

1. ✅ **Customize webhook handlers** in `api/webhooks/battles.ts`
2. ✅ **Enhance Frame design** in `api/frames/battle-frame.ts`
3. ✅ **Add Farcaster posting** to announce new battles
4. ✅ **Implement caching** for better performance
5. ✅ **Add analytics tracking** for webhook events

## 🔗 Resources

- [Supabase Webhooks Docs](https://supabase.com/docs/guides/database/webhooks)
- [Farcaster Frames Spec](https://docs.farcaster.xyz/reference/frames/spec)
- [Warpcast Frame Validator](https://warpcast.com/~/developers/frames)

## 💡 Tips

- Use **ngrok** for local webhook testing
- Monitor webhook logs in **Supabase Dashboard**
- Test frames with **Frame Validator** before sharing
- Keep webhook handlers **fast and async**
- Cache frequently accessed data to reduce database calls

---

Need help? Check the API server logs or file an issue in the repo!
