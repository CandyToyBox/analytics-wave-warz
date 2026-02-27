
import { BattleState, SettlementStats, TraderSimulation, BattleHistoryPoint, ReplayEvent, BattleSummary, ArtistStats, BattleEvent } from './types';

// Constants defined in the blueprint
const FEES = {
  ARTIST_TRADING_FEE: 0.01,
  PLATFORM_TRADING_FEE: 0.005,
};

const DISTRIBUTION = {
  WINNING_TRADERS: 0.40,
  WINNING_ARTIST: 0.05,
  LOSING_ARTIST: 0.02,
  PLATFORM_BONUS: 0.03,
  LOSING_TRADERS: 0.50, // Stays with losing traders (returned value)
};

export const calculateTVLWinner = (state: BattleState): 'A' | 'B' => {
  return state.artistASolBalance > state.artistBSolBalance ? 'A' : 'B';
};

// Updated to 4 decimal places for micro-transactions
export const formatSol = (val: number): string => {
  return `◎${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
};

// New USD Formatter
export const formatUsd = (solAmount: number, solPrice: number): string => {
  if (!solPrice) return '';
  const usdVal = solAmount * solPrice;
  return `($${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD)`;
};

export const formatPct = (val: number): string => {
  return `${(val || 0).toFixed(2)}%`;
};

export const calculateSettlement = (state: BattleState): SettlementStats => {
  const winner = calculateTVLWinner(state);
  const isAWin = winner === 'A';
  
  const winnerTVL = isAWin ? state.artistASolBalance : state.artistBSolBalance;
  const loserTVL = isAWin ? state.artistBSolBalance : state.artistASolBalance;
  
  const winMargin = winnerTVL - loserTVL;
  
  // Step 4: Prize Pool Distribution
  // The blueprint states these percentages apply to the Loser's Pool
  const dist = {
    toWinningTraders: loserTVL * DISTRIBUTION.WINNING_TRADERS,
    toWinningArtist: loserTVL * DISTRIBUTION.WINNING_ARTIST,
    toLosingArtist: loserTVL * DISTRIBUTION.LOSING_ARTIST,
    toPlatform: loserTVL * DISTRIBUTION.PLATFORM_BONUS,
    toLosingTraders: loserTVL * DISTRIBUTION.LOSING_TRADERS,
  };

  // Step 3 & 6 & 7: Earnings Calculations
  // Accumulated fees during battle
  const artistAFees = state.totalVolumeA * FEES.ARTIST_TRADING_FEE;
  const artistBFees = state.totalVolumeB * FEES.ARTIST_TRADING_FEE;
  
  const platformFees = (state.totalVolumeA + state.totalVolumeB) * FEES.PLATFORM_TRADING_FEE;

  // Final Earnings Logic
  const artistASettlement = isAWin ? dist.toWinningArtist : dist.toLosingArtist;
  const artistBSettlement = isAWin ? dist.toLosingArtist : dist.toWinningArtist;

  const artistAEarnings = artistAFees + artistASettlement;
  const artistBEarnings = artistBFees + artistBSettlement;
  const platformEarnings = platformFees + dist.toPlatform;

  return {
    winnerId: winner,
    winMargin,
    loserPoolTotal: loserTVL,
    ...dist,
    // Artist A breakdown
    artistAFees,
    artistASettlement,
    artistAEarnings,
    // Artist B breakdown
    artistBFees,
    artistBSettlement,
    artistBEarnings,
    // Platform breakdown
    platformFees,
    platformSettlement: dist.toPlatform,
    platformEarnings
  };
};

export const calculateTraderRoi = (battleState: BattleState, sim: TraderSimulation) => {
    const winner = calculateTVLWinner(battleState);
    const isWin = sim.side === winner;
    
    // Simple simulation logic
    const investment = sim.investmentSol;
    let payout = 0;
    let note = '';

    if (isWin) {
        // Winner share logic
        const winnerPool = winner === 'A' ? battleState.artistASolBalance : battleState.artistBSolBalance;
        const loserPool = winner === 'A' ? battleState.artistBSolBalance : battleState.artistASolBalance;
        
        const share = winnerPool > 0 ? investment / winnerPool : 0;
        const winnings = loserPool * DISTRIBUTION.WINNING_TRADERS * share;
        
        payout = investment + winnings;
        note = 'Winner payout + share of loser pool';
    } else {
        // Loser share logic
        payout = investment * DISTRIBUTION.LOSING_TRADERS;
        note = 'Loser retains 50% of value';
    }

    const profit = payout - investment;
    const roi = investment > 0 ? (profit / investment) * 100 : 0;
    
    return { roi, payout, profit, note };
};

export const generateBattleHistory = (battle: BattleState, count: number = 100) => {
    const history: BattleHistoryPoint[] = [];
    const events: ReplayEvent[] = [];
    
    const now = Date.now();
    const start = battle.startTime || (now - 1000 * 60 * 60);
    const end = battle.endTime || now;
    const duration = end - start;
    const step = duration / count;
    
    let currentA = 0;
    let currentB = 0;
    const targetA = battle.artistASolBalance;
    const targetB = battle.artistBSolBalance;
    
    for (let i = 0; i <= count; i++) {
        const time = start + (step * i);
        const progress = i / count;
        
        // Cubic easing for visual effect
        const ease = 1 - Math.pow(1 - progress, 3);
        
        currentA = targetA * ease;
        currentB = targetB * ease;
        
        history.push({
            timestamp: time,
            tvlA: currentA,
            tvlB: currentB,
            volumeA: battle.totalVolumeA * ease,
            volumeB: battle.totalVolumeB * ease,
            priceA: 0,
            priceB: 0
        });
    }

    events.push({ timestamp: start, type: 'START', description: 'Battle Begins' });
    if (battle.isEnded) events.push({ timestamp: end, type: 'END', description: 'Battle Ends' });

    return { history, events };
};

export const calculateLeaderboard = (library: BattleSummary[]): ArtistStats[] => {
    const artistMap = new Map<string, ArtistStats>();
    
    const getOrInit = (artist: any): ArtistStats => {
        if (!artistMap.has(artist.name)) {
            artistMap.set(artist.name, {
                name: artist.name,
                wins: 0,
                losses: 0,
                totalBattles: 0,
                winRate: 0,
                avatar: artist.avatar,
                lastActive: "",
                totalVolume: 0,
                totalTVL: 0,
                biggestWin: 0
            });
        }
        return artistMap.get(artist.name)!;
    };

    library.forEach(battle => {
        const a = getOrInit(battle.artistA);
        const b = getOrInit(battle.artistB);
        
        a.totalBattles++;
        b.totalBattles++;
        
        if (battle.createdAt > a.lastActive) a.lastActive = battle.createdAt;
        if (battle.createdAt > b.lastActive) b.lastActive = battle.createdAt;
    });

    return Array.from(artistMap.values()).sort((a, b) => b.totalBattles - a.totalBattles);
};

// --- EVENT GROUPING LOGIC ---
export const groupBattlesIntoEvents = (battles: BattleSummary[]): BattleEvent[] => {
  const events: BattleEvent[] = [];
  
  // Sort by date ascending first to process rounds in order
  // Exclude Quick Battles — they are song vs song battles and should not be grouped as events
  const sortedBattles = [...battles]
    .filter(b => !b.isQuickBattle)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  sortedBattles.forEach(battle => {
    // Check if this battle belongs to the latest event processed
    const lastEvent = events[events.length - 1];
    
    if (lastEvent) {
      // Logic: Same artists, created within 8 hours of the event's first round
      const sameArtists = 
        (battle.artistA.name === lastEvent.artistA.name && battle.artistB.name === lastEvent.artistB.name) ||
        (battle.artistA.name === lastEvent.artistB.name && battle.artistB.name === lastEvent.artistA.name);
      
      const eventTime = new Date(lastEvent.date).getTime();
      const battleTime = new Date(battle.createdAt).getTime();
      const timeDiffHours = (battleTime - eventTime) / (1000 * 60 * 60);

      if (sameArtists && timeDiffHours < 8) {
        lastEvent.rounds.push(battle);
        return;
      }
    }

    // New Event
    events.push({
      id: battle.id,
      date: battle.createdAt,
      artistA: battle.artistA,
      artistB: battle.artistB,
      rounds: [battle],
      imageUrl: battle.imageUrl,
      isCommunityEvent: !!battle.isCommunityBattle
    });
  });

  // Return events sorted by date descending (newest first)
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};