import { BattleSummary, ArtistLeaderboardStats, BattleState } from '../types';
import { calculateTVLWinner, calculateSettlement } from '../utils';

// Constants
const SPOTIFY_PER_STREAM_USD = 0.003;

// Helper to init an artist entry
const initArtistStats = (name: string, wallet: string, avatar?: string, twitter?: string, music?: string): ArtistLeaderboardStats => ({
  artistName: name,
  walletAddress: wallet,
  imageUrl: avatar,
  twitterHandle: twitter,
  musicLink: music,
  totalEarningsSol: 0,
  totalEarningsUsd: 0,
  spotifyStreamEquivalents: 0,
  tradingFeeEarnings: 0,
  settlementEarnings: 0,
  battlesParticipated: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  totalVolumeGenerated: 0,
  avgVolumePerBattle: 0,
  bestBattleEarnings: 0,
  bestBattleName: '',
});

/**
 * Calculates leaderboard data. 
 * NOTE: For "Trading Fees", this relies on the BattleState having volume data. 
 * If using raw BattleSummary from DB without on-chain scan, volume will be 0.
 */
export function calculateArtistLeaderboard(
  battles: BattleState[], 
  solPrice: number
): ArtistLeaderboardStats[] {
  const statsMap = new Map<string, ArtistLeaderboardStats>();

  const getOrInit = (artist: any) => {
    // Normalize key by wallet if available, else name
    const key = artist.wallet || artist.name;
    if (!statsMap.has(key)) {
      statsMap.set(key, initArtistStats(artist.name, artist.wallet, artist.avatar, artist.twitter, artist.musicLink));
    }
    return statsMap.get(key)!;
  };

  battles.forEach(battle => {
    // Skip battles with no meaningful data: no pool balance, no actual volume, and no decided winner
    const hasPoolData = !!(battle.artistASolBalance || battle.artistBSolBalance);
    const hasVolumeData = !!(battle.totalVolumeA || battle.totalVolumeB);
    const hasWinnerData = battle.winnerDecided && battle.winnerArtistA !== undefined;
    if (!hasPoolData && !hasVolumeData && !hasWinnerData) return;

    const statsA = getOrInit(battle.artistA);
    const statsB = getOrInit(battle.artistB);

    statsA.battlesParticipated++;
    statsB.battlesParticipated++;

    // Volume Attribution
    statsA.totalVolumeGenerated += battle.totalVolumeA;
    statsB.totalVolumeGenerated += battle.totalVolumeB;

    // Determine Winner for Settlement
    const winnerId = calculateTVLWinner(battle);
    const settlement = calculateSettlement(battle);

    // --- ARTIST A EARNINGS ---
    // 1. Trading Fees (1% of volume on their side)
    const feesA = battle.totalVolumeA * 0.01;
    // 2. Settlement
    const settlementA = winnerId === 'A' ? settlement.toWinningArtist : settlement.toLosingArtist;
    
    const totalA = feesA + settlementA;
    
    statsA.tradingFeeEarnings += feesA;
    statsA.settlementEarnings += settlementA;
    statsA.totalEarningsSol += totalA;

    if (totalA > statsA.bestBattleEarnings) {
        statsA.bestBattleEarnings = totalA;
        statsA.bestBattleName = `vs ${battle.artistB.name}`;
    }

    if (winnerId === 'A') statsA.wins++; else statsA.losses++;

    // --- ARTIST B EARNINGS ---
    const feesB = battle.totalVolumeB * 0.01;
    const settlementB = winnerId === 'B' ? settlement.toWinningArtist : settlement.toLosingArtist;

    const totalB = feesB + settlementB;

    statsB.tradingFeeEarnings += feesB;
    statsB.settlementEarnings += settlementB;
    statsB.totalEarningsSol += totalB;

    if (totalB > statsB.bestBattleEarnings) {
        statsB.bestBattleEarnings = totalB;
        statsB.bestBattleName = `vs ${battle.artistA.name}`;
    }

    if (winnerId === 'B') statsB.wins++; else statsB.losses++;
  });

  // Final Calculations (USD, Stream Equivs, Rates)
  return Array.from(statsMap.values()).map(stat => {
    stat.winRate = stat.battlesParticipated > 0 ? (stat.wins / stat.battlesParticipated) * 100 : 0;
    stat.avgVolumePerBattle = stat.battlesParticipated > 0 ? stat.totalVolumeGenerated / stat.battlesParticipated : 0;
    
    stat.totalEarningsUsd = stat.totalEarningsSol * solPrice;
    
    // THE BIG CALCULATION: Spotify Equivalent
    // Earnings USD / 0.003
    stat.spotifyStreamEquivalents = stat.totalEarningsUsd > 0 
      ? Math.floor(stat.totalEarningsUsd / SPOTIFY_PER_STREAM_USD) 
      : 0;

    return stat;
  }).sort((a, b) => b.totalEarningsSol - a.totalEarningsSol);
}

export function mockEstimateVolumes(battles: BattleSummary[]): BattleState[] {
  // Use DB-cached volumes when available; fall back to a 1.5× TVL estimate
  // so the leaderboard shows real numbers as soon as a scan has been stored.
  return battles.map(b => ({
     ...b,
     startTime: new Date(b.createdAt).getTime(),
     endTime: new Date(b.createdAt).getTime() + (b.battleDuration * 1000),
     isEnded: true, // assume historical for list
     artistASolBalance: b.artistASolBalance || 0,
     artistBSolBalance: b.artistBSolBalance || 0,
     artistASupply: 0,
     artistBSupply: 0,
     totalVolumeA: b.totalVolumeA ?? (b.artistASolBalance || 0) * 1.5,
     totalVolumeB: b.totalVolumeB ?? (b.artistBSolBalance || 0) * 1.5,
     tradeCount: b.tradeCount ?? 0,
     uniqueTraders: b.uniqueTraders ?? 0,
     recentTrades: b.recentTrades ?? [],
     battleAddress: '',
  }));
}