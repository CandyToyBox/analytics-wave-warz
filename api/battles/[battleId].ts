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

  const { battleId } = req.query;

  if (!battleId || typeof battleId !== 'string' || battleId.trim() === '') {
    return res.status(400).json({ 
      error: 'Battle ID is required',
      usage: 'GET /api/battles/[battleId]'
    });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to find by battle_id (numeric ID) or id (UUID)
    let query = supabase.from('battles').select('*');
    
    // Check if it's a UUID format or numeric
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(battleId);
    
    if (isUUID) {
      query = query.eq('id', battleId);
    } else {
      query = query.eq('battle_id', battleId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'Battle not found',
          battleId 
        });
      }
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch battle',
        details: error.message 
      });
    }

    if (!data) {
      return res.status(404).json({ 
        error: 'Battle not found',
        battleId 
      });
    }

    // Transform to frontend-friendly format
    const battle = {
      id: data.id,
      battleId: data.battle_id,
      createdAt: data.created_at,
      status: data.status,
      artistA: {
        id: 'A',
        name: data.artist1_name,
        wallet: data.artist1_wallet,
        pool: data.artist1_pool || 0,
        twitter: data.artist1_twitter,
        musicLink: data.artist1_music_link
      },
      artistB: {
        id: 'B',
        name: data.artist2_name,
        wallet: data.artist2_wallet,
        pool: data.artist2_pool || 0,
        twitter: data.artist2_twitter,
        musicLink: data.artist2_music_link
      },
      imageUrl: data.image_url,
      streamLink: data.stream_link,
      battleDuration: data.battle_duration,
      winnerDecided: data.winner_decided,
      isCommunityBattle: data.is_community_battle,
      communityRoundId: data.community_round_id,
      stats: {
        totalVolumeA: data.total_volume_a || 0,
        totalVolumeB: data.total_volume_b || 0,
        tradeCount: data.trade_count || 0,
        uniqueTraders: data.unique_traders || 0,
        lastScannedAt: data.last_scanned_at
      },
      // Calculated fields
      totalPool: (data.artist1_pool || 0) + (data.artist2_pool || 0),
      leader: (data.artist1_pool || 0) > (data.artist2_pool || 0) ? 'A' : 'B',
      leadMargin: Math.abs((data.artist1_pool || 0) - (data.artist2_pool || 0))
    };

    return res.status(200).json({
      success: true,
      battle
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
