# HMAC Setup Complete Guide

## 🎯 Quick Start

Your HMAC secret has been generated:
```
98879a5d75d46b7c52957a29e723b29c53cf89b0fe3e6692ce126f48c02a5c39
```

## 📋 Setup Steps

### Step 1: Set the Secret in Supabase

**Option A: Via Dashboard (Easiest)**

You're already in the right place in your screenshot!

1. In the Supabase Dashboard → Edge Functions → Secrets
2. Find the row with **Name:** `HMAC_SECRET`
3. Replace the **Value** with:
   ```
   98879a5d75d46b7c52957a29e723b29c53cf89b0fe3e6692ce126f48c02a5c39
   ```
4. Click **Save**

**Option B: Via CLI**

```bash
# Run the provided script
./.secrets/set-hmac-secret.sh

# Or manually:
supabase secrets set HMAC_SECRET="98879a5d75d46b7c52957a29e723b29c53cf89b0fe3e6692ce126f48c02a5c39"
```

### Step 2: Deploy Functions (If needed)

If you've made code changes, deploy:

```bash
supabase functions deploy
```

Or deploy specific functions:
```bash
supabase functions deploy quick-battles-sync
supabase functions deploy leaderboard-refresh
supabase functions deploy refresh-quick-battles-leaderboard
supabase functions deploy update-quick-battle
supabase functions deploy update-quick-battle-refresh
```

### Step 3: Test the Setup

```bash
# Update the FUNCTION_URL in test-hmac.js first, then run:
node test-hmac.js

# Or with environment variables:
FUNCTION_URL=https://YOUR_PROJECT.functions.supabase.co/quick-battles-sync node test-hmac.js
```

## 🧪 Testing

### Test Script

A comprehensive test script `test-hmac.js` has been created. It tests:

1. ✅ Valid signature (should return 2xx)
2. ❌ Invalid/tampered signature (should return 401)
3. ❌ Old timestamp >5 minutes (should return 401)

### Manual Testing with curl

If you prefer curl, here's a quick test:

```bash
# Generate timestamp
TS=$(date +%s)

# Your body
BODY='{"test":"ping"}'

# Generate signature
SIGNATURE=$(echo -n "${TS}.${BODY}" | openssl dgst -sha256 -hmac "98879a5d75d46b7c52957a29e723b29c53cf89b0fe3e6692ce126f48c02a5c39" | cut -d' ' -f2)

# Make request
curl -X POST https://YOUR_PROJECT.functions.supabase.co/quick-battles-sync \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: ${TS}" \
  -H "X-Signature: ${SIGNATURE}" \
  -d "${BODY}"
```

## 🔐 Security Notes

1. **Keep this secret safe!** Never commit it to git
2. **Rotate regularly** - Generate a new secret periodically
3. **Use different secrets** for staging/production if you have multiple environments
4. **Share securely** with your team using a password manager or secret management system

## 📦 Client Implementation

When calling these functions from your application, you need to:

1. **Calculate timestamp**: Current Unix timestamp in seconds
2. **Build payload**: `${timestamp}.${JSON.stringify(body)}`
3. **Generate signature**: HMAC-SHA256 of payload using the secret
4. **Send headers**:
   - `X-Timestamp: ${timestamp}`
   - `X-Signature: ${signature}`

### Example (Node.js)

```javascript
const crypto = require('crypto');

const HMAC_SECRET = process.env.HMAC_SECRET;
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify({ your: 'data' });
const payload = `${timestamp}.${body}`;
const signature = crypto
  .createHmac('sha256', HMAC_SECRET)
  .update(payload)
  .digest('hex');

fetch('https://YOUR_PROJECT.functions.supabase.co/quick-battles-sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Timestamp': timestamp,
    'X-Signature': signature
  },
  body
});
```

### Example (Python)

```python
import hmac
import hashlib
import time
import json
import requests

HMAC_SECRET = 'your-secret-here'
timestamp = str(int(time.time()))
body = json.dumps({'your': 'data'})
payload = f'{timestamp}.{body}'
signature = hmac.new(
    HMAC_SECRET.encode(),
    payload.encode(),
    hashlib.sha256
).hexdigest()

requests.post(
    'https://YOUR_PROJECT.functions.supabase.co/quick-battles-sync',
    headers={
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature
    },
    data=body
)
```

## 🎓 Current Function Status

Based on verification:

| Function | Version | Status | verify_jwt |
|----------|---------|--------|------------|
| quick-battles-sync | v5 | ACTIVE | ✅ false |
| leaderboard-refresh | v5 | ACTIVE | ✅ false |
| refresh-quick-battles-leaderboard | v4 | ACTIVE | ✅ false |
| update-quick-battle | v4 | ACTIVE | ✅ false |
| update-quick-battle-refresh | v4 | ACTIVE | ✅ false |
| battles-webhook | v1 | ACTIVE | ⚠️ true (still using JWT) |

**Note**: `battles-webhook` still has `verify_jwt: true`. If you want it HMAC-only as well, update its config and redeploy.

## ❓ Troubleshooting

### "Invalid signature" errors
- Ensure timestamp and body match exactly between client and server
- Check that the HMAC secret is the same on both sides
- Verify the payload format is `${timestamp}.${body}`

### "Timestamp too old" errors
- Client and server clocks must be synchronized
- Current window is ±5 minutes (300 seconds)
- Consider using NTP to sync clocks

### Function returns 500
- Check function logs: `supabase functions logs <function-name>`
- Verify HMAC_SECRET is set: `supabase secrets list`

## 🚀 Next Steps

1. ✅ Set the HMAC_SECRET (you're doing this now!)
2. Test with `test-hmac.js`
3. Update your application clients to send HMAC signatures
4. Monitor logs for any authentication failures
5. Consider adding replay protection if needed (using Deno KV)

## 📚 Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [HMAC Authentication Best Practices](https://www.rfc-editor.org/rfc/rfc2104)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
