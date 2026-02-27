import React from 'react';
import { useCommunityLeaderboard } from '../src/hooks/useBattleData';
import { formatSol, formatUsd, formatPct } from '../utils';
import { Music, Disc, Users, Loader2 } from 'lucide-react';

/** Covers both view-sourced data and client-side computed ArtistStats */
interface CommunityArtistEntry {
  artist_name?: string;
  image_url?: string | null;
  total_sol_earned?: number;
  battles_participated?: number;
  wins?: number;
  losses?: number;
  win_rate?: number;
  // client-side computed shape
  artistName?: string;
  imageUrl?: string;
  totalEarningsSol?: number;
  battlesParticipated?: number;
  winRate?: number;
}

function getName(a: CommunityArtistEntry): string {
  return a.artist_name ?? a.artistName ?? 'Unknown';
}
function getEarnings(a: CommunityArtistEntry): number {
  return a.total_sol_earned ?? a.totalEarningsSol ?? 0;
}
function getBattles(a: CommunityArtistEntry): number {
  return a.battles_participated ?? a.battlesParticipated ?? 0;
}
function getWinRate(a: CommunityArtistEntry): number {
  return a.win_rate ?? a.winRate ?? 0;
}
function getWins(a: CommunityArtistEntry): number {
  return a.wins ?? 0;
}
function getLosses(a: CommunityArtistEntry): number {
  return a.losses ?? 0;
}
function getImage(a: CommunityArtistEntry): string | null | undefined {
  return a.image_url ?? a.imageUrl;
}

interface Props {
  solPrice: number;
}

export const CommunityLeaderboard: React.FC<Props> = ({ solPrice }) => {
  const { data: rawStats = [], isFetching } = useCommunityLeaderboard();
  const stats = rawStats as CommunityArtistEntry[];

  const topArtist = stats[0];
  const runnersUp = stats.slice(1, 3);
  const rest = stats.slice(3);

  const totalPayouts = stats.reduce((acc, curr) => acc + getEarnings(curr), 0);

  if (isFetching && stats.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-ui-gray">
        <Loader2 className="animate-spin mr-3" size={24} />
        Loading community leaderboard...
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-ui-gray gap-3">
        <Users size={40} className="opacity-30" />
        <p>No community battles found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Stats */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 md:p-8 text-center relative overflow-hidden shadow-lg">
        <div className="relative z-10">
          <h2 className="text-wave-green text-sm uppercase tracking-widest font-bold mb-2">Community Artist Payouts</h2>
          <div className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">
            {formatSol(totalPayouts)}
            <span className="text-2xl text-ui-gray font-normal ml-2">({formatUsd(totalPayouts, solPrice)})</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-wave-green/10 text-wave-green px-4 py-2 rounded-full border border-wave-green/20 mt-4">
            <Users size={18} />
            <span className="font-bold">Community Battles Only</span>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-wave-green/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Top 3 Podium */}
      {topArtist && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          {runnersUp[0] && <CommunityArtistCard artist={runnersUp[0]} rank={2} solPrice={solPrice} />}
          <CommunityArtistCard artist={topArtist} rank={1} solPrice={solPrice} isWinner />
          {runnersUp[1] && <CommunityArtistCard artist={runnersUp[1]} rank={3} solPrice={solPrice} />}
        </div>
      )}

      {/* Rank 4+ List */}
      {rest.length > 0 && (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
          <div className="p-4 bg-navy-900 border-b border-navy-700 text-xs font-bold text-ui-gray uppercase tracking-wider flex justify-between">
            <span>Rank 4+</span>
            <span>Earnings</span>
          </div>
          <div className="divide-y divide-navy-700">
            {rest.map((artist, idx) => {
              const name = getName(artist);
              const earnings = getEarnings(artist);
              const battles = getBattles(artist);
              const winRate = getWinRate(artist);
              const imageUrl = getImage(artist);
              return (
                <div key={name + idx} className="p-4 hover:bg-navy-700 transition-colors flex items-center gap-4">
                  <div className="font-mono text-ui-gray w-8 text-center font-bold">#{idx + 4}</div>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-navy-900 overflow-hidden shrink-0 border border-navy-700 flex items-center justify-center">
                      {imageUrl ? (
                        <img src={imageUrl} className="w-full h-full object-cover" alt={name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ui-gray">
                          <Music size={16} />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white">{name}</div>
                      <div className="text-xs text-ui-gray">{battles} Battles · {formatPct(winRate)} WR</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white font-mono">{formatSol(earnings)}</div>
                    <div className="text-[10px] text-ui-gray">{formatUsd(earnings, solPrice)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const CommunityArtistCard: React.FC<{ artist: CommunityArtistEntry; rank: number; isWinner?: boolean; solPrice: number }> = ({ artist, rank, isWinner, solPrice }) => {
  const name = getName(artist);
  const earnings = getEarnings(artist);
  const battles = getBattles(artist);
  const wins = getWins(artist);
  const losses = getLosses(artist);
  const winRate = getWinRate(artist);
  const imageUrl = getImage(artist);

  return (
    <div className={`relative bg-navy-800 border ${isWinner ? 'border-wave-green/50 shadow-xl shadow-green-900/10' : 'border-navy-700'} rounded-2xl overflow-hidden flex flex-col ${isWinner ? 'md:-mt-12 z-10' : ''}`}>
      {isWinner && (
        <div className="bg-wave-green text-navy-950 text-center py-1 text-xs font-bold uppercase tracking-widest">
          #1 Community Champion
        </div>
      )}
      <div className="p-6 flex flex-col items-center text-center">
        <div className={`relative mb-4 ${isWinner ? 'w-24 h-24' : 'w-20 h-20'}`}>
          <div className={`w-full h-full rounded-full overflow-hidden border-4 ${isWinner ? 'border-wave-green' : rank === 2 ? 'border-slate-300' : 'border-orange-700'} flex items-center justify-center bg-navy-900`}>
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ui-gray"><Music /></div>
            )}
          </div>
          <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 border-navy-800 text-sm ${isWinner ? 'bg-wave-green text-black' : rank === 2 ? 'bg-slate-300 text-black' : 'bg-orange-700 text-white'}`}>
            #{rank}
          </div>
        </div>
        <h3 className="text-lg font-bold text-white mb-1 truncate w-full">{name}</h3>
        <div className="my-4 w-full bg-navy-900 rounded-xl p-3 border border-navy-700">
          <div className="text-[10px] text-ui-gray uppercase tracking-wider mb-1">Total Earnings</div>
          <div className="text-xl font-black text-wave-green flex items-center justify-center gap-1.5">
            <Disc size={18} />
            {formatSol(earnings)}
          </div>
          <div className="text-xs text-ui-gray mt-1">{formatUsd(earnings, solPrice)}</div>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full">
          <div>
            <div className="text-xs text-ui-gray">Battles</div>
            <div className="font-bold text-white">{battles}</div>
          </div>
          <div>
            <div className="text-xs text-ui-gray">Win Rate</div>
            <div className="font-bold text-wave-blue">{formatPct(winRate)}</div>
            <div className="text-[10px] text-ui-gray">{wins}W - {losses}L</div>
          </div>
        </div>
      </div>
    </div>
  );
};
