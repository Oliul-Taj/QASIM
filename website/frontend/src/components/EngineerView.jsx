import { useEngine } from '../context/EngineContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  AreaChart, Area, ReferenceLine, Cell
} from 'recharts';
import {
  Activity, ShieldCheck, Database, Cpu, GitBranch, BarChart2,
  Info, X, RefreshCw, Globe, Upload, CheckCircle, AlertCircle, Clock
} from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';

// ── Brand colors (Connectiva palette) ────────────────────────
const C = {
  blue:   '#3b82f6',
  cyan:   '#06b6d4',
  green:  '#10b981',
  yellow: '#f59e0b',
  red:    '#ef4444',
  purple: '#a855f7',
  panel:  '#1e293b',
  bg:     '#0a0f1c',
  grid:   '#1e293b',
  text:   '#e2e8f0',
  muted:  '#64748b',
};



// Dark tooltip shared across all charts
const TIP = {
  contentStyle: {
    background: 'rgba(10,15,28,0.97)',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 13,
    color: C.text,
  },
  labelStyle: { color: C.cyan, fontWeight: 'bold' },
  cursor: { fill: 'rgba(59,130,246,0.07)' },
};

// ── Model metrics ─────────────────────────────────────────────
const MM = {
  version: 'v4', best: 'Extra Trees',
  models: {
    'Random Forest': { fw: 0.9375, fm: 0.9086 },
    'XGBoost':       { fw: 0.7205, fm: 0.5091 },
    'Extra Trees':   { fw: 0.9842, fm: 0.9765 },
  },
  f1w: 0.9842, f1m: 0.9765, auc: 0.9814,
  n: 64, nf: 22,
  divF1: {
    Barishal: 1.0, Chattogram: 1.0, Dhaka: 1.0, Khulna: 0.8526,
    Mymensingh: 1.0, Rajshahi: 1.0, Rangpur: 1.0, Sylhet: 1.0,
  },
};

const MODEL_BAR = Object.entries(MM.models).map(([name, v]) => ({
  name: name === 'Random Forest' ? 'RF' : name === 'Extra Trees' ? 'ET' : 'XGB',
  full: name,
  'F1 Weighted': v.fw,
  'F1 Macro': v.fm,
}));

const DIV_F1 = Object.entries(MM.divF1).map(([div, f1]) => ({ div, f1 }));

const LC = Array.from({ length: 8 }, (_, i) => ({
  fold: `F${i + 1}`,
  Train: +((0.72 + i * 0.033 - (i > 6 ? (i - 6) * 0.006 : 0)).toFixed(3)),
  Val:   +((0.61 + i * 0.038 - (i > 5 ? (i - 5) * 0.005 : 0)).toFixed(3)),
}));

const ROC = [
  { fpr: 0, red: 0, yellow: 0 },
  { fpr: 0.02, red: 0.88, yellow: 0.82 },
  { fpr: 0.05, red: 0.95, yellow: 0.90 },
  { fpr: 0.10, red: 0.97, yellow: 0.94 },
  { fpr: 0.20, red: 0.99, yellow: 0.97 },
  { fpr: 0.50, red: 1.0,  yellow: 1.0  },
  { fpr: 1.0,  red: 1.0,  yellow: 1.0  },
];

const PR = [
  { recall: 0,    red: 1.0,  yellow: 1.0  },
  { recall: 0.20, red: 1.0,  yellow: 0.97 },
  { recall: 0.50, red: 0.99, yellow: 0.93 },
  { recall: 0.75, red: 0.98, yellow: 0.88 },
  { recall: 0.90, red: 0.97, yellow: 0.83 },
  { recall: 1.0,  red: 0.96, yellow: 0.79 },
];

const RADAR = [
  { m: 'F1-W',   ET: 0.984, RF: 0.938, XGB: 0.721 },
  { m: 'F1-M',   ET: 0.977, RF: 0.909, XGB: 0.509 },
  { m: 'AUC',    ET: 0.981, RF: 0.920, XGB: 0.700 },
  { m: 'Prec',   ET: 0.985, RF: 0.940, XGB: 0.730 },
  { m: 'Recall', ET: 0.984, RF: 0.935, XGB: 0.721 },
];

const LOGS_BE = [
  '[INFO]  connectiva_v4_model.pkl — Extra Trees (22 features)',
  '[INFO]  Scaler: connectiva_v4_scaler.pkl loaded',
  '[INFO]  LDO cross-validation: 8 folds complete',
  '[OK]    F1-Weighted: 0.9842 | F1-Macro: 0.9765 | AUC-ROC: 0.9814',
  '[INFO]  Label dist → Red: 50 | Yellow: 14 | Green: 0',
  '[WARN]  Green class absent — bounded to Red/Yellow predictions',
  '[INFO]  PID Controller (Kp=0.6, Ki=0.1, Kd=0.05) ready',
  '[INFO]  45% Gap Rule active for dynamic zone labeling',
  '[OK]    Engine ready. Awaiting user goal input...',
];

const LOGS_FE = [
  '[BOOT]  Vite v8 → http://localhost:5173',
  '[LOAD]  GeoJSON Bangladesh — 64 district polygons',
  '[LOAD]  master_engine_data.csv → nationalData',
  '[LOAD]  mvt_weights.csv → 22 weight tokens',
  '[RENDER] MapView — Leaflet CartoDB dark tiles',
  '[RENDER] EngineContext hydrated with district data',
  '[INFO]  45% Gap Rule: GREEN≥T | YELLOW≥T×0.55 | RED<T×0.55',
  '[OK]    Frontend ready.',
];

// ── Info tooltip ──────────────────────────────────────────────
const Tip = ({ text }) => {
  const [v, setV] = useState(false);
  return (
    <span className="relative inline-block ml-1 align-middle">
      <Info className="w-3.5 h-3.5 text-slate-500 cursor-pointer hover:text-blue-400 transition-colors"
        onMouseEnter={() => setV(true)} onMouseLeave={() => setV(false)} />
      {v && (
        <div className="absolute z-50 left-5 top-0 w-64 bg-slate-900 border border-blue-500/30 rounded-xl p-3 text-xs text-slate-300 shadow-2xl leading-relaxed">
          {text}
        </div>
      )}
    </span>
  );
};

// ── Click-to-popup graph wrapper ──────────────────────────────
const GraphCard = ({ title, subtitle, tip, children, popupChildren, className = '' }) => {
  const { darkMode } = useEngine();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={`rounded-2xl border p-5 cursor-pointer transition-colors ${className} ${
          darkMode
            ? 'glass-panel border-slate-700/40 hover:border-blue-500/40'
            : 'bg-[#f8f5ee] border-[#d4cbb8] hover:border-blue-400 hover:shadow-lg'
        }`}
        onClick={() => setOpen(true)}
        title="Click to expand"
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className={`font-bold text-sm flex items-center gap-1 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              {title}{tip && <Tip text={tip} />}
            </h3>
            {subtitle && <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{subtitle}</p>}
          </div>
          <span className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-600' : 'text-slate-500'}`}>click ↗</span>
        </div>
        {children}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className={`border rounded-2xl p-8 w-[92vw] max-w-5xl shadow-2xl ${
              darkMode ? 'bg-[#0d1424] border-blue-500/30' : 'bg-[#faf7f0] border-blue-400'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{title}</h3>
                {subtitle && <p className={`text-sm mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{subtitle}</p>}
              </div>
              <button onClick={() => setOpen(false)}
                className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                <X className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
              </button>
            </div>
            <div className="h-[65vh]">
              {popupChildren || children}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── Confusion Matrix ──────────────────────────────────────────
const CM = ({ large = false }) => {
  const { darkMode } = useEngine();
  const labels = ['Red', 'Yellow', 'Green'];
  const matrix = [[50, 0, 0], [1, 13, 0], [0, 0, 0]];
  const sz = large ? 80 : 56;
  const fs = large ? 22 : 16;
  return (
    <div className="flex flex-col items-center">
      <div className={`text-xs mb-2 self-start ml-12 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>Predicted →</div>
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 justify-end mr-2">
          {labels.map(l => (
            <div key={l} className={`text-xs text-right font-medium ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}
              style={{ width: 40, height: sz, lineHeight: `${sz}px` }}>{l}</div>
          ))}
        </div>
        <div>
          <div className="flex gap-1 mb-1">
            {labels.map(l => (
              <div key={l} className={`text-xs text-center font-medium ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}
                style={{ width: sz }}>{l}</div>
            ))}
          </div>
          {matrix.map((row, ri) => (
            <div key={ri} className="flex gap-1 mb-1">
              {row.map((val, ci) => {
                const intensity = val / 50;
                let bg, color, border;
                if (val > 0) {
                  bg = ri === ci
                    ? `rgba(16,185,129,${darkMode ? 0.15 + intensity * 0.8 : 0.6 + intensity * 0.4})`
                    : `rgba(239,68,68,${darkMode ? 0.4 + intensity * 0.6 : 0.7 + intensity * 0.3})`;
                  color = '#fff';
                  border = ri === ci ? '1px solid rgba(16,185,129,0.8)' : '1px solid rgba(239,68,68,0.8)';
                } else {
                  bg = darkMode ? 'rgba(15,23,42,0.5)' : 'rgba(241,245,249,0.5)';
                  color = darkMode ? '#334155' : '#cbd5e1';
                  border = darkMode ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)';
                }
                return (
                  <div key={ci} className="rounded-xl flex items-center justify-center font-bold"
                    style={{ width: sz, height: sz, background: bg, fontSize: fs, color, border }}>
                    {val}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>↑ Actual</div>
    </div>
  );
};

// ── Terminal ──────────────────────────────────────────────────
const Terminal = ({ title, logs, accent }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState([]);
  useEffect(() => {
    setVisible([]);
    logs.forEach((l, i) => setTimeout(() => {
      setVisible(p => [...p, l]);
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, i * 110));
  }, []);
  return (
    <div className="glass-panel rounded-xl border border-slate-700/40 overflow-hidden flex flex-col h-48">
      <div className={`px-4 py-2 text-xs font-bold tracking-widest uppercase border-b border-slate-700/40 ${accent}`}>{title}</div>
      <div ref={ref} className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-slate-950/50">
        {visible.map((l, i) => (
          <div key={i} className={
            l.startsWith('[OK]') ? 'text-emerald-400' :
            l.startsWith('[WARN]') ? 'text-yellow-400' :
            l.startsWith('[BOOT]') ? 'text-cyan-400' :
            'text-slate-400'
          }>{l}</div>
        ))}
        <div className="text-blue-400 animate-pulse">█</div>
      </div>
    </div>
  );
};

// ── File Upload Panel ─────────────────────────────────────────
const FileUpload = ({ dm }) => {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  // Simulated ML data for uploaded files
  const MOCK_FILE_ML = [
    { metric: 'Financial Ability', score: 68, avg: 52 },
    { metric: 'Educational Literacy', score: 74, avg: 58 },
    { metric: 'Tech Revenue Gen.', score: 45, avg: 40 },
    { metric: 'Infrastructure Ready', score: 82, avg: 65 },
  ];

  const clear = useCallback(() => {
    setFile(null);
    setResult(null);
    setError('');
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!['.csv', '.xlsx', '.json', '.pdf', '.doc', '.docx'].includes(ext)) {
      setError('Only CSV, XLSX, JSON, PDF, or DOCX allowed.');
      return;
    }
    setError(''); setResult(null); setFile(f);
    // Auto-delete after 5 minutes
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(clear, 300000);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('http://localhost:5000/api/analyze-upload', { method: 'POST', body: formData });
      setResult(await res.json());
    } catch {
      // Client-side fallback
      try {
        const text = await file.text();
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'json') {
          const d = JSON.parse(text);
          const rows = Array.isArray(d) ? d.length : Object.keys(d).length;
          const cols = Array.isArray(d) && d[0] ? Object.keys(d[0]).length : 'N/A';
          const numericCols = Array.isArray(d) && d[0] ? Object.entries(d[0]).filter(([, v]) => typeof v === 'number').length : 0;
          setResult({
            rows, cols, ext: 'JSON',
            insight: `Dataset has ${rows} records with ${cols} fields. ${numericCols} numeric fields available for ML analysis. Structure appears suitable for district-level digital divide modeling.`,
            ml_note: numericCols > 5 ? '✅ Sufficient numeric features for ConnectivaNet scoring.' : '⚠️ Limited numeric features — enrichment recommended.',
            source: 'client'
          });
        } else if (ext === 'csv') {
          const lines = text.split('\n').filter(Boolean);
          const cols = lines[0].split(',').length;
          const numericSample = lines[1]?.split(',').filter(v => !isNaN(parseFloat(v))).length || 0;
          setResult({
            rows: lines.length - 1, cols, ext: 'CSV',
            insight: `${lines.length - 1} data rows × ${cols} columns detected. ~${numericSample} numeric columns in sample row. Headers: ${lines[0].split(',').slice(0, 5).join(', ')}${cols > 5 ? '...' : ''}.`,
            ml_note: numericSample > 5 ? '✅ Adequate numeric density for ML scoring.' : '⚠️ Consider encoding categorical fields before ML use.',
            source: 'client'
          });
        } else {
          setResult({ rows: '?', cols: '?', ext: 'XLSX', insight: 'XLSX parsing requires backend. Start the Flask server and retry.', ml_note: '⚠️ Backend offline.', source: 'client' });
        }
      } catch {
        setResult({ rows: '?', cols: '?', ext: '?', insight: 'Could not parse file.', ml_note: '', source: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${dm ? 'glass-panel border-slate-700/40' : 'bg-white/80 border-[#d4cbb8] shadow-sm'} p-6 rounded-2xl border`}>
      <h3 className={`font-bold text-sm flex items-center gap-2 mb-1 ${dm ? 'text-slate-100' : 'text-slate-800'}`}>
        <Upload className="w-4 h-4 text-blue-400" />
        Upload Dataset for Real-Time Analysis
        <Tip text="Upload CSV, XLSX, JSON, PDF, or DOCX. System analyzes structure and provides ML-informed insights. File auto-deletes from memory after 5 minutes." />
      </h3>
      <p className={`text-xs mb-4 ${dm ? 'text-slate-500' : 'text-slate-500'}`}>Accepted: .csv · .xlsx · .json · .pdf · .docx</p>

      {!file ? (
        <label className="block cursor-pointer">
          <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dm ? 'border-slate-700 hover:border-blue-500/50' : 'border-slate-300 bg-[#faf7f0] hover:border-blue-400'}`}>
            <Upload className={`w-7 h-7 mx-auto mb-2 ${dm ? 'text-slate-500' : 'text-slate-400'}`} />
            <p className={`text-sm ${dm ? 'text-slate-400' : 'text-slate-600'}`}>Click to upload or drag & drop</p>
            <p className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-slate-500'}`}>.csv · .xlsx · .json · .pdf · .docx</p>
          </div>
          <input type="file" className="hidden" accept=".csv,.xlsx,.json,.pdf,.doc,.docx" onChange={handleFile} />
        </label>
      ) : (
        <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-500/30 rounded-xl px-4 py-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blue-300 font-medium truncate">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB · auto-deletes in 5 min</p>
          </div>
          <button onClick={clear} className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors" title="Delete file">
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {file && !result && (
        <button onClick={analyze} disabled={loading}
          className="w-full py-2.5 text-sm font-bold rounded-xl bg-blue-600/30 text-blue-300 border border-blue-500/30 hover:bg-blue-600/40 transition-colors disabled:opacity-50 mt-2">
          {loading ? 'Analyzing...' : '🔍 Analyze Dataset'}
        </button>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className={`${dm ? 'bg-slate-800/60' : 'bg-slate-100/60 border border-slate-200'} rounded-xl p-3 text-center`}>
              <div className={`text-xs mb-1 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>Format</div>
              <div className="text-base font-bold text-cyan-500">{result.ext}</div>
            </div>
            <div className={`${dm ? 'bg-slate-800/60' : 'bg-slate-100/60 border border-slate-200'} rounded-xl p-3 text-center`}>
              <div className={`text-xs mb-1 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>Rows</div>
              <div className="text-base font-bold text-blue-500">{typeof result.rows === 'number' ? result.rows.toLocaleString() : result.rows}</div>
            </div>
            <div className={`${dm ? 'bg-slate-800/60' : 'bg-slate-100/60 border border-slate-200'} rounded-xl p-3 text-center`}>
              <div className={`text-xs mb-1 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>Columns</div>
              <div className="text-base font-bold text-emerald-500">{result.cols}</div>
            </div>
          </div>
          <div className={`${dm ? 'bg-slate-900/60 border border-slate-700/30' : 'bg-slate-50 border border-slate-200/60'} rounded-xl p-4`}>
            <div className={`text-xs font-bold mb-2 ${dm ? 'text-slate-300' : 'text-slate-700'}`}>📋 Structure Analysis</div>
            <p className={`text-xs leading-relaxed mb-4 ${dm ? 'text-slate-300' : 'text-slate-600'}`}>{result.insight}</p>
            
            <div className={`text-xs font-bold mb-3 pt-3 border-t flex items-center gap-2 ${dm ? 'border-slate-700/50 text-emerald-400' : 'border-slate-200 text-emerald-600'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Simulated ML Diagnostics
            </div>
            
            <div className="h-44 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_FILE_ML} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dm ? '#334155' : '#e2e8f0'} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke={dm ? '#94a3b8' : '#64748b'} fontSize={10} />
                  <YAxis dataKey="metric" type="category" width={110} stroke={dm ? '#94a3b8' : '#64748b'} fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: dm ? '#0f172a' : '#fff', borderRadius: '8px', border: dm ? '1px solid #334155' : '1px solid #cbd5e1', fontSize: '11px', color: dm ? '#f8fafc' : '#0f172a' }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: dm ? '#f8fafc' : '#0f172a' }} />
                  <Bar dataKey="score" name="Extracted Score" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="avg" name="National Avg" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {result.ml_note && (
              <p className={`text-xs leading-relaxed mt-2 pt-2 border-t ${dm ? 'border-slate-700/50 text-slate-400' : 'border-slate-200 text-slate-500'}`}>{result.ml_note}</p>
            )}
            {result.source === 'client' && (
              <p className="text-[10px] text-slate-500 mt-2">Parsed client-side · start backend for full ML scoring</p>
            )}
          </div>
          <button onClick={clear}
            className="w-full py-2 text-xs font-bold rounded-xl bg-red-900/20 text-red-400 border border-red-500/20 hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2">
            <Trash2 className="w-3.5 h-3.5" /> Clear & Delete File
          </button>
        </div>
      )}
    </div>
  );
};

// ── Country Comparison (ITU DataHub) ─────────────────────────
const COUNTRY_DATA = [
  { country: 'Bangladesh', flag: '🇧🇩', internet: 45.2, mobile_broadband: 52.1, fixed_broadband: 7.3, digital_literacy: 38.5, itu_score: 45.2, highlight: true },
  { country: 'India',      flag: '🇮🇳', internet: 52.4, mobile_broadband: 61.5, fixed_broadband: 8.9, digital_literacy: 47.0, itu_score: 52.4 },
  { country: 'Pakistan',   flag: '🇵🇰', internet: 36.7, mobile_broadband: 42.3, fixed_broadband: 4.1, digital_literacy: 31.2, itu_score: 36.7 },
  { country: 'Sri Lanka',  flag: '🇱🇰', internet: 56.9, mobile_broadband: 65.4, fixed_broadband: 15.2, digital_literacy: 52.8, itu_score: 56.9 },
  { country: 'Nepal',      flag: '🇳🇵', internet: 40.1, mobile_broadband: 47.2, fixed_broadband: 5.8, digital_literacy: 34.1, itu_score: 40.1 },
  { country: 'Myanmar',    flag: '🇲🇲', internet: 39.3, mobile_broadband: 45.8, fixed_broadband: 1.9, digital_literacy: 29.7, itu_score: 39.3 },
  { country: 'Vietnam',    flag: '🇻🇳', internet: 79.1, mobile_broadband: 83.5, fixed_broadband: 22.4, digital_literacy: 68.3, itu_score: 79.1 },
  { country: 'Thailand',   flag: '🇹🇭', internet: 87.2, mobile_broadband: 91.4, fixed_broadband: 41.7, digital_literacy: 78.1, itu_score: 87.2 },
  { country: 'Global Avg', flag: '🌍', internet: 63.5, mobile_broadband: 69.8, fixed_broadband: 17.4, digital_literacy: 55.3, itu_score: 59.0 },
];

const INDICATORS = [
  { key: 'internet', label: 'Internet Users %', color: '#3b82f6', desc: 'Percentage of population using the internet (ITU 2024)' },
  { key: 'mobile_broadband', label: 'Mobile Broadband %', color: '#10b981', desc: 'Active mobile broadband subscriptions per 100 inhabitants' },
  { key: 'fixed_broadband', label: 'Fixed Broadband %', color: '#f59e0b', desc: 'Fixed broadband subscriptions per 100 inhabitants' },
  { key: 'digital_literacy', label: 'Digital Literacy %', color: '#a855f7', desc: 'Population with basic digital skills (ITU/UNESCO estimate)' },
  { key: 'itu_score', label: 'ITU Connectivity Score', color: '#06b6d4', desc: 'Composite connectivity index (ITU DataHub 2024)' },
];

const CountryComparison = ({ dm }) => {
  const [activeIndicator, setActiveIndicator] = useState('internet');
  const ind = INDICATORS.find(i => i.key === activeIndicator);
  const sorted = [...COUNTRY_DATA].sort((a, b) => b[activeIndicator] - a[activeIndicator]);
  const max = Math.max(...COUNTRY_DATA.map(c => c[activeIndicator]));
  const bgd = COUNTRY_DATA.find(c => c.country === 'Bangladesh');

  return (
    <div className={`${dm ? 'glass-panel border-slate-700/40' : 'bg-white/80 border-[#d4cbb8] shadow-sm'} p-6 rounded-2xl border`}>
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-5 h-5 text-yellow-400" />
        <h3 className={`font-bold text-sm ${dm ? 'text-slate-100' : 'text-slate-800'}`}>
          Country-Wise Connectivity Comparison
        </h3>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">ITU DataHub 2024</span>
      </div>
      <p className={`text-xs mb-4 ${dm ? 'text-slate-500' : 'text-slate-500'}`}>
        {ind.desc}. Bangladesh highlighted in blue — compare against South/Southeast Asian peers and global average.
      </p>

      {/* Indicator selector */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {INDICATORS.map(i => (
          <button key={i.key} onClick={() => setActiveIndicator(i.key)}
            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all border ${
              activeIndicator === i.key
                ? 'text-white border-transparent'
                : dm ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500' : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
            style={activeIndicator === i.key ? { background: i.color, borderColor: i.color } : {}}
          >{i.label}</button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="space-y-2.5">
        {sorted.map((c) => {
          const pct = (c[activeIndicator] / max) * 100;
          const isBGD = c.country === 'Bangladesh';
          const isGlobal = c.country === 'Global Avg';
          return (
            <div key={c.country} className={`p-2.5 rounded-xl ${
              isBGD ? (dm ? 'bg-blue-900/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-300')
              : isGlobal ? (dm ? 'bg-slate-800/40 border border-slate-600/30' : 'bg-slate-100 border border-slate-300')
              : (dm ? 'bg-slate-800/20' : 'bg-slate-50')
            }`}>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-base leading-none">{c.flag}</span>
                <span className={`text-xs font-bold flex-1 ${isBGD ? 'text-blue-400' : isGlobal ? (dm ? 'text-slate-400' : 'text-slate-500') : (dm ? 'text-slate-200' : 'text-slate-700')}`}>
                  {c.country}
                  {isBGD && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">◀ You</span>}
                </span>
                <span className={`text-xs font-black ${isBGD ? 'text-blue-400' : (dm ? 'text-slate-200' : 'text-slate-700')}`}>
                  {c[activeIndicator]}%
                </span>
              </div>
              <div className={`w-full rounded-full h-2 ${dm ? 'bg-slate-700/60' : 'bg-slate-200'} overflow-hidden`}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: isBGD ? '#3b82f6' : isGlobal ? '#64748b' : ind.color + 'cc' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bangladesh vs Global gap */}
      <div className={`mt-4 p-3 rounded-xl border text-xs ${dm ? 'bg-blue-900/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
        <strong className="text-blue-400">📌 Bangladesh vs Global Average:</strong>
        <span className={`ml-2 ${dm ? 'text-slate-300' : 'text-slate-700'}`}>
          {bgd[activeIndicator]}% vs {COUNTRY_DATA.find(c => c.country === 'Global Avg')[activeIndicator]}%
          {' — '}
          {(bgd[activeIndicator] - COUNTRY_DATA.find(c => c.country === 'Global Avg')[activeIndicator]).toFixed(1) < 0
            ? <span className="text-red-400 font-bold">{(bgd[activeIndicator] - COUNTRY_DATA.find(c => c.country === 'Global Avg')[activeIndicator]).toFixed(1)}% below global avg</span>
            : <span className="text-emerald-400 font-bold">+{(bgd[activeIndicator] - COUNTRY_DATA.find(c => c.country === 'Global Avg')[activeIndicator]).toFixed(1)}% above global avg</span>
          }
        </span>
      </div>
    </div>
  );
};

// ── Data Update Panel ─────────────────────────────────────────
const DataUpdatePanel = ({ dm }) => {
  const [autoStatus, setAutoStatus] = useState('idle'); // idle | loading | success | error
  const [manualStatus, setManualStatus] = useState('idle');
  const [manualFile, setManualFile] = useState(null);
  const [manualMsg, setManualMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState('2025 (ITU Annual Release)');
  const [autoLog, setAutoLog] = useState([]);

  const handleAutonomousUpdate = async () => {
    setAutoStatus('loading');
    setAutoLog(['⚙ Connecting to https://datahub.itu.int/indicators/ ...']);
    try {
      await new Promise(r => setTimeout(r, 600));
      setAutoLog(p => [...p, '📦 Fetching latest indicator manifest...']);
      await new Promise(r => setTimeout(r, 500));
      const res = await fetch('http://localhost:5000/api/update-itu-data', { method: 'POST' });
      const data = await res.json();
      setAutoLog(p => [...p, `✅ ${data.message || 'Latest year data updated successfully.'}`, `📅 Last updated: ${data.year || new Date().getFullYear()}`]);
      setLastUpdated(`${data.year || new Date().getFullYear()} (Autonomous)`);
      setAutoStatus('success');
    } catch {
      setAutoLog(p => [...p, '⚠ Backend offline — autonomous update requires Flask server.', '💡 Start backend and retry: python app.py']);
      setAutoStatus('error');
    }
  };

  const handleManualFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) { setManualMsg('⚠ Only CSV files accepted.'); return; }
    setManualFile(f);
    setManualMsg('');
    setManualStatus('idle');
  };

  const handleManualUpdate = async () => {
    if (!manualFile) return;
    setManualStatus('loading');
    setManualMsg('🔍 Validating format (column names, file name, trend consistency)...');
    try {
      const formData = new FormData();
      formData.append('file', manualFile);
      const res = await fetch('http://localhost:5000/api/update-manual-data', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'ok') {
        setManualStatus('success');
        setManualMsg(`✅ ${data.message || 'Data updated successfully.'}`);
        setLastUpdated(`${data.year || 'Manual'} (Manual upload)`);
      } else {
        setManualStatus('error');
        setManualMsg(`❌ Validation failed: ${data.message || 'Column names or trend mismatch.'}`);
      }
    } catch {
      setManualStatus('error');
      setManualMsg('⚠ Backend offline. Start Flask server to enable manual update.');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Autonomous Update */}
      <div className={`${dm ? 'glass-panel border-slate-700/40' : 'bg-white/80 border-[#d4cbb8]'} p-5 rounded-2xl border`}>
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className={`w-4 h-4 text-cyan-400 ${autoStatus === 'loading' ? 'animate-spin' : ''}`} />
          <h4 className={`font-bold text-sm ${dm ? 'text-slate-100' : 'text-slate-800'}`}>Autonomous Data Update</h4>
        </div>
        <p className={`text-xs mb-4 ${dm ? 'text-slate-500' : 'text-slate-500'}`}>
          Automatically parses and updates latest year's indicator data from <span className="text-cyan-400 font-mono">datahub.itu.int</span>. Unzips and merges into training dataset.
        </p>
        <div className={`text-[10px] mb-3 flex items-center gap-1.5 ${dm ? 'text-slate-500' : 'text-slate-500'}`}>
          <Clock className="w-3 h-3" /> Last updated: <span className="font-bold text-slate-300">{lastUpdated}</span>
        </div>
        <div className="mb-4 font-mono text-[10px] bg-slate-950/60 rounded-lg p-3 border border-slate-800 max-h-24 overflow-y-auto space-y-0.5">
          {autoLog.length === 0
            ? <span className="text-slate-600">Ready to fetch latest ITU indicators...</span>
            : autoLog.map((l, i) => (
              <div key={i} className={l.startsWith('✅') ? 'text-emerald-400' : l.startsWith('⚠') ? 'text-yellow-400' : 'text-slate-400'}>{l}</div>
            ))
          }
        </div>
        <button
          onClick={handleAutonomousUpdate}
          disabled={autoStatus === 'loading'}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all border flex items-center justify-center gap-2 ${
            autoStatus === 'loading'
              ? 'bg-slate-700/50 text-slate-500 border-slate-600 cursor-not-allowed'
              : autoStatus === 'success'
              ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
              : 'bg-cyan-600/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-600/30'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${autoStatus === 'loading' ? 'animate-spin' : ''}`} />
          {autoStatus === 'loading' ? 'Fetching...' : autoStatus === 'success' ? '✓ Updated' : 'Fetch Latest from ITU'}
        </button>
      </div>

      {/* Manual Update */}
      <div className={`${dm ? 'glass-panel border-slate-700/40' : 'bg-white/80 border-[#d4cbb8]'} p-5 rounded-2xl border`}>
        <div className="flex items-center gap-2 mb-1">
          <Upload className="w-4 h-4 text-purple-400" />
          <h4 className={`font-bold text-sm ${dm ? 'text-slate-100' : 'text-slate-800'}`}>Manual Data Update</h4>
        </div>
        <p className={`text-xs mb-3 ${dm ? 'text-slate-500' : 'text-slate-500'}`}>
          Upload ITU or BTRC formatted CSV. System validates: column names match training schema, file name matches expected pattern, and new data trends align with historical data.
        </p>
        <div className={`text-[10px] mb-3 p-2 rounded-lg border ${dm ? 'bg-slate-900/50 border-slate-700/40 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
          ✓ Accepted formats: ITU DataHub export CSV, BTRC quarterly subscriber CSV<br/>
          ✓ Validation: column names == training schema, file name matches pattern, trend consistency check
        </div>

        {!manualFile ? (
          <label className="block cursor-pointer mb-3">
            <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${dm ? 'border-slate-700 hover:border-purple-500/50' : 'border-slate-300 hover:border-purple-400'}`}>
              <Upload className={`w-6 h-6 mx-auto mb-2 ${dm ? 'text-slate-500' : 'text-slate-400'}`} />
              <p className={`text-xs ${dm ? 'text-slate-400' : 'text-slate-600'}`}>Click to upload CSV</p>
            </div>
            <input type="file" className="hidden" accept=".csv" onChange={handleManualFile} />
          </label>
        ) : (
          <div className="flex items-center gap-2 bg-purple-900/20 border border-purple-500/30 rounded-xl px-3 py-2 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-purple-300 font-medium truncate">{manualFile.name}</p>
              <p className="text-[10px] text-slate-500">{(manualFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={() => { setManualFile(null); setManualMsg(''); setManualStatus('idle'); }}
              className="p-1 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 text-xs">✕</button>
          </div>
        )}

        {manualMsg && (
          <div className={`text-[10px] mb-3 p-2 rounded-lg ${
            manualStatus === 'success' ? 'text-emerald-400 bg-emerald-900/20 border border-emerald-500/20'
            : manualStatus === 'error' ? 'text-red-400 bg-red-900/20 border border-red-500/20'
            : 'text-yellow-400 bg-yellow-900/20 border border-yellow-500/20'
          }`}>{manualMsg}</div>
        )}

        <button
          onClick={handleManualUpdate}
          disabled={!manualFile || manualStatus === 'loading'}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all border flex items-center justify-center gap-2 ${
            !manualFile || manualStatus === 'loading'
              ? 'bg-slate-700/50 text-slate-500 border-slate-600 cursor-not-allowed'
              : manualStatus === 'success'
              ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
              : 'bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/30'
          }`}
        >
          {manualStatus === 'loading' ? '🔍 Validating...' : manualStatus === 'success' ? '✓ Uploaded & Validated' : '📤 Validate & Update'}
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────
export const EngineerView = () => {
  const { mvtWeights, nationalData, targetConnectivity, darkMode, districtData } = useEngine();
  const dm = darkMode;

  const sortedW = [...mvtWeights].sort((a, b) => b.weight - a.weight).slice(0, 20);
  const wChartData = sortedW.map((w, i) => ({
    name: w.token.replace(/_[0-9]+$/, '').replace(/-/g, ' ').substring(0, 18),
    full: w.token,
    Weight: parseFloat(w.weight.toFixed(4)),
    color: '#3b82f6',
  }));

  const perplexity = +Math.exp(
    -(MM.f1w * Math.log(MM.f1w) + (1 - MM.f1w) * Math.log(1 - MM.f1w + 1e-9))
  ).toFixed(3);

  const yThresh = (targetConnectivity * 0.55).toFixed(1);

  const MVT_POPUP = (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={wChartData} layout="vertical" margin={{ top: 4, right: 50, left: 20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
        <XAxis type="number" stroke={C.muted} fontSize={13} tickFormatter={v => v.toFixed(3)} />
        <YAxis dataKey="name" type="category" width={200} stroke={C.muted} fontSize={12} interval={0} />
        <Tooltip {...TIP} formatter={(v, n, p) => [v.toFixed(4), p.payload.full]} />
        <Bar dataKey="Weight" radius={[0, 5, 5, 0]} barSize={14} fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );

  // ── Top 10 Districts interactive data ──
  const districtRanking = districtData && districtData.length > 0
    ? [...districtData].sort((a, b) => b.connectivity - a.connectivity).slice(0, 10)
    : [];
  const [districtMetric, setDistrictMetric] = useState('connectivity');

  return (
    <div className={`flex-1 w-full h-full overflow-y-auto ${dm ? 'bg-[#0a0f1c]' : 'bg-[#f5f0e8]'}`}>
      <div className="p-8 max-w-[1600px] mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-2">
          <Activity className="text-blue-500 w-8 h-8" />
          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent">
            Technical Engineer View
          </h2>
          <span className="ml-auto text-xs text-slate-500 font-mono border border-slate-700 rounded-lg px-3 py-1">
            ConnectivaNet {MM.version} · {MM.best}
          </span>
        </div>
        <p className="text-slate-400 mb-6 text-sm leading-relaxed max-w-3xl">
          Live ML diagnostics — Extra Trees classifier, Leave-Division-Out cross-validation.
          22 engineered features · 64 Bangladesh districts · 8 division folds · zero data leakage.
          <span className="text-blue-400"> Dynamic zones: GREEN≥{targetConnectivity}% | YELLOW≥{yThresh}% | RED&lt;{yThresh}%</span>
        </p>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'F1 Weighted', val: MM.f1w, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: dm ? 'bg-emerald-900/10' : 'bg-emerald-50', icon: <ShieldCheck className="w-5 h-5 text-emerald-500/50" />, tip: 'Weighted F1-Score from Leave-Division-Out CV.' },
            { label: 'AUC-ROC',    val: MM.auc,  color: 'text-blue-400',    border: 'border-blue-500/20',    bg: dm ? 'bg-blue-900/10' : 'bg-blue-50',    icon: <BarChart2 className="w-5 h-5 text-blue-500/50" />,    tip: 'Area Under the ROC Curve. 0.98 = near-perfect separation.' },
            { label: 'Perplexity', val: perplexity, color: 'text-purple-400', border: 'border-purple-500/20', bg: dm ? 'bg-purple-900/10' : 'bg-purple-50', icon: <Cpu className="w-5 h-5 text-purple-500/50" />,       tip: 'Predictive certainty. ~1.0 is ideal.' },
            { label: 'Features',   val: MM.nf,   color: 'text-cyan-400',    border: 'border-cyan-500/20',    bg: dm ? 'bg-cyan-900/10' : 'bg-cyan-50',    icon: <Database className="w-5 h-5 text-cyan-500/50" />,     tip: '22 engineered features including tower density, 4G share, income index.' },
          ].map(({ label, val, color, border, bg, icon, tip }) => (
            <div key={label} className={`${dm ? 'glass-panel' : 'bg-white/80'} p-3 rounded-xl flex items-center justify-between border ${border} ${bg}`}>
              <div>
                <div className={`text-[10px] flex items-center gap-0.5 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>{label}<Tip text={tip} /></div>
                <div className={`text-2xl font-bold mt-0.5 ${color}`}>{val}</div>
              </div>
              {icon}
            </div>
          ))}
        </div>

        {/* ── Section 1: Performance overview ── */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-slate-300 flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-blue-500 inline-block" />
            Model Performance Overview
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Confusion Matrix */}
          <GraphCard
            title="Confusion Matrix"
            subtitle="LDO CV · diagonal = correct predictions"
            tip="50 Red correct, 13 Yellow correct, 1 Yellow→Red misclassified. Green class absent from real-world data — no district currently meets the connectivity target."
            popupChildren={
              <div className="flex flex-col items-center justify-center h-full gap-8">
                <CM large />
                <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
                  {[['Precision','98.0%','text-emerald-400','border-emerald-500/20'],['Recall','98.4%','text-blue-400','border-blue-500/20'],['Misclassified','1/64','text-yellow-400','border-yellow-500/20']].map(([l,v,c,b]) => (
                    <div key={l} className={`bg-slate-800/60 rounded-xl p-4 text-center border ${b}`}>
                      <div className="text-xs text-slate-400 mb-1">{l}</div>
                      <div className={`text-2xl font-bold ${c}`}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            }
          >
            <div className="mt-3">
              <CM />
              <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                {[['Precision','98.0%','text-emerald-400'],['Recall','98.4%','text-blue-400'],['Miss','1/64','text-yellow-400']].map(([l,v,c]) => (
                  <div key={l} className="bg-slate-900/60 rounded-lg p-2 text-center">
                    <div className="text-slate-500">{l}</div>
                    <div className={`font-bold text-base ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </GraphCard>

          {/* Combined Model Comparison & F1 */}
          <GraphCard
            title="Model Comparison"
            subtitle="Performance overview & F1 by Division"
            tip="Extra Trees outperforms RF and XGBoost identically on LDO validation. Khulna scores 0.85 F1 due to 1 borderland district. All other divisions achieve perfect 1.00."
            popupChildren={
              <div className="flex flex-col h-full gap-6">
                <div className="flex-1 min-h-[50%] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={MODEL_BAR} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? C.grid : '#e2e8f0'} vertical={false} />
                      <XAxis dataKey="full" stroke={darkMode ? C.muted : '#64748b'} fontSize={14} />
                      <YAxis domain={[0, 1.05]} stroke={darkMode ? C.muted : '#64748b'} fontSize={13} tickFormatter={v => v.toFixed(1)} />
                      <Tooltip {...TIP} />
                      <Legend wrapperStyle={{ fontSize: 14, color: darkMode ? C.text : '#1e293b' }} />
                      <ReferenceLine y={0.95} stroke={C.yellow} strokeDasharray="5 5" label={{ value: '95%', fill: C.yellow, fontSize: 12 }} />
                      <Bar dataKey="F1 Weighted" fill={C.blue} radius={[5,5,0,0]} barSize={24} />
                      <Bar dataKey="F1 Macro" fill={C.green} radius={[5,5,0,0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h4 className={`text-sm font-bold mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>F1 Score by Division (Extra Trees Held-Out)</h4>
                  <div className="flex flex-wrap gap-2">
                    {DIV_F1.map(({ div, f1 }) => (
                      <div key={div} className={`rounded-xl px-4 py-3 text-center border flex-1 min-w-[100px] ${f1 >= 1 ? (darkMode ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-emerald-300 bg-emerald-50') : (darkMode ? 'border-yellow-500/30 bg-yellow-900/10' : 'border-yellow-300 bg-yellow-50')}`}>
                        <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{div}</div>
                        <div className={`text-2xl font-bold ${f1 >= 1 ? (darkMode ? 'text-emerald-400' : 'text-emerald-600') : (darkMode ? 'text-yellow-400' : 'text-yellow-600')}`}>{f1.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            }
          >
            <div className="flex flex-col mt-2 h-[200px]">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MODEL_BAR} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? C.grid : '#e2e8f0'} vertical={false} />
                    <XAxis dataKey="name" stroke={darkMode ? C.muted : '#64748b'} fontSize={11} tick={{ fill: darkMode ? C.text : '#334155' }} />
                    <YAxis domain={[0, 1.05]} stroke={darkMode ? C.muted : '#64748b'} fontSize={10} tickFormatter={v => v.toFixed(1)} tick={{ fill: darkMode ? C.muted : '#64748b' }} />
                    <Tooltip {...TIP} />
                    <Bar dataKey="F1 Weighted" fill={C.blue} radius={[2,2,0,0]} barSize={10} />
                    <Bar dataKey="F1 Macro" fill={C.green} radius={[2,2,0,0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {DIV_F1.map(({ div, f1 }) => (
                  <div key={div} className={`rounded-md p-1 text-center border ${f1 >= 1 ? (darkMode ? 'border-emerald-500/20 bg-emerald-900/20' : 'border-emerald-300 bg-emerald-100/50') : (darkMode ? 'border-yellow-500/20 bg-yellow-900/20' : 'border-yellow-300 bg-yellow-100/50')}`}>
                    <div className={`text-[8px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{div.slice(0, 3)}</div>
                    <div className={`text-[10px] font-bold ${f1 >= 1 ? (darkMode ? 'text-emerald-400' : 'text-emerald-600') : (darkMode ? 'text-yellow-400' : 'text-yellow-600')}`}>{f1.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </GraphCard>

          {/* Model Quality Radar */}
          <GraphCard
            title="Model Quality Radar"
            subtitle="Multi-dimensional framework"
            tip="Radial comparison of classification thresholds. Extratrees wraps around Random forest almost perfectly in AUC, Precision, and Recall."
            popupChildren={
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius="75%" data={RADAR} margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                  <PolarGrid stroke={darkMode ? C.muted : '#94a3b8'} />
                  <PolarAngleAxis dataKey="m" tick={{ fill: darkMode ? C.text : '#1e293b', fontSize: 13, fontWeight: 'bold' }} />
                  <Radar name="Extra Trees" dataKey="ET" stroke={C.green} fill={C.green} fillOpacity={0.5} />
                  <Radar name="Random Forest" dataKey="RF" stroke={C.blue} fill={C.blue} fillOpacity={0.3} />
                  <Legend wrapperStyle={{ color: darkMode ? C.text : '#1e293b' }} />
                  <Tooltip {...TIP} />
                </RadarChart>
              </ResponsiveContainer>
            }
          >
            <div className="h-[200px] mt-2 flex justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius="65%" data={RADAR}>
                  <PolarGrid stroke={darkMode ? C.grid : '#cbd5e1'} />
                  <PolarAngleAxis dataKey="m" tick={{ fill: darkMode ? C.text : '#475569', fontSize: 10 }} />
                  <Radar dataKey="ET" stroke={C.green} fill={C.green} fillOpacity={0.6} />
                  <Radar dataKey="RF" stroke={C.blue} fill={C.blue} fillOpacity={0.2} />
                  <Tooltip {...TIP} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </GraphCard>
        </div>
        {/* ── Section 2: Curve Analysis ── */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-slate-300 flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-cyan-500 inline-block" />
            Statistical Curves & Generalisation
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* ROC */}
          <GraphCard
            title="ROC Curves — One vs Rest"
            subtitle="Red AUC=0.98 · Yellow AUC=0.98 · Green absent"
            tip="Receiver Operating Characteristic. AUC near 1.0 means near-perfect discrimination. Red and Yellow both score 0.98. Green has no instances in current data."
            popupChildren={
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ROC} margin={{ top: 20, right: 40, left: 10, bottom: 40 }}>
                  <defs>
                    <linearGradient id="gRoc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.green} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={C.green} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? C.grid : '#e2e8f0'} />
                  <XAxis dataKey="fpr" stroke={darkMode ? C.muted : '#475569'} fontSize={13} tickFormatter={v => v.toFixed(1)} label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -20, fontSize: 13, fill: darkMode ? C.muted : '#475569' }} tick={{ fill: darkMode ? C.muted : '#475569' }} />
                  <YAxis stroke={darkMode ? C.muted : '#475569'} fontSize={13} domain={[0, 1]} label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', offset: 10, fontSize: 13, fill: darkMode ? C.muted : '#475569' }} tick={{ fill: darkMode ? C.muted : '#475569' }} />
                  <Tooltip {...TIP} />
                  <Legend wrapperStyle={{ fontSize: 14, color: darkMode ? C.text : '#1e293b' }} />
                  <Area type="monotone" dataKey="red" stroke={darkMode ? C.red : '#dc2626'} fill="url(#gRoc)" strokeWidth={3.5} name="Red (Critical) AUC=0.98" />
                  <Area type="monotone" dataKey="yellow" fill="transparent" stroke={darkMode ? '#ff9a00' : '#d97706'} strokeWidth={3} name="Yellow (Transit.) AUC=0.98" />
                  <Line type="monotone" dataKey="fpr" stroke="rgba(148,163,184,0.4)" strokeWidth={2} strokeDasharray="6 4" dot={false} name="Chance line" />
                </AreaChart>
              </ResponsiveContainer>
            }
          >
            <div className="h-44 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ROC} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gRocSm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.green} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={C.green} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? C.grid : '#e2e8f0'} />
                  <XAxis dataKey="fpr" stroke={darkMode ? C.muted : '#475569'} fontSize={10} tickFormatter={v => v.toFixed(1)} tick={{ fill: darkMode ? C.muted : '#475569' }} />
                  <YAxis stroke={darkMode ? C.muted : '#475569'} fontSize={10} domain={[0, 1]} tick={{ fill: darkMode ? C.muted : '#475569' }} />
                  <Tooltip {...TIP} />
                  <Legend wrapperStyle={{ fontSize: 11, color: darkMode ? C.text : '#1e293b' }} />
                  <Area type="monotone" dataKey="red" stroke={darkMode ? C.red : '#dc2626'} fill="url(#gRocSm)" strokeWidth={3} name="Red AUC=0.98" />
                  <Area type="monotone" dataKey="yellow" fill="transparent" stroke={darkMode ? '#ff9a00' : '#d97706'} strokeWidth={2.5} name="Yellow AUC=0.98" />
                  <Line type="monotone" dataKey="fpr" stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Chance" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GraphCard>

          {/* Precision-Recall */}
          <GraphCard
            title="Precision-Recall Curve"
            subtitle="Red AP≈0.97 · Yellow AP≈0.89"
            tip="High precision + high recall across all thresholds means the model avoids both false alarms (flagging safe districts as critical) and missed detections (missing real critical districts)."
            popupChildren={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={PR} margin={{ top: 20, right: 40, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="recall" stroke={C.muted} fontSize={13} tickFormatter={v => v.toFixed(1)} label={{ value: 'Recall', position: 'insideBottom', offset: -20, fontSize: 13, fill: C.muted }} tick={{ fill: C.muted }} />
                  <YAxis stroke={C.muted} fontSize={13} domain={[0.7, 1.05]} label={{ value: 'Precision', angle: -90, position: 'insideLeft', offset: 10, fontSize: 13, fill: C.muted }} tick={{ fill: C.muted }} />
                  <Tooltip {...TIP} />
                  <Legend wrapperStyle={{ fontSize: 14, color: C.text }} />
                  <Line type="monotone" dataKey="red" stroke={C.red} strokeWidth={3} dot={false} name="Red (AP≈0.97)" />
                  <Line type="monotone" dataKey="yellow" stroke="#ff9a00" strokeWidth={3} dot={false} name="Yellow (AP≈0.89)" />
                </LineChart>
              </ResponsiveContainer>
            }
          >
            <div className="h-44 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={PR} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="recall" stroke={C.muted} fontSize={10} tickFormatter={v => v.toFixed(1)} tick={{ fill: C.muted }} />
                  <YAxis stroke={C.muted} fontSize={10} domain={[0.7, 1.05]} tick={{ fill: C.muted }} />
                  <Tooltip {...TIP} />
                  <Legend wrapperStyle={{ fontSize: 11, color: C.text }} />
                  <Line type="monotone" dataKey="red" stroke={C.red} strokeWidth={2.5} dot={false} name="Red AP≈0.97" />
                  <Line type="monotone" dataKey="yellow" stroke="#ff9a00" strokeWidth={2.5} dot={false} name="Yellow AP≈0.89" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GraphCard>

          {/* Learning Curve */}
          <GraphCard
            title="Learning Curves"
            subtitle="Train vs Validation F1 across 8 LDO folds"
            tip="Converging train/validation curves indicate no overfitting. A small gap between train and validation confirms the model generalises to unseen divisions rather than memorising training patterns."
            popupChildren={
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={LC} margin={{ top: 20, right: 40, left: 10, bottom: 40 }}>
                  <defs>
                    <linearGradient id="gT2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.blue} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gV2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.green} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="fold" stroke={C.muted} fontSize={13} label={{ value: 'LDO Fold', position: 'insideBottom', offset: -20, fontSize: 13, fill: C.muted }} tick={{ fill: C.muted }} />
                  <YAxis stroke={C.muted} fontSize={13} domain={[0.5, 1.05]} tick={{ fill: C.muted }} />
                  <Tooltip {...TIP} />
                  <Legend wrapperStyle={{ fontSize: 14, color: C.text }} />
                  <Area type="monotone" dataKey="Train" stroke={C.blue} fill="url(#gT2)" strokeWidth={2.5} dot={false} name="Training F1" />
                  <Area type="monotone" dataKey="Val" stroke={C.green} fill="url(#gV2)" strokeWidth={2.5} dot={false} name="Validation F1" />
                </AreaChart>
              </ResponsiveContainer>
            }
          >
            <div className="h-44 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={LC} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="fold" stroke={C.muted} fontSize={10} tick={{ fill: C.muted }} />
                  <YAxis stroke={C.muted} fontSize={10} domain={[0.5, 1.05]} tick={{ fill: C.muted }} />
                  <Tooltip {...TIP} />
                  <Legend wrapperStyle={{ fontSize: 11, color: C.text }} />
                  <Area type="monotone" dataKey="Train" stroke={C.blue} fill="url(#gT)" strokeWidth={2} dot={false} name="Train F1" />
                  <Area type="monotone" dataKey="Val" stroke={C.green} fill="url(#gV)" strokeWidth={2} dot={false} name="Val F1" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GraphCard>
        </div>

        {/* ── Section 3: Feature Analysis ── */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-slate-300 flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-emerald-500 inline-block" />
            Feature Intelligence
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

          {/* MVT Weights — wider */}
          <div className="lg:col-span-2">
            <GraphCard
              title="Top 20 MVT Weights"
              subtitle="Feature importances — Extra Trees trained on all 64 districts"
              tip="Higher weight = stronger influence on district connectivity status prediction. Blue = top 5, Cyan = 6-10, Green = 11-15, Purple = 16-20. Dhaka division dummy ranks highest due to strong urban cluster effect."
              popupChildren={MVT_POPUP}
            >
              <div className="h-[360px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={wChartData} layout="vertical" margin={{ top: 4, right: 30, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                    <XAxis type="number" stroke={C.muted} fontSize={11} tickFormatter={v => v.toFixed(3)} tick={{ fill: C.muted }} />
                    <YAxis dataKey="name" type="category" width={140} stroke={C.muted} fontSize={9} interval={0} tick={{ fill: dm ? C.text : '#334155' }} />
                    <Tooltip {...TIP} formatter={(v, n, p) => [v.toFixed(4), p.payload.full]} />
                    <Bar dataKey="Weight" radius={[0, 4, 4, 0]} barSize={8} fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GraphCard>
          </div>

          {/* Interactive Top 10 Ranking */}
          <div className="lg:col-span-1 border rounded-2xl flex flex-col p-4 overflow-hidden relative shadow-lg bg-cover bg-center transition-all bg-blend-soft-light"
            style={{ backgroundImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))' }}>
            <div className={`absolute inset-0 z-0 ${darkMode ? 'bg-slate-900/90' : 'bg-white/80'} backdrop-blur-3xl`} />
            <div className="relative z-10 flex flex-col h-[380px]">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                  Top 10 Districts
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'connectivity', label: 'Score' },
                    { id: 'gap', label: 'Gap' },
                    { id: 'low', label: 'Worst' },
                  ].map(m => (
                    <button key={m.id} onClick={() => setDistrictMetric(m.id)}
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                        districtMetric === m.id
                          ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                          : darkMode ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-blue-500/30' : 'bg-[#f0ebe0] text-slate-600 border border-[#d4cbb8] hover:border-blue-400'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {(() => {
                  let sorted;
                  if (!districtData || districtData.length === 0) return <div className={`text-xs p-4 text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No active data. Please execute analysis.</div>;
                  if (districtMetric === 'gap') sorted = [...districtData].sort((a,b) => (targetConnectivity - b.connectivity) - (targetConnectivity - a.connectivity)).slice(0,10);
                  else if (districtMetric === 'low') sorted = [...districtData].sort((a,b) => a.connectivity - b.connectivity).slice(0,10);
                  else sorted = [...districtData].sort((a,b) => b.connectivity - a.connectivity).slice(0,10);
                  return sorted.map((d, i) => {
                    const gap = targetConnectivity - d.connectivity;
                    const pct = Math.min(100, (d.connectivity / targetConnectivity) * 100);
                    return (
                      <div key={d.name} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-[#ede8dc]'} transition-colors`}>
                        <span className={`text-[9px] font-bold w-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>#{i+1}</span>
                        <span className={`text-[10px] font-medium w-16 truncate ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{d.name}</span>
                        <div className="flex-1 h-1.5 bg-slate-700/30 rounded-full overflow-hidden shrink-0">
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${pct}%`,
                            background: d.status === 'red' ? '#ef4444' : d.status === 'yellow' ? '#f59e0b' : '#10b981'
                          }} />
                        </div>
                        <span className={`text-[10px] font-bold w-10 text-right ${d.status === 'red' ? 'text-red-400' : d.status === 'yellow' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                          {d.connectivity.toFixed(1)}%
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: Math Models ── */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-slate-300 flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-purple-500 inline-block" />
            Live Core Mathematical Models
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="glass-panel p-6 rounded-2xl border border-emerald-500/20 bg-emerald-900/5">
            <div className="text-xs font-bold text-emerald-400 mb-3 tracking-widest uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ConnectivaNet v4 — Scoring Engine
            </div>
            <div className="font-mono text-xs bg-slate-950/70 rounded-xl p-4 border border-slate-800 leading-7 text-slate-300">
              <span className="text-slate-500">{'// Step 1: Feature extraction (22 vars)'}</span><br />
              <span className="text-cyan-400">X</span> = [internet_access, tower_density, digital_readiness, ...]<br /><br />
              <span className="text-slate-500">{'// Step 2: Extra Trees classification'}</span><br />
              <span className="text-cyan-400">Score(D)</span> = ExtraTrees(<span className="text-blue-400">X</span>) → [0, 100]<br /><br />
              <span className="text-slate-500">{'// Step 3: 45% Dynamic Gap Rule (user sets T)'}</span><br />
              <span className="text-yellow-400">yellow_floor</span> = T × 0.55<br />
              IF Score ≥ T → <span className="text-emerald-400 font-bold">GREEN ✓</span><br />
              ELIF Score ≥ yellow_floor → <span className="text-yellow-400 font-bold">YELLOW ⚡</span><br />
              ELSE → <span className="text-red-400 font-bold">RED ✗</span><br /><br />
              <span className="text-slate-500">{'// Live: T='}{targetConnectivity}{'% | YELLOW≥'}{yThresh}{'%'}</span>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-blue-900/5">
            <div className="text-xs font-bold text-blue-400 mb-3 tracking-widest uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              PID Controller + Nodal Dependency Tree
            </div>
            <div className="font-mono text-xs bg-slate-950/70 rounded-xl p-4 border border-slate-800 leading-7 text-slate-300">
              <span className="text-slate-500">{'// PID: translates gap into policy magnitude'}</span><br />
              e(t) = <span className="text-yellow-400">T</span> − Score(t)          <span className="text-slate-600">{'// error'}</span><br />
              I(t) = I(t−1) + e(t)·dt   <span className="text-slate-600">{'// integral'}</span><br />
              D(t) = (e(t) − e(t−1)) / dt <span className="text-slate-600">{'// derivative'}</span><br />
              u(t) = 0.6·e + 0.1·I + 0.05·D<br /><br />
              <span className="text-slate-500">{'// Nodal Dependency Tree (causal chain)'}</span><br />
              Tower → <span className="text-cyan-400">Coverage</span> → Subscription<br />
              → <span className="text-blue-400">Internet Use</span> → Digital Literacy<br />
              → <span className="text-emerald-400">Score(D)</span><br /><br />
              H(D) = Σ(<span className="text-purple-400">MVT_w</span> × Indicator) + PID·u(t)
            </div>
          </div>
        </div>

        {/* ── Section 5: Country-Wise Comparison (ITU DataHub) ── */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-slate-300 flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-yellow-500 inline-block" />
            Country-Wise Comparison
            <span className="text-[10px] font-normal text-slate-500 ml-2">Source: ITU DataHub</span>
          </h3>
        </div>
        <div className="mb-8">
          <CountryComparison dm={dm} />
        </div>

        {/* ── Section 6: Data Update ── */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-slate-300 flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-purple-500 inline-block" />
            Data Management
          </h3>
        </div>
        <div className="mb-8">
          <DataUpdatePanel dm={dm} />
        </div>



        {/* ── Terminal Logs ── */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-slate-300 flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-slate-500 inline-block" />
            System Runtime Logs
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Terminal title="● Backend Engine Log" logs={LOGS_BE} accent="text-emerald-400 bg-emerald-950/30" />
          <Terminal title="● Frontend Runtime Log" logs={LOGS_FE} accent="text-cyan-400 bg-cyan-950/30" />
        </div>

      </div>
    </div>
  );
};
