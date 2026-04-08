#!/usr/bin/env bash
# LeadSpot.ai - Stop all services
# Usage: bash stop.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LeadSpot.ai - Stopping Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

STOPPED=0

for PORT in 8000 3006; do
  PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "  Killing process $PID on port $PORT"
    kill -9 $PID 2>/dev/null || true
    STOPPED=$((STOPPED + 1))
  else
    echo "  Port $PORT: nothing running"
  fi
done

echo ""
if [ "$STOPPED" -gt 0 ]; then
  echo "  Done. $STOPPED process(es) stopped."
else
  echo "  Nothing was running."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
