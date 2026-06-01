@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "SWITCHER_AUTH=%SCRIPT_DIR%\auth"

cls
echo ============================================
echo   Claude Code Launcher - Account Selector
echo ============================================
echo.

echo Fetching token stats...
powershell -NoProfile -Command "& '%SCRIPT_DIR%\bin\ai-tokens.ps1' -Period today"
echo.

echo ============================================
echo  Select account:
echo   1  ^>  Claude Code   (acc1 - default)
echo   2  ^>  Claude Code 2 (acc2 - %SWITCHER_AUTH%\claude-acc2)
echo   Q  ^>  Quit
echo ============================================
echo.
set /p CHOICE="Enter choice [1/2/Q]: "

if /i "%CHOICE%"=="q" goto :EOF
if "%CHOICE%"=="1" goto :ACC1
if "%CHOICE%"=="2" goto :ACC2

echo Invalid choice.
goto :EOF

:ACC1
echo.
echo [acc1] Launching Claude Code (default account)...
set "CLAUDE_CONFIG_DIR="
claude
goto :EOF

:ACC2
echo.
echo [acc2] Launching Claude Code 2 (auth\claude-acc2)...
set "CLAUDE_CONFIG_DIR=%SWITCHER_AUTH%\claude-acc2"
claude
goto :EOF
