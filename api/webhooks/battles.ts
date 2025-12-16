/**
 * WaveWarz Analytics - Battle Webhook Handler
 * Receives real-time battle data from production database
 * Syncs to analytics database for leaderboards and stats
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 BATTLE WEBHOOK HANDLER STARTED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Extract webhook data
    const { type, table, record, old_record } = req.body;

    console.log('📥 Webhook Details:');
    console.log('Type:', type);
    console.log('Table:', table);
    console.log('Battle ID:', record?.battle_id);

    // Validate required data
    if (!type || !table || !record) {
      console.error('❌ Missing required webhook data');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required webhook data' 
      });
    }

    // Check environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('🔐 Environment Check:');
    console.log('VITE_SUPABASE_URL exists:', !!supabaseUrl);
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey);

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ CRITICAL: Environment variables missing!');
      return res.status(500).json({
        success: false,
        error: 'Missing environment variables',
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
      });
    }

    console.log('URL value:', supabaseUrl);
    console.log('🔌 Initializing Supabase client...');

    // Initialize Supabase client with SERVICE ROLE key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('✅ Supabase client created');

    // ═══════════════════════════════════════════════════════
    // HANDLE INSERT - New Battle Created
    // ═══════════════════════════════════════════════════════
    if (type === 'INSERT') {
      console.log('🆕 New battle INSERT detected');
      console.log('Battle ID:', record.battle_id);
      console.log('Artist 1:', record.artist1_name);
      console.log('Artist 2:', record.artist2_name);
      console.log('Quick Battle:', record.is_quick_battle);

      const { data, error } = await supabase
        .from('battles')
        .upsert(
          {
            // Core identifiers
            id: record.id,
            battle_id: record.battle_id,
            created_at: record.created_at,
            status: record.status || 'Active',

            // Artist information
            artist1_name: record.artist1_name,
            artist2_name: record.artist2_name,
            artist1_wallet: record.artist1_wallet,
            artist2_wallet: record.artist2_wallet,
            artist1_twitter: record.artist1_twitter,
            artist2_twitter: record.artist2_twitter,
            artist1_music_link: record.artist1_music_link,
            artist2_music_link: record.artist2_music_link,

            // Trading stats (initially 0, updated later)
            artist1_pool: record.artist1_pool || 0,
            artist2_pool: record.artist2_pool || 0,
            artist1_supply: record.artist1_supply || 0,
            artist2_supply: record.artist2_supply || 0,
            total_volume_a: record.total_volume_a || 0,
            total_volume_b: record.total_volume_b || 0,
            trade_count: record.trade_count || 0,
            unique_traders: record.unique_traders || 0,

            // Battle metadata
            wavewarz_wallet: record.wavewarz_wallet,
            creator_wallet: record.creator_wallet,
            split_wallet_address: record.split_wallet_address,
            image_url: record.image_url,
            stream_link: record.stream_link,
            battle_duration: record.battle_duration || 600,

            // Battle types
            is_quick_battle: record.is_quick_battle || false,
            is_test_battle: record.is_test_battle || false,
            is_community_battle: record.is_community_battle || false,
            community_round_id: record.community_round_id,
            
            // Handle quick_battle_queue_id: BIGINT column but receives UUID strings
            // If it's a UUID (contains hyphens), set to NULL, otherwise use the value
            quick_battle_queue_id: (record.quick_battle_queue_id && typeof record.quick_battle_queue_id === 'string' && record.quick_battle_queue_id.includes('-')) 
              ? null 
              : record.quick_battle_queue_id,

            // Quick Battle - Audius data
            quick_battle_artist1_audius_handle: record.quick_battle_artist1_audius_handle,
            quick_battle_artist2_audius_handle: record.quick_battle_artist2_audius_handle,
            quick_battle_artist1_profile: record.quick_battle_artist1_profile,
            quick_battle_artist2_profile: record.quick_battle_artist2_profile,
            quick_battle_artist1_audius_profile_pic: record.quick_battle_artist1_audius_profile_pic,
            quick_battle_artist2_audius_profile_pic: record.quick_battle_artist2_audius_profile_pic,

            // Winner info (updated later)
            winner_decided: record.winner_decided || false,
            winner_artist_a: record.winner_artist_a,

            // Timestamps
            last_scanned_at: record.last_scanned_at,
            recent_trades_cache: record.recent_trades_cache,
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('❌ UPSERT failed:', error);
        return res.status(500).json({ 
          success: false, 
          error: error.message,
          code: error.code,
          details: error.details
        });
      }

      console.log('✅ Battle inserted successfully!');
      console.log('Battle ID:', record.battle_id);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Battle created in analytics DB',
        battleId: record.battle_id,
        isQuickBattle: record.is_quick_battle
      });
    }

    // ═══════════════════════════════════════════════════════
    // HANDLE UPDATE - Battle Stats Updated (THE IMPORTANT ONE!)
    // ═══════════════════════════════════════════════════════
    if (type === 'UPDATE') {
      console.log('🔄 Battle UPDATE detected - syncing trading data...');
      console.log('Battle ID:', record.battle_id);
      console.log('📊 Trading Stats:');
      console.log('  Volume A:', record.total_volume_a);
      console.log('  Volume B:', record.total_volume_b);
      console.log('  Pool A:', record.artist1_pool);
      console.log('  Pool B:', record.artist2_pool);
      console.log('  Trades:', record.trade_count);
      console.log('  Traders:', record.unique_traders);
      console.log('  Winner Decided:', record.winner_decided);

      const { data, error } = await supabase
        .from('battles')
        .update({
          // Status updates
          status: record.status,

          // Trading stats - THE CRITICAL DATA FOR LEADERBOARDS!
          artist1_pool: record.artist1_pool || 0,
          artist2_pool: record.artist2_pool || 0,
          artist1_supply: record.artist1_supply || 0,
          artist2_supply: record.artist2_supply || 0,
          total_volume_a: record.total_volume_a || 0,
          total_volume_b: record.total_volume_b || 0,
          trade_count: record.trade_count || 0,
          unique_traders: record.unique_traders || 0,

          // Winner information
          winner_decided: record.winner_decided || false,
          winner_artist_a: record.winner_artist_a,

          // Quick Battle - Audius profiles (if populated)
          quick_battle_artist1_audius_handle: record.quick_battle_artist1_audius_handle,
          quick_battle_artist2_audius_handle: record.quick_battle_artist2_audius_handle,
          quick_battle_artist1_profile: record.quick_battle_artist1_profile,
          quick_battle_artist2_profile: record.quick_battle_artist2_profile,
          quick_battle_artist1_audius_profile_pic: record.quick_battle_artist1_audius_profile_pic,
          quick_battle_artist2_audius_profile_pic: record.quick_battle_artist2_audius_profile_pic,

          // Metadata
          last_scanned_at: record.last_scanned_at,
          recent_trades_cache: record.recent_trades_cache,
        })
        .eq('battle_id', record.battle_id);

      if (error) {
        console.error('❌ UPDATE failed:', error);
        return res.status(500).json({ 
          success: false, 
          error: error.message,
          code: error.code,
          details: error.details
        });
      }

      console.log('✅ Battle stats updated successfully!');
      console.log('📈 Summary:');
      console.log('  Total Volume:', (record.total_volume_a || 0) + (record.total_volume_b || 0), 'SOL');
      console.log('  Total Trades:', record.trade_count || 0);
      console.log('  Unique Traders:', record.unique_traders || 0);

      return res.status(200).json({ 
        success: true, 
        message: 'Battle stats synced to analytics DB',
        battleId: record.battle_id,
        stats: {
          volumeA: record.total_volume_a || 0,
          volumeB: record.total_volume_b || 0,
          trades: record.trade_count || 0,
          traders: record.unique_traders || 0,
          winnerDecided: record.winner_decided || false
        }
      });
    }

    // ═══════════════════════════════════════════════════════
    // HANDLE DELETE (Optional - for cleanup)
    // ═══════════════════════════════════════════════════════
    if (type === 'DELETE') {
      console.log('🗑️  Battle DELETE detected');
      console.log('Battle ID:', old_record?.battle_id);

      // Only delete test battles, keep production data
      if (old_record?.is_test_battle) {
        const { error } = await supabase
          .from('battles')
          .delete()
          .eq('battle_id', old_record.battle_id);

        if (error) {
          console.error('❌ DELETE failed:', error);
          return res.status(500).json({ success: false, error: error.message });
        }

        console.log('✅ Test battle deleted from analytics DB');
        return res.status(200).json({ 
          success: true, 
          message: 'Test battle deleted' 
        });
      } else {
        console.log('ℹ️  Production battle - keeping in analytics DB');
        return res.status(200).json({ 
          success: true, 
          message: 'Production battle preserved' 
        });
      }
    }

    // Unknown event type
    console.log('⚠️  Unknown webhook type:', type);
    return res.status(400).json({ 
      success: false, 
      message: `Unknown webhook type: ${type}`,
      receivedType: type
    });

  } catch (error: any) {
    console.error('💥 Webhook handler error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
