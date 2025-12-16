import React, { useState, useEffect } from 'react';
import { QuickBattleArtistStats } from '../types';
import { fetchQuickBattleLeaderboardFromDB } from '../services/supabaseClient';
import { formatSol, formatUsd, formatPct } from '../utils';
import { Music, Zap, Trophy, ExternalLink, Loader2, Check } from 'lucide-react';

interface Props {
  solPrice: number;
}

export const QuickBattleLeaderboard: React.FC<Props> = ({ solPrice }) => {
  const [stats, setStats] = useState<QuickBattleArtistStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataOrigin, setDataOrigin] = useState<'Database' | 'Empty'>('Empty');

  // Load Data Effect
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const dbStats = await fetchQuickBattleLeaderboardFromDB();
        if (dbStats && dbStats.length > 0) {
          setStats(dbStats);
          setDataOrigin('Database');
        } else {
          setStats([]);
          setDataOrigin('Empty');
        }
      } catch (e) {
        console.error("Failed to load Quick Battle data", e);
        setStats([]);
        setDataOrigin('Empty');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-wave-blue" size={32} />
        <span className="ml-3 text-ui-gray">Loading Quick Battle data...</span>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
        <Zap size={48} className="mx-auto mb-4 text-ui-gray opacity-50" />
        <h3 className="text-xl font-bold text-white mb-2">No Quick Battle Data Yet</h3>
        <p className="text-ui-gray text-sm">
          Quick Battle leaderboard will populate as battles are completed and webhooks process the results.
        </p>
      </div>
    );
  }

  const topTrack = stats[0];
  const runnersUp = stats.slice(1, 3);
  const rest = stats.slice(3);

  const totalBattles = stats.reduce((acc, curr) => acc + curr.battlesParticipated, 0);
  const totalVolume = stats.reduce((acc, curr) => acc + curr.totalVolumeGenerated, 0);
  const uniqueTracks = stats.length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-wave-blue text-xs uppercase tracking-widest font-bold mb-2">Total Quick Battles</div>
            <div className="text-3xl font-black text-white">{totalBattles}</div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-wave-blue/5 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        </div>

        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-wave-green text-xs uppercase tracking-widest font-bold mb-2">Unique Tracks</div>
            <div className="text-3xl font-black text-white">{uniqueTracks}</div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-wave-green/5 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        </div>

        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-yellow-500 text-xs uppercase tracking-widest font-bold mb-2">Total Volume</div>
            <div className="text-3xl font-black text-white">{formatSol(totalVolume)}</div>
            <div className="text-xs text-ui-gray mt-1">{formatUsd(totalVolume, solPrice)}</div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        </div>
      </div>

      {/* Data Source Indicator */}
      <div className="flex items-center gap-2 text-xs text-ui-gray">
        {dataOrigin === 'Database' && (
          <>
            <Check size={14} className="text-wave-green" />
            Loaded from Database Cache
          </>
        )}
      </div>

      {/* The Podium (Top 3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        {runnersUp[0] && <TrackCard track={runnersUp[0]} rank={2} solPrice={solPrice} />}
        {topTrack && <TrackCard track={topTrack} rank={1} solPrice={solPrice} isWinner />}
        {runnersUp[1] && <TrackCard track={runnersUp[1]} rank={3} solPrice={solPrice} />}
      </div>

      {/* The List (Rest) */}
      {rest.length > 0 && (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
          <div className="p-4 bg-navy-900 border-b border-navy-700 text-xs font-bold text-ui-gray uppercase tracking-wider flex justify-between">
            <span>Rank 4+</span>
            <span>Battle Stats & Volume</span>
          </div>
          <div className="divide-y divide-navy-700">
            {rest.map((track, idx) => (
              <div key={track.audiusHandle} className="p-4 hover:bg-navy-700 transition-colors flex flex-col sm:flex-row items-center gap-4">
                <div className="font-mono text-ui-gray w-8 text-center font-bold">#{idx + 4}</div>

                <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-full bg-navy-900 overflow-hidden shrink-0 border border-navy-700">
                    {track.audiusProfilePic ? (
                      <img src={track.audiusProfilePic} className="w-full h-full object-cover" alt={track.trackName} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ui-gray">
                        <Music size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white flex items-center gap-2">
                      {track.trackName}
                      {track.audiusProfileUrl && (
                        <a
                          href={track.audiusProfileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-wave-blue hover:text-white transition-colors"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-ui-gray">@{track.audiusHandle}</div>
                  </div>
                </div>

                <div className="flex gap-6 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <div className="text-xs text-ui-gray mb-0.5">Battles</div>
                    <div className="font-bold text-white">{track.battlesParticipated}</div>
                    <div className="text-[10px] text-ui-gray">{formatPct(track.winRate)} WR</div>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <div className="text-xs text-ui-gray mb-0.5">Total Volume</div>
                    <div className="font-bold text-white font-mono">{formatSol(track.totalVolumeGenerated)}</div>
                    <div className="text-[10px] text-ui-gray">{formatUsd(track.totalVolumeGenerated, solPrice)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TrackCard: React.FC<{ track: QuickBattleArtistStats, rank: number, isWinner?: boolean, solPrice: number }> = ({ track, rank, isWinner, solPrice }) => {
  return (
    <div className={`relative bg-navy-800 border ${isWinner ? 'border-yellow-500/50 shadow-xl shadow-yellow-900/10' : 'border-navy-700'} rounded-2xl overflow-hidden flex flex-col ${isWinner ? 'md:-mt-12 z-10' : ''}`}>
      {isWinner && (
        <div className="bg-yellow-500 text-navy-950 text-center py-1 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1">
          <Trophy size={14} />
          #1 Top Track
        </div>
      )}

      <div className="p-6 flex flex-col items-center text-center">
        <div className={`relative mb-4 ${isWinner ? 'w-24 h-24' : 'w-20 h-20'}`}>
          <div className={`w-full h-full rounded-full overflow-hidden border-4 ${isWinner ? 'border-yellow-500' : rank === 2 ? 'border-slate-300' : 'border-orange-700'}`}>
            {track.audiusProfilePic ? (
              <img src={track.audiusProfilePic} alt={track.trackName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-navy-900 flex items-center justify-center text-ui-gray"><Music /></div>
            )}
          </div>
          <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 border-navy-800 ${
            isWinner ? 'bg-yellow-500 text-black' : rank === 2 ? 'bg-slate-300 text-black' : 'bg-orange-700 text-white'
          }`}>
            #{rank}
          </div>
        </div>

        <h3 className="text-lg font-bold text-white mb-1 truncate w-full">{track.trackName}</h3>
        <div className="text-xs text-ui-gray mb-3">@{track.audiusHandle}</div>

        <div className="my-4 w-full bg-navy-900 rounded-xl p-3 border border-navy-700">
          <div className="text-[10px] text-ui-gray uppercase tracking-wider mb-1">Total Volume</div>
          <div className="text-xl font-black text-wave-green flex items-center justify-center gap-1.5">
            <Zap size={18} />
            {formatSol(track.totalVolumeGenerated)}
          </div>
          <div className="text-xs text-ui-gray mt-1">{formatUsd(track.totalVolumeGenerated, solPrice)}</div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full mb-4">
          <div>
            <div className="text-xs text-ui-gray">Battles</div>
            <div className="font-bold text-white text-lg">{track.battlesParticipated}</div>
            <div className="text-[10px] text-ui-gray">{track.wins}W - {track.losses}L</div>
          </div>
          <div>
            <div className="text-xs text-ui-gray">Win Rate</div>
            <div className="font-bold text-wave-blue text-lg">{formatPct(track.winRate)}</div>
            <div className="text-[10px] text-ui-gray">Avg: {formatSol(track.avgVolumePerBattle)}</div>
          </div>
        </div>

        {track.audiusProfileUrl && (
          <a
            href={track.audiusProfileUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2 rounded bg-navy-900 hover:bg-wave-blue/10 text-ui-gray hover:text-wave-blue border border-navy-700 transition-colors"
          >
            <Music size={16} />
            <span className="text-xs font-bold">View on Audius</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
};
