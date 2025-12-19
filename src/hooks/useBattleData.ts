// ============================================================================
// WAVEWARZ ANALYTICS - REACT QUERY HOOKS (PRODUCTION VERSION)
// ============================================================================
// Uses public views (v_*_public) for READ-only API access
// Calculates metrics client-side from immutable battle data

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import {
  Battle,
  BattleWithMetrics,
  ArtistStats,
  QuickBattleArtistStats,
  enrichBattlesWithMetrics,
  calculateGlobalArtistStats,
  calculateQuickBattlesArtistStats,
  calculateMainEventsArtistStats,
  isQuickBattle,
  isMainBattle,
  isCommunityBattle,
} from '../utils/priceCalculations';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

// ============================================================================
// HOOK 1: Fetch All Battles from Public View
// ============================================================================

export function useAllBattles() {
  return useQuery({
    queryKey: ['battles', 'all'],
    queryFn: async () => {
      console.log('🔄 Fetching all battles from v_battles_public...');
      
      try {
        const { data, error } = await supabase
          .from('v_battles_public')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Database error:', error);
          throw error;
        }
        
        console.log(`✅ Loaded ${data.length} battles`);
        return data as Battle[];
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
// HOOK 2: Fetch Quick Battles Only (with Audius links)
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
          console.error('❌ Database error:', error);
          throw error;
        }
        
        console.log(`✅ Loaded ${data.length} Quick Battles`);
        return data as Battle[];
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
// HOOK 3: Fetch Main Battles Only (excludes Quick + Community)
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
          console.error('❌ Database error:', error);
          throw error;
        }
        
        console.log(`✅ Loaded ${data.length} Main Battles`);
        return data as Battle[];
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
// HOOK 4: Fetch All Battles with Metrics (USD + Spotify)
// ============================================================================

export function useAllBattlesWithMetrics() {
  const { data: battles = [], ...queryState } = useAllBattles();
  
  return useQuery({
    queryKey: ['battles', 'with-metrics', battles.length],
    queryFn: async () => {
      if (battles.length === 0) return [];
      console.log('💰 Enriching battles with USD & Spotify metrics...');
      return enrichBattlesWithMetrics(battles);
    },
    enabled: battles.length > 0,
    staleTime: 60000,
    ...queryState,
  });
}

// ============================================================================
// HOOK 5: Single Battle Details
// ============================================================================

export function useBattleDetails(battleId: string | null) {
  return useQuery({
    queryKey: ['battle', battleId],
    queryFn: async () => {
      if (!battleId) return null;
      
      console.log(`🔄 Fetching battle ${battleId}...`);
      
      try {
        const { data, error } = await supabase
          .from('v_battles_public')
          .select('*')
          .eq('battle_id', battleId)
          .single();

        if (error) throw error;
        
        console.log(`✅ Loaded battle ${battleId}`);
        return data as Battle;
      } catch (error) {
        console.error(`❌ Failed to fetch battle ${battleId}:`, error);
        return null;
      }
    },
    enabled: !!battleId,
    staleTime: 60000,
    retry: 1,
  });
}

// ============================================================================
// HOOK 6: GLOBAL Artist Leaderboard (All Battle Types)
// ============================================================================

export function useGlobalArtistLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'artists', 'global'],
    queryFn: async () => {
      console.log('🌍 Fetching GLOBAL artist leaderboard...');
      
      try {
        // Try to fetch from pre-computed leaderboard table first
        const { data, error } = await supabase
          .from('v_artist_leaderboard_public')
          .select('*')
          .order('total_volume_generated', { ascending: false });

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
        
        console.log(`✅ Loaded ${data.length} artists`);
        return data as ArtistStats[];
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
// HOOK 7: QUICK BATTLES Artist Leaderboard
// ============================================================================

export function useQuickBattlesArtistLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'artists', 'quick'],
    queryFn: async () => {
      console.log('⚡ Fetching QUICK BATTLES artist leaderboard...');
      
      try {
        // Fetch from pre-computed leaderboard table
        // Note: Returns QuickBattleArtistStats (uses audius_handle, not wallet_address)
        const { data, error } = await supabase
          .from('v_quick_battle_leaderboard_public')
          .select('*')
          .eq('is_test_artist', false)  // Exclude test artists
          .order('total_volume_generated', { ascending: false })
          .limit(100);

        if (error) {
          console.error('❌ Failed to fetch Quick Battles leaderboard:', error);
          throw error;
        }
        
        console.log(`✅ Loaded ${data.length} Quick Battles artists`);
        
        // Return with QuickBattleArtistStats type
        return data as any[]; // Type cast to any[] since the structure is different
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
// HOOK 8: MAIN EVENTS Artist Leaderboard
// ============================================================================

export function useMainEventsArtistLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'artists', 'main-events'],
    queryFn: async () => {
      console.log('🏆 Fetching MAIN EVENTS artist leaderboard...');
      
      try {
        // Try to fetch from pre-computed leaderboard view
        const { data, error } = await supabase
          .from('v_main_events_leaderboard_public')
          .select('*')
          .order('total_sol_earned', { ascending: false });

        if (error) {
          console.warn('⚠️ Pre-computed Main Events leaderboard not available, computing client-side...');
          
          // Fallback: compute from Main Battles
          const { data: mainBattles } = await supabase
            .from('v_main_battles_public')
            .select('*');
          
          if (mainBattles) {
            return calculateMainEventsArtistStats(mainBattles as Battle[]);
          }
          
          return [];
        }
        
        console.log(`✅ Loaded ${data.length} Main Events artists`);
        return data as ArtistStats[];
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
// HOOK 9: Trader Leaderboard
// ============================================================================

export function useTraderLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'traders'],
    queryFn: async () => {
      console.log('💰 Fetching trader leaderboard...');
      
      try {
        const { data, error } = await supabase
          .from('v_trader_leaderboard_public')
          .select('*')
          .order('roi', { ascending: false })
          .limit(100);

        if (error) {
          console.warn('⚠️ Trader leaderboard not available');
          return [];
        }
        
        console.log(`✅ Loaded ${data.length} traders`);
        return data;
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
// HOOK 10: Dashboard Summary Stats
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
      
      const communityBattles = allBattles.filter(isCommunityBattle);
      
      const totalSolVolume = allBattles.reduce(
        (sum, b) => sum + (b.artist1_pool || 0) + (b.artist2_pool || 0), 
        0
      );
      
      const totalUsdVolume = enriched.reduce(
        (sum, b) => sum + b.total_tvl_usd, 
        0
      );
      
      const totalSpotifyEquivalent = enriched.reduce(
        (sum, b) => sum + b.total_spotify_streams, 
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

// ============================================================================
// HOOK 11: API Documentation
// ============================================================================

export function useApiDocumentation() {
  return useQuery({
    queryKey: ['api', 'documentation'],
    queryFn: async () => {
      console.log('📚 Fetching API documentation...');
      
      try {
        const { data, error } = await supabase
          .from('v_api_endpoints')
          .select('*')
          .order('endpoint');

        if (error) {
          console.warn('⚠️ API documentation not available');
          return [];
        }
        
        return data;
      } catch (error) {
        console.error('❌ Failed to fetch API docs:', error);
        return [];
      }
    },
    staleTime: 300000, // 5 minutes
    retry: 0,
  });
}

export {};
