-- ============================================================================
-- MIGRATION: Fix refresh_quick_battle_leaderboard Function with SECURITY DEFINER
-- ============================================================================
-- Generated: 2026-01-02
-- Issue: Fix "must be able to SET ROLE 'supabase_admin'" error
--
-- Summary:
-- - Drop and recreate the function with SECURITY DEFINER
-- - Use safe search_path to prevent SQL injection
-- - Keep existing owner (do NOT change to supabase_admin)
-- - Properly grant EXECUTE permissions to authenticated users
-- ============================================================================

-- STEP 1: Drop the existing function (including any recursive versions)
-- This ensures we start with a clean slate
DROP FUNCTION IF EXISTS public.refresh_quick_battle_leaderboard() CASCADE;

-- ============================================================================

-- STEP 2: Create the function with proper SECURITY DEFINER settings
-- SECURITY DEFINER allows the function to run with the privileges of the function owner
-- This bypasses Row Level Security (RLS) policies when refreshing the materialized view
CREATE OR REPLACE FUNCTION public.refresh_quick_battle_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Refresh the materialized view that aggregates Quick Battle leaderboard data
  -- CONCURRENTLY allows reads while refreshing (requires unique index)
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_quick_battle_leaderboard_public;

  -- Log success (visible in Supabase logs)
  RAISE NOTICE 'Successfully refreshed v_quick_battle_leaderboard_public materialized view';

EXCEPTION
  WHEN OTHERS THEN
    -- Log error details
    RAISE WARNING 'Failed to refresh v_quick_battle_leaderboard_public: % %', SQLERRM, SQLSTATE;
    -- Re-raise the error so callers know it failed
    RAISE;
END;
$$;

-- ============================================================================

-- STEP 3: Set proper permissions
-- Revoke all public access first (security best practice)
REVOKE ALL ON FUNCTION public.refresh_quick_battle_leaderboard() FROM PUBLIC;

-- Grant EXECUTE to authenticated users (logged-in users can refresh the leaderboard)
GRANT EXECUTE ON FUNCTION public.refresh_quick_battle_leaderboard() TO authenticated;

-- Grant EXECUTE to service_role (for backend/admin operations)
GRANT EXECUTE ON FUNCTION public.refresh_quick_battle_leaderboard() TO service_role;

-- ============================================================================

-- STEP 4: Add helpful comment
COMMENT ON FUNCTION public.refresh_quick_battle_leaderboard() IS
  'Refreshes the v_quick_battle_leaderboard_public materialized view. '
  'Uses SECURITY DEFINER to bypass RLS policies. '
  'Safe search_path prevents SQL injection.';

-- ============================================================================

-- VERIFICATION:
-- ============================================================================
--
-- 1. Check function definition:
--    SELECT proname, prosecdef, proconfig
--    FROM pg_proc
--    WHERE proname = 'refresh_quick_battle_leaderboard';
--    Expected: prosecdef = true, proconfig shows search_path
--
-- 2. Test the function:
--    SELECT public.refresh_quick_battle_leaderboard();
--    Expected: Success message, no errors
--
-- 3. Check permissions:
--    SELECT grantee, privilege_type
--    FROM information_schema.routine_privileges
--    WHERE routine_name = 'refresh_quick_battle_leaderboard';
--    Expected: authenticated and service_role have EXECUTE
--
-- ============================================================================

-- NOTES:
-- ============================================================================
--
-- Why SECURITY DEFINER?
-- - Materialized view refresh requires elevated privileges
-- - SECURITY DEFINER allows function to run as owner (not caller)
-- - This bypasses RLS policies that might prevent refresh
--
-- Why search_path = public, pg_catalog?
-- - Prevents SQL injection attacks via search_path manipulation
-- - Only allows objects from public schema and core PostgreSQL catalog
-- - Security best practice for SECURITY DEFINER functions
--
-- Why not change owner to supabase_admin?
-- - Would require SET ROLE permission (which causes the 42501 error)
-- - Not necessary - SECURITY DEFINER handles privilege escalation
-- - Current owner (likely postgres or service_role) has sufficient permissions
--
-- ============================================================================
