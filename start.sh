#!/usr/bin/env bash
# LeadSpot.ai - Start core services (backend + frontend)
# Usage: bash start.sh
#
# Brings up:
#   - FastAPI backend on http://localhost:8000  (uses backend/.venv Python)
#   - Next.js frontend on http://localhost:3006
#
# The agent-service (AI drips/workflows) and voice-agent are NOT started here.
# Start those separately once configured.

set -e

ROOT="/Users/michaelkraft/leadspot"
BACKEND_LOG="/tmp/leadspot-backend.log"
FRONTEND_LOG="/tmp/leadspot-frontend.log"
VENV_PY="$ROOT/backend/.venv/bin/python"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LeadSpot.ai - Starting Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Preflight: backend venv must exist (system Python lacks deps / is 3.14) ──
if [ ! -x "$VENV_PY" ]; then
  echo ""
  echo "  ERROR: backend virtualenv not found at $VENV_PY"
  echo "  Create it once with:"
  echo "    cd $ROOT/backend && /opt/homebrew/bin/python3.12 -m venv .venv \\"
  echo "      && .venv/bin/pip install -r requirements.txt greenlet"
  exit 1
fi

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

# ── Start FastAPI backend ───────────────────────────────────────────────────
echo ""
echo "Starting backend..."
cd "$ROOT/backend"
nohup "$VENV_PY" -m uvicorn app.main:app --port 8000 \
  > "$BACKEND_LOG" 2>&1 &
echo "  Backend PID: $!"

# ── Start Next.js frontend (pinned to 3006 to match backend FRONTEND_URL) ────
echo ""
echo "Starting frontend..."
cd "$ROOT/frontend"
nohup npm run dev -- -p 3006 \
  > "$FRONTEND_LOG" 2>&1 &
echo "  Frontend PID: $!"

# ── Wait for the backend to answer before declaring success ─────────────────
echo ""
echo "Waiting for backend to become ready..."
READY=0
for i in $(seq 1 20); do
  if lsof -ti tcp:8000 >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$READY" -eq 1 ]; then
  echo "  Backend  ready   on http://localhost:8000"
else
  echo "  Backend  did NOT start — check $BACKEND_LOG"
fi
echo "  Frontend starting on http://localhost:3006"
echo ""
echo "  Logs: tail -f $BACKEND_LOG $FRONTEND_LOG"
echo "  Stop: bash $ROOT/stop.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
