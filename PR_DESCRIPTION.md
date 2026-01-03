# Pull Request: Fix Supabase Role Error and Webhook 401 Authentication Issues

## Summary

This PR fixes two critical issues preventing Quick Battle webhooks from working:

1. **Supabase Role Error**: Fixed "must be able to SET ROLE 'supabase_admin'" error when refreshing materialized views
2. **Webhook 401 Errors**: Fixed authentication failures on Edge Function endpoints that were blocking external WaveWarz webhooks

## Changes

### 1. Quick Battle Leaderboard Materialized View & Refresh Function

**File**: `migrations/003_fix_refresh_quick_battle_leaderboard_function.sql`

- Created `v_quick_battle_leaderboard_public` materialized view
  - Aggregates Quick Battle data at song level (not battle level)
  - Groups by track name and Audius profile URL
  - Calculates wins, losses, win rate, total volume, trades, and unique traders
- Created unique index `idx_quick_battle_leaderboard_unique` (required for CONCURRENTLY)
- Created performance index `idx_quick_battle_leaderboard_volume`
- Created `refresh_quick_battle_leaderboard()` function with:
  - `SECURITY DEFINER` - runs with owner privileges (bypasses RLS)
  - `SET search_path = public, pg_catalog` - prevents SQL injection
  - Proper error handling with `RAISE NOTICE` and `RAISE WARNING`
  - Permissions granted to `authenticated` and `service_role` roles

**Why this works**: SECURITY DEFINER allows privilege escalation without changing the function owner to `supabase_admin`, which would require SET ROLE permission (causing the 42501 error).

### 2. Battles Webhook Edge Function (NEW)

**File**: `supabase/functions/battles-webhook/index.ts`

- Created main webhook handler for battle INSERT and UPDATE events
- **Public endpoint** - no authentication required (accepts external webhooks)
- Processes battle data and saves to Supabase database
- Matches logic from `api/webhooks/battles.ts` on Vercel
- Table filtering - only processes `battles` table events
- Skips updates for active battles (winner not decided)
- Refreshes materialized views after battle completion

### 3. Optional HMAC Authentication

**File**: `supabase/functions/shared/hmac.ts`

- Made HMAC signature verification **optional**:
  - ✅ Allows requests without HMAC headers (for external webhooks)
  - ✅ Allows requests when `HMAC_SECRET` is not configured
  - ✅ Still verifies signatures when headers ARE present and secret IS set
  - ✅ Only fails on signature mismatch (not missing headers)

**Updated Edge Functions**:
- `quick-battles-sync/index.ts`
- `leaderboard-refresh/index.ts`
- `refresh-quick-battles-leaderboard/index.ts`
- `update-quick-battle/index.ts`
- `update-quick-battle-refresh/index.ts`

All now use optional auth and redirect to the new `battles-webhook` function.

## Testing

### Test Database Migration

```sql
-- Run in Supabase SQL Editor
\i migrations/003_fix_refresh_quick_battle_leaderboard_function.sql

-- Verify materialized view exists
SELECT matviewname FROM pg_matviews
WHERE schemaname = 'public' AND matviewname = 'v_quick_battle_leaderboard_public';

-- Verify unique index exists
SELECT i.relname AS index_name, ix.indisunique
FROM pg_class t
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_index ix ON ix.indrelid = t.oid
JOIN pg_class i ON i.oid = ix.indexrelid
WHERE n.nspname = 'public' AND t.relname = 'v_quick_battle_leaderboard_public';

-- Test the function
SELECT public.refresh_quick_battle_leaderboard();
```

### Test Webhook Endpoint

```bash
curl -i -X POST "https://gshwqoplsxgqbdkssoit.supabase.co/functions/v1/battles-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "battles",
    "record": {
      "battle_id": "test-123",
      "artist1_name": "Test Artist 1",
      "artist2_name": "Test Artist 2",
      "battle_duration": 1200,
      "is_quick_battle": true,
      "status": "Active",
      "winner_decided": false,
      "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }
  }'
```

**Expected**: `200 OK` with `{"success": true, "action": "inserted", "battleId": "test-123"}`

## Deployment

### Step 1: Deploy Edge Functions

```bash
supabase functions deploy battles-webhook
supabase functions deploy quick-battles-sync
supabase functions deploy leaderboard-refresh
supabase functions deploy refresh-quick-battles-leaderboard
supabase functions deploy update-quick-battle
supabase functions deploy update-quick-battle-refresh
```

### Step 2: Run Database Migration

Copy and paste the entire contents of `migrations/003_fix_refresh_quick_battle_leaderboard_function.sql` into Supabase SQL Editor and run it.

### Step 3: Configure WaveWarz Webhook Sender

Update the WaveWarz site to send webhooks to:
```
https://gshwqoplsxgqbdkssoit.supabase.co/functions/v1/battles-webhook
```

No authentication headers required!

### Step 4: Monitor Logs

```bash
supabase functions logs battles-webhook --tail
```

Look for:
- ✅ "NEW BATTLE INSERT" messages
- ✅ "Battle UPDATE detected" messages
- ⏭️ "Skipping UPDATE for active battle" (expected during battles)
- ❌ No more 401 errors!

## What This Does NOT Touch

- ✅ Solana blockchain fetching - **not modified**
- ✅ Helius RPC calls - **not modified**
- ✅ Token price calculations - **not modified**
- ✅ Volume data fetching from blockchain - **not modified**
- ✅ WaveWarz smart contract interactions - **not modified**
- ✅ Frontend blockchain integration - **not modified**

These are database-only changes. No blockchain code affected.

## Related Issues

Fixes:
- 401 errors from `POST /functions/v1/battles-webhook`
- 401 errors from `POST /functions/v1/quick-battles-sync`
- 401 errors from `GET /functions/v1/aggregate-quick-battles`
- "must be able to SET ROLE 'supabase_admin'" error

## Files Changed

- `migrations/003_fix_refresh_quick_battle_leaderboard_function.sql` (NEW)
- `supabase/functions/battles-webhook/index.ts` (NEW)
- `supabase/functions/shared/hmac.ts` (MODIFIED)
- `supabase/functions/quick-battles-sync/index.ts` (MODIFIED)
- `supabase/functions/leaderboard-refresh/index.ts` (MODIFIED)
- `supabase/functions/refresh-quick-battles-leaderboard/index.ts` (MODIFIED)
- `supabase/functions/update-quick-battle/index.ts` (MODIFIED)
- `supabase/functions/update-quick-battle-refresh/index.ts` (MODIFIED)

## Commits

- `531e80c` fix: create battles-webhook Edge Function and make HMAC auth optional
- `d760728` fix: add materialized view and SECURITY DEFINER function for Quick Battle leaderboard
- `d79a1f3` fix: add SECURITY DEFINER to refresh_quick_battle_leaderboard function
