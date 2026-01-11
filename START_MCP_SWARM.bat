@echo off
title MCP Swarm Orchestrator
color 0B

echo.
echo ========================================================
echo   MCP SWARM ORCHESTRATOR - BOOT SEQUENCE
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting SWARM SENSES (Port 9090)...
start "Swarm Senses" cmd /k "node mcp-server\senses-server.js"
timeout /t 2 /nobreak >nul

echo [2/3] Starting OPAQUE HANDS (Port 9092)...
start "Opaque Hands" cmd /k "node mcp-server\hands-server.js"
timeout /t 2 /nobreak >nul

echo [3/3] Starting GEMINI MCP (Port 9093)...
start "Gemini MCP" cmd /k "node mcp-server\gemini-mcp-server.js"
timeout /t 2 /nobreak >nul

echo.
echo ========================================================
echo   ALL SERVERS ONLINE
echo ========================================================
echo.
echo   Senses:     http://localhost:9090/sse
echo   Hands:      http://localhost:9092/sse
echo   Gemini MCP: http://localhost:9093/sse
echo.
echo ========================================================
echo.
pause
