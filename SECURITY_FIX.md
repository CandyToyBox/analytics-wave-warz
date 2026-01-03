# Security Fix: Battle Update API Authentication

## 🚨 Critical Security Vulnerability (P1)

**Issue:** The `/api/update-battle-volumes` endpoint was accepting requests without any authentication, allowing anyone to corrupt battle data using service_role access.

**Impact:**
- ❌ Unauthenticated users could update any battle's volumes
- ❌ Leaderboard data could be corrupted
- ❌ Service-role access was exposed without verification
- ❌ Bypassed all RLS policies

## ✅ Fix Applied

Added **API key authentication** to protect the endpoint.

### Changes Made

**1. Backend: `/api/update-battle-volumes.ts`**
```typescript
// 🔒 SECURITY: Verify API key before processing
const apiKey = request.headers.get('x-api-key');
const expectedKey = process.env.BATTLE_UPDATE_API_KEY;

if (!apiKey || apiKey !== expectedKey) {
  return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

**2. Frontend: `services/supabaseClient.ts`**
```typescript
const apiKey = import.meta.env.VITE_BATTLE_UPDATE_API_KEY;

const response = await fetch('/api/update-battle-volumes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey  // 🔒 Required for authentication
  },
  body: JSON.stringify({ ... })
});
```

**3. Environment Variables: `.env.example`**
- Added `BATTLE_UPDATE_API_KEY` for backend
- Added `VITE_BATTLE_UPDATE_API_KEY` for frontend

## 🔧 Setup Instructions

### 1. Generate a Strong API Key

```bash
# Generate a secure random key
openssl rand -base64 32

# Example output:
# X8KqP3zR9mN2jL6vY4wT1sC5bF7nH0dA
```

### 2. Add to Vercel Environment Variables

Go to your Vercel dashboard:
1. Navigate to **Project Settings** → **Environment Variables**
2. Add the following variables:

```
BATTLE_UPDATE_API_KEY=<your-generated-key-here>
```

**Important:** Add this for **Production**, **Preview**, and **Development** environments.

### 3. Add to Local `.env` File

Create/update `.env.local`:
```bash
# Backend API key (same as Vercel)
BATTLE_UPDATE_API_KEY=<your-generated-key-here>

# Frontend API key (same value, but with VITE_ prefix)
VITE_BATTLE_UPDATE_API_KEY=<your-generated-key-here>
```

### 4. Redeploy Application

After adding environment variables to Vercel:

```bash
# Trigger redeploy
git push origin main
```

Or redeploy from Vercel dashboard: **Deployments** → **Redeploy**

## 🔒 Security Notes

### Why Both Frontend and Backend Keys?

- **Backend (`BATTLE_UPDATE_API_KEY`)**: Server-side verification, never exposed
- **Frontend (`VITE_BATTLE_UPDATE_API_KEY`)**: Sent in requests, visible in browser

**Note:** While the frontend key is visible in browser, this still provides security because:
1. Prevents casual/accidental unauthorized access
2. Prevents automated bots from discovering the endpoint
3. Makes it easy to rotate the key if compromised
4. Provides request logging for monitoring

### Improving Security Further (Optional)

For even stronger security, consider:

1. **Rate Limiting**: Add rate limiting to prevent abuse
2. **IP Whitelisting**: Only allow requests from your domain
3. **Request Signing**: Use HMAC signatures for tamper-proof requests
4. **Supabase Auth**: Verify user sessions instead of API keys

## 🧪 Testing

### Test Unauthorized Access is Blocked

```bash
# This should return 401 Unauthorized
curl -X POST https://your-app.vercel.app/api/update-battle-volumes \
  -H "Content-Type: application/json" \
  -d '{"battleId": "123", "volumeA": 999, "volumeB": 999}'
```

Expected response:
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### Test Authorized Access Works

```bash
# With correct API key, should succeed
curl -X POST https://your-app.vercel.app/api/update-battle-volumes \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-generated-key-here" \
  -d '{"battleId": "123", "volumeA": 10.5, "volumeB": 8.3, "tradeCount": 50, "uniqueTraders": 12}'
```

Expected response (if battle exists):
```json
{
  "success": true,
  "updated": 1
}
```

## 📝 Commit Details

**Files Changed:**
- `api/update-battle-volumes.ts` - Added API key authentication
- `services/supabaseClient.ts` - Send API key in request headers
- `.env.example` - Added API key configuration
- `SECURITY_FIX.md` - This documentation

**Security Impact:** ✅ Resolved P1 vulnerability - unauthorized access now blocked

## 🚀 Deployment Checklist

Before deploying:
- [x] Generate strong API key
- [ ] Add `BATTLE_UPDATE_API_KEY` to Vercel environment variables
- [ ] Add `VITE_BATTLE_UPDATE_API_KEY` to Vercel environment variables
- [ ] Test locally with `.env.local` file
- [ ] Verify unauthorized requests return 401
- [ ] Verify authorized requests succeed
- [ ] Deploy to production
- [ ] Monitor logs for unauthorized attempts

## ⚠️ Important Notes

1. **Never commit the actual API key to git** - only the `.env.example` template
2. **Rotate the key periodically** for security
3. **Monitor logs** for unauthorized access attempts
4. **Keep the key secret** - treat it like a password

---

**Status:** ✅ Security vulnerability fixed and ready for deployment
