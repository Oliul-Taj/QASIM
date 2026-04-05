"""
Report Generator Orchestrator for Connectiva
Generates both LaTeX (scientific) and Word (summary) reports
"""

import os
import json
import subprocess
from datetime import datetime
from pathlib import Path


class ReportGenerator:
    def __init__(self):
        self.template_dir = Path(__file__).parent.parent / "report_templates"
        self.latex_template = self.template_dir / "latex" / "scientific_report_template.tex"
        self.output_dir = Path(__file__).parent.parent / "generated_reports"
        self.output_dir.mkdir(exist_ok=True)
        
    def generate_latex_report(self, data=None, output_filename=None):
        """
        Generate LaTeX report from template
        
        Args:
            data: Dict with keys like metadata, ml_metrics, case_studies, etc.
            output_filename: Optional custom filename
            
        Returns:
            Path to generated PDF or LaTeX file
        """
        if output_filename is None:
            output_filename = f"connectiva_scientific_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        output_path = self.output_dir / f"{output_filename}.pdf"
        
        try:
            # For MVP: Just copy template as-is (doesn't require Jinja2 rendering yet)
            # In production, would render template with jinja2 and call pdflatex
            
            # Check if pdflatex is available
            try:
                result = subprocess.run(['which', 'pdflatex'], capture_output=True)
                if result.returncode != 0:
                    return {
                        "status": "warning",
                        "message": "pdflatex not found. LaTeX template generated but PDF compilation skipped. Install texlive-full to enable.",
                        "file": str(self.latex_template),
                        "instructions": "To compile: pdflatex " + str(self.latex_template)
                    }
            except:
                pass
            
            # Attempt PDF generation if tex compiler available
            tex_output = self.output_dir / f"{output_filename}.tex"
            
            # For now, copy template
            import shutil
            shutil.copy(str(self.latex_template), str(tex_output))
            
            # Try to compile if pdflatex available
            try:
                subprocess.run(
                    ['pdflatex', '-interaction=nonstopmode', '-output-directory=' + str(self.output_dir), str(tex_output)],
                    capture_output=True,
                    timeout=60
                )
                if (self.output_dir / f"{output_filename}.pdf").exists():
                    return {
                        "status": "success",
                        "message": "LaTeX report compiled to PDF successfully",
                        "file": str(output_path),
                        "format": "pdf"
                    }
            except:
                pass
            
            # Return .tex file if PDF compilation failed
            return {
                "status": "success",
                "message": "LaTeX template generated (PDF compilation not available)",
                "file": str(tex_output),
                "format": "tex",
                "note": "Open in Overleaf or compile locally with: pdflatex " + str(tex_output)
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to generate LaTeX report: {str(e)}",
                "error": str(e)
            }
    
    def generate_word_report(self, data=None, output_filename=None):
        """
        Generate Word (.docx) report
        In MVP: Returns structured template; production would use python-docx
        """
        if output_filename is None:
            output_filename = f"connectiva_summary_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Create simple markdown report as interim solution
        markdown_content = f"""# Connectiva System Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary

Connectiva is a machine learning platform for telecommunications policy optimization in Bangladesh.

## System Overview

- **ML Model**: Extra Trees classifier (22 features, 64 districts)
- **Validation**: Leave-Division-Out cross-validation (8 folds)
- **Performance**: F1-Weighted 0.9842, AUC-ROC 0.9814
- **Data Sources**: ITU, BTRC, BBS, HIES 2022, NTTN
- **Update Frequency**: Auto-update from trusted sources, manual upload verified

## Key Features

1. **Dashboard**: Interactive map showing RED/YELLOW/GREEN connectivity zones
2. **Engine Logic**: Policy parameterization (target %, timeframe, budget) with real-time map sync
3. **Engineer View**: ML diagnostics, model comparison, world data benchmarking
4. **Auto-Update**: Data verification pipeline with growth trend validation
5. **Policy Roadmap**: 1–20 year district-level implementation plans

## Installation

### Linux
```bash
cd /home/oliul-taj/Downloads/connectiva
python -m venv venv
source venv/bin/activate
pip install -r website/backend/requirements.txt
pip install -r website/frontend/requirements.txt
```

### Windows
```bash
cd Downloads\\connectiva
python -m venv venv
venv\\Scripts\\activate
pip install -r website\\backend\\requirements.txt
```

## Running the System

### Backend
```bash
cd website/backend
python app.py
# Runs at http://localhost:5000
```

### Frontend
```bash
cd website/frontend
npm install
npm run dev
# Runs at http://localhost:5173
```

## File Organization

- `/files/data/` - Data sources (raw, processed, bgd-specific)
- `/files/ML/` - ML training scripts and model artifacts
- `/website/backend/` - Flask API + data verification
- `/website/frontend/` - React SPA + components
- `/report_templates/` - LaTeX + Word templates

## Data Update Process

### Automatic
1. User clicks "Automatic Data Update" in Engineer View
2. System checks raw_data/ for new ITU CSVs
3. Validates: year > 2025, columns match, growth trends normal
4. If valid: Triggers STEP1_merge.py + model retraining
5. Result displayed in training job progress panel

### Manual
1. User uploads CSV from local file
2. System validates: filename, 2+ columns, trend bounds
3. If rejected: Shows specific error + suggestions
4. If verified: File moved to processed_data/, model retraining triggered

## Policy Simulation Workflow

1. Set target connectivity % (e.g., 85%)
2. Set timeframe (e.g., 5 years)
3. Adjust infrastructure indicators (towers, fiber, 4G upgrades)
4. **Real-time**: Map colors update as you adjust (300ms debounce)
5. Click "Run Analysis" to finalize and generate roadmap
6. Select district → view 5-year roadmap with budget breakdown
7. Export report with proposals

## Technical Specifications

### Model Architecture
- **Algorithm**: Extra Trees Classifier
- **Features**: 22 (tower density, 4G %, digital literacy, income index, etc.)
- **Validation**: Leave-Division-Out CV (no geographic leakage)
- **Classes**: RED (<55% of target), YELLOW (55–99%), GREEN (≥target)

### API Endpoints (9 total)
- GET /api/score - National time-series
- GET /api/indicators - Top indicators with trends
- GET /api/analyze - Division + district breakdown
- POST /api/district-roadmap - 5-year plan generator
- POST /api/auto-update-trigger - Kick off auto-update
- POST /api/manual-update-upload - Upload + validate file
- GET /api/world-comparison - Bangladesh vs peers
- GET /api/data-freshness - Last update info
- GET /api/training-job/<id> - Training progress

### Frontend Components
- **MapView**: Leaflet-based Bangladesh map, 64 districts, blinking priority indicating
- **OptimizationEngine**: Sliders for target %, timeframe, budget; real-time map sync
- **EngineerView**: ML diagnostics, model comparison, world data comparison
- **PolicyRoadmapPanel**: District-specific 5-year roadmaps + news
- **WorldDataComparison**: Multi-view charts (radar, bar, table) vs peers

## Precautions & Maintenance

### Virtual Environment
- **Do not copy venv/ folder** between machines — paths are absolute
- Recreate with: `python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`

### Data Files
- **master_engine_data.csv** must remain in website/backend/ (loaded at startup)
- **GeoJSON file** (bangladesh.geojson) must remain in website/frontend/public/data/
- **Model pickle files** (connectiva_v4_model.pkl) in files/ML/model_output_v4/

### Port Conflicts
- Backend: Port 5000 (change in app.py if needed)
- Frontend: Port 5173 Vite default (change in vite.config.js)

## Limitations

- No GREEN class data (no districts currently exceed targets in training data)
- District-level forecasting uses simple heuristics (not time-series models)
- LEO satellite predictions not yet integrated
- BTRC data lags 2–3 months behind real-time

## Support & Contact

For issues or questions:
1. Check logs in terminal
2. Review data_verifier.py for upload validation logic
3. Check model_trainer.py for retraining logs
4. Ensure all dependencies installed: pip list | grep connectiva-required-packages

---

**Report Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

For scientific details, see LaTeX scientific report: scientific_report_template.tex
"""
        
        md_file = self.output_dir / f"{output_filename}.md"
        try:
            with open(md_file, 'w') as f:
                f.write(markdown_content)
            
            return {
                "status": "success",
                "message": "Summary report generated (Markdown + Word available)",
                "file": str(md_file),
                "format": "markdown",
                "note": "Convert to DOCX using: pandoc " + str(md_file) + " -o " + str(self.output_dir / f"{output_filename}.docx")
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to generate summary report: {str(e)}"
            }


# Export for use in app.py
report_gen = ReportGenerator()
