#!/usr/bin/env node
/**
 * SWARM SENSES - SSE Proxy Server (Port 9090)
 * 
 * Tools: Nucleus, Serena, Crawler
 * Access: ALL agents (Claude, Codex, Gemini, Antigravity, Kilo)
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9090;
const SERVERS = {
    nucleus: {
        command: 'C:/Users/User/.claude/mcp-servers/nucleus/mcp-server-nucleus-main/.venv/Scripts/python.exe',
        args: ['-m', 'mcp_server_nucleus'],
        env: { NUCLEAR_BRAIN_PATH: 'C:/Users/User/Documents/GitHub/Telomere/Gloorbot/.brain' }
    },
    serena: {
        url: 'http://localhost:24281/sse' // Already running as SSE
    }
};

const clients = new Map();
const processes = new Map();

// Start stdio servers and bridge them to SSE
function startStdioServer(name, config) {
    const proc = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    processes.set(name, proc);

    proc.stdout.on('data', (data) => {
        broadcast({ server: name, type: 'stdout', data: data.toString() });
    });

    proc.stderr.on('data', (data) => {
        console.error(`[${name}] ${data}`);
    });

    proc.on('exit', (code) => {
        console.log(`[${name}] exited with code ${code}`);
    });

    return proc;
}

function broadcast(message) {
    const payload = `data: ${JSON.stringify(message)}\n\n`;
    clients.forEach((res) => {
        res.write(payload);
    });
}

// HTTP Server
const server = http.createServer((req, res) => {
    if (req.url === '/sse') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        const clientId = Date.now();
        clients.set(clientId, res);

        res.write(`data: ${JSON.stringify({ type: 'connected', server: 'senses' })}\n\n`);

        req.on('close', () => {
            clients.delete(clientId);
        });
    } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', servers: Object.keys(SERVERS) }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// Start all stdio servers
Object.entries(SERVERS).forEach(([name, config]) => {
    if (config.command) {
        startStdioServer(name, config);
    }
});

server.listen(PORT, () => {
    console.log(`\n🧠 SWARM SENSES running on http://localhost:${PORT}/sse`);
    console.log(`   Tools: ${Object.keys(SERVERS).join(', ')}`);
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    processes.forEach((proc) => proc.kill());
    process.exit(0);
});
