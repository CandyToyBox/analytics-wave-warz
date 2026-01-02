-- ============================================================================
-- SQL Commands to Fix Quick Battles Materialized View
-- ============================================================================
-- Run these commands in your Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- Option 1: If the view exists, just refresh it
-- This updates the view with latest data from battles table
REFRESH MATERIALIZED VIEW CONCURRENTLY v_quick_battle_leaderboard_public;

-- Option 2: If the view doesn't exist, create it
-- (This is from migrations/003_fix_refresh_quick_battle_leaderboard_function.sql)
-- Uncomment and run if Option 1 fails:

/*
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

-- Create unique index (required for CONCURRENTLY refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_battle_leaderboard_unique
  ON public.v_quick_battle_leaderboard_public (track_name, audius_profile_url);

-- Create performance index
CREATE INDEX IF NOT EXISTS idx_quick_battle_leaderboard_volume
  ON public.v_quick_battle_leaderboard_public (total_volume_generated DESC);
*/

-- ============================================================================
-- Verification Query
-- ============================================================================
-- After running the refresh/create, verify the view has data:
SELECT COUNT(*) as total_songs, SUM(total_volume_generated) as total_volume
FROM v_quick_battle_leaderboard_public;

-- View sample entries:
SELECT track_name, battles_participated, wins, losses, total_volume_generated
FROM v_quick_battle_leaderboard_public
ORDER BY total_volume_generated DESC
LIMIT 10;
