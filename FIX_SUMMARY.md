# Fix Summary: Profile Picture URL Issue in Quick Battle Aggregation

## Issue
The Quick Battle leaderboard was displaying broken images because both the application code and database view were incorrectly using music track URLs instead of profile picture URLs for the `audius_profile_pic` field.

## Root Cause
1. **Application Code**: In `services/supabaseClient.ts`, the `aggregateQuickBattlesBySong()` function was setting `audius_profile_pic` to `track.musicLink` (line 319) instead of `track.profilePic`
2. **Database View**: The materialized view `v_quick_battle_leaderboard_public` was using `artist1_music_link`/`artist2_music_link` for the `audius_profile_pic` field instead of the actual profile picture fields (`quick_battle_artist1_audius_profile_pic`/`quick_battle_artist2_audius_profile_pic`)
3. **Workaround**: The mapping function had a workaround that preferred `image_url` over `audius_profile_pic` because of the known bug

## Changes Made

### 1. Application Code (`services/supabaseClient.ts`)
**Line 319** - Fixed aggregation function:
```typescript
// Before:
audius_profile_pic: track.musicLink,

// After:
audius_profile_pic: track.profilePic,
```

**Line 320** - Added fallback for profile URL:
```typescript
// Before:
audius_profile_url: track.musicLink,

// After:
audius_profile_url: track.profilePic || track.musicLink,
```

**Line 487** - Removed workaround in mapping function:
```typescript
// Before (workaround):
audiusProfilePic: row.image_url ?? row.audius_profile_pic ?? row.artist1_music_link ?? row.artist2_music_link,

// After (trusts the fixed field):
audiusProfilePic: row.audius_profile_pic ?? row.image_url ?? null,
```

### 2. Database Migration (`migrations/004_fix_quick_battle_profile_pic_urls.sql`)
- Drops and recreates the materialized view to use correct fields
- Uses `quick_battle_artist1_audius_profile_pic` and `quick_battle_artist2_audius_profile_pic` instead of music links
- Adds `audius_handle` extraction from music links
- Creates backwards-compatible alias view `v_quick_battle_leaderboard_public_old`
- Maintains all existing indexes for performance

### 3. Documentation (`migrations/HOW_TO_APPLY_PROFILE_PIC_FIX.md`)
- Provides step-by-step instructions for applying the database migration
- Includes verification queries to confirm the fix
- Explains the impact and backwards compatibility

## How to Deploy

### Step 1: Application Code (Automatic)
The application code changes are already committed and will be deployed automatically when merged to the main branch.

### Step 2: Database Migration (Manual)
The database migration **must be run manually** in Supabase:

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy the entire contents of `migrations/004_fix_quick_battle_profile_pic_urls.sql`
4. Run the query
5. Verify success with:
```sql
SELECT track_name, audius_profile_pic, audius_profile_url, battles_participated
FROM v_quick_battle_leaderboard_public_old
ORDER BY total_volume_generated DESC
LIMIT 5;
```

## Expected Results
After deploying both changes:
1. ✅ Profile pictures will load correctly in the Quick Battle leaderboard
2. ✅ No more broken image icons
3. ✅ The `audius_profile_pic` field will contain actual profile picture URLs, not track URLs
4. ✅ Existing queries continue to work through the backwards-compatible alias view

## Backwards Compatibility
- The `v_quick_battle_leaderboard_public_old` alias view ensures existing queries continue to work
- The application code gracefully handles both old and new data formats with fallbacks
- No breaking changes to the API or UI components

## Verification
After deployment, check:
1. Open the Quick Battle Leaderboard in the UI
2. Click "Refresh" to fetch latest data
3. Verify profile pictures load correctly
4. Check browser console for no image loading errors

## Security & Performance
- ✅ Code review passed with no issues
- ✅ CodeQL security scan passed with no vulnerabilities
- ✅ No performance impact - uses same indexes as before
- ✅ View refresh performance unchanged

## Files Changed
1. `services/supabaseClient.ts` - Fixed aggregation and mapping logic
2. `migrations/004_fix_quick_battle_profile_pic_urls.sql` - Database view fix
3. `migrations/HOW_TO_APPLY_PROFILE_PIC_FIX.md` - Deployment instructions

## Related Issues
- Fixes: https://github.com/CandyToyBox/analytics-wave-warz/pull/64#pullrequestreview-3625121053
- Addresses console errors showing broken image URLs in production deployment
