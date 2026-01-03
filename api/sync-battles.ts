// ============================================================================
// SYNC BATTLES FROM BLOCKCHAIN - Insert missing battles into database
// ============================================================================
// This endpoint accepts battle data from the frontend and inserts missing
// battles into the database using service_role credentials.

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for writing
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BattleData {
  battle_id: string;
  status?: string;
  artist1_name: string;
  artist2_name: string;
  artist1_wallet: string;
  artist2_wallet: string;
  artist1_twitter?: string | null;
  artist2_twitter?: string | null;
  artist1_music_link?: string | null;
  artist2_music_link?: string | null;
  artist1_pool?: number;
  artist2_pool?: number;
  artist1_supply?: number;
  artist2_supply?: number;
  battle_duration: number;
  winner_decided?: boolean;
  winner_artist_a?: boolean | null;
  created_at: string;
  image_url?: string | null;
  stream_link?: string | null;
  is_community_battle?: boolean;
  is_quick_battle?: boolean;
  quick_battle_queue_id?: string | null;
  is_test_battle?: boolean;
  wavewarz_wallet?: string | null;
  creator_wallet?: string | null;
  split_wallet_address?: string | null;
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { battles }: { battles: BattleData[] } = await request.json();

    if (!battles || !Array.isArray(battles) || battles.length === 0) {
      return Response.json(
        { success: false, error: 'No battles provided' },
        { status: 400 }
      );
    }

    console.log(`🔄 Syncing ${battles.length} battles to database...`);

    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ battle_id: string; error: string }>
    };

    // Process each battle
    for (const battle of battles) {
      try {
        // Check if battle already exists
        const { data: existing, error: fetchError } = await supabase
          .from('battles')
          .select('battle_id, artist1_pool, artist2_pool')
          .eq('battle_id', battle.battle_id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = no rows returned (battle doesn't exist)
          console.error(`❌ Error checking battle ${battle.battle_id}:`, fetchError);
          results.errors.push({ battle_id: battle.battle_id, error: fetchError.message });
          continue;
        }

        if (existing) {
          // Battle exists - update only if we have new data
          if (battle.artist1_pool !== undefined || battle.artist2_pool !== undefined) {
            const { error: updateError } = await supabase
              .from('battles')
              .update({
                artist1_pool: battle.artist1_pool ?? existing.artist1_pool,
                artist2_pool: battle.artist2_pool ?? existing.artist2_pool,
                artist1_supply: battle.artist1_supply,
                artist2_supply: battle.artist2_supply,
                winner_decided: battle.winner_decided,
                winner_artist_a: battle.winner_artist_a,
                status: battle.status,
              })
              .eq('battle_id', battle.battle_id);

            if (updateError) {
              console.error(`❌ Failed to update battle ${battle.battle_id}:`, updateError);
              results.errors.push({ battle_id: battle.battle_id, error: updateError.message });
            } else {
              console.log(`✅ Updated battle ${battle.battle_id}`);
              results.updated++;
            }
          } else {
            console.log(`⏭️ Skipped battle ${battle.battle_id} (already exists, no new data)`);
            results.skipped++;
          }
        } else {
          // Battle doesn't exist - insert it
          const { error: insertError } = await supabase
            .from('battles')
            .insert({
              battle_id: battle.battle_id,
              status: battle.status || 'active',
              artist1_name: battle.artist1_name,
              artist2_name: battle.artist2_name,
              artist1_wallet: battle.artist1_wallet,
              artist2_wallet: battle.artist2_wallet,
              artist1_twitter: battle.artist1_twitter,
              artist2_twitter: battle.artist2_twitter,
              artist1_music_link: battle.artist1_music_link,
              artist2_music_link: battle.artist2_music_link,
              artist1_pool: battle.artist1_pool || 0,
              artist2_pool: battle.artist2_pool || 0,
              artist1_supply: battle.artist1_supply || 0,
              artist2_supply: battle.artist2_supply || 0,
              battle_duration: battle.battle_duration,
              winner_decided: battle.winner_decided || false,
              winner_artist_a: battle.winner_artist_a,
              created_at: battle.created_at,
              image_url: battle.image_url,
              stream_link: battle.stream_link,
              is_community_battle: battle.is_community_battle || false,
              is_quick_battle: battle.is_quick_battle || false,
              quick_battle_queue_id: battle.quick_battle_queue_id,
              is_test_battle: battle.is_test_battle || false,
              wavewarz_wallet: battle.wavewarz_wallet,
              creator_wallet: battle.creator_wallet,
              split_wallet_address: battle.split_wallet_address,
            });

          if (insertError) {
            console.error(`❌ Failed to insert battle ${battle.battle_id}:`, insertError);
            results.errors.push({ battle_id: battle.battle_id, error: insertError.message });
          } else {
            console.log(`✅ Inserted battle ${battle.battle_id}`);
            results.inserted++;
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing battle ${battle.battle_id}:`, error);
        results.errors.push({ battle_id: battle.battle_id, error: error.message });
      }
    }

    // Refresh materialized view
    if (results.inserted > 0 || results.updated > 0) {
      try {
        await supabase.rpc('refresh_quick_battle_leaderboard');
        console.log('✅ Materialized view refreshed');
      } catch (refreshError) {
        console.warn('⚠️ Failed to refresh materialized view:', refreshError);
      }
    }

    const duration = Date.now() - startTime;
    const summary = {
      success: true,
      duration_ms: duration,
      ...results,
      message: `Processed ${battles.length} battles in ${duration}ms: ${results.inserted} inserted, ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors`
    };

    console.log('✅ Sync complete:', summary);

    return Response.json(summary);

  } catch (error: any) {
    console.error('❌ Sync endpoint error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
