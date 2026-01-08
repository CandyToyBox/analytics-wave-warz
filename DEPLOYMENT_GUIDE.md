# Data Integrity Fix - Deployment Guide

## ⚠️ CRITICAL: Required Environment Variables

Before deploying, ensure these environment variables are set in Vercel:

### 1. **SUPABASE_SERVICE_ROLE_KEY** (REQUIRED)
**Where to find it:**
1. Go to your Supabase Dashboard
2. Navigate to: Settings → API
3. Find "service_role" key (under "Project API keys")
4. Copy the secret key (starts with `eyJ...`)

**Why it's needed:**
- Required for `/api/webhooks/battles` (webhook handler)
- Required for `/api/update-battle-volumes` (battle stats updates)
- Required for `/api/scan-quick-battles` (quick battle scanning)
- This key bypasses Row Level Security (RLS) for admin operations

**🔒 SECURITY WARNING:**
- This key has FULL DATABASE ACCESS - never expose to frontend
- Only use in server-side API endpoints
- Never commit to git or include in client-side code

**How to set in Vercel:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: `<your-service-role-key>`
   - **Environments**: Production, Preview, Development (all checked)
3. Click "Save"
4. Redeploy your application

### 2. **BATTLE_UPDATE_API_KEY** and **VITE_BATTLE_UPDATE_API_KEY** (REQUIRED)
Generate a secure key:
```bash
openssl rand -base64 32
```

Add BOTH to Vercel (use the SAME generated value for both):
- **Name**: `BATTLE_UPDATE_API_KEY` (server-side)
- **Name**: `VITE_BATTLE_UPDATE_API_KEY` (client-side)
- **Value**: `<your-generated-key>`

### 3. **WAVEWARZ_WEBHOOK_SECRET** (REQUIRED in Production)
Generate and set this to secure your webhook endpoint:
```bash
openssl rand -base64 32
```

Add to Vercel:
- **Name**: `WAVEWARZ_WEBHOOK_SECRET`
- **Value**: `<your-generated-secret>`
- **Environments**: Production, Preview, Development (all checked)

⚠️ **Important:** This is **REQUIRED** in production deployments. Without it, webhooks will be rejected for security reasons. It's optional only in development environments.

**Note:** Also provide this secret to WaveWarz so they can include it in webhook requests with the `X-Webhook-Secret` header.

### 4. **ADMIN_SECRET** (OPTIONAL - for admin endpoints)
For admin scan endpoint access:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to Vercel:
- **Name**: `ADMIN_SECRET`
- **Value**: `<your-generated-secret>`

---

## Quick Start

This guide helps you deploy the admin scan endpoint to fix zero values in artist and battle statistics.

---

## 🔍 What Was the Problem?

Artist and battle statistics (volume, pool size) were showing zero values because:
- The system uses **lazy loading** - stats are only calculated when battles are individually viewed
- No background job existed to pre-populate statistics
- **This is not a bug** - it's by design to save RPC costs

---

## ✅ What's the Solution?

A new **admin endpoint** allows you to scan battles in batch and populate all statistics from the blockchain.

**Endpoint**: `POST /api/admin/scan-battles`

---

## 📝 Deployment Steps

### 1. Set Environment Variable

Generate a secure admin secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**In Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `ADMIN_SECRET`
   - **Value**: `<paste your generated secret>`
3. Redeploy your application

**For Local Development** (`.env` file):
```env
ADMIN_SECRET=your-generated-secret-here
```

### 2. Deploy Changes

```bash
git pull origin copilot/verify-artist-battle-stats
git push origin main
```

Or merge the PR in GitHub UI.

### 3. Initial Scan

After deployment completes, run the initial scan:

```bash
curl -X POST "https://your-app.vercel.app/api/admin/scan-battles?limit=200" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET_HERE"
```

**Expected time**: ~3-4 minutes for 200 battles (1 second per battle due to rate limiting)

### 4. Verify Results

Check your application:
- ✅ Artist leaderboard shows non-zero volumes
- ✅ Battle statistics show pool sizes
- ✅ `last_scanned_at` timestamps updated in database

---

## 🔄 Optional: Daily Auto-Refresh

Set up GitHub Actions to refresh statistics automatically:

Create `.github/workflows/refresh-stats.yml`:

```yaml
name: Refresh Battle Statistics

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
  workflow_dispatch:  # Allow manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger scan
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/admin/scan-battles?limit=200" \
            -H "Authorization: Bearer ${{ secrets.ADMIN_SECRET }}" \
            -f

      - name: Check status
        if: failure()
        run: echo "Scan failed - check logs"
```

**Required GitHub Secrets:**
1. `APP_URL` = `https://your-app.vercel.app`
2. `ADMIN_SECRET` = Your admin secret from step 1

---

## 🛠️ Usage Examples

### Scan all battles (max 200)
```bash
curl -X POST "https://your-app.vercel.app/api/admin/scan-battles?limit=200" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

### Scan only Quick Battles
```bash
curl -X POST "https://your-app.vercel.app/api/admin/scan-battles?onlyQuickBattles=true&limit=100" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

### Force refresh even recently scanned
```bash
curl -X POST "https://your-app.vercel.app/api/admin/scan-battles?forceRefresh=true&limit=50" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

### Test locally
```bash
npm run dev
# In another terminal:
curl -X POST "http://localhost:5173/api/admin/scan-battles?limit=5" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

---

## 📊 Expected Response

```json
{
  "scanned": 50,
  "skipped": 116,
  "success": 48,
  "errors": 2,
  "results": [
    { "battleId": "1748420717", "status": "success" },
    { "battleId": "1748478141", "status": "error", "error": "Battle Account not found" }
  ],
  "message": "Scanned 48 battles successfully"
}
```

---

## 🔒 Security Notes

✅ **What we did for security:**
- Constant-time token comparison (prevents timing attacks)
- Server-only secrets (no VITE_ prefix exposure)
- Rate limiting (1 request/second)
- Conditional stack traces (only in dev)
- CodeQL scan passed (0 alerts)

⚠️ **Important:**
- Never commit `ADMIN_SECRET` to git
- Use HTTPS only (enforced by Vercel)
- Rotate secret periodically
- Monitor Vercel logs for unauthorized attempts

---

## 🐛 Troubleshooting

### "Unauthorized" error
- Check `ADMIN_SECRET` is set in Vercel
- Verify you're using the correct secret
- Ensure format: `Bearer <secret>` (note the space)

### "No battles found in database"
- Verify battles have been uploaded to Supabase
- Check database connection in environment variables

### Individual battle errors
- `Battle Account not found`: Battle doesn't exist on blockchain yet
- `RPC request failed`: Temporary network issue, retry later
- Rate limit: Wait 1 minute and retry

### Slow response
- Expected - blockchain calls take time
- 1 second per battle is intentional (rate limiting)
- Consider reducing `limit` parameter

---

## 📚 Documentation

- **`DATA_INTEGRITY_FINDINGS.md`** - Full investigation report
- **`api/admin/README.md`** - Complete API documentation
- **`.env.example`** - Configuration template

---

## ✅ Checklist

Before marking complete:

- [ ] Set `ADMIN_SECRET` in Vercel environment variables
- [ ] Deploy changes to production
- [ ] Run initial scan (`limit=200`)
- [ ] Verify artist leaderboard shows non-zero values
- [ ] Verify battle statistics populated
- [ ] (Optional) Set up GitHub Actions for daily refresh
- [ ] Monitor Vercel logs for any errors

---

## 📞 Support

If you encounter issues:
1. Check Vercel function logs
2. Review `api/admin/README.md` troubleshooting section
3. Verify `ADMIN_SECRET` is correctly set
4. Check Helius RPC dashboard for rate limits

---

**Status**: ✅ Ready for Deployment
**Date**: 2026-01-02
