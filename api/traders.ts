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

    const leaderboard = traders.map((trader: any, index: number) => ({
      rank: offset + index + 1,
      walletAddress: trader.wallet_address,
      totalInvested: trader.total_invested,
      totalPayout: trader.total_payout,
      netPnL: trader.net_pnl,
      roi: trader.roi,
      battlesParticipated: trader.battles_participated,
      wins: trader.wins,
      losses: trader.losses,
      winRate: trader.win_rate ?? (trader.battles_participated > 0 ? (trader.wins / trader.battles_participated) * 100 : 0),
      lastActive: trader.updated_at,
    }));

    return res.status(200).json({
      success: true,
      data: leaderboard,
      meta: { total: leaderboard.length, limit, offset, sortBy: sortField, lastUpdated: new Date().toISOString() },
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
