@echo off
setlocal
cd /d "%~dp0"
set COUNCIL_ROOM_V2_PORT=8788
echo Starting Council Room v2 on http://localhost:%COUNCIL_ROOM_V2_PORT%
start "" http://localhost:%COUNCIL_ROOM_V2_PORT%
node server.js
endlocal
