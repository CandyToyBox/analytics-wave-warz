-- ============================================================================
-- Validation Script for Migration 005: Comprehensive Schema Refactoring
-- ============================================================================
-- This script validates that the migration was applied successfully
-- Run this AFTER applying 005_refactor_schema_comprehensive.sql
--
-- NOTE: This script uses psql-specific \echo commands for better formatting.
-- If running in Supabase Dashboard, the \echo lines will be ignored but
-- the queries will still execute and show results.
-- ============================================================================

\echo '================================================================'
\echo 'VALIDATION SCRIPT FOR MIGRATION 005'
\echo '================================================================'
\echo ''

-- ============================================================================
-- Test 1: Check CHECK Constraints on battles table
-- ============================================================================
\echo 'Test 1: Checking CHECK constraints on battles table...'
\echo ''

SELECT 
  conname as constraint_name,
  CASE contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
  END as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.battles'::regclass
  AND contype = 'c'
  AND conname LIKE 'battles_%_check'
ORDER BY conname;

\echo ''
\echo 'Expected: 9 CHECK constraints (artist1_pool, artist1_supply, artist2_pool, artist2_supply, total_volume_a, total_volume_b, trade_count, unique_traders, battle_duration)'
\echo ''

-- ============================================================================
-- Test 2: Check Indexes on battles table
-- ============================================================================
\echo 'Test 2: Checking indexes on battles table...'
\echo ''

SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'battles'
  AND schemaname = 'public'
  AND (
    indexname LIKE 'idx_battles_artist%_wallet'
    OR indexname LIKE 'idx_battles_is_%'
    OR indexname LIKE 'idx_battles_winner%'
    OR indexname LIKE 'idx_battles_last_scanned%'
  )
ORDER BY indexname;

\echo ''
\echo 'Expected: 7 new indexes (artist1_wallet, artist2_wallet, is_quick_battle, is_community_battle, is_test_battle, winner_decided_created, last_scanned_at)'
\echo ''

-- ============================================================================
-- Test 3: Check Trigger on battles table
-- ============================================================================
\echo 'Test 3: Checking trigger on battles table...'
\echo ''

SELECT 
  tgname as trigger_name,
  CASE tgenabled
    WHEN 'O' THEN 'ENABLED (origin)'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'ENABLED (replica)'
    WHEN 'A' THEN 'ENABLED (always)'
  END as status,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger 
WHERE tgrelid = 'public.battles'::regclass
  AND tgname = 'trig_update_artist_leaderboard';

\echo ''
\echo 'Expected: 1 trigger named trig_update_artist_leaderboard with status ENABLED (origin)'
\echo ''

-- ============================================================================
-- Test 4: Check CHECK Constraints on artist_leaderboard table
-- ============================================================================
\echo 'Test 4: Checking CHECK constraints on artist_leaderboard table...'
\echo ''

SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.artist_leaderboard'::regclass
  AND contype = 'c'
  AND conname LIKE 'artist_leaderboard_%_check'
ORDER BY conname;

\echo ''
\echo 'Expected: 7 CHECK constraints (total_earnings_sol, battles_participated, wins, losses, win_rate, total_volume_generated, avg_volume_per_battle)'
\echo ''

-- ============================================================================
-- Test 5: Check Indexes on leaderboard tables
-- ============================================================================
\echo 'Test 5: Checking indexes on leaderboard tables...'
\echo ''

SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
  AND (
    (tablename = 'artist_leaderboard' AND indexname LIKE 'idx_artist_leaderboard_%')
    OR (tablename = 'trader_leaderboard' AND indexname LIKE 'idx_trader_leaderboard_%')
  )
ORDER BY tablename, indexname;

\echo ''
\echo 'Expected: 6 indexes (3 on artist_leaderboard, 3 on trader_leaderboard)'
\echo ''

-- ============================================================================
-- Test 6: Check Function Permissions
-- ============================================================================
\echo 'Test 6: Checking function permissions...'
\echo ''

SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as config
FROM pg_proc
WHERE proname = 'update_artist_leaderboard'
  AND pronamespace = 'public'::regnamespace;

\echo ''
\echo 'Expected: 1 function with is_security_definer = true and search_path config'
\echo ''

-- ============================================================================
-- Test 7: Constraint Violation Test (Should FAIL)
-- ============================================================================
\echo 'Test 7: Testing constraint violation (should fail with error)...'
\echo ''
\echo 'Attempting to insert battle with negative volume...'

-- This should fail with constraint violation
-- Uses a transaction to ensure cleanup even if it somehow succeeds
DO $$
DECLARE
  test_uuid uuid := gen_random_uuid();
BEGIN
  -- Attempt to insert invalid data
  INSERT INTO battles (
    id, battle_id, artist1_name, artist1_wallet,
    artist2_name, artist2_wallet, total_volume_a
  ) VALUES (
    test_uuid, 'test_constraint_' || test_uuid::text,
    'Test Artist 1', 'test_wallet_1',
    'Test Artist 2', 'test_wallet_2',
    -100  -- Invalid negative value
  );
  
  -- If we reach here, the constraint didn't work - clean up and raise error
  DELETE FROM battles WHERE id = test_uuid;
  RAISE EXCEPTION 'ERROR: Constraint validation failed! Negative value was accepted.';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'SUCCESS: Constraint correctly rejected negative value';
  WHEN OTHERS THEN
    -- Clean up any test data if it somehow got inserted
    BEGIN
      DELETE FROM battles WHERE id = test_uuid;
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- Ignore cleanup errors
    END;
    RAISE;
END $$;

\echo ''

-- ============================================================================
-- Test 8: Quick Statistics
-- ============================================================================
\echo 'Test 8: Database statistics...'
\echo ''

SELECT 
  'battles' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE is_quick_battle = true) as quick_battles,
  COUNT(*) FILTER (WHERE winner_decided = true) as completed_battles,
  COUNT(*) FILTER (WHERE is_test_battle = true) as test_battles
FROM battles
UNION ALL
SELECT 
  'artist_leaderboard' as table_name,
  COUNT(*) as total_rows,
  NULL as quick_battles,
  NULL as completed_battles,
  NULL as test_battles
FROM artist_leaderboard
UNION ALL
SELECT 
  'trader_leaderboard' as table_name,
  COUNT(*) as total_rows,
  NULL as quick_battles,
  NULL as completed_battles,
  NULL as test_battles
FROM trader_leaderboard;

\echo ''

-- ============================================================================
-- Summary
-- ============================================================================
\echo '================================================================'
\echo 'VALIDATION COMPLETE'
\echo '================================================================'
\echo ''
\echo 'Review the output above to verify:'
\echo '  ✓ All CHECK constraints are in place'
\echo '  ✓ All indexes were created successfully'
\echo '  ✓ Trigger is enabled and properly configured'
\echo '  ✓ Function has SECURITY DEFINER set'
\echo '  ✓ Constraint violation test passed (should see SUCCESS message)'
\echo ''
\echo 'If any checks failed, review the migration guide:'
\echo '  migrations/005_MIGRATION_GUIDE.md'
\echo ''
\echo '================================================================'
