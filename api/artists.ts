import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gshwqoplsxgqbdkssoit.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey!);

async function getCurrentSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana?.usd || 150;
  } catch (error) {
    return 150;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const limit = parseInt(req.query.limit as string) || 10;
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

    const leaderboard = artists.map((artist: any) => ({
      artistName: artist.artist_name,
      walletAddress: artist.wallet_address,
      imageUrl: artist.image_url,
      twitterHandle: artist.twitter_handle,
      musicLink: artist.music_link,
      totalEarningsSol: artist.total_earnings_sol,
      totalEarningsUsd: artist.total_earnings_sol * solPrice,
      spotifyStreamEquivalents: artist.spotify_stream_equivalents,
      battlesParticipated: artist.battles_participated,
      wins: artist.wins,
      losses: artist.losses,
      winRate: artist.win_rate,
      totalVolumeGenerated: artist.total_volume_generated,
      avgVolumePerBattle: artist.avg_volume_per_battle,
    }));

    const totalPayouts = leaderboard.reduce((sum, artist) => sum + artist.totalEarningsSol, 0);
    const totalStreams = leaderboard.reduce((sum, artist) => sum + artist.spotifyStreamEquivalents, 0);

    return res.status(200).json({
      success: true,
      data: leaderboard,
      meta: { total: leaderboard.length, limit, offset, solPrice, totalPayouts, totalStreams, lastUpdated: new Date().toISOString() },
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
