-- ============================================================================
-- Check Quick Battle Volume Data in Battles Table
-- ============================================================================
-- Run this to see what volume columns have data
-- ============================================================================

-- Query 1: Check which volume columns have data for quick battles
SELECT
  COUNT(*) as total_quick_battles,
  COUNT(total_volume_a) as has_total_volume_a,
  COUNT(total_volume_b) as has_total_volume_b,
  COUNT(artist1_pool) as has_artist1_pool,
  COUNT(artist2_pool) as has_artist2_pool,
  SUM(total_volume_a) as sum_total_volume_a,
  SUM(total_volume_b) as sum_total_volume_b,
  SUM(artist1_pool) as sum_artist1_pool,
  SUM(artist2_pool) as sum_artist2_pool
FROM battles
WHERE is_quick_battle = true
  AND artist1_music_link IS NOT NULL
  AND artist2_music_link IS NOT NULL
  AND artist1_music_link LIKE '%audius.co%'
  AND artist2_music_link LIKE '%audius.co%';

-- Query 2: Sample a few quick battles to see the data
SELECT
  battle_id,
  artist1_name,
  artist2_name,
  total_volume_a,
  total_volume_b,
  artist1_pool,
  artist2_pool,
  trade_count,
  status
FROM battles
WHERE is_quick_battle = true
  AND artist1_music_link IS NOT NULL
  AND artist2_music_link IS NOT NULL
  AND artist1_music_link LIKE '%audius.co%'
  AND artist2_music_link LIKE '%audius.co%'
ORDER BY created_at DESC
LIMIT 5;
