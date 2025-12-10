import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// We add .js because your project uses ES Modules (as seen in your previous PR)
import { announceBattle } from '../utils/farcaster.js';

// Initialize analytics database client
const ANALYTICS_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gshwqoplsxgqbdkssoit.supabase.co';
const ANALYTICS_SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaHdxb3Bsc3hncWJka3Nzb2l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NTQ2NDksImV4cCI6MjA3OTUzMDY0OX0.YNv0QgQfUMsrDyWQB3tnKVshal_h7ZjuobKWrQjfzlQ';

const analyticsDb = createClient(ANALYTICS_SUPABASE_URL, ANALYTICS_SUPABASE_KEY);

/**
 * Helper: Save battle to analytics database
 */
async function saveBattleToAnalytics(battle: any) {
  try {
    console.log('💾 Saving to analytics database...');

    const battleRecord = {
      battle_id: battle.battle_id?.toString(),
      created_at: battle.created_at,
      status: battle.status || 'active',

      // Artist 1
      artist1_name: battle.artist1_name,
      artist1_wallet: battle.artist1_wallet,
      artist1_music_link: battle.artist1_music_link,
      artist1_twitter: battle.artist1_twitter,
      artist1_pool: battle.artist1_pool || 0,

      // Artist 2
      artist2_name: battle.artist2_name,
      artist2_wallet: battle.artist2_wallet,
      artist2_music_link: battle.artist2_music_link,
      artist2_twitter: battle.artist2_twitter,
      artist2_pool: battle.artist2_pool || 0,

      // Battle metadata
      image_url: battle.image_url,
      stream_link: battle.stream_link,
      battle_duration: battle.battle_duration,
      winner_decided: battle.winner_decided || false,

      // Battle types
      is_quick_battle: battle.is_quick_battle || false,
      is_community_battle: battle.is_community_battle || false,
      creator_wallet: battle.creator_wallet,

      // Trading stats (initial values)
      total_volume_a: battle.total_volume_a || 0,
      total_volume_b: battle.total_volume_b || 0,
      trade_count: battle.trade_count || 0,
      unique_traders: battle.unique_traders || 0,
    };

    const { error, data } = await analyticsDb
      .from('battles')
      .upsert(battleRecord, {
        onConflict: 'battle_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Database save error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Battle saved to analytics database');
    console.log(`   Battle ID: ${battle.battle_id}`);
    console.log(`   Type: ${battleRecord.is_quick_battle ? '⚡ Quick' : battleRecord.is_community_battle ? '👥 Community' : '🎵 Official'}`);
    console.log(`   Artists: ${battle.artist1_name} vs ${battle.artist2_name}`);

    return { success: true, data };
  } catch (error: any) {
    console.error('❌ Failed to save to analytics database:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper: Post battle announcement to Farcaster
 * (This comes from the "claude" branch)
 */
async function postBattleToFarcaster(battle: any) {
  try {
    const result = await announceBattle({
      battleId: battle.battle_id,
      artist1Name: battle.artist1_name,
      artist2Name: battle.artist2_name,
      imageUrl: battle.image_url
    });

    if (result.success) {
      console.log('✅ Posted to Farcaster:', result.hash);
    } else {
      console.log('ℹ️  Farcaster posting skipped:', result.error);
    }
  } catch (error) {
    console.error('❌ Failed to post to Farcaster:', error);
  }
}

/**
 * Main Vercel Handler
 * (This preserves the structure from your "main" branch)
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests from Supabase webhooks
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, table, record } = req.body;

  console.log('━'.repeat(60));
  console.log(`📥 Received webhook: ${type} on ${table}`);
  console.log(`   Battle ID: ${record?.battle_id}`);
  console.log('━'.repeat(60));

  try {
    // Filter to ensure we only process the 'battles' table
    if (table !== 'battles') {
      return res.status(200).json({ message: 'Ignored table' });
    }

    // When a new battle is created (INSERT)
    if (type === 'INSERT') {
      // Save to analytics database first
      const saveResult = await saveBattleToAnalytics(record);

      // Then post to Farcaster (don't fail if this errors)
      await postBattleToFarcaster(record);

      console.log('━'.repeat(60));

      // Return success
      return res.status(200).json({
        success: true,
        battleId: record.battle_id,
        saved: saveResult.success,
        timestamp: new Date().toISOString()
      });
    }

    // When battle is updated (UPDATE)
    if (type === 'UPDATE') {
      console.log('🔄 Processing UPDATE event...');

      const updates: any = {
        status: record.status,
        artist1_pool: record.artist1_pool,
        artist2_pool: record.artist2_pool,
        winner_decided: record.winner_decided,
        total_volume_a: record.total_volume_a || 0,
        total_volume_b: record.total_volume_b || 0,
        trade_count: record.trade_count || 0,
        unique_traders: record.unique_traders || 0,
      };

      const { error } = await analyticsDb
        .from('battles')
        .update(updates)
        .eq('battle_id', record.battle_id?.toString());

      if (error) {
        console.error('❌ Update error:', error);
      } else {
        console.log('✅ Battle updated in analytics database');
      }

      console.log('━'.repeat(60));
    }

    // Return success to Supabase so it knows the webhook worked
    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('━'.repeat(60));
    console.error('❌ Webhook Error:', error);
    console.error('━'.repeat(60));
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

// Named export for Express server compatibility
export { handler as battleWebhookHandler };

// Default export for Vercel serverless function
export default handler;
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * DIAGNOSTIC WEBHOOK HANDLER
 * This version has extensive logging to help us see exactly what's happening
 */

async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 DIAGNOSTIC WEBHOOK HANDLER STARTED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, table, record } = req.body;

  console.log('📥 Webhook Details:');
  console.log('   Type:', type);
  console.log('   Table:', table);
  console.log('   Battle ID:', record?.battle_id);
  console.log('   Record keys:', record ? Object.keys(record).join(', ') : 'none');

  try {
    // Check environment variables
    console.log('\n🔐 Environment Check:');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_KEY;
    
    console.log('   VITE_SUPABASE_URL exists:', !!supabaseUrl);
    console.log('   VITE_SUPABASE_KEY exists:', !!supabaseKey);
    console.log('   URL value:', supabaseUrl || 'MISSING');
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ CRITICAL: Environment variables missing!');
      return res.status(200).json({ 
        success: false,
        error: 'Missing environment variables',
        supabaseUrl: !!supabaseUrl,
        supabaseKey: !!supabaseKey
      });
    }

    // Initialize Supabase client
    console.log('\n🔌 Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client created');

    // Filter table
    if (table !== 'battles' && table !== 'v2_battles') {
      console.log('ℹ️  Ignoring table:', table);
      return res.status(200).json({ 
        success: true, 
        message: `Ignored table: ${table}` 
      });
    }

    if (type === 'INSERT') {
      console.log('\n💾 Attempting to save battle to database...');
      console.log('   Battle ID:', record.battle_id);
      console.log('   Artist 1:', record.artist1_name || 'MISSING');
      console.log('   Artist 2:', record.artist2_name || 'MISSING');
      
      // Prepare battle data
      const battleRecord = {
        battle_id: record.battle_id,
        id: record.id,
        created_at: record.created_at,
        status: record.status || 'active',
        
        artist1_name: record.artist1_name,
        artist1_wallet: record.artist1_wallet,
        artist1_music_link: record.artist1_music_link,
        artist1_twitter: record.artist1_twitter,
        artist1_pool: record.artist1_pool || 0,
        artist1_supply: record.artist1_supply || 1000,
        
        artist2_name: record.artist2_name,
        artist2_wallet: record.artist2_wallet,
        artist2_music_link: record.artist2_music_link,
        artist2_twitter: record.artist2_twitter,
        artist2_pool: record.artist2_pool || 0,
        artist2_supply: record.artist2_supply || 1000,
        
        image_url: record.image_url,
        stream_link: record.stream_link,
        battle_duration: record.battle_duration || 3600,
        winner_decided: record.winner_decided || false,
        winner_artist_a: record.winner_artist_a || null,
        
        wavewarz_wallet: record.wavewarz_wallet,
        creator_wallet: record.creator_wallet,
        split_wallet_address: record.split_wallet_address,
        
        is_community_battle: record.is_community_battle || false,
        community_round_id: record.community_round_id || null,
        
        // Quick Battle fields
        quick_battle_artist1_profile: record.quick_battle_artist1_profile || null,
        quick_battle_artist2_profile: record.quick_battle_artist2_profile || null,
        quick_battle_artist1_audius_handle: record.quick_battle_artist1_audius_handle || null,
        quick_battle_artist2_audius_handle: record.quick_battle_artist2_audius_handle || null,
        quick_battle_artist1_audius_profile_pic: record.quick_battle_artist1_audius_profile_pic || null,
        quick_battle_artist2_audius_profile_pic: record.quick_battle_artist2_audius_profile_pic || null,
        is_quick_battle: record.is_quick_battle || false,
      };
      
      console.log('   Prepared record with', Object.keys(battleRecord).length, 'fields');
      
      // Attempt database insert
      console.log('\n📤 Sending to Supabase...');
      const { data, error } = await supabase
        .from('battles')
        .upsert(battleRecord, { 
          onConflict: 'battle_id',
          ignoreDuplicates: false 
        })
        .select();
      
      if (error) {
        console.log('❌ DATABASE ERROR:', error);
        console.log('   Error code:', error.code);
        console.log('   Error message:', error.message);
        console.log('   Error details:', error.details);
        console.log('   Error hint:', error.hint);
        
        return res.status(200).json({ 
          success: false,
          error: 'Database save failed',
          details: error.message,
          code: error.code,
          battle_id: record.battle_id
        });
      }
      
      console.log('✅ BATTLE SAVED SUCCESSFULLY!');
      console.log('   Battle ID:', record.battle_id);
      console.log('   Returned data:', data ? 'yes' : 'no');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return res.status(200).json({ 
        success: true, 
        message: 'Battle saved to analytics database',
        battle_id: record.battle_id,
        data_returned: !!data
      });
      
    } else if (type === 'UPDATE') {
      console.log('\n🔄 UPDATE webhook - not implemented yet');
      return res.status(200).json({ 
        success: true, 
        message: 'Update acknowledged but not processed' 
      });
      
    } else {
      console.log('\nℹ️  Webhook type not handled:', type);
      return res.status(200).json({ 
        success: true, 
        message: `Webhook type ${type} acknowledged` 
      });
    }

  } catch (error: any) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ CRITICAL ERROR IN WEBHOOK HANDLER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    
    // Return 200 to prevent infinite retries from Supabase
    return res.status(200).json({ 
      success: false, 
      error: error.message || 'Internal Server Error',
      battle_id: req.body.record?.battle_id,
      stack: error.stack
    });
  }
}

export { handler as battleWebhookHandler };
export default handler;
