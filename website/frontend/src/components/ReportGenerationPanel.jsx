import React, { useState } from 'react';
import { FileText, Download, AlertCircle, CheckCircle, Loader } from 'lucide-react';

const COLORS = {
  red: { base: '#ff0000', blink: '#ff4d00' },
  yellow: { base: '#ff9a00', blink: '#ffc100' },
  green: { base: '#34c62c', blink: '#8ce03a' },
  blue: { base: '#0066cc', blink: '#3399ff' },
  slate700: 'rgb(51, 65, 85)',
  slate200: 'rgb(226, 232, 240)',
};

const TIP = {
  LATEX: 'Comprehensive scientific report with methodology, ML benchmarks, architecture diagrams',
  SUMMARY: 'Quick-reference summary suitable for presentations and executive reviews',
  EXPORT: 'Download generated report file to your device',
};

export default function ReportGenerationPanel({ analysisData }) {
  const [latexLoading, setLatexLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [latexResult, setLatexResult] = useState(null);
  const [summaryResult, setSummaryResult] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerateLatex = async () => {
    setLatexLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/generate-report/latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_sections: ['methodology', 'results', 'analysis'],
          custom_title: 'Connectiva Digital Divide Analysis Report'
        })
      });

      const result = await response.json();
      if (result.status === 'error') {
        setError(result.message);
      } else {
        setLatexResult(result);
      }
    } catch (err) {
      setError(`LaTeX generation failed: ${err.message}`);
    } finally {
      setLatexLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/generate-report/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_kpis: true,
          include_roadmap: true
        })
      });

      const result = await response.json();
      if (result.status === 'error') {
        setError(result.message);
      } else {
        setSummaryResult(result);
      }
    } catch (err) {
      setError(`Summary generation failed: ${err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDownload = (filePath, filename) => {
    if (!filePath) return;
    
    // Simple download: open in new tab (backend serves the file)
    window.open(`/api/download?file=${encodeURIComponent(filePath)}`, '_blank');
  };

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-300">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-800">Report Generation</h2>
        <p className="text-sm text-slate-600">
          Generate comprehensive reports in multiple formats for documentation and sharing
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Generation Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LaTeX Scientific Report */}
        <div className="p-5 bg-white border border-slate-300 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-slate-800">Scientific Report (LaTeX)</h3>
                <p className="text-xs text-slate-500 mt-1">50+ pages, PDF or editable</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-700 mb-4">
            {TIP.LATEX}
          </p>

          {/* Format Selection */}
          <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">Includes:</p>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>✓ ML methodology & validation (Leave-Division-Out CV)</li>
              <li>✓ Full architecture diagrams (TikZ)</li>
              <li>✓ Confusion matrix & ROC curves</li>
              <li>✓ ITU sustainability alignment</li>
              <li>✓ 30+ citations from literature</li>
            </ul>
          </div>

          {latexResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">Generated Successfully</p>
                  <p className="text-xs text-green-700">{latexResult.format.toUpperCase()} format</p>
                </div>
              </div>

              {latexResult.note && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  ℹ️ {latexResult.note}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(latexResult.file, 'scientific_report')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
                  title={TIP.EXPORT}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={handleGenerateLatex}
                  className="flex-1 px-4 py-2 bg-slate-300 text-slate-800 rounded hover:bg-slate-400 transition text-sm font-medium"
                >
                  Regenerate
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateLatex}
              disabled={latexLoading}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded font-medium transition ${
                latexLoading
                  ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {latexLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate Scientific Report
                </>
              )}
            </button>
          )}
        </div>

        {/* Summary Report */}
        <div className="p-5 bg-white border border-slate-300 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-emerald-600 mt-1" />
              <div>
                <h3 className="font-semibold text-slate-800">Summary Report (Word+)</h3>
                <p className="text-xs text-slate-500 mt-1">Quick reference, 10–15 pages</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-700 mb-4">
            {TIP.SUMMARY}
          </p>

          {/* Format Selection */}
          <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">Includes:</p>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>✓ Executive summary (1 page)</li>
              <li>✓ System overview & features</li>
              <li>✓ Installation & setup steps</li>
              <li>✓ Policy simulation workflow</li>
              <li>✓ Technical specifications</li>
              <li>✓ Troubleshooting guide</li>
            </ul>
          </div>

          {summaryResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">Generated Successfully</p>
                  <p className="text-xs text-green-700">{summaryResult.format.toUpperCase()} format</p>
                </div>
              </div>

              {summaryResult.note && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  ℹ️ {summaryResult.note}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(summaryResult.file, 'summary_report')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition text-sm font-medium"
                  title={TIP.EXPORT}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={handleGenerateSummary}
                  className="flex-1 px-4 py-2 bg-slate-300 text-slate-800 rounded hover:bg-slate-400 transition text-sm font-medium"
                >
                  Regenerate
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateSummary}
              disabled={summaryLoading}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded font-medium transition ${
                summaryLoading
                  ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {summaryLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate Summary Report
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Scientific reports are ideal for journal submissions and detailed documentation.
          Summary reports are perfect for presentations and executive reviews.
          All reports include current analysis data and model performance metrics.
        </p>
      </div>
    </div>
  );
}
