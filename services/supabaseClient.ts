import { createClient } from '@supabase/supabase-js';
import { BattleSummary, ArtistLeaderboardStats, TraderLeaderboardEntry, BattleState, TraderProfileStats, QuickBattleLeaderboardEntry } from '../types';

// --- CONFIGURATION ---
// OFFICIAL WAVEWARZ DB CONNECTION
// Replace defaults with your official Project URL and Anon Key when ready.
// The code will prefer environment variables if they exist.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gshwqoplsxgqbdkssoit.supabase.co'; 
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaHdxb3Bsc3hncWJka3Nzb2l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NTQ2NDksImV4cCI6MjA3OTUzMDY0OX0.YNv0QgQfUMsrDyWQB3tnKVshal_h7ZjuobKWrQjfzlQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const BATTLE_COLUMNS = `
  battle_id,
  status,
  artist1_name,
  artist2_name,
  artist1_wallet,
  artist2_wallet,
  artist1_twitter,
  artist2_twitter,
  artist1_pool,
  artist2_pool,
  artist1_supply,
  artist2_supply,
  total_tvl,
  current_leader,
  winner_decided,
  winner_artist_a,
  created_at,
  battle_duration,
  image_url,
  stream_link,
  is_community_battle
`;

const BATTLE_FETCH_LIMIT = 200;

export async function fetchBattlesFromSupabase(): Promise<BattleSummary[] | null> {
  if (!supabase) {
    console.warn("Supabase client not initialized. Using local fallback data.");
    return null;
  }

  try {
    // Use materialized view for performant battle fetches.
    const { data, error } = await supabase
      .from('mv_battle_stats')
      .select(BATTLE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(BATTLE_FETCH_LIMIT);

    if (error) {
      console.warn("Supabase fetch warning (Official DB might be unreachable):", JSON.stringify(error, null, 2));
      return null;
    }

    if (!data || data.length === 0) {
      console.log("Supabase connected but returned no battles. Using local fallback.");
      return null;
    }

    return data.map((row: any) => ({
      id: row.battle_id?.toString(),
      battleId: row.battle_id?.toString(),
      createdAt: row.created_at,
      status: row.status,
      artistA: {
        id: 'A',
        name: row.artist1_name,
        color: '#06b6d4',
        avatar: row.image_url,
        wallet: row.artist1_wallet,
        twitter: row.artist1_twitter
      },
      artistB: {
        id: 'B',
        name: row.artist2_name,
        color: '#e879f9',
        avatar: row.image_url,
        wallet: row.artist2_wallet,
        twitter: row.artist2_twitter
      },
      battleDuration: row.battle_duration,
      winnerDecided: row.winner_decided,
      winnerArtistA: typeof row.winner_artist_a === 'boolean' ? row.winner_artist_a : undefined,
      artistASolBalance: row.artist1_pool || 0,
      artistBSolBalance: row.artist2_pool || 0,
      imageUrl: row.image_url,
      streamLink: row.stream_link,
      isCommunityBattle: row.is_community_battle,
    }));

  } catch (err: any) {
    const errorMessage = typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err);
    console.warn("Supabase connection failed (using fallback):", errorMessage);
  }
  return null;
}

export async function fetchQuickBattleLeaderboardFromDB(): Promise<QuickBattleLeaderboardEntry[] | null> {
  try {
    const { data, error } = await supabase
      .from('quick_battle_leaderboard')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    return data.map((row: any, index: number) => {
      // Prefer volume, then votes/score, then legacy total_volume fields
      const artist1Score = row.artist1_volume ?? row.artist1_votes ?? row.artist1_score ?? row.total_volume_a;
      const artist2Score = row.artist2_volume ?? row.artist2_votes ?? row.artist2_score ?? row.total_volume_b;
      const totalVolume = row.total_volume ?? ((artist1Score || 0) + (artist2Score || 0));
      const resolveId = () => {
        if (row.id) return String(row.id);
        if (row.queue_id) return String(row.queue_id);
        if (row.battle_id) return String(row.battle_id);
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        return `quick-${Date.now()}-${index}`;
      };

      const winnerHandle = (() => {
        if (row.winner_handle) return row.winner_handle;
        if (row.winner) return row.winner;
        if (row.winner_artist_a === true) return row.artist1_handle || row.quick_battle_artist1_audius_handle;
        if (row.winner_artist_a === false) return row.artist2_handle || row.quick_battle_artist2_audius_handle;
        return undefined;
      })();

      return {
        id: resolveId(),
        queueId: row.queue_id ? String(row.queue_id) : undefined,
        battleId: row.battle_id ? String(row.battle_id) : undefined,
        createdAt: row.created_at,
        status: row.status,
        artist1Handle: row.artist1_handle || row.quick_battle_artist1_audius_handle,
        artist2Handle: row.artist2_handle || row.quick_battle_artist2_audius_handle,
        artist1ProfilePic: row.artist1_profile_pic || row.quick_battle_artist1_audius_profile_pic,
        artist2ProfilePic: row.artist2_profile_pic || row.quick_battle_artist2_audius_profile_pic,
        artist1Score,
        artist2Score,
        totalVolume: typeof totalVolume === 'number' ? totalVolume : undefined,
        winnerHandle,
      } as QuickBattleLeaderboardEntry;
    });
  } catch (e) {
    console.warn("Failed to fetch quick battle leaderboard", e);
    return null;
  }
}

export async function updateBattleDynamicStats(state: BattleState) {
    try {
        const { error } = await supabase
            .from('battles')
            .update({
                artist1_pool: state.artistASolBalance,
                artist2_pool: state.artistBSolBalance,
                total_volume_a: state.totalVolumeA,
                total_volume_b: state.totalVolumeB,
                trade_count: state.tradeCount,
                unique_traders: state.uniqueTraders,
                last_scanned_at: new Date().toISOString(),
                recent_trades_cache: state.recentTrades
            })
            .eq('battle_id', state.battleId);

        if (error) console.warn("Failed to update battle cache:", error);
    } catch (e) {
        console.error("Supabase update error", e);
    }
}

export async function uploadBattlesToSupabase(battles: BattleSummary[]) {
  if (!battles || battles.length === 0) return { success: false, message: 'No data to upload' };

  try {
    const rows = battles.map(b => ({
      battle_id: b.battleId,
      created_at: b.createdAt,
      status: b.status,
      artist1_name: b.artistA.name,
      artist1_wallet: b.artistA.wallet,
      artist1_music_link: b.artistA.musicLink,
      artist1_twitter: b.artistA.twitter,
      artist1_pool: b.artistASolBalance,
      
      artist2_name: b.artistB.name,
      artist2_wallet: b.artistB.wallet,
      artist2_music_link: b.artistB.musicLink,
      artist2_twitter: b.artistB.twitter,
      artist2_pool: b.artistBSolBalance,
      
      image_url: b.imageUrl,
      stream_link: b.streamLink,
      battle_duration: b.battleDuration,
      winner_decided: b.winnerDecided,
      
      is_community_battle: b.isCommunityBattle,
      community_round_id: b.communityRoundId,
      is_test_battle: b.isTestBattle || false,

      // Preserve existing if possible, but map for initial upload
      total_volume_a: b.totalVolumeA || 0,
      total_volume_b: b.totalVolumeB || 0
    }));

    const { error } = await supabase
      .from('battles')
      .upsert(rows, { onConflict: 'battle_id', ignoreDuplicates: false });

    if (error) throw error;
    
    return { success: true, message: `Successfully synced ${rows.length} battles!` };
  } catch (e: any) {
    console.error("Upload failed", e);
    return { success: false, message: e.message || JSON.stringify(e) };
  }
}

// --- TRADER SNAPSHOTS ---

export async function fetchTraderSnapshotFromDB(wallet: string): Promise<TraderProfileStats | null> {
    try {
        const { data, error } = await supabase
            .from('trader_snapshots')
            .select('profile_data')
            .eq('wallet_address', wallet)
            .single();
        
        if (error || !data) return null;
        return data.profile_data as TraderProfileStats;
    } catch(e) {
        return null;
    }
}

export async function saveTraderSnapshotToDB(stats: TraderProfileStats) {
    try {
        await supabase.from('trader_snapshots').upsert({
            wallet_address: stats.walletAddress,
            profile_data: stats,
            updated_at: new Date().toISOString()
        });
    } catch(e) {
        console.error("Failed to save trader snapshot", e);
    }
}

// --- ARTIST LEADERBOARD CACHE ---

export async function fetchArtistLeaderboardFromDB(): Promise<ArtistLeaderboardStats[] | null> {
  try {
    const { data, error } = await supabase.from('artist_leaderboard').select('*');
    if (error || !data || data.length === 0) return null;

    return data.map((row: any) => ({
      artistName: row.artist_name,
      walletAddress: row.wallet_address,
      imageUrl: row.image_url,
      twitterHandle: row.twitter_handle,
      musicLink: row.music_link,
      totalEarningsSol: row.total_earnings_sol,
      totalEarningsUsd: 0, // Recalculated on frontend based on live price
      spotifyStreamEquivalents: row.spotify_stream_equivalents,
      tradingFeeEarnings: 0, // Details not cached in this simplified table
      settlementEarnings: 0,
      battlesParticipated: row.battles_participated,
      wins: row.wins,
      losses: row.losses,
      winRate: row.win_rate,
      totalVolumeGenerated: row.total_volume_generated,
      avgVolumePerBattle: row.avg_volume_per_battle,
      bestBattleEarnings: 0,
      bestBattleName: '',
    }));
  } catch (e) {
    console.warn("Failed to fetch artist leaderboard", e);
    return null;
  }
}

export async function saveArtistLeaderboardToDB(stats: ArtistLeaderboardStats[]) {
  try {
    const rows = stats.map(s => ({
      wallet_address: s.walletAddress || s.artistName, // Fallback PK
      artist_name: s.artistName,
      image_url: s.imageUrl,
      twitter_handle: s.twitterHandle,
      music_link: s.musicLink,
      total_earnings_sol: s.totalEarningsSol,
      spotify_stream_equivalents: s.spotifyStreamEquivalents,
      battles_participated: s.battlesParticipated,
      wins: s.wins,
      losses: s.losses,
      win_rate: s.winRate,
      total_volume_generated: s.totalVolumeGenerated,
      avg_volume_per_battle: s.avgVolumePerBattle,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('artist_leaderboard').upsert(rows, { onConflict: 'wallet_address' });
    if (error) throw error;
    console.log("Artist Leaderboard Saved!");
  } catch (e) {
    console.error("Failed to save artist stats", e);
  }
}

// --- TRADER LEADERBOARD CACHE ---

export async function fetchTraderLeaderboardFromDB(): Promise<TraderLeaderboardEntry[] | null> {
  try {
    const { data, error } = await supabase.from('trader_leaderboard').select('*');
    if (error || !data || data.length === 0) return null;

    return data.map((row: any) => ({
      walletAddress: row.wallet_address,
      totalInvested: row.total_invested,
      totalPayout: row.total_payout,
      netPnL: row.net_pnl,
      roi: row.roi,
      battlesParticipated: row.battles_participated,
      wins: row.wins,
      losses: row.losses,
      winRate: 0 // Recalculated on frontend if needed
    }));
  } catch (e) {
    console.warn("Failed to fetch trader leaderboard", e);
    return null;
  }
}

export async function saveTraderLeaderboardToDB(traders: TraderLeaderboardEntry[]) {
  try {
    const rows = traders.map(t => ({
      wallet_address: t.walletAddress,
      total_invested: t.totalInvested,
      total_payout: t.totalPayout,
      net_pnl: t.netPnL,
      roi: t.roi,
      battles_participated: t.battlesParticipated,
      wins: t.wins,
      losses: t.losses,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('trader_leaderboard').upsert(rows, { onConflict: 'wallet_address' });
    if (error) throw error;
    console.log("Trader Leaderboard Saved!");
  } catch (e) {
    console.error("Failed to save trader stats", e);
  }
}
