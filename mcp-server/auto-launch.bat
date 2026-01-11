@echo off
REM MCP Swarm Auto-Launcher (Silent Background Mode)
REM Call this from your agent startup scripts

cd /d "%~dp0"
start /min "" node mcp-server\auto-launch.js
