// ============================================================================
// UPDATE BATTLE VOLUMES - Backend endpoint with service_role access
// ============================================================================
import { supabaseAdmin } from './utils/supabase-admin';

export async function POST(request: Request) {
  try {
    // 🔒 SECURITY: Verify API key to prevent unauthorized access
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.BATTLE_UPDATE_API_KEY;

    if (!expectedKey) {
      console.error('❌ [API] BATTLE_UPDATE_API_KEY not configured');
      return Response.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    if (!apiKey || apiKey !== expectedKey) {
      console.warn('⚠️ [API] Unauthorized battle update attempt');
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { battleId, volumeA, volumeB, tradeCount, uniqueTraders, poolA, poolB } = await request.json();

    if (!battleId) {
      return Response.json({ success: false, error: 'battle_id is required' }, { status: 400 });
    }

    console.log(`📊 [API] Updating battle ${battleId} volumes:`, {
      volumeA,
      volumeB,
      poolA,
      poolB,
      tradeCount,
      uniqueTraders
    });

    // Use supabaseAdmin (service_role) to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('battles')
      .update({
        total_volume_a: volumeA,
        total_volume_b: volumeB,
        artist1_pool: poolA,  // Update pool balances for accurate dashboard totals
        artist2_pool: poolB,
        trade_count: tradeCount,
        unique_traders: uniqueTraders,
        last_scanned_at: new Date().toISOString()
      })
      .eq('battle_id', battleId.toString()) // Ensure string type
      .select();

    if (error) {
      console.error(`❌ [API] Failed to update battle ${battleId}:`, error.message);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.warn(`⚠️ [API] No rows updated for battle ${battleId} - not found`);
      return Response.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }

    console.log(`✅ [API] Battle ${battleId} updated successfully`);
    return Response.json({ success: true, updated: data.length });

  } catch (error: any) {
    console.error('❌ [API] Update endpoint error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
