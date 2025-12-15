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
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('   VITE_SUPABASE_URL exists:', !!supabaseUrl);
    console.log('   SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey);
    console.log('   URL value:', supabaseUrl || 'MISSING');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('❌ CRITICAL: Environment variables missing!');
      return res.status(200).json({ 
        success: false,
        error: 'Missing environment variables',
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey
      });
    }

    // Initialize Supabase client
    console.log('\n🔌 Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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
