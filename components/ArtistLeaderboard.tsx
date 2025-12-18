import React, { useState, useEffect } from 'react';
import { BattleSummary, ArtistLeaderboardStats } from '../types';
import { calculateArtistLeaderboard } from '../services/artistLeaderboardService';
import { fetchBattleOnChain } from '../services/solanaService';
import { saveArtistLeaderboardToDB } from '../services/supabaseClient';
import { formatSol, formatUsd, formatPct } from '../utils';
import { Music, Disc, Twitter, Loader2, PlayCircle, Check } from 'lucide-react';
import { useArtistLeaderboard as useArtistLeaderboardQuery } from '../hooks/useBattleData';

interface Props {
    battles: BattleSummary[];
    solPrice: number;
}

export const ArtistLeaderboard: React.FC<Props> = ({ battles, solPrice }) => {
    const [stats, setStats] = useState<ArtistLeaderboardStats[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [dataOrigin, setDataOrigin] = useState<'Estimated' | 'Database' | 'Live'>('Estimated');
    const { data: cachedStats = [], isFetching: _leaderboardFetching } = useArtistLeaderboardQuery(battles, solPrice);

    useEffect(() => {
        if (isScanning || dataOrigin === 'Live') return;

        if (cachedStats && cachedStats.length > 0) {
            setStats(cachedStats);
            setDataOrigin('Database');
        } else {
            setStats([]);
            setDataOrigin('Database');
        }
    }, [cachedStats, isScanning, dataOrigin]);

    const handleScan = async () => {
        setIsScanning(true);
        setScanProgress(0);

        const enrichedBattles = [];
        const BATCH_SIZE = 2;
        const DELAY = 2000;

        for (let i = 0; i < battles.length; i += BATCH_SIZE) {
            const batch = battles.slice(i, i + BATCH_SIZE);
            try {
                const promises = batch.map(b => fetchBattleOnChain(b));
                const results = await Promise.all(promises);
                enrichedBattles.push(...results);
            } catch (e) {
                console.error("Batch error", e);
                enrichedBattles.push(...batch.map(b => ({
                    ...b, startTime: 0, endTime: 0, isEnded: true, artistASolBalance: b.artistASolBalance || 0, artistBSolBalance: b.artistBSolBalance || 0,
                    artistASupply: 0, artistBSupply: 0, totalVolumeA: 0, totalVolumeB: 0, tradeCount: 0, uniqueTraders: 0, recentTrades: [], battleAddress: ''
                })));
            }
            setScanProgress(enrichedBattles.length);
            await new Promise(r => setTimeout(r, DELAY));
        }

        const refinedStats = calculateArtistLeaderboard(enrichedBattles, solPrice);
        setStats(refinedStats);
        setDataOrigin('Live');
        setIsScanning(false);

        // Save to DB for next time
        await saveArtistLeaderboardToDB(refinedStats);
    };

    const topArtist = stats[0];
    const runnersUp = stats.slice(1, 3);
    const rest = stats.slice(3);

    const TotalPayouts = stats.reduce((acc, curr) => acc + curr.totalEarningsSol, 0);
    const TotalStreams = stats.reduce((acc, curr) => acc + curr.spotifyStreamEquivalents, 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header Stats */}
            <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 md:p-8 text-center relative overflow-hidden shadow-lg">
                <div className="relative z-10">
                    <h2 className="text-wave-blue text-sm uppercase tracking-widest font-bold mb-2">Total Artist Payouts</h2>
                    <div className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">
                        {formatSol(TotalPayouts)}
                        <span className="text-2xl text-ui-gray font-normal ml-2">({formatUsd(TotalPayouts, solPrice)})</span>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-wave-green/10 text-wave-green px-4 py-2 rounded-full border border-wave-green/20 backdrop-blur-sm mt-4 shadow-sm">
                        <Music size={20} className="animate-pulse" />
                        <span className="font-bold">Equivalent to {TotalStreams.toLocaleString()} Spotify Streams</span>
                    </div>
                </div>
                {/* Background Gradient Accents */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-wave-blue/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-wave-green/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>
            </div>

            {/* Data Source Control */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs text-ui-gray">
                    {dataOrigin === 'Database' && <><Check size={14} className="text-wave-green" /> Loaded from Cache</>}
                    {dataOrigin === 'Estimated' && <span className="text-orange-400">Viewing Estimated Data</span>}
                    {dataOrigin === 'Live' && <span className="text-wave-green font-bold">Live On-Chain Data (Synced)</span>}
                </div>

                {isScanning ? (
                    <div className="flex items-center gap-3 bg-navy-900 px-4 py-2 rounded-lg border border-navy-800">
                        <Loader2 className="animate-spin text-wave-blue" size={16} />
                        <span className="text-xs text-ui-gray">Scanning Blockchain... ({scanProgress}/{battles.length})</span>
                    </div>
                ) : (
                    <button
                        onClick={handleScan}
                        className={`flex items-center gap-2 text-xs font-bold transition-colors ${dataOrigin === 'Database' ? 'text-ui-gray hover:text-white' : 'text-wave-blue hover:text-white'}`}
                    >
                        <PlayCircle size={14} /> {dataOrigin === 'Database' ? 'Force Resync Volume' : 'Sync Real-Time Volume'}
                    </button>
                )}
            </div>

            {/* The Podium (Top 3) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {runnersUp[0] && <ArtistCard artist={runnersUp[0]} rank={2} solPrice={solPrice} />}
                {topArtist && <ArtistCard artist={topArtist} rank={1} solPrice={solPrice} isWinner />}
                {runnersUp[1] && <ArtistCard artist={runnersUp[1]} rank={3} solPrice={solPrice} />}
            </div>

            {/* The List (Rest) */}
            <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
                <div className="p-4 bg-navy-900 border-b border-navy-700 text-xs font-bold text-ui-gray uppercase tracking-wider flex justify-between">
                    <span>Rank 4+</span>
                    <span>Earnings Breakdown</span>
                </div>
                <div className="divide-y divide-navy-700">
                    {rest.map((artist, idx) => (
                        <div key={artist.artistName} className="p-4 hover:bg-navy-700 transition-colors flex flex-col sm:flex-row items-center gap-4">
                            <div className="font-mono text-ui-gray w-8 text-center font-bold">#{idx + 4}</div>

                            <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                                <div className="w-10 h-10 rounded-full bg-navy-900 overflow-hidden shrink-0 border border-navy-700">
                                    {artist.imageUrl ? (
                                        <img src={artist.imageUrl} className="w-full h-full object-cover" alt={artist.artistName} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-ui-gray">
                                            <Music size={16} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="font-bold text-white">{artist.artistName}</div>
                                    <div className="text-xs text-ui-gray flex gap-2">
                                        <span>{artist.battlesParticipated} Battles</span>
                                        <span>•</span>
                                        <span>{formatPct(artist.winRate)} WR</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-8 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-right">
                                    <div className="text-xs text-ui-gray mb-0.5">Stream Equiv.</div>
                                    <div className="font-bold text-wave-green flex items-center justify-end gap-1">
                                        <Disc size={12} />
                                        {artist.spotifyStreamEquivalents.toLocaleString()}
                                    </div>
                                </div>
                                <div className="text-right min-w-[100px]">
                                    <div className="text-xs text-ui-gray mb-0.5">Total Earnings</div>
                                    <div className="font-bold text-white font-mono">{formatSol(artist.totalEarningsSol)}</div>
                                    <div className="text-[10px] text-ui-gray">{formatUsd(artist.totalEarningsSol, solPrice)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ArtistCard: React.FC<{ artist: ArtistLeaderboardStats, rank: number, isWinner?: boolean, solPrice: number }> = ({ artist, rank, isWinner, solPrice }) => {
    return (
        <div className={`relative bg-navy-800 border ${isWinner ? 'border-yellow-500/50 shadow-xl shadow-yellow-900/10' : 'border-navy-700'} rounded-2xl overflow-hidden flex flex-col ${isWinner ? 'md:-mt-12 z-10' : ''}`}>
            {isWinner && (
                <div className="bg-yellow-500 text-navy-950 text-center py-1 text-xs font-bold uppercase tracking-widest">
                    #1 Top Earner
                </div>
            )}

            <div className="p-6 flex flex-col items-center text-center">
                <div className={`relative mb-4 ${isWinner ? 'w-24 h-24' : 'w-20 h-20'}`}>
                    <div className={`w-full h-full rounded-full overflow-hidden border-4 ${isWinner ? 'border-yellow-500' : rank === 2 ? 'border-slate-300' : 'border-orange-700'}`}>
                        {artist.imageUrl ? (
                            <img src={artist.imageUrl} alt={artist.artistName} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-navy-900 flex items-center justify-center text-ui-gray"><Music /></div>
                        )}
                    </div>
                    <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 border-navy-800 ${isWinner ? 'bg-yellow-500 text-black' : rank === 2 ? 'bg-slate-300 text-black' : 'bg-orange-700 text-white'
                        }`}>
                        #{rank}
                    </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-1 truncate w-full">{artist.artistName}</h3>

                <div className="my-4 w-full bg-navy-900 rounded-xl p-3 border border-navy-700">
                    <div className="text-[10px] text-ui-gray uppercase tracking-wider mb-1">Stream Equivalent</div>
                    <div className="text-xl font-black text-wave-green flex items-center justify-center gap-1.5">
                        <Disc size={18} className="animate-spin-slow" />
                        {artist.spotifyStreamEquivalents.toLocaleString()}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mb-4">
                    <div>
                        <div className="text-xs text-ui-gray">Earnings</div>
                        <div className="font-bold text-white">{formatSol(artist.totalEarningsSol)}</div>
                        <div className="text-[10px] text-ui-gray">{formatUsd(artist.totalEarningsSol, solPrice)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-ui-gray">Win Rate</div>
                        <div className="font-bold text-wave-blue">{formatPct(artist.winRate)}</div>
                        <div className="text-[10px] text-ui-gray">{artist.wins}W - {artist.losses}L</div>
                    </div>
                </div>

                <div className="flex gap-2 w-full pt-4 border-t border-navy-700">
                    {artist.twitterHandle && (
                        <a href={`https://twitter.com/${artist.twitterHandle}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center py-2 rounded bg-navy-900 hover:bg-sky-500/10 text-ui-gray hover:text-sky-400 border border-navy-700 transition-colors">
                            <Twitter size={16} />
                        </a>
                    )}
                    {artist.musicLink && (
                        <a href={artist.musicLink} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center py-2 rounded bg-navy-900 hover:bg-wave-green/10 text-ui-gray hover:text-wave-green border border-navy-700 transition-colors">
                            <Music size={16} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};
