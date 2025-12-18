import React, { useState, useEffect, useRef } from 'react';
import { BattleSummary, TraderLeaderboardEntry } from '../types';
import { fetchBatchTraderStats } from '../services/solanaService';
import { fetchTraderLeaderboardFromDB, saveTraderLeaderboardToDB } from '../services/supabaseClient';
import { Loader2, Search, ArrowUpDown, ArrowUp, ArrowDown, Wallet, Trophy, PlayCircle, StopCircle, Check } from 'lucide-react';
import { formatSol, formatPct, formatUsd } from '../utils';

interface Props {
  battles: BattleSummary[];
  onSelectTrader: (wallet: string) => void;
  solPrice: number;
  cachedTraders: TraderLeaderboardEntry[];
  onTradersUpdate: (traders: TraderLeaderboardEntry[]) => void;
}

type SortKey = 'totalInvested' | 'netPnL' | 'roi' | 'battlesParticipated';

export const TraderLeaderboard: React.FC<Props> = ({ battles, onSelectTrader, solPrice, cachedTraders, onTradersUpdate }) => {
  const [traders, setTraders] = useState<TraderLeaderboardEntry[]>([]);
  const [search, setSearch] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [dataOrigin, setDataOrigin] = useState<'Database' | 'Live' | 'Empty'>('Database');

  const rawStatsRef = useRef<Map<string, { invested: number, payout: number, battles: Set<string> }>>(new Map());
  const [sortKey, setSortKey] = useState<SortKey>('netPnL');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Sync local traders with cachedTraders
  useEffect(() => {
    if (cachedTraders && cachedTraders.length > 0) {
      setTraders(cachedTraders);
      setDataOrigin('Database');
    }
  }, [cachedTraders]);

  const startScan = () => {
    setTraders([]);
    rawStatsRef.current.clear();
    setIsScanning(true);
    setProgressCount(0);
    setDataOrigin('Live');
  };

  // Scanning Logic
  useEffect(() => {
    let active = true;

    const runBatchScan = async () => {
      const BATCH_SIZE = 3;

      for (let i = 0; i < battles.length; i += BATCH_SIZE) {
        if (!active || !isScanning) break;

        const batch = battles.slice(i, i + BATCH_SIZE);

        try {
          const batchResults = await fetchBatchTraderStats(batch);

          for (const [wallet, stats] of batchResults) {
            if (!rawStatsRef.current.has(wallet)) {
              rawStatsRef.current.set(wallet, { invested: 0, payout: 0, battles: new Set() });
            }
            const entry = rawStatsRef.current.get(wallet)!;
            entry.invested += stats.invested;
            entry.payout += stats.payout;
            stats.battles.forEach(b => entry.battles.add(b));
          }

          const newTraderList: TraderLeaderboardEntry[] = Array.from(rawStatsRef.current.entries()).map(([address, data]) => {
            const netPnL = data.payout - data.invested;
            let roi = 0;
            if (data.invested > 0) roi = (netPnL / data.invested) * 100;

            return {
              walletAddress: address,
              totalInvested: data.invested,
              totalPayout: data.payout,
              netPnL,
              roi,
              battlesParticipated: data.battles.size,
              wins: netPnL > 0 ? 1 : 0,
              losses: netPnL < 0 ? 1 : 0,
              winRate: netPnL > 0 ? 100 : 0
            };
          });

          setTraders(newTraderList);
          setProgressCount(Math.min(i + BATCH_SIZE, battles.length));

          await new Promise(r => setTimeout(r, 1500));

        } catch (e) {
          console.error("Batch scan failed", e);
        }
      }

      if (active && isScanning) {
        setIsScanning(false);
        // Update parent state so it persists
        const finalTraders = Array.from(rawStatsRef.current.entries()).map(([address, data]) => {
          const netPnL = data.payout - data.invested;
          return {
            walletAddress: address,
            totalInvested: data.invested,
            totalPayout: data.payout,
            netPnL,
            roi: data.invested > 0 ? (netPnL / data.invested) * 100 : 0,
            battlesParticipated: data.battles.size,
            wins: netPnL > 0 ? 1 : 0,
            losses: netPnL < 0 ? 1 : 0,
            winRate: 0
          };
        });

        onTradersUpdate(finalTraders);
        saveTraderLeaderboardToDB(finalTraders);
      }
    };

    if (isScanning && battles.length > 0) {
      runBatchScan();
    }

    return () => { active = false; };
  }, [isScanning, battles]);


  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filteredTraders = traders
    .filter(t => t.walletAddress.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortKey !== colKey) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-wave-blue" /> : <ArrowDown size={12} className="text-wave-blue" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 text-ui-gray w-4 h-4" />
          <input
            type="text"
            placeholder="Filter by Wallet Address..."
            className="w-full bg-navy-800 border border-navy-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-wave-blue transition-all placeholder:text-ui-gray"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex-1 md:flex-none text-right">
            <div className="flex items-center justify-end gap-2 text-[10px] uppercase font-bold tracking-wider mb-1">
              {dataOrigin === 'Database' ? (
                <span className="text-wave-green flex items-center gap-1"><Check size={10} /> Data from Cache</span>
              ) : (
                <span className="text-ui-gray">
                  {isScanning ? 'Scanning Blockchain...' : 'Live Scan Complete'}
                </span>
              )}
            </div>
            {isScanning && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-32 bg-navy-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${isScanning ? 'bg-wave-blue animate-pulse' : 'bg-wave-green'}`}
                    style={{ width: `${(progressCount / Math.max(battles.length, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-ui-gray">{progressCount}/{battles.length}</span>
              </div>
            )}
          </div>

          <button
            onClick={isScanning ? () => setIsScanning(false) : startScan}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${isScanning
              ? 'bg-alert-red/10 text-alert-red border border-alert-red/30 hover:bg-alert-red/20'
              : 'bg-wave-blue text-navy-950 hover:bg-wave-blue/90 shadow-lg shadow-wave-blue/20'
              }`}
          >
            {isScanning ? <><StopCircle size={14} /> Stop</> : <><PlayCircle size={14} /> Force Rescan</>}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden shadow-sm relative min-h-[400px]">

        {/* Loading State */}
        {traders.length === 0 && isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-950/80 z-20 backdrop-blur-sm">
            <Loader2 size={40} className="text-wave-blue animate-spin mb-4" />
            <p className="text-ui-gray font-mono text-sm">Aggregating trader data across all battles...</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-navy-900 border-b border-navy-700 text-ui-gray text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4 pl-6 w-16">Rank</th>
                <th className="p-4">Trader Wallet</th>
                <th
                  className="p-4 text-right cursor-pointer hover:bg-navy-800/50 transition-colors select-none"
                  onClick={() => handleSort('battlesParticipated')}
                >
                  <div className="flex items-center justify-end gap-1">Battles <SortIcon colKey="battlesParticipated" /></div>
                </th>
                <th
                  className="p-4 text-right cursor-pointer hover:bg-navy-800/50 transition-colors select-none"
                  onClick={() => handleSort('totalInvested')}
                >
                  <div className="flex items-center justify-end gap-1">Total Vol <SortIcon colKey="totalInvested" /></div>
                </th>
                <th
                  className="p-4 text-right cursor-pointer hover:bg-navy-800/50 transition-colors select-none"
                  onClick={() => handleSort('netPnL')}
                >
                  <div className="flex items-center justify-end gap-1">Net PnL <SortIcon colKey="netPnL" /></div>
                </th>
                <th
                  className="p-4 text-right pr-6 cursor-pointer hover:bg-navy-800/50 transition-colors select-none"
                  onClick={() => handleSort('roi')}
                >
                  <div className="flex items-center justify-end gap-1">ROI % <SortIcon colKey="roi" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-navy-700">
              {filteredTraders.map((trader, index) => (
                <tr key={trader.walletAddress} className="hover:bg-navy-700 transition-colors group">
                  <td className="p-4 pl-6">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                      index === 1 ? 'bg-slate-300/20 text-slate-300' :
                        index === 2 ? 'bg-orange-700/20 text-orange-500' :
                          'text-ui-gray'
                      }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-navy-900 rounded-lg">
                        <Wallet size={16} className="text-ui-gray" />
                      </div>
                      <button
                        onClick={() => onSelectTrader(trader.walletAddress)}
                        className="font-mono text-slate-300 hover:text-wave-blue hover:underline text-xs sm:text-sm transition-colors text-left"
                      >
                        {trader.walletAddress}
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-ui-gray">
                    {trader.battlesParticipated}
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-mono text-slate-200">{formatSol(trader.totalInvested)}</div>
                    <div className="text-[10px] text-ui-gray">{formatUsd(trader.totalInvested, solPrice)}</div>
                  </td>
                  <td className="p-4 text-right">
                    <div className={`font-mono font-bold ${trader.netPnL >= 0 ? 'text-green-400' : 'text-alert-red'}`}>
                      {trader.netPnL > 0 ? '+' : ''}{formatSol(trader.netPnL)}
                    </div>
                    <div className="text-[10px] text-ui-gray">{formatUsd(trader.netPnL, solPrice)}</div>
                  </td>
                  <td className={`p-4 text-right pr-6 font-mono ${trader.roi >= 0 ? 'text-green-400' : 'text-alert-red'}`}>
                    {formatPct(trader.roi)}
                  </td>
                </tr>
              ))}

              {!isScanning && filteredTraders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-ui-gray">
                    <div className="flex flex-col items-center gap-2">
                      <Trophy size={32} className="opacity-20" />
                      <p>No active traders found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-navy-900 border-t border-navy-700 text-xs text-ui-gray flex justify-between items-center">
          <span>* Metrics based on realized PnL across {battles.length} battles.</span>
          <span className={isScanning ? 'text-wave-blue animate-pulse' : ''}>
            {isScanning ? 'Live Updating...' : `Last Updated: ${new Date().toLocaleTimeString()}`}
          </span>
        </div>
      </div>
    </div>
  );
};