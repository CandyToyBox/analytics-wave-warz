import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBattleLibrary } from '../data';
import { BattleState, BattleSummary, ArtistLeaderboardStats, TraderLeaderboardEntry, QuickBattleLeaderboardEntry } from '../types';
import {
  fetchBattlesFromSupabase,
  fetchQuickBattleLeaderboardFromDB,
  fetchTraderLeaderboardFromDB,
  BATTLE_COLUMNS,
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
          .from('mv_battle_stats')
          .select(BATTLE_COLUMNS)
          .eq('battle_id', battleId)
          .maybeSingle();

        if (error || !data) return null;

        return {
          id: (data.id ?? data.battle_id)?.toString(),
          battleId: data.battle_id?.toString(),
          createdAt: data.created_at,
          status: data.status,
          artistA: {
            id: 'A',
            name: data.artist1_name,
            color: '#06b6d4',
            avatar: data.artist1_profile_pic || data.image_url,
            wallet: data.artist1_wallet,
            musicLink: data.artist1_music_link,
            twitter: data.artist1_twitter,
          },
          artistB: {
            id: 'B',
            name: data.artist2_name,
            color: '#e879f9',
            avatar: data.artist2_profile_pic || data.image_url,
            wallet: data.artist2_wallet,
            musicLink: data.artist2_music_link,
            twitter: data.artist2_twitter,
          },
          battleDuration: data.battle_duration,
          winnerDecided: data.winner_decided,
          artistASolBalance: data.artist1_pool || 0,
          artistBSolBalance: data.artist2_pool || 0,
          imageUrl: data.image_url,
          streamLink: data.stream_link,
          creatorWallet: data.creator_wallet,
          isCommunityBattle: data.is_community_battle,
          communityRoundId: data.community_round_id,
          isTestBattle: data.is_test_battle || false,
          isQuickBattle: data.is_quick_battle || false,
          quickBattleQueueId: data.quick_battle_queue_id ? String(data.quick_battle_queue_id) : undefined,
          quickBattleArtist1Handle: data.quick_battle_artist1_audius_handle,
          quickBattleArtist2Handle: data.quick_battle_artist2_audius_handle,
          quickBattleArtist1ProfilePic: data.quick_battle_artist1_audius_profile_pic,
          quickBattleArtist2ProfilePic: data.quick_battle_artist2_audius_profile_pic,
          quickBattleArtist1Profile: data.quick_battle_artist1_profile,
          quickBattleArtist2Profile: data.quick_battle_artist2_profile,
          winnerArtistA: typeof data.winner_artist_a === 'boolean' ? data.winner_artist_a : undefined,
          totalVolumeA: data.total_volume_a || 0,
          totalVolumeB: data.total_volume_b || 0,
          tradeCount: data.trade_count || 0,
          uniqueTraders: data.unique_traders || 0,
          lastScannedAt: data.last_scanned_at,
          recentTrades: data.recent_trades_cache,
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
    staleTime: 60000,
  });
}
