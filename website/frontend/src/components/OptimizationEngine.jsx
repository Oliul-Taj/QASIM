import { useEngine } from '../context/EngineContext';
import { Settings, Target, Clock, Zap, Cpu, BarChart2, TrendingUp, TrendingDown, Lightbulb, Wallet } from 'lucide-react';
import { useRef, useCallback } from 'react';

export const OptimizationEngine = () => {
  const {
    targetConnectivity, setTargetConnectivity,
    timeframe, setTimeframe,
    budget, setBudget,
    mvtWeights, baselineIndicators,
    sandboxMultipliers, updateIndicatorMultiplier,
    resetSandbox, districtData, sandboxImpact, darkMode
  } = useEngine();

  // Debounce timer refs for real-time map sync
  const debounceTimers = useRef({});

  const dm = darkMode;
  const avgConnectivity = districtData.reduce((acc, curr) => acc + curr.connectivity, 0) / (districtData.length || 1);
  const redDistricts = districtData.filter(d => d.status === 'red').length;
  const greenDistricts = districtData.filter(d => d.status === 'green').length;

  const multToDelta = (mult) => Math.round((mult - 1.0) * 200);
  const deltaToMult = (delta) => 1.0 + delta / 200;

  const anyChanged = Object.values(sandboxMultipliers).some(v => v !== 1.0);

  // Dynamic proposals based on ML results + South Asian benchmarks
  const proposals = [];
  const lowDistricts = districtData.filter(d => d.connectivity < 40);
  if (lowDistricts.length > 0) {
    proposals.push({ icon: '📱', title: 'Region-Based Dynamic Tariff', desc: `${lowDistricts.length} districts below 40% — implement tiered mobile pricing (ref: India Jio rural model, Dialog Sri Lanka village plans). 30-50% reduced rates via USF subsidies.` });
  }
  if (redDistricts > 20) {
    proposals.push({ icon: '🏗️', title: 'Shared Tower Infrastructure', desc: `${redDistricts} critical districts — mandate tower co-location (ref: Myanmar Ooredoo-Telenor, PTA Pakistan). Reduces deployment cost by 40-60%.` });
  }
  if (avgConnectivity < 60) {
    proposals.push({ icon: '💡', title: 'Community Digital Hubs', desc: `National avg ${avgConnectivity.toFixed(1)}% — establish 1 digital hub per union council in RED districts (ref: Bangladesh a2i, Nepal community Wi-Fi). +25% digital literacy in 18mo.` });
  }
  proposals.push({ icon: '📡', title: 'LEO Satellite for CHT + Islands', desc: 'Deploy satellite backhaul for Bandarban, Rangamati, Khagrachari, Bhola (ref: Vietnam VNPT island model). Bridge last-mile for ~2M underserved.' });

  return (
    <div className={`flex-1 w-full h-full p-8 overflow-y-auto ${dm ? '' : 'bg-[#f5f0e8]'}`}>
      <div className="flex flex-col gap-1 mb-8">
        <div className="flex items-center gap-3">
          <Cpu className="text-blue-500 w-8 h-8" />
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-cyan-400 bg-clip-text text-transparent">
            Autonomous Optimization Engine
          </h2>
        </div>
        <p className={`text-sm ml-11 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
          Configure deployment scenarios — map updates in real-time as you adjust parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">

        {/* Goal Setters */}
        <div className={`${dm ? 'glass-panel' : 'bg-[#faf7f0] border border-[#d4cbb8]'} p-6 rounded-2xl relative overflow-hidden group`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-blue-500/20"></div>
          <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${dm ? 'text-slate-200' : 'text-slate-800'}`}>
            <Settings className="text-blue-400 w-5 h-5" /> Goal Input (Bangladesh)
          </h3>

          <div className="space-y-6">
            <div>
              <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${dm ? 'text-slate-400' : 'text-slate-600'}`}>
                <Target className="w-4 h-4 text-emerald-400" /> Target Connectivity %
              </label>
              <input
                type="range" min="20" max="100"
                value={targetConnectivity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  // Immediate UI update, debounced backend sync
                  setTargetConnectivity(val);
                  // Interdependent logic: simulate realistic infrastructure shifts
                  const baseShift = Math.max(0, val - 40);
                  if (val > 60) {
                    updateIndicatorMultiplier('num_4g_bases', 1.0 + (baseShift * 0.015));
                    updateIndicatorMultiplier('optical_fiber_km', 1.0 + (baseShift * 0.012));
                  } else {
                    updateIndicatorMultiplier('num_4g_bases', 1.0);
                    updateIndicatorMultiplier('optical_fiber_km', 1.0);
                  }
                }}
                className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className={`flex justify-between text-xs mt-2 font-bold ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                <span>20%</span>
                <span className="text-emerald-400 text-sm">{targetConnectivity}%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${dm ? 'text-slate-400' : 'text-slate-600'}`}>
                <Clock className="w-4 h-4 text-yellow-400" /> Policy Timeframe (Years)
              </label>
              <input
                type="range" min="1" max="20"
                value={timeframe}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  // Immediate update - no debounce for responsiveness
                  setTimeframe(val);
                }}
                className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className={`flex justify-between text-xs mt-2 font-bold ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                <span>1 YR</span>
                <span className="text-yellow-400 text-sm">{timeframe} YR</span>
                <span>20 YR</span>
              </div>
            </div>

            {/* Live Impact from Sandbox */}
            {anyChanged && (
              <div className={`mt-4 p-4 rounded-xl border ${dm ? 'border-blue-500/30 bg-blue-900/10' : 'border-blue-300 bg-blue-50'}`}>
                <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Zap className="w-3 h-3 animate-pulse" /> Live Sandbox Impact on Goals
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={`${dm ? 'bg-slate-800/60' : 'bg-white'} rounded-lg p-2`}>
                    <div className="text-[10px] text-slate-400 mb-1">Avg Connectivity</div>
                    <div className={`text-sm font-bold ${sandboxImpact.avgDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sandboxImpact.avgDelta >= 0 ? '+' : ''}{sandboxImpact.avgDelta}%
                    </div>
                  </div>
                  <div className={`${dm ? 'bg-slate-800/60' : 'bg-white'} rounded-lg p-2`}>
                    <div className="text-[10px] text-red-400 mb-1">Critical Districts</div>
                    <div className={`text-sm font-bold flex items-center justify-center gap-1 ${sandboxImpact.redDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sandboxImpact.redDelta <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                      {sandboxImpact.redDelta > 0 ? '+' : ''}{sandboxImpact.redDelta}
                    </div>
                  </div>
                  <div className={`${dm ? 'bg-slate-800/60' : 'bg-white'} rounded-lg p-2`}>
                    <div className="text-[10px] text-emerald-400 mb-1">Green Districts</div>
                    <div className={`text-sm font-bold flex items-center justify-center gap-1 ${sandboxImpact.greenDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sandboxImpact.greenDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {sandboxImpact.greenDelta > 0 ? '+' : ''}{sandboxImpact.greenDelta}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <span className="text-[10px] text-slate-400">Projected National Avg: </span>
                  <span className="text-xs font-bold text-white">{sandboxImpact.projectedAvg}%</span>
                  <span className="text-[10px] text-slate-500"> vs target </span>
                  <span className="text-xs font-bold text-emerald-400">{targetConnectivity}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Digital Divide Metrics + Proposals */}
        <div className={`${dm ? 'glass-panel border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-[#faf7f0] border-[#d4cbb8]'} p-6 rounded-2xl border`}>
          <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${dm ? 'text-slate-200' : 'text-slate-800'}`}>
            <BarChart2 className="text-emerald-400 w-5 h-5" /> Digital Divide Metrics
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className={`${dm ? 'bg-slate-800/50 border-[#ffffff10]' : 'bg-white border-slate-200'} p-3 rounded-xl border text-center`}>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Avg Connectivity</div>
              <div className={`text-xl font-bold ${dm ? 'text-white' : 'text-slate-800'}`}>{avgConnectivity.toFixed(1)}%</div>
            </div>
            <div className={`${dm ? 'bg-slate-800/50 border-red-500/20' : 'bg-white border-red-200'} p-3 rounded-xl border text-center`}>
              <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Critical</div>
              <div className={`text-xl font-bold ${dm ? 'text-white' : 'text-slate-800'}`}>{redDistricts}</div>
            </div>
            <div className={`${dm ? 'bg-slate-800/50 border-emerald-500/20' : 'bg-white border-emerald-200'} p-3 rounded-xl border text-center`}>
              <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">Target Met</div>
              <div className={`text-xl font-bold ${dm ? 'text-white' : 'text-slate-800'}`}>{greenDistricts}</div>
            </div>
          </div>

          <div className={`${dm ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'} p-3 rounded-lg border mb-4 shadow-sm`}>
            <div className={`flex justify-between text-xs mb-2 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>Progress toward {targetConnectivity}% target</span>
              <span className="font-bold text-emerald-400">{Math.min(100, ((avgConnectivity / targetConnectivity) * 100)).toFixed(1)}%</span>
            </div>
            <div className={`w-full rounded-full h-2.5 ${dm ? 'bg-slate-700/60' : 'bg-slate-200'} overflow-hidden mb-4`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (avgConnectivity / targetConnectivity) * 100)}%` }}
              />
            </div>
            {/* Dynamic Calculated Budget Output */}
            <div className={`pt-3 border-t flex items-center justify-between ${dm ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <div className={`flex items-center gap-1.5 text-xs font-bold ${dm ? 'text-cyan-400' : 'text-cyan-600'}`}>
                <Wallet className="w-4 h-4" /> Estimated Budget Required
              </div>
              <div className="text-right">
                <div className={`text-base font-black ${dm ? 'text-white' : 'text-slate-800'}`}>
                  ${Math.round(redDistricts * 15.5 + Math.max(0, targetConnectivity - avgConnectivity) * 11.2) + 20}M <span className="text-[10px] text-slate-500 font-normal">USD</span>
                </div>
                <div className="text-xs text-yellow-500 font-bold">
                  ~{Math.round((redDistricts * 15.5 + Math.max(0, targetConnectivity - avgConnectivity) * 11.2 + 20) * 11.0)} <span className="text-[10px]">Crore BDT</span>
                </div>
              </div>
            </div>
          </div>

          {/* Smart Proposals */}
          <div className={`border-t pt-3 ${dm ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-3 text-blue-400">
              <Lightbulb className="w-3.5 h-3.5" /> Smart Policy Proposals
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 ml-1">Proposal</span>
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {proposals.map((p, i) => (
                <div key={i} className={`rounded-lg p-2.5 border text-xs ${dm ? 'border-slate-700/30 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                  <div className={`font-bold mb-1 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>{p.icon} {p.title}</div>
                  <p className={`leading-relaxed ${dm ? 'text-slate-400' : 'text-slate-500'}`} style={{ fontSize: '10px' }}>{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MVT Weight Tweaker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className={`font-bold text-xl ${dm ? 'text-slate-200' : 'text-slate-800'}`}>Policy Intervention Simulator</h3>
        <button
          onClick={resetSandbox}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors border shadow-md ${
            dm ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
          }`}
        >
          Reset to Baseline (0%)
        </button>
      </div>

      <p className={`mb-6 max-w-3xl text-sm ${dm ? 'text-slate-400' : 'text-slate-600'}`}>
        Simulate policy interventions by shifting indicators between <span className="text-red-400 font-bold">-100%</span> (complete removal) and <span className="text-emerald-400 font-bold">+100%</span> (doubling). Changes instantly update district scores, map colors, and goal progress above.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mvtWeights.slice(0, 12).map((item) => {
          const mult = sandboxMultipliers[item.token] || 1.0;
          const delta = multToDelta(mult);
          const isPositive = delta > 0;
          const isNegative = delta < 0;
          const rawBaseline = baselineIndicators?.[item.token];

          return (
            <div key={item.token} className={`${dm ? 'glass-panel' : 'bg-[#faf7f0]'} p-4 rounded-xl transition-colors border ${
              isNegative ? 'border-red-500/30' : isPositive ? 'border-emerald-500/30' : dm ? 'border-slate-700/50' : 'border-[#d4cbb8]'
            }`}>
              <div className={`text-xs font-mono mb-1 truncate capitalize ${dm ? 'text-blue-300' : 'text-blue-600'}`} title={item.token}>
                {item.token.replace(/_[0-9]+$/, '').replace(/-/g, ' ')}
              </div>
              <div className={`text-[10px] font-mono mb-3 pb-2 flex justify-between border-b ${dm ? 'text-slate-500 border-slate-800/80' : 'text-slate-400 border-slate-200'}`}>
                <span>Base: {rawBaseline?.toLocaleString() || 'N/A'}</span>
                <span>(Weight: {item.weight?.toFixed(3)})</span>
              </div>

              <div className={`flex justify-between text-[10px] mb-1 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>
                <span>-100%</span>
                <span>0%</span>
                <span>+100%</span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-100" max="100" step="1"
                  value={delta}
                  onChange={(e) => updateIndicatorMultiplier(item.token, deltaToMult(Number(e.target.value)))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: isNegative ? '#ef4444' : '#10b981' }}
                />
                <span className={`text-xs font-bold w-14 text-right ${
                  isPositive ? 'text-emerald-400' :
                  isNegative ? 'text-red-400' :
                  'text-slate-400'
                }`}>
                  {isPositive ? `+${delta}%` : `${delta}%`}
                </span>
              </div>

              <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden relative">
                <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
                <div
                  className={`h-full rounded-full transition-all absolute top-0 ${isNegative ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{
                    width: `${Math.abs(delta) / 2}%`,
                    left: isNegative ? `${50 - Math.abs(delta) / 2}%` : '50%',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
