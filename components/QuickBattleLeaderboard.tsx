import React, { useMemo, useState } from 'react';
import { BattleSummary, QuickBattleLeaderboardEntry } from '../types';
import { useQuickBattleLeaderboard, useRefreshLeaderboards } from '../hooks/useBattleData';
import { formatSol, formatUsd } from '../utils';
import { Loader2, Search, Trophy, Zap, ListOrdered, RefreshCw, Scan } from 'lucide-react';
import { fetchBattleOnChain } from '../services/solanaService';
import { supabase, BATTLE_COLUMNS } from '../services/supabaseClient';

interface Props {
  battles: BattleSummary[];
  solPrice: number;
}

const DatabaseRow: React.FC<{
  entry: QuickBattleLeaderboardEntry;
  index: number;
  solPrice: number;
  formatDate: (value?: string) => string;
}> = ({ entry, index, solPrice, formatDate }) => {
  const artworkUrl = entry.audiusProfilePic ?? null;
  const totalVolume = entry.totalVolumeGenerated ?? entry.totalVolume ?? 0;
  const wins = entry.wins ?? 0;
  const losses = entry.losses ?? 0;
  const computedBattles = wins + losses;
  const battles = entry.battlesParticipated ?? (computedBattles > 0 ? computedBattles : undefined);
  const winRate = entry.winRate ?? (battles ? (wins / battles) * 100 : undefined);

  return (
    <tr className="hover:bg-navy-700/60 transition-colors">
      <td className="p-4 pl-6">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs ${
          index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
          index === 1 ? 'bg-slate-300/20 text-slate-300' :
          index === 2 ? 'bg-orange-700/20 text-orange-500' :
          'text-ui-gray'
        }`}>
          {index + 1}
        </span>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-navy-900 border border-navy-700 flex items-center justify-center">
            {artworkUrl ? (
              <img
                src={artworkUrl}
                alt={entry.trackName || 'Track artwork'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const fallback = document.createElement('div');
                  fallback.className = 'text-wave-blue text-lg';
                  fallback.textContent = '🎵';
                  img.parentElement?.appendChild(fallback);
                }}
              />
            ) : (
              <div className="text-wave-blue text-lg">🎵</div>
            )}
          </div>
          <div>
            <div className="text-white font-semibold">
              {entry.trackName || entry.audiusHandle || 'Unknown Track'}
            </div>
            <div className="text-xs text-ui-gray">
              {entry.audiusHandle || entry.status || 'Quick Battle'}
            </div>
          </div>
        </div>
      </td>
      <td className="p-4 text-right">
        <div className="font-mono text-slate-200">{formatSol(totalVolume)}</div>
        <div className="text-[10px] text-ui-gray">{formatUsd(totalVolume, solPrice)}</div>
      </td>
      <td className="p-4 text-right">
        <div className="inline-flex flex-col items-end gap-1 text-xs text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-navy-900 border border-navy-700">
            <Trophy size={12} className="text-yellow-400" />
            <span>{wins}W - {losses}L</span>
          </div>
          {typeof winRate === 'number' && (
            <div className="text-ui-gray">{winRate.toFixed(1)}% win rate</div>
          )}
        </div>
      </td>
      <td className="p-4 text-right">
        <div className="text-xs text-ui-gray">
          Battles: {battles ?? '—'}
        </div>
        {entry.totalTrades && (
          <div className="text-[10px] text-ui-gray mt-1">Trades: {entry.totalTrades}</div>
        )}
      </td>
      <td className="p-4 pr-6 text-right text-ui-gray text-xs">
        <div>{formatDate(entry.updatedAt || entry.createdAt)}</div>
        {entry.status && <div className="mt-1 text-white font-semibold">{entry.status}</div>}
      </td>
    </tr>
  );
};

export const QuickBattleLeaderboard: React.FC<Props> = ({ battles, solPrice }) => {
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const { data: quickEntries = [], isFetching } = useQuickBattleLeaderboard();
  const { refreshQuickBattles } = useRefreshLeaderboards();
  const isDatabaseMode = quickEntries.length > 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshQuickBattles();
    } finally {
      // Keep spinning for a moment to ensure data is fetched
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleScanBlockchain = async () => {
    setIsScanning(true);
    setScanProgress({ current: 0, total: 0 });

    try {
      // Query database for ALL Quick Battles
      console.log('🔍 Querying database for Quick Battles...');
      const { data: quickBattlesData, error } = await supabase
        .from('battles')
        .select(BATTLE_COLUMNS)
        .eq('is_quick_battle', true)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to 50 at a time to avoid timeouts

      if (error) {
        console.error('❌ Failed to query Quick Battles:', error);
        alert(`Failed to query Quick Battles: ${error.message}`);
        return;
      }

      if (!quickBattlesData || quickBattlesData.length === 0) {
        alert('No Quick Battles found in database to scan');
        return;
      }

      console.log(`📊 Found ${quickBattlesData.length} Quick Battles in database`);

      // Convert database rows to BattleSummary format
      const quickBattles: BattleSummary[] = quickBattlesData.map((row: any) => ({
        id: row.battle_id,
        battleId: row.battle_id,
        createdAt: row.created_at,
        status: row.status || 'active',
        isQuickBattle: true,
        quickBattleQueueId: row.quick_battle_queue_id,
        artistA: {
          id: 'A',
          name: row.artist1_name || 'Artist A',
          wallet: row.artist1_wallet || '',
          avatar: '',
          color: 'blue',
          twitter: row.artist1_twitter,
          musicLink: row.artist1_music_link
        },
        artistB: {
          id: 'B',
          name: row.artist2_name || 'Artist B',
          wallet: row.artist2_wallet || '',
          avatar: '',
          color: 'green',
          twitter: row.artist2_twitter,
          musicLink: row.artist2_music_link
        },
        battleDuration: row.battle_duration || 0,
        winnerDecided: row.winner_decided || false,
        imageUrl: row.image_url || '',
        streamLink: row.stream_link,
        artistASolBalance: row.total_volume_a,
        artistBSolBalance: row.total_volume_b,
      }));

      setScanProgress({ current: 0, total: quickBattles.length });
      console.log(`🔍 Starting blockchain scan for ${quickBattles.length} Quick Battles...`);

      // Scan each battle in batches to avoid rate limits
      const BATCH_SIZE = 3;
      const DELAY = 2000; // 2 seconds between batches

      for (let i = 0; i < quickBattles.length; i += BATCH_SIZE) {
        const batch = quickBattles.slice(i, i + BATCH_SIZE);

        // Process batch in parallel
        await Promise.all(
          batch.map(async (battle) => {
            try {
              console.log(`  Scanning ${battle.battleId}...`);
              await fetchBattleOnChain(battle, true); // Force refresh to scan blockchain
              setScanProgress(prev => ({ ...prev, current: prev.current + 1 }));
            } catch (error) {
              console.error(`  Failed to scan ${battle.battleId}:`, error);
            }
          })
        );

        // Wait before next batch
        if (i + BATCH_SIZE < quickBattles.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY));
        }
      }

      console.log('✅ Blockchain scan complete! Refreshing leaderboard...');

      // Refresh the leaderboard to show updated data
      await refreshQuickBattles();

    } catch (error) {
      console.error('❌ Blockchain scan failed:', error);
      alert('Failed to scan blockchain. See console for details.');
    } finally {
      setIsScanning(false);
      setScanProgress({ current: 0, total: 0 });
    }
  };

  const mapFallback = useMemo(() => {
    return () => {
      const quickBattles = battles.filter(b => b.isQuickBattle);
      return quickBattles.map((b, index) => ({
        id: b.id || `quick-${index}`,
        queueId: b.quickBattleQueueId,
        battleId: b.battleId,
        createdAt: b.createdAt,
        status: b.status,
        artist1Handle: b.quickBattleArtist1Handle || b.artistA.name,
        artist2Handle: b.quickBattleArtist2Handle || b.artistB.name,
        artist1ProfilePic: b.quickBattleArtist1ProfilePic || b.artistA.avatar,
        artist2ProfilePic: b.quickBattleArtist2ProfilePic || b.artistB.avatar,
        artist1Score: b.artistASolBalance || 0,
        artist2Score: b.artistBSolBalance || 0,
        totalVolume: (b.artistASolBalance || 0) + (b.artistBSolBalance || 0),
        // Prefer explicit winner flag, otherwise fall back to balance comparison
        winnerHandle: (() => {
          if (!b.winnerDecided) return undefined;
          const artistAIsWinner = b.winnerArtistA ?? (b.artistASolBalance >= (b.artistBSolBalance || 0));
          return artistAIsWinner
            ? (b.quickBattleArtist1Handle || b.artistA.name)
            : (b.quickBattleArtist2Handle || b.artistB.name);
        })(),
      }));
    };
  }, [battles]);

  const fallbackEntries = useMemo(() => mapFallback(), [mapFallback]);
  const hasDatabaseEntries = quickEntries.length > 0;
  const entries = hasDatabaseEntries ? quickEntries : fallbackEntries;
  const dataSource: 'Database' | 'Fallback' | 'Empty' =
    hasDatabaseEntries ? 'Database' : (fallbackEntries.length > 0 ? 'Fallback' : 'Empty');
  const loading = isFetching && !hasDatabaseEntries;

  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    return entries
      .filter(entry => 
        !q || 
        entry.trackName?.toLowerCase().includes(q) ||
        entry.audiusHandle?.toLowerCase().includes(q) ||
        entry.artist1Handle?.toLowerCase().includes(q) || 
        entry.artist2Handle?.toLowerCase().includes(q) || 
        entry.queueId?.toLowerCase().includes(q) ||
        entry.battleId?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const volA = a.totalVolumeGenerated ?? a.totalVolume ?? 0;
        const volB = b.totalVolumeGenerated ?? b.totalVolume ?? 0;
        return volB - volA;
      });
  }, [entries, search]);

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Zap size={18} className="text-wave-blue" />
            Quick Battle Leaderboard
          </div>
          <div className="text-xs text-ui-gray mt-1">
            {dataSource === 'Database' ? 'Using cached Supabase view' : dataSource === 'Fallback' ? 'Using live quick battle data' : 'No quick battles yet'}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-2.5 text-ui-gray w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by track, handle, or queue ID..."
              className="w-full bg-navy-800 border border-navy-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-wave-blue transition-all placeholder:text-ui-gray"
              type="text"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isFetching || isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-navy-800 border border-navy-700 rounded-lg text-sm text-white hover:bg-navy-700 hover:border-wave-blue transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh leaderboard data"
          >
            <RefreshCw
              size={16}
              className={`text-wave-blue ${isRefreshing || isFetching ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleScanBlockchain}
            disabled={isRefreshing || isFetching || isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-wave-blue/10 border border-wave-blue rounded-lg text-sm text-white hover:bg-wave-blue/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Scan blockchain to populate volumes"
          >
            <Scan
              size={16}
              className={`text-wave-blue ${isScanning ? 'animate-pulse' : ''}`}
            />
            <span className="hidden sm:inline">
              {isScanning
                ? `Scanning ${scanProgress.current}/${scanProgress.total}...`
                : 'Scan Blockchain'}
            </span>
          </button>
        </div>
      </div>

      <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden shadow-sm relative">
        {loading && (
          <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 className="animate-spin text-wave-blue mb-3" size={32} />
            <p className="text-ui-gray text-sm">Loading quick battles...</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-navy-900 border-b border-navy-700 text-ui-gray text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4 pl-6 w-16">Rank</th>
                <th className="p-4">{isDatabaseMode ? 'Track' : 'Matchup'}</th>
                <th className="p-4 text-right">Volume</th>
                <th className="p-4 text-right">{isDatabaseMode ? 'Results' : 'Winner'}</th>
                <th className="p-4 text-right">{isDatabaseMode ? 'Battles' : 'Queue / Battle'}</th>
                <th className="p-4 pr-6 text-right">{isDatabaseMode ? 'Updated' : 'Created'}</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-navy-700">
              {isDatabaseMode
                ? filteredEntries.map((entry, index) => (
                    <DatabaseRow
                      key={entry.id}
                      entry={entry}
                      index={index}
                      solPrice={solPrice}
                      formatDate={formatDate}
                    />
                  ))
                : filteredEntries.map((entry, index) => (
                    <tr key={entry.id} className="hover:bg-navy-700/60 transition-colors">
                      <td className="p-4 pl-6">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                          index === 1 ? 'bg-slate-300/20 text-slate-300' :
                          index === 2 ? 'bg-orange-700/20 text-orange-500' :
                          'text-ui-gray'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-wave-blue/10 border border-navy-700 flex items-center justify-center">
                              {entry.artist1ProfilePic ? (
                                <img
                                  src={entry.artist1ProfilePic}
                                  alt={entry.artist1Handle}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    const fallback = document.createElement('div');
                                    fallback.className = 'w-full h-full flex items-center justify-center text-xs text-wave-blue font-bold';
                                    fallback.textContent = (entry.artist1Handle || 'A').slice(0, 2).toUpperCase();
                                    img.parentElement?.appendChild(fallback);
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-wave-blue font-bold">
                                  {(entry.artist1Handle || 'A').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-white font-semibold">{entry.artist1Handle || 'Artist A'}</div>
                              {typeof entry.artist1Score === 'number' && (
                                <div className="text-xs text-ui-gray">Score: {formatSol(entry.artist1Score)}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-wave-green/10 border border-navy-700 flex items-center justify-center">
                              {entry.artist2ProfilePic ? (
                                <img
                                  src={entry.artist2ProfilePic}
                                  alt={entry.artist2Handle}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    const fallback = document.createElement('div');
                                    fallback.className = 'w-full h-full flex items-center justify-center text-xs text-wave-green font-bold';
                                    fallback.textContent = (entry.artist2Handle || 'B').slice(0, 2).toUpperCase();
                                    img.parentElement?.appendChild(fallback);
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-wave-green font-bold">
                                  {(entry.artist2Handle || 'B').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-white font-semibold">{entry.artist2Handle || 'Artist B'}</div>
                              {typeof entry.artist2Score === 'number' && (
                                <div className="text-xs text-ui-gray">Score: {formatSol(entry.artist2Score)}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-mono text-slate-200">{formatSol(entry.totalVolume || 0)}</div>
                        <div className="text-[10px] text-ui-gray">{formatUsd(entry.totalVolume || 0, solPrice)}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-navy-900 border border-navy-700 text-xs text-white">
                          <Trophy size={12} className="text-yellow-400" />
                          {entry.winnerHandle || 'Pending'}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="text-xs text-ui-gray">Queue: {entry.queueId || '—'}</div>
                        <div className="text-xs text-ui-gray mt-1">Battle: {entry.battleId || '—'}</div>
                      </td>
                      <td className="p-4 pr-6 text-right text-ui-gray text-xs">
                        <div>{formatDate(entry.createdAt)}</div>
                        {entry.status && <div className="mt-1 text-white font-semibold">{entry.status}</div>}
                      </td>
                    </tr>
                  ))}

              {!loading && filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-ui-gray">
                    <div className="flex flex-col items-center gap-2">
                      <ListOrdered size={32} className="opacity-30" />
                      <p>No quick battles found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
