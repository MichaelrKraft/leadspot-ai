#!/usr/bin/env bash
# LeadSpot.ai - Start all services
# Usage: bash start.sh
# Make executable: chmod +x start.sh

set -e

BACKEND_LOG="/tmp/leadspot-backend.log"
FRONTEND_LOG="/tmp/leadspot-frontend.log"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LeadSpot.ai - Starting Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Kill any existing processes on ports 8000 and 3006 ──────────────────────
echo ""
echo "Stopping any existing processes on ports 8000 and 3006..."

for PORT in 8000 3006; do
  PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "  Killing process $PID on port $PORT"
    kill -9 $PID 2>/dev/null || true
  fi
done

sleep 1

# ── Start FastAPI backend ────────────────────────────────────────────────────
echo ""
echo "Starting backend..."
cd /Users/michaelkraft/leadspot/backend
nohup python3 -m uvicorn app.main:app --port 8000 --reload \
  > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ── Start Next.js frontend ───────────────────────────────────────────────────
echo ""
echo "Starting frontend..."
cd /Users/michaelkraft/leadspot/frontend
nohup npm run dev \
  > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend  starting on http://localhost:8000"
echo "  Frontend starting on http://localhost:3006"
echo ""
echo "  Logs: tail -f $BACKEND_LOG $FRONTEND_LOG"
echo "  Stop: bash /Users/michaelkraft/leadspot/stop.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
