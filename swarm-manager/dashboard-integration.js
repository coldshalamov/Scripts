/**
 * Dashboard Manager Integration
 * Add manager panel to existing Chronos dashboard
 */

export const DashboardIntegration = {
  /**
   * React Component: Manager Panel
   * Add this to dashboard/src/components/ManagerPanel.jsx
   */
  componentCode: `
import React, { useState, useEffect } from 'react';

export default function ManagerPanel() {
  const [kbStats, setKbStats] = useState(null);
  const [queue, setQueue] = useState(null);
  const [notes, setNotes] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [autoMode, setAutoMode] = useState(false);

  useEffect(() => {
    // Poll for updates from manager API
    const interval = setInterval(fetchStatus, 3000);
    fetchStatus();
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      // In real implementation, this calls manager API via WebSocket or HTTP
      const response = await fetch('http://localhost:8081/api/status');
      const data = await response.json();

      setKbStats(data.kb);
      setQueue(data.queue);
      setActiveTask(data.activeTask);
      setAutoMode(data.autoMode);
    } catch (err) {
      console.error('Failed to fetch manager status:', err);
    }
  }

  async function handleAddNote(content) {
    await fetch('http://localhost:8081/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    fetchStatus();
  }

  async function triggerOrchestrate() {
    await fetch('http://localhost:8081/api/orchestrate', { method: 'POST' });
    fetchStatus();
  }

  return (
    <div className="manager-panel" style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0' }}>🐝 Swarm Manager</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setAutoMode(!autoMode)}
            style={{
              padding: '8px 16px',
              background: autoMode ? '#22c55e' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {autoMode ? 'Auto: ON' : 'Auto: OFF'}
          </button>
          <button
            onClick={triggerOrchestrate}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Orchestrate Next
          </button>
        </div>
      </div>

      {/* Quick Add Note */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Add note... (supports #project @tags)"
          style={{
            width: '100%',
            padding: '8px',
            boxSizing: 'border-box',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            marginBottom: '8px'
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
              handleAddNote(e.target.value);
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
            {kbStats?.notes || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Notes</div>
        </div>
        <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
            {queue?.completed || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Tasks Done</div>
        </div>
        <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
            {queue?.pending || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Pending</div>
        </div>
      </div>

      {/* Active Task */}
      {activeTask && (
        <div style={{
          padding: '12px',
          background: '#dbeafe',
          border: '1px solid #93c5fd',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            Active: {activeTask.title}
          </div>
          <div style={{ fontSize: '12px', color: '#1e40af' }}>
            {activeTask.agentType} · {activeTask.type}
          </div>
        </div>
      )}

      {/* Task Queue */}
      <div>
        <h3 style={{ fontSize: '16px', margin: '0 0 8px 0' }}>Task Queue</h3>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {queue?.tasks?.map(task => (
            <div
              key={task.id}
              style={{
                padding: '8px',
                borderBottom: '1px solid #e5e7eb',
                fontSize: '13px'
              }}
            >
              <span style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                background: task.status === 'completed' ? '#dcfce7' :
                           task.status === 'failed' ? '#fee2e2' :
                           task.status === 'in_progress' ? '#dbeafe' : '#f3f4f6',
                color: task.status === 'completed' ? '#166534' :
                       task.status === 'failed' ? '#991b1b' :
                       task.status === 'in_progress' ? '#1e40af' : '#4b5563'
              }}>
                {task.status.toUpperCase()}
              </span>
              {' '}
              {task.title}
            </div>
          )) || <div style={{ color: '#9ca3af', fontSize: '12px' }}>No tasks</div>}
        </div>
      </div>
    </div>
  );
}
  `.trim(),

  /**
   * Socket.io Server Integration for Manager API
   * Add to dashboard/pty-server.js or create standalone server
   */
  serverCode: `
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ManagerCLI } from './swarm-manager/manager-cli.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

// Start Manager CLI instance
const manager = new ManagerCLI();
await manager.init();

// API Endpoints
app.use(express.json());

app.get('/api/status', (req, res) => {
  res.json({
    kb: manager.kb.getStats(),
    queue: manager.taskEngine.getQueueStatus(),
    activeTask: manager.taskEngine.activeTask ?
      manager.taskEngine.tasks.get(manager.taskEngine.activeTask) : null,
    autoMode: manager.autoOrchestrate
  });
});

app.post('/api/notes', async (req, res) => {
  const { content } = req.body;
  const note = await manager.kb.addNote(content);
  manager.taskEngine.noteToTasks(note);
  io.emit('update', manager.getStatus());
  res.json(note);
});

app.post('/api/orchestrate', async (req, res) => {
  await manager.orchestrateNext();
  io.emit('update', manager.getStatus());
  res.json({ success: true });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Dashboard connected to Manager');
  socket.emit('update', manager.getStatus());
});

const PORT = 8081;
server.listen(PORT, () => {
  console.log(\`Manager API server running on port \${PORT}\`);
});
  `.trim(),

  /**
   * Integration instructions
   */
  instructions: `
To integrate the Swarm Manager into your Chronos dashboard:

1. Create the ManagerPanel component:
   - Copy the React component code to: dashboard/src/components/ManagerPanel.jsx

2. Add ManagerPanel to your main dashboard layout:
   - Import in dashboard/src/App.jsx or wherever your main component is
   - Add <ManagerPanel /> to your layout

3. Start the Manager API server:
   - Create dashboard/manager-server.js with the server code
   - Run: node dashboard/manager-server.js
   - This runs on port 8081 (separate from PTY on 3000)

4. Update Chronos.js to auto-start manager-server:
   - Add manager server spawn alongside PTY server
   - Use the same process management

5. The panel shows:
   - Quick note input with #project and @tags support
   - Auto-orchestration toggle
   - Manual orchestrate button
   - Knowledge base stats
   - Task queue status
   - Active task display
  `.trim()
};

export default DashboardIntegration;
