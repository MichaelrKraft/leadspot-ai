#!/usr/bin/env bash
# LeadSpot.ai - Start everything with one command
# Usage: bash start.sh   (or the `leadspot` alias)
#
# Brings up all three local services, waits until the app is reachable,
# and opens the login page in your browser:
#   - FastAPI backend   http://localhost:8000  (backend/.venv Python)
#   - Agent-service     http://localhost:3008  (AI drips / workflows / dashboard AI)
#   - Next.js frontend  http://localhost:3006  <- open this to use the app

set -e

ROOT="/Users/michaelkraft/leadspot"
BACKEND_LOG="/tmp/leadspot-backend.log"
AGENT_LOG="/tmp/leadspot-agent.log"
FRONTEND_LOG="/tmp/leadspot-frontend.log"
VENV_PY="$ROOT/backend/.venv/bin/python"
APP_URL="http://localhost:3006"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LeadSpot.ai - Starting"
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

# ── Free the ports we use ───────────────────────────────────────────────────
echo ""
echo "Stopping anything already running on 8000, 3008, 3006..."
for PORT in 8000 3008 3006; do
  PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "  Freeing port $PORT (pid $PID)"
    kill -9 $PID 2>/dev/null || true
  fi
done
sleep 1

# ── Backend ─────────────────────────────────────────────────────────────────
echo ""
echo "Starting backend..."
cd "$ROOT/backend"
nohup "$VENV_PY" -m uvicorn app.main:app --port 8000 > "$BACKEND_LOG" 2>&1 &
echo "  Backend PID: $!"

# ── Agent-service (AI workflows/drips, dashboard AI) ────────────────────────
echo ""
echo "Starting agent-service..."
cd "$ROOT/agent-service"
nohup npm run dev > "$AGENT_LOG" 2>&1 &
echo "  Agent-service PID: $!"

# ── Frontend (pinned to 3006 to match backend FRONTEND_URL) ─────────────────
echo ""
echo "Starting frontend..."
cd "$ROOT/frontend"
nohup npm run dev -- -p 3006 > "$FRONTEND_LOG" 2>&1 &
echo "  Frontend PID: $!"

# ── Wait until the frontend actually serves the login page ──────────────────
echo ""
echo "Waiting for the app to be reachable (up to ~60s)..."
READY=0
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" "$APP_URL/login" 2>/dev/null | grep -q "200"; then
    READY=1
    break
  fi
  sleep 1
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$READY" -eq 1 ]; then
  echo "  LeadSpot is ready:  $APP_URL"
  echo "  Opening it in your browser..."
  open "$APP_URL/login" 2>/dev/null || true
else
  echo "  App did not come up in time — check the logs below."
fi
echo ""
echo "  Backend:       http://localhost:8000"
echo "  Agent-service: http://localhost:3008"
echo "  Frontend:      $APP_URL"
echo ""
echo "  Logs: tail -f $BACKEND_LOG $AGENT_LOG $FRONTEND_LOG"
echo "  Stop: bash $ROOT/stop.sh   (or the \`leadspot-stop\` alias)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
