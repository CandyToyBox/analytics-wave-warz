// ============================================================================
// SCAN QUICK BATTLES - Populate volumes from Solana blockchain
// ============================================================================
// This endpoint scans all Quick Battles from the blockchain and updates
// their volume data in the database.

import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = process.env.VITE_HELIUS_API_KEY;
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Initialize Supabase client with service role for writing
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    console.log('🔍 Starting Quick Battles blockchain scan...');

    // Get all Quick Battles that need scanning
    const { data: battles, error } = await supabase
      .from('battles')
      .select('battle_id, artist1_wallet, artist2_wallet, created_at, status')
      .eq('is_quick_battle', true)
      .or('total_volume_a.is.null,total_volume_a.eq.0')
      .order('created_at', { ascending: false })
      .limit(50); // Scan 50 at a time to avoid timeouts

    if (error) {
      console.error('❌ Failed to fetch battles:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!battles || battles.length === 0) {
      console.log('✅ No battles need scanning');
      return Response.json({ success: true, scanned: 0, message: 'All battles up to date' });
    }

    console.log(`📊 Found ${battles.length} battles to scan`);

    const connection = new Connection(RPC_URL, 'confirmed');
    const results = [];
    const errors = [];

    // Scan each battle
    for (const battle of battles) {
      try {
        console.log(`  Scanning ${battle.battle_id}...`);

        // Get on-chain data for this battle
        const volumeData = await scanBattleFromChain(connection, battle);

        if (volumeData) {
          // Update database with volumes
          const { error: updateError } = await supabase
            .from('battles')
            .update({
              total_volume_a: volumeData.volumeA,
              total_volume_b: volumeData.volumeB,
              trade_count: volumeData.tradeCount,
              unique_traders: volumeData.uniqueTraders,
              last_scanned_at: new Date().toISOString()
            })
            .eq('battle_id', battle.battle_id);

          if (updateError) {
            console.error(`  ❌ Failed to update ${battle.battle_id}:`, updateError);
            errors.push({ battle_id: battle.battle_id, error: updateError.message });
          } else {
            console.log(`  ✅ Updated ${battle.battle_id}: ${volumeData.volumeA + volumeData.volumeB} SOL`);
            results.push({
              battle_id: battle.battle_id,
              volume: volumeData.volumeA + volumeData.volumeB,
              trades: volumeData.tradeCount
            });
          }
        } else {
          console.log(`  ⏭️ Skipped ${battle.battle_id} (no data yet)`);
        }

        // Rate limiting: wait 500ms between scans
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`  ❌ Error scanning ${battle.battle_id}:`, error.message);
        errors.push({ battle_id: battle.battle_id, error: error.message });
      }
    }

    // Refresh materialized view
    try {
      await supabase.rpc('refresh_quick_battle_leaderboard');
      console.log('✅ Materialized view refreshed');
    } catch (refreshError) {
      console.warn('⚠️ Failed to refresh materialized view:', refreshError);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Scan completed in ${duration}ms`);
    console.log(`   Scanned: ${results.length}, Errors: ${errors.length}`);

    return Response.json({
      success: true,
      scanned: results.length,
      errors: errors.length,
      duration: `${duration}ms`,
      results: results.slice(0, 10), // Return first 10 results
      errorSample: errors.slice(0, 5) // Return first 5 errors if any
    });

  } catch (error: any) {
    console.error('❌ Scan endpoint error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Helper function to scan a single battle from blockchain
async function scanBattleFromChain(connection: Connection, battle: any) {
  try {
    // For Quick Battles, we need to check the battle's on-chain account
    // The exact implementation depends on your program's structure

    // This is a simplified version - you'll need to adapt it to your program's
    // account structure and methods for fetching battle data

    // Example: If battle data is stored in a PDA derived from battle_id
    // You would fetch that account and parse the volume data

    // For now, returning null to indicate no data found
    // You need to implement the actual blockchain fetching logic here

    return null;

    // Expected return format:
    // return {
    //   volumeA: number,
    //   volumeB: number,
    //   tradeCount: number,
    //   uniqueTraders: number
    // };

  } catch (error) {
    console.error(`Error fetching battle ${battle.battle_id} from chain:`, error);
    return null;
  }
}
