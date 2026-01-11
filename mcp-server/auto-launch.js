#!/usr/bin/env node
/**
 * MCP Swarm Auto-Launcher
 * 
 * This script checks if the MCP servers are running and starts them if needed.
 * Designed to be called by agent startup scripts.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const SERVERS = [
    { name: 'Senses', port: 9090, script: 'senses-server.js' },
    { name: 'Hands', port: 9092, script: 'hands-server.js' },
    { name: 'Gemini MCP', port: 9093, script: 'gemini-mcp-server.js' }
];

const SERVER_DIR = path.join(__dirname);

function checkServer(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function startServer(server) {
    const scriptPath = path.join(SERVER_DIR, server.script);

    console.log(`[MCP Swarm] Starting ${server.name} on port ${server.port}...`);

    const proc = spawn('node', [scriptPath], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(SERVER_DIR)
    });

    proc.unref(); // Allow parent to exit independently

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
}

async function ensureServersRunning() {
    console.log('[MCP Swarm] Checking server status...');

    for (const server of SERVERS) {
        const isRunning = await checkServer(server.port);

        if (isRunning) {
            console.log(`[MCP Swarm] ✓ ${server.name} already running`);
        } else {
            await startServer(server);

            // Verify it started
            const nowRunning = await checkServer(server.port);
            if (nowRunning) {
                console.log(`[MCP Swarm] ✓ ${server.name} started successfully`);
            } else {
                console.error(`[MCP Swarm] ✗ Failed to start ${server.name}`);
            }
        }
    }

    console.log('[MCP Swarm] All servers ready\n');
}

ensureServersRunning().catch(console.error);
