# Admin API Endpoints

This directory contains administrative API endpoints for WaveWarz Analytics.

## Endpoints

### `/api/admin/scan-battles`

**Purpose**: Trigger blockchain scanning to pre-populate battle statistics

**Method**: `POST`

**Authentication**: Required via `Authorization: Bearer <ADMIN_SECRET>` header

**Query Parameters**:
- `limit` (optional): Number of battles to scan (default: 50, max: 200)
- `forceRefresh` (optional): Force re-scan even if recently scanned (default: false)
- `onlyQuickBattles` (optional): Only scan Quick Battles (default: false)

**Example Usage**:

```bash
# Scan 50 battles that haven't been scanned recently
curl -X POST "https://your-app.vercel.app/api/admin/scan-battles?limit=50" \
  -H "Authorization: Bearer your-admin-secret-here"

# Force re-scan of 100 Quick Battles
curl -X POST "https://your-app.vercel.app/api/admin/scan-battles?limit=100&forceRefresh=true&onlyQuickBattles=true" \
  -H "Authorization: Bearer your-admin-secret-here"
```

**Response Format**:

```json
{
  "scanned": 50,
  "skipped": 150,
  "success": 48,
  "errors": 2,
  "results": [
    { "battleId": "1748420717", "status": "success" },
    { "battleId": "1748478141", "status": "error", "error": "Battle Account not found on-chain" }
  ],
  "message": "Scanned 48 battles successfully"
}
```

## Setup

### 1. Configure Environment Variable

Add the `ADMIN_SECRET` to your environment variables:

**For Vercel**:
1. Go to your project settings
2. Navigate to Environment Variables
3. Add: `ADMIN_SECRET` = `<your-secure-random-string>`

**For Local Development** (`.env`):
```env
ADMIN_SECRET=your-secure-random-string-here
```

Generate a secure secret:
```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32
```

### 2. Test the Endpoint

```bash
# Test locally (Vite dev server proxies API requests)
npm run dev
# Then in another terminal:
curl -X POST "http://localhost:5173/api/admin/scan-battles?limit=5" \
  -H "Authorization: Bearer your-admin-secret-here"

# Note: Vite dev server (port 5173) proxies /api/* requests to the backend
# In production, API endpoints are handled by Vercel serverless functions
```

## Use Cases

### Initial Setup

When you first deploy the app or add new battles to the database, they won't have statistics populated. Run this endpoint to scan and populate all battles:

```bash
curl -X POST "https://your-app.vercel.app/api/admin/scan-battles?limit=200" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

### Daily Refresh

Set up a scheduled job (e.g., GitHub Actions, Vercel Cron) to refresh statistics daily:

```yaml
# .github/workflows/refresh-stats.yml
name: Refresh Battle Statistics
on:
  schedule:
    - cron: '0 2 * * *'  # Run at 2 AM daily
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger scan
        run: |
          curl -X POST "https://your-app.vercel.app/api/admin/scan-battles?limit=200" \
            -H "Authorization: Bearer ${{ secrets.ADMIN_SECRET }}"
```

### Quick Battles Only

If you only want to refresh Quick Battle statistics:

```bash
curl -X POST "https://your-app.vercel.app/api/admin/scan-battles?limit=100&onlyQuickBattles=true" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

## Rate Limiting

The endpoint is rate-limited to **1 request per second** to avoid overwhelming the Solana RPC endpoint. This means:
- Scanning 50 battles takes ~50 seconds
- Scanning 200 battles takes ~200 seconds (3.3 minutes)

## Error Handling

The endpoint will continue scanning even if individual battles fail. Check the `results` array in the response to see which battles failed and why.

Common errors:
- `Battle Account not found on-chain`: Battle may not exist on blockchain yet
- `RPC request failed`: Temporary network issue, retry later
- `Rate limit exceeded`: Helius RPC rate limit hit, wait and retry

## Security Considerations

1. **Never expose `ADMIN_SECRET`** in client-side code or public repositories
2. **Rotate the secret** periodically
3. **Use HTTPS only** in production
4. **Monitor usage** via Vercel logs or your hosting platform
5. **Consider IP whitelisting** for additional security

## Troubleshooting

### "Unauthorized" Error
- Check that `ADMIN_SECRET` is set in your environment
- Verify you're using the correct secret in the Authorization header
- Ensure the format is exactly: `Bearer <secret>` (note the space)

### "No battles found in database"
- Ensure battles have been uploaded to Supabase
- Check that `fetchBattlesFromSupabase()` is working correctly
- Verify database connection in environment variables

### Slow Response Times
- This is expected - scanning involves blockchain RPC calls
- Consider reducing the `limit` parameter
- Use `onlyQuickBattles=true` to scan fewer battles

### "All battles are already up-to-date"
- Battles are considered up-to-date if scanned within last 24 hours
- Use `forceRefresh=true` to override this behavior

## Monitoring

Check Vercel logs or your hosting platform's logs to monitor scan progress:

```
🔍 Starting battle scan: limit=50, forceRefresh=false, onlyQuickBattles=false
📊 Found 166 total battles
📋 Scanning 50 battles (116 already up-to-date)
[1/50] Scanning battle 1748420717...
✅ [1/50] Success: 1748420717
[2/50] Scanning battle 1748478141...
✅ [2/50] Success: 1748478141
...
✨ Scan complete: 48 success, 2 errors
```
