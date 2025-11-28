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
      usage: 'GET /api/traders/[wallet]'
    });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // First, check trader_leaderboard for quick stats
    const { data: leaderboardData } = await supabase
      .from('trader_leaderboard')
      .select('*')
      .eq('wallet_address', wallet)
      .single();

    // Then check trader_snapshots for detailed history
    const { data: snapshotData } = await supabase
      .from('trader_snapshots')
      .select('profile_data, updated_at')
      .eq('wallet_address', wallet)
      .single();

    if (!leaderboardData && !snapshotData) {
      return res.status(404).json({ 
        error: 'Trader not found',
        wallet,
        hint: 'This wallet may not have participated in any WaveWarz battles yet'
      });
    }

    // Build response from available data
    const profile = snapshotData?.profile_data as Record<string, unknown> | null;
    
    const response = {
      success: true,
      trader: {
        walletAddress: wallet,
        stats: {
          totalInvested: leaderboardData?.total_invested ?? profile?.totalInvested ?? 0,
          totalPayout: leaderboardData?.total_payout ?? profile?.totalPayout ?? 0,
          netPnL: leaderboardData?.net_pnl ?? profile?.netPnL ?? 0,
          roi: leaderboardData?.roi ?? 0,
          battlesParticipated: leaderboardData?.battles_participated ?? profile?.battlesParticipated ?? 0,
          wins: leaderboardData?.wins ?? profile?.wins ?? 0,
          losses: leaderboardData?.losses ?? profile?.losses ?? 0,
          winRate: profile?.winRate ?? (
            leaderboardData?.battles_participated 
              ? (leaderboardData.wins / leaderboardData.battles_participated) * 100 
              : 0
          ),
          favoriteArtist: profile?.favoriteArtist
        },
        history: profile?.history || [],
        lastUpdated: snapshotData?.updated_at || leaderboardData?.updated_at
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
