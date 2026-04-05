import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown, Globe } from 'lucide-react';

export const WorldDataComparison = () => {
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('compact');  // compact | all
  const [chartType, setChartType] = useState('radar');  // radar | bar | table
  const [expandedCountries, setExpandedCountries] = useState(false);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setLoading(true);
        const res = await fetch('http://localhost:5000/api/world-comparison');
        const data = await res.json();
        setComparisonData(data);
      } catch (err) {
        console.warn('World comparison fetch failed:', err);
        // Use fallback data
        setComparisonData({
          bangladesh: { country: 'Bangladesh', internet_access_pct: 45.2, 4g_availability_pct: 45.2, digital_literacy_pct: 38.5, connectivity_score: 45.2 },
          peer_countries_lowest_3: [],
          peer_countries_highest_3: [],
          global_average: { country: 'Global Average', internet_access_pct: 63.5, connectivity_score: 59.0 },
          regional_average: { country: 'Asia-Pacific', internet_access_pct: 72.1, connectivity_score: 68.0 }
        });
      } finally {
        setLoading(false);
      }
    };
    fetchComparison();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-slate-400 mt-3 text-sm">Loading world comparison data...</p>
      </div>
    );
  }

  if (!comparisonData) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
        <p>⚠️ Failed to load world comparison data</p>
      </div>
    );
  }

  const { bangladesh, peer_countries_lowest_3, peer_countries_highest_3, global_average, regional_average } = comparisonData;

  // Prepare radar data for chart
  const radarData = [
    {
      metric: 'Internet Access',
      Bangladesh: bangladesh.internet_access_pct,
      'Global Avg': global_average.internet_access_pct,
      'Asia-Pac Avg': regional_average.internet_access_pct,
    },
    {
      metric: '4G Availability',
      Bangladesh: bangladesh['4g_availability_pct'],
      'Global Avg': global_average['4g_availability_pct'] || 58.2,
      'Asia-Pac Avg': regional_average['4g_availability_pct'] || 68.5,
    },
    {
      metric: 'Digital Literacy',
      Bangladesh: bangladesh.digital_literacy_pct,
      'Global Avg': global_average.digital_literacy_pct || 55.3,
      'Asia-Pac Avg': regional_average.digital_literacy_pct || 62.7,
    },
    {
      metric: 'Connectivity Score',
      Bangladesh: bangladesh.connectivity_score,
      'Global Avg': global_average.connectivity_score,
      'Asia-Pac Avg': regional_average.connectivity_score,
    },
  ];

  const allCountries = [
    bangladesh,
    ...peer_countries_lowest_3,
    global_average,
    regional_average,
    ...peer_countries_highest_3,
  ];

  const barData = expandedCountries 
    ? allCountries 
    : [bangladesh, ...peer_countries_lowest_3.slice(0, 1), ...peer_countries_highest_3.slice(0, 1), regional_average];

  const COLORS = {
    Bangladesh: '#3b82f6',
    'Global Avg': '#ef4444',
    'Asia-Pac Avg': '#f59e0b',
    'Peer Low': '#10b981',
    'Peer High': '#a855f7',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-white">Global Context</h3>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 font-medium">
          Bangladesh vs Peers (ITU 2024)
        </span>
      </div>

      {/* Chart Type Selector */}
      <div className="flex gap-1.5">
        {[
          { id: 'radar', label: '📊 Radar' },
          { id: 'bar', label: '📈 Bar' },
          { id: 'table', label: '📋 Table' },
        ].map(mode => (
          <button
            key={mode.id}
            onClick={() => setChartType(mode.id)}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              chartType === mode.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Radar Chart View */}
      {chartType === 'radar' && (
        <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/30">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="metric" stroke="#94a3b8" style={{ fontSize: '11px' }} />
              <PolarRadiusAxis stroke="#475569" style={{ fontSize: '10px' }} />
              <Radar name="Bangladesh" dataKey="Bangladesh" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Radar name="Global Avg" dataKey="Global Avg" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
              <Radar name="Asia-Pac Avg" dataKey="Asia-Pac Avg" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bar Chart View */}
      {chartType === 'bar' && (
        <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/30">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid stroke="#334155" />
              <XAxis dataKey="country" stroke="#94a3b8" style={{ fontSize: '11px' }} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} />
              <Bar dataKey="connectivity_score" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table View */}
      {chartType === 'table' && (
        <div className="bg-slate-800/40 rounded-lg border border-slate-700/30 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.6)' }}>
                <th className="px-3 py-2 text-left text-slate-300 font-bold">Country</th>
                <th className="px-3 py-2 text-center text-slate-300 font-bold">Internet %</th>
                <th className="px-3 py-2 text-center text-slate-300 font-bold">4G %</th>
                <th className="px-3 py-2 text-center text-slate-300 font-bold">Digital %</th>
                <th className="px-3 py-2 text-center text-slate-300 font-bold">Score</th>
              </tr>
            </thead>
            <tbody>
              {(expandedCountries ? allCountries : [bangladesh, regional_average, global_average]).map((country, idx) => (
                <tr key={idx} className="border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                  <td className="px-3 py-2 font-medium text-slate-200">{country.country}</td>
                  <td className="px-3 py-2 text-center text-blue-400">{country.internet_access_pct}%</td>
                  <td className="px-3 py-2 text-center text-green-400">{country['4g_availability_pct'] !== undefined ? country['4g_availability_pct'] + '%' : 'N/A'}</td>
                  <td className="px-3 py-2 text-center text-yellow-400">{country.digital_literacy_pct !== undefined ? country.digital_literacy_pct + '%' : 'N/A'}</td>
                  <td className="px-3 py-2 text-center font-bold text-white">{country.connectivity_score}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Country Expansion Toggle */}
      <button
        onClick={() => setExpandedCountries(!expandedCountries)}
        className="w-full py-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-2"
      >
        {expandedCountries ? '▼' : '▶'} {expandedCountries ? 'Hide all countries' : `Show all countries (${allCountries.length} total)`}
      </button>

      {/* Key Insights */}
      <div className="space-y-2 text-xs text-slate-300">
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
          <strong className="text-blue-300">📌 Bangladesh Status:</strong> Currently at {bangladesh.connectivity_score}% connectivity score, trailing Asia-Pacific average by {(regional_average.connectivity_score - bangladesh.connectivity_score).toFixed(1)} points.
        </div>
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3">
          <strong className="text-emerald-300">🎯 Opportunity:</strong> With focused policy interventions (fiber, towers, digital literacy), Bangladesh can bridge the {(regional_average.connectivity_score - bangladesh.connectivity_score).toFixed(1)}-point gap within 5 years.
        </div>
      </div>
    </div>
  );
};

export default WorldDataComparison;
