import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MapView } from './components/MapView';
import { OptimizationEngine } from './components/OptimizationEngine';
import { EngineerView } from './components/EngineerView';
import { PolicyRoadmapPanel } from './components/PolicyRoadmapPanel';
import ReportGenerationPanel from './components/ReportGenerationPanel';
import { useEngine } from './context/EngineContext';
import { AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { loading, darkMode, setDarkMode } = useEngine();

  // Apply theme to root — central, dynamic
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    document.body.style.background = darkMode ? '#0a0f1c' : '#f5f0e8';
    document.body.style.color = darkMode ? '#e2e8f0' : '#1e293b';
  }, [darkMode]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-[#f5f0e8]'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-xl font-medium animate-pulse text-blue-400">Initializing Optimization Engine...</p>
        </div>
      </div>
    );
  }

  const bg = darkMode ? 'bg-[#0a0f1c]' : 'bg-[#f5f0e8]';
  const text = darkMode ? 'text-slate-100' : 'text-slate-800';

  return (
    <div className={`flex h-screen w-full ${bg} ${text} overflow-hidden font-sans relative`}>

      {/* Theme Toggle */}
      <button
        onClick={() => setDarkMode(d => !d)}
        className={`fixed top-4 right-4 z-[9999] p-2.5 rounded-xl border transition-all shadow-lg ${
          darkMode
            ? 'bg-slate-800 border-slate-600 text-yellow-400 hover:bg-slate-700'
            : 'bg-[#ede8dc] border-[#c8bfa9] text-slate-700 hover:bg-[#e2dcc8]'
        }`}
        title={darkMode ? 'Switch to Day Mode' : 'Switch to Night Mode'}
      >
        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 relative overflow-hidden flex flex-col">
        {activeTab === 'dashboard' && (
          <div className="w-full h-full relative">
            <MapView />
            <AnimatePresence>
              <PolicyRoadmapPanel />
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'engine' && <OptimizationEngine />}
        {activeTab === 'engineer' && <EngineerView />}

        {activeTab === 'reports' && (
          <div className={`flex-1 w-full h-full overflow-y-auto p-10 ${darkMode ? '' : 'bg-[#f5f0e8]'}`}>
            <div className="max-w-6xl mx-auto">
              <ReportGenerationPanel />
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className={`flex-1 w-full h-full overflow-y-auto p-10 ${darkMode ? '' : 'bg-[#f5f0e8]'}`}>
            <div className="max-w-4xl mx-auto space-y-8">

              {/* Title */}
              <div className={`rounded-2xl p-8 border ${darkMode ? 'glass-panel border-blue-500/20' : 'bg-[#faf7f0] border-[#d4cbb8] shadow-sm'}`}>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-300 to-cyan-400 bg-clip-text text-transparent mb-3">
                  Connectiva
                </h2>
                <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Autonomous Regional Digital Divide Optimization Engine
                </p>
                <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Developed for the <strong className="text-blue-400">ITU UMC Hackathon 2025</strong> · Bangladesh Digital Inclusion Initiative
                </p>
              </div>

              {/* What is Connectiva */}
              <div className={`rounded-2xl p-8 border ${darkMode ? 'glass-panel border-slate-700/40' : 'bg-[#faf7f0] border-[#d4cbb8] shadow-sm'}`}>
                <h3 className="text-xl font-bold text-blue-400 mb-4">What is Connectiva?</h3>
                <p className={`leading-relaxed mb-4 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Connectiva is a scientifically-driven policy intelligence platform built to eliminate the digital divide across Bangladesh's 64 districts.
                  Unlike static dashboards, Connectiva combines real-time machine learning inference, PID control theory, and live data pipelines
                  to autonomously generate actionable, year-by-year infrastructure roadmaps for policymakers and engineers.
                </p>
                <p className={`leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  The system ingests 154 ITU indicators, BTRC division-level subscriber data, HIES household survey statistics,
                  BTS tower counts, and NTTN fiber capacity data — synthesizing them into a unified scoring framework
                  that dynamically responds to user-defined connectivity targets.
                </p>
              </div>

              {/* Technical Architecture */}
              <div className={`rounded-2xl p-8 border ${darkMode ? 'glass-panel border-slate-700/40' : 'bg-[#faf7f0] border-[#d4cbb8] shadow-sm'}`}>
                <h3 className="text-xl font-bold text-emerald-400 mb-5">Technical Architecture</h3>
                <div className="space-y-4">
                  {[
                    {
                      title: '1. Autonomous Data Pipeline',
                      color: 'text-blue-400',
                      desc: (
                        <ul className="list-decimal pl-5 space-y-1 mt-2">
                          <li>Auto-synchronizes primary indicator clusters continuously spanning ITU dashboard, BTRC endpoints, and BBS APIs.</li>
                          <li>Parses massive unified global database metrics isolated in secure sandbox validation.</li>
                          <li>Fuses historical data from 154 ITU global matrices and HIES household metrics automatically.</li>
                          <li>Manual override injection natively formats unverified custom external datasets dynamically on structural drift.</li>
                        </ul>
                      ),
                    },
                    {
                      title: '2. ML Model — ConnectivaNet v4',
                      color: 'text-emerald-400',
                      desc: 'Extra Trees Classifier trained on 64 districts × 22 engineered features using Leave-Division-Out cross-validation (8 folds). Achieved F1-Weighted: 0.9842, AUC-ROC: 0.9814 with zero data leakage. Automatically profiles and generates mathematical Smart Policy Proposals dynamically cross-referencing global South Asian scaling models (India Jio, Myanmar Ooredoo).',
                    },
                    {
                      title: '3. 70:30 Heuristic Pre-Routing & Blinking Algorithm',
                      color: 'text-yellow-400',
                      desc: 'Map indicators isolate priority attention leveraging mathematical probability — specifically isolating exactly the top 70% of "Yellow" transitioning districts with marginal gaps alongside the lowest 30% of critical "Red" baseline nodes to maximize policy impact and efficiently allocate BDT framework infrastructure sourcing budgets natively.',
                    },
                    {
                      title: '4. PID Controller + Nodal Dependency Tree',
                      color: 'text-purple-400',
                      desc: 'A sequential PID controller (Kp=0.6, Ki=0.1, Kd=0.05) translates the connectivity gap into a year-by-year intervention magnitude. Advanced Sub-Indicator Interdependencies inherently shift relative technical correlation components (e.g., Optical Fiber expansions vs target bounds) intelligently alongside the master Sandbox sliders organically.',
                    },
                    {
                      title: '5. Policy Roadmap Generation',
                      color: 'text-cyan-400',
                      desc: 'Per-district roadmaps are generated using PID-driven growth simulation, MVT weight-ranked indicator selection, historical trend analysis from 25 years of ITU data, and real-time news intelligence scraped from BTRC, BBS, TBS News, Daily Star, and CNN. Dynamic Budget mapping natively constructs estimated capital sourcing.',
                    },
                    {
                      title: '6. Backend — Flask + Python ML Pipeline',
                      color: 'text-orange-400',
                      desc: 'Flask REST API serves ML inference, district scoring with spatial disaggregation using BTRC division data, automated news scraping with caching, budget estimation using BTRC/ITU cost benchmarks, real-time file analysis pipeline (CSV/XLSX/JSON/PDF/DOC), and ITU/BTRC data auto-update integration.',
                    },
                    {
                      title: '7. Frontend — React + Vite + Leaflet',
                      color: 'text-blue-300',
                      desc: 'Built with React 18, Vite 8, Tailwind CSS, Framer Motion, and Recharts. The interactive map uses Leaflet with CartoDB dark tiles and Bangladesh ADM2 GeoJSON (64 district polygons). Engineer View provides live ML diagnostics, global region ITU benchmark visuals, and real-time comparative metrics matrices.',
                    },
                  ].map(({ title, color, desc }) => (
                    <div key={title} className={`rounded-xl p-4 border ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-[#f0ebe0] border-[#d4cbb8]'}`}>
                      <div className={`font-bold text-sm mb-2 ${color}`}>{title}</div>
                      <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Features */}
              <div className={`rounded-2xl p-8 border ${darkMode ? 'glass-panel border-slate-700/40' : 'bg-[#faf7f0] border-[#d4cbb8] shadow-sm'}`}>
                <h3 className="text-xl font-bold text-cyan-400 mb-5">Key Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ['🗺️ Dynamic Map', 'RED/YELLOW/GREEN coloring shifts in real time based on user target. Integrated 70:30 priority focus blinking algorithm.'],
                    ['🤖 ConnectivaNet v4', 'Extra Trees ML model with 98.4% F1 on held-out divisions. Zero data leakage methodology. Smart Proposals mapped directly.'],
                    ['⚙️ PID Policy Engine', 'Mathematical PID controller generates realistic year-by-year policy intervention magnitudes against specific timeframes.'],
                    ['📊 Engineer View', 'Scientific ML dashboards: Confusion Matrix, ROC curves, Precision-Recall Topography, Radar, and Global Benchmarks.'],
                    ['🔬 Sandbox Simulator', 'Adjust multiple telecom indicators ±100% and instantly observe national connectivity structural impact dynamically.'],
                    ['📋 Report Generation', 'Download comprehensive district-level HTML reports with prioritized areas, policy proposals, Sandbox Tracking Delta and matrices.'],
                    ['📁 Real-time Upload', 'Upload generic raw files for sandbox validation parsing seamlessly overriding standard automatic DB extraction pipelines.'],
                    ['💡 Smart Logistics', 'Dynamic ML-triggered logistics budgeting output automatically mapped based on individual district deficit matrices. Displayed naturally in USD & BDT.'],
                  ].map(([title, desc]) => (
                    <div key={title} className={`rounded-xl p-4 border ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-[#f0ebe0] border-[#d4cbb8]'}`}>
                      <div className={`font-bold text-sm mb-1 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{title}</div>
                      <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team */}
              <div className={`rounded-2xl p-8 border ${darkMode ? 'glass-panel border-blue-500/20' : 'bg-[#faf7f0] border-[#d4cbb8] shadow-sm'}`}>
                <h3 className="text-xl font-bold text-blue-400 mb-6">Team Connectiva</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { name: 'Sumaiya Sifat', role: 'Team Lead', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: darkMode ? 'bg-emerald-900/10' : 'bg-emerald-50', desc: 'Project coordination, research direction, data sourcing from BTRC/BBS, bridging communication and stakeholder alignment.' },
                    { name: 'Mir Oliul Pasha Taj', role: 'System Architect', color: 'text-orange-400', border: 'border-orange-500/30', bg: darkMode ? 'bg-orange-900/10' : 'bg-orange-50', desc: 'Backend development, Flask API engineering, data pipeline integration, server-side ML inference, news scraping system, and database management.' },
                    { name: 'Tanim Hasan', role: 'Software Engineer (Front End)', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: darkMode ? 'bg-cyan-900/10' : 'bg-cyan-50', desc: 'Frontend development, interactive map design, React component architecture, and visual design system.' },
                    { name: 'Mahmud Refey', role: 'Statistician', color: 'text-purple-400', border: 'border-purple-500/30', bg: darkMode ? 'bg-purple-900/10' : 'bg-purple-50', desc: 'Statistical analysis, ML model evaluation, data preprocessing and scientific validation.' },
                    { name: 'Abdullah Al Mamun', role: 'Software Developer (Backend)', color: 'text-blue-400', border: 'border-blue-500/30', bg: darkMode ? 'bg-blue-900/10' : 'bg-blue-50', desc: 'Overall system design includes ML pipeline architecture, PID integration, backend engineering, and project strategy.' },
                  ].map(({ name, role, color, border, bg, desc }) => (
                    <div key={name} className={`rounded-xl p-5 border ${border} ${bg}`}>
                      <div className={`font-bold text-base ${color}`}>{name}</div>
                      <div className={`text-xs font-semibold mb-2 mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{role}</div>
                      <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Sources */}
              <div className={`rounded-2xl p-6 border ${darkMode ? 'glass-panel border-slate-700/40' : 'bg-[#faf7f0] border-[#d4cbb8] shadow-sm'}`}>
                <h3 className={`text-base font-bold mb-4 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Data Sources</h3>
                <div className="flex flex-wrap gap-2">
                  {['ITU DataHub (154 indicators)', 'BTRC Division Subscriber Data', 'Bangladesh Bureau of Statistics (HIES 2022)', 'NTTN Fiber Backbone Capacity', 'BTS Tower Registry', 'World Bank Bangladesh', 'TBS News', 'The Daily Star', 'bdnews24'].map(s => (
                    <span key={s} className={`text-xs px-3 py-1 rounded-full border ${darkMode ? 'border-slate-700 bg-slate-800/50 text-slate-400' : 'border-[#d4cbb8] bg-[#f0ebe0] text-slate-600'}`}>{s}</span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
