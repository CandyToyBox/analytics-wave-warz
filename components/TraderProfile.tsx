
import React, { useState } from 'react';
import { TraderProfileStats, TraderBattleHistory } from '../types';
import { formatSol, formatPct } from '../utils';
import { Wallet, Activity, ExternalLink, Calendar, Copy, Check, ChevronDown, ArrowUpRight, ArrowDownLeft, HelpCircle } from 'lucide-react';

interface Props {
  stats: TraderProfileStats;
  onClose: () => void;
}

// Moved outside to prevent re-mounting/flickering on parent updates
const BattleImage = ({ src }: { src?: string }) => {
  const [error, setError] = useState(false);

  if (!src || src === '' || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-navy-800 text-ui-gray">
        <HelpCircle size={16} />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      className="w-full h-full object-cover" 
      alt="Battle" 
      onError={() => setError(true)}
    />
  );
};

const HistoryRow: React.FC<{ item: TraderBattleHistory }> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const isUnlisted = item.battleId.startsWith('unlisted-') || item.artistAName.includes('Unlisted');

  return (
    <>
      <tr 
        className={`hover:bg-navy-800/50 transition-colors cursor-pointer border-b border-navy-700/50 ${expanded ? 'bg-navy-800/30' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-navy-800 shrink-0 border border-navy-700">
               <BattleImage src={item.imageUrl} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-200 text-sm">
                {item.artistAName} <span className="text-ui-gray font-normal">vs</span> {item.artistBName}
              </span>
              {isUnlisted && (
                <span className="text-[10px] text-orange-400 font-mono mt-0.5">
                  Contract: {item.battleId.replace('unlisted-', '').slice(0, 8)}...
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="p-4 text-ui-gray hidden sm:table-cell">
           <div className="flex items-center gap-1.5 text-xs font-mono">
             <Calendar size={12} className="text-navy-700" />
             {new Date(item.date).toLocaleDateString()}
           </div>
        </td>
        <td className="p-4 text-right font-mono text-slate-300 text-sm">{formatSol(item.invested)}</td>
        <td className="p-4 text-right font-mono text-action-green text-sm">{item.payout > 0 ? formatSol(item.payout) : '-'}</td>
        <td className={`p-4 text-right font-mono font-bold text-sm ${item.pnl >= 0 ? 'text-action-green' : 'text-alert-red'}`}>
          {item.pnl > 0 ? '+' : ''}{formatSol(item.pnl)}
        </td>
        <td className="p-4 text-center">
           <div className="flex items-center justify-end gap-3">
              <span className={`text-[10px] px-2 py-1 rounded-full font-bold border uppercase tracking-wider ${
                item.outcome === 'WIN' ? 'bg-action-green/10 text-action-green border-action-green/30' :
                item.outcome === 'LOSS' ? 'bg-alert-red/10 text-alert-red border-alert-red/30' :
                'bg-navy-700/30 text-ui-gray border-navy-600'
              }`}>
                {item.outcome}
              </span>
              <div className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                <ChevronDown size={14} className="text-ui-gray" />
              </div>
           </div>
        </td>
      </tr>
      
      {/* Nested Transaction View */}
      {expanded && (
        <tr className="bg-navy-950/30">
          <td colSpan={6} className="p-0">
            {/* Indented Container aligned with Artist Name Text (approx 4.5rem left) */}
            <div className="border-l-2 border-wave-blue/20 ml-[4.5rem] my-2 pl-4 py-2 space-y-1 animate-in slide-in-from-top-2 duration-200 relative">
                
                {/* Visual connector line */}
                <div className="absolute -left-[2px] -top-3 h-4 w-[2px] bg-wave-blue/20"></div>

                <div className="flex justify-between items-center mb-2 pr-6 border-b border-navy-800/50 pb-1 mr-6">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                       <Activity size={10} /> Transaction Ledger
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{item.transactions.length} entries</span>
                </div>
                
                {item.transactions.map((tx, idx) => (
                  <div key={`${tx.signature}-${idx}`} className="flex items-center justify-between bg-navy-900/40 p-1.5 rounded border border-navy-800/50 text-xs mr-6 hover:bg-navy-900 hover:border-navy-700 transition-colors group">
                     
                     <div className="flex items-center gap-3 min-w-[140px]">
                       <div className={`p-1 rounded-md ${tx.type === 'INVEST' ? 'bg-navy-800 text-slate-400' : 'bg-action-green/10 text-action-green'}`}>
                         {tx.type === 'INVEST' 
                           ? <ArrowUpRight size={12} /> 
                           : <ArrowDownLeft size={12} />
                         }
                       </div>
                       <div className="flex flex-col">
                           <span className={`font-semibold text-[10px] uppercase tracking-wide ${tx.type === 'INVEST' ? 'text-slate-400' : 'text-action-green'}`}>
                             {tx.type === 'INVEST' ? 'Invested' : 'Payout'}
                           </span>
                           <span className="text-slate-600 text-[10px] font-mono">{new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       </div>
                     </div>
                     
                     <div className="flex-1 text-right pr-4">
                       <span className="font-mono font-bold text-slate-300">{formatSol(tx.amount)}</span>
                     </div>
                     
                     <a 
                         href={`https://solscan.io/tx/${tx.signature}`} 
                         target="_blank" 
                         rel="noreferrer"
                         className="p-1 text-ui-gray hover:text-wave-blue rounded transition-colors"
                         title="View on Solscan"
                         onClick={(e) => e.stopPropagation()}
                       >
                         <ExternalLink size={10} />
                     </a>
                  </div>
                ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const TraderProfile: React.FC<Props> = ({ stats, onClose }) => {
  const isProfitable = stats.netPnL >= 0;
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(stats.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      
      {/* Header Card */}
      <div className="bg-navy-900 border border-navy-800 rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-wave-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-wave-blue to-wave-green flex items-center justify-center shadow-lg shadow-wave-blue/20 shrink-0">
              <Wallet className="text-navy-950 w-8 h-8" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Trader Analytics
                <a 
                  href={`https://solscan.io/account/${stats.walletAddress}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-ui-gray hover:text-wave-blue transition-colors"
                >
                  <ExternalLink size={16} />
                </a>
              </h2>
              <button 
                onClick={copyAddress}
                className="flex items-center gap-2 text-slate-400 font-mono text-sm hover:text-white transition-colors group"
              >
                {stats.walletAddress.slice(0, 6)}...{stats.walletAddress.slice(-6)}
                {copied ? <Check size={12} className="text-action-green" /> : <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>
            </div>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto justify-between md:justify-end">
             <div className="text-right">
               <div className="text-ui-gray text-xs uppercase tracking-wider">Net PnL</div>
               <div className={`text-3xl font-mono font-bold ${isProfitable ? 'text-action-green' : 'text-alert-red'}`}>
                 {isProfitable ? '+' : ''}{formatSol(stats.netPnL)}
               </div>
             </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-navy-950/50 rounded-xl p-4 border border-navy-800">
            <div className="text-ui-gray text-xs mb-1">Win Rate</div>
            <div className="text-xl font-bold text-white">{formatPct(stats.winRate)}</div>
            <div className="text-slate-500 text-xs">{stats.wins}W - {stats.losses}L</div>
          </div>
          <div className="bg-navy-950/50 rounded-xl p-4 border border-navy-800">
            <div className="text-ui-gray text-xs mb-1">Total Volume</div>
            <div className="text-xl font-bold text-wave-blue">{formatSol(stats.totalInvested)}</div>
          </div>
          <div className="bg-navy-950/50 rounded-xl p-4 border border-navy-800">
            <div className="text-ui-gray text-xs mb-1">Battles</div>
            <div className="text-xl font-bold text-white">{stats.battlesParticipated}</div>
          </div>
          <div className="bg-navy-950/50 rounded-xl p-4 border border-navy-800">
            <div className="text-ui-gray text-xs mb-1">Total Payouts</div>
            <div className="text-xl font-bold text-action-green">{formatSol(stats.totalPayout)}</div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-navy-900 border border-navy-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-navy-800 flex justify-between items-center bg-navy-900/50">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
             <Activity className="text-wave-blue" size={20} /> Battle History
           </h3>
           <span className="text-xs text-ui-gray bg-navy-950 px-3 py-1 rounded-full border border-navy-800 font-mono">
             {stats.history.length} Records
           </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-navy-950/80 text-ui-gray text-xs uppercase tracking-wider border-b border-navy-800">
              <tr>
                <th className="p-4 pl-6">Battle Context</th>
                <th className="p-4 hidden sm:table-cell">Date</th>
                <th className="p-4 text-right">Invested</th>
                <th className="p-4 text-right">Payout</th>
                <th className="p-4 text-right">PnL</th>
                <th className="p-4 text-center pr-6">Result</th>
              </tr>
            </thead>
            <tbody className="text-sm bg-navy-900">
              {stats.history.map((item, i) => (
                <HistoryRow key={`${item.battleId}-${i}`} item={item} />
              ))}
              {stats.history.length === 0 && (
                 <tr>
                   <td colSpan={6} className="p-12 text-center text-ui-gray">
                     <div className="flex flex-col items-center gap-2">
                       <Activity size={32} className="opacity-20" />
                       <p>No WaveWarz battle history found for this wallet.</p>
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
