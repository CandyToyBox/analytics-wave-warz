// ============================================================================
// BATTLES WEBHOOK - MAIN WEBHOOK HANDLER
// ============================================================================
// Processes battle INSERT and UPDATE events from external WaveWarz webhooks
// PUBLIC ENDPOINT - No authentication required (explicitly unprotected)
// This endpoint is intentionally public to accept webhooks from external sources

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const payload = await req.json();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 BATTLE WEBHOOK HANDLER STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 Webhook Details:');
    console.log(`Type: ${payload.type}`);
    console.log(`Table: ${payload.table}`);

    // ✅ TABLE FILTERING: Only process battles table
    if (payload.table !== 'battles') {
      console.log(`⏭️ Skipping webhook for unrelated table: ${payload.table}`);
      return new Response(
        JSON.stringify({
          success: true,
          action: 'skipped_table',
          reason: `Only 'battles' table is processed`,
          table: payload.table,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle INSERT (new battle created)
    if (payload.type === 'INSERT') {
      const result = await handleBattleInsert(supabase, payload);
      const duration = Date.now() - startTime;
      console.log(`⏱️ Webhook completed in ${duration}ms`);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle UPDATE (trading stats updated)
    if (payload.type === 'UPDATE') {
      const result = await handleBattleUpdate(supabase, payload);
      const duration = Date.now() - startTime;
      console.log(`⏱️ Webhook completed in ${duration}ms`);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`⚠️ Unknown webhook type: ${payload.type}`);
    return new Response(
      JSON.stringify({ success: false, error: 'Unknown webhook type' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Webhook handler error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// INSERT HANDLER (New Battle Created)
// ============================================================================

async function handleBattleInsert(supabase: any, payload: any) {
  const battleData = payload.record;
  const battleId = battleData.battle_id;

  console.log(`✨ NEW BATTLE INSERT: ${battleId}`);
  console.log(`Artists: ${battleData.artist1_name} vs ${battleData.artist2_name}`);
  console.log(
    `Duration: ${battleData.battle_duration}s (${Math.round(battleData.battle_duration / 60)} min)`
  );
  console.log(`Quick Battle: ${battleData.is_quick_battle ? 'YES' : 'NO'}`);
  if (battleData.is_quick_battle) {
    console.log(`  Queue ID: ${battleData.quick_battle_queue_id || 'N/A'}`);
  }

  try {
    const { error } = await supabase.from('battles').insert({
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

    if (error) {
      console.error('❌ INSERT failed:', error);
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

async function handleBattleUpdate(supabase: any, payload: any) {
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
        battleId,
      };
    }

    // Check if battle is past its duration (automatically completed)
    if (existingBattle) {
      const createdAt = new Date(existingBattle.created_at).getTime();
      const now = Date.now();
      const durationMs = existingBattle.battle_duration * 1000;
      const timeSinceCreation = now - createdAt;

      if (timeSinceCreation > durationMs && !battleData.winner_decided) {
        console.log(
          `⏰ Battle ${battleId} is past duration (${Math.round(timeSinceCreation / 1000 / 60)} min) - treating as completed`
        );
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
        poolB: battleData.artist2_pool || 0,
      };
    }

    // Update battle data
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
      battleId,
    };
  } catch (error: any) {
    console.error('❌ UPDATE handler error:', error);
    return { success: false, error: error.message };
  }
}
