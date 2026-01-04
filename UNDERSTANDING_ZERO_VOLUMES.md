# Understanding Zero Volumes in Quick Battle Leaderboard

## Issue: Why are volumes showing as 0?

If you see the Quick Battle leaderboard displaying:
- ◎0.0000 for all volumes
- 0W - 0L for all win/loss ratios
- 0.0% win rate

This is **expected behavior** when the battles haven't been scanned from the blockchain yet.

## Root Cause

The Quick Battle leaderboard displays data from the `battles` table in the database. The volume fields (`total_volume_a`, `total_volume_b`) are populated by scanning the Solana blockchain for transaction data.

When battles are first created:
1. Battle metadata is written to the database (track names, handles, etc.)
2. Volume fields are initially NULL or 0
3. A blockchain scan is needed to populate the actual transaction volumes

## How to Populate Volume Data

### Option 1: Use the "Scan Blockchain" Button (Recommended)
1. Open the Quick Battle Leaderboard in the UI
2. Click the **"Scan Blockchain"** button (lightning bolt icon)
3. Wait for the scan to complete (shows progress: "Scanning X/Y...")
4. Click **"Refresh"** to reload the leaderboard with updated data

### Option 2: Use the Scan API Endpoint
```bash
# Call the scan endpoint
curl https://your-domain.vercel.app/api/scan-quick-battles

# Then refresh the materialized view
# In Supabase SQL Editor:
SELECT refresh_quick_battle_leaderboard();
```

### Option 3: Wait for Automatic Scanning
Some deployments may have automated jobs that periodically scan battles. Check with your infrastructure team.

## What Data Should Show

After scanning, you should see:
- ✅ Volume values like ◎0.0551 ($X.XX USD)
- ✅ Win/loss ratios like 5W - 3L
- ✅ Accurate win percentages like 62.5% win rate

## Profile Picture Issue vs Volume Issue

These are **two separate issues**:

### 1. Profile Picture Issue (Fixed in this PR)
- **Problem**: Images fail to load, showing 🎵 fallback
- **Cause**: Database view used music URLs instead of image URLs for `audius_profile_pic`
- **Fix**: Application code + database migration
- **Status**: ✅ Application code fixed, ⚠️ database migration required

### 2. Zero Volumes (Not a bug)
- **Problem**: All volumes show as 0
- **Cause**: Battles haven't been scanned from blockchain yet
- **Fix**: Run blockchain scan
- **Status**: ⚠️ Requires manual action (click "Scan Blockchain" button)

## Verifying the Profile Picture Fix

Even with zero volumes, you can verify the profile picture fix works:

1. Check if `image_url` field is populated in the database:
```sql
SELECT track_name, image_url, audius_profile_pic, total_volume_generated
FROM v_quick_battle_leaderboard_public_old
LIMIT 5;
```

2. If `image_url` has values (like `https://blockdaemon-audius-content-07.bdnodes.net/content/...`), the images should load
3. If `image_url` is also NULL, then the battles don't have artwork metadata either

## Next Steps

1. **For the Profile Picture Fix**: Apply the database migration from `migrations/004_fix_quick_battle_profile_pic_urls.sql`
2. **For Volume Data**: Click "Scan Blockchain" in the UI to populate transaction volumes
3. **For Missing Artwork**: Check if the battles table has `image_url` or `quick_battle_artist*_audius_profile_pic` fields populated

## Expected Behavior After Full Fix

After both the database migration and blockchain scan:
- ✅ Profile pictures load from actual image URLs
- ✅ Volumes show real transaction data
- ✅ Win/loss ratios reflect actual battle outcomes
- ✅ No broken image errors in console
