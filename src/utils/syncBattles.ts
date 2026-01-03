// ============================================================================
// SYNC BATTLES TO DATABASE - Utility to sync battles via backend API
// ============================================================================

import type { BattleSummary } from '../types';

interface SyncResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ battle_id: string; error: string }>;
  message: string;
}

/**
 * Syncs battles to the database via the backend API endpoint.
 * This is necessary because the frontend can't insert battles due to RLS policies.
 *
 * @param battles - Array of battle data to sync
 * @returns Result of the sync operation
 */
export async function syncBattlesToDatabase(battles: BattleSummary[]): Promise<SyncResult> {
  try {
    console.log(`🔄 Syncing ${battles.length} battles to database...`);

    // Convert BattleSummary to the format expected by the API
    const battleData = battles.map(b => ({
      battle_id: b.battleId,
      status: b.status,
      artist1_name: b.artistA.name,
      artist2_name: b.artistB.name,
      artist1_wallet: b.artistA.wallet,
      artist2_wallet: b.artistB.wallet,
      artist1_twitter: b.artistA.twitter,
      artist2_twitter: b.artistB.twitter,
      artist1_music_link: b.artistA.musicLink,
      artist2_music_link: b.artistB.musicLink,
      artist1_pool: b.artistASolBalance,
      artist2_pool: b.artistBSolBalance,
      battle_duration: b.battleDuration,
      winner_decided: b.winnerDecided,
      winner_artist_a: b.winnerArtistA,
      created_at: b.createdAt,
      image_url: b.imageUrl,
      stream_link: b.streamLink,
      is_community_battle: b.isCommunityBattle,
      is_quick_battle: b.isQuickBattle,
      quick_battle_queue_id: b.quickBattleQueueId,
      is_test_battle: b.isTestBattle,
    }));

    const response = await fetch('/api/sync-battles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ battles: battleData }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync battles');
    }

    const result: SyncResult = await response.json();
    console.log('✅ Sync result:', result);

    return result;

  } catch (error: any) {
    console.error('❌ Failed to sync battles:', error);
    return {
      success: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [{ battle_id: 'unknown', error: error.message }],
      message: `Sync failed: ${error.message}`
    };
  }
}

/**
 * Syncs battles filtered for Quick Battles only
 */
export async function syncQuickBattlesToDatabase(battles: BattleSummary[]): Promise<SyncResult> {
  const quickBattles = battles.filter(b => b.isQuickBattle);
  console.log(`🔄 Syncing ${quickBattles.length} Quick Battles (filtered from ${battles.length} total)...`);
  return syncBattlesToDatabase(quickBattles);
}
