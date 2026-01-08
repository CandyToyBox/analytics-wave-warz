# Vercel Environment Variables Setup Guide

## Critical Issue: Missing Environment Variables

If you're seeing these errors in your logs:
- ❌ `Failed to update battle: Invalid API key`
- ❌ `WAVEWARZ_WEBHOOK_SECRET not configured in production - webhook REJECTED for security`
- ⚠️ `WAVEWARZ_WEBHOOK_SECRET not configured - webhook is INSECURE!` (development only)

This means required environment variables are missing in Vercel.

---

## Required Setup Steps

### Step 1: Get Your Supabase Service Role Key

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Find "Project API keys" section
5. Copy the **`service_role`** key (marked as "secret")
   - It starts with `eyJ...`
   - This is different from the `anon` key

### Step 2: Add Environment Variables to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (analytics-wave-warz)
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

#### Required Variables:

| Variable Name | Value | Where to Get It |
|--------------|-------|-----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase Dashboard → Settings → API → service_role key |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_KEY` | `eyJ...` | Supabase Dashboard → Settings → API → anon/public key |
| `BATTLE_UPDATE_API_KEY` | Generate new | `openssl rand -base64 32` |
| `VITE_BATTLE_UPDATE_API_KEY` | Same as above | Use same value as BATTLE_UPDATE_API_KEY |
| `WAVEWARZ_WEBHOOK_SECRET` | Generate new | `openssl rand -base64 32` - **REQUIRED in Production** |

⚠️ **Important:** `WAVEWARZ_WEBHOOK_SECRET` is **REQUIRED** for production deployments. Webhooks will be rejected without it for security reasons. It's optional only in development.

#### Optional Variables:

| Variable Name | Value | Purpose |
|--------------|-------|---------|
| `ADMIN_SECRET` | Generate new | Admin scan endpoint access |

### Step 3: Generate Secure Keys

For `BATTLE_UPDATE_API_KEY` and `WAVEWARZ_WEBHOOK_SECRET`:

**Option 1 - Using OpenSSL (Mac/Linux):**
```bash
openssl rand -base64 32
```

**Option 2 - Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 3 - Online Generator:**
Visit: https://www.random.org/strings/ (use 32 characters)

### Step 4: Configure Each Variable in Vercel

For EACH variable:

1. Click **"Add New"** button
2. Fill in:
   - **Name**: Exact variable name (case-sensitive)
   - **Value**: Paste the key/URL
   - **Environments**: Check all three boxes:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
3. Click **"Save"**

### Step 5: Redeploy

After adding all variables:

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the **"..."** menu → **"Redeploy"**
4. Or push a new commit to trigger deployment

---

## Verification

### Check if Variables are Set

In Vercel Dashboard → Settings → Environment Variables, you should see:

```
✅ SUPABASE_SERVICE_ROLE_KEY         (Production, Preview, Development)
✅ VITE_SUPABASE_URL                 (Production, Preview, Development)
✅ VITE_SUPABASE_KEY                 (Production, Preview, Development)
✅ BATTLE_UPDATE_API_KEY             (Production, Preview, Development)
✅ VITE_BATTLE_UPDATE_API_KEY        (Production, Preview, Development)
✅ WAVEWARZ_WEBHOOK_SECRET           (Production, Preview, Development)
```

### Test the Deployment

1. After redeployment, check Vercel logs
2. Look for these SUCCESS indicators:
   - ✅ `Webhook secret verified - request from WaveWarz`
   - ✅ `Battle stats saved successfully`
   - ✅ No more "Invalid API key" errors

3. Test the app:
   - Open your deployed app
   - Check if battle data loads correctly
   - Monitor for any console errors

---

## Troubleshooting

### Still seeing "Invalid API key" errors?

**Possible causes:**
1. Environment variable not saved properly
   - Solution: Double-check spelling (case-sensitive)
   - Solution: Ensure no extra spaces in the value

2. Deployment didn't pick up new variables
   - Solution: Trigger a manual redeploy

3. Using wrong Supabase key
   - Solution: Make sure it's the `service_role` key, not `anon` key
   - Solution: The key should be very long (starts with `eyJ`)

### Webhook still shows "INSECURE" warning?

- This warning appears if `WAVEWARZ_WEBHOOK_SECRET` is not set
- To fix: Add the variable and provide the same secret to WaveWarz team
- This is recommended but optional for testing

### Variables not showing up in logs?

- Check that you selected all three environments (Production, Preview, Development)
- Redeploy after adding variables
- Wait 1-2 minutes for deployment to complete

---

## Security Best Practices

### ✅ DO:
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret - never share publicly
- Use strong random values for API keys (at least 32 characters)
- Set all variables in all environments (Production, Preview, Development)
- Rotate keys periodically (every 3-6 months)

### ❌ DON'T:
- Never commit keys to git
- Never share service role key in public forums
- Never use the same keys for multiple projects
- Never use weak/predictable keys (like "password123")

---

## Quick Reference Commands

### Generate API Key:
```bash
openssl rand -base64 32
```

### Check Vercel Logs (after deployment):
```bash
vercel logs --follow
```

### Test Webhook Locally:
```bash
curl -X POST http://localhost:5173/api/webhooks/battles \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{"type":"INSERT","table":"v2_battles","record":{"battle_id":"test"}}'
```

---

## Getting Help

If you're still having issues:

1. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Deployments → Latest Deployment → Functions
   - Look for specific error messages

2. **Verify Supabase Connection:**
   - Test the service role key in Supabase SQL Editor
   - Run: `SELECT 1` to verify connection

3. **Review Documentation:**
   - `.env.example` - See all required variables
   - `DEPLOYMENT_GUIDE.md` - Full deployment steps
   - `WEBHOOK_SETUP.md` - Webhook configuration

---

**Last Updated:** 2026-01-07  
**Status:** Production Ready ✅
