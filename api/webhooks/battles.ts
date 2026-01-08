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
// TYPE DEFINITIONS
// ============================================================================

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: any;
  old_record?: any;
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const payload = await request.json() as WebhookPayload;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 BATTLE WEBHOOK HANDLER STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 Webhook Details:');
    console.log(`Type: ${payload.type}`);
    console.log(`Table: ${payload.table}`);
    
    // ✅ TABLE FILTERING: Process ONLY 'v2_battles' table (WaveWarz's source table)
    // IMPORTANT: We only process webhooks from WaveWarz's v2_battles table.
    // We do NOT process webhooks from our own 'battles' table to prevent duplicate triggers.
    // When v2_battles receives an insert, we copy it to our 'battles' table.
    // If we also processed 'battles' webhooks, we'd get a second webhook for the same battle.
    //
    // ⚠️ COMMON MISCONFIGURATION: If you're seeing this message repeatedly, it means
    // you've configured webhooks in YOUR Supabase Dashboard on the local 'battles' table.
    // This is incorrect! Webhooks should only come from WaveWarz's 'v2_battles' table.
    // Solution: Remove the webhook from your Supabase Dashboard and provide your webhook
    // URL to the WaveWarz team instead.
    if (payload.table !== 'v2_battles') {
      console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.warn('⚠️ WEBHOOK MISCONFIGURATION DETECTED');
      console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.warn(`❌ Received webhook for table: '${payload.table}'`);
      console.warn(`✅ Expected table: 'v2_battles' (WaveWarz source)`);
      console.warn('');
      console.warn('📋 This webhook is being IGNORED because:');
      console.warn('   • Webhooks must come from WaveWarz\'s v2_battles table');
      console.warn('   • Your local \'battles\' table is the destination, not a source');
      console.warn('   • Processing local table webhooks would cause duplicate entries');
      console.warn('');
      console.warn('🔧 To fix this misconfiguration:');
      console.warn('   1. Go to your Supabase Dashboard');
      console.warn('   2. Navigate to Database → Webhooks');
      console.warn('   3. Delete any webhooks configured on the \'battles\' table');
      console.warn('   4. Contact WaveWarz team to configure webhooks from their v2_battles table');
      console.warn('   5. See WEBHOOK_SETUP.md for detailed instructions');
      console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return Response.json({ 
        success: true, 
        action: 'skipped_table',
        reason: `Only 'v2_battles' table is processed to prevent duplicate triggers`,
        table: payload.table,
        message: 'Webhook misconfiguration detected. Remove webhooks from your local Supabase battles table.'
      });
    }
    
    console.log(`Source: WaveWarz v2_battles`);
    
    // ✅ WEBHOOK SECRET VERIFICATION
    // Verify webhook secret to ensure requests come from WaveWarz
    const webhookSecret = request.headers.get('X-Webhook-Secret');
    const expectedSecret = process.env.WAVEWARZ_WEBHOOK_SECRET;
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    // In production, webhook secret is REQUIRED for security
    if (!expectedSecret) {
      if (isProduction) {
        console.error('❌ WAVEWARZ_WEBHOOK_SECRET not configured in production - webhook REJECTED for security');
        return Response.json(
          { success: false, error: 'Webhook secret not configured. Please set WAVEWARZ_WEBHOOK_SECRET environment variable.' },
          { status: 500 }
        );
      } else {
        console.warn('⚠️ WAVEWARZ_WEBHOOK_SECRET not configured - webhook is INSECURE! This is only allowed in development.');
      }
    }

    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error('❌ Invalid webhook secret from WaveWarz');
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (expectedSecret) {
      console.log('✅ Webhook secret verified - request from WaveWarz');
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
    console.log(`Payload:`, JSON.stringify(payload, null, 2));
    return Response.json({ success: false, error: 'Unknown webhook type' });
    
  } catch (error: any) {
    console.error('❌ Webhook handler error:', error);
    console.error('Error details:', error.message);
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

  console.log(`✨ NEW BATTLE from WaveWarz v2_battles: ${battleId}`);
  console.log(`Artists: ${battleData.artist1_name} vs ${battleData.artist2_name}`);
  console.log(`Duration: ${battleData.battle_duration}s (${Math.round(battleData.battle_duration / 60)} min)`);
  
  // Log battle type for better tracking
  const battleType = battleData.is_quick_battle ? 'Quick Battle' : 
                     battleData.is_community_battle ? 'Community Battle' : 
                     'Main Battle';
  console.log(`Battle Type: ${battleType}`);
  console.log(`Quick Battle: ${battleData.is_quick_battle ? 'YES' : 'NO'}`);
  if (battleData.is_quick_battle) {
    console.log(`  Queue ID: ${battleData.quick_battle_queue_id || 'N/A'}`);
  }

  try {
    // ✅ DUPLICATE CHECK: Check if battle already exists in OUR database
    // This prevents duplicate inserts if webhook is retried
    // NOTE: We receive webhooks from WaveWarz's v2_battles table,
    // but we store the data in our own 'battles' table
    const { data: existingBattle } = await supabase
      .from('battles')
      .select('battle_id')
      .eq('battle_id', battleId)
      .single();

    if (existingBattle) {
      console.log(`⚠️ Battle ${battleId} already exists - skipping insert`);
      return { 
        success: true, 
        action: 'skipped',
        reason: 'Battle already exists',
        battleId 
      };
    }

    console.log(`➕ Inserting new battle ${battleId}...`);
    
    // ✅ SUPABASE V2: No "returning" option, just .insert()
    // NOTE: We receive webhooks from WaveWarz's v2_battles table,
    // but we store the data in our own 'battles' table
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
        split_wallet_address: battleData.split_wallet_address,
        is_community_battle: battleData.is_community_battle || false,
        community_round_id: battleData.community_round_id,
        is_quick_battle: battleData.is_quick_battle || false,
        quick_battle_queue_id: battleData.quick_battle_queue_id,
        is_test_battle: battleData.is_test_battle || false,
        created_at: battleData.created_at,
      });
    // ✅ No .select() = minimal payload (fastest)

    if (error) {
      console.error('❌ INSERT failed:', error);
      console.error('Battle data:', JSON.stringify(battleData, null, 2));
      return { success: false, error };
    }

    if (battleData.is_quick_battle) {
      console.log(`✅ QUICK BATTLE ${battleId} inserted successfully with is_quick_battle=true`);
    } else {
      console.log(`✅ Battle ${battleId} inserted successfully`);
    }
    
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
  
  // Log winner information clearly
  if (battleData.winner_artist_a === true) {
    console.log(`Winner: Artist A`);
  } else if (battleData.winner_artist_a === false) {
    console.log(`Winner: Artist B`);
  } else {
    console.log(`Winner: TBD`);
  }
  
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
