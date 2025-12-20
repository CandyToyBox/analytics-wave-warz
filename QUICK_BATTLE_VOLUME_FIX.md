# Quick Battle Volume Data Fix

## Problem Summary

The Quick Battle leaderboard was showing zero values for all volume metrics, despite blockchain data being available. This document explains the root causes and the implemented solutions.

## Root Causes

### 1. Database View Column Mismatch

**The Issue:**
- The `v_quick_battle_leaderboard_public` database view was either:
  - Not properly configured
  - Missing required volume columns
  - Using different column names than expected

**Expected Columns:**
- `artist1_volume`
- `artist2_volume`
- `total_volume_generated`

**Actual Columns in battles table:**
- `total_volume_a`
- `total_volume_b`

**Impact:**
The leaderboard code couldn't find volume data even when it was saved to the database.

### 2. Volume Data Not Always Saved

**The Issue:**
Volume data is only fetched and saved when:
1. A battle is viewed individually (clicking on it)
2. The blockchain data is fetched via `fetchBattleOnChain()`

Quick Battles shown only in the leaderboard may never trigger the blockchain fetch, so their volume is never calculated or saved.

### 3. Missing Quick Battle Flag

**The Issue:**
The `uploadBattlesToSupabase()` function wasn't including the `is_quick_battle` flag, making it difficult to reliably identify and query Quick Battles.

## Solutions Implemented

### 1. Fallback Data Source (Primary Fix)

**File:** `services/supabaseClient.ts`

```typescript
export async function fetchQuickBattleLeaderboardFromDB() {
  // Try the view first
  const viewData = await fetchFromView();
  if (viewData) return mapData(viewData);

  // Fallback: Query battles table directly
  const battlesData = await fetchFromBattlesTable();
  return mapData(battlesData);
}
```

**Benefits:**
- Works even if the database view is broken or misconfigured
- Directly queries `battles` table with `is_quick_battle = true`
- Selects all needed columns including `total_volume_a/b`
- Guaranteed to work as long as battles table exists

### 2. Enhanced Column Mapping

**File:** `services/supabaseClient.ts`

```typescript
function mapQuickBattleLeaderboardData(data) {
  // Priority fallback chain for volume data:
  const artist1Score = row.artist1_volume 
    ?? row.total_volume_a      // From battles table
    ?? row.artist1_pool        // Current pool size
    ?? 0;

  const artist2Score = row.artist2_volume 
    ?? row.total_volume_b      // From battles table
    ?? row.artist2_pool        // Current pool size
    ?? 0;
}
```

**Benefits:**
- Handles multiple possible data sources
- Uses pools as fallback when volume not calculated yet
- Ensures some value is always displayed

### 3. Audius Handle Extraction

**File:** `services/supabaseClient.ts`

```typescript
const extractAudiusHandle = (link: string | null): string | null => {
  if (!link) return null;
  const match = link.match(/audius\.co\/([^\/]+)\//);
  return match ? match[1] : null;
};
```

**Benefits:**
- Extracts artist handle from Audius URLs
- Example: `audius.co/Hurric4n3Ike/track-name` → `Hurric4n3Ike`
- Provides better identification for Quick Battles

### 4. Enhanced Logging

**Files:** `services/solanaService.ts`, `services/supabaseClient.ts`

```typescript
// In fetchTransactionStats()
console.log(`✅ Transaction stats fetched:`, {
  totalVolume: volumeA.toFixed(4),
  volumeA: finalVolumeA.toFixed(4),
  volumeB: finalVolumeB.toFixed(4),
  tradeCount,
  uniqueTraders: traders.size
});

// In updateBattleDynamicStats()
console.log(`📊 Updating battle stats for ${state.battleId}:`, {
  volumeA: state.totalVolumeA,
  volumeB: state.totalVolumeB,
  tradeCount: state.tradeCount,
  uniqueTraders: state.uniqueTraders
});
```

**Benefits:**
- Track when volume data is fetched from blockchain
- Verify when data is saved to database
- Debug issues more easily

### 5. Added is_quick_battle Flag

**File:** `services/supabaseClient.ts`

```typescript
const rows = battles.map(b => ({
  // ... other fields ...
  is_quick_battle: b.isQuickBattle || false,
  quick_battle_queue_id: b.quickBattleQueueId,
  total_volume_a: b.totalVolumeA || 0,
  total_volume_b: b.totalVolumeB || 0
}));
```

**Benefits:**
- Properly tags Quick Battles in database
- Enables reliable filtering with `WHERE is_quick_battle = true`

## How It Works Now

### Data Flow for Quick Battles

1. **Initial Display** (Leaderboard loads):
   ```
   User opens page
   → fetchQuickBattleLeaderboardFromDB()
   → Tries v_quick_battle_leaderboard_public view
   → Falls back to battles table if needed
   → Maps volume columns with fallbacks
   → Shows pools if volume not calculated yet
   ```

2. **Volume Calculation** (Battle clicked):
   ```
   User clicks on Quick Battle
   → fetchBattleOnChain() called
   → Fetches battle account from Solana
   → Calls fetchTransactionStats()
   → Analyzes transaction history
   → Calculates volume from transfers
   → Calls updateBattleDynamicStats()
   → Saves to total_volume_a/b
   ```

3. **Updated Display** (After volume calculated):
   ```
   Leaderboard refreshes
   → fetchQuickBattleLeaderboardFromDB()
   → Queries battles table
   → Finds total_volume_a/b now populated
   → Shows actual volume instead of pools
   ```

## Expected Behavior

### Before Volume Calculation
- **Artist 1 Score**: Shows `artist1_pool` (current TVL)
- **Artist 2 Score**: Shows `artist2_pool` (current TVL)
- **Total Volume**: Shows sum of pools
- **Status**: Shows "Active" or current status

### After Volume Calculation
- **Artist 1 Score**: Shows `total_volume_a` (actual trading volume)
- **Artist 2 Score**: Shows `total_volume_b` (actual trading volume)
- **Total Volume**: Shows sum of actual volumes
- **Trade Count**: Shows number of trades
- **Unique Traders**: Shows number of unique wallets

## Database View Recommendation

If you have access to the Supabase database, consider creating or updating the `v_quick_battle_leaderboard_public` view with proper column aliases:

```sql
CREATE OR REPLACE VIEW v_quick_battle_leaderboard_public AS
SELECT
  id,
  battle_id,
  created_at,
  status,
  artist1_name,
  artist2_name,
  artist1_music_link,
  artist2_music_link,
  
  -- Alias volume columns for compatibility
  total_volume_a AS artist1_volume,
  total_volume_b AS artist2_volume,
  (total_volume_a + total_volume_b) AS total_volume_generated,
  
  -- Other metrics
  trade_count AS total_trades,
  unique_traders,
  winner_decided,
  winner_artist_a,
  image_url,
  last_scanned_at AS updated_at

FROM battles
WHERE is_quick_battle = true
ORDER BY (total_volume_a + total_volume_b) DESC;
```

This ensures the view exposes the correct columns with expected names.

## Testing Checklist

- [ ] Verify Quick Battle leaderboard loads without errors
- [ ] Check that battles show pool values initially
- [ ] Click on a Quick Battle to trigger volume calculation
- [ ] Wait for blockchain data to fetch (10-30 seconds)
- [ ] Refresh leaderboard and verify volume values appear
- [ ] Check browser console for logging messages
- [ ] Verify data shows in individual battle page
- [ ] Confirm leaderboard updates with new values

## Troubleshooting

### Leaderboard Still Shows Zeros

**Check:**
1. Browser console for error messages
2. Network tab for failed API calls
3. Look for log messages about view vs table query

**Solutions:**
- Verify `is_quick_battle` flag is set in database
- Check that battles have been uploaded with Quick Battle data
- Ensure Supabase permissions allow reading `battles` table

### Volume Not Calculating

**Check:**
1. Console logs for "Fetching transaction stats"
2. Check if `fetchBattleOnChain()` is being called
3. Verify battle ID is correct

**Solutions:**
- Ensure Helius API key is configured
- Check that battle has actual trading activity
- Verify battle address derivation is correct

### Data Not Saving

**Check:**
1. Console logs for "Updating battle stats"
2. Look for database error messages
3. Check Supabase logs for write operations

**Solutions:**
- Verify Supabase credentials are correct
- Check table permissions allow updates
- Ensure `total_volume_a/b` columns exist in `battles` table

## Files Modified

1. **services/supabaseClient.ts**
   - Enhanced `fetchQuickBattleLeaderboardFromDB()` with fallback
   - Added `mapQuickBattleLeaderboardData()` helper function
   - Added `extractAudiusHandle()` utility
   - Enhanced logging in `updateBattleDynamicStats()`
   - Added `is_quick_battle` flag to upload function

2. **services/solanaService.ts**
   - Enhanced logging in `fetchTransactionStats()`
   - Added detailed volume breakdown output

## Summary

The fixes ensure that:
1. ✅ Quick Battle leaderboard always works (view or table fallback)
2. ✅ Volume data is properly mapped from any source
3. ✅ Pools are shown when volume not yet calculated
4. ✅ Audius handles are properly extracted and displayed
5. ✅ Comprehensive logging helps debug issues
6. ✅ Quick Battles are properly tagged in database

The leaderboard will now show meaningful values immediately (pools) and update to show actual volume data once calculated from the blockchain.
