import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { wallet } = req.query;

  if (!wallet || typeof wallet !== 'string' || wallet.trim() === '') {
    return res.status(400).json({ 
      error: 'Wallet address is required',
      usage: 'GET /api/artists/[wallet]'
    });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // First, try to get from artist_leaderboard table
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('artist_leaderboard')
      .select('*')
      .eq('wallet_address', wallet)
      .single();

    if (leaderboardData && !leaderboardError) {
      return res.status(200).json({
        success: true,
        artist: {
          name: leaderboardData.artist_name,
          wallet: leaderboardData.wallet_address,
          imageUrl: leaderboardData.image_url,
          twitter: leaderboardData.twitter_handle,
          musicLink: leaderboardData.music_link,
          stats: {
            totalEarningsSol: leaderboardData.total_earnings_sol,
            spotifyStreamEquivalents: leaderboardData.spotify_stream_equivalents,
            battlesParticipated: leaderboardData.battles_participated,
            wins: leaderboardData.wins,
            losses: leaderboardData.losses,
            winRate: leaderboardData.win_rate,
            totalVolumeGenerated: leaderboardData.total_volume_generated,
            avgVolumePerBattle: leaderboardData.avg_volume_per_battle
          },
          updatedAt: leaderboardData.updated_at
        }
      });
    }

    // Fallback: Get artist info from battles table
    const { data: battlesAsArtist1, error: error1 } = await supabase
      .from('battles')
      .select('*')
      .eq('artist1_wallet', wallet)
      .order('created_at', { ascending: false });

    const { data: battlesAsArtist2, error: error2 } = await supabase
      .from('battles')
      .select('*')
      .eq('artist2_wallet', wallet)
      .order('created_at', { ascending: false });

    if (error1 || error2) {
      console.error('Supabase error:', error1 || error2);
      return res.status(500).json({ 
        error: 'Failed to fetch artist data',
        details: (error1 || error2)?.message 
      });
    }

    const allBattles = [...(battlesAsArtist1 || []), ...(battlesAsArtist2 || [])];

    if (allBattles.length === 0) {
      return res.status(404).json({ 
        error: 'Artist not found',
        wallet 
      });
    }

    // Extract artist info from first battle
    const firstBattle = battlesAsArtist1?.[0] || battlesAsArtist2?.[0];
    const isArtist1 = battlesAsArtist1?.[0] !== undefined;
    
    const artistInfo = {
      name: isArtist1 ? firstBattle.artist1_name : firstBattle.artist2_name,
      wallet,
      imageUrl: firstBattle.image_url,
      twitter: isArtist1 ? firstBattle.artist1_twitter : firstBattle.artist2_twitter,
      musicLink: isArtist1 ? firstBattle.artist1_music_link : firstBattle.artist2_music_link
    };

    // Calculate basic stats from battles
    const battlesParticipated = allBattles.length;
    let totalVolume = 0;
    let wins = 0;

    allBattles.forEach((battle: Record<string, unknown>) => {
      const isA1 = battle.artist1_wallet === wallet;
      const pool = isA1 ? (battle.artist1_pool as number) : (battle.artist2_pool as number);
      const otherPool = isA1 ? (battle.artist2_pool as number) : (battle.artist1_pool as number);
      
      totalVolume += (pool || 0);
      if ((pool || 0) > (otherPool || 0)) {
        wins++;
      }
    });

    // Get recent battles
    const recentBattles = allBattles
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((battle: Record<string, unknown>) => ({
        battleId: battle.battle_id,
        opponent: battle.artist1_wallet === wallet ? battle.artist2_name : battle.artist1_name,
        date: battle.created_at,
        status: battle.status,
        imageUrl: battle.image_url
      }));

    return res.status(200).json({
      success: true,
      artist: {
        ...artistInfo,
        stats: {
          battlesParticipated,
          wins,
          losses: battlesParticipated - wins,
          winRate: battlesParticipated > 0 ? (wins / battlesParticipated) * 100 : 0,
          totalVolumeGenerated: totalVolume
        },
        recentBattles
      }
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
