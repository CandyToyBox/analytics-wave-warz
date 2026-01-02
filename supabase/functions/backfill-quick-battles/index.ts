// ============================================================================
// BACKFILL QUICK BATTLES - One-time update to tag existing battles
// ============================================================================
// This function updates existing battles in the database to set the
// is_quick_battle flag based on battle characteristics (duration, Audius links)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  try {
    // Initialize Supabase with service_role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting quick battles backfill...');

    // STEP 1: Mark battles with short durations (≤ 20 minutes)
    console.log('📊 Step 1: Updating battles with duration ≤ 1200 seconds...');
    const { count: step1Count, error: step1Error } = await supabase
      .from('battles')
      .update({ is_quick_battle: true })
      .lte('battle_duration', 1200)
      .or('is_quick_battle.is.null,is_quick_battle.eq.false')
      .or('is_test_battle.is.null,is_test_battle.eq.false')
      .select('*', { count: 'exact', head: true });

    if (step1Error) {
      console.error('❌ Step 1 failed:', step1Error);
      throw step1Error;
    }
    console.log(`✅ Step 1: Updated ${step1Count || 0} battles`);

    // STEP 2: Mark battles with Audius links (song vs song)
    console.log('📊 Step 2: Updating battles with Audius links...');
    const { count: step2Count, error: step2Error } = await supabase
      .from('battles')
      .update({ is_quick_battle: true })
      .or('artist1_music_link.ilike.%audius.co%,artist2_music_link.ilike.%audius.co%')
      .lte('battle_duration', 3600)
      .or('is_quick_battle.is.null,is_quick_battle.eq.false')
      .or('is_test_battle.is.null,is_test_battle.eq.false')
      .select('*', { count: 'exact', head: true });

    if (step2Error) {
      console.error('❌ Step 2 failed:', step2Error);
      throw step2Error;
    }
    console.log(`✅ Step 2: Updated ${step2Count || 0} battles`);

    // STEP 3: Ensure test battles are not marked as quick battles
    console.log('📊 Step 3: Unmarking test battles...');
    const { count: step3Count, error: step3Error } = await supabase
      .from('battles')
      .update({ is_quick_battle: false })
      .eq('is_test_battle', true)
      .select('*', { count: 'exact', head: true });

    if (step3Error) {
      console.error('❌ Step 3 failed:', step3Error);
      throw step3Error;
    }
    console.log(`✅ Step 3: Updated ${step3Count || 0} test battles`);

    // VERIFICATION: Count total quick battles
    console.log('📊 Verification: Counting quick battles...');
    const { count: totalQuickBattles, error: countError } = await supabase
      .from('battles')
      .select('*', { count: 'exact', head: true })
      .eq('is_quick_battle', true)
      .neq('is_test_battle', true);

    if (countError) {
      console.error('❌ Count failed:', countError);
      throw countError;
    }

    const duration = Date.now() - startTime;
    const summary = {
      success: true,
      duration_ms: duration,
      step1_updated: step1Count || 0,
      step2_updated: step2Count || 0,
      step3_updated: step3Count || 0,
      total_quick_battles: totalQuickBattles || 0,
      message: `Backfill completed successfully in ${duration}ms`
    };

    console.log('✅ Backfill complete:', summary);

    return new Response(
      JSON.stringify(summary, null, 2),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Backfill error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }, null, 2),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
