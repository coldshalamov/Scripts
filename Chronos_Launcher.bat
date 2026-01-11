@echo off
setlocal
title Chronos Tactical Orchestrator [BROWSER_MODE]
color 0B

echo.
echo    __   _  _  ____   __   __ _  __   ____ 
echo   /  \ / )( \(  _ \ /  \ (  ( \/  \ / ___)
echo  (  O )) __ ( )   /(  O )/    /(  O )\___ \
echo   \__/ \_)(_/(__\_) \__/ \_)__) \__/ (____/
echo.
echo ========================================================
echo   INITIATING TACTICAL ORCHESTRATION PIPELINE
echo   VERSION 2.4 - BROWSER BRIDGE ESTABLISHED
echo ========================================================
echo.

cd /d "%~dp0"

IF NOT EXIST "package.json" (
    echo [ERROR] package.json not found!
    echo [ERROR] Current Path: %CD%
    pause
    exit /b 1
)

IF NOT EXIST "node_modules" (
    echo [SYSTEM] Node dependencies missing. Installing...
    call npm install
)

echo [SYSTEM] Compiling Tactical Core...
call npm run build
IF ERRORLEVEL 1 (
    echo [ERROR] Build sequence failed!
    pause
    exit /b 1
)

echo [SYSTEM] Starting API Stream (Port 3000)...
start "Chronos API" cmd /c "node dist/server.js & pause"

timeout /t 3 /nobreak >nul

echo [SYSTEM] Starting Interface Bridge (Port 5173)...
cd dashboard
IF NOT EXIST "package.json" (
    echo [ERROR] Interface artifacts missing!
    pause
    exit /b 1
)

IF NOT EXIST "node_modules" (
    echo [SYSTEM] Installing UI dependencies...
    call npm install
)

echo [SYSTEM] Opening Secure Browser Uplink...
start http://localhost:5173

echo [SYSTEM] Synchronizing React Dev Server...
npm run dev
pause
