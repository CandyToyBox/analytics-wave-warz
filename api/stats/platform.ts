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

    // Fetch all battles for aggregate stats
    const { data: battles, error: battlesError } = await supabase
      .from('battles')
      .select('*');

    if (battlesError) {
      console.error('Supabase error:', battlesError);
      return res.status(500).json({ 
        error: 'Failed to fetch platform statistics',
        details: battlesError.message 
      });
    }

    const battleList = battles || [];

    // Calculate platform-wide statistics
    let totalBattles = battleList.length;
    let activeBattles = 0;
    let completedBattles = 0;
    let totalVolume = 0;
    let totalPool = 0;
    let totalTradeCount = 0;
    const uniqueArtists = new Set<string>();
    let totalUniqueTraders = 0;
    let largestBattleVolume = 0;
    let largestBattleId = '';

    battleList.forEach((battle: Record<string, unknown>) => {
      // Count by status
      if (battle.status === 'active') {
        activeBattles++;
      } else if (battle.status === 'completed' || battle.status === 'ended') {
        completedBattles++;
      }

      // Aggregate volumes
      const volumeA = (battle.total_volume_a as number) || 0;
      const volumeB = (battle.total_volume_b as number) || 0;
      const poolA = (battle.artist1_pool as number) || 0;
      const poolB = (battle.artist2_pool as number) || 0;
      const battleVolume = volumeA + volumeB;
      
      totalVolume += battleVolume;
      totalPool += poolA + poolB;
      totalTradeCount += (battle.trade_count as number) || 0;
      // Sum unique traders from each battle (approximation since we don't have full trader data)
      totalUniqueTraders += (battle.unique_traders as number) || 0;

      // Track largest battle
      if (battleVolume > largestBattleVolume) {
        largestBattleVolume = battleVolume;
        largestBattleId = battle.battle_id as string;
      }

      // Track unique artists
      if (battle.artist1_wallet) uniqueArtists.add(battle.artist1_wallet as string);
      if (battle.artist2_wallet) uniqueArtists.add(battle.artist2_wallet as string);
    });

    // Fetch artist leaderboard count
    const { count: artistCount } = await supabase
      .from('artist_leaderboard')
      .select('*', { count: 'exact', head: true });

    // Fetch trader leaderboard count
    const { count: traderCount } = await supabase
      .from('trader_leaderboard')
      .select('*', { count: 'exact', head: true });

    // Calculate averages
    const avgVolumePerBattle = totalBattles > 0 ? totalVolume / totalBattles : 0;
    const avgPoolPerBattle = totalBattles > 0 ? totalPool / totalBattles : 0;

    // Get recent battles for activity feed
    const recentBattles = battleList
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
        new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      )
      .slice(0, 5)
      .map((b: Record<string, unknown>) => ({
        battleId: b.battle_id,
        artist1: b.artist1_name,
        artist2: b.artist2_name,
        createdAt: b.created_at,
        status: b.status
      }));

    return res.status(200).json({
      success: true,
      platform: {
        // Battle Stats
        totalBattles,
        activeBattles,
        completedBattles,
        
        // Volume Stats
        totalVolume,
        totalPool,
        avgVolumePerBattle,
        avgPoolPerBattle,
        
        // Participation Stats
        totalArtists: artistCount || uniqueArtists.size,
        totalTraders: traderCount || totalUniqueTraders,
        totalTradeCount,
        
        // Records
        largestBattle: {
          battleId: largestBattleId,
          volume: largestBattleVolume
        },
        
        // Recent Activity
        recentBattles,
        
        // Metadata
        lastUpdated: new Date().toISOString()
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
