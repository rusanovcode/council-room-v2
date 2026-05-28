#!/bin/bash
# Linux launcher
set -e
cd "$(dirname "$0")"
export COUNCIL_ROOM_V2_PORT="${COUNCIL_ROOM_V2_PORT:-8788}"
echo "Starting Council Room v2 on http://localhost:$COUNCIL_ROOM_V2_PORT"
if command -v xdg-open >/dev/null 2>&1; then
  (sleep 1 && xdg-open "http://localhost:$COUNCIL_ROOM_V2_PORT") &
fi
exec node server.js
