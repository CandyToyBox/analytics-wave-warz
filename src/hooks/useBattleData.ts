// ============================================================================
// WAVEWARZ ANALYTICS - REACT QUERY HOOKS (FIXED - USES PUBLIC VIEWS ONLY!)
// ============================================================================
// CRITICAL: This file uses PUBLIC VIEWS (v_*_public), NOT mv_battle_stats!
// CRITICAL: This file is READ-ONLY - never writes to leaderboard tables!

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import type { Battle, BattleWithMetrics, QuickBattleArtistStats } from '../utils/priceCalculations';
import {
  enrichBattlesWithMetrics,
  calculateGlobalArtistStats,
} from '../utils/priceCalculations';

// Validate required environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('VITE_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅' : '❌');
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Create Supabase client with anon key (for public views)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase client initialized for public views');

// ============================================================================
// HOOK 1: Fetch All Battles from PUBLIC VIEW
// ============================================================================

export function useAllBattles() {
  return useQuery({
    queryKey: ['battles', 'all'],
    queryFn: async () => {
      console.log('🔄 Fetching all battles from v_battles_public...');
      
      try {
        // ✅ CRITICAL: Use v_battles_public (PUBLIC VIEW), NOT mv_battle_stats!
        const { data, error } = await supabase
          .from('v_battles_public')  // ✅ This is the PUBLIC VIEW
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Error fetching battles:', error);
          throw error;
        }
        
        console.log(`✅ Loaded ${data?.length || 0} battles from public view`);
        return (data || []) as Battle[];
      } catch (error) {
        console.error('❌ Failed to fetch battles:', error);
        return [];
      }
    },
    staleTime: 60000,
    refetchInterval: 120000,
    retry: 1,
  });
}

// ============================================================================
// HOOK 2: Fetch Quick Battles Only
// ============================================================================

export function useQuickBattles() {
  return useQuery({
    queryKey: ['battles', 'quick'],
    queryFn: async () => {
      console.log('⚡ Fetching Quick Battles from v_quick_battles_public...');
      
      try {
        const { data, error } = await supabase
          .from('v_quick_battles_public')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Error fetching Quick Battles:', error);
          throw error;
        }
        
        console.log(`✅ Loaded ${data?.length || 0} Quick Battles`);
        return (data || []) as Battle[];
      } catch (error) {
        console.error('❌ Failed to fetch Quick Battles:', error);
        return [];
      }
    },
    staleTime: 60000,
    refetchInterval: 120000,
    retry: 1,
  });
}

// ============================================================================
// HOOK 3: Fetch Main Battles Only
// ============================================================================

export function useMainBattles() {
  return useQuery({
    queryKey: ['battles', 'main'],
    queryFn: async () => {
      console.log('🏆 Fetching Main Battles from v_main_battles_public...');
      
      try {
        const { data, error } = await supabase
          .from('v_main_battles_public')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Error fetching Main Battles:', error);
          throw error;
        }
        
        console.log(`✅ Loaded ${data?.length || 0} Main Battles`);
        return (data || []) as Battle[];
      } catch (error) {
        console.error('❌ Failed to fetch Main Battles:', error);
        return [];
      }
    },
    staleTime: 60000,
    refetchInterval: 120000,
    retry: 1,
  });
}

// ============================================================================
// HOOK 4: All Battles with USD/Spotify Metrics
// ============================================================================

export function useAllBattlesWithMetrics() {
  const { data: battles = [], isLoading } = useAllBattles();
  
  return useQuery({
    queryKey: ['battles', 'with-metrics', battles.length],
    queryFn: async () => {
      if (battles.length === 0) return [];
      console.log('💰 Enriching battles with USD & Spotify metrics...');
      return enrichBattlesWithMetrics(battles);
    },
    enabled: battles.length > 0 && !isLoading,
    staleTime: 60000,
  });
}

// ============================================================================
// HOOK 5: GLOBAL Artist Leaderboard (READ-ONLY)
// ============================================================================

export function useGlobalArtistLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'artists', 'global'],
    queryFn: async () => {
      console.log('🌍 Fetching GLOBAL artist leaderboard (READ-ONLY)...');
      
      try {
        // ✅ READ-ONLY from public view - NEVER write to this table!
        const { data, error } = await supabase
          .from('v_artist_leaderboard_public')
          .select('*')
          .order('total_volume_generated', { ascending: false })
          .limit(100);

        if (error) {
          console.warn('⚠️ Pre-computed leaderboard not available, computing client-side...');
          
          // Fallback: compute from battles
          const { data: battles } = await supabase
            .from('v_battles_public')
            .select('*');
          
          if (battles) {
            return calculateGlobalArtistStats(battles as Battle[]);
          }
          
          return [];
        }
        
        console.log(`✅ Loaded ${data?.length || 0} artists`);
        return data || [];
      } catch (error) {
        console.error('❌ Failed to fetch artist leaderboard:', error);
        return [];
      }
    },
    staleTime: 120000,
    retry: 1,
  });
}

// ============================================================================
// HOOK 6: QUICK BATTLES Artist Leaderboard (READ-ONLY)
// ============================================================================

export function useQuickBattlesArtistLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'artists', 'quick'],
    queryFn: async () => {
      console.log('⚡ Fetching QUICK BATTLES artist leaderboard (READ-ONLY)...');
      
      try {
        // ✅ READ-ONLY from public view - NEVER write to this table!
        const { data, error } = await supabase
          .from('v_quick_battle_leaderboard_public')
          .select('*')
          .eq('is_test_artist', false)  // Exclude test artists
          .order('total_volume_generated', { ascending: false })
          .limit(100);

        if (error) {
          console.error('❌ Failed to fetch Quick Battles leaderboard:', error);
          return [];
        }
        
        console.log(`✅ Loaded ${data?.length || 0} Quick Battles artists`);
        return data as QuickBattleArtistStats[];
      } catch (error) {
        console.error('❌ Failed to fetch Quick Battles leaderboard:', error);
        return [];
      }
    },
    staleTime: 120000,
    retry: 1,
  });
}

// ============================================================================
// HOOK 7: MAIN EVENTS Artist Leaderboard (READ-ONLY)
// ============================================================================

export function useMainEventsArtistLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'artists', 'main-events'],
    queryFn: async () => {
      console.log('🏆 Fetching MAIN EVENTS artist leaderboard (READ-ONLY)...');
      
      try {
        // ✅ READ-ONLY from public view - NEVER write to this table!
        const { data, error } = await supabase
          .from('v_main_events_leaderboard_public')
          .select('*')
          .order('total_sol_earned', { ascending: false })
          .limit(100);

        if (error) {
          console.error('❌ Failed to fetch Main Events leaderboard:', error);
          return [];
        }
        
        console.log(`✅ Loaded ${data?.length || 0} Main Events artists`);
        return data || [];
      } catch (error) {
        console.error('❌ Failed to fetch Main Events leaderboard:', error);
        return [];
      }
    },
    staleTime: 120000,
    retry: 1,
  });
}

// ============================================================================
// HOOK 8: Trader Leaderboard (READ-ONLY)
// ============================================================================

export function useTraderLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'traders'],
    queryFn: async () => {
      console.log('💰 Fetching trader leaderboard (READ-ONLY)...');
      
      try {
        // ✅ READ-ONLY from public view - NEVER write to this table!
        const { data, error } = await supabase
          .from('v_trader_leaderboard_public')
          .select('*')
          .order('roi', { ascending: false })
          .limit(100);

        if (error) {
          console.warn('⚠️ Trader leaderboard not available:', error);
          return [];
        }
        
        console.log(`✅ Loaded ${data?.length || 0} traders`);
        return data || [];
      } catch (error) {
        console.error('❌ Failed to fetch trader leaderboard:', error);
        return [];
      }
    },
    staleTime: 120000,
    retry: 0,
  });
}

// ============================================================================
// HOOK 9: Dashboard Summary Stats
// ============================================================================

export function useDashboardStats() {
  const { data: allBattles = [] } = useAllBattles();
  const { data: quickBattles = [] } = useQuickBattles();
  const { data: mainBattles = [] } = useMainBattles();
  
  return useQuery({
    queryKey: ['dashboard', 'stats', allBattles.length],
    queryFn: async () => {
      console.log('📊 Calculating dashboard stats...');
      
      const enriched = await enrichBattlesWithMetrics(allBattles);
      
      const communityBattles = allBattles.filter(
        (b: Battle) => b.is_community_battle === true
      );
      
      const totalSolVolume = allBattles.reduce(
        (sum: number, b: Battle) => sum + (b.artist1_pool || 0) + (b.artist2_pool || 0), 
        0
      );
      
      const totalUsdVolume = enriched.reduce(
        (sum: number, b: BattleWithMetrics) => sum + b.total_tvl_usd, 
        0
      );
      
      const totalSpotifyEquivalent = enriched.reduce(
        (sum: number, b: BattleWithMetrics) => sum + b.total_spotify_streams, 
        0
      );
      
      return {
        total_battles: allBattles.length,
        quick_battles: quickBattles.length,
        main_battles: mainBattles.length,
        community_battles: communityBattles.length,
        total_sol_volume: totalSolVolume,
        total_usd_volume: totalUsdVolume,
        total_spotify_equivalent: totalSpotifyEquivalent,
      };
    },
    enabled: allBattles.length > 0,
    staleTime: 120000,
  });
}

export {};
