# Pull Request: Fix Console Errors and Quick Battle Functionality

## GitHub PR Link
**Create PR here:** https://github.com/CandyToyBox/analytics-wave-warz/compare/main...claude/fix-console-errors-zj32r?expand=1

---

## Title
```
Fix console errors and Quick Battle functionality
```

## Description

### Summary

This PR fixes multiple console errors in the WaveWarz Analytics application and resolves issues with the Quick Battle leaderboard functionality.

### Issues Fixed

#### 1. ✅ Database Column Error - `image_url` doesn't exist
- **Problem**: `v_quick_battle_leaderboard_public.image_url` column doesn't exist
- **Fix**: Removed `image_url` from SELECT queries in two locations:
  - `services/supabaseClient.ts:129`
  - `src/hooks/useBattleData.ts:212`
- **Impact**: Eliminates console errors when loading Quick Battle leaderboard

#### 2. ✅ RLS Policy Violation - trader_leaderboard table
- **Problem**: Frontend attempting to write to `trader_leaderboard` table violates RLS policy
- **Fix**: Commented out `saveTraderLeaderboardToDB()` call in `TraderLeaderboard.tsx:120`
- **Impact**: Removes RLS violation errors (backend should handle this operation)

#### 3. ✅ Duplicate Artwork in Quick Battles
- **Problem**: Different songs showing the same album artwork
- **Fix**: Modified aggregation logic to use per-track profile pictures instead of battle-level images
  - Added `quick_battle_artist1_audius_profile_pic` and `quick_battle_artist2_audius_profile_pic` to battles query
  - Updated `extractTrackInfo` function to accept `profilePic` parameter
  - Changed aggregation to use per-track images with fallback
- **Impact**: Each song now displays its correct artwork

#### 4. ✅ Zero Volumes in Quick Battles
- **Problem**: All Quick Battle volumes showing as zero (`total_volume_a = 0`, `total_volume_b = 0`)
- **Fix**: Added "Scan Blockchain" button to `QuickBattleLeaderboard.tsx`
  - Fetches on-chain volume data from Solana blockchain using Helius RPC
  - Processes battles in batches of 3 with 2-second delays
  - Shows progress indicator during scanning
  - Auto-saves volume data to database via `updateBattleDynamicStats`
- **Impact**: Users can now populate volume data from blockchain

#### 5. ✅ "No Quick Battles found to scan" Error
- **Problem**: Scan Blockchain button couldn't identify Quick Battles
- **Root Cause**: `BATTLE_COLUMNS` constant missing `is_quick_battle` field
- **Fix**: Added missing fields to `BATTLE_COLUMNS` in `services/supabaseClient.ts:45-47`:
  - `is_quick_battle`
  - `quick_battle_queue_id`
  - `is_test_battle`
- **Impact**: Blockchain scanning now correctly identifies 115 Quick Battles

### Database Status (Verified)

- ✅ 115 Quick Battles in database
- ✅ 63 battles already have volume data (55%)
- ✅ 52 battles need blockchain scanning (45%)
- ✅ `is_quick_battle` field properly populated

### Files Changed

- `services/supabaseClient.ts` - Column fixes, per-track images, BATTLE_COLUMNS update
- `src/hooks/useBattleData.ts` - Removed duplicate image_url query
- `components/TraderLeaderboard.tsx` - Removed RLS-violating database write
- `components/QuickBattleLeaderboard.tsx` - Added blockchain scanning functionality
- `scripts/query-quick-battles.sql` - Added debugging query script

### Commits Included

```
4e287e1 chore: add Quick Battle query scripts for debugging
66654ec fix: add is_quick_battle field to BATTLE_COLUMNS constant
7382639 feat: add blockchain scan button to populate Quick Battle volumes
1e82e95 fix: use per-track images to prevent duplicate artwork in Quick Battles
2accc8f fix: remove image_url from duplicate query in src/hooks/useBattleData.ts
```

### Testing

- [x] Console errors eliminated
- [x] Quick Battle leaderboard displays correct artwork
- [x] Database queries verified (115 Quick Battles found)
- [x] `is_quick_battle` field properly fetched in battle queries
- [ ] Blockchain scanning to be tested after deployment

### Next Steps

After merging:
1. Deploy to production
2. Refresh QuickBattleLeaderboard page
3. Click "Scan Blockchain" to populate the 52 battles missing volume data

---

## Quick Instructions

1. Click the GitHub PR link above
2. Copy the title and description sections
3. Paste into the PR form
4. Click "Create Pull Request"
