import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBattleLibrary } from '../data';
import { BattleState, BattleSummary, ArtistLeaderboardStats, TraderLeaderboardEntry, QuickBattleLeaderboardEntry } from '../types';
import {
  fetchBattlesFromSupabase,
  fetchArtistLeaderboardFromDB,
  fetchQuickBattleLeaderboardFromDB,
  fetchTraderLeaderboardFromDB,
  BATTLE_COLUMNS,
  normalizeBattleId,
  supabase,
} from '../services/supabaseClient';
import { calculateArtistLeaderboard, mockEstimateVolumes } from '../services/artistLeaderboardService';

type BattleSource = 'Supabase' | 'Local';

type BattlesResult = {
  battles: BattleSummary[];
  source: BattleSource;
};

const BATTLES_STALE_TIME = 60000;
const BATTLES_REFETCH_INTERVAL = 120000;
const ACTIVE_STALE_TIME = 30000;

export function useAllBattles() {
  return useQuery<BattlesResult>({
    queryKey: ['battles', 'all'],
    queryFn: async () => {
      console.log('🔄 Fetching all battles from database...');
      const supabaseData = await fetchBattlesFromSupabase();

      if (supabaseData && supabaseData.length > 0) {
        console.log(`✅ Loaded ${supabaseData.length} battles from database`);
        return { battles: supabaseData, source: 'Supabase' as const };
      }

      const fallback = getBattleLibrary();
      console.log(`⚠️ Using local fallback with ${fallback.length} battles`);
      return { battles: fallback, source: 'Local' as const };
    },
    staleTime: BATTLES_STALE_TIME,
    refetchInterval: BATTLES_REFETCH_INTERVAL,
  });
}

export function useActiveBattles() {
  const queryClient = useQueryClient();

  return useQuery<BattleSummary[]>({
    queryKey: ['battles', 'active'],
    queryFn: async () => {
      const cached = queryClient.getQueryData<BattlesResult>(['battles', 'all']);
      const base = cached?.battles ?? getBattleLibrary();
      return base.filter((b) => b.status?.toLowerCase() === 'active');
    },
    initialData: () => {
      const cached = queryClient.getQueryData<BattlesResult>(['battles', 'all']);
      return cached?.battles.filter((b) => b.status?.toLowerCase() === 'active') ?? [];
    },
    staleTime: ACTIVE_STALE_TIME,
  });
}

export function useBattleDetails(battleId: string | null) {
  return useQuery<BattleSummary | null>({
    queryKey: ['battle', battleId],
    enabled: !!battleId,
    queryFn: async () => {
      if (!battleId) return null;

      const supabaseData = await fetchBattlesFromSupabase();
      const source = supabaseData ?? getBattleLibrary();
      const found = source.find((b) => b.battleId === battleId || b.id === battleId);
      if (found) return found;

      try {
        const { data, error } = await supabase
          .from('battles')
          .select(BATTLE_COLUMNS)
          .eq('battle_id', battleId)
          .maybeSingle();

        if (error || !data) return null;

        const battleIdValue = normalizeBattleId(data.battle_id);
        if (!battleIdValue) return null;

        return {
          id: battleIdValue,
          battleId: battleIdValue,
          createdAt: data.created_at,
          status: data.status,
          artistA: {
            id: 'A',
            name: data.artist1_name,
            color: '#06b6d4',
            avatar: data.quick_battle_artist1_audius_profile_pic || data.image_url,
            wallet: data.artist1_wallet,
            twitter: data.artist1_twitter,
          },
          artistB: {
            id: 'B',
            name: data.artist2_name,
            color: '#e879f9',
            avatar: data.quick_battle_artist2_audius_profile_pic || data.image_url,
            wallet: data.artist2_wallet,
            twitter: data.artist2_twitter,
          },
          battleDuration: data.battle_duration,
          winnerDecided: data.winner_decided,
          winnerArtistA: typeof data.winner_artist_a === 'boolean' ? data.winner_artist_a : undefined,
          artistASolBalance: data.artist1_pool || 0,
          artistBSolBalance: data.artist2_pool || 0,
          imageUrl: data.image_url,
          streamLink: data.stream_link,
          isCommunityBattle: data.is_community_battle,
        };
      } catch (e) {
        console.warn('Failed to fetch battle detail', e);
        return null;
      }
    },
    staleTime: 60000,
  });
}

export function useArtistLeaderboard(battles: BattleSummary[], solPrice: number) {
  return useQuery<ArtistLeaderboardStats[]>({
    queryKey: ['leaderboard', 'artists', battles.length, solPrice],
    queryFn: async () => {
      try {
        const cached = await fetchArtistLeaderboardFromDB();
        if (cached && cached.length > 0) {
          console.log(`✅ Loaded ${cached.length} artists from database`);
          return cached;
        }
        console.log('No cached artist leaderboard found, computing from battles...');
      } catch (e) {
        console.log('Failed to load artist leaderboard from database, computing from battles...', e);
      }

      if (battles.length === 0) return [];

      const estimated = mockEstimateVolumes(battles) as BattleState[];
      return calculateArtistLeaderboard(estimated, solPrice);
    },
    staleTime: 120000,
  });
}

export function useTraderLeaderboard() {
  return useQuery<TraderLeaderboardEntry[]>({
    queryKey: ['leaderboard', 'traders'],
    queryFn: async () => (await fetchTraderLeaderboardFromDB()) ?? [],
    staleTime: 120000,
  });
}

export function useQuickBattleLeaderboard() {
  return useQuery<QuickBattleLeaderboardEntry[]>({
    queryKey: ['leaderboard', 'quickBattles'],
    queryFn: async () => (await fetchQuickBattleLeaderboardFromDB()) ?? [],
    staleTime: 15000, // 15 seconds for testing - increase to 60000 (60s) for production
  });
}

/**
 * Hook to refresh all leaderboard data by invalidating React Query caches
 * This forces refetch of fresh data from the database
 */
export function useRefreshLeaderboards() {
  const queryClient = useQueryClient();

  return {
    refreshQuickBattles: async () => {
      console.log('🔄 Invalidating quick battles leaderboard cache...');
      await queryClient.invalidateQueries({ queryKey: ['leaderboard', 'quickBattles'] });
      console.log('✅ Quick battles leaderboard cache invalidated');
    },
    refreshArtists: async () => {
      console.log('🔄 Invalidating artist leaderboard cache...');
      await queryClient.invalidateQueries({ queryKey: ['leaderboard', 'artists'] });
      console.log('✅ Artist leaderboard cache invalidated');
    },
    refreshTraders: async () => {
      console.log('🔄 Invalidating trader leaderboard cache...');
      await queryClient.invalidateQueries({ queryKey: ['leaderboard', 'traders'] });
      console.log('✅ Trader leaderboard cache invalidated');
    },
    refreshAll: async () => {
      console.log('🔄 Invalidating all leaderboard caches...');
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      console.log('✅ All leaderboard caches invalidated');
    },
  };
}
