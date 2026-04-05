# 🌐 Connectiva — Digital Divide Optimization Engine

**Autonomous Regional Digital Divide Optimization Engine for Bangladesh**
> Developed for the **ITU UMC Data Hackathon 2025** · Bangladesh Digital Inclusion Initiative

---

## What is Connectiva?

Connectiva is an ML-powered policy intelligence platform that analyzes 154 ITU indicators, BTRC subscriber data, and HIES household statistics to generate actionable infrastructure roadmaps for Bangladesh's 64 districts. It dynamically classifies regions as RED/YELLOW/GREEN based on user-defined connectivity targets and provides year-by-year policy intervention plans.

**Key Features:**
- 🗺️ Interactive map with dynamic RED/YELLOW/GREEN district classification
- 🤖 ConnectivaNet v4 ML model (Extra Trees, F1=0.9842, AUC=0.9814)
- ⚙️ PID-controlled policy simulation engine
- 📊 Engineer View with scientific ML diagnostics
- 🔬 Real-time sandbox for policy intervention simulation
- 📋 Comprehensive downloadable analysis reports
- 📁 Multi-format file upload analysis (CSV, XLSX, JSON, PDF, DOC)

---

## Quick Start (5 min setup)

### Prerequisites

| Software | Version | Check Command |
|----------|---------|---------------|
| Node.js | ≥ 18.x | `node -v` |
| Python | ≥ 3.10 | `python3 --version` |
| npm | ≥ 9.x | `npm -v` |
| pip | ≥ 22.x | `pip --version` |

### One-Command Setup (Recommended)

```bash
# Open your terminal inside the downloaded 'connectiva' folder and type:
./setup.sh
```

This script automatically:
- Checks/installs Node.js
- Creates Python virtual environment
- Installs all dependencies
- Starts both backend (port 5000) and frontend (port 5173)
- Opens the browser


## Common Issues & Troubleshooting

### ❌ "venv/bin/python3: cannot execute"
**Cause:** Virtual environment was copied from another machine.
```bash
# Fix: Recreate it
cd website/backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
pip install flask flask-cors pandas numpy scikit-learn requests beautifulsoup4 openpyxl pdfplumber python-docx lxml
```

### ❌ "npm install" hangs or fails
**Cause:** Corrupted node_modules or old lock file.
```bash
cd website/frontend
rm -rf node_modules package-lock.json
npm install
```

### ❌ Backend says "Module not found"
**Cause:** Missing Python library.
```bash
source website/backend/venv/bin/activate
pip install <missing-module-name>
```

### ❌ XLSX files won't upload
**Cause:** `openpyxl` not installed.
```bash
source website/backend/venv/bin/activate
pip install openpyxl
```

### ❌ Map doesn't load
**Cause:** GeoJSON file not found or network blocked.
- Check that `website/frontend/public/data/gadm41_BGD_2.json` exists
- Ensure CARTO tile server is reachable (internet required)

### ❌ "Port 5000 already in use"
```bash
# Linux/macOS
lsof -i :5000 | awk 'NR>1 {print $2}' | xargs kill
# Then restart: python app.py
```

### ⚠️ Don't move/copy the `venv` folder
Python virtual environments contain hardcoded absolute paths. If you move the project folder, **always recreate venv** using the steps above.

---

## Project Structure

```
connectiva/
├── setup.sh                  # One-command setup script
├── README.md                 # This file
├── website/
│   ├── frontend/             # React + Vite application
│   │   ├── src/
│   │   │   ├── App.jsx       # Main app, routing, theme, About page
│   │   │   ├── components/
│   │   │   │   ├── Sidebar.jsx          # Navigation + report generation
│   │   │   │   ├── MapView.jsx          # Leaflet interactive map
│   │   │   │   ├── EngineerView.jsx     # ML diagnostics + file upload
│   │   │   │   ├── OptimizationEngine.jsx # Policy simulator + proposals
│   │   │   │   └── PolicyRoadmapPanel.jsx # Roadmap + trends + news
│   │   │   ├── context/
│   │   │   │   └── EngineContext.jsx    # Central state (dark mode, data)
│   │   │   └── utils/
│   │   │       └── engine.js            # District scoring + PID controller
│   │   └── public/data/                 # GeoJSON + CSV data
│   └── backend/
│       ├── app.py             # Flask API server
│       ├── master_engine_data.csv
│       ├── mvt_weights.csv
│       └── venv/              # Python virtual environment (recreate if broken)
├── ML/                        # Machine learning pipeline
│   ├── train_connectiva_v4.py # Latest training script
│   └── model_output_v4/       # Trained model artifacts
├── data/                      # Essential reference datasets
└── files/                     # Pipeline scripts (STEP1, STEP2, STEP3)
```

---

## Team Connectiva

| Member | Role |
|--------|------|
| **Sumaiya Sifat** | Team Lead — Project coordination, research, data sourcing |
| **Mir Oliul Pasha Taj** | System Architect — ML pipeline, PID integration, system design |
| **Tanim Hasan** | Frontend Engineer — React UI, interactive map, visual design |
| **Mahmud Refey** | Statistician — Data preprocessing, ML evaluation, validation |
| **Abdullah Al Mamun** | Backend Developer — Flask API, data pipeline, server-side ML |

---

## License

Developed for the ITU UMC Data Hackathon 2025. All rights reserved by Team Connectiva.
