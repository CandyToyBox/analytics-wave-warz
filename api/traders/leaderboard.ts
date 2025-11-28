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
    
    // Query parameters for pagination and sorting
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as string) || 'net_pnl';
    const order = (req.query.order as string) === 'asc';

    const { data, error, count } = await supabase
      .from('trader_leaderboard')
      .select('*', { count: 'exact' })
      .order(sortBy, { ascending: order })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch trader leaderboard',
        details: error.message 
      });
    }

    // Transform data to match frontend types
    const leaderboard = (data || []).map((row: Record<string, unknown>) => ({
      walletAddress: row.wallet_address,
      totalInvested: row.total_invested,
      totalPayout: row.total_payout,
      netPnL: row.net_pnl,
      roi: row.roi,
      battlesParticipated: row.battles_participated,
      wins: row.wins,
      losses: row.losses,
      winRate: row.battles_participated 
        ? ((row.wins as number) / (row.battles_participated as number)) * 100 
        : 0,
      updatedAt: row.updated_at
    }));

    return res.status(200).json({
      success: true,
      data: leaderboard,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0)
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
