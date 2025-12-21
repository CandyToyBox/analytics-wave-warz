-- ============================================================================
-- MIGRATION: Update is_quick_battle Flags
-- ============================================================================
-- Generated: 2025-12-21
-- Issue: Fix Quick Battles leaderboard by ensuring correct is_quick_battle flag
-- 
-- Summary:
-- - Update existing battles with correct is_quick_battle flag
-- - Uses battle duration and naming patterns to identify Quick Battles
-- - Ensures Quick Battles leaderboard displays correctly
-- ============================================================================

-- STEP 1: Update battles with short durations (≤ 1200 seconds / 20 minutes)
-- These are typically Quick Battles
-- Reason: Quick Battles are designed to be short, fast-paced competitions
-- Safety: Only updates battles where is_quick_battle is not already set

UPDATE battles
SET is_quick_battle = true
WHERE 
  battle_duration <= 1200 
  AND (is_quick_battle IS NULL OR is_quick_battle = false)
  AND (is_test_battle IS NULL OR is_test_battle = false);

-- Verification after Step 1:
-- SELECT COUNT(*) FROM battles WHERE is_quick_battle = true;
-- Expected: Increased count of Quick Battles

-- ============================================================================

-- STEP 2: Update battles with Audius music links (song battles)
-- These are typically Quick Battles featuring Audius tracks
-- Reason: Quick Battles often feature Audius songs vs songs
-- Safety: Only updates if duration is reasonable for Quick Battles

UPDATE battles
SET is_quick_battle = true
WHERE 
  (
    artist1_music_link LIKE '%audius.co%' 
    OR artist2_music_link LIKE '%audius.co%'
  )
  AND battle_duration <= 3600
  AND (is_quick_battle IS NULL OR is_quick_battle = false)
  AND (is_test_battle IS NULL OR is_test_battle = false);

-- Verification after Step 2:
-- SELECT COUNT(*) FROM battles WHERE is_quick_battle = true AND (artist1_music_link LIKE '%audius.co%' OR artist2_music_link LIKE '%audius.co%');
-- Expected: Quick Battles with Audius links identified

-- ============================================================================

-- STEP 3: Update battles with specific naming patterns indicating Quick Battles
-- Pattern: "x Hurric4n3Ike" or similar patterns often used in Quick Battles
-- Reason: Quick Battles often have specific naming conventions
-- Safety: Only updates if not already marked

UPDATE battles
SET is_quick_battle = true
WHERE 
  (
    artist1_name LIKE '%Wavez x %'
    OR artist2_name LIKE '%Wavez x %'
    OR artist1_name LIKE '%x Hurric4n3Ike'
    OR artist2_name LIKE '%x Hurric4n3Ike'
  )
  AND battle_duration <= 3600
  AND (is_quick_battle IS NULL OR is_quick_battle = false)
  AND (is_test_battle IS NULL OR is_test_battle = false);

-- Verification after Step 3:
-- SELECT artist1_name, artist2_name, battle_duration, is_quick_battle 
-- FROM battles 
-- WHERE (artist1_name LIKE '%Wavez x %' OR artist2_name LIKE '%Wavez x %')
-- LIMIT 10;

-- ============================================================================

-- STEP 4: Ensure test battles are not marked as Quick Battles
-- Reason: Test battles should be excluded from Quick Battles leaderboard
-- Safety: Overrides previous updates for test battles

UPDATE battles
SET is_quick_battle = false
WHERE is_test_battle = true;

-- Verification after Step 4:
-- SELECT COUNT(*) FROM battles WHERE is_test_battle = true AND is_quick_battle = true;
-- Expected: 0 rows (no test battles should be marked as Quick Battles)

-- ============================================================================

-- FINAL VERIFICATION QUERIES
-- ============================================================================
--
-- 1. Count Quick Battles:
--    SELECT COUNT(*) FROM battles WHERE is_quick_battle = true;
--
-- 2. View Quick Battles distribution by duration:
--    SELECT 
--      CASE 
--        WHEN battle_duration <= 600 THEN '0-10 min'
--        WHEN battle_duration <= 1200 THEN '10-20 min'
--        WHEN battle_duration <= 1800 THEN '20-30 min'
--        ELSE '30+ min'
--      END as duration_range,
--      COUNT(*) as count
--    FROM battles
--    WHERE is_quick_battle = true
--    GROUP BY duration_range
--    ORDER BY duration_range;
--
-- 3. View Quick Battles with Audius links:
--    SELECT battle_id, artist1_name, artist2_name, battle_duration, 
--           artist1_music_link, artist2_music_link
--    FROM battles
--    WHERE is_quick_battle = true
--    AND (artist1_music_link LIKE '%audius.co%' OR artist2_music_link LIKE '%audius.co%')
--    LIMIT 10;
--
-- 4. Verify no test battles are marked as Quick Battles:
--    SELECT battle_id, is_test_battle, is_quick_battle
--    FROM battles
--    WHERE is_test_battle = true AND is_quick_battle = true;
--
-- ============================================================================

-- POST-MIGRATION ACTIONS:
-- ============================================================================
--
-- 1. Refresh materialized views (if any exist for Quick Battles):
--    REFRESH MATERIALIZED VIEW CONCURRENTLY v_quick_battle_leaderboard_public;
--
-- 2. Monitor Quick Battles leaderboard API:
--    - Check that /api/leaderboard/quick-battles returns data
--    - Verify volume data is displayed correctly
--    - Ensure song aggregation works properly
--
-- 3. Update webhook logic to set is_quick_battle on INSERT:
--    - Ensure new battles have correct is_quick_battle flag
--    - Based on battle_duration or other characteristics
--
-- ============================================================================
