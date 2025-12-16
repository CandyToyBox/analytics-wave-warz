import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { 
  Trophy, 
  Activity, 
  TrendingUp, 
  DollarSign, 
  History,
  ArrowLeft,
  Loader2,
  Music,
  Twitter,
  ExternalLink,
  LayoutGrid,
  ListOrdered,
  ShieldCheck,
  BarChart3,
  CalendarDays,
  Search,
  Wallet,
  Database
} from 'lucide-react';
import { BattleState, BattleSummary, BattleEvent, TraderProfileStats } from './types';
import { calculateSettlement, formatSol, formatPct, formatUsd, calculateTVLWinner, calculateLeaderboard, groupBattlesIntoEvents } from './utils';
import { StatCard } from './components/StatCard';
import { DistributionChart } from './components/DistributionChart';
import { RoiCalculator } from './components/RoiCalculator';
import { BattleReplay } from './components/BattleReplay';
import { BattleGrid } from './components/BattleGrid';
import { EventGrid } from './components/EventGrid';
import { Leaderboard } from './components/Leaderboard';
import { TraderLeaderboard } from './components/TraderLeaderboard';
import { ArtistLeaderboard } from './components/ArtistLeaderboard';
import { QuickBattleLeaderboard } from './components/QuickBattleLeaderboard';
import { WhaleTicker } from './components/WhaleTicker';
import { MomentumGauge } from './components/MomentumGauge';
import { ShareButton } from './components/ShareButton';
import { TraderProfile } from './components/TraderProfile';
import { DebugDataSync } from './components/DebugDataSync';
import { InfoTooltip } from './components/InfoTooltip';
import { getBattleLibrary } from './data';
import { fetchBattleOnChain, fetchTraderProfile } from './services/solanaService';
import { fetchBattlesFromSupabase } from './services/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- FILTER LOGIC ---
// Since we now filter by is_test_battle in the database query,
// we only need basic validation here
const isValidBattle = (b: BattleSummary): boolean => {
  if (b.isCommunityBattle) return true;
  if (!b.artistA.wallet || !b.artistB.wallet) return false;
  return true;
};

export default function App() {
  const [currentView, setCurrentView] = useState<'grid' | 'events' | 'dashboard' | 'replay' | 'leaderboard' | 'trader'>('grid');
  const [leaderboardTab, setLeaderboardTab] = useState<'artists' | 'traders' | 'quickBattles'>('artists');
  const [selectedBattle, setSelectedBattle] = useState<BattleState | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<BattleEvent | null>(null);
  const [traderStats, setTraderStats] = useState<TraderProfileStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [library, setLibrary] = useState<BattleSummary[]>([]);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [dataSource, setDataSource] = useState<'Local' | 'Supabase'>('Local');

  useEffect(() => {
    async function initData() {
      try {
         const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
         const data = await resp.json();
         if (data.solana.usd) setSolPrice(data.solana.usd);
      } catch (e) {
         console.warn("Failed to fetch SOL Price", e);
         setSolPrice(200); 
      }

      const csvData = getBattleLibrary();
      
      try {
        const supabaseData = await fetchBattlesFromSupabase();
        if (supabaseData && supabaseData.length > 0) {
           console.log("Loaded battles from Supabase");
           setLibrary(supabaseData);
           setDataSource('Supabase');
        } else {
           console.log("Using local CSV data");
           setLibrary(csvData);
           setDataSource('Local');
        }
      } catch (e) {
         console.warn("Error loading data, falling back to CSV", e);
         setLibrary(csvData);
         setDataSource('Local');
      }
    }
    initData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); 

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const validLibrary = useMemo(() => library.filter(isValidBattle), [library]);
  const events = useMemo(() => groupBattlesIntoEvents(validLibrary), [validLibrary]);

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (currentView === 'dashboard' && selectedBattle && !selectedBattle.isEnded) {
       pollingRef.current = setInterval(async () => {
         try {
           const freshData = await fetchBattleOnChain(selectedBattle, true);
           setSelectedBattle(freshData);
         } catch (e) {
           console.warn("Silent refresh failed", e);
         }
       }, 15000); 
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [currentView, selectedBattle?.id, selectedBattle?.isEnded]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    setIsLoading(true);
    
    try {
      if (searchQuery.length >= 32 && searchQuery.length <= 44) {
         const stats = await fetchTraderProfile(searchQuery, library);
         setTraderStats(stats);
         setCurrentView('trader');
         setSelectedBattle(null);
         setSelectedEvent(null);
      } else {
        setCurrentView('grid');
      }
    } catch (err) {
      console.error("Search failed", err);
      alert("Could not find wallet or data. Please check the address.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBattle = useCallback(async (summary: BattleSummary) => {
    setIsLoading(true);
    try {
      const fullData = await fetchBattleOnChain(summary);
      setSelectedBattle(fullData);
      setCurrentView('dashboard');
    } catch (e) {
      console.error("Failed to fetch battle data", e);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const handleSelectTrader = useCallback(async (wallet: string) => {
      setIsLoading(true);
      try {
         const stats = await fetchTraderProfile(wallet, library); 
         setTraderStats(stats);
         setCurrentView('trader');
      } catch(e) {
          console.error("Failed to fetch trader", e);
      } finally {
          setIsLoading(false);
      }
  }, [library]);

  const handleSelectEvent = useCallback((event: BattleEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleBack = useCallback(() => {
    if (currentView === 'dashboard' || currentView === 'replay') {
      if (selectedEvent) {
        setSelectedBattle(null);
        setCurrentView('events');
      } else {
        setCurrentView('grid');
        setSelectedBattle(null);
      }
    } else if (currentView === 'events' && selectedEvent) {
      setSelectedEvent(null);
    } else if (currentView === 'trader') {
      setCurrentView('grid');
      setTraderStats(null);
      setSearchQuery('');
    } else {
      setCurrentView('grid');
    }
  }, [currentView, selectedEvent]);

  const battle = selectedBattle;
  const winner = battle ? calculateTVLWinner(battle) : 'A';
  const settlement = battle ? calculateSettlement(battle) : null;
  const totalVolume = battle ? battle.totalVolumeA + battle.totalVolumeB : 0;
  const totalTVL = battle ? battle.artistASolBalance + battle.artistBSolBalance : 0;

  const tvlData = battle ? [
    { name: battle.artistA.name, value: battle.artistASolBalance, color: battle.artistA.color },
    { name: battle.artistB.name, value: battle.artistBSolBalance, color: battle.artistB.color },
  ] : [];

  const filteredBattles = useMemo(() => {
    if (!debouncedSearchQuery || debouncedSearchQuery.length > 30) return validLibrary;
    return validLibrary.filter(b => 
      b.artistA.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
      b.artistB.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );
  }, [validLibrary, debouncedSearchQuery]);

  return (
    <div className="min-h-screen bg-navy-950 text-white font-sans selection:bg-wave-blue/30 pb-20">
      {/* Header / Nav */}
      <header className="border-b border-navy-800 bg-navy-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0" 
            onClick={() => { setCurrentView('grid'); setSelectedEvent(null); setSelectedBattle(null); setSearchQuery(''); }}
          >
            {/* Logo Text Gradient */}
            <span className="font-bold text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-wave-blue to-wave-green drop-shadow-sm hidden sm:inline">
              WAVEWARZ
            </span>
            <span className="font-bold text-2xl tracking-tight text-white sm:hidden">WW</span>
          </div>

          <div className="flex-1 max-w-lg relative group">
             <form onSubmit={handleSearch} className="relative">
               <input 
                 type="text" 
                 placeholder="Search Artist or Paste Wallet Address..."
                 className="w-full bg-navy-900 border border-navy-800 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-wave-blue focus:ring-1 focus:ring-wave-blue transition-all placeholder:text-slate-500 font-body"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
               <Search className="absolute left-3 top-2.5 text-slate-500 w-4 h-4 group-focus-within:text-wave-blue transition-colors" />
             </form>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-action-green bg-action-green/10 px-3 py-1.5 rounded-full border border-action-green/30">
                <TrendingUp size={12} />
                <span>SOL: ${solPrice.toFixed(2)}</span>
            </div>

            <div className="hidden md:flex bg-navy-900 rounded-lg p-1 border border-navy-800">
              <button 
                onClick={() => { setCurrentView('grid'); setSelectedBattle(null); setSelectedEvent(null); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  currentView === 'grid'
                    ? 'bg-navy-800 text-white shadow-sm'
                    : 'text-ui-gray hover:text-white'
                }`}
              >
                <LayoutGrid size={14} /> Battles
              </button>
              <button 
                onClick={() => { setCurrentView('events'); setSelectedBattle(null); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  currentView === 'events'
                    ? 'bg-navy-800 text-white shadow-sm'
                    : 'text-ui-gray hover:text-white'
                }`}
              >
                <CalendarDays size={14} /> Events
              </button>
              <button 
                onClick={() => { setCurrentView('leaderboard'); setSelectedBattle(null); setSelectedEvent(null); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  currentView === 'leaderboard'
                    ? 'bg-navy-800 text-white shadow-sm'
                    : 'text-ui-gray hover:text-white'
                }`}
              >
                <ListOrdered size={14} /> Leaderboard
              </button>
            </div>

            {(currentView === 'dashboard' || currentView === 'replay') && battle && (
              <>
                <ShareButton battle={battle} />
                <button 
                  onClick={() => setCurrentView(currentView === 'replay' ? 'dashboard' : 'replay')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    currentView === 'replay' 
                      ? 'bg-wave-blue text-navy-950 border-wave-blue' 
                      : 'bg-wave-blue/10 text-wave-blue border-wave-blue/30 hover:bg-wave-blue/20'
                  }`}
                >
                  <History size={14} />
                  <span className="hidden sm:inline">{currentView === 'replay' ? 'Exit' : 'Replay'}</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {currentView === 'dashboard' && battle && battle.recentTrades.length > 0 && (
          <WhaleTicker 
            trades={battle.recentTrades} 
            artistAName={battle.artistA.name}
            artistBName={battle.artistB.name}
            colorA={battle.artistA.color}
            colorB={battle.artistB.color}
          />
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {isLoading && (
          <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-wave-blue animate-spin mb-4" />
            <div className="text-slate-300 font-mono">Crunching Blockchain Data...</div>
          </div>
        )}

        {currentView === 'trader' && traderStats && (
          <div>
            <button onClick={handleBack} className="flex items-center gap-2 text-ui-gray hover:text-white transition-colors text-sm font-medium mb-6">
              <ArrowLeft size={16} /> Back
            </button>
            <TraderProfile stats={traderStats} onClose={handleBack} />
          </div>
        )}

        {currentView === 'grid' && (
          <BattleGrid battles={filteredBattles} onSelect={handleSelectBattle} />
        )}

        {currentView === 'events' && !selectedEvent && (
          <EventGrid events={events} onSelect={handleSelectEvent} />
        )}

        {currentView === 'events' && selectedEvent && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 bg-navy-800 border border-navy-700 rounded-lg hover:bg-navy-700 transition-colors"
                >
                  <ArrowLeft size={20} className="text-ui-gray" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    {selectedEvent.artistA.name} <span className="text-ui-gray text-lg">vs</span> {selectedEvent.artistB.name}
                  </h2>
                  <div className="text-ui-gray text-sm font-body">
                    {selectedEvent.rounds.length} Rounds • {new Date(selectedEvent.date).toLocaleDateString()}
                  </div>
                </div>
             </div>
             
             <div className="p-4 bg-wave-blue/10 border border-wave-blue/20 rounded-xl text-sm text-wave-blue flex items-start gap-3">
                <Trophy size={18} className="mt-0.5 shrink-0" />
                <div className="font-body">
                  <strong className="block mb-1 font-sans">Winning Condition: Best 2 out of 3</strong>
                  The winner of the round is determined by winning 2 out of 3 categories: Charts, Judges Panel, and Audience Poll.
                </div>
             </div>

             <BattleGrid battles={selectedEvent.rounds} onSelect={handleSelectBattle} />
          </div>
        )}

        {currentView === 'leaderboard' && (
           <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                 <h2 className="text-2xl font-bold text-white">Global Leaderboard</h2>
                 
                  <div className="bg-navy-900 p-1 rounded-lg border border-navy-800 flex gap-1">
                    <button 
                      onClick={() => setLeaderboardTab('artists')}
                      className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                        leaderboardTab === 'artists' 
                         ? 'bg-navy-800 text-white shadow-sm' 
                         : 'text-ui-gray hover:text-slate-300'
                     }`}
                   >
                     Artists
                   </button>
                   <button 
                      onClick={() => setLeaderboardTab('traders')}
                      className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                        leaderboardTab === 'traders' 
                          ? 'bg-wave-blue text-navy-950 shadow-sm' 
                          : 'text-ui-gray hover:text-slate-300'
                      }`}
                    >
                      Traders
                    </button>
                    <button 
                      onClick={() => setLeaderboardTab('quickBattles')}
                      className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                        leaderboardTab === 'quickBattles' 
                          ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40 shadow-sm' 
                          : 'text-ui-gray hover:text-slate-300'
                      }`}
                    >
                      Quick Battles
                    </button>
                  </div>
               </div>
               
               {leaderboardTab === 'artists' && (
                 <ArtistLeaderboard battles={validLibrary} solPrice={solPrice} />
               )}
               {leaderboardTab === 'traders' && (
                 <TraderLeaderboard battles={validLibrary} onSelectTrader={handleSelectTrader} solPrice={solPrice} />
               )}
               {leaderboardTab === 'quickBattles' && (
                 <QuickBattleLeaderboard battles={validLibrary} solPrice={solPrice} />
               )}
            </div>
         )}

        {currentView === 'replay' && battle && (
          <BattleReplay battle={battle} onExit={() => setCurrentView('dashboard')} />
        )}

        {currentView === 'dashboard' && battle && settlement && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="flex justify-between items-center">
              <button onClick={handleBack} className="flex items-center gap-2 text-ui-gray hover:text-white transition-colors text-sm font-medium">
                <ArrowLeft size={16} />
                {selectedEvent ? 'Back to Event' : 'Back to Archive'}
              </button>

              <div className="flex gap-2">
                 <a
                   href={`https://solscan.io/account/${battle.battleAddress}`}
                   target="_blank"
                   rel="noreferrer"
                   className="flex items-center gap-2 text-xs bg-navy-900 border border-navy-800 text-ui-gray px-3 py-1.5 rounded-full hover:bg-navy-800 hover:text-white transition-colors"
                 >
                   <ExternalLink size={12} />
                   <span>View Contract</span>
                 </a>
                 <div className="flex items-center gap-1.5 text-xs bg-action-green/10 border border-action-green/30 text-action-green px-3 py-1.5 rounded-full">
                   <ShieldCheck size={12} />
                   <span>Verified On-Chain</span>
                 </div>
              </div>
            </div>

            {battle.isEnded && (
              <div className="bg-action-green/10 border-2 border-action-green/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <div className="bg-action-green/20 p-2 rounded-lg">
                    <Trophy className="w-6 h-6 text-action-green" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-action-green font-bold text-sm uppercase tracking-wide">✓ BATTLE COMPLETED</span>
                    </div>
                    <div className="text-white font-bold text-lg">
                      {battle.artistA.name} <span className="text-ui-gray text-sm font-normal">vs</span> {battle.artistB.name}
                    </div>
                    <div className="text-sm text-slate-300 mt-1 font-body">
                      <span className="text-action-green font-bold">{winner === 'A' ? battle.artistA.name : battle.artistB.name}</span> won with a <span className="text-action-green font-bold">+{formatPct((settlement.winMargin / ((winner === 'A' ? battle.artistBSolBalance : battle.artistASolBalance) || 1)) * 100)}</span> margin
                    </div>
                  </div>
                </div>
              </div>
            )}

            <section className="relative overflow-hidden rounded-3xl border border-navy-800 bg-navy-800/50 p-8 md:p-12">
               <div className="absolute inset-0 z-0">
                 <img src={battle.imageUrl} alt="Battle Background" className="w-full h-full object-cover opacity-20 blur-sm" />
                 <div className="absolute inset-0 bg-gradient-to-b from-navy-900/80 to-navy-950"></div>
               </div>

               <div className="absolute top-0 left-1/4 w-96 h-96 bg-wave-blue/10 rounded-full blur-3xl -translate-y-1/2 pointer-events-none z-0"></div>
               <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-wave-green/10 rounded-full blur-3xl translate-y-1/2 pointer-events-none z-0"></div>

               <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-16">
                  {/* Artist A */}
                  <div className={`flex flex-col items-center text-center transition-all duration-500 ${winner === 'A' && battle.isEnded ? 'scale-110 drop-shadow-[0_0_15px_rgba(34,181,232,0.5)]' : 'opacity-80'}`}>
                    <div className="w-24 h-24 rounded-full p-1 border-2 border-wave-blue mb-4 overflow-hidden shadow-lg shadow-wave-blue/20 bg-navy-950">
                      {battle.artistA.avatar ? (
                        <img src={battle.artistA.avatar} alt="A" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-wave-blue/20 flex items-center justify-center text-wave-blue font-bold text-2xl">A</div>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-white">{battle.artistA.name}</h2>
                    <div className="mt-2 text-3xl font-mono font-bold text-wave-blue">{formatSol(battle.artistASolBalance)}</div>
                    <div className="text-xs text-wave-blue text-opacity-80 font-mono">
                       {formatUsd(battle.artistASolBalance, solPrice)}
                    </div>
                    <div className="text-xs text-wave-blue/70 uppercase tracking-widest mt-1 font-bold">Final Pool Value</div>
                    <div className="flex gap-2 mt-3">
                      {battle.artistA.twitter && (
                        <a href={`https://twitter.com/${battle.artistA.twitter}`} target="_blank" rel="noreferrer" className="p-2 bg-navy-900 rounded-full hover:bg-sky-500 hover:text-white transition-colors text-ui-gray">
                          <Twitter size={14} />
                        </a>
                      )}
                      {battle.artistA.musicLink && (
                        <a href={battle.artistA.musicLink} target="_blank" rel="noreferrer" className="p-2 bg-navy-900 rounded-full hover:bg-wave-blue hover:text-white transition-colors text-ui-gray">
                          <Music size={14} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* VS / Result */}
                  <div className="flex flex-col items-center">
                    {battle.isEnded ? (
                      <div className="flex flex-col items-center animate-in zoom-in duration-300">
                        <Trophy className="w-12 h-12 text-yellow-400 mb-2 drop-shadow-lg" />
                        <span className="text-yellow-400 font-bold tracking-widest uppercase">Chart Winner</span>
                        <span className="text-white font-bold text-lg mt-1 text-center max-w-[200px]">{winner === 'A' ? battle.artistA.name : battle.artistB.name}</span>
                        <span className="text-ui-gray text-sm mt-2 font-body">Margin: {formatSol(settlement.winMargin)}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center w-full max-w-xs">
                        <div className="text-ui-gray font-mono text-sm mb-2">{formatPct(battle.artistASolBalance / (totalTVL || 1) * 100)} vs {formatPct(battle.artistBSolBalance / (totalTVL || 1) * 100)}</div>
                        <div className="w-full h-2 bg-navy-900 rounded-full overflow-hidden flex">
                          <div className="h-full bg-wave-blue transition-all duration-500" style={{ width: `${(battle.artistASolBalance / (totalTVL || 1)) * 100}%` }}></div>
                          <div className="h-full bg-wave-green transition-all duration-500" style={{ width: `${(battle.artistBSolBalance / (totalTVL || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Artist B */}
                  <div className={`flex flex-col items-center text-center transition-all duration-500 ${winner === 'B' && battle.isEnded ? 'scale-110 drop-shadow-[0_0_15px_rgba(111,243,75,0.5)]' : 'opacity-80'}`}>
                    <div className="w-24 h-24 rounded-full p-1 border-2 border-wave-green mb-4 overflow-hidden shadow-lg shadow-wave-green/20 bg-navy-950">
                       {battle.artistB.avatar ? (
                        <img src={battle.artistB.avatar} alt="B" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-wave-green/20 flex items-center justify-center text-wave-green font-bold text-2xl">B</div>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-white">{battle.artistB.name}</h2>
                    <div className="mt-2 text-3xl font-mono font-bold text-wave-green">{formatSol(battle.artistBSolBalance)}</div>
                    <div className="text-xs text-wave-green text-opacity-80 font-mono">
                       {formatUsd(battle.artistBSolBalance, solPrice)}
                    </div>
                    <div className="text-xs text-wave-green/70 uppercase tracking-widest mt-1 font-bold">Final Pool Value</div>
                    <div className="flex gap-2 mt-3">
                      {battle.artistB.twitter && (
                        <a href={`https://twitter.com/${battle.artistB.twitter}`} target="_blank" rel="noreferrer" className="p-2 bg-navy-900 rounded-full hover:bg-sky-500 hover:text-white transition-colors text-ui-gray">
                          <Twitter size={14} />
                        </a>
                      )}
                      {battle.artistB.musicLink && (
                        <a href={battle.artistB.musicLink} target="_blank" rel="noreferrer" className="p-2 bg-navy-900 rounded-full hover:bg-wave-green hover:text-white transition-colors text-ui-gray">
                          <Music size={14} />
                        </a>
                      )}
                    </div>
                  </div>
               </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Trading Volume (Completed)"
                value={formatSol(totalVolume)}
                subValue={formatUsd(totalVolume, solPrice)}
                icon={<BarChart3 size={20} />}
                colorClass="text-wave-blue"
                tooltip="Total sum of all buy and sell transactions executed during this battle. This represents the total trading activity across both artist pools."
              />
              <StatCard
                label="Trades Executed"
                value={battle.tradeCount.toString()}
                subValue={`${battle.uniqueTraders} Unique Wallets`}
                icon={<TrendingUp size={20} />}
                colorClass="text-action-green"
                tooltip="Total number of individual buy/sell transactions executed by unique wallet addresses. Each wallet can make multiple trades."
              />
               <StatCard
                label={`${battle.artistA.name}'s Trading Volume`}
                value={formatSol(battle.totalVolumeA)}
                subValue={formatUsd(battle.totalVolumeA, solPrice)}
                icon={<Activity size={20} />}
                colorClass="text-wave-blue"
                tooltip={`All trading volume that occurred in ${battle.artistA.name}'s pool. Artists earn 1% of their pool's trading volume as fees.`}
              />
               <StatCard
                label={`${battle.artistB.name}'s Trading Volume`}
                value={formatSol(battle.totalVolumeB)}
                subValue={formatUsd(battle.totalVolumeB, solPrice)}
                icon={<Activity size={20} />}
                colorClass="text-wave-green"
                tooltip={`All trading volume that occurred in ${battle.artistB.name}'s pool. Artists earn 1% of their pool's trading volume as fees.`}
              />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              <div className="lg:col-span-2 space-y-8">
                
                <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-action-green" />
                      Final Settlement Breakdown
                      <InfoTooltip content="When a battle ends, the losing pool is distributed according to fixed percentages: 40% to winning traders, 50% returned to losing traders, 5% to winning artist, 2% to losing artist, and 3% to platform." />
                    </h3>
                    <div className="text-right">
                      <span className="block text-sm text-ui-gray bg-navy-900 px-3 py-1 rounded-lg border border-navy-800">
                        Total Distributed: {formatSol(settlement.loserPoolTotal)}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">{formatUsd(settlement.loserPoolTotal, solPrice)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <DistributionChart settlement={settlement} />
                    
                    <div className="space-y-4 flex flex-col justify-center font-body">
                      <div className="p-4 bg-navy-950/50 rounded-xl border-l-4 border-action-green">
                        <div className="flex justify-between items-center">
                          <span className="text-ui-gray text-sm">Winning Traders Received (40%)</span>
                          <span className="text-action-green font-bold font-mono">{formatSol(settlement.toWinningTraders)}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-navy-950/50 rounded-xl border-l-4 border-alert-red">
                        <div className="flex justify-between items-center">
                          <span className="text-ui-gray text-sm">Losing Traders Retained (50%)</span>
                          <span className="text-alert-red font-bold font-mono">{formatSol(settlement.toLosingTraders)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-navy-950/50 rounded-xl border-l-4 border-wave-green">
                          <div className="text-slate-500 text-xs mb-1">Winning Artist (5%)</div>
                          <div className="text-wave-green font-mono text-sm">{formatSol(settlement.toWinningArtist)}</div>
                        </div>
                        <div className="p-3 bg-navy-950/50 rounded-xl border-l-4 border-wave-blue">
                          <div className="text-slate-500 text-xs mb-1">Platform (3%)</div>
                          <div className="text-wave-blue font-mono text-sm">{formatSol(settlement.toPlatform)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 h-80 flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-6">
                      <h3 className="text-lg font-bold text-white">Final Pool Results</h3>
                      <InfoTooltip content="Total Value Locked (TVL) in each artist's pool at the end of the battle. The artist with the higher TVL wins the battle." />
                    </div>
                    <div className="flex-1 w-full min-h-[200px] min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tvlData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" width={100} stroke="#94a3b8" fontSize={12} fontFamily="Rajdhani" />
                          <Tooltip 
                            cursor={{fill: 'rgba(255,255,255,0.05)'}}
                            contentStyle={{ backgroundColor: '#151e32', borderColor: '#4A5568', color: '#f8fafc', fontFamily: 'Inter' }}
                            formatter={(value: number) => formatSol(value)}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {tvlData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  <MomentumGauge 
                    volA={battle.totalVolumeA} 
                    volB={battle.totalVolumeB} 
                    nameA={battle.artistA.name} 
                    nameB={battle.artistB.name} 
                    colorA={battle.artistA.color} 
                    colorB={battle.artistB.color} 
                  />
                </div>
              </div>

              <div className="space-y-8">
                <RoiCalculator battleState={battle} />

                <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6">
                   <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                     <DollarSign className="w-5 h-5 text-action-green" />
                     Artist Earnings (Final)
                     <InfoTooltip content="Artists earn revenue from two sources: continuous trading fees (1% of their pool's volume) and settlement bonuses (5% for winner, 2% for loser from the losing pool)." />
                   </h3>

                   <div className="space-y-6">
                     {/* Artist A Earnings */}
                     <div className="border-b border-navy-700 pb-4">
                       <div className="flex justify-between items-center mb-3">
                         <span className="text-slate-200 text-sm font-body font-semibold">
                           🎵 {battle.artistA.name} earned:
                         </span>
                         <div className="text-right">
                           <span className="block text-wave-blue font-mono font-bold text-lg">
                             {formatSol(settlement.artistAEarnings)}
                           </span>
                           <span className="text-[10px] text-slate-500">
                             {formatUsd(settlement.artistAEarnings, solPrice)}
                           </span>
                         </div>
                       </div>

                       {/* Breakdown */}
                       <div className="ml-6 space-y-1.5 text-xs">
                         <div className="flex justify-between items-center">
                           <span className="text-slate-400">
                             ├─ Trading fees (1% of {formatSol(battle.totalVolumeA)})
                           </span>
                           <div className="text-right">
                             <span className="font-mono text-slate-300 block">{formatSol(settlement.artistAFees)}</span>
                             <span className="text-[10px] text-slate-500">{formatUsd(settlement.artistAFees, solPrice)}</span>
                           </div>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-slate-400">
                             └─ {settlement.winnerId === 'A' ? 'Winner bonus (5%)' : 'Loser consolation (2%)'}
                           </span>
                           <div className="text-right">
                             <span className="font-mono text-slate-300 block">{formatSol(settlement.artistASettlement)}</span>
                             <span className="text-[10px] text-slate-500">{formatUsd(settlement.artistASettlement, solPrice)}</span>
                           </div>
                         </div>
                       </div>
                     </div>

                     {/* Artist B Earnings */}
                     <div className="border-b border-navy-700 pb-4">
                       <div className="flex justify-between items-center mb-3">
                         <span className="text-slate-200 text-sm font-body font-semibold">
                           🎵 {battle.artistB.name} earned:
                         </span>
                         <div className="text-right">
                           <span className="block text-wave-green font-mono font-bold text-lg">
                             {formatSol(settlement.artistBEarnings)}
                           </span>
                           <span className="text-[10px] text-slate-500">
                             {formatUsd(settlement.artistBEarnings, solPrice)}
                           </span>
                         </div>
                       </div>

                       {/* Breakdown */}
                       <div className="ml-6 space-y-1.5 text-xs">
                         <div className="flex justify-between items-center">
                           <span className="text-slate-400">
                             ├─ Trading fees (1% of {formatSol(battle.totalVolumeB)})
                           </span>
                           <div className="text-right">
                             <span className="font-mono text-slate-300 block">{formatSol(settlement.artistBFees)}</span>
                             <span className="text-[10px] text-slate-500">{formatUsd(settlement.artistBFees, solPrice)}</span>
                           </div>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-slate-400">
                             └─ {settlement.winnerId === 'B' ? 'Winner bonus (5%)' : 'Loser consolation (2%)'}
                           </span>
                           <div className="text-right">
                             <span className="font-mono text-slate-300 block">{formatSol(settlement.artistBSettlement)}</span>
                             <span className="text-[10px] text-slate-500">{formatUsd(settlement.artistBSettlement, solPrice)}</span>
                           </div>
                         </div>
                       </div>
                     </div>

                     {/* Platform Earnings */}
                     <div>
                       <div className="flex justify-between items-center mb-3">
                         <span className="text-slate-200 text-sm font-body font-semibold">
                           ⚡ WaveWarz Platform earned:
                         </span>
                         <div className="text-right">
                           <span className="block text-indigo-400 font-mono font-bold text-lg">
                             {formatSol(settlement.platformEarnings)}
                           </span>
                           <span className="text-[10px] text-slate-500">
                             {formatUsd(settlement.platformEarnings, solPrice)}
                           </span>
                         </div>
                       </div>

                       {/* Breakdown */}
                       <div className="ml-6 space-y-1.5 text-xs">
                         <div className="flex justify-between items-center">
                           <span className="text-slate-400">
                             ├─ Trading fees (0.5% of total volume)
                           </span>
                           <div className="text-right">
                             <span className="font-mono text-slate-300 block">{formatSol(settlement.platformFees)}</span>
                             <span className="text-[10px] text-slate-500">{formatUsd(settlement.platformFees, solPrice)}</span>
                           </div>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-slate-400">
                             └─ Settlement bonus (3% of loser pool)
                           </span>
                           <div className="text-right">
                             <span className="font-mono text-slate-300 block">{formatSol(settlement.platformSettlement)}</span>
                             <span className="text-[10px] text-slate-500">{formatUsd(settlement.platformSettlement, solPrice)}</span>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Explanation Note */}
                   <div className="mt-4 p-3 bg-wave-blue/10 rounded-lg text-xs text-wave-blue leading-relaxed font-body">
                     📖 Artists earn 1% of every trade in their pool, plus settlement bonuses:<br/>
                     • Winners get 5% of the losing pool<br/>
                     • Losers get 2% consolation from their own pool
                   </div>
                </div>

                <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 text-xs font-mono text-slate-500 break-all space-y-2">
                    <div className="font-bold text-ui-gray mb-1">PROGRAM ADDRESSES</div>
                    <div>PDA: <span className="text-slate-300">{battle.battleAddress}</span></div>
                    {battle.treasuryWallet && <div>Treasury: <span className="text-slate-300">{battle.treasuryWallet}</span></div>}
                    {battle.onChainWalletA && <div>Wallet A: <span className="text-slate-300">{battle.onChainWalletA}</span></div>}
                    {battle.onChainWalletB && <div>Wallet B: <span className="text-slate-300">{battle.onChainWalletB}</span></div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="fixed bottom-0 w-full bg-navy-950 border-t border-navy-800 py-1 px-4 text-[10px] text-slate-600 flex justify-between items-center z-40 backdrop-blur-sm bg-opacity-90">
         <div>WaveWarz Analytics v2.1</div>
         <div className="flex gap-4">
            <div className={`flex items-center gap-1.5 ${dataSource === 'Supabase' ? 'text-action-green' : 'text-orange-500'}`}>
               <Database size={10} />
               <span>Data Source: {dataSource}</span>
            </div>
            <div>RPC: Helius Mainnet</div>
         </div>
      </footer>

      <DebugDataSync />
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
