import React, { useState, useEffect } from 'react';

export default function ManagerPanel() {
  const [kbStats, setKbStats] = useState(null);
  const [queue, setQueue] = useState(null);
  const [notes, setNotes] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [autoMode, setAutoMode] = useState(false);
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);

  // Note input
  const [noteInput, setNoteInput] = useState('');

  // Socket connection
  useEffect(() => {
    const socket = io('http://localhost:8081');

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      console.log('[Manager Panel] Connected to server');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('[Manager Panel] Disconnected from server');
    });

    socket.on('status-update', (data) => {
      setKbStats(data.kb);
      setQueue(data.queue);
      setActiveTask(data.activeTask);
      setAutoMode(data.autoMode);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!connected) {
      fetchStatus();
    }
  }, []);

  async function fetchStatus() {
    try {
      const response = await fetch('http://localhost:8081/api/status');
      const data = await response.json();

      setConnected(data.ready || false);
      setKbStats(data.kb);
      setQueue(data.queue);
      setActiveTask(data.activeTask);
      setAutoMode(data.autoMode);
      setAgents(data.agents || []);

      setError(null);
    } catch (err) {
      setError(err.message);
      setConnected(false);
    }
  }

  async function handleAddNote() {
    if (!noteInput.trim()) return;

    try {
      const response = await fetch('http://localhost:8081/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteInput })
      });

      if (!response.ok) {
        throw new Error('Failed to add note');
      }

      const data = await response.json();
      console.log('[Manager Panel] Note added:', data.note.id);

      setNoteInput('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function triggerOrchestrate() {
    try {
      const response = await fetch('http://localhost:8081/api/orchestrate', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to orchestrate');
      }

      console.log('[Manager Panel] Orchestrate triggered');

      // Refresh after a short delay
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleAutoMode() {
    try {
      const response = await fetch('http://localhost:8081/api/orchestrate/auto', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to toggle auto mode');
      }

      const data = await response.json();
      setAutoMode(data.autoMode);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!connected && !kbStats) {
    return (
      <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fef2f2' }}>
        <div style={{ color: '#dc2626', fontWeight: 'bold' }}>
          Not Connected
        </div>
        <div style={{ color: '#991b1b', fontSize: '12px', marginTop: '4px' }}>
          Start manager API server: node swarm-manager/api-server.js
        </div>
      </div>
    );
  }

  return (
    <div className="manager-panel" style={{
      padding: '16px',
      background: 'white',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>🐝 Swarm Manager</h2>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {connected ?
              <span style={{ color: '#16a34a' }}>● Connected</span> :
              <span style={{ color: '#dc2626' }}>● Disconnected</span>
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={toggleAutoMode}
            style={{
              padding: '8px 16px',
              background: autoMode ? '#22c55e' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
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
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Orchestrate
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          padding: '8px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          color: '#991b1b',
          fontSize: '12px',
          marginBottom: '12px'
        }}>
          {error}
        </div>
      )}

      {/* Quick Add Note */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>
          Add Note
        </div>
        <input
          type="text"
          placeholder="Add task with #project @tags..."
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && noteInput.trim()) {
              handleAddNote();
            }
          }}
          style={{
            width: '100%',
            padding: '10px',
            boxSizing: 'border-box',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
        />
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          Use <span style={{ background: '#e5e7eb', padding: '2px 4px', borderRadius: '3px' }}>#project</span> and <span style={{ background: '#e5e7eb', padding: '2px 4px', borderRadius: '3px' }}>@tags</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px',
        marginBottom: '16px'
      }}>
        <div style={{
          padding: '12px',
          background: '#f3f4f6',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#3b82f6',
            lineHeight: '1.2'
          }}>
            {kbStats?.notes || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            Notes
          </div>
        </div>
        <div style={{
          padding: '12px',
          background: '#f3f4f6',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#22c55e',
            lineHeight: '1.2'
          }}>
            {kbStats?.completed || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            Done
          </div>
        </div>
        <div style={{
          padding: '12px',
          background: '#f3f4f6',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#f59e0b',
            lineHeight: '1.2'
          }}>
            {queue?.pending || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            Pending
          </div>
        </div>
        <div style={{
          padding: '12px',
          background: '#f3f4f6',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#8b5cf6',
            lineHeight: '1.2'
          }}>
            {agents.length}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            Agents
          </div>
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
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div style={{ flex: 1, marginRight: '12px' }}>
              <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e40af', marginBottom: '2px' }}>
                ⚡ Active: {activeTask.title}
              </div>
              <div style={{ fontSize: '11px', color: '#3b82f6' }}>
                {activeTask.agentType} · {activeTask.type} · ~{activeTask.estimatedDuration}min
              </div>
            </div>
            <div style={{
              padding: '2px 8px',
              background: 'white',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#3b82f6',
              fontWeight: '500'
            }}>
              {activeTask.id}
            </div>
          </div>
        </div>
      )}

      {/* Task Queue */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
          Task Queue
        </div>
        <div style={{
          maxHeight: '250px',
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          background: '#fafafa'
        }}>
          {queue?.tasks && queue.tasks.length > 0 ? (
            queue.tasks.slice(0, 10).map((task) => (
              <div
                key={task.id}
                style={{
                  padding: '8px 10px',
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: '600',
                  minWidth: '55px',
                  textAlign: 'center',
                  background: task.status === 'completed' ? '#dcfce7' :
                             task.status === 'failed' ? '#fee2e2' :
                             task.status === 'in_progress' ? '#dbeafe' : '#f3f4f6',
                  color: task.status === 'completed' ? '#166534' :
                         task.status === 'failed' ? '#991b1b' :
                         task.status === 'in_progress' ? '#1e40af' : '#4b5563'
                }}>
                  {task.status.toUpperCase()}
                </span>
                <span style={{ flex: 1, color: '#374151' }}>
                  {task.title}
                </span>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                  {task.type}
                </span>
              </div>
            ))
          ) : (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '12px'
            }}>
              No tasks in queue
            </div>
          )}
        </div>
        {queue?.tasks && queue.tasks.length > 10 && (
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            Showing 10 of {queue.tasks.length} tasks
          </div>
        )}
      </div>
    </div>
  );
}
