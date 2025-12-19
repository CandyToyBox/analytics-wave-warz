// ============================================================================
// WAVEWARZ ANALYTICS - BATTLE WEBHOOK HANDLER (OPTIMIZED)
// ============================================================================
// Handles INSERT and UPDATE webhooks from production database
// CRITICAL: Skips updates for completed battles to prevent database overload

import { createClient } from '@supabase/supabase-js';

// Rate limiter for active battles
const updateCache = new Map<string, number>();
const parsedRateLimit = process.env.BATTLE_RATE_LIMIT_MS !== undefined ? Number(process.env.BATTLE_RATE_LIMIT_MS) : NaN;
const RATE_LIMIT_MS = Number.isFinite(parsedRateLimit) ? parsedRateLimit : 30000; // 30 seconds between updates for same battle
const MAX_CACHE_SIZE = 1000;

// Initialize Supabase client with service role
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables (VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey
);

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const payload = await request.json();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 BATTLE WEBHOOK HANDLER STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 Webhook Details:');
    console.log(`Type: ${payload.type}`);
    console.log(`Table: ${payload.table}`);
    
    // Handle INSERT (new battle created)
    if (payload.type === 'INSERT') {
      const result = await handleBattleInsert(payload);
      const duration = Date.now() - startTime;
      console.log(`⏱️ Webhook completed in ${duration}ms`);
      return Response.json(result);
    }
    
    // Handle UPDATE (trading stats updated)
    if (payload.type === 'UPDATE') {
      const result = await handleBattleUpdate(payload);
      const duration = Date.now() - startTime;
      console.log(`⏱️ Webhook completed in ${duration}ms`);
      return Response.json(result);
    }
    
    console.log(`⚠️ Unknown webhook type: ${payload.type}`);
    return Response.json({ success: false, error: 'Unknown webhook type' });
    
  } catch (error: any) {
    console.error('❌ Webhook handler error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// INSERT HANDLER (New Battle Created)
// ============================================================================

async function handleBattleInsert(payload: any) {
  const battleData = payload.record;
  const battleId = battleData.battle_id;
  
  console.log(`✨ NEW BATTLE INSERT: ${battleId}`);
  console.log(`Artists: ${battleData.artist1_name} vs ${battleData.artist2_name}`);
  console.log(`Duration: ${battleData.battle_duration}s (${Math.round(battleData.battle_duration / 60)} min)`);
  
  try {
    // Insert new battle into analytics database
    const { error } = await supabase
      .from('battles')
      .insert({
        battle_id: battleData.battle_id,
        status: battleData.status,
        artist1_name: battleData.artist1_name,
        artist2_name: battleData.artist2_name,
        artist1_wallet: battleData.artist1_wallet,
        artist2_wallet: battleData.artist2_wallet,
        wavewarz_wallet: battleData.wavewarz_wallet,
        artist1_music_link: battleData.artist1_music_link,
        artist2_music_link: battleData.artist2_music_link,
        image_url: battleData.image_url,
        artist1_pool: battleData.artist1_pool || 0,
        artist2_pool: battleData.artist2_pool || 0,
        artist1_supply: battleData.artist1_supply || 0,
        artist2_supply: battleData.artist2_supply || 0,
        battle_duration: battleData.battle_duration,
        winner_decided: battleData.winner_decided || false,
        winner_artist_a: battleData.winner_artist_a,
        artist1_twitter: battleData.artist1_twitter,
        artist2_twitter: battleData.artist2_twitter,
        stream_link: battleData.stream_link,
        creator_wallet: battleData.creator_wallet,
        is_community_battle: battleData.is_community_battle || false,
        created_at: battleData.created_at,
      });

    if (error) {
      console.error('❌ INSERT failed:', error);
      return { success: false, error };
    }
    
    console.log(`✅ Battle ${battleId} inserted successfully`);
    
    // Refresh materialized view to include new battle
    try {
      await supabase.rpc('refresh_battle_stats');
      console.log('✅ Materialized view refreshed');
    } catch (refreshError) {
      console.warn('⚠️ Failed to refresh materialized view:', refreshError);
    }
    
    return { success: true, action: 'inserted', battleId };
    
  } catch (error: any) {
    console.error('❌ INSERT handler error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// UPDATE HANDLER (Trading Stats Updated)
// ============================================================================

async function handleBattleUpdate(payload: any) {
  const battleData = payload.record;
  const battleId = battleData.battle_id;
  
  console.log(`🔄 Battle UPDATE detected: ${battleId}`);
  console.log(`📊 Trading Stats:`);
  console.log(`Pool A: ${battleData.artist1_pool || 0}`);
  console.log(`Pool B: ${battleData.artist2_pool || 0}`);
  console.log(`Winner Decided: ${battleData.winner_decided || false}`);
  
  try {
    // ✅ CRITICAL CHECK: Is this battle already completed in our database?
    const { data: existingBattle, error: fetchError } = await supabase
      .from('battles')
      .select('winner_decided, created_at, battle_duration')
      .eq('battle_id', battleId)
      .single();
    
    if (fetchError) {
      console.error('❌ Failed to fetch existing battle:', fetchError);
      return { success: false, error: fetchError };
    }
    
    // If battle is already marked as completed, skip this update
    if (existingBattle && existingBattle.winner_decided === true) {
      console.log(`✅ Battle ${battleId} already completed - skipping update`);
      return { 
        success: true, 
        action: 'skipped', 
        reason: 'Battle already finalized',
        battleId 
      };
    }
    
    // Check if battle is past its duration (automatically completed)
    if (existingBattle) {
      const createdAt = new Date(existingBattle.created_at).getTime();
      const now = Date.now();
      const durationMs = existingBattle.battle_duration * 1000;
      const timeSinceCreation = now - createdAt;
      
      if (timeSinceCreation > durationMs && !battleData.winner_decided) {
        console.log(`⏰ Battle ${battleId} is past duration (${Math.round(timeSinceCreation / 1000 / 60)} min) - treating as completed`);
        // Don't skip, but mark it as completed in this update
      }
    }
    
    // If incoming data shows battle just completed, this is the FINAL update
    if (battleData.winner_decided === true) {
      console.log(`🏆 FINAL UPDATE: Battle ${battleId} completed!`);
      console.log(`Winner: ${battleData.winner_artist_a ? 'Artist A' : 'Artist B'}`);
      console.log(`Final Pool A: ${battleData.artist1_pool}`);
      console.log(`Final Pool B: ${battleData.artist2_pool}`);
    } else {
      // ✅ RATE LIMITING: For active battles, max 1 update per 30 seconds
      const lastUpdate = updateCache.get(battleId);
      const now = Date.now();
      
      if (lastUpdate && (now - lastUpdate) < RATE_LIMIT_MS) {
        const timeSinceUpdate = Math.round((now - lastUpdate) / 1000);
        console.log(`⏸️ Rate limited: Battle ${battleId} - ${timeSinceUpdate}s since last update (limit: 30s)`);
        return { 
          success: true, 
          action: 'rate_limited',
          timeSinceUpdate,
          battleId 
        };
      }
      
      // Record this update timestamp
      updateCache.set(battleId, now);
      
      // Clean up old entries to prevent memory leak
      if (updateCache.size > MAX_CACHE_SIZE) {
        const cutoff = now - RATE_LIMIT_MS;
        for (const [id, time] of updateCache.entries()) {
          if (time < cutoff) updateCache.delete(id);
        }
      }
    }
    
    // Perform the update
    const { error: updateError } = await supabase
      .from('battles')
      .update({
        artist1_pool: battleData.artist1_pool,
        artist2_pool: battleData.artist2_pool,
        artist1_supply: battleData.artist1_supply,
        artist2_supply: battleData.artist2_supply,
        winner_decided: battleData.winner_decided,
        winner_artist_a: battleData.winner_artist_a,
        status: battleData.status,
        updated_at: new Date().toISOString(),
      })
      .eq('battle_id', battleId);

    if (updateError) {
      console.error('❌ UPDATE failed:', updateError);
      return { success: false, error: updateError };
    }

    console.log(`✅ Battle ${battleId} updated successfully`);
    
    // Refresh materialized view if battle just completed
    if (battleData.winner_decided === true) {
      try {
        await supabase.rpc('refresh_battle_stats');
        console.log('✅ Materialized view refreshed (battle completed)');
      } catch (refreshError) {
        console.warn('⚠️ Failed to refresh materialized view:', refreshError);
      }
    }
    
    return { 
      success: true, 
      action: 'updated',
      completed: battleData.winner_decided === true,
      battleId 
    };
    
  } catch (error: any) {
    console.error('❌ UPDATE handler error:', error);
    return { success: false, error: error.message };
  }
}
