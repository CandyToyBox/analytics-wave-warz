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
