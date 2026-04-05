#!/bin/bash

# ============================================================
#   🚀 CONNECTIVA — Smart Startup Script
#   Works from ANY location — just run: bash start.sh
# ============================================================

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BOLD}"
echo "  ╔════════════════════════════════════════════════╗"
echo "   Project:  🚀 CONNECTIVA"
echo "   $SCRIPT_DIR"                      
echo "  ╚════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Find frontend and backend folders ──────────────────────
find_dir() {
    local name=$1
    for path in \
        "$SCRIPT_DIR/$name" \
        "$SCRIPT_DIR/website/$name" \
        "$SCRIPT_DIR/website/frontend" \
        "$SCRIPT_DIR/frontend"; do
        [ -d "$path" ] && echo "$path" && return
    done
}

FRONTEND_DIR=$(find_dir "frontend")
BACKEND_DIR=""
for path in \
    "$SCRIPT_DIR/backend" \
    "$SCRIPT_DIR/website/backend"; do
    [ -f "$path/app.py" ] && BACKEND_DIR="$path" && break
done

echo -e "${CYAN}Frontend: ${FRONTEND_DIR:-NOT FOUND}${RESET}"
echo -e "${CYAN}Backend:  ${BACKEND_DIR:-NOT FOUND}${RESET}"
echo ""

# ── Check Node.js ───────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing...${RESET}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
fi
echo -e "${GREEN}✔ Node $(node -v)${RESET}"

# ── Setup Backend ───────────────────────────────────────────
if [ -n "$BACKEND_DIR" ]; then
    echo -e "\n${CYAN}${BOLD}Setting up backend...${RESET}"
    cd "$BACKEND_DIR"

    # Always recreate venv to fix broken paths after copy
    if [ ! -f "venv/bin/python3" ] || ! venv/bin/python3 -c "import flask" &>/dev/null; then
        echo -e "${YELLOW}Recreating Python venv (broken or missing)...${RESET}"
        rm -rf venv
        python3 -m venv venv
        venv/bin/pip install --quiet flask flask-cors pandas numpy scikit-learn requests beautifulsoup4 openpyxl pdfplumber python-docx lxml
        echo -e "${GREEN}✔ Backend dependencies installed${RESET}"
    else
        echo -e "${GREEN}✔ Backend venv OK${RESET}"
    fi
else
    echo -e "${RED}✗ Backend not found — skipping${RESET}"
fi

# ── Setup Frontend ──────────────────────────────────────────
if [ -n "$FRONTEND_DIR" ]; then
    echo -e "\n${CYAN}${BOLD}Setting up frontend...${RESET}"
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing npm packages...${RESET}"
        npm install --silent
    fi
    echo -e "${GREEN}✔ Frontend ready${RESET}"
else
    echo -e "${RED}✗ Frontend not found${RESET}"
    exit 1
fi

# ── Launch Backend in background ───────────────────────────
if [ -n "$BACKEND_DIR" ]; then
    echo -e "\n${CYAN}${BOLD}Starting backend on port 5000...${RESET}"
    cd "$BACKEND_DIR"
    nohup venv/bin/python3 app.py > /tmp/connectiva_backend.log 2>&1 &
    BACKEND_PID=$!
    echo -e "${GREEN}✔ Backend started (PID $BACKEND_PID)${RESET}"

    # Wait for backend to respond
    echo -n "  Waiting for backend"
    for i in $(seq 1 15); do
        sleep 1
        echo -n "."
        if curl -s http://localhost:5000/api/summary &>/dev/null; then
            echo -e "\n${GREEN}✔ Backend responding on http://localhost:5000${RESET}"
            break
        fi
        if [ $i -eq 15 ]; then
            echo -e "\n${YELLOW}⚠ Backend slow to start — check /tmp/connectiva_backend.log${RESET}"
        fi
    done
fi

# ── Launch Frontend ─────────────────────────────────────────
echo -e "\n${CYAN}${BOLD}Starting frontend...${RESET}"
cd "$FRONTEND_DIR"

# Open browser after short delay
(sleep 3 && xdg-open http://localhost:5173 2>/dev/null || open http://localhost:5173 2>/dev/null) &

npm run dev

# ── Cleanup on exit ─────────────────────────────────────────
echo -e "\n${YELLOW}Shutting down...${RESET}"
[ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
echo -e "${GREEN}Done.${RESET}"
