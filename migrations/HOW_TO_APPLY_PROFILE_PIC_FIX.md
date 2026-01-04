# How to Apply the Profile Picture URL Fix

## Problem
The Quick Battle leaderboard displays broken images because the database view `v_quick_battle_leaderboard_public` incorrectly uses music track URLs instead of profile picture URLs.

## Solution
This fix updates both:
1. **Application Code**: Fixed in `services/supabaseClient.ts` (already committed)
2. **Database View**: Needs manual SQL migration in Supabase

## Steps to Apply Database Fix

### Option 1: Apply via Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `migrations/004_fix_quick_battle_profile_pic_urls.sql`
5. Click **Run**
6. Verify success - you should see "Success. No rows returned"

### Option 2: Apply via Supabase CLI
```bash
# Make sure you're connected to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
supabase db push

# Or run the specific migration file
supabase db execute --file migrations/004_fix_quick_battle_profile_pic_urls.sql
```

## Verification

After applying the migration, verify the fix:

1. **Check the view structure**:
```sql
SELECT track_name, audius_profile_pic, audius_profile_url, battles_participated
FROM v_quick_battle_leaderboard_public_old
ORDER BY total_volume_generated DESC
LIMIT 5;
```

Expected results:
- `audius_profile_pic` should contain profile picture URLs or NULL
- `audius_profile_pic` should **NOT** contain track URLs like `https://audius.co/artist/song-name`
- `audius_profile_url` should contain the music track URL

2. **Refresh the view** (if needed):
```sql
SELECT refresh_quick_battle_leaderboard();
```

3. **Test in the UI**:
- Navigate to the Quick Battle Leaderboard
- Click the "Refresh" button
- Verify that profile pictures load correctly instead of showing broken images

## What Changed

### Before (Broken)
```sql
-- Incorrectly used music link for profile pic
SELECT
  artist1_music_link as audius_profile_pic,  -- ❌ Wrong! This is a track URL
  ...
```

### After (Fixed)
```sql
-- Correctly uses profile pic field
SELECT
  quick_battle_artist1_audius_profile_pic as audius_profile_pic,  -- ✅ Correct!
  artist1_music_link as audius_profile_url,  -- Profile URL for context
  ...
```

## Impact
- **Application Code**: Fixed aggregation function will write correct data for new entries
- **Database View**: Fixed view will display correct profile pictures for all entries
- **Backwards Compatibility**: The `_old` view alias ensures existing queries continue to work

## Notes
- The migration is **idempotent** - safe to run multiple times
- No data loss - only the view structure changes
- The view automatically updates when the underlying `battles` table changes
- Some entries may still have NULL profile pics if the field wasn't populated in the battles table
