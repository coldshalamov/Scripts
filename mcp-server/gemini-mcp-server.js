#!/usr/bin/env node
/**
 * GEMINI MCP - SSE Proxy Server (Port 9093)
 * 
 * Tools: Gemini CLI, Kilo CLI
 * Access: Claude, Codex, Antigravity (NOT Gemini itself to avoid recursion)
 */

const { spawn } = require('child_process');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');

const PORT = 9093;
const SERVERS = {
    'gemini-cli': {
        command: 'node',
        args: ['C:/Users/User/.claude/mcp-servers/gemini-tool/gemini-mcp-tool-main/dist/index.js'],
        env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY }
    },
    'kilo-cli': {
        command: 'node',
        args: ['C:/Users/User/.claude/mcp-servers/kilo-cli-mcp/index.js']
    }
};

const clients = new Map();
const processes = new Map();

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

        res.write(`data: ${JSON.stringify({ type: 'connected', server: 'gemini-mcp' })}\n\n`);

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

Object.entries(SERVERS).forEach(([name, config]) => {
    startStdioServer(name, config);
});

server.listen(PORT, () => {
    console.log(`\n🔮 GEMINI MCP running on http://localhost:${PORT}/sse`);
    console.log(`   Tools: ${Object.keys(SERVERS).join(', ')}`);
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    processes.forEach((proc) => proc.kill());
    process.exit(0);
});
