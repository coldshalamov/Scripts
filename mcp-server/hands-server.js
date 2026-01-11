#!/usr/bin/env node
/**
 * OPAQUE HANDS - SSE Proxy Server (Port 9092)
 * 
 * Tools: Render, GitHub, StackOverflow, Perplexity, Code Executor, etc.
 * Access: GEMINI ONLY (via code-executor wrapper)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { spawn } = require('child_process');
const http = require('http');

const PORT = 9092;
const SERVERS = {
    render: {
        command: 'C:/Users/User/AppData/Local/Programs/render-mcp/render-mcp-server_v0.2.2.exe',
        args: [],
        env: { RENDER_API_KEY: process.env.RENDER_API_KEY }
    },
    github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN }
    },
    stackoverflow: {
        command: 'npx',
        args: ['-y', '@gscalzo/stackoverflow-mcp']
    },
    perplexity: {
        command: 'npx',
        args: ['-y', 'server-perplexity-ask'],
        env: { PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY }
    },
    arxiv: {
        command: 'C:/Users/User/.claude/mcp-servers/arxiv/arxiv-mcp-server-main/.venv/Scripts/python.exe',
        args: ['-m', 'arxiv_mcp_server']
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

        res.write(`data: ${JSON.stringify({ type: 'connected', server: 'hands' })}\n\n`);

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
    console.log(`\n🤲 OPAQUE HANDS running on http://localhost:${PORT}/sse`);
    console.log(`   Tools: ${Object.keys(SERVERS).join(', ')}`);
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    processes.forEach((proc) => proc.kill());
    process.exit(0);
});
