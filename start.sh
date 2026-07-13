#!/usr/bin/env bash
# WAAEM | واءم — start backend (FastAPI) and frontend (Next.js) together.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶ WAAEM | واءم — starting services..."

# --- Backend ---
cd "$ROOT/backend"
if [ ! -d venv ]; then
  echo "  · creating Python venv & installing deps"
  python3 -m venv venv
  ./venv/bin/pip install --quiet --upgrade pip
  ./venv/bin/pip install --quiet -r requirements.txt
fi
./venv/bin/alembic upgrade head >/dev/null 2>&1 || true
./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
echo "  · backend  → http://127.0.0.1:8000  (pid $BACKEND_PID)"

# --- Frontend ---
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  echo "  · installing frontend deps"
  npm install
fi
npm run dev &
FRONTEND_PID=$!
echo "  · frontend → http://127.0.0.1:3000  (pid $FRONTEND_PID)"

trap "echo '▟ stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
