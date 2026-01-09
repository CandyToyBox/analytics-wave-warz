import { createClient } from '@supabase/supabase-js';
import { BattleSummary, ArtistLeaderboardStats, TraderLeaderboardEntry, BattleState, TraderProfileStats, QuickBattleLeaderboardEntry } from '../types';
import { batchFetchAudiusTrackInfo } from './audiusService';

// --- CONFIGURATION ---
// OFFICIAL WAVEWARZ DB CONNECTION
// Supabase credentials must be provided via environment variables.
// See .env.example for required configuration.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// Support both VITE_SUPABASE_ANON_KEY (preferred) and VITE_SUPABASE_KEY (legacy) for backward compatibility
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('VITE_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅' : '❌');
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY/VITE_SUPABASE_KEY. Please configure these in your .env file.');
}

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
  artist1_music_link,
  artist2_music_link,
  artist1_pool,
  artist2_pool,
  artist1_supply,
  artist2_supply,
  winner_decided,
  winner_artist_a,
  created_at,
  battle_duration,
  image_url,
  stream_link,
  is_community_battle,
  is_quick_battle,
  quick_battle_queue_id,
  quick_battle_artist1_audius_profile_pic,
  quick_battle_artist2_audius_profile_pic,
  is_test_battle,
  total_volume_a,
  total_volume_b,
  trade_count,
  unique_traders
`;

// Removed hardcoded 200 battle limit - fetch ALL battles
// Historical battles are static (webhook sends metadata, blockchain scan adds volumes)

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
      .from('battles')
      .select(BATTLE_COLUMNS)
      .order('created_at', { ascending: false });

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
            avatar: row.is_quick_battle ? (row.quick_battle_artist1_audius_profile_pic || row.image_url) : row.image_url,
            wallet: row.artist1_wallet,
            twitter: row.artist1_twitter
          },
          artistB: {
            id: 'B',
            name: row.artist2_name,
            color: '#e879f9',
            avatar: row.is_quick_battle ? (row.quick_battle_artist2_audius_profile_pic || row.image_url) : row.image_url,
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
    console.log('🔍 [Quick Battles] Fetching leaderboard from database...');

    // 1) Try the working "_old" view first (properly filters Quick Battles and aggregates by song)
    const { data: viewData, error: viewError } = await supabase
      .from('v_quick_battle_leaderboard_public_old')
      .select('audius_handle, track_name, audius_profile_pic, audius_profile_url, battles_participated, wins, losses, win_rate, total_volume_generated, avg_volume_per_battle, total_trades, unique_traders, first_battle_date, last_battle_date, updated_at')
      .order('total_volume_generated', { ascending: false })
      .order('wins', { ascending: false });

    if (viewError) {
      console.warn('⚠️ [Quick Battles] View query error:', viewError);
    }

    if (!viewError && viewData && viewData.length > 0) {
      console.log(`✅ [Quick Battles] Loaded ${viewData.length} entries from v_quick_battle_leaderboard_public_old`);
      console.log('📊 [Quick Battles] Sample entry:', viewData[0]);
      console.log('🔢 [Quick Battles] Top 3 volumes:',
        viewData.slice(0, 3).map(e => ({
          track: e.track_name,
          volume: e.total_volume_generated,
          wins: e.wins,
          battles: e.battles_participated
        }))
      );

      // Check if data is meaningful (has actual stats, not all zeros)
      const hasRealData = viewData.some(e =>
        (e.total_volume_generated && e.total_volume_generated > 0) ||
        (e.wins && e.wins > 0) ||
        (e.total_trades && e.total_trades > 0) ||
        (e.battles_participated && e.battles_participated > 0)
      );

      if (!hasRealData) {
        console.warn('⚠️ [Quick Battles] View has entries but all zeros - falling back to battles table');
        // Fall through to battles table query
      } else {
        const mapped = mapQuickBattleLeaderboardData(viewData);
        console.log('✅ [Quick Battles] Mapped data structure verified');
        console.log('🔍 [Quick Battles] First mapped entry:', mapped[0]);
        return mapped;
      }
    }

    // 2) Try dedicated leaderboard table as fallback
    const { data: tableData, error: tableError } = await supabase
      .from('quick_battle_leaderboard')
      .select('audius_handle, track_name, audius_profile_pic, audius_profile_url, battles_participated, wins, losses, win_rate, total_volume_generated, avg_volume_per_battle, peak_pool_size, total_trades, unique_traders, first_battle_date, last_battle_date, updated_at, is_test_artist')
      .neq('is_test_artist', true)
      .order('total_volume_generated', { ascending: false })
      .order('wins', { ascending: false })
      .order('last_battle_date', { ascending: false });

    if (tableError) {
      console.warn('⚠️ [Quick Battles] Table query error:', tableError);
    }

    if (!tableError && tableData && tableData.length > 0) {
      console.log(`✅ [Quick Battles] Loaded ${tableData.length} entries from table (fallback)`);
      console.log('📊 [Quick Battles] Sample table entry:', tableData[0]);

      // Check if data is meaningful (has actual stats, not all zeros)
      const hasRealData = tableData.some(e =>
        (e.total_volume_generated && e.total_volume_generated > 0) ||
        (e.wins && e.wins > 0) ||
        (e.total_trades && e.total_trades > 0)
      );

      if (!hasRealData) {
        console.warn('⚠️ [Quick Battles] Table has entries but all zeros - falling back to battles table');
        // Fall through to battles table query
      } else {
        return mapQuickBattleLeaderboardData(tableData);
      }
    }

    // Fallback: Query battles table directly for Quick Battles and aggregate by song
    console.warn("⚠️ [Quick Battles] Table and view failed/empty, falling back to battles table");
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
        quick_battle_artist1_audius_profile_pic,
        quick_battle_artist2_audius_profile_pic,
        last_scanned_at
      `)
      .eq('is_quick_battle', true)
      .neq('is_test_battle', true)  // Exclude test battles (matches view logic)
      .not('artist1_music_link', 'is', null)
      .not('artist2_music_link', 'is', null)
      .order('created_at', { ascending: false });

    if (battlesError || !battlesData || battlesData.length === 0) {
      console.error("❌ [Quick Battles] Failed to fetch from battles table:", battlesError);
      return null;
    }

    console.log(`✅ [Quick Battles] Loaded ${battlesData.length} battles from battles table (final fallback)`);

    // Aggregate by song (track name) - now async with Audius API integration
    const aggregatedData = await aggregateQuickBattlesBySong(battlesData);
    console.log(`✅ [Quick Battles] Aggregated into ${aggregatedData.length} unique songs`);
    console.log('📊 [Quick Battles] Sample aggregated entry:', aggregatedData[0]);

    return mapQuickBattleLeaderboardData(aggregatedData);
  } catch (e) {
    console.error("❌ [Quick Battles] Unexpected error fetching leaderboard:", e);
    return null;
  }
}

// Aggregate Quick Battles by song (track name) - now with Audius API integration
async function aggregateQuickBattlesBySong(battles: any[]): Promise<any[]> {
  const songMap = new Map<string, any>();

  // Collect all unique music links to fetch from Audius API
  const musicLinks = new Set<string>();
  for (const battle of battles) {
    if (battle.artist1_music_link?.includes('audius.co')) {
      musicLinks.add(battle.artist1_music_link);
    }
    if (battle.artist2_music_link?.includes('audius.co')) {
      musicLinks.add(battle.artist2_music_link);
    }
  }

  // Fetch track info from Audius API in batch
  console.log(`🎵 Fetching track info from Audius API for ${musicLinks.size} unique tracks...`);
  const audiusTrackInfo = await batchFetchAudiusTrackInfo(Array.from(musicLinks));
  console.log(`✅ Fetched ${audiusTrackInfo.size} tracks from Audius API`);

  for (const battle of battles) {
    // Skip battles without both music links (not true Quick Battles - song vs song)
    if (!battle.artist1_music_link || !battle.artist2_music_link) {
      console.log('⚠️ Skipping battle without both music links:', battle.battle_id);
      continue;
    }

    // Only process battles with Audius links (true Quick Battles)
    const hasAudiusLinks =
      battle.artist1_music_link?.includes('audius.co') &&
      battle.artist2_music_link?.includes('audius.co');

    if (!hasAudiusLinks) {
      console.log('⚠️ Skipping battle without Audius links:', battle.battle_id);
      continue;
    }

    // Determine which track this battle represents
    // For song vs song, we need to aggregate both artist1 and artist2 tracks separately
    const extractTrackInfo = (artistName: string | null, musicLink: string | null, profilePic: string | null) => {
      if (!musicLink) return null;  // Music link is required to fetch from API or parse URL

      // Try to get track info from Audius API first
      const apiInfo = audiusTrackInfo.get(musicLink);
      
      if (apiInfo) {
        // Use Audius API data - this is the most accurate
        return {
          trackName: apiInfo.trackName,
          musicLink,
          artistName: apiInfo.artistHandle,
          profilePic: apiInfo.artwork || apiInfo.profilePicture || profilePic  // Prefer track artwork, then artist profile pic
        };
      }

      // Fallback to URL parsing if API call failed
      let trackName = artistName || 'Unknown Track';
      let artistHandle = null;
      if (musicLink?.includes('audius.co')) {
        const urlParts = musicLink.split('/');
        const trackSlug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
        if (trackSlug) {
          // Convert slug to readable name (replace hyphens with spaces, capitalize)
          trackName = trackSlug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
        // Extract artist handle from URL pattern: https://audius.co/{artistHandle}/{trackSlug}
        // Example: https://audius.co/hurric4n3ike/terrorwavez-x-hurric4n3ike -> "hurric4n3ike"
        const match = musicLink.match(/audius\.co\/([^\/]+)\//);
        if (match && match[1]) {
          artistHandle = match[1];
        }
      }

      return {
        trackName,
        musicLink,
        artistName: artistHandle || artistName,  // Use extracted artist handle from URL, or original data as fallback
        profilePic
      };
    };

    // Process both tracks in the battle
    const track1 = extractTrackInfo(battle.artist1_name, battle.artist1_music_link, battle.quick_battle_artist1_audius_profile_pic);
    const track2 = extractTrackInfo(battle.artist2_name, battle.artist2_music_link, battle.quick_battle_artist2_audius_profile_pic);

    // Helper to aggregate a track's data
    const aggregateTrack = (track: any, isWinner: boolean, score: number) => {
      if (!track) return;

      const key = track.trackName || track.musicLink || 'Unknown';
      
      if (!songMap.has(key)) {
        songMap.set(key, {
          track_name: track.trackName,
          artist_name: track.artistName,  // Store artist name for display
          audius_profile_pic: track.profilePic,
          audius_profile_url: track.profilePic || track.musicLink,
          battles_participated: 0,
          wins: 0,
          losses: 0,
          total_volume_generated: 0,
          total_trades: 0,
          unique_traders: new Set<number>(),
          created_at: battle.created_at,
          updated_at: battle.last_scanned_at || battle.created_at,
          image_url: track.profilePic || battle.image_url,  // Use per-track image first, then fallback to battle image
          battle_ids: []
        });
      }

      const songData = songMap.get(key)!;
      songData.battles_participated += 1;
      songData.battle_ids.push(battle.battle_id);
      
      if (battle.winner_decided) {
        if (isWinner) {
          songData.wins += 1;
        } else {
          songData.losses += 1;
        }
      }

      // Add volume
      songData.total_volume_generated += score;
      
      // Add trades
      if (battle.trade_count) {
        songData.total_trades += battle.trade_count;
      }
      
      // Track unique traders (approximate)
      if (battle.unique_traders) {
        // We can't properly track unique traders across battles without wallet addresses
        // So we'll sum them (may include duplicates)
        songData.unique_traders.add(battle.id);
      }

      // Keep most recent update time
      if (battle.last_scanned_at && new Date(battle.last_scanned_at) > new Date(songData.updated_at)) {
        songData.updated_at = battle.last_scanned_at;
      }

      // Always prefer the track's profile pic to ensure correct artwork
      // Since track name is extracted from music link, the profile pic should match
      // Fall back to battle image_url if track profile pic is not available
      if (track.profilePic) {
        songData.image_url = track.profilePic;
        songData.audius_profile_pic = track.profilePic;
      } else if (!songData.image_url && battle.image_url) {
        songData.image_url = battle.image_url;
      }
    };

    // Determine scores and winner
    const score1 = battle.total_volume_a || battle.artist1_pool || 0;
    const score2 = battle.total_volume_b || battle.artist2_pool || 0;
    const winner1 = battle.winner_artist_a === true;
    const winner2 = battle.winner_artist_a === false;

    // Aggregate both tracks
    aggregateTrack(track1, winner1, score1);
    aggregateTrack(track2, winner2, score2);
  }

  // Convert map to array and calculate final stats
  return Array.from(songMap.entries()).map(([key, data]) => ({
    id: key,
    track_name: data.track_name,
    artist_name: data.artist_name,  // Include artist name for display
    audius_profile_pic: data.audius_profile_pic,
    audius_profile_url: data.audius_profile_url,
    battles_participated: data.battles_participated,
    wins: data.wins,
    losses: data.losses,
    win_rate: data.battles_participated > 0 
      ? (data.wins / data.battles_participated) * 100 
      : 0,
    total_volume_generated: data.total_volume_generated,
    total_trades: data.total_trades,
    unique_traders: data.unique_traders.size,
    created_at: data.created_at,
    updated_at: data.updated_at,
    image_url: data.image_url,
    battle_ids: data.battle_ids
  }));
}

// Helper function to map Quick Battle data consistently
function mapQuickBattleLeaderboardData(data: any[]): QuickBattleLeaderboardEntry[] {
  return data.map((row: any, index: number) => {
    const toNumber = (value: any) => (typeof value === 'number' ? value : value ? Number(value) : undefined);
    
    // For aggregated song data, volume is already calculated
    // For individual battle data, we need fallback chain
    const totalVolume = row.total_volume_generated
      ?? row.total_volume
      ?? ((row.artist1_volume || 0) + (row.artist2_volume || 0))
      ?? ((row.total_volume_a || 0) + (row.total_volume_b || 0))
      ?? ((row.artist1_pool || 0) + (row.artist2_pool || 0))
      ?? 0;
    
    // For backward compatibility with individual battle view
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
      audiusHandle: row.audius_handle || row.artist_name || extractAudiusHandle(row.artist1_music_link) || extractAudiusHandle(row.artist2_music_link),
      trackName: row.track_name ?? row.artist1_name ?? null,
      // Prefer image_url for artwork (materialized view may have audius_profile_pic as track URL before migration)
      // Fallback to music links as last resort for backwards compatibility with older data
      audiusProfilePic: row.image_url ?? row.audius_profile_pic ?? row.artist1_music_link ?? row.artist2_music_link,
      // Profile URL can be the music link itself, or audius_profile_pic if it contains a valid URL
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
        // Ensure battle_id is a string to match database TEXT column type
        const battleId = normalizeBattleId(state.battleId);

        console.log(`📊 Updating battle stats for ${battleId}:`, {
            volumeA: state.totalVolumeA,
            volumeB: state.totalVolumeB,
            poolA: state.artistASolBalance,
            poolB: state.artistBSolBalance,
            tradeCount: state.tradeCount,
            uniqueTraders: state.uniqueTraders,
            isQuickBattle: state.isQuickBattle
        });

        // Use backend API with service_role access (bypasses RLS)
        const apiKey = import.meta.env.VITE_BATTLE_UPDATE_API_KEY;

        if (!apiKey) {
            console.error('❌ VITE_BATTLE_UPDATE_API_KEY not configured');
            return;
        }

        const response = await fetch('/api/update-battle-volumes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey  // 🔒 API key for authentication
            },
            body: JSON.stringify({
                battleId,
                volumeA: state.totalVolumeA,
                volumeB: state.totalVolumeB,
                poolA: state.artistASolBalance,  // Pool balances for dashboard totals
                poolB: state.artistBSolBalance,
                tradeCount: state.tradeCount,
                uniqueTraders: state.uniqueTraders
            })
        });

        const result = await response.json();

        if (!result.success) {
            console.warn(`⚠️ Failed to update battle stats for ${battleId}:`, result.error);
            if (response.status === 404) {
                console.warn(`💡 Battle ${battleId} not found in database - needs to be inserted by backend first`);
            }
        } else {
            console.log(`✅ Battle stats saved successfully for ${battleId}`);
        }
    } catch (e: any) {
        console.error(`❌ API update error for ${state.battleId}:`, e.message);
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
      .order('rank', { ascending: true });
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
      .order('rank', { ascending: true });
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
