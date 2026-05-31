@echo off
setlocal

cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not found in PATH.
  pause
  exit /b 1
)

for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "CURRENT=%%B"

if not defined CURRENT (
  echo Could not detect the current git branch.
  pause
  exit /b 1
)

for /f "delims=" %%S in ('git status --porcelain 2^>nul') do (
  echo Working tree has uncommitted changes. Commit or stash them first.
  echo.
  git status --short
  pause
  exit /b 1
)

if /i "%CURRENT%"=="main" (
  set "TARGET=public"
) else if /i "%CURRENT%"=="public" (
  set "TARGET=main"
) else (
  echo Current branch is "%CURRENT%".
  echo This script only switches between "main" and "public".
  pause
  exit /b 1
)

echo Switching from %CURRENT% to %TARGET%...
git switch %TARGET%
if errorlevel 1 (
  echo Failed to switch branch.
  pause
  exit /b 1
)

echo.
echo Now on:
git branch --show-current
pause
