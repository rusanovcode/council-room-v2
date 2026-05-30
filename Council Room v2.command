#!/bin/bash
# macOS launcher (double-click to run)
set -e
cd "$(dirname "$0")"
export COUNCIL_ROOM_V2_PORT="${COUNCIL_ROOM_V2_PORT:-8788}"
echo "Freeing port $COUNCIL_ROOM_V2_PORT (closing any old Council Room v2 instance)..."
# Portable across macOS (BSD xargs has no -r) and Linux: collect PIDs, then kill if any.
PIDS=$(lsof -ti tcp:"$COUNCIL_ROOM_V2_PORT" 2>/dev/null || true)
[ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
echo "Starting Council Room v2 on http://localhost:$COUNCIL_ROOM_V2_PORT"
(sleep 1 && open "http://localhost:$COUNCIL_ROOM_V2_PORT") &
exec node server.js
