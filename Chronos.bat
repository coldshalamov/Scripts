@echo off
setlocal
title Chronos Tactical Orchestrator
color 0B

echo.
echo    __   _  _  ____   __   __ _  __   ____ 
echo   /  \ / )( \(  _ \ /  \ (  ( \/  \ / ___)
echo  (  O )) __ ( )   /(  O )/    /(  O )\___ \
echo   \__/ \_)(_/(__\_) \__/ \_)__) \__/ (____/
echo.
echo ========================================================
echo   INITIATING TACTICAL ORCHESTRATION PIPELINE
echo   VERSION 2.4 - CORE ESTABLISHED
echo ========================================================
echo.

cd /d "%~dp0"

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

IF NOT EXIST "node_modules" (
    echo [SYSTEM] Node dependencies missing. Installing...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)

IF NOT EXIST "dashboard\node_modules" (
    echo [UI] Dashboard dependencies missing. Installing...
    cd dashboard
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Dashboard UI install failed.
        pause
        exit /b 1
    )
    cd ..
)

echo [SYSTEM] Launching Native Desktop Interface...
call npm run app
if %ERRORLEVEL% neq 0 (
    echo.
    echo [CRITICAL] Application terminated with error code %ERRORLEVEL%.
    pause
)
