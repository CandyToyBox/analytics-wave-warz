import { Connection, PublicKey } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';

// Configuration from solanaService.ts
// Uses environment variable if available, falls back to hardcoded key for backward compatibility
const HELIUS_API_KEY = process.env.VITE_HELIUS_API_KEY || "8b84d8d3-59ad-4778-829b-47db8a9149fa";
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const PROGRAM_ID = new PublicKey("9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo");

// Supabase configuration - using environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('VITE_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅' : '❌');
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY/VITE_SUPABASE_KEY. Please configure these in your .env file.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const connection = new Connection(RPC_URL, 'confirmed');

interface BackfillStats {
  onChainBattles: number;
  inDatabase: number;
  missing: number;
  inserted: number;
  failed: number;
  alreadyExists: number;
}

/**
 * Extract battle_id from battle account data
 * Based on decodeBattleAccount in solanaService.ts:
 * - Offset 0-7:   Discriminator (8 bytes)
 * - Offset 8-15: battle_id as u64 little-endian
 */
function extractBattleId(accountData: Buffer): string | null {
  try {
    if (accountData.length < 16) {
      return null;
    }
    
    const view = new DataView(accountData.buffer, accountData.byteOffset, accountData.byteLength);
    const battleId = view.getBigUint64(8, true); // Offset 8, little-endian
    return battleId.toString();
  } catch (error) {
    console.warn('Failed to extract battle ID:', error);
    return null;
  }
}

/**
 * Fetch all battle accounts from the WaveWarz program
 */
async function getAllBattleAccountsFromBlockchain(): Promise<Map<string, PublicKey>> {
  console.log('🔍 Scanning Solana blockchain for all WaveWarz battle accounts...');
  console.log(`📍 Program ID: ${PROGRAM_ID.toString()}\n`);
  
  try {
    // Get all program accounts without size filter to catch all battle accounts
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      encoding: 'base64'
    });

    console.log(`📊 Found ${accounts.length} program accounts\n`);

    const battleMap = new Map<string, PublicKey>();
    let validAccounts = 0;
    let invalidAccounts = 0;

    for (const account of accounts) {
      const accountData = Buffer.from(account.account.data as string, 'base64');
      const battleId = extractBattleId(accountData);
      
      if (battleId) {
        battleMap.set(battleId, account.pubkey);
        validAccounts++;
      } else {
        invalidAccounts++;
      }
    }

    console.log(`✅ Extracted ${validAccounts} valid battle accounts`);
    if (invalidAccounts > 0) {
      console.log(`⚠️  Skipped ${invalidAccounts} invalid/non-battle accounts\n`);
    }

    return battleMap;
    
  } catch (error) {
    console.error('❌ Failed to fetch program accounts from blockchain:', error);
    throw error;
  }
}

/**
 * Get all battle IDs currently in the database
 */
async function getBattleIdsInDatabase(): Promise<Set<string>> {
  console.log('🔍 Fetching existing battles from database...');
  
  const { data, error } = await supabase
    .from('battles')
    .select('battle_id');
  
  if (error) {
    console.error('❌ Failed to fetch database battles:', error);
    throw error;
  }

  const battleIds = new Set(data.map(b => b.battle_id));
  console.log(`📊 Found ${battleIds.size} battles in database\n`);
  
  return battleIds;
}

/**
 * Insert a minimal battle record into the database
 * The admin scan endpoint will populate full details later
 */
async function insertMinimalBattle(battleId: string, accountPubkey: PublicKey): Promise<'inserted' | 'exists' | 'failed'> {
  try {
    const { error } = await supabase
      .from('battles')
      .insert({
        battle_id: battleId,
        artist1_name: `[Pending Scan] Battle ${battleId} Artist A`,
        artist2_name: `[Pending Scan] Battle ${battleId} Artist B`,
        artist1_wallet: null, // Will be populated by scanner
        artist2_wallet: null, // Will be populated by scanner
        created_at: new Date().toISOString(),
        battle_duration: 0, // Will be determined by scanner from on-chain data
        is_quick_battle: null, // Will be determined by scanner
        status: 'PENDING',
        artist1_pool: 0,
        artist2_pool: 0,
        total_volume_a: 0,
        total_volume_b: 0,
        winner_decided: false,
        is_test_battle: false,
      });

    if (error) {
      // Check if it's a duplicate key error (battle already exists)
      if (error.code === '23505') {
        return 'exists';
      }
      
      console.error(`❌ Failed to insert battle ${battleId}:`, error.message);
      return 'failed';
    }

    return 'inserted';
    
  } catch (error) {
    console.error(`❌ Error inserting battle ${battleId}:`, error);
    return 'failed';
  }
}

/**
 * Main backfill function
 */
async function backfillMissingBattles() {
  console.log('============================================');
  console.log('🚀 WAVEWARZ BLOCKCHAIN BACKFILL');
  console.log('============================================');
  console.log(`📅 Started: ${new Date().toISOString()}\n`);

  const stats: BackfillStats = {
    onChainBattles: 0,
    inDatabase: 0,
    missing: 0,
    inserted: 0,
    failed: 0,
    alreadyExists: 0,
  };

  try {
    // Step 1: Get all battle accounts from blockchain
    const onChainBattles = await getAllBattleAccountsFromBlockchain();
    stats.onChainBattles = onChainBattles.size;

    // Step 2: Get existing battles from database
    const dbBattleIds = await getBattleIdsInDatabase();
    stats.inDatabase = dbBattleIds.size;

    // Step 3: Find missing battles
    const missingBattles = new Map<string, PublicKey>();
    for (const [battleId, pubkey] of onChainBattles) {
      if (!dbBattleIds.has(battleId)) {
        missingBattles.set(battleId, pubkey);
      }
    }
    stats.missing = missingBattles.size;

    console.log('============================================');
    console.log('📊 SUMMARY');
    console.log('============================================');
    console.log(`   On-chain battles:      ${stats.onChainBattles}`);
    console.log(`   In database:           ${stats.inDatabase}`);
    console.log(`   Missing from DB:       ${stats.missing}`);
    console.log('============================================\n');

    if (stats.missing === 0) {
      console.log('✅ All blockchain battles are already in the database!');
      console.log('   No backfill needed.\n');
      return stats;
    }

    // Step 4: Insert missing battles
    console.log(`📝 Inserting ${stats.missing} missing battles...\n`);

    let progressCount = 0;
    const missingArray = Array.from(missingBattles.entries());

    for (const [battleId, pubkey] of missingArray) {
      const result = await insertMinimalBattle(battleId, pubkey);
      
      switch (result) {
        case 'inserted':
          stats.inserted++;
          break;
        case 'exists':
          stats.alreadyExists++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }

      progressCount++;

      // Progress update every 10 inserts
      if (progressCount % 10 === 0 || progressCount === stats.missing) {
        console.log(`   Progress: ${progressCount}/${stats.missing} | Inserted: ${stats.inserted} | Failed: ${stats.failed}`);
      }

      // Rate limit to avoid overwhelming database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n============================================');
    console.log('✅ BACKFILL COMPLETE');
    console.log('============================================');
    console.log(`   Successfully inserted:   ${stats.inserted}`);
    console.log(`   Already existed:         ${stats.alreadyExists}`);
    console.log(`   Failed:                  ${stats.failed}`);
    console.log(`📅 Completed: ${new Date().toISOString()}`);
    console.log('============================================\n');

    if (stats.inserted > 0) {
      console.log('🔄 NEXT STEPS:');
      console.log('   Run the admin scan endpoint to populate battle details:\n');
      console.log('   curl -X POST "https://analytics-wave-warz.vercel.app/api/admin/scan-battles?limit=200&forceRefresh=true" \\');
      console.log('     -H "Authorization: Bearer YOUR_ADMIN_SECRET"\n');
    }

    return stats;

  } catch (error) {
    console.error('\n❌ BACKFILL FAILED:', error);
    throw error;
  }
}

// Run the backfill
backfillMissingBattles()
  .then((stats) => {
    console.log('🎉 Script completed successfully');
    process.exit(stats.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('💥 Script failed with error:', error);
    process.exit(1);
  });

export { backfillMissingBattles };
