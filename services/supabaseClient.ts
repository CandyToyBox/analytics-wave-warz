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

export function normalizeBattleId(value: unknown): string | null {
  return value == null ? null : value.toString();
}

export async function fetchBattlesFromSupabase(): Promise<BattleSummary[] | null> {
  if (!supabase) {
    console.warn("Supabase client not initialized. Using local fallback data.");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('v_battles_public')
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

    return data
      .map((row: any) => {
        const battleId = normalizeBattleId(row.battle_id);

        if (!battleId) return null;

        return {
          id: battleId,
          battleId,
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
        };
      })
      .filter(Boolean) as BattleSummary[];

  } catch (err: any) {
    const errorMessage = typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err);
    console.warn("Supabase connection failed (using fallback):", errorMessage);
  }
  return null;
}

export async function fetchQuickBattleLeaderboardFromDB(): Promise<QuickBattleLeaderboardEntry[] | null> {
  try {
    // Try the view first
    const { data: viewData, error: viewError } = await supabase
      .from('v_quick_battle_leaderboard_public')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);

    // If view works and has data, use it
    if (!viewError && viewData && viewData.length > 0) {
      console.log(`✅ Quick Battle leaderboard loaded from view (${viewData.length} entries)`);
      return mapQuickBattleLeaderboardData(viewData);
    }

    // Fallback: Query battles table directly for Quick Battles
    console.warn("⚠️ View failed or empty, falling back to battles table for Quick Battles");
    const { data: battlesData, error: battlesError } = await supabase
      .from('battles')
      .select(`
        id,
        battle_id,
        created_at,
        status,
        artist1_name,
        artist2_name,
        artist1_music_link,
        artist2_music_link,
        artist1_pool,
        artist2_pool,
        total_volume_a,
        total_volume_b,
        trade_count,
        unique_traders,
        winner_decided,
        winner_artist_a,
        image_url,
        last_scanned_at
      `)
      .eq('is_quick_battle', true)
      .order('created_at', { ascending: false })
      .limit(200);

    if (battlesError || !battlesData || battlesData.length === 0) {
      console.warn("Failed to fetch Quick Battles from battles table", battlesError);
      return null;
    }

    console.log(`✅ Quick Battle data loaded from battles table (${battlesData.length} entries)`);
    return mapQuickBattleLeaderboardData(battlesData);
  } catch (e) {
    console.warn("Failed to fetch quick battle leaderboard", e);
    return null;
  }
}

// Helper function to map Quick Battle data consistently
function mapQuickBattleLeaderboardData(data: any[]): QuickBattleLeaderboardEntry[] {
  return data.map((row: any, index: number) => {
    const toNumber = (value: any) => (typeof value === 'number' ? value : value ? Number(value) : undefined);
    
    // Map volume columns - check multiple possible sources
    // Priority: specific Quick Battle columns -> standard battle columns -> pools as fallback
    const artist1Score = row.artist1_volume 
      ?? row.artist1_votes 
      ?? row.artist1_score 
      ?? row.total_volume_a
      ?? row.artist1_pool
      ?? 0;
    
    const artist2Score = row.artist2_volume 
      ?? row.artist2_votes 
      ?? row.artist2_score 
      ?? row.total_volume_b
      ?? row.artist2_pool
      ?? 0;
    
    const totalVolume = row.total_volume 
      ?? row.total_volume_generated
      ?? ((artist1Score || 0) + (artist2Score || 0));
    
    const resolveId = () => {
      if (row.id) return String(row.id);
      if (row.audius_handle) return String(row.audius_handle);
      if (row.queue_id) return String(row.queue_id);
      if (row.battle_id) return String(row.battle_id);
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      return `quick-${Date.now()}-${index}`;
    };

    // Extract Audius handle from music links if not provided directly
    const extractAudiusHandle = (link: string | null): string | null => {
      if (!link) return null;
      const match = link.match(/audius\.co\/([^\/]+)\//);
      return match ? match[1] : null;
    };

    const artist1Handle = row.artist1_handle 
      || row.quick_battle_artist1_audius_handle
      || extractAudiusHandle(row.artist1_music_link)
      || row.artist1_name;
    
    const artist2Handle = row.artist2_handle 
      || row.quick_battle_artist2_audius_handle
      || extractAudiusHandle(row.artist2_music_link)
      || row.artist2_name;

    const winnerHandle = (() => {
      if (row.winner_handle) return row.winner_handle;
      if (row.winner) return row.winner;
      if (row.winner_artist_a === true) return artist1Handle;
      if (row.winner_artist_a === false) return artist2Handle;
      // If winner not decided, show current leader based on volume
      if (!row.winner_decided) {
        // Handle ties - no winner if scores are equal
        if (artist1Score === artist2Score) return undefined;
        return artist1Score > artist2Score ? artist1Handle : artist2Handle;
      }
      return undefined;
    })();

    // Calculate wins/losses if not provided
    const wins = toNumber(row.wins) ?? (row.winner_decided && row.winner_artist_a ? 1 : 0);
    const losses = toNumber(row.losses) ?? (row.winner_decided && !row.winner_artist_a ? 1 : 0);
    const battlesParticipated = toNumber(row.battles_participated) ?? 1;

    return {
      id: resolveId(),
      updatedAt: row.updated_at || row.last_scanned_at || row.created_at,
      audiusHandle: row.audius_handle || extractAudiusHandle(row.artist1_music_link) || extractAudiusHandle(row.artist2_music_link),
      trackName: row.track_name ?? row.artist1_name ?? null,
      // Backend stores track URL in audius_profile_pic for artwork; audius_profile_url is the canonical track page when present
      audiusProfilePic: row.audius_profile_pic ?? row.artist1_music_link ?? row.artist2_music_link ?? row.image_url,
      audiusProfileUrl: row.audius_profile_url ?? row.audius_profile_pic ?? row.artist1_music_link ?? null,
      battlesParticipated,
      totalTrades: toNumber(row.total_trades) ?? toNumber(row.trade_count),
      wins,
      losses,
      winRate: typeof row.win_rate === 'number' ? row.win_rate : (battlesParticipated > 0 ? (wins / battlesParticipated) * 100 : 0),
      totalVolumeGenerated: toNumber(totalVolume),
      queueId: row.queue_id ? String(row.queue_id) : undefined,
      battleId: row.battle_id ? String(row.battle_id) : undefined,
      createdAt: row.created_at,
      status: row.status,
      artist1Handle,
      artist2Handle,
      artist1ProfilePic: row.artist1_profile_pic || row.quick_battle_artist1_audius_profile_pic || row.artist1_music_link,
      artist2ProfilePic: row.artist2_profile_pic || row.quick_battle_artist2_audius_profile_pic || row.artist2_music_link,
      artist1Score,
      artist2Score,
      totalVolume: typeof totalVolume === 'number' ? totalVolume : undefined,
      winnerHandle,
    } as QuickBattleLeaderboardEntry;
  });
}

export async function updateBattleDynamicStats(state: BattleState) {
    try {
        console.log(`📊 Updating battle stats for ${state.battleId}:`, {
            volumeA: state.totalVolumeA,
            volumeB: state.totalVolumeB,
            tradeCount: state.tradeCount,
            uniqueTraders: state.uniqueTraders,
            isQuickBattle: state.isQuickBattle
        });

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

        if (error) {
            console.warn(`❌ Failed to update battle cache for ${state.battleId}:`, error);
        } else {
            console.log(`✅ Battle stats saved successfully for ${state.battleId}`);
        }
    } catch (e) {
        console.error(`❌ Supabase update error for ${state.battleId}:`, e);
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
      is_quick_battle: b.isQuickBattle || false,
      quick_battle_queue_id: b.quickBattleQueueId,

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
    const { data, error } = await supabase
      .from('v_artist_leaderboard_public')
      .select('*')
      .order('rank', { ascending: true })
      .limit(200);
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

// --- TRADER LEADERBOARD CACHE ---

export async function fetchTraderLeaderboardFromDB(): Promise<TraderLeaderboardEntry[] | null> {
  try {
    const { data, error } = await supabase
      .from('v_trader_leaderboard_public')
      .select('*')
      .order('rank', { ascending: true })
      .limit(200);
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
