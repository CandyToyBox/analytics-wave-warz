-- ============================================================================
-- Verification Queries for Quick Battles Materialized View
-- ============================================================================
-- Run these in Supabase SQL Editor to verify the view is working
-- ============================================================================

-- Query 1: Check if view has data (should show count and total volume)
SELECT
  COUNT(*) as total_songs,
  SUM(total_volume_generated) as total_volume,
  SUM(battles_participated) as total_battles
FROM v_quick_battle_leaderboard_public;

-- Query 2: View top 10 songs by volume
SELECT
  track_name,
  battles_participated,
  wins,
  losses,
  total_volume_generated,
  total_trades
FROM v_quick_battle_leaderboard_public
ORDER BY total_volume_generated DESC
LIMIT 10;

-- Query 3: Check if the view columns match what the app expects
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'v_quick_battle_leaderboard_public'
ORDER BY ordinal_position;

-- Query 4: Verify the view exists and when it was last refreshed
SELECT
  schemaname,
  matviewname,
  ispopulated,
  definition
FROM pg_matviews
WHERE matviewname = 'v_quick_battle_leaderboard_public';
