@echo off
echo Testing Agent CLI Commands...
echo.

echo [1/4] Testing Gemini CLI...
gemini --help 2>&1 | findstr /C:"prompt" /C:"message" /C:"input"
echo.

echo [2/4] Testing Claude CLI...
claude --help 2>&1 | findstr /C:"prompt" /C:"message" /C:"input"
echo.

echo [3/4] Testing Codex CLI...
codex --help 2>&1 | findstr /C:"prompt" /C:"message" /C:"input"
echo.

echo [4/4] Testing Jules CLI...
jules --help 2>&1 | findstr /C:"prompt" /C:"message" /C:"input"
echo.

pause
