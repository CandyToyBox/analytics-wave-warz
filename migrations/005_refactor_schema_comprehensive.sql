-- ============================================================================
-- MIGRATION: Comprehensive Schema Refactoring for WaveWarZ Statz App
-- ============================================================================
-- Generated: 2026-01-15
-- Issue: Rebuild database schema with proper normalization, constraints, and triggers
--
-- Summary:
-- - Add CHECK constraints for data validation (non-negative values)
-- - Add foreign key relationships between tables
-- - Create optimized indexes for performance
-- - Add triggers for auto-updating leaderboards
-- - Improve data integrity and consistency
-- 
-- Note: This is a non-destructive migration that enhances the existing schema
-- without dropping or recreating tables. All changes are additive or safety-focused.
-- ============================================================================

-- ============================================================================
-- PART 1: Add CHECK Constraints to battles table
-- ============================================================================

-- Add CHECK constraints for numeric fields (ensure non-negative values)
-- These use ALTER TABLE ... ADD CONSTRAINT to avoid recreating the table

-- Artist 1 pool validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'battles_artist1_pool_check' 
    AND conrelid = 'public.battles'::regclass
  ) THEN
    ALTER TABLE public.battles 
    ADD CONSTRAINT battles_artist1_pool_check 
    CHECK (artist1_pool >= 0);
  END IF;
END $$;

-- Artist 1 supply validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'battles_artist1_supply_check' 
    AND conrelid = 'public.battles'::regclass
  ) THEN
    ALTER TABLE public.battles 
    ADD CONSTRAINT battles_artist1_supply_check 
    CHECK (artist1_supply >= 0);
  END IF;
END $$;

-- Artist 2 pool validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'battles_artist2_pool_check' 
    AND conrelid = 'public.battles'::regclass
  ) THEN
    ALTER TABLE public.battles 
    ADD CONSTRAINT battles_artist2_pool_check 
    CHECK (artist2_pool >= 0);
  END IF;
END $$;

-- Artist 2 supply validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'battles_artist2_supply_check' 
    AND conrelid = 'public.battles'::regclass
  ) THEN
    ALTER TABLE public.battles 
    ADD CONSTRAINT battles_artist2_supply_check 
    CHECK (artist2_supply >= 0);
  END IF;
END $$;

-- Total volume A validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'battles_total_volume_a_check' 
    AND conrelid = 'public.battles'::regclass
  ) THEN
    ALTER TABLE public.battles 
    ADD CONSTRAINT battles_total_volume_a_check 
    CHECK (total_volume_a >= 0);
  END IF;
END $$;

-- Total volume B validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'battles_total_volume_b_check' 
    AND conrelid = 'public.battles'::regclass
  ) THEN
    ALTER TABLE public.battles 
    ADD CONSTRAINT battles_total_volume_b_check 
    CHECK (total_volume_b >= 0);
  END IF;
END $$;

-- Trade count validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'battles_trade_count_check' 
    AND conrelid = 'public.battles'::regclass
  ) THEN
    ALTER TABLE public.battles 
    ADD CONSTRAINT battles_trade_count_check 
    CHECK (trade_count >= 0);
  END IF;
END $$;

-- Unique traders validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'battles_unique_traders_check' 
    AND conrelid = 'public.battles'::regclass
  ) THEN
    ALTER TABLE public.battles 
    ADD CONSTRAINT battles_unique_traders_check 
    CHECK (unique_traders >= 0);
  END IF;
END $$;

-- Battle duration validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'battles_battle_duration_check' 
    AND conrelid = 'public.battles'::regclass
  ) THEN
    ALTER TABLE public.battles 
    ADD CONSTRAINT battles_battle_duration_check 
    CHECK (battle_duration >= 0);
  END IF;
END $$;

-- ============================================================================
-- PART 2: Add CHECK Constraints to artist_leaderboard table
-- ============================================================================

-- Total earnings validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'artist_leaderboard_total_earnings_sol_check' 
    AND conrelid = 'public.artist_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.artist_leaderboard 
    ADD CONSTRAINT artist_leaderboard_total_earnings_sol_check 
    CHECK (total_earnings_sol >= 0);
  END IF;
END $$;

-- Battles participated validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'artist_leaderboard_battles_participated_check' 
    AND conrelid = 'public.artist_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.artist_leaderboard 
    ADD CONSTRAINT artist_leaderboard_battles_participated_check 
    CHECK (battles_participated >= 0);
  END IF;
END $$;

-- Wins validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'artist_leaderboard_wins_check' 
    AND conrelid = 'public.artist_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.artist_leaderboard 
    ADD CONSTRAINT artist_leaderboard_wins_check 
    CHECK (wins >= 0);
  END IF;
END $$;

-- Losses validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'artist_leaderboard_losses_check' 
    AND conrelid = 'public.artist_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.artist_leaderboard 
    ADD CONSTRAINT artist_leaderboard_losses_check 
    CHECK (losses >= 0);
  END IF;
END $$;

-- Win rate validation (0-100%)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'artist_leaderboard_win_rate_check' 
    AND conrelid = 'public.artist_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.artist_leaderboard 
    ADD CONSTRAINT artist_leaderboard_win_rate_check 
    CHECK (win_rate BETWEEN 0 AND 100);
  END IF;
END $$;

-- Total volume generated validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'artist_leaderboard_total_volume_generated_check' 
    AND conrelid = 'public.artist_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.artist_leaderboard 
    ADD CONSTRAINT artist_leaderboard_total_volume_generated_check 
    CHECK (total_volume_generated >= 0);
  END IF;
END $$;

-- Average volume per battle validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'artist_leaderboard_avg_volume_per_battle_check' 
    AND conrelid = 'public.artist_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.artist_leaderboard 
    ADD CONSTRAINT artist_leaderboard_avg_volume_per_battle_check 
    CHECK (avg_volume_per_battle >= 0);
  END IF;
END $$;

-- ============================================================================
-- PART 3: Add CHECK Constraints to quick_battle_leaderboard table
-- ============================================================================

-- Battles participated validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quick_battle_leaderboard_battles_participated_check' 
    AND conrelid = 'public.quick_battle_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.quick_battle_leaderboard 
    ADD CONSTRAINT quick_battle_leaderboard_battles_participated_check 
    CHECK (battles_participated >= 0);
  END IF;
END $$;

-- Wins validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quick_battle_leaderboard_wins_check' 
    AND conrelid = 'public.quick_battle_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.quick_battle_leaderboard 
    ADD CONSTRAINT quick_battle_leaderboard_wins_check 
    CHECK (wins >= 0);
  END IF;
END $$;

-- Losses validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quick_battle_leaderboard_losses_check' 
    AND conrelid = 'public.quick_battle_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.quick_battle_leaderboard 
    ADD CONSTRAINT quick_battle_leaderboard_losses_check 
    CHECK (losses >= 0);
  END IF;
END $$;

-- Win rate validation (0-100%)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quick_battle_leaderboard_win_rate_check' 
    AND conrelid = 'public.quick_battle_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.quick_battle_leaderboard 
    ADD CONSTRAINT quick_battle_leaderboard_win_rate_check 
    CHECK (win_rate BETWEEN 0 AND 100);
  END IF;
END $$;

-- Total volume generated validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quick_battle_leaderboard_total_volume_generated_check' 
    AND conrelid = 'public.quick_battle_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.quick_battle_leaderboard 
    ADD CONSTRAINT quick_battle_leaderboard_total_volume_generated_check 
    CHECK (total_volume_generated >= 0);
  END IF;
END $$;

-- Average volume per battle validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quick_battle_leaderboard_avg_volume_per_battle_check' 
    AND conrelid = 'public.quick_battle_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.quick_battle_leaderboard 
    ADD CONSTRAINT quick_battle_leaderboard_avg_volume_per_battle_check 
    CHECK (avg_volume_per_battle >= 0);
  END IF;
END $$;

-- Peak pool size validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quick_battle_leaderboard_peak_pool_size_check' 
    AND conrelid = 'public.quick_battle_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.quick_battle_leaderboard 
    ADD CONSTRAINT quick_battle_leaderboard_peak_pool_size_check 
    CHECK (peak_pool_size >= 0);
  END IF;
END $$;

-- Total trades validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quick_battle_leaderboard_total_trades_check' 
    AND conrelid = 'public.quick_battle_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.quick_battle_leaderboard 
    ADD CONSTRAINT quick_battle_leaderboard_total_trades_check 
    CHECK (total_trades >= 0);
  END IF;
END $$;

-- Unique traders validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quick_battle_leaderboard_unique_traders_check' 
    AND conrelid = 'public.quick_battle_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.quick_battle_leaderboard 
    ADD CONSTRAINT quick_battle_leaderboard_unique_traders_check 
    CHECK (unique_traders >= 0);
  END IF;
END $$;

-- ============================================================================
-- PART 4: Add CHECK Constraints to trader_leaderboard table
-- ============================================================================

-- Total invested validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trader_leaderboard_total_invested_check' 
    AND conrelid = 'public.trader_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.trader_leaderboard 
    ADD CONSTRAINT trader_leaderboard_total_invested_check 
    CHECK (total_invested >= 0);
  END IF;
END $$;

-- Total payout validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trader_leaderboard_total_payout_check' 
    AND conrelid = 'public.trader_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.trader_leaderboard 
    ADD CONSTRAINT trader_leaderboard_total_payout_check 
    CHECK (total_payout >= 0);
  END IF;
END $$;

-- Battles participated validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trader_leaderboard_battles_participated_check' 
    AND conrelid = 'public.trader_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.trader_leaderboard 
    ADD CONSTRAINT trader_leaderboard_battles_participated_check 
    CHECK (battles_participated >= 0);
  END IF;
END $$;

-- Wins validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trader_leaderboard_wins_check' 
    AND conrelid = 'public.trader_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.trader_leaderboard 
    ADD CONSTRAINT trader_leaderboard_wins_check 
    CHECK (wins >= 0);
  END IF;
END $$;

-- Losses validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trader_leaderboard_losses_check' 
    AND conrelid = 'public.trader_leaderboard'::regclass
  ) THEN
    ALTER TABLE public.trader_leaderboard 
    ADD CONSTRAINT trader_leaderboard_losses_check 
    CHECK (losses >= 0);
  END IF;
END $$;

-- ============================================================================
-- PART 5: Create Additional Indexes for Performance
-- ============================================================================

-- Index for artist wallet lookups (if not exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_artist1_wallet 
  ON public.battles (artist1_wallet);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_artist2_wallet 
  ON public.battles (artist2_wallet);

-- Index for quick battle queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_is_quick_battle 
  ON public.battles (is_quick_battle) 
  WHERE is_quick_battle = true;

-- Index for community battle queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_is_community_battle 
  ON public.battles (is_community_battle) 
  WHERE is_community_battle = true;

-- Index for test battle filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_is_test_battle 
  ON public.battles (is_test_battle) 
  WHERE is_test_battle = true;

-- Composite index for winner queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_winner_decided_created 
  ON public.battles (winner_decided, created_at DESC) 
  WHERE winner_decided = true;

-- Index for last_scanned_at (for batch processing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_last_scanned_at 
  ON public.battles (last_scanned_at);

-- Index for artist leaderboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artist_leaderboard_total_earnings 
  ON public.artist_leaderboard (total_earnings_sol DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artist_leaderboard_total_volume 
  ON public.artist_leaderboard (total_volume_generated DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artist_leaderboard_battles 
  ON public.artist_leaderboard (battles_participated DESC);

-- Index for trader leaderboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trader_leaderboard_net_pnl 
  ON public.trader_leaderboard (net_pnl DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trader_leaderboard_roi 
  ON public.trader_leaderboard (roi DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trader_leaderboard_total_invested 
  ON public.trader_leaderboard (total_invested DESC);

-- ============================================================================
-- PART 6: Create Trigger for Auto-updating Artist Leaderboard
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trig_update_artist_leaderboard ON public.battles;

-- Create or replace the trigger function
-- Uses fully qualified names to prevent search_path attacks
CREATE OR REPLACE FUNCTION public.update_artist_leaderboard() 
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only process if battle has decided winner
  IF NEW.winner_decided = true THEN
    
    -- Update or insert Artist 1
    -- Note: image_url is intentionally set to NULL on initial insert
    -- Artists may have their own profile images separate from battle card images
    INSERT INTO public.artist_leaderboard (
      wallet_address, 
      artist_name, 
      image_url,  -- NULL on insert, should be updated separately with artist's profile image
      twitter_handle, 
      music_link,
      battles_participated,
      wins,
      losses,
      total_volume_generated,
      total_earnings_sol,
      updated_at
    ) VALUES (
      NEW.artist1_wallet,
      NEW.artist1_name,
      NULL,  -- Artist profile image should be set separately, not from battle card
      NEW.artist1_twitter,
      NEW.artist1_music_link,
      1,
      CASE WHEN NEW.winner_artist_a THEN 1 ELSE 0 END,
      CASE WHEN NEW.winner_artist_a THEN 0 ELSE 1 END,
      COALESCE(NEW.total_volume_a, 0),
      0,  -- Earnings calculated separately (fees + settlement bonuses)
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
      battles_participated = public.artist_leaderboard.battles_participated + 1,
      wins = public.artist_leaderboard.wins + CASE WHEN NEW.winner_artist_a THEN 1 ELSE 0 END,
      losses = public.artist_leaderboard.losses + CASE WHEN NEW.winner_artist_a THEN 0 ELSE 1 END,
      total_volume_generated = public.artist_leaderboard.total_volume_generated + COALESCE(NEW.total_volume_a, 0),
      win_rate = CASE 
        WHEN (public.artist_leaderboard.battles_participated + 1) > 0 
        THEN ((public.artist_leaderboard.wins + CASE WHEN NEW.winner_artist_a THEN 1 ELSE 0 END)::numeric / (public.artist_leaderboard.battles_participated + 1)) * 100
        ELSE 0 
      END,
      avg_volume_per_battle = CASE
        WHEN (public.artist_leaderboard.battles_participated + 1) > 0
        THEN (public.artist_leaderboard.total_volume_generated + COALESCE(NEW.total_volume_a, 0)) / (public.artist_leaderboard.battles_participated + 1)
        ELSE 0
      END,
      updated_at = CURRENT_TIMESTAMP;
    
    -- Update or insert Artist 2
    -- Note: image_url is intentionally set to NULL on initial insert
    INSERT INTO public.artist_leaderboard (
      wallet_address, 
      artist_name, 
      image_url,  -- NULL on insert, should be updated separately with artist's profile image
      twitter_handle, 
      music_link,
      battles_participated,
      wins,
      losses,
      total_volume_generated,
      total_earnings_sol,
      updated_at
    ) VALUES (
      NEW.artist2_wallet,
      NEW.artist2_name,
      NULL,  -- Artist profile image should be set separately, not from battle card
      NEW.artist2_twitter,
      NEW.artist2_music_link,
      1,
      CASE WHEN NEW.winner_artist_a THEN 0 ELSE 1 END,
      CASE WHEN NEW.winner_artist_a THEN 1 ELSE 0 END,
      COALESCE(NEW.total_volume_b, 0),
      0,  -- Earnings calculated separately (fees + settlement bonuses)
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
      battles_participated = public.artist_leaderboard.battles_participated + 1,
      wins = public.artist_leaderboard.wins + CASE WHEN NEW.winner_artist_a THEN 0 ELSE 1 END,
      losses = public.artist_leaderboard.losses + CASE WHEN NEW.winner_artist_a THEN 1 ELSE 0 END,
      total_volume_generated = public.artist_leaderboard.total_volume_generated + COALESCE(NEW.total_volume_b, 0),
      win_rate = CASE 
        WHEN (public.artist_leaderboard.battles_participated + 1) > 0 
        THEN ((public.artist_leaderboard.wins + CASE WHEN NEW.winner_artist_a THEN 0 ELSE 1 END)::numeric / (public.artist_leaderboard.battles_participated + 1)) * 100
        ELSE 0 
      END,
      avg_volume_per_battle = CASE
        WHEN (public.artist_leaderboard.battles_participated + 1) > 0
        THEN (public.artist_leaderboard.total_volume_generated + COALESCE(NEW.total_volume_b, 0)) / (public.artist_leaderboard.battles_participated + 1)
        ELSE 0
      END,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
-- Only fires when winner_decided changes to true (not on every volume update)
CREATE TRIGGER trig_update_artist_leaderboard
  AFTER UPDATE OF winner_decided
  ON public.battles
  FOR EACH ROW
  WHEN (OLD.winner_decided = false AND NEW.winner_decided = true AND COALESCE(NEW.is_test_battle, false) = false)
  EXECUTE FUNCTION public.update_artist_leaderboard();

-- Add helpful comment
COMMENT ON FUNCTION public.update_artist_leaderboard() IS 'Auto-updates artist_leaderboard table when battles are decided. Uses SECURITY DEFINER to bypass RLS. Empty search_path with fully qualified names prevents SQL injection.';

-- ============================================================================
-- PART 7: Grant Proper Permissions
-- ============================================================================

-- Grant permissions on the trigger function
REVOKE ALL ON FUNCTION public.update_artist_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_artist_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_artist_leaderboard() TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Check all constraints on battles table
-- SELECT conname, contype, pg_get_constraintdef(oid) as definition
-- FROM pg_constraint 
-- WHERE conrelid = 'public.battles'::regclass
-- ORDER BY conname;

-- 2. Check all constraints on artist_leaderboard table
-- SELECT conname, contype, pg_get_constraintdef(oid) as definition
-- FROM pg_constraint 
-- WHERE conrelid = 'public.artist_leaderboard'::regclass
-- ORDER BY conname;

-- 3. Check all indexes on battles table
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'battles' 
-- ORDER BY indexname;

-- 4. Check trigger exists
-- SELECT tgname, tgtype, tgenabled 
-- FROM pg_trigger 
-- WHERE tgrelid = 'public.battles'::regclass
-- AND tgname = 'trig_update_artist_leaderboard';

-- 5. Test constraint violations (should fail)
-- INSERT INTO battles (battle_id, artist1_name, artist1_wallet, artist2_name, artist2_wallet, total_volume_a) 
-- VALUES ('test123', 'Test Artist 1', 'wallet1', 'Test Artist 2', 'wallet2', -100);
-- Expected: ERROR: new row violates check constraint "battles_total_volume_a_check"

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

-- To remove all constraints (use with caution!):
-- ALTER TABLE public.battles DROP CONSTRAINT IF EXISTS battles_artist1_pool_check CASCADE;
-- ALTER TABLE public.battles DROP CONSTRAINT IF EXISTS battles_artist1_supply_check CASCADE;
-- ... (repeat for all constraints)

-- To remove indexes:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_battles_artist1_wallet;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_battles_artist2_wallet;
-- ... (repeat for all indexes)

-- To remove trigger:
-- DROP TRIGGER IF EXISTS trig_update_artist_leaderboard ON public.battles CASCADE;
-- DROP FUNCTION IF EXISTS public.update_artist_leaderboard() CASCADE;

-- ============================================================================
-- NOTES
-- ============================================================================

-- Why CHECK constraints?
-- - Enforces data integrity at the database level
-- - Prevents invalid data (e.g., negative volumes)
-- - Better than application-level validation alone

-- Why foreign keys not added?
-- - Current schema has battles inserted before artists exist in leaderboard
-- - Would require significant application logic changes
-- - Can be added in a future migration after data flow is refactored

-- Why SECURITY DEFINER on trigger function?
-- - Allows trigger to bypass RLS policies
-- - Required for updating leaderboard tables from trigger context
-- - Safe search_path prevents SQL injection

-- Why CONCURRENTLY on indexes?
-- - Allows reads/writes during index creation
-- - No table locks, no downtime
-- - Takes longer but safer for production

-- ============================================================================
