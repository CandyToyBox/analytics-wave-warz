# Fix for Cron Job Error: Materialized View Not Found

## Problem

The database logs show repeated errors:
```
ERROR: Materialized view public.v_quick_battle_leaderboard_public_mv not found
```

This occurs because:
1. The cron job is trying to refresh a view named `v_quick_battle_leaderboard_public_mv` (with `_mv` suffix)
2. The actual view is named `v_quick_battle_leaderboard_public` (without `_mv` suffix)

The cron jobs run every 5 minutes:
- `cron job 2`: `SELECT public.refresh_qbl_public_mv_safe();`
- `cron job 12`: `SELECT public.refresh_quick_battle_leaderboard();`

## Solution

Run the following SQL commands in your Supabase SQL Editor to fix the cron job references:

### Step 1: Check Current Cron Jobs

```sql
-- View all cron jobs
SELECT * FROM cron.job ORDER BY jobid;
```

### Step 2: Update or Remove Problematic Cron Jobs

```sql
-- Option A: Remove the problematic cron job that references the non-existent function
SELECT cron.unschedule('refresh_qbl_public_mv_safe');

-- Option B: Update the cron job to call the correct function
-- First, find the job ID:
SELECT jobid, jobname, schedule, command 
FROM cron.job 
WHERE command LIKE '%refresh_qbl_public_mv_safe%';

-- Then update it (replace <jobid> with the actual job ID):
UPDATE cron.job 
SET command = 'SELECT public.refresh_quick_battle_leaderboard();'
WHERE jobid = <jobid>;
```

### Step 3: Verify the Fix

```sql
-- Check that the correct function exists and works
SELECT public.refresh_quick_battle_leaderboard();

-- Verify the materialized view exists
SELECT schemaname, matviewname 
FROM pg_matviews 
WHERE schemaname = 'public' 
  AND matviewname LIKE '%quick_battle%';
```

### Step 4: Clean Up (Optional)

If you want to remove the old function reference entirely:

```sql
-- Drop the non-existent function reference if it exists
DROP FUNCTION IF EXISTS public.refresh_qbl_public_mv_safe() CASCADE;
```

## Expected Result

After applying these fixes:
- No more "Materialized view not found" errors in logs
- Cron jobs will successfully refresh the Quick Battle leaderboard every 5 minutes
- The view name will be consistent: `v_quick_battle_leaderboard_public`

## Notes

- The current system has two cron jobs trying to refresh the same view
- Consider keeping only one cron job for efficiency
- The refresh function `refresh_quick_battle_leaderboard()` is defined in migration `004_fix_quick_battle_profile_pic_urls.sql`
