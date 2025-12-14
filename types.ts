
export interface Artist {
  id: string;
  name: string;
  color: string;
  avatar: string; // From image_url or generated
  wallet: string;
  mint?: string;
  twitter?: string;
  musicLink?: string;
}

export interface BattleSummary {
  id: string; // The UUID
  battleId: string; // The numeric ID (174...)
  createdAt: string;
  status: string;
  artistA: Artist;
  artistB: Artist;
  battleDuration: number;
  winnerDecided: boolean;
  imageUrl: string;
  streamLink?: string;
  
  // Optional pre-filled data
  artistASolBalance?: number;
  artistBSolBalance?: number;

  // New fields from updated CSV
  creatorWallet?: string;
  isCommunityBattle?: boolean;
  communityRoundId?: string;
  isTestBattle?: boolean;

  // --- CACHED DYNAMIC DATA ---
  totalVolumeA?: number;
  totalVolumeB?: number;
  tradeCount?: number;
  uniqueTraders?: number;
  lastScannedAt?: string;
  recentTrades?: RecentTrade[];
}

export interface BattleEvent {
  id: string; // Derived from the first round's ID
  date: string;
  artistA: Artist;
  artistB: Artist;
  rounds: BattleSummary[]; // Chronological order
  imageUrl: string;
  isCommunityEvent: boolean;
}

export interface RecentTrade {
  signature: string;
  amount: number;
  artistId: 'A' | 'B' | 'Unknown';
  type: 'BUY' | 'SELL';
  timestamp: number;
  trader: string;
}

export interface BattleState extends BattleSummary {
  startTime: number;
  endTime: number;
  isEnded: boolean;
  
  // Dynamic Chain Data (Fetched from Blockchain)
  artistASolBalance: number; // TVL A
  artistBSolBalance: number; // TVL B
  artistASupply: number;
  artistBSupply: number;
  
  // Real On-Chain Addresses (Decoded from PDA)
  battleAddress: string;     // The PDA of the battle
  onChainMintA?: string;
  onChainMintB?: string;
  onChainWalletA?: string;
  onChainWalletB?: string;
  treasuryWallet?: string;

  // Transaction Accumulators
  totalVolumeA: number;
  totalVolumeB: number;
  tradeCount: number;
  uniqueTraders: number;
  
  // New: List of actual trades for the ticker
  recentTrades: RecentTrade[];
}

export interface BattleHistoryPoint {
  timestamp: number;
  tvlA: number;
  tvlB: number;
  volumeA: number;
  volumeB: number;
  priceA: number;
  priceB: number;
}

export interface ReplayEvent {
  timestamp: number;
  type: 'LEAD_CHANGE' | 'WHALE_BUY' | 'WHALE_SELL' | 'START' | 'END';
  description: string;
  artistId?: 'A' | 'B';
}

export interface SettlementStats {
  winnerId: string;
  winMargin: number;
  loserPoolTotal: number;

  // Distribution (Absolute SOL values)
  toWinningTraders: number;
  toWinningArtist: number;
  toLosingArtist: number;
  toPlatform: number;
  toLosingTraders: number;

  // Artist A earnings breakdown
  artistAFees: number;           // 1% of Artist A's trading volume
  artistASettlement: number;     // Settlement bonus (2% or 5% of loser pool)
  artistAEarnings: number;       // Total (fees + settlement)

  // Artist B earnings breakdown
  artistBFees: number;           // 1% of Artist B's trading volume
  artistBSettlement: number;     // Settlement bonus (2% or 5% of loser pool)
  artistBEarnings: number;       // Total (fees + settlement)

  // Platform earnings breakdown
  platformFees: number;          // 0.5% of total trading volume
  platformSettlement: number;    // 3% of loser pool
  platformEarnings: number;      // Total (fees + settlement)
}

export interface TraderSimulation {
  side: 'A' | 'B';
  investmentSol: number;
  tokensHeld: number;
}

export interface ArtistStats {
  name: string;
  wins: number;
  losses: number;
  totalBattles: number;
  winRate: number;
  avatar: string;
  lastActive: string;
  
  // New Advanced Stats
  totalVolume: number; // Total SOL volume generated in their battles
  totalTVL: number;    // Peak TVL across all battles
  biggestWin: number;  // Largest single battle TVL
}

// --- ARTIST LEADERBOARD TYPES ---

export interface ArtistLeaderboardStats {
  artistName: string;
  walletAddress: string;
  imageUrl?: string;
  twitterHandle?: string;
  musicLink?: string;

  // Earnings
  totalEarningsSol: number;
  totalEarningsUsd: number;
  spotifyStreamEquivalents: number;
  
  // Breakdown
  tradingFeeEarnings: number;
  settlementEarnings: number;

  // Performance
  battlesParticipated: number;
  wins: number;
  losses: number;
  winRate: number;
  
  // Volume
  totalVolumeGenerated: number;
  avgVolumePerBattle: number;
  
  // Records
  bestBattleEarnings: number;
  bestBattleName: string;
}

// --- TRADER ANALYTICS TYPES ---

export interface TraderTransaction {
  signature: string;
  type: 'INVEST' | 'PAYOUT';
  amount: number;
  date: string;
}

export interface TraderBattleHistory {
  battleId: string;
  artistAName: string;
  artistBName: string;
  imageUrl: string;
  date: string;
  invested: number;
  payout: number;
  pnl: number;
  side?: 'A' | 'B';
  outcome: 'WIN' | 'LOSS' | 'PENDING';
  transactions: TraderTransaction[];
}

export interface TraderProfileStats {
  walletAddress: string;
  totalInvested: number;
  totalPayout: number;
  netPnL: number;
  battlesParticipated: number;
  wins: number;
  losses: number;
  winRate: number;
  favoriteArtist: string;
  history: TraderBattleHistory[];
  lastUpdated?: string;
}

export interface TraderLeaderboardEntry {
  walletAddress: string;
  totalInvested: number;
  totalPayout: number;
  netPnL: number;
  roi: number;
  battlesParticipated: number;
  wins: number;
  losses: number;
  winRate: number;
}
