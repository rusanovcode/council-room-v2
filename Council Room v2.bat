@echo off
setlocal
cd /d "%~dp0"
set COUNCIL_ROOM_V2_PORT=8788
echo Freeing port %COUNCIL_ROOM_V2_PORT% (closing any old Council Room v2 instance)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%COUNCIL_ROOM_V2_PORT% " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
echo Starting Council Room v2 on http://localhost:%COUNCIL_ROOM_V2_PORT%
start "" http://localhost:%COUNCIL_ROOM_V2_PORT%
node server.js
endlocal
