#!/bin/bash
# macOS launcher (double-click to run)
set -e
cd "$(dirname "$0")"
export COUNCIL_ROOM_V2_PORT="${COUNCIL_ROOM_V2_PORT:-8788}"
echo "Starting Council Room v2 on http://localhost:$COUNCIL_ROOM_V2_PORT"
(sleep 1 && open "http://localhost:$COUNCIL_ROOM_V2_PORT") &
exec node server.js
