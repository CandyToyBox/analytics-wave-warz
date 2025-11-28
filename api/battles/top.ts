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

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const sortBy = (req.query.sortBy as string) || 'total_volume';
    const status = req.query.status as string; // 'active', 'completed', or undefined for all

    // Build base query
    let query = supabase
      .from('battles')
      .select('*');

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Fetch battles
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Fetch extra for post-processing

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch battles',
        details: error.message 
      });
    }

    // Transform and calculate total volume for each battle
    let battles = (data || []).map((battle: Record<string, unknown>) => {
      const pool1 = (battle.artist1_pool as number) || 0;
      const pool2 = (battle.artist2_pool as number) || 0;
      const volumeA = (battle.total_volume_a as number) || pool1;
      const volumeB = (battle.total_volume_b as number) || pool2;
      
      return {
        id: battle.id,
        battleId: battle.battle_id,
        createdAt: battle.created_at,
        status: battle.status,
        artist1: {
          name: battle.artist1_name,
          wallet: battle.artist1_wallet,
          pool: pool1,
          twitter: battle.artist1_twitter,
          musicLink: battle.artist1_music_link
        },
        artist2: {
          name: battle.artist2_name,
          wallet: battle.artist2_wallet,
          pool: pool2,
          twitter: battle.artist2_twitter,
          musicLink: battle.artist2_music_link
        },
        totalVolume: volumeA + volumeB,
        totalPool: pool1 + pool2,
        imageUrl: battle.image_url,
        streamLink: battle.stream_link,
        battleDuration: battle.battle_duration,
        winnerDecided: battle.winner_decided,
        tradeCount: battle.trade_count,
        uniqueTraders: battle.unique_traders
      };
    });

    // Sort by the requested field
    if (sortBy === 'total_volume') {
      battles.sort((a, b) => b.totalVolume - a.totalVolume);
    } else if (sortBy === 'total_pool') {
      battles.sort((a, b) => b.totalPool - a.totalPool);
    } else if (sortBy === 'trade_count') {
      battles.sort((a, b) => ((b.tradeCount as number) || 0) - ((a.tradeCount as number) || 0));
    }

    // Apply limit after sorting
    battles = battles.slice(0, limit);

    return res.status(200).json({
      success: true,
      data: battles,
      count: battles.length
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
