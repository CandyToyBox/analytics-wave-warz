-- Query to check all Quick Battles in the database

-- Summary stats
SELECT
  COUNT(*) as total_quick_battles,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_battles,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_battles,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_battles,
  COUNT(CASE WHEN total_volume_a > 0 OR total_volume_b > 0 THEN 1 END) as battles_with_volume,
  COUNT(CASE WHEN (total_volume_a IS NULL OR total_volume_a = 0) AND (total_volume_b IS NULL OR total_volume_b = 0) THEN 1 END) as battles_missing_volume
FROM battles
WHERE is_quick_battle = true;

-- Detailed view of all Quick Battles
SELECT
  battle_id,
  artist1_name,
  artist2_name,
  status,
  quick_battle_queue_id,
  is_test_battle,
  COALESCE(total_volume_a, 0) as volume_a,
  COALESCE(total_volume_b, 0) as volume_b,
  created_at,
  battle_duration
FROM battles
WHERE is_quick_battle = true
ORDER BY created_at DESC
LIMIT 50;

-- Check if is_quick_battle field exists and has correct values
SELECT
  is_quick_battle,
  COUNT(*) as count
FROM battles
GROUP BY is_quick_battle
ORDER BY is_quick_battle;
