-- ============================================================================
-- MIGRATION: Fix Profile Picture URLs in Quick Battle Leaderboard View
-- ============================================================================
-- Generated: 2026-01-04
-- Issue: audius_profile_pic field incorrectly set to music link instead of profile picture URL
--
-- Problem:
-- The v_quick_battle_leaderboard_public view was using artist1_music_link and
-- artist2_music_link for the audius_profile_pic field, which are track URLs,
-- not profile picture URLs. This causes broken images in the UI.
--
-- Solution:
-- Update the view to use quick_battle_artist1_audius_profile_pic and
-- quick_battle_artist2_audius_profile_pic fields instead, which contain
-- the actual profile picture URLs.
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop and recreate the materialized view with correct fields
-- ============================================================================

-- Drop the old view
DROP MATERIALIZED VIEW IF EXISTS public.v_quick_battle_leaderboard_public CASCADE;

-- Recreate the materialized view with corrected profile picture fields
CREATE MATERIALIZED VIEW public.v_quick_battle_leaderboard_public AS
WITH song_battles AS (
  -- Extract all songs and their battles from artist1 position
  SELECT
    COALESCE(artist1_name, 'Unknown') as track_name,
    quick_battle_artist1_audius_profile_pic as audius_profile_pic,
    artist1_music_link as audius_profile_url,
    -- Extract Audius handle from the music link
    CASE
      WHEN artist1_music_link ~ 'audius\.co/([^/]+)/' THEN
        (regexp_match(artist1_music_link, 'audius\.co/([^/]+)/'))[1]
      ELSE NULL
    END as audius_handle,
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
    AND is_test_battle = false

  UNION ALL

  -- Extract all songs and their battles from artist2 position
  SELECT
    COALESCE(artist2_name, 'Unknown') as track_name,
    quick_battle_artist2_audius_profile_pic as audius_profile_pic,
    artist2_music_link as audius_profile_url,
    -- Extract Audius handle from the music link
    CASE
      WHEN artist2_music_link ~ 'audius\.co/([^/]+)/' THEN
        (regexp_match(artist2_music_link, 'audius\.co/([^/]+)/'))[1]
      ELSE NULL
    END as audius_handle,
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
    AND is_test_battle = false
)
SELECT
  track_name,
  -- Use the first non-null Audius handle for this track name
  MAX(audius_handle) as audius_handle,
  -- Use the first non-null profile pic for this track name
  MAX(audius_profile_pic) as audius_profile_pic,
  -- Use the first non-null profile URL for this track name
  MAX(audius_profile_url) as audius_profile_url,
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
GROUP BY track_name
ORDER BY total_volume_generated DESC;

-- ============================================================================
-- STEP 2: Recreate indexes
-- ============================================================================

-- Create unique index on the materialized view (required for CONCURRENTLY refresh)
CREATE UNIQUE INDEX idx_quick_battle_leaderboard_unique
  ON public.v_quick_battle_leaderboard_public (track_name);

-- Create additional index for performance on the main sort column
CREATE INDEX idx_quick_battle_leaderboard_volume
  ON public.v_quick_battle_leaderboard_public (total_volume_generated DESC);

-- ============================================================================
-- STEP 3: Update the refresh function to match new view structure
-- ============================================================================

-- The refresh function doesn't need changes, but we'll recreate it for consistency
DROP FUNCTION IF EXISTS public.refresh_quick_battle_leaderboard() CASCADE;

CREATE OR REPLACE FUNCTION public.refresh_quick_battle_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_quick_battle_leaderboard_public;
  RAISE NOTICE 'Successfully refreshed v_quick_battle_leaderboard_public materialized view';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to refresh v_quick_battle_leaderboard_public: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- Set proper permissions
REVOKE ALL ON FUNCTION public.refresh_quick_battle_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_quick_battle_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_quick_battle_leaderboard() TO service_role;

COMMENT ON FUNCTION public.refresh_quick_battle_leaderboard() IS 'Refreshes the v_quick_battle_leaderboard_public materialized view. Uses SECURITY DEFINER to bypass RLS policies. Safe search_path prevents SQL injection.';

-- ============================================================================
-- STEP 4: Create backwards-compatible alias view
-- ============================================================================

-- Create the _old view as an alias that points to the new view structure
-- This ensures backwards compatibility with existing queries
CREATE OR REPLACE VIEW public.v_quick_battle_leaderboard_public_old AS
SELECT
  track_name,
  audius_handle,
  audius_profile_pic,
  audius_profile_url,
  battles_participated,
  wins,
  losses,
  win_rate,
  total_volume_generated,
  -- Add calculated field for backwards compatibility
  CASE
    WHEN battles_participated > 0 
    THEN total_volume_generated / battles_participated
    ELSE 0
  END as avg_volume_per_battle,
  total_trades,
  unique_traders,
  created_at as first_battle_date,
  updated_at as last_battle_date,
  updated_at
FROM public.v_quick_battle_leaderboard_public;

-- Grant read permissions on the alias view
GRANT SELECT ON public.v_quick_battle_leaderboard_public_old TO authenticated;
GRANT SELECT ON public.v_quick_battle_leaderboard_public_old TO anon;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check the view has data and profile pics are populated
-- SELECT track_name, audius_profile_pic, audius_profile_url, battles_participated
-- FROM v_quick_battle_leaderboard_public_old
-- ORDER BY total_volume_generated DESC
-- LIMIT 5;

-- Expected: audius_profile_pic should contain profile picture URLs or NULL,
--           NOT music track URLs like https://audius.co/artist/song-name

-- ============================================================================
