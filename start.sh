#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}Qasynda Marketing Studio${NC}"
echo "─────────────────────────────────────"

# ── Pre-flight checks ──────────────────────────────────────────────────────────

if [ ! -d "$SCRIPT_DIR/backend/.venv" ]; then
  echo -e "${RED}✗ Backend virtualenv not found.${NC}"
  echo "  Run: cd backend && python3.11 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  echo -e "${RED}✗ backend/.env not found.${NC}"
  echo "  Run: cp backend/.env.example backend/.env  (then fill in your values)"
  exit 1
fi

if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
  echo -e "${RED}✗ Frontend node_modules not found.${NC}"
  echo "  Run: cd frontend && npm install"
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/frontend/.env.local" ]; then
  echo -e "${YELLOW}⚠ frontend/.env.local not found — using defaults.${NC}"
fi

# ── Start backend ──────────────────────────────────────────────────────────────

echo -e "${GREEN}→ Backend${NC}  http://localhost:8000  (FastAPI + uvicorn)"

cd "$SCRIPT_DIR/backend"
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# ── Start frontend ─────────────────────────────────────────────────────────────

echo -e "${GREEN}→ Frontend${NC} http://localhost:3000  (Next.js)"

cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# ── Ready ──────────────────────────────────────────────────────────────────────

echo "─────────────────────────────────────"
echo -e "  Frontend : ${BOLD}http://localhost:3000${NC}"
echo -e "  Backend  : ${BOLD}http://localhost:8000${NC}"
echo -e "  API docs : ${BOLD}http://localhost:8000/docs${NC}"
echo "─────────────────────────────────────"
echo -e "${YELLOW}Press Ctrl+C to stop both services.${NC}"

# ── Cleanup on exit ────────────────────────────────────────────────────────────

cleanup() {
  echo ""
  echo "Shutting down…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "Done."
}
trap cleanup INT TERM

wait "$BACKEND_PID" "$FRONTEND_PID"
