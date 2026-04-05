import { motion } from 'framer-motion';
import { useEngine } from '../context/EngineContext';
import { X, TrendingUp, TrendingDown, CheckCircle, Clock, Newspaper, BarChart2, DollarSign, Wifi } from 'lucide-react';
import { useState, useEffect } from 'react';

export const PolicyRoadmapPanel = () => {
  const { selectedDistrict, setSelectedDistrict, targetConnectivity, timeframe, mvtWeights, sandboxMultipliers } = useEngine();
  const [roadmapData, setRoadmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('roadmap');

  useEffect(() => {
    if (!selectedDistrict) return;
    setRoadmapData(null);
    setActiveTab('roadmap');
    fetchRoadmap();
  }, [selectedDistrict]);

  const fetchRoadmap = async () => {
    setLoading(true);
    try {
      setStatus('📊 Reading historical statistics...');
      await new Promise(r => setTimeout(r, 400));
      setStatus('🔍 Fetching trusted sources...');
      await new Promise(r => setTimeout(r, 300));

      const res = await fetch('http://localhost:5000/api/district-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district: selectedDistrict.name,
          target: targetConnectivity,
          timeframe,
          multipliers: sandboxMultipliers
        })
      });

      setStatus('🧠 Generating policy prescription...');
      await new Promise(r => setTimeout(r, 300));
      const data = await res.json();
      setRoadmapData(data);
      setStatus('');
    } catch (err) {
      setStatus('⚠️ Using offline data');
      setRoadmapData({
        district: selectedDistrict.name,
        division: 'N/A',
        current_score: selectedDistrict.connectivity,
        target: targetConnectivity,
        gap: targetConnectivity - selectedDistrict.connectivity,
        timeframe,
        network_generation: 'N/A',
        btrc_data: {},
        nttn_data: {},
        budget: { total_cost_crore: 0, annual_budget_crore: 0, actions: [] },
        indicator_trends: mvtWeights.slice(0, 5).map(w => ({
          name: w.token.split('_')[0].replace(/-/g, ' '),
          token: w.token,
          weight: w.weight,
          current_value: 45.2,
          target_value: 45.2 + (w.weight * 100 * timeframe * 0.8),
          change: w.weight * 100 * timeframe * 0.8,
          change_pct: (w.weight * 100 * timeframe * 0.8 / 45.2 * 100).toFixed(1),
          growth_per_year: w.weight * 80,
          direction: 'increase',
          natural_language: 'Offline mode — connect backend for detailed analysis.',
          history: []
        })),
        news: []
      });
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedDistrict) return null;

  const isGreen = selectedDistrict.status === 'green';
  const gap = roadmapData ? Math.max(0, roadmapData.gap) : 0;

  return (
    <motion.div
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 w-[420px] h-full z-[2000] flex flex-col"
      style={{ background: 'rgba(10,15,28,0.97)', borderLeft: '1px solid rgba(59,130,246,0.2)' }}
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-700/50">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white">{selectedDistrict.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {roadmapData?.division && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                  {roadmapData.division} Division
                </span>
              )}
              {roadmapData?.network_generation && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium flex items-center gap-1">
                  <Wifi className="w-3 h-3" />{roadmapData.network_generation}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setSelectedDistrict(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Score bar */}
        <div className="mt-3 bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
            <div>
              <div className="text-slate-400 mb-0.5">Current</div>
              <div className="font-bold text-blue-400">{selectedDistrict.connectivity.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-slate-400 mb-0.5">Gap</div>
              <div className={`font-bold ${gap > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {gap > 0 ? `-${gap.toFixed(1)}%` : '✓ Met'}
              </div>
            </div>
            <div>
              <div className="text-slate-400 mb-0.5">Target</div>
              <div className="font-bold text-emerald-400">{targetConnectivity}%</div>
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (selectedDistrict.connectivity / targetConnectivity) * 100)}%`,
                background: 'linear-gradient(90deg, #3b82f6, #10b981)'
              }}
            />
          </div>
        </div>

        {/* BTRC + NTTN quick stats */}
        {roadmapData && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-slate-800/40 rounded-lg p-2 text-xs border border-slate-700/30">
              <div className="text-slate-400 mb-1">Subscribers</div>
              <div className="font-bold text-white">{roadmapData.btrc_data?.total_subscribers_m || 'N/A'}M</div>
              <div className="text-slate-500">{roadmapData.btrc_data?.dominant_operator || ''} dominant</div>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-2 text-xs border border-slate-700/30">
              <div className="text-slate-400 mb-1">Fiber (NTTN)</div>
              <div className="font-bold text-white">{roadmapData.nttn_data?.ofc_km?.toLocaleString() || 'N/A'} km</div>
              <div className="text-slate-500">{roadmapData.nttn_data?.unused_tbps || 0} Tbps unused</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/50 bg-slate-900/40">
        {[
          { id: 'roadmap', label: '📋 Plan' },
          { id: 'trends', label: '📈 Trends' },
          { id: 'budget', label: '💰 Budget' },
          { id: 'news', label: '📰 News' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Loading */}
        {(loading || status) && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm text-blue-400 animate-pulse text-center">{status}</p>
          </div>
        )}

        {/* PLAN TAB */}
        {!loading && roadmapData && activeTab === 'roadmap' && (
          <div className="space-y-3">
            {isGreen ? (
              <>
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Why This District Meets Target
                </h3>
                {roadmapData.indicator_trends?.slice(0, 5).map((ind, i) => (
                  <div key={i} className="rounded-xl p-3 border border-emerald-500/20 bg-emerald-900/10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-emerald-300 capitalize">{ind.name}</span>
                      <span className="text-xs font-bold text-emerald-400">
                        +{ind.change_pct}% above baseline
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{ind.natural_language}</p>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Weight: {(ind.weight * 100).toFixed(2)}% | Value: {ind.current_value?.toFixed(1)}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Parallel Action Plan ({timeframe} Years)
                </h3>
                {roadmapData.indicator_trends?.map((ind, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-xl p-3 border border-slate-700/40 bg-slate-800/30"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-blue-300 capitalize">{ind.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        ind.direction === 'increase' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {ind.direction === 'increase' ? '↑' : '↓'} {Math.abs(ind.change_pct)}%
                      </span>
                    </div>

                    {/* Value change bar */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-slate-400 w-10">{ind.current_value?.toFixed(1)}</span>
                      <div className="flex-1 bg-slate-700 rounded-full h-1.5 relative">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                          style={{ width: `${Math.min(100, Math.abs(ind.change_pct))}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-emerald-400 w-10 text-right">{ind.target_value?.toFixed(1)}</span>
                    </div>

                    {/* Natural language */}
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{ind.natural_language}</p>

                    <div className="text-[10px] text-slate-500 border-t border-slate-700/50 pt-1.5 flex justify-between">
                      <span>Change needed: <span className="text-emerald-300 font-bold">
                        {ind.change > 0 ? '+' : ''}{ind.change?.toFixed(2)} ({ind.change > 0 ? '+' : ''}{ind.change_pct}%)
                      </span></span>
                      <span>{Math.abs(ind.growth_per_year?.toFixed(3))}/yr historical</span>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </div>
        )}

        {/* TRENDS TAB */}
        {!loading && roadmapData && activeTab === 'trends' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-400" /> Historical Indicator Trends
            </h3>
            {roadmapData.indicator_trends?.map((ind, i) => {
              const vals = ind.history?.map(h => h.value) || [];
              const max = Math.max(...vals, 1);
              const min = Math.min(...vals, 0);
              const range = max - min || 1;
              const isUp = vals.length > 1 && vals[vals.length - 1] > vals[0];

              return (
                <div key={i} className="rounded-xl p-3 border border-slate-700/30 bg-slate-800/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-blue-300 capitalize">{ind.name}</span>
                    <span className={`text-[10px] flex items-center gap-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isUp ? '+' : ''}{ind.growth_per_year?.toFixed(3)}/yr
                    </span>
                  </div>

                  {/* Bar chart */}
                  <div className="flex gap-0.5 items-end h-14 mb-1">
                    {ind.history?.slice(-10).map((h, j, arr) => {
                      const pct = ((h.value - min) / range) * 100;
                      const isLast = j === arr.length - 1;
                      return (
                        <div key={j} className="flex-1 flex flex-col items-center gap-0.5">
                          <div
                            className={`w-full rounded-sm transition-all ${isLast ? 'bg-emerald-500' : 'bg-blue-500/50'}`}
                            style={{ height: `${Math.max(4, pct)}%` }}
                            title={`${h.year}: ${h.value}`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-[9px] text-slate-600 mb-2">
                    <span>{ind.history?.[0]?.year}</span>
                    <span>{ind.history?.[ind.history.length - 1]?.year}</span>
                  </div>

                  {/* Natural language */}
                  <p className="text-[10px] text-slate-400 leading-relaxed">{ind.natural_language}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* BUDGET TAB */}
        {!loading && roadmapData && activeTab === 'budget' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-yellow-400" /> Budget Estimation
            </h3>

            {/* Total */}
            <div className="rounded-xl p-4 border border-yellow-500/20 bg-yellow-900/10">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Total Cost</div>
                  <div className="text-lg font-bold text-yellow-400">৳{roadmapData.budget?.total_cost_crore} Cr</div>
                  <div className="text-[10px] text-slate-500">${roadmapData.budget?.total_cost_usd_million}M USD</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Annual Budget</div>
                  <div className="text-lg font-bold text-emerald-400">৳{roadmapData.budget?.annual_budget_crore} Cr</div>
                  <div className="text-[10px] text-slate-500">per year × {timeframe} yrs</div>
                </div>
              </div>
              {roadmapData.budget?.nttn_available_capacity_tbps > 0 && (
                <div className="mt-3 text-[10px] text-blue-300 text-center border-t border-slate-700/50 pt-2">
                  💡 {roadmapData.budget.nttn_available_capacity_tbps} Tbps NTTN capacity available — leverage before new investment
                </div>
              )}
            </div>

            {/* Action items */}
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Action Breakdown</h4>
            {roadmapData.budget?.actions?.map((action, i) => (
              <div key={i} className={`rounded-lg p-3 border ${action.parallel ? 'border-blue-500/20 bg-blue-900/10' : 'border-slate-700/30 bg-slate-800/20'}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs text-slate-200 leading-relaxed flex-1 pr-2">{action.action}</span>
                  <span className="text-xs font-bold text-yellow-400 whitespace-nowrap">৳{action.cost_crore} Cr</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span className={action.parallel ? 'text-blue-400' : 'text-slate-500'}>
                    {action.parallel ? '⚡ Parallel' : '→ Sequential'}
                  </span>
                  <span>~{action.duration_months} months</span>
                </div>
              </div>
            ))}

            <p className="text-[9px] text-slate-600 text-center mt-2">{roadmapData.budget?.note}</p>
          </div>
        )}

        {/* NEWS TAB */}
        {!loading && roadmapData && activeTab === 'news' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-yellow-400" /> Intelligence Feed
            </h3>
            {roadmapData.news?.length > 0 ? (
              roadmapData.news.map((item, i) => (
                <div key={i} className="rounded-xl p-3 border border-slate-700/30 bg-slate-800/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.tier === 1 ? 'bg-blue-500/20 text-blue-300' :
                      item.tier === 2 ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {item.tier === 1 ? '🏛️' : item.tier === 2 ? '📰' : '🌐'} {item.source}
                    </span>
                    <span className="text-[9px] text-slate-600">{item.scraped_at}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.headline}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Newspaper className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm mb-1">No news found for {selectedDistrict.name}</p>
                <p className="text-xs">Try clicking Generate Analysis first,<br/>then select a district</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
