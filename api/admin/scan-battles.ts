import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchBattlesFromSupabase } from '../../services/supabaseClient';
import { fetchBattleOnChain } from '../../services/solanaService';

/**
 * Admin endpoint to scan battles and populate statistics
 * 
 * This endpoint triggers the blockchain scanning process for battles
 * that haven't been scanned yet or need a refresh. It's designed to
 * pre-populate statistics that would normally only be calculated when
 * a user views an individual battle.
 * 
 * Usage:
 *   POST /api/admin/scan-battles?limit=50
 *   Header: Authorization: Bearer <ADMIN_SECRET>
 * 
 * Query Parameters:
 *   - limit: Number of battles to scan (default: 50, max: 200)
 *   - forceRefresh: Force re-scan even if recently scanned (default: false)
 *   - onlyQuickBattles: Only scan Quick Battles (default: false)
 * 
 * Response:
 *   {
 *     scanned: number,
 *     skipped: number,
 *     results: Array<{battleId: string, status: 'success' | 'error', error?: string}>
 *   }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Authentication check
  const authToken = req.headers.authorization;
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret) {
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'ADMIN_SECRET not configured' 
    });
  }

  // Use constant-time comparison to prevent timing attacks
  const expectedToken = `Bearer ${adminSecret}`;
  if (!authToken || authToken.length !== expectedToken.length) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Constant-time comparison
  let isValid = true;
  for (let i = 0; i < expectedToken.length; i++) {
    if (authToken[i] !== expectedToken[i]) {
      isValid = false;
    }
  }
  
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const forceRefresh = req.query.forceRefresh === 'true';
    const onlyQuickBattles = req.query.onlyQuickBattles === 'true';

    console.log(`🔍 Starting battle scan: limit=${limit}, forceRefresh=${forceRefresh}, onlyQuickBattles=${onlyQuickBattles}`);

    // Fetch all battles from database
    const allBattles = await fetchBattlesFromSupabase();
    
    if (!allBattles || allBattles.length === 0) {
      return res.status(200).json({
        scanned: 0,
        skipped: 0,
        results: [],
        message: 'No battles found in database'
      });
    }

    console.log(`📊 Found ${allBattles.length} total battles`);

    // Filter battles based on criteria
    let battlesToBatch = allBattles;
    
    if (onlyQuickBattles) {
      battlesToBatch = battlesToBatch.filter(b => b.isQuickBattle);
      console.log(`⚡ Filtered to ${battlesToBatch.length} Quick Battles`);
    }

    // Determine which battles need scanning
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const toScan = battlesToBatch
      .filter(b => {
        if (forceRefresh) return true;
        
        // Skip if recently scanned (within last 24 hours)
        if (b.lastScannedAt) {
          const timeSinceLastScan = Date.now() - new Date(b.lastScannedAt).getTime();
          return timeSinceLastScan > ONE_DAY_MS;
        }
        
        // Include if never scanned
        return true;
      })
      .slice(0, limit);

    const skipped = battlesToBatch.length - toScan.length;
    console.log(`📋 Scanning ${toScan.length} battles (${skipped} already up-to-date)`);

    if (toScan.length === 0) {
      return res.status(200).json({
        scanned: 0,
        skipped,
        results: [],
        message: 'All battles are already up-to-date'
      });
    }

    // Scan each battle
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < toScan.length; i++) {
      const battle = toScan[i];
      
      try {
        console.log(`[${i + 1}/${toScan.length}] Scanning battle ${battle.battleId}...`);
        
        // This will fetch from blockchain, calculate stats, and update database
        await fetchBattleOnChain(battle, true);
        
        results.push({ 
          battleId: battle.battleId, 
          status: 'success' as const
        });
        successCount++;
        
        console.log(`✅ [${i + 1}/${toScan.length}] Success: ${battle.battleId}`);
      } catch (error: any) {
        results.push({ 
          battleId: battle.battleId, 
          status: 'error' as const, 
          error: error.message || 'Unknown error' 
        });
        errorCount++;
        
        console.error(`❌ [${i + 1}/${toScan.length}] Error: ${battle.battleId}:`, error.message);
      }
      
      // Rate limit: 1 request per second to avoid overwhelming RPC
      if (i < toScan.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✨ Scan complete: ${successCount} success, ${errorCount} errors`);

    return res.status(200).json({
      scanned: toScan.length,
      skipped,
      success: successCount,
      errors: errorCount,
      results,
      message: `Scanned ${successCount} battles successfully`
    });

  } catch (error: any) {
    console.error('❌ Scan endpoint error:', error);
    
    // Only expose stack trace in development
    const isDev = process.env.NODE_ENV === 'development';
    
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message,
      ...(isDev && { details: error.stack })
    });
  }
}
