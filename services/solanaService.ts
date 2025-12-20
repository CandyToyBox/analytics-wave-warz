import { BattleState, BattleSummary, RecentTrade, TraderProfileStats, TraderBattleHistory, TraderTransaction, TraderLeaderboardEntry } from '../types';
import { PublicKey, Connection } from '@solana/web3.js';
import { updateBattleDynamicStats, fetchTraderSnapshotFromDB, saveTraderSnapshotToDB } from './supabaseClient';

// --- CONFIGURATION ---
const HELIUS_API_KEY = "8b84d8d3-59ad-4778-829b-47db8a9149fa";
const PROGRAM_ID = new PublicKey("9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo");
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const BATTLE_SEED = 'battle';
const VAULT_SEED = 'battle_vault';

// --- PERFORMANCE OPTIMIZATION ---
// Create the encoder once instead of every time deriveBattlePDA is called
const encoder = new TextEncoder();
const battleSeedBuffer = encoder.encode(BATTLE_SEED);
const vaultSeedBuffer = encoder.encode(VAULT_SEED);

// --- CACHING SYSTEM ---
interface CacheEntry {
  data: BattleState;
  timestamp: number;
}
const battleCache = new Map<string, CacheEntry>();
const CACHE_TTL = 300_000; // 5 minutes (Matches database cache validity idea)

// --- HELPERS ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Rate Limited Fetch Wrapper
// Increased retries to 6 and backoff to 2000ms base
async function fetchWithRetry(url: string, options?: RequestInit, retries = 6, backoff = 2000): Promise<any> {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      if (retries <= 0) throw new Error("Rate limit exceeded");
      console.warn(`Rate limited. Retrying in ${backoff}ms...`);
      await sleep(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    if (retries <= 0) throw err;
    await sleep(backoff);
    return fetchWithRetry(url, options, retries - 1, backoff * 2);
  }
}

// --- 1. PDA DERIVATION ---

export const deriveBattlePDA = (battleId: string | number): PublicKey => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(battleId), true); 
  
  const [pda] = PublicKey.findProgramAddressSync(
    [
      battleSeedBuffer,
      new Uint8Array(buffer)
    ],
    PROGRAM_ID
  );
  return pda;
};

export const deriveBattleVaultPDA = (battleId: string | number): PublicKey => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(battleId), true); 
  
  const [pda] = PublicKey.findProgramAddressSync(
    [
      vaultSeedBuffer,
      new Uint8Array(buffer)
    ],
    PROGRAM_ID
  );
  return pda;
};

// --- 2. ACCOUNT DECODING ---

function decodeBattleAccount(data: Uint8Array, summary: BattleSummary): Partial<BattleState> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8; // Skip Discriminator

  const onChainBattleId = view.getBigUint64(offset, true); offset += 8;
  offset += 4; // bumps

  const startTime = Number(view.getBigInt64(offset, true)); offset += 8;
  const endTime = Number(view.getBigInt64(offset, true)); offset += 8;

  // Extract Public Keys (32 bytes each)
  const artistAWallet = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
  const artistBWallet = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
  const treasuryWallet = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
  const mintA = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
  const mintB = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;

  const artistASupply = Number(view.getBigUint64(offset, true)) / 1_000_000; offset += 8;
  const artistBSupply = Number(view.getBigUint64(offset, true)) / 1_000_000; offset += 8;

  const artistASolBalance = Number(view.getBigUint64(offset, true)) / 1_000_000_000; offset += 8;
  const artistBSolBalance = Number(view.getBigUint64(offset, true)) / 1_000_000_000; offset += 8;

  offset += 16; // Internal pools

  const winnerArtistA = view.getUint8(offset) === 1; offset += 1;
  const winnerDecided = view.getUint8(offset) === 1; offset += 1;

  offset += 1; // transaction_state
  offset += 1; // is_initialized

  const isActive = view.getUint8(offset) === 1; offset += 1;

  const totalDistribution = Number(view.getBigUint64(offset, true)) / 1_000_000_000; offset += 8;

  return {
    startTime: startTime * 1000,
    endTime: endTime * 1000,
    isEnded: !isActive || (Date.now() > endTime * 1000),
    artistASolBalance,
    artistBSolBalance,
    artistASupply,
    artistBSupply,
    winnerDecided,
    // On-Chain Address Data
    onChainWalletA: artistAWallet,
    onChainWalletB: artistBWallet,
    onChainMintA: mintA,
    onChainMintB: mintB,
    treasuryWallet: treasuryWallet
  };
}

// --- 3. HELIUS FETCHING ---

export async function fetchBattleOnChain(summary: BattleSummary, forceRefresh = false): Promise<BattleState> {
  // A. Check Database/Local Cache validity first
  // If we have data cached in summary that is recent (e.g. from fetchBattlesFromSupabase), use it.
  const isRecent = summary.lastScannedAt && (Date.now() - new Date(summary.lastScannedAt).getTime() < CACHE_TTL);
  
  if (!forceRefresh && isRecent && summary.totalVolumeA !== undefined) {
    // Construct BattleState from cached summary without RPC call
    const battlePda = deriveBattlePDA(summary.battleId).toBase58();
    return {
        ...summary,
        battleAddress: battlePda,
        startTime: new Date(summary.createdAt).getTime(), // Fallback if not stored
        endTime: new Date(summary.createdAt).getTime() + (summary.battleDuration * 1000), // Fallback
        isEnded: true, // Assume ended if using cache for older battles
        artistASolBalance: summary.artistASolBalance || 0,
        artistBSolBalance: summary.artistBSolBalance || 0,
        artistASupply: 0,
        artistBSupply: 0,
        totalVolumeA: summary.totalVolumeA || 0,
        totalVolumeB: summary.totalVolumeB || 0,
        tradeCount: summary.tradeCount || 0,
        uniqueTraders: summary.uniqueTraders || 0,
        recentTrades: summary.recentTrades || []
    };
  }

  // B. Fallback to Memory Cache
  const cached = battleCache.get(summary.battleId);
  if (!forceRefresh && cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  // C. RPC Fetch
  const connection = new Connection(RPC_URL);
  const battlePda = deriveBattlePDA(summary.battleId);
  const vaultPda = deriveBattleVaultPDA(summary.battleId);
  const battleAddress = battlePda.toBase58();

  const accountInfo = await connection.getAccountInfo(battlePda);
  
  if (!accountInfo) {
    console.warn("Battle Account not found on-chain.");
    return {
      ...summary,
      battleAddress,
      startTime: Date.now(),
      endTime: Date.now() + summary.battleDuration * 1000,
      isEnded: false,
      artistASolBalance: 0,
      artistBSolBalance: 0,
      artistASupply: 0,
      artistBSupply: 0,
      totalVolumeA: 0,
      totalVolumeB: 0,
      tradeCount: 0,
      uniqueTraders: 0,
      recentTrades: []
    };
  }

  const chainData = decodeBattleAccount(accountInfo.data, summary);

  // D. Fetch Transaction History (Graceful Fallback)
  let historyStats = { volumeA: 0, volumeB: 0, tradeCount: 0, uniqueTraders: 0, recentTrades: [] as RecentTrade[] };
  try {
    historyStats = await fetchTransactionStats(battleAddress, vaultPda.toBase58(), chainData.artistASolBalance || 0, chainData.artistBSolBalance || 0);
  } catch (e) {
    console.error("History fetch failed, returning partial data", e);
  }

  const result: BattleState = {
    ...summary,
    ...chainData,
    battleAddress,
    artistASolBalance: chainData.artistASolBalance ?? 0,
    artistBSolBalance: chainData.artistBSolBalance ?? 0,
    startTime: chainData.startTime ?? Date.now(),
    endTime: chainData.endTime ?? Date.now(),
    isEnded: chainData.isEnded ?? false,
    artistASupply: chainData.artistASupply ?? 0,
    artistBSupply: chainData.artistBSupply ?? 0,
    totalVolumeA: historyStats.volumeA,
    totalVolumeB: historyStats.volumeB,
    tradeCount: historyStats.tradeCount,
    uniqueTraders: historyStats.uniqueTraders,
    recentTrades: historyStats.recentTrades
  };

  // E. Update Caches
  battleCache.set(summary.battleId, { data: result, timestamp: Date.now() });
  
  // Fire and forget update to database
  updateBattleDynamicStats(result);

  return result;
}

// --- 4. TRANSACTION PARSING ---

// Generic fetcher for address transactions to be reused
async function fetchAddressTransactions(address: string, limit: number = 50, beforeSignature?: string) {
    const query = `&limit=${limit}${beforeSignature ? `&before=${beforeSignature}` : ''}`;
    const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${address}/transactions/?api-key=${HELIUS_API_KEY}${query}`;
    return await fetchWithRetry(url);
}

async function fetchTransactionStats(battleAddress: string, vaultAddress: string, tvlA: number, tvlB: number) {
  console.log(`🔍 Fetching transaction stats for battle at ${battleAddress.substring(0, 8)}...`);
  let volumeA = 0;
  let volumeB = 0;
  let tradeCount = 0;
  const traders = new Set<string>();
  const recentTrades: RecentTrade[] = [];
  
  let beforeSignature = "";
  let hasMore = true;
  const LIMIT = 100; // Limit fetch for performance in demo
  let fetchedCount = 0;

  const totalTvl = tvlA + tvlB || 1;
  const ratioA = tvlA / totalTvl;

  while (hasMore && fetchedCount < LIMIT) {
    const txs = await fetchAddressTransactions(battleAddress, 50, beforeSignature);
    
    if (!txs || txs.length === 0) {
      hasMore = false;
      break;
    }

    for (const tx of txs) {
      if (tx.nativeTransfers) {
        let txVal = 0;
        let isBuy = false;
        let trader = '';

        for (const transfer of tx.nativeTransfers) {
           if (transfer.toUserAccount === vaultAddress || transfer.toUserAccount === battleAddress) {
             // BUY
             txVal += transfer.amount / 1_000_000_000;
             trader = transfer.fromUserAccount;
             traders.add(transfer.fromUserAccount);
             isBuy = true;
           } else if (transfer.fromUserAccount === vaultAddress || transfer.fromUserAccount === battleAddress) {
             // SELL
             txVal += transfer.amount / 1_000_000_000;
             trader = transfer.toUserAccount;
             traders.add(transfer.toUserAccount);
             isBuy = false;
           }
        }

        if (txVal > 0 && trader) {
          tradeCount++;
          volumeA += txVal; 

          if (recentTrades.length < 20) {
            recentTrades.push({
              signature: tx.signature,
              amount: txVal,
              artistId: 'Unknown', 
              type: isBuy ? 'BUY' : 'SELL',
              timestamp: tx.timestamp * 1000,
              trader
            });
          }
        }
      }
      beforeSignature = tx.signature;
    }
    
    fetchedCount += txs.length;
    if (txs.length < 50) hasMore = false;
  }

  const finalVolumeA = volumeA * ratioA;
  const finalVolumeB = volumeA * (1 - ratioA);

  console.log(`✅ Transaction stats fetched:`, {
    totalVolume: volumeA.toFixed(4),
    volumeA: finalVolumeA.toFixed(4),
    volumeB: finalVolumeB.toFixed(4),
    tradeCount,
    uniqueTraders: traders.size,
    txsFetched: fetchedCount,
    note: 'Volume split proportionally based on TVL ratio (A:B)'
  });

  // NOTE: We split total volume proportionally between A and B based on TVL ratio
  // because transaction data doesn't indicate which specific artist token was traded.
  // This provides a reasonable approximation of volume attribution.
  return {
    volumeA: finalVolumeA, 
    volumeB: finalVolumeB,
    tradeCount,
    uniqueTraders: traders.size,
    recentTrades
  };
}

// --- 5. TRADER ANALYTICS SERVICE ---

export async function fetchBatchTraderStats(battles: BattleSummary[]): Promise<Map<string, { invested: number, payout: number, battles: Set<string> }>> {
    const traderMap = new Map<string, {
        invested: number;
        payout: number;
        battles: Set<string>;
    }>();

    for (const battle of battles) {
        const battlePda = deriveBattlePDA(battle.battleId).toBase58();
        const vaultPda = deriveBattleVaultPDA(battle.battleId).toBase58();

        let beforeSignature = "";
        let hasMore = true;
        let fetchedCount = 0;
        const DEPTH_LIMIT = 50; 

        try {
            while (hasMore && fetchedCount < DEPTH_LIMIT) {
                const txs = await fetchAddressTransactions(battlePda, 50, beforeSignature);

                if (!txs || txs.length === 0) {
                   hasMore = false;
                   break;
                }

                for (const tx of txs) {
                    if (!tx.nativeTransfers) continue;

                    for (const transfer of tx.nativeTransfers) {
                        const amount = transfer.amount / 1_000_000_000;
                        let trader = '';
                        let type: 'INVEST' | 'PAYOUT' | null = null;

                        if (transfer.toUserAccount === vaultPda || transfer.toUserAccount === battlePda) {
                            trader = transfer.fromUserAccount;
                            type = 'INVEST';
                        } 
                        else if (transfer.fromUserAccount === vaultPda || transfer.fromUserAccount === battlePda) {
                            trader = transfer.toUserAccount;
                            type = 'PAYOUT';
                        }

                        if (trader && type) {
                             if (!traderMap.has(trader)) {
                                 traderMap.set(trader, { invested: 0, payout: 0, battles: new Set() });
                             }
                             const entry = traderMap.get(trader)!;
                             if (type === 'INVEST') entry.invested += amount;
                             if (type === 'PAYOUT') entry.payout += amount;
                             entry.battles.add(battle.id);
                        }
                    }
                    beforeSignature = tx.signature;
                }
                fetchedCount += txs.length;
                if (txs.length < 50) hasMore = false;
            }
        } catch (e) {
            console.warn(`Failed to aggregate battle ${battle.id}`, e);
        }
    }

    return traderMap;
}

export async function fetchTraderProfile(walletAddress: string, library: BattleSummary[]): Promise<TraderProfileStats> {
  // A. Check Database Cache First
  const cached = await fetchTraderSnapshotFromDB(walletAddress);
  if (cached) {
      // Check if reasonably fresh (e.g. < 24h) or just return immediately for demo
      // You can add timestamp check here if desired
      return cached;
  }

  // B. Fetch Live from Helius if no cache
  const allTxs: any[] = [];
  let beforeSignature = '';
  let hasMore = true;
  let page = 0;
  const MAX_PAGES = 10; 

  while (hasMore && page < MAX_PAGES) {
    const query = `&limit=100${beforeSignature ? `&before=${beforeSignature}` : ''}`;
    const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions/?api-key=${HELIUS_API_KEY}${query}`;
    
    try {
      const batch = await fetchWithRetry(url);
      
      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }
      allTxs.push(...batch);
      const lastTx = batch[batch.length - 1];
      beforeSignature = lastTx.signature;
      page++;

    } catch (e) {
      console.error(`Failed to fetch trader history page ${page}`, e);
      hasMore = false; 
    }
  }

  const history: TraderBattleHistory[] = [];
  const battleMap = new Map<string, BattleSummary>();
  
  library.forEach(b => {
     const pda = deriveBattlePDA(b.battleId).toBase58();
     const vault = deriveBattleVaultPDA(b.battleId).toBase58();
     battleMap.set(pda, b);
     battleMap.set(vault, b);
  });

  const wavewarzProgramId = PROGRAM_ID.toBase58();

  let totalInvested = 0;
  let totalPayout = 0;
  const battlesParticipated = new Set<string>();

  for (const tx of allTxs) {
    const accountKeys = tx.accountData?.map((a: any) => a.account) || [];
    const involvesProgram = accountKeys.includes(wavewarzProgramId) || 
                            tx.instructions?.some((ix: any) => ix.programId === wavewarzProgramId);

    if (!tx.nativeTransfers) continue;

    for (const transfer of tx.nativeTransfers) {
       const amount = transfer.amount / 1_000_000_000;
       
       if (transfer.fromUserAccount === walletAddress) {
          const knownBattle = battleMap.get(transfer.toUserAccount);
          
          if (knownBattle) {
             totalInvested += amount;
             battlesParticipated.add(knownBattle.id);
             
             updateHistory(
               history, 
               knownBattle.id, 
               knownBattle.artistA.name, 
               knownBattle.artistB.name, 
               knownBattle.imageUrl, 
               knownBattle.createdAt, 
               amount, 
               0,
               { signature: tx.signature, type: 'INVEST', amount, date: new Date(tx.timestamp * 1000).toISOString() }
             );
          } else if (involvesProgram) {
             const unknownId = `unlisted-${transfer.toUserAccount}`;
             totalInvested += amount;
             battlesParticipated.add(unknownId);

             updateHistory(
               history, 
               unknownId, 
               `Unlisted Battle`, 
               `Unknown Opponent`, 
               "", 
               new Date(tx.timestamp * 1000).toISOString(), 
               amount, 
               0,
               { signature: tx.signature, type: 'INVEST', amount, date: new Date(tx.timestamp * 1000).toISOString() }
             );
          }
       }
       
       if (transfer.toUserAccount === walletAddress) {
          const knownBattle = battleMap.get(transfer.fromUserAccount);
          
          if (knownBattle) {
             totalPayout += amount;
             battlesParticipated.add(knownBattle.id);
             updateHistory(
               history, 
               knownBattle.id, 
               knownBattle.artistA.name, 
               knownBattle.artistB.name, 
               knownBattle.imageUrl, 
               knownBattle.createdAt, 
               0, 
               amount,
               { signature: tx.signature, type: 'PAYOUT', amount, date: new Date(tx.timestamp * 1000).toISOString() }
             );
          } else if (involvesProgram) {
             const unknownId = `unlisted-${transfer.fromUserAccount}`;
             totalPayout += amount;
             battlesParticipated.add(unknownId);
             updateHistory(
               history, 
               unknownId, 
               `Unlisted Battle`, 
               `Unknown Opponent`, 
               "", 
               new Date(tx.timestamp * 1000).toISOString(), 
               0, 
               amount,
               { signature: tx.signature, type: 'PAYOUT', amount, date: new Date(tx.timestamp * 1000).toISOString() }
             );
          }
       }
    }
  }

  history.forEach(h => {
    h.pnl = h.payout - h.invested;
    if (h.pnl > 0) h.outcome = 'WIN';
    else if (h.pnl < 0 && h.payout > 0) h.outcome = 'LOSS'; 
    else if (h.payout === 0) h.outcome = 'PENDING';
  });

  const wins = history.filter(h => h.outcome === 'WIN').length;
  const losses = history.filter(h => h.outcome === 'LOSS').length;
  
  const stats = {
    walletAddress,
    totalInvested,
    totalPayout,
    netPnL: totalPayout - totalInvested,
    battlesParticipated: battlesParticipated.size,
    wins,
    losses,
    winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
    favoriteArtist: "Unknown", 
    history: history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    lastUpdated: new Date().toISOString()
  };

  // C. Save to DB Cache
  saveTraderSnapshotToDB(stats);

  return stats;
}

function updateHistory(
  history: TraderBattleHistory[], 
  battleId: string, 
  nameA: string, 
  nameB: string, 
  img: string, 
  date: string, 
  invested: number, 
  payout: number,
  tx: TraderTransaction
) {
  const existingEntry = history.find(h => h.battleId === battleId);
  if (existingEntry) {
    existingEntry.invested += invested;
    existingEntry.payout += payout;
    existingEntry.transactions.push(tx);
  } else {
     history.push({
       battleId,
       artistAName: nameA,
       artistBName: nameB,
       imageUrl: img,
       date: date,
       invested,
       payout,
       pnl: 0,
       outcome: 'PENDING',
       transactions: [tx]
     });
  }
}