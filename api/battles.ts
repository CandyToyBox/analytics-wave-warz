import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gshwqoplsxgqbdkssoit.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const { data: battles, error } = await supabase
      .from('battles')
      .select('*')
      .eq('winner_decided', true)
      .order('created_at', { ascending: false })
      .limit(limit * 2);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch top battles', details: error.message });
    }

    const enrichedBattles = battles.map((battle: any) => {
      const pool1 = battle.artist1_pool || 0;
      const pool2 = battle.artist2_pool || 0;
      const totalTVL = pool1 + pool2;
      const winner = battle.winner_artist_a ? battle.artist1_name : battle.artist2_name;
      const winnerPool = battle.winner_artist_a ? pool1 : pool2;
      const loserPool = battle.winner_artist_a ? pool2 : pool1;

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
        estimatedVolume: totalTVL * 10,
      };
    });

    const topBattles = enrichedBattles
      .sort((a, b) => b.totalTVL - a.totalTVL)
      .slice(0, limit)
      .map((battle, index) => ({ rank: index + 1, ...battle }));

    return res.status(200).json({
      success: true,
      data: topBattles,
      meta: { total: topBattles.length, limit, lastUpdated: new Date().toISOString() },
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
