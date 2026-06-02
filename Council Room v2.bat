@echo off
setlocal
cd /d "%~dp0"
set COUNCIL_ROOM_V2_PORT=8788
echo Freeing port %COUNCIL_ROOM_V2_PORT% (closing any old Council Room v2 instance)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%COUNCIL_ROOM_V2_PORT% " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
echo Starting Council Room v2 on http://localhost:%COUNCIL_ROOM_V2_PORT%
where firefox.exe >nul 2>&1
if not errorlevel 1 (
  start "" firefox.exe "http://localhost:%COUNCIL_ROOM_V2_PORT%"
) else if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" (
  start "" "%ProgramFiles%\Mozilla Firefox\firefox.exe" "http://localhost:%COUNCIL_ROOM_V2_PORT%"
) else if exist "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" (
  start "" "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" "http://localhost:%COUNCIL_ROOM_V2_PORT%"
) else (
  echo Firefox not found, opening the system default browser...
  start "" "http://localhost:%COUNCIL_ROOM_V2_PORT%"
)
node server.js
endlocal
