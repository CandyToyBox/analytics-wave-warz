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
    const { data: allBattles } = await supabase.from('battles').select('*');
    const { data: artists } = await supabase.from('artist_leaderboard').select('total_earnings_sol');
    const { data: traders } = await supabase.from('trader_leaderboard').select('wallet_address');

    const totalBattles = allBattles?.length || 0;
    const completedBattles = allBattles?.filter(b => b.winner_decided).length || 0;
    const totalArtistPayouts = artists?.reduce((sum: number, a: any) => sum + (a.total_earnings_sol || 0), 0) || 0;

    return res.status(200).json({
      success: true,
      data: {
        totalBattles,
        completedBattles,
        totalArtistPayouts,
        uniqueTraders: traders?.length || 0,
        uniqueArtists: artists?.length || 0,
      },
      meta: { lastUpdated: new Date().toISOString() },
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
