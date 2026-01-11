import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Engine } from './engine';
import { Planner } from './planner';
import { ConfigManager } from './config';
import { SystemConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as pty from 'node-pty';
import * as os from 'os';
import { CoordinationWrapper } from './coordination';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const configManager = new ConfigManager();
const engine = new Engine(io, 'missions');
const planner = new Planner();
const MISSIONS_DIR = path.join(process.cwd(), 'missions');

// Coordination Log Wrapper
let coordinationWrapper: CoordinationWrapper | null = null;
const updateCoordination = () => {
    const config = configManager.getConfig();
    if (config.workspaceDir) {
        coordinationWrapper = new CoordinationWrapper(config.workspaceDir);
    }
};
updateCoordination();

// PTY Sessions storage
const ptyProcesses: Map<string, pty.IPty> = new Map();

// Buffer for terminal history
const terminalBuffers: Map<string, string> = new Map();
const MAX_BUFFER_SIZE = 100000; // 100KB

function appendToBuffer(termId: string, data: string) {
    let buf = terminalBuffers.get(termId) || '';
    buf += data;
    if (buf.length > MAX_BUFFER_SIZE) {
        buf = buf.substring(buf.length - MAX_BUFFER_SIZE);
    }
    terminalBuffers.set(termId, buf);
}

// Shell to use
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

function getAgentCommand(agentName: string | null): string[] {
    if (!agentName) return [];
    const config = configManager.getConfig();
    const agent = config.agents.find(a => a.name === agentName);
    if (!agent) return [];
    return [agent.command, ...(agent.args || [])];
}

function spawnTerminal(termId: string, socket: any) {
    // Kill existing if any
    if (ptyProcesses.has(termId)) {
        try { ptyProcesses.get(termId)?.kill(); } catch (e) { }
    }

    const config = configManager.getConfig();
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: config.workspaceDir || process.cwd(),
        env: process.env as { [key: string]: string }
    });

    ptyProcesses.set(termId, ptyProcess);

    // Send output to client with error handling
    ptyProcess.onData((data) => {
        appendToBuffer(termId, data);
        try {
            socket.emit(`term:${termId}:data`, data);
        } catch (e) { }
    });

    // Run agent command if mapped
    const agentName = config.termMapping[termId];
    if (!agentName) return ptyProcess;

    const agent = config.agents.find(a => a.name === agentName);
    if (!agent) return ptyProcess;

    // Execute prelaunch commands if defined
    if (agent.prelaunchCommands) {
        setTimeout(() => {
            try {
                const commands = agent.prelaunchCommands!.split('\n').filter(cmd => cmd.trim().length > 0);
                commands.forEach((cmd, idx) => {
                    setTimeout(() => {
                        ptyProcess.write(cmd.trim() + '\r');
                    }, idx * 200);
                });
            } catch (e) { }
        }, 500);
    }

    // Then start the agent CLI
    const cmd = [agent.command, ...(agent.args || [])];
    if (cmd.length > 0) {
        const delay = agent.prelaunchCommands ? 5000 : 1500; // Wait longer if prelaunch exists
        setTimeout(() => {
            try { ptyProcess.write(cmd.join(' ') + '\r'); } catch (e) { }
        }, delay);
    }

    return ptyProcess;
}

// === Socket Connections ===
io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    // Initial spawn
    ['term1', 'term2', 'term3', 'term4'].forEach(termId => {
        spawnTerminal(termId, socket);
    });

    socket.on('term:input', (data: { termId: string, input: string }) => {
        const pty = ptyProcesses.get(data.termId);
        if (pty) pty.write(data.input);
    });

    socket.on('term:resize', (data: { termId: string, cols: number, rows: number }) => {
        const pty = ptyProcesses.get(data.termId);
        if (pty) pty.resize(data.cols, data.rows);
    });

    // Handle manual re-spawn from client
    socket.on('term:respawn', (data: { termId: string }) => {
        spawnTerminal(data.termId, socket);
    });

    socket.on('disconnect', () => {
        console.log('[Socket] Client disconnected');
        ptyProcesses.forEach((p) => p.kill());
        ptyProcesses.clear();
    });
});

// === REST API ===
app.get('/api/config', (req, res) => {
    res.json(configManager.getConfig());
});

app.post('/api/config', (req, res) => {
    configManager.saveConfig(req.body);
    updateCoordination();
    res.json({ success: true });
});

app.post('/api/initialize-instructions', (req, res) => {
    const config = configManager.getConfig();
    const workspace = config.workspaceDir;

    if (!workspace || !fs.existsSync(workspace)) {
        return res.status(400).json({ error: 'Invalid workspace directory' });
    }

    try {
        config.agents.forEach(agent => {
            if (agent.instructionFile) {
                const filePath = path.join(workspace, agent.instructionFile);
                const content = `# SHARED WORKSPACE PROTOCOL\n${config.workspaceInstructions || ''}\n\n# YOUR ASSIGNED ROLE\n${agent.role || 'General Assistant'}\n`;

                // Ensure directory exists if instruction file is in a subfolder (like .clinerules)
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`[INIT] Wrote instructions to ${filePath}`);
            }
        });
        res.json({ success: true, message: 'Agent instructions initialized.' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/init', async (req, res) => {
    const { projectPath, context } = req.body;
    const targetDir = projectPath ? path.resolve(projectPath) : process.cwd();
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const specs = [
        { name: "SPEC.md", content: `# Project Specifications\n> "The living document of truth"\n\n## Core Requirements\n- Created: ${new Date().toISOString()}\n- Context: ${context || 'Initial Setup'}\n\n## Iterative Log\n[x] Initialized Project Structure\n` },
        { name: "MISTAKES.md", content: `# Mistake Ledger\n> "Fail fast, learn faster"\n\n## Critical Errors to Avoid\n- [Example] Don't edit generated files manually without documenting it.\n` },
        { name: "DEVLOG.md", content: `# Development Log\n> "Context is king"\n\n## ${new Date().toISOString().split('T')[0]} - Initialization\n- [SYSTEM] Project scaffolded by Chronos.\n` }
    ];

    try {
        specs.forEach(file => {
            const p = path.join(targetDir, file.name);
            if (!fs.existsSync(p)) fs.writeFileSync(p, file.content);
        });
        res.json({ success: true, message: 'Project initialized.' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/missions', (req, res) => {
    if (!fs.existsSync(MISSIONS_DIR)) return res.json([]);
    const files = fs.readdirSync(MISSIONS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    res.json(files);
});

app.post('/api/run', async (req, res) => {
    const { filename } = req.body;
    const filePath = path.join(MISSIONS_DIR, filename);
    try {
        const yaml = require('yaml');
        const content = fs.readFileSync(filePath, 'utf8');
        const mission = yaml.parse(content);
        engine.runMission(mission).catch(e => console.error(e));
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/terminals', (req, res) => {
    res.json(Array.from(ptyProcesses.keys()));
});

app.post('/api/terminal/input', (req, res) => {
    const { termId, command } = req.body;
    const ptyProcess = ptyProcesses.get(termId);
    if (!ptyProcess) {
        return res.status(404).json({ error: 'Terminal not found' });
    }
    ptyProcess.write(command);
    res.json({ success: true });
});

app.get('/api/terminal/output/:termId', (req, res) => {
    const { termId } = req.params;
    const output = terminalBuffers.get(termId) || '';
    res.json({ output });
});

app.post('/api/terminal/clear', (req, res) => {
    const { termId } = req.body;
    terminalBuffers.set(termId, '');
    res.json({ success: true });
});

httpServer.listen(port, () => {
    console.log(`\n🕐 Chronos PTY Server on port ${port}`);
});
