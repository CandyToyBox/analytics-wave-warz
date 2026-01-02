-- ============================================================================
-- MIGRATION: Create Quick Battle Leaderboard Materialized View and Refresh Function
-- ============================================================================
-- Generated: 2026-01-02
-- Issue: Fix "must be able to SET ROLE 'supabase_admin'" error
--
-- Summary:
-- - Create materialized view for Quick Battle leaderboard (if not exists)
-- - Create unique index required for CONCURRENTLY refresh
-- - Create refresh function with SECURITY DEFINER
-- - Use safe search_path to prevent SQL injection
-- - Properly grant EXECUTE permissions to authenticated users
-- ============================================================================

-- ============================================================================
-- PART A: Create Materialized View (if it doesn't exist)
-- ============================================================================

-- Create the materialized view that aggregates Quick Battle leaderboard data
-- This pre-computes song-level statistics for faster leaderboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS public.v_quick_battle_leaderboard_public AS
WITH song_battles AS (
  -- Extract all songs and their battles from artist1 position
  SELECT
    COALESCE(artist1_name, 'Unknown') as track_name,
    artist1_music_link as audius_profile_url,
    total_volume_a as volume,
    CASE
      WHEN winner_decided AND winner_artist_a THEN 1
      ELSE 0
    END as won,
    CASE
      WHEN winner_decided AND NOT winner_artist_a THEN 1
      ELSE 0
    END as lost,
    trade_count,
    unique_traders,
    created_at,
    last_scanned_at,
    image_url
  FROM battles
  WHERE is_quick_battle = true

  UNION ALL

  -- Extract all songs and their battles from artist2 position
  SELECT
    COALESCE(artist2_name, 'Unknown') as track_name,
    artist2_music_link as audius_profile_url,
    total_volume_b as volume,
    CASE
      WHEN winner_decided AND NOT winner_artist_a THEN 1
      ELSE 0
    END as won,
    CASE
      WHEN winner_decided AND winner_artist_a THEN 1
      ELSE 0
    END as lost,
    trade_count,
    unique_traders,
    created_at,
    last_scanned_at,
    image_url
  FROM battles
  WHERE is_quick_battle = true
)
SELECT
  track_name,
  audius_profile_url as audius_profile_pic,
  COUNT(*) as battles_participated,
  SUM(won) as wins,
  SUM(lost) as losses,
  CASE
    WHEN COUNT(*) > 0 THEN (SUM(won)::float / COUNT(*)) * 100
    ELSE 0
  END as win_rate,
  SUM(volume) as total_volume_generated,
  SUM(trade_count) as total_trades,
  SUM(unique_traders) as unique_traders,
  MIN(created_at) as created_at,
  MAX(last_scanned_at) as updated_at,
  MAX(image_url) as image_url
FROM song_battles
GROUP BY track_name, audius_profile_url
ORDER BY total_volume_generated DESC;

-- ============================================================================
-- PART B: Create Unique Index (required for CONCURRENTLY refresh)
-- ============================================================================

-- Create unique index on the materialized view
-- This is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY to work
-- Using track_name + audius_profile_url as the unique key
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_battle_leaderboard_unique
  ON public.v_quick_battle_leaderboard_public (track_name, audius_profile_url);

-- Create additional index for performance on the main sort column
CREATE INDEX IF NOT EXISTS idx_quick_battle_leaderboard_volume
  ON public.v_quick_battle_leaderboard_public (total_volume_generated DESC);

-- ============================================================================
-- PART C: Create Refresh Function
-- ============================================================================

-- Step 1: Drop the existing function (including any recursive versions)
DROP FUNCTION IF EXISTS public.refresh_quick_battle_leaderboard() CASCADE;

-- Step 2: Create the function with proper SECURITY DEFINER settings
-- SECURITY DEFINER allows the function to run with the privileges of the function owner
-- This bypasses Row Level Security (RLS) policies when refreshing the materialized view
-- NOTE: Requires a unique index on the materialized view for CONCURRENTLY to work
CREATE OR REPLACE FUNCTION public.refresh_quick_battle_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Requires a unique index on the materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_quick_battle_leaderboard_public;
  RAISE NOTICE 'Successfully refreshed v_quick_battle_leaderboard_public materialized view';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to refresh v_quick_battle_leaderboard_public: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- Step 3: Set proper permissions
REVOKE ALL ON FUNCTION public.refresh_quick_battle_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_quick_battle_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_quick_battle_leaderboard() TO service_role;

-- Step 4: Add helpful comment (single string for safety)
COMMENT ON FUNCTION public.refresh_quick_battle_leaderboard() IS 'Refreshes the v_quick_battle_leaderboard_public materialized view. Uses SECURITY DEFINER to bypass RLS policies. Safe search_path prevents SQL injection.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Check if materialized view exists
-- SELECT matviewname FROM pg_matviews
-- WHERE schemaname = 'public' AND matviewname = 'v_quick_battle_leaderboard_public';
-- Expected: 1 row returned

-- 2. Check if unique index exists (required for CONCURRENTLY)
-- SELECT i.relname AS index_name, ix.indisunique
-- FROM pg_class t
-- JOIN pg_namespace n ON n.oid = t.relnamespace
-- JOIN pg_index ix ON ix.indrelid = t.oid
-- JOIN pg_class i ON i.oid = ix.indexrelid
-- WHERE n.nspname = 'public' AND t.relname = 'v_quick_battle_leaderboard_public';
-- Expected: Shows idx_quick_battle_leaderboard_unique with indisunique = true

-- 3. Check function definition
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE proname = 'refresh_quick_battle_leaderboard';
-- Expected: prosecdef = true, proconfig shows search_path

-- 4. Test the function
-- SELECT public.refresh_quick_battle_leaderboard();
-- Expected: Success notice, no errors

-- 5. Check permissions
-- SELECT grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_name = 'refresh_quick_battle_leaderboard';
-- Expected: authenticated and service_role have EXECUTE

-- ============================================================================
-- NOTES
-- ============================================================================

-- Why SECURITY DEFINER?
-- - Materialized view refresh requires elevated privileges
-- - SECURITY DEFINER allows function to run as owner (not caller)
-- - This bypasses RLS policies that might prevent refresh

-- Why search_path = public, pg_catalog?
-- - Prevents SQL injection attacks via search_path manipulation
-- - Only allows objects from public schema and core PostgreSQL catalog
-- - Security best practice for SECURITY DEFINER functions

-- Why not change owner to supabase_admin?
-- - Would require SET ROLE permission (which causes the 42501 error)
-- - Not necessary - SECURITY DEFINER handles privilege escalation
-- - Current owner (likely postgres or service_role) has sufficient permissions

-- Why CONCURRENTLY?
-- - Allows reads while refreshing the materialized view
-- - Prevents locking the table during refresh
-- - REQUIRES a unique index on the materialized view

-- ============================================================================
