import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://gshwqoplsxgqbdkssoit.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

// Constants
/** Default SOL price in USD used when CoinGecko API is unavailable */
const DEFAULT_SOL_PRICE_USD = 150;
/** Multiplier used to estimate trading volume from total value locked (TVL) */
const VOLUME_ESTIMATION_MULTIPLIER = 10;

/**
 * Unified API Handler
 * This single serverless function handles all WaveWarz API endpoints
 * Routes based on the URL path
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Check for Supabase configuration
  if (!supabaseKey) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Extract the path segments after /api/wavewarz/
    const pathSegments = req.query.path as string[] | undefined;
    const path = pathSegments ? pathSegments.join('/') : '';

    // Route to appropriate handler based on path
    if (path === 'artist-leaderboard' || path === '') {
      return await handleArtistLeaderboard(req, res, supabase);
    } else if (path === 'artists/all') {
      return await handleAllArtists(req, res, supabase);
    } else if (path.startsWith('artists/')) {
      const wallet = path.replace('artists/', '');
      return await handleArtistProfile(req, res, supabase, wallet);
    } else if (path === 'traders/leaderboard') {
      return await handleTraderLeaderboard(req, res, supabase);
    } else if (path.startsWith('traders/')) {
      const wallet = path.replace('traders/', '');
      return await handleTraderProfile(req, res, supabase, wallet);
    } else if (path === 'battles/top') {
      return await handleTopBattles(req, res, supabase);
    } else if (path.startsWith('battles/')) {
      const battleId = path.replace('battles/', '');
      return await handleBattleDetails(req, res, supabase, battleId);
    } else if (path === 'stats/platform') {
      return await handlePlatformStats(req, res, supabase);
    } else {
      return res.status(404).json({
        error: 'Endpoint not found',
        path: path,
        availableEndpoints: [
          '/api/wavewarz/artist-leaderboard',
          '/api/wavewarz/artists/all',
          '/api/wavewarz/artists/:wallet',
          '/api/wavewarz/traders/leaderboard',
          '/api/wavewarz/traders/:wallet',
          '/api/wavewarz/battles/top',
          '/api/wavewarz/battles/:battleId',
          '/api/wavewarz/stats/platform'
        ]
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ========== HANDLER FUNCTIONS ==========

type SupabaseClient = ReturnType<typeof createClient>;

async function handleArtistLeaderboard(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient
) {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const { data: artists, error } = await supabase
    .from('artist_leaderboard')
    .select('*')
    .order('total_earnings_sol', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch artist leaderboard', details: error.message });
  }

  const solPrice = await getCurrentSolPrice();

  const leaderboard = (artists || []).map((artist: Record<string, unknown>) => ({
    artistName: artist.artist_name,
    walletAddress: artist.wallet_address,
    imageUrl: artist.image_url,
    twitterHandle: artist.twitter_handle,
    musicLink: artist.music_link,
    totalEarningsSol: artist.total_earnings_sol,
    totalEarningsUsd: (artist.total_earnings_sol as number) * solPrice,
    spotifyStreamEquivalents: artist.spotify_stream_equivalents,
    battlesParticipated: artist.battles_participated,
    wins: artist.wins,
    losses: artist.losses,
    winRate: artist.win_rate,
    totalVolumeGenerated: artist.total_volume_generated,
    avgVolumePerBattle: artist.avg_volume_per_battle,
  }));

  const totalPayouts = leaderboard.reduce((sum, artist) => sum + (artist.totalEarningsSol as number || 0), 0);
  const totalStreams = leaderboard.reduce((sum, artist) => sum + (artist.spotifyStreamEquivalents as number || 0), 0);

  return res.status(200).json({
    success: true,
    data: leaderboard,
    meta: {
      total: leaderboard.length,
      limit,
      offset,
      solPrice,
      totalPayouts,
      totalStreams,
      lastUpdated: new Date().toISOString()
    },
  });
}

async function handleAllArtists(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient
) {
  const search = (req.query.search as string) || '';
  const sortBy = (req.query.sortBy as string) || 'battles';

  let orderField = 'battles_participated';
  let orderAscending = false;

  switch (sortBy) {
    case 'wins':
      orderField = 'wins';
      break;
    case 'earnings':
      orderField = 'total_earnings_sol';
      break;
    case 'name':
      orderField = 'artist_name';
      orderAscending = true;
      break;
  }

  let query = supabase
    .from('artist_leaderboard')
    .select('*')
    .order(orderField, { ascending: orderAscending });

  if (search) {
    query = query.ilike('artist_name', `%${search}%`);
  }

  const { data: artists, error } = await query;

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch artists directory', details: error.message });
  }

  const artistsDirectory = (artists || []).map((artist: Record<string, unknown>) => ({
    artistName: artist.artist_name,
    walletAddress: artist.wallet_address,
    imageUrl: artist.image_url,
    twitterHandle: artist.twitter_handle,
    musicLink: artist.music_link,
    battlesParticipated: artist.battles_participated,
    wins: artist.wins,
    losses: artist.losses,
    winRate: artist.win_rate,
    totalEarnings: artist.total_earnings_sol,
    lastActive: artist.updated_at,
  }));

  return res.status(200).json({
    success: true,
    data: artistsDirectory,
    meta: {
      total: artistsDirectory.length,
      sortBy,
      search: search || null,
      lastUpdated: new Date().toISOString()
    },
  });
}

async function handleArtistProfile(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
  walletAddress: string
) {
  if (!walletAddress || walletAddress.trim() === '') {
    return res.status(400).json({
      error: 'Wallet address is required',
      usage: 'GET /api/wavewarz/artists/:wallet'
    });
  }

  const { data: artist, error: artistError } = await supabase
    .from('artist_leaderboard')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (artistError) {
    const errorCode = (artistError as { code?: string }).code;
    const errorMessage = (artistError as { message?: string }).message;
    if (errorCode === 'PGRST116') {
      return res.status(404).json({ error: 'Artist not found', code: 'NOT_FOUND' });
    }
    return res.status(500).json({ error: 'Failed to fetch artist', details: errorMessage || 'Unknown error' });
  }

  if (!artist) {
    return res.status(404).json({ error: 'Artist not found', code: 'NOT_FOUND' });
  }

  const artistData = artist as Record<string, unknown>;

  // Query battles separately to avoid SQL injection risks with .or()
  const [{ data: battlesAsArtist1 }, { data: battlesAsArtist2 }] = await Promise.all([
    supabase
      .from('battles')
      .select('*')
      .eq('artist1_wallet', walletAddress)
      .order('created_at', { ascending: false }),
    supabase
      .from('battles')
      .select('*')
      .eq('artist2_wallet', walletAddress)
      .order('created_at', { ascending: false })
  ]);

  const battles = [...(battlesAsArtist1 || []), ...(battlesAsArtist2 || [])];

  const battleHistory = battles.map((battle: Record<string, unknown>) => {
    const isArtist1 = battle.artist1_wallet === walletAddress;
    const winnerArtistA = battle.winner_artist_a as boolean;
    const winnerDecided = battle.winner_decided as boolean;

    return {
      battleId: battle.battle_id,
      opponent: isArtist1 ? battle.artist2_name : battle.artist1_name,
      date: battle.created_at,
      outcome: winnerDecided
        ? ((winnerArtistA && isArtist1) || (!winnerArtistA && !isArtist1) ? 'WIN' : 'LOSS')
        : 'PENDING',
      finalPool: isArtist1 ? battle.artist1_pool : battle.artist2_pool,
      opponentPool: isArtist1 ? battle.artist2_pool : battle.artist1_pool,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      artistName: artistData.artist_name,
      walletAddress: artistData.wallet_address,
      imageUrl: artistData.image_url,
      twitterHandle: artistData.twitter_handle,
      musicLink: artistData.music_link,
      stats: {
        totalEarningsSol: artistData.total_earnings_sol,
        spotifyStreamEquivalents: artistData.spotify_stream_equivalents,
        battlesParticipated: artistData.battles_participated,
        wins: artistData.wins,
        losses: artistData.losses,
        winRate: artistData.win_rate,
        totalVolumeGenerated: artistData.total_volume_generated,
        avgVolumePerBattle: artistData.avg_volume_per_battle,
      },
      battleHistory: battleHistory.slice(0, 20),
    },
    meta: { lastUpdated: new Date().toISOString() },
  });
}

async function handleTraderLeaderboard(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient
) {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const sortBy = (req.query.sortBy as string) || 'net_pnl';

  const validSortFields = ['net_pnl', 'roi', 'total_payout', 'win_rate'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'net_pnl';

  const { data: traders, error } = await supabase
    .from('trader_leaderboard')
    .select('*')
    .order(sortField, { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch trader leaderboard', details: error.message });
  }

  const leaderboard = (traders || []).map((trader: Record<string, unknown>, index: number) => ({
    rank: offset + index + 1,
    walletAddress: trader.wallet_address,
    totalInvested: trader.total_invested,
    totalPayout: trader.total_payout,
    netPnL: trader.net_pnl,
    roi: trader.roi,
    battlesParticipated: trader.battles_participated,
    wins: trader.wins,
    losses: trader.losses,
    winRate: (trader.battles_participated as number) > 0
      ? ((trader.wins as number) / (trader.battles_participated as number)) * 100
      : 0,
    lastActive: trader.updated_at,
  }));

  return res.status(200).json({
    success: true,
    data: leaderboard,
    meta: {
      total: leaderboard.length,
      limit,
      offset,
      sortBy: sortField,
      lastUpdated: new Date().toISOString()
    },
  });
}

async function handleTraderProfile(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
  walletAddress: string
) {
  if (!walletAddress || walletAddress.trim() === '') {
    return res.status(400).json({
      error: 'Wallet address is required',
      usage: 'GET /api/wavewarz/traders/:wallet'
    });
  }

  const { data: trader, error: traderError } = await supabase
    .from('trader_leaderboard')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (traderError) {
    const errorCode = (traderError as { code?: string }).code;
    const errorMessage = (traderError as { message?: string }).message;
    if (errorCode === 'PGRST116') {
      return res.status(404).json({ error: 'Trader not found', code: 'NOT_FOUND' });
    }
    return res.status(500).json({ error: 'Failed to fetch trader', details: errorMessage || 'Unknown error' });
  }

  if (!trader) {
    return res.status(404).json({ error: 'Trader not found', code: 'NOT_FOUND' });
  }

  const traderData = trader as Record<string, unknown>;

  return res.status(200).json({
    success: true,
    data: {
      walletAddress: traderData.wallet_address,
      stats: {
        totalInvested: traderData.total_invested,
        totalPayout: traderData.total_payout,
        netPnL: traderData.net_pnl,
        roi: traderData.roi,
        battlesParticipated: traderData.battles_participated,
        wins: traderData.wins,
        losses: traderData.losses,
        winRate: (traderData.battles_participated as number) > 0
          ? ((traderData.wins as number) / (traderData.battles_participated as number)) * 100
          : 0,
      },
    },
    meta: { lastUpdated: new Date().toISOString() },
  });
}

async function handleTopBattles(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient
) {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const sortBy = (req.query.sortBy as string) || 'volume';

  const { data: battles, error } = await supabase
    .from('battles')
    .select('*')
    .eq('winner_decided', true)
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch top battles', details: error.message });
  }

  const enrichedBattles = (battles || []).map((battle: Record<string, unknown>) => {
    const pool1 = (battle.artist1_pool as number) || 0;
    const pool2 = (battle.artist2_pool as number) || 0;
    const totalTVL = pool1 + pool2;
    const winnerArtistA = battle.winner_artist_a as boolean;
    const winner = winnerArtistA ? battle.artist1_name : battle.artist2_name;
    const winnerPool = winnerArtistA ? pool1 : pool2;
    const loserPool = winnerArtistA ? pool2 : pool1;

    return {
      battleId: battle.battle_id,
      imageUrl: battle.image_url,
      createdAt: battle.created_at,
      artist1: {
        name: battle.artist1_name,
        wallet: battle.artist1_wallet,
        finalPool: pool1,
        twitter: battle.artist1_twitter
      },
      artist2: {
        name: battle.artist2_name,
        wallet: battle.artist2_wallet,
        finalPool: pool2,
        twitter: battle.artist2_twitter
      },
      winner,
      winMargin: winnerPool - loserPool,
      totalTVL,
      estimatedVolume: totalTVL * VOLUME_ESTIMATION_MULTIPLIER,
    };
  });

  // Sort by total TVL (volume) by default
  if (sortBy === 'volume') {
    enrichedBattles.sort((a, b) => b.totalTVL - a.totalTVL);
  }

  const topBattles = enrichedBattles.slice(0, limit).map((battle, index) => ({
    rank: index + 1,
    ...battle
  }));

  return res.status(200).json({
    success: true,
    data: topBattles,
    meta: {
      total: topBattles.length,
      limit,
      sortBy,
      lastUpdated: new Date().toISOString()
    },
  });
}

async function handleBattleDetails(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
  battleId: string
) {
  if (!battleId || battleId.trim() === '') {
    return res.status(400).json({
      error: 'Battle ID is required',
      usage: 'GET /api/wavewarz/battles/:battleId'
    });
  }

  // Try to find by battle_id (numeric ID) or id (UUID)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(battleId);

  let query = supabase.from('battles').select('*');
  if (isUUID) {
    query = query.eq('id', battleId);
  } else {
    query = query.eq('battle_id', battleId);
  }

  const { data: battle, error: battleError } = await query.single();

  if (battleError) {
    const errorCode = (battleError as { code?: string }).code;
    const errorMessage = (battleError as { message?: string }).message;
    if (errorCode === 'PGRST116') {
      return res.status(404).json({ error: 'Battle not found', code: 'NOT_FOUND' });
    }
    return res.status(500).json({ error: 'Failed to fetch battle', details: errorMessage || 'Unknown error' });
  }

  if (!battle) {
    return res.status(404).json({ error: 'Battle not found', code: 'NOT_FOUND' });
  }

  const battleData = battle as Record<string, unknown>;
  const pool1 = (battleData.artist1_pool as number) || 0;
  const pool2 = (battleData.artist2_pool as number) || 0;
  const winnerDecided = battleData.winner_decided as boolean;
  const winnerArtistA = battleData.winner_artist_a as boolean;
  const winner = winnerDecided ? (winnerArtistA ? battleData.artist1_name : battleData.artist2_name) : 'Pending';

  return res.status(200).json({
    success: true,
    data: {
      battleId: battleData.battle_id,
      imageUrl: battleData.image_url,
      createdAt: battleData.created_at,
      status: winnerDecided ? 'completed' : 'active',
      artist1: {
        name: battleData.artist1_name,
        wallet: battleData.artist1_wallet,
        finalPool: pool1,
        twitter: battleData.artist1_twitter
      },
      artist2: {
        name: battleData.artist2_name,
        wallet: battleData.artist2_wallet,
        finalPool: pool2,
        twitter: battleData.artist2_twitter
      },
      winner,
      totalTVL: pool1 + pool2,
    },
    meta: { lastUpdated: new Date().toISOString() },
  });
}

async function handlePlatformStats(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient
) {
  const { data: allBattles } = await supabase.from('battles').select('*');
  const { data: artists } = await supabase.from('artist_leaderboard').select('total_earnings_sol, spotify_stream_equivalents');
  const { data: traders } = await supabase.from('trader_leaderboard').select('wallet_address');

  const totalBattles = allBattles?.length || 0;
  const completedBattles = allBattles?.filter((b: Record<string, unknown>) => b.winner_decided).length || 0;
  const totalArtistPayouts = artists?.reduce((sum: number, a: Record<string, unknown>) => sum + ((a.total_earnings_sol as number) || 0), 0) || 0;
  const solPrice = await getCurrentSolPrice();

  return res.status(200).json({
    success: true,
    data: {
      totalBattles,
      completedBattles,
      totalArtistPayouts,
      uniqueTraders: traders?.length || 0,
      uniqueArtists: artists?.length || 0,
      solPrice,
    },
    meta: { lastUpdated: new Date().toISOString() },
  });
}

async function getCurrentSolPrice(): Promise<number> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const data = await response.json();
    return data.solana?.usd || DEFAULT_SOL_PRICE_USD;
  } catch {
    // Return default price on error
    return DEFAULT_SOL_PRICE_USD;
  }
}
