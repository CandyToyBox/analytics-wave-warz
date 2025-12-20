-- ============================================================================
-- MIGRATION: Optimize Battles Table Indexes
-- ============================================================================
-- Generated: 2025-12-20
-- Issue: Unused and redundant indexes identified by Supabase AI
-- 
-- Summary:
-- - Drop unused composite index idx_battles_status_created (0 scans)
-- - Drop redundant idx_battles_battle_id (duplicates unique constraint)
-- - Optionally add partial index for active battles query optimization
-- ============================================================================

-- STEP 1: Drop unused composite index
-- Reason: Zero scans in production, redundant with separate single-column indexes
-- Impact: Reduces write overhead and storage costs
-- Safety: CONCURRENTLY ensures no table locks

DROP INDEX CONCURRENTLY IF EXISTS public.idx_battles_status_created;

-- Verification after Step 1:
-- SELECT schemaname, tablename, indexname 
-- FROM pg_indexes 
-- WHERE tablename = 'battles' AND indexname = 'idx_battles_status_created';
-- Expected: No rows returned

-- ============================================================================

-- STEP 2: Drop redundant battle_id index
-- Reason: battles_battle_id_key (unique constraint) already serves the same purpose
-- Impact: Reduces write overhead, no loss of query performance
-- Safety: CONCURRENTLY ensures no table locks

DROP INDEX CONCURRENTLY IF EXISTS public.idx_battles_battle_id;

-- Verification after Step 2:
-- SELECT schemaname, tablename, indexname 
-- FROM pg_indexes 
-- WHERE tablename = 'battles' AND indexname = 'idx_battles_battle_id';
-- Expected: No rows returned

-- ============================================================================

-- STEP 3 (OPTIONAL): Create partial index for active battles
-- Reason: Common query pattern filters for active, non-test battles ordered by recent
-- Impact: Faster queries for active battles, smaller index size
-- Safety: CONCURRENTLY ensures non-blocking creation

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_active_recent 
  ON public.battles (created_at DESC) 
  WHERE status = 'Active' AND is_test_battle = false;

-- Verification after Step 3:
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes 
-- WHERE tablename = 'battles' AND indexname = 'idx_battles_active_recent';
-- Expected: New index definition shown

-- ============================================================================

-- FINAL INDEX SET (after migration):
-- ============================================================================
-- 
-- 1. battles_pkey (id) [unique] - Primary key
-- 2. battles_battle_id_key (battle_id) [unique] - Business key
-- 3. idx_battles_created_at (created_at DESC) - Recency queries
-- 4. idx_battles_status (status) - Status filtering
-- 5. idx_battles_winner_decided (winner_decided) - Winner filtering
-- 6. idx_battles_active_recent (created_at DESC) [partial] - Active battles (NEW)
--
-- REMOVED:
-- X idx_battles_status_created - Unused composite
-- X idx_battles_battle_id - Redundant with unique constraint
--
-- ============================================================================

-- ROLLBACK INSTRUCTIONS (if needed):
-- ============================================================================
-- 
-- To restore the dropped indexes:
-- 
-- CREATE INDEX CONCURRENTLY idx_battles_status_created 
--   ON public.battles (status, created_at DESC);
-- 
-- CREATE INDEX CONCURRENTLY idx_battles_battle_id 
--   ON public.battles (battle_id);
--
-- To remove the new partial index:
--
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_battles_active_recent;
--
-- ============================================================================

-- POST-MIGRATION VALIDATION:
-- ============================================================================
--
-- 1. Check all indexes on battles table:
--    SELECT indexname, indexdef 
--    FROM pg_indexes 
--    WHERE tablename = 'battles' 
--    ORDER BY indexname;
--
-- 2. Monitor index usage after deployment:
--    SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
--    FROM pg_stat_user_indexes 
--    WHERE tablename = 'battles'
--    ORDER BY idx_scan ASC;
--
-- 3. Run EXPLAIN ANALYZE on common queries to verify performance:
--    - Active battles: WHERE status = 'Active' ORDER BY created_at DESC
--    - Battle lookup: WHERE battle_id = '...'
--    - Winner queries: WHERE winner_decided = true
--
-- ============================================================================
