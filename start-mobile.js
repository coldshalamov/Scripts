const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Chronos Mobile Gateway Auto-Launcher
 * This script starts:
 * 1. The PTY Server (Backend)
 * 2. The MCP Gateway (Remote Access)
 * 3. (Optional) ngrok tunnel
 */

const CHRONOS_DIR = __dirname;
const MCP_DIR = path.join(CHRONOS_DIR, 'mcp-server');

function log(msg) {
    console.log(`[GATEWAY] ${msg}`);
}

function killPort(port) {
    try {
        const stdout = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = stdout.split('\n');
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid) && pid !== '0') {
                try { execSync(`taskkill /F /PID ${pid}`); } catch (e) { }
            }
        });
    } catch (e) { }
}

async function start() {
    log('Starting Chronos Mobile Gateway...');

    // 1. Clean up ports
    killPort(3000); // Backend
    killPort(8080); // MCP

    // 2. Start Backend
    log('Launching Backend (Port 3000)...');
    const backend = spawn('node', ['dist/server.js'], { cwd: CHRONOS_DIR, shell: true });
    backend.stdout.on('data', (data) => console.log(`[BACKEND] ${data.toString().trim()}`));

    // 3. Start MCP Server
    log('Launching MCP Server (Port 8080)...');
    const mcp = spawn('npx', ['ts-node', 'index.ts'], {
        cwd: MCP_DIR,
        shell: true,
        env: { ...process.env, CHRONOS_API_URL: 'http://localhost:3000/api', PORT: '8080' }
    });
    mcp.stdout.on('data', (data) => console.log(`[MCP] ${data.toString().trim()}`));

    log('✅ Gateway is live!');
    log('--------------------------------------------------');
    log('📱 Mobile Access:');
    log('1. Run "ngrok http 3000" in another window');
    log('2. Copy the URL to Render (CHRONOS_API_URL)');
    log('3. Open Scriptable on your iPhone');
    log('--------------------------------------------------');
    log('Keep this window open to stay connected.');
}

start();
