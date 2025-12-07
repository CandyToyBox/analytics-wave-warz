import React, { useState } from 'react';
import { BattleState, TraderSimulation } from '../types';
import { calculateTraderRoi, formatPct, formatSol } from '../utils';
import { Calculator, Coins } from 'lucide-react';

interface Props {
  battleState: BattleState;
}

export const RoiCalculator: React.FC<Props> = ({ battleState }) => {
  const [side, setSide] = useState<'A' | 'B'>('A');
  const [investment, setInvestment] = useState<number>(10); // SOL
  
  // Mock price derivation for estimation
  const supply = side === 'A' ? battleState.artistASupply : battleState.artistBSupply;
  const pool = side === 'A' ? battleState.artistASolBalance : battleState.artistBSolBalance;
  // Simple assumed price = pool / supply for simulation
  const assumedPrice = pool / supply; 
  const tokensHeld = investment / assumedPrice;

  const sim: TraderSimulation = {
    side,
    investmentSol: investment,
    tokensHeld,
  };

  const result = calculateTraderRoi(battleState, sim);
  const isProfit = result.profit >= 0;

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6">
      <div className="flex flex-col gap-2 mb-6 border-b border-navy-700 pb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-wave-blue" />
          <h3 className="text-lg font-bold text-white">What If You Had Invested?</h3>
        </div>
        <p className="text-xs text-ui-gray font-body">Hypothetical returns calculator</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-uppercase text-ui-gray mb-1">Select Artist</label>
            <div className="flex bg-navy-900 p-1 rounded-lg border border-navy-700">
              <button
                onClick={() => setSide('A')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
                  side === 'A'
                    ? 'bg-wave-blue/20 text-wave-blue border border-wave-blue/50'
                    : 'text-ui-gray hover:text-white'
                }`}
              >
                {battleState.artistA.name}
              </button>
              <button
                onClick={() => setSide('B')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
                  side === 'B'
                    ? 'bg-wave-green/20 text-wave-green border border-wave-green/50'
                    : 'text-ui-gray hover:text-white'
                }`}
              >
                {battleState.artistB.name}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-uppercase text-ui-gray mb-1">Investment Amount (SOL)</label>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={investment}
                onChange={(e) => setInvestment(parseFloat(e.target.value) || 0)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg py-2 px-3 pl-10 text-white focus:outline-none focus:border-wave-blue transition-colors"
              />
              <Coins className="w-4 h-4 text-ui-gray absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="p-3 bg-navy-900 rounded-lg border border-navy-700 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-ui-gray">Est. Tokens:</span>
              <span className="font-mono text-slate-300">{tokensHeld.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ui-gray">Share of Pool:</span>
              <span className="font-mono text-slate-300">{((tokensHeld / supply) * 100).toFixed(4)}%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className={`p-4 rounded-xl border-2 ${isProfit ? 'bg-action-green/10 border-action-green/30' : 'bg-alert-red/10 border-alert-red/30'}`}>
            <div className="text-center mb-1">
              <span className="text-xs text-ui-gray uppercase tracking-wider">You Would Have Received</span>
            </div>
            <div className={`text-3xl font-bold text-center mb-1 ${isProfit ? 'text-action-green' : 'text-alert-red'}`}>
              {formatPct(result.roi)}
            </div>
            <div className="text-center text-slate-300 font-mono text-sm mb-4">
              {formatSol(result.payout)}
            </div>

            <div className="space-y-2 border-t border-navy-700/50 pt-3">
              <div className="flex justify-between text-xs">
                <span className="text-ui-gray">Initial Investment:</span>
                <span className="text-slate-200">{formatSol(investment)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ui-gray">Would Have Earned:</span>
                <span className={isProfit ? 'text-action-green' : 'text-alert-red'}>
                  {isProfit ? '+' : ''}{formatSol(result.profit)}
                </span>
              </div>
            </div>
          </div>
          <div className="text-center mt-3">
            <span className="text-[10px] text-ui-gray bg-navy-900 px-2 py-1 rounded-full border border-navy-700">
              {result.note}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};