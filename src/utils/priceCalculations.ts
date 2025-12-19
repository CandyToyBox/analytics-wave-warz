// ============================================================================
// WAVEWARZ ANALYTICS - CORRECTED PRICE CALCULATIONS
// ============================================================================
// CRITICAL FIX: Quick Battles identified by Audius links, not duration!

// ============================================================================
// CONSTANTS
// ============================================================================

const SPOTIFY_RATE_PER_STREAM = 0.003; // $0.003 per stream
const SOL_PRICE_CACHE_MS = 300000; // Cache SOL price for 5 minutes
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Battle {
  battle_id: string;
  artist1_name: string;
  artist2_name: string;
  artist1_wallet: string;
  artist2_wallet: string;
  artist1_pool: number;
  artist2_pool: number;
  artist1_supply: number;
  artist2_supply: number;
  winner_decided: boolean;
  winner_artist_a: boolean | null;
  created_at: string;
  battle_duration: number;
  image_url: string | null;
  stream_link: string | null;
  artist1_twitter: string | null;
  artist2_twitter: string | null;
  is_community_battle: boolean | null;
  
  // ✅ CRITICAL: Audius links identify Quick Battles!
  artist1_music_link: string | null;
  artist2_music_link: string | null;
  
  // Battle type labels (from database)
  battle_type?: 'Quick Battle' | 'Main Battle' | 'Community Battle' | null;
}

export interface BattleWithMetrics extends Battle {
  artist1_pool_usd: number;
  artist2_pool_usd: number;
  total_tvl_usd: number;
  artist1_spotify_streams: number;
  artist2_spotify_streams: number;
  total_spotify_streams: number;
  sol_price_usd: number;
  calculated_at: string;
  
  // Audius artwork (extracted from links)
  artist1_artwork_url: string | null;
  artist2_artwork_url: string | null;
}

export interface ArtistStats {
  wallet_address: string;
  artist_name: string;
  twitter_handle: string | null;
  image_url: string | null;
  total_sol_earned: number;
  battles_participated: number;
  wins: number;
  losses: number;
  total_usd_earned: number;
  total_spotify_equivalent: number;
  win_rate: number;
  avg_sol_per_battle: number;
}

// Quick Battle Leaderboard uses Audius handle as primary identifier
export interface QuickBattleArtistStats {
  audius_handle: string;              // Primary key for Quick Battles
  track_name: string | null;
  audius_profile_pic: string | null;  // Audius profile picture URL
  audius_profile_url: string | null;  // Link to Audius profile
  battles_participated: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_volume_generated: number;
  avg_volume_per_battle: number;
  peak_pool_size: number;
  total_trades: number;
  unique_traders: number;
  first_battle_date: string | null;
  last_battle_date: string | null;
  updated_at: string;
  is_test_artist: boolean | null;
}

interface SolPriceCache {
  price: number;
  timestamp: number;
}

// ============================================================================
// SOL PRICE FETCHING
// ============================================================================

let solPriceCache: SolPriceCache | null = null;

export async function getCurrentSolPrice(): Promise<number> {
  const now = Date.now();
  
  if (solPriceCache && (now - solPriceCache.timestamp) < SOL_PRICE_CACHE_MS) {
    return solPriceCache.price;
  }
  
  try {
    const response = await fetch(COINGECKO_API);
    const data = await response.json();
    const price = data.solana?.usd;
    
    if (!price) throw new Error('Invalid price data');
    
    solPriceCache = { price, timestamp: now };
    console.log(`✅ SOL price updated: $${price.toFixed(2)}`);
    return price;
  } catch (error) {
    console.error('❌ Failed to fetch SOL price:', error);
    return solPriceCache?.price || 200;
  }
}

export function clearSolPriceCache(): void {
  solPriceCache = null;
}

// ============================================================================
// BATTLE TYPE IDENTIFICATION (CORRECTED!)
// ============================================================================

/**
 * ✅ CORRECTED: Quick Battles are identified by Audius links!
 * ALL Quick Battles have artist1_music_link and artist2_music_link
 */
export function isQuickBattle(battle: Battle): boolean {
  // Quick Battle = Has Audius links
  return !!(battle.artist1_music_link && battle.artist2_music_link);
}

/**
 * Main Battle = Not Quick Battle and not Community Battle
 */
export function isMainBattle(battle: Battle): boolean {
  return !isQuickBattle(battle) && !battle.is_community_battle;
}

/**
 * Community Battle = Flagged in database
 */
export function isCommunityBattle(battle: Battle): boolean {
  return battle.is_community_battle === true;
}

/**
 * Get battle type label
 */
export function getBattleType(battle: Battle): 'Quick Battle' | 'Main Battle' | 'Community Battle' {
  if (isQuickBattle(battle)) return 'Quick Battle';
  if (isCommunityBattle(battle)) return 'Community Battle';
  return 'Main Battle';
}

/**
 * Filter battles by type
 */
export function filterQuickBattles(battles: Battle[]): Battle[] {
  return battles.filter(isQuickBattle);
}

export function filterMainBattles(battles: Battle[]): Battle[] {
  return battles.filter(isMainBattle);
}

export function filterCommunityBattles(battles: Battle[]): Battle[] {
  return battles.filter(isCommunityBattle);
}

// ============================================================================
// AUDIUS INTEGRATION
// ============================================================================

/**
 * Extract Audius track ID from music link
 * Example: https://audius.co/artist/track-name-abc123 → abc123
 */
export function extractAudiusTrackId(audiusLink: string | null): string | null {
  if (!audiusLink) return null;
  
  try {
    // Audius links typically end with the track ID
    const parts = audiusLink.split('/');
    const lastPart = parts[parts.length - 1];
    // Extract ID (usually after last hyphen or the whole thing)
    const match = lastPart.match(/([a-zA-Z0-9]+)$/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Failed to extract Audius track ID:', error);
    return null;
  }
}

/**
 * Get Audius artwork URL from track link
 * Audius provides artwork at: https://creatornode.audius.co/content/{track_id}/480x480.jpg
 */
export function getAudiusArtworkUrl(audiusLink: string | null, size: number = 480): string | null {
  const trackId = extractAudiusTrackId(audiusLink);
  if (!trackId) return null;
  
  // Audius discovery nodes for artwork
  const discoveryNodes = [
    'https://discoveryprovider.audius.co',
    'https://discoveryprovider2.audius.co',
    'https://discoveryprovider3.audius.co',
  ];
  
  // Use first discovery node (can implement fallback logic if needed)
  return `${discoveryNodes[0]}/content/${trackId}/${size}x${size}.jpg`;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

export async function solToUsd(solAmount: number): Promise<number> {
  const solPrice = await getCurrentSolPrice();
  return solAmount * solPrice;
}

export async function solToSpotifyStreams(solAmount: number): Promise<number> {
  const usdAmount = await solToUsd(solAmount);
  return Math.round(usdAmount / SPOTIFY_RATE_PER_STREAM);
}

export function usdToSpotifyStreams(usdAmount: number): number {
  return Math.round(usdAmount / SPOTIFY_RATE_PER_STREAM);
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

export function formatSol(amount: number): string {
  return `${amount.toFixed(2)} SOL`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatSpotifyStreams(streams: number): string {
  if (streams >= 1_000_000) {
    return `${(streams / 1_000_000).toFixed(2)}M streams`;
  } else if (streams >= 1_000) {
    return `${(streams / 1_000).toFixed(1)}K streams`;
  }
  return `${streams.toLocaleString()} streams`;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ============================================================================
// BATTLE ENRICHMENT WITH AUDIUS ARTWORK
// ============================================================================

export async function enrichBattleWithMetrics(battle: Battle): Promise<BattleWithMetrics> {
  const solPrice = await getCurrentSolPrice();
  
  const artist1PoolUsd = battle.artist1_pool * solPrice;
  const artist2PoolUsd = battle.artist2_pool * solPrice;
  const totalTvlUsd = artist1PoolUsd + artist2PoolUsd;
  
  return {
    ...battle,
    artist1_pool_usd: artist1PoolUsd,
    artist2_pool_usd: artist2PoolUsd,
    total_tvl_usd: totalTvlUsd,
    artist1_spotify_streams: usdToSpotifyStreams(artist1PoolUsd),
    artist2_spotify_streams: usdToSpotifyStreams(artist2PoolUsd),
    total_spotify_streams: usdToSpotifyStreams(totalTvlUsd),
    sol_price_usd: solPrice,
    calculated_at: new Date().toISOString(),
    
    // ✅ Extract Audius artwork URLs
    artist1_artwork_url: getAudiusArtworkUrl(battle.artist1_music_link),
    artist2_artwork_url: getAudiusArtworkUrl(battle.artist2_music_link),
  };
}

export async function enrichBattlesWithMetrics(battles: Battle[]): Promise<BattleWithMetrics[]> {
  if (battles.length === 0) return [];
  
  const solPrice = await getCurrentSolPrice();
  const calculatedAt = new Date().toISOString();
  
  return battles.map(battle => {
    const artist1PoolUsd = battle.artist1_pool * solPrice;
    const artist2PoolUsd = battle.artist2_pool * solPrice;
    const totalTvlUsd = artist1PoolUsd + artist2PoolUsd;
    
    return {
      ...battle,
      artist1_pool_usd: artist1PoolUsd,
      artist2_pool_usd: artist2PoolUsd,
      total_tvl_usd: totalTvlUsd,
      artist1_spotify_streams: usdToSpotifyStreams(artist1PoolUsd),
      artist2_spotify_streams: usdToSpotifyStreams(artist2PoolUsd),
      total_spotify_streams: usdToSpotifyStreams(totalTvlUsd),
      sol_price_usd: solPrice,
      calculated_at: calculatedAt,
      artist1_artwork_url: getAudiusArtworkUrl(battle.artist1_music_link),
      artist2_artwork_url: getAudiusArtworkUrl(battle.artist2_music_link),
    };
  });
}

// ============================================================================
// LEADERBOARD CALCULATIONS
// ============================================================================

/**
 * Calculate GLOBAL artist leaderboard (all battle types)
 */
export async function calculateGlobalArtistStats(battles: Battle[]): Promise<ArtistStats[]> {
  console.log(`🌍 Calculating GLOBAL artist leaderboard from ${battles.length} battles...`);
  
  const solPrice = await getCurrentSolPrice();
  const artistStatsMap = new Map<string, ArtistStats>();
  
  battles.forEach(battle => {
    // Process Artist 1
    processArtist(artistStatsMap, solPrice, {
      wallet: battle.artist1_wallet,
      name: battle.artist1_name,
      twitter: battle.artist1_twitter,
      image: battle.image_url,
      pool: battle.artist1_pool,
      won: battle.winner_decided && battle.winner_artist_a === true,
      lost: battle.winner_decided && battle.winner_artist_a === false,
    });
    
    // Process Artist 2
    processArtist(artistStatsMap, solPrice, {
      wallet: battle.artist2_wallet,
      name: battle.artist2_name,
      twitter: battle.artist2_twitter,
      image: battle.image_url,
      pool: battle.artist2_pool,
      won: battle.winner_decided && battle.winner_artist_a === false,
      lost: battle.winner_decided && battle.winner_artist_a === true,
    });
  });
  
  return finalizeArtistStats(artistStatsMap);
}

/**
 * Calculate QUICK BATTLES artist leaderboard
 */
export async function calculateQuickBattlesArtistStats(battles: Battle[]): Promise<ArtistStats[]> {
  const quickBattles = filterQuickBattles(battles);
  console.log(`⚡ Calculating QUICK BATTLES leaderboard from ${quickBattles.length} battles...`);
  return calculateGlobalArtistStats(quickBattles);
}

/**
 * Calculate MAIN EVENTS artist leaderboard (excludes quick + community)
 */
export async function calculateMainEventsArtistStats(battles: Battle[]): Promise<ArtistStats[]> {
  const mainBattles = filterMainBattles(battles);
  console.log(`🏆 Calculating MAIN EVENTS leaderboard from ${mainBattles.length} battles...`);
  return calculateGlobalArtistStats(mainBattles);
}

// Helper function to process artist data
function processArtist(
  map: Map<string, ArtistStats>,
  solPrice: number,
  data: {
    wallet: string;
    name: string;
    twitter: string | null;
    image: string | null;
    pool: number;
    won: boolean;
    lost: boolean;
  }
) {
  if (!map.has(data.wallet)) {
    map.set(data.wallet, {
      wallet_address: data.wallet,
      artist_name: data.name,
      twitter_handle: data.twitter,
      image_url: data.image,
      total_sol_earned: 0,
      battles_participated: 0,
      wins: 0,
      losses: 0,
      total_usd_earned: 0,
      total_spotify_equivalent: 0,
      win_rate: 0,
      avg_sol_per_battle: 0,
    });
  }
  
  const artist = map.get(data.wallet)!;
  const usdEarned = data.pool * solPrice;
  
  artist.total_sol_earned += data.pool;
  artist.total_usd_earned += usdEarned;
  artist.total_spotify_equivalent += usdToSpotifyStreams(usdEarned);
  artist.battles_participated++;
  if (data.won) artist.wins++;
  if (data.lost) artist.losses++;
}

// Helper function to finalize and sort artist stats
function finalizeArtistStats(map: Map<string, ArtistStats>): ArtistStats[] {
  return Array.from(map.values())
    .map(artist => ({
      ...artist,
      win_rate: artist.battles_participated > 0 
        ? (artist.wins / artist.battles_participated) * 100 
        : 0,
      avg_sol_per_battle: artist.battles_participated > 0
        ? artist.total_sol_earned / artist.battles_participated
        : 0,
    }))
    .sort((a, b) => b.total_sol_earned - a.total_sol_earned);
}
