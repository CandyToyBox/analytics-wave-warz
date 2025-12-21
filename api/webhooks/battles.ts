// ============================================================================
// WAVEWARZ ANALYTICS - BATTLE WEBHOOK HANDLER (SUPABASE V2 COMPATIBLE)
// ============================================================================
// FIXED: Removed "returning" option (Supabase v2 doesn't support it)
// FIXED: Removed "updated_at" column update (doesn't exist in schema)

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    
    // ✅ TABLE FILTERING: Only process battles table
    // This prevents unnecessary webhook processing for unrelated tables
    if (payload.table !== 'battles') {
      console.log(`⏭️ Skipping webhook trigger for unrelated table: ${payload.table}`);
      return Response.json({ 
        success: true, 
        action: 'skipped_table',
        reason: `Only 'battles' table is processed`,
        table: payload.table 
      });
    }
    
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
    // ✅ SUPABASE V2: No "returning" option, just .insert()
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
    // ✅ No .select() = minimal payload (fastest)

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
  console.log(`Winner Artist A: ${battleData.winner_artist_a ?? 'N/A'}`);
  
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
      }
    }
    
    // If incoming data shows battle just completed, this is the FINAL update
    if (battleData.winner_decided === true) {
      console.log(`🏆 FINAL UPDATE: Battle ${battleId} completed!`);
      console.log(`Winner: ${battleData.winner_artist_a ? 'Artist A' : 'Artist B'}`);
      console.log(`Final Pool A: ${battleData.artist1_pool}`);
      console.log(`Final Pool B: ${battleData.artist2_pool}`);
    } else {
      // ✅ SKIP UPDATES FOR ACTIVE BATTLES
      // Only process INSERT (battle initiation) and final UPDATE (winner_decided=true)
      // This prevents thousands of webhook triggers during active battles
      // Battle data will be fetched on-demand when users view battles
      console.log(`⏭️ Skipping UPDATE for active battle ${battleId} (winner not decided yet)`);
      console.log(`   Reason: Battle data will be fetched on-demand.`);
      console.log(`   Updates only processed when battle ends (winner_decided=true).`);
      console.log(`   Current Pool A: ${battleData.artist1_pool || 0} SOL`);
      console.log(`   Current Pool B: ${battleData.artist2_pool || 0} SOL`);
      return { 
        success: true, 
        action: 'skipped_active_battle',
        reason: 'Battle still active - updates only processed when winner decided',
        battleId,
        poolA: battleData.artist1_pool || 0,
        poolB: battleData.artist2_pool || 0
      };
    }
    
    // ✅ SUPABASE V2: No "returning" option, just .update()
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
        // ✅ Removed "updated_at" - column doesn't exist in schema
      })
      .eq('battle_id', battleId);
    // ✅ No .select() = minimal payload (fastest)

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

// ============================================================================
// NOTES ON SUPABASE V2 API CHANGES:
// ============================================================================
//
// OLD (v1): .insert(data, { returning: 'minimal' })
// NEW (v2): .insert(data)  // No returning option!
//
// OLD (v1): .update(data, { returning: 'representation' })
// NEW (v2): .update(data)  // No returning option!
//
// If you need data back:
// NEW (v2): .insert(data).select()  // Returns inserted rows
// NEW (v2): .update(data).eq('id', x).select()  // Returns updated rows
//
// For best performance (minimal payload), omit .select()
//
// ============================================================================
