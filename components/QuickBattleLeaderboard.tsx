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
  const decidedBattles = wins + losses;
  const battles = entry.battlesParticipated;
  const winRate = decidedBattles > 0 ? (wins / decidedBattles) * 100 : undefined;

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

// Quick battle detection: require flag AND both music links (authoritative definition)
const detectQuickBattle = (b: BattleSummary) =>
  b.isQuickBattle === true &&
  !!(b.artistA.musicLink && b.artistB.musicLink);

export const QuickBattleLeaderboard: React.FC<Props> = ({ battles, solPrice }) => {
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const { data: quickEntries = [], isFetching } = useQuickBattleLeaderboard();
  const { refreshQuickBattles } = useRefreshLeaderboards();

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
        .order('created_at', { ascending: false });

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
      const quickBattles = battles.filter(detectQuickBattle);

      const extractHandle = (link?: string) => {
        if (!link) return undefined;
        const match = link.match(/audius\.co\/([^/]+)/);
        return match ? match[1] : undefined;
      };

      const extractTrackName = (link?: string) => {
        if (!link) return undefined;
        const parts = link.split('/');
        const last = parts[parts.length - 1];
        return last ? decodeURIComponent(last.replace(/\?.*$/, '')) : undefined;
      };

      // Aggregate stats per unique song/handle
      const songMap = new Map<string, {
        trackName: string;
        handle?: string;
        profilePic?: string;
        wins: number;
        losses: number;
        battlesParticipated: number;
        totalVolume: number;
        lastCreatedAt?: string;
      }>();

      for (const b of quickBattles) {
        const artist1Handle = b.quickBattleArtist1Handle || extractHandle(b.artistA.musicLink);
        const artist2Handle = b.quickBattleArtist2Handle || extractHandle(b.artistB.musicLink);
        const track1Name = extractTrackName(b.artistA.musicLink) || b.artistA.name;
        const track2Name = extractTrackName(b.artistB.musicLink) || b.artistB.name;
        const vol1 = b.artistASolBalance || 0;
        const vol2 = b.artistBSolBalance || 0;
        const decided = b.winnerDecided;
        const artistAIsWinner = b.winnerArtistA ?? (vol1 >= vol2);

        const upsert = (
          trackName: string | undefined,
          handle: string | undefined,
          pic: string | undefined,
          isWinner: boolean,
          vol: number
        ) => {
          const key = (trackName || handle || 'unknown').toLowerCase();
          const prev = songMap.get(key) ?? {
            trackName: trackName || handle || 'Unknown Track',
            handle,
            profilePic: pic,
            wins: 0,
            losses: 0,
            battlesParticipated: 0,
            totalVolume: 0,
          };
          prev.trackName = prev.trackName || trackName || handle || 'Unknown Track';
          prev.handle = prev.handle || handle;
          prev.battlesParticipated++;
          prev.totalVolume += vol;
          if (decided) {
            if (isWinner) prev.wins++;
            else prev.losses++;
          }
          prev.lastCreatedAt = prev.lastCreatedAt && prev.lastCreatedAt > b.createdAt
            ? prev.lastCreatedAt
            : b.createdAt;
          songMap.set(key, prev);
        };

        if (track1Name) upsert(track1Name, artist1Handle, b.quickBattleArtist1ProfilePic || b.artistA.avatar, artistAIsWinner, vol1);
        if (track2Name) upsert(track2Name, artist2Handle, b.quickBattleArtist2ProfilePic || b.artistB.avatar, !artistAIsWinner, vol2);
      }

      return Array.from(songMap.values())
        .sort((a, b) => b.totalVolume - a.totalVolume)
        .map((song, index) => ({
          id: `fallback-${song.trackName}-${index}`,
          trackName: song.trackName,
          audiusHandle: song.handle || song.trackName,
          audiusProfilePic: song.profilePic,
          wins: song.wins,
          losses: song.losses,
          battlesParticipated: song.battlesParticipated,
          winRate: (song.wins + song.losses) > 0 ? (song.wins / (song.wins + song.losses)) * 100 : 0,
          totalVolumeGenerated: song.totalVolume,
          updatedAt: song.lastCreatedAt,
        }));
    };
  }, [battles]);

  const fallbackEntries = useMemo(() => mapFallback(), [mapFallback]);

  const mergedEntries = useMemo(() => {
    const byHandle = new Map<string, QuickBattleLeaderboardEntry>();
    const makeKey = (e: QuickBattleLeaderboardEntry) => {
      const handle = e.audiusHandle?.toLowerCase() ?? '';
      const track = e.trackName?.toLowerCase() ?? '';
      return handle || track || e.battleId?.toLowerCase() || e.queueId?.toLowerCase() || e.id?.toString().toLowerCase() || '';
    };

    fallbackEntries.forEach((e) => {
      const key = makeKey(e);
      if (key) byHandle.set(key, e);
    });
    quickEntries.forEach((e) => {
      const key = makeKey(e);
      if (!key) return;
      const existing = byHandle.get(key);
      if (!existing) {
        byHandle.set(key, e);
        return;
      }

      type Mutable<T> = { -readonly [P in keyof T]: T[P] };
      const merged: Mutable<QuickBattleLeaderboardEntry> = { ...existing };

      type NumericKey = 'wins' | 'losses' | 'battlesParticipated' | 'totalVolumeGenerated' | 'totalVolume' | 'totalTrades';
      const additiveKeys: NumericKey[] = [
        'wins',
        'losses',
        'battlesParticipated',
        'totalVolumeGenerated',
        'totalVolume',
        'totalTrades',
      ];

      additiveKeys.forEach((k: NumericKey) => {
        const a = typeof merged[k] === 'number' ? merged[k] : 0;
        const b = typeof e[k] === 'number' ? e[k] as number : 0;
        const sum = a + b;
        if (sum > 0) merged[k] = sum as number;
      });

      Object.entries(e).forEach(([k, v]) => {
        const keyName = k as keyof QuickBattleLeaderboardEntry;
        if (additiveKeys.includes(keyName)) return;
        if (v !== undefined && v !== null) merged[keyName] = v as QuickBattleLeaderboardEntry[keyof QuickBattleLeaderboardEntry];
      });
      byHandle.set(key, merged);
    });
    return Array.from(byHandle.values());
  }, [fallbackEntries, quickEntries]);

  const hasDatabaseEntries = quickEntries.length > 0;
  const entries = mergedEntries;
  let dataSource: 'Database' | 'Fallback' | 'Mixed' | 'Empty';
  if (entries.length === 0) dataSource = 'Empty';
  else if (hasDatabaseEntries && fallbackEntries.length > 0) dataSource = 'Mixed';
  else if (hasDatabaseEntries) dataSource = 'Database';
  else dataSource = 'Fallback';
  const dataSourceLabel = (() => {
    if (dataSource === 'Database') return 'Using cached Supabase view';
    if (dataSource === 'Mixed') return 'Merged Supabase + live quick battle data';
    if (dataSource === 'Fallback') return 'Using live quick battle data';
    return 'No quick battles yet';
  })();
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
            {dataSourceLabel}
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
                <th className="p-4">Track</th>
                <th className="p-4 text-right">Volume</th>
                <th className="p-4 text-right">Results</th>
                <th className="p-4 text-right">Battles</th>
                <th className="p-4 pr-6 text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-navy-700">
              {filteredEntries.map((entry, index) => (
                <DatabaseRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  solPrice={solPrice}
                  formatDate={formatDate}
                />
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
