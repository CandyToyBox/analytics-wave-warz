# Webhook Behavior and Quick Battles Leaderboard - Implementation Guide

## Overview

This document explains the webhook behavior optimizations and Quick Battles leaderboard fixes implemented to address excessive API calls and improve data reliability.

## Changes Implemented

### 1. Webhook Logic Optimization

#### Table Filtering (NEW)
The webhook now filters out non-battles table events to prevent unnecessary processing:

```typescript
// Only process battles table
if (payload.table !== 'battles') {
  console.log(`⏭️ Skipping webhook trigger for unrelated table: ${payload.table}`);
  return Response.json({ 
    success: true, 
    action: 'skipped_table',
    reason: `Only 'battles' table is processed`,
    table: payload.table 
  });
}
```

**Impact**: Eliminates webhook calls for unrelated database tables, reducing unnecessary API invocations.

#### Active Battle Updates Skipping (EXISTING)
The webhook skips updates for active battles where `winner_decided = false`:

```typescript
// Skip updates for active battles
if (!battleData.winner_decided) {
  console.log(`⏭️ Skipping UPDATE for active battle ${battleId}`);
  return { 
    success: true, 
    action: 'skipped_active_battle',
    reason: 'Battle still active - updates only processed when winner decided',
    battleId 
  };
}
```

**Impact**: Prevents thousands of webhook triggers during active battles. Battle data is fetched on-demand when users view battles.

#### Enhanced Logging (NEW)
Added comprehensive logging for better observability:

- Webhook trigger details (type, table)
- Battle state information (pool values, winner status)
- Skip reasons with full context
- Processing timestamps

### 2. Quick Battles Leaderboard Optimization

#### Existing Fallback Mechanism
The leaderboard already has a robust fallback mechanism:

```typescript
export async function fetchQuickBattleLeaderboardFromDB() {
  // Try view first
  const viewData = await supabase
    .from('v_quick_battle_leaderboard_public')
    .select('*')
    .limit(200);

  if (viewData && viewData.length > 0) {
    return mapQuickBattleLeaderboardData(viewData);
  }

  // Fallback: Query battles table directly
  const battlesData = await supabase
    .from('battles')
    .select('...')
    .eq('is_quick_battle', true);

  // Aggregate by song
  const aggregatedData = aggregateQuickBattlesBySong(battlesData);
  return mapQuickBattleLeaderboardData(aggregatedData);
}
```

**Impact**: Guarantees leaderboard works even if database view fails or is empty.

#### Song Aggregation
Quick Battles are aggregated by song/track:

- Combines multiple battles featuring the same song
- Calculates total volume, wins, losses across all battles
- Extracts Audius track information from music links
- Provides comprehensive statistics per track

### 3. Database Schema Updates

#### Migration: Update is_quick_battle Flags
Created migration file `002_update_quick_battle_flags.sql` to:

1. **Update battles with short durations** (≤ 20 minutes)
2. **Update battles with Audius links** (song vs song battles)
3. **Update battles with specific naming patterns** (e.g., "Wavez x Artist")
4. **Ensure test battles are excluded** from Quick Battles

**How to Apply:**
```bash
# Connect to your Supabase database
psql -h your-db-host -U postgres -d your-database

# Run the migration
\i migrations/002_update_quick_battle_flags.sql

# Verify results
SELECT COUNT(*) FROM battles WHERE is_quick_battle = true;
```

### 4. Enhanced Observability

#### Webhook Logs
All webhook events now log:
- ✅ Processed updates (winner decided)
- ⏭️ Skipped updates (active battles)
- ⏭️ Skipped tables (non-battles)
- ❌ Errors with full context

#### Monitoring Recommendations
1. **Monitor webhook invocation counts** in Vercel or Supabase dashboard
2. **Track "skipped" vs "processed" ratio** - should see high skip rate
3. **Alert on error rates** above 1%
4. **Monitor Quick Battles leaderboard API response times**

## Deployment Instructions

### Step 1: Deploy Code Changes

```bash
# Commit and push webhook changes
git add api/webhooks/battles.ts
git commit -m "Add table filtering and enhanced logging to webhook"
git push origin main

# Deploy to Vercel (automatic on push)
# Or manually trigger deployment
vercel --prod
```

### Step 2: Apply Database Migration

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Using SQL Editor in Supabase Dashboard
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy contents of migrations/002_update_quick_battle_flags.sql
# 3. Execute the migration
# 4. Run verification queries

# Option C: Using psql
psql -h <your-db-host> -U postgres -d <your-database> \
  -f migrations/002_update_quick_battle_flags.sql
```

### Step 3: Verify Webhook Configuration

1. **Check Supabase Webhook Settings:**
   - Go to Supabase Dashboard → Database → Webhooks
   - Ensure webhook URL points to: `https://analytics-wave-warz.vercel.app/api/webhooks/battles`
   - Events: `INSERT` and `UPDATE` on `battles` table

2. **Test Webhook:**
   ```bash
   # Create a test battle in Supabase
   # Check Vercel logs for webhook processing
   # Should see "Skipping UPDATE for active battle" messages
   ```

### Step 4: Refresh Materialized Views (if applicable)

```sql
-- If you have materialized views for Quick Battles
REFRESH MATERIALIZED VIEW CONCURRENTLY v_quick_battle_leaderboard_public;
```

### Step 5: Verify Quick Battles Leaderboard

1. **Check API Response:**
   ```bash
   curl https://analytics-wave-warz.vercel.app/api/leaderboard/quick-battles
   ```

2. **Verify Data in UI:**
   - Navigate to Quick Battles leaderboard
   - Confirm volume data displays correctly
   - Check that song aggregation works properly

## Expected Behavior

### Webhook Invocations

**Before:**
- 66,000+ API invocations per month
- Webhook triggered for every pool update during active battles
- Processing updates that had no effect

**After:**
- Drastically reduced invocations (90%+ reduction expected)
- Webhook only processes:
  - New battle creation (INSERT)
  - Battle completion (UPDATE with winner_decided=true)
- All other updates are skipped with logging

### Quick Battles Leaderboard

**Before:**
- Empty or zero values when view fails
- No fallback mechanism
- Missing battles without `is_quick_battle` flag

**After:**
- Always displays data (view or direct query)
- Aggregates battles by song correctly
- Includes all Quick Battles via migration
- Robust column mapping for volume data

## Troubleshooting

### Issue: Webhook still processing too many events

**Solution:**
1. Check Vercel logs for "skipped" messages
2. Verify webhook is configured for only `battles` table
3. Ensure `winner_decided` logic is working correctly

### Issue: Quick Battles leaderboard still empty

**Solution:**
1. Run migration to update `is_quick_battle` flags
2. Check Supabase logs for query errors
3. Verify fallback mechanism is activating (check logs)
4. Manually test query:
   ```sql
   SELECT COUNT(*) FROM battles WHERE is_quick_battle = true;
   ```

### Issue: Duplicate webhook calls

**Solution:**
1. Check Supabase webhook configuration (should only be one webhook)
2. Verify no other services are calling the webhook
3. Consider adding request deduplication if needed

## Rate Limiting (Optional)

If you still see excessive webhook calls, consider adding rate limiting:

```typescript
// Example using simple in-memory rate limiter
const battleUpdateTimes = new Map<string, number>();
const RATE_LIMIT_MS = 60000; // 1 minute

function shouldProcessUpdate(battleId: string): boolean {
  const lastUpdate = battleUpdateTimes.get(battleId);
  const now = Date.now();
  
  if (lastUpdate && now - lastUpdate < RATE_LIMIT_MS) {
    return false; // Rate limited
  }
  
  battleUpdateTimes.set(battleId, now);
  return true;
}
```

**Note:** This is optional and may not be needed with the current skip logic.

## Monitoring Dashboard

Recommended metrics to track:

1. **Webhook Invocations**
   - Total calls per day
   - Skipped vs processed ratio
   - Error rate

2. **Quick Battles Leaderboard**
   - API response time
   - Number of battles displayed
   - Cache hit rate

3. **Database Performance**
   - Query execution time for `is_quick_battle` filter
   - Index usage statistics

## Support

For issues or questions:
1. Check Vercel deployment logs
2. Review Supabase database logs
3. Run verification queries from migration file
4. Check webhook configuration in Supabase Dashboard
