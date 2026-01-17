#!/usr/bin/env node
/**
 * API Server for Dashboard Integration
 * Provides HTTP/Socket.io interface for Manager
 */
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Import ManagerCLI
let manager = null;
let managerReady = false;

async function startManager() {
  const { ManagerCLI } = await import('./manager-cli.js');
  manager = new ManagerCLI();
  await manager.init();
  managerReady = true;
  console.log('[Manager] Initialized and ready');
}

startManager().catch(err => {
  console.error('[Manager] Failed to initialize:', err);
});

// API Endpoints

app.get('/api/status', (req, res) => {
  if (!managerReady || !manager) {
    return res.json({ ready: false });
  }

  const activeTask = manager.taskEngine.activeTask ?
    manager.taskEngine.tasks.get(manager.taskEngine.activeTask) : null;

  res.json({
    ready: true,
    kb: manager.kb.getStats(),
    queue: {
      ...manager.taskEngine.getQueueStatus(),
      tasks: Array.from(manager.taskEngine.tasks.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20) // Last 20 tasks
    },
    activeTask,
    autoMode: manager.autoOrchestrate,
    agents: Array.from(manager.agents.entries()).map(([id, cfg]) => ({ id, ...cfg }))
  });
});

app.post('/api/notes', async (req, res) => {
  if (!managerReady) {
    return res.status(503).json({ error: 'Manager not ready' });
  }

  try {
    const { content, frontmatter = {} } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    const note = await manager.kb.addNote(content, frontmatter);

    // Optionally auto-decompose
    let tasks = [];
    if (frontmatter.autoDecompose !== false) {
      tasks = await manager.taskEngine.noteToTasks(note);
    }

    broadcastStatus();

    res.json({ note, tasks });

  } catch (err) {
    console.error('[API] /api/notes error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notes', (req, res) => {
  if (!managerReady) return res.json({ ready: false });

  const notes = Array.from(manager.kb.notes.values())
    .sort((a, b) => b.created - a.created);

  res.json(notes);
});

app.get('/api/notes/:id', (req, res) => {
  if (!managerReady) return res.json({ ready: false });

  const note = manager.kb.notes.get(req.params.id);

  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  const tasks = manager.taskEngine.getTasksByNote(req.params.id);

  res.json({ note, tasks });
});

app.post('/api/notes/:id/decompose', async (req, res) => {
  if (!managerReady) {
    return res.status(503).json({ error: 'Manager not ready' });
  }

  try {
    const tasks = await manager.decomposeNote(req.params.id);
    broadcastStatus();
    res.json({ tasks });
  } catch (err) {
    console.error('[API] decompose error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orchestrate', async (req, res) => {
  if (!managerReady) {
    return res.status(503).json({ error: 'Manager not ready' });
  }

  try {
    await manager.orchestrateNext();
    broadcastStatus();
    res.json({ success: true });
  } catch (err) {
    console.error('[API] orchestrate error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orchestrate/auto', (req, res) => {
  if (!managerReady) {
    return res.status(503).json({ error: 'Manager not ready' });
  }

  manager.toggleAutoOrchestration();
  broadcastStatus();

  res.json({ autoMode: manager.autoOrchestrate });
});

app.get('/api/projects', (req, res) => {
  if (!managerReady) return res.json({ ready: false });

  const projects = Array.from(manager.kb.projects.values());
  res.json(projects);
});

app.get('/api/agents', (req, res) => {
  if (!managerReady) return res.json({ ready: false });

  const agents = Array.from(manager.agents.entries())
    .map(([id, cfg]) => ({ id, ...cfg }));

  res.json(agents);
});

app.get('/api/agents/:id', async (req, res) => {
  if (!managerReady) return res.json({ ready: false });

  const agent = await manager.kb.getAgentInstructions(req.params.id);

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json(agent);
});

app.put('/api/agents/:id', async (req, res) => {
  if (!managerReady) {
    return res.status(503).json({ error: 'Manager not ready' });
  }

  try {
    const updates = req.body;
    const agent = await manager.kb.updateAgentInstructions(req.params.id, updates);
    res.json(agent);
  } catch (err) {
    console.error('[API] update agent error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  if (!managerReady) return res.json({ ready: false });

  const tasks = Array.from(manager.taskEngine.tasks.values());
  const avgDuration = tasks
    .filter(t => t.actualDuration)
    .reduce((sum, t) => sum + t.actualDuration, 0) /
    (tasks.filter(t => t.actualDuration).length || 1);

  res.json({
    kb: manager.kb.getStats(),
    queue: manager.taskEngine.getQueueStatus(),
    avgDuration,
    uptime: process.uptime()
  });
});

// Status broadcast helper
function broadcastStatus() {
  if (!managerReady) return;

  const activeTask = manager.taskEngine.activeTask ?
    manager.taskEngine.tasks.get(manager.taskEngine.activeTask) : null;

  const status = {
    kb: manager.kb.getStats(),
    queue: {
      ...manager.taskEngine.getQueueStatus(),
      tasks: Array.from(manager.taskEngine.tasks.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20)
    },
    activeTask,
    autoMode: manager.autoOrchestrate
  };

  io.emit('status-update', status);
}

// Periodic status broadcasts
setInterval(broadcastStatus, 5000); // Every 5 seconds

// Socket.io
io.on('connection', (socket) => {
  console.log(`[Dashboard] Connected: ${socket.id}`);

  // Send initial status
  if (managerReady) {
    const activeTask = manager.taskEngine.activeTask ?
      manager.taskEngine.tasks.get(manager.taskEngine.activeTask) : null;

    socket.emit('status-update', {
      kb: manager.kb.getStats(),
      queue: manager.taskEngine.getQueueStatus(),
      activeTask,
      autoMode: manager.autoOrchestrate
    });
  }

  socket.on('disconnect', () => {
    console.log(`[Dashboard] Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.MANAGER_PORT || 8081;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Manager API] Server running on http://localhost:${PORT}`);
  console.log('[Manager API] Socket.io connected');
  console.log(`[Manager API] Check http://localhost:${PORT}/api/status for health`);
});
