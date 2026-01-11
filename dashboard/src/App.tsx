import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';
import './App.css';
import { PromptLibraryView } from './PromptLibrary';

const TERM_IDS = ['term1', 'term2', 'term3', 'term4'];

declare global {
  interface Window {
    electron: {
      selectDirectory: () => Promise<string | null>;
      close: () => Promise<void>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
    };
  }
}

interface PromptBlock {
  id: string;
  name: string;
  content: string;
  scope: 'global' | 'workspace';
}

interface ComposablePrompt {
  id: string;
  name: string;
  blockIds: string[];
  scope: 'global' | 'workspace';
}

interface TemporalChainStep {
  id: string;
  promptId: string;
  terminalId: string;
  delaySeconds: number;
}

interface TemporalChain {
  id: string;
  name: string;
  steps: TemporalChainStep[];
  scope: 'global' | 'workspace';
}

interface PromptLibrary {
  blocks: PromptBlock[];
  prompts: ComposablePrompt[];
  chains: TemporalChain[];
}

interface AgentConfig {
  name: string;
  command: string;
  args?: string[];
  type: string;
  instructionFile?: string;
  role?: string;
  prelaunchCommands?: string;
}

interface SystemConfig {
  agents: AgentConfig[];
  termMapping: Record<string, string | null>;
  workspaceDir?: string;
  workspaceInstructions?: string;
  promptLibrary?: PromptLibrary;
}

function App() {
  const [missions, setMissions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('TERMINAL');
  const [focusedTerm, setFocusedTerm] = useState<string | null>('term1');
  const [maximizedTerm, setMaximizedTerm] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [config, setConfig] = useState<SystemConfig>({ agents: [], termMapping: {}, workspaceDir: '', workspaceInstructions: '' });
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const socketRef = useRef<Socket | null>(null);
  const terminalsRegistry = useRef<Map<string, { term: Terminal, fit: FitAddon, search: SearchAddon }>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);

  const termRefs = {
    term1: useRef<HTMLDivElement>(null),
    term2: useRef<HTMLDivElement>(null),
    term3: useRef<HTMLDivElement>(null),
    term4: useRef<HTMLDivElement>(null),
  };

  const API_URL = 'http://localhost:3000/api';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Initial stable setup (runs once)
  useEffect(() => {
    fetchMissions();
    fetchConfig();
    const socket = io('http://localhost:3000');
    socketRef.current = socket;

    TERM_IDS.forEach((id) => {
      const ref = termRefs[id as keyof typeof termRefs];
      if (!ref.current) return;

      const term = new Terminal({
        theme: {
          background: '#000000',
          foreground: '#00f3ff',
          cursor: '#00f3ff',
          selectionBackground: 'rgba(0, 243, 255, 0.3)',
          black: '#1a1a1a',
          red: '#ff0055',
          green: '#00ffaa',
          yellow: '#fbff00',
          blue: '#7000ff',
          magenta: '#ff00ff',
          cyan: '#00f3ff',
          white: '#e2e2e9'
        },
        fontSize: 13,
        fontFamily: '"JetBrains Mono", monospace',
        cursorBlink: true,
        allowTransparency: true,
        convertEol: true,
        letterSpacing: 0.5,
        lineHeight: 1.2
      });

      const fitAddon = new FitAddon();
      const searchAddon = new SearchAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(searchAddon);
      term.open(ref.current);

      terminalsRegistry.current.set(id, { term, fit: fitAddon, search: searchAddon });

      term.attachCustomKeyEventHandler((e) => {
        // Ctrl + C to Copy
        if (e.ctrlKey && e.key === 'c' && term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection());
          return false;
        }
        // Ctrl + V to Paste
        if (e.ctrlKey && e.key === 'v') {
          navigator.clipboard.readText().then(text => {
            socket.emit('term:input', { termId: id, input: text });
          });
          return false;
        }
        // Ctrl + F to Find
        if (e.ctrlKey && e.key === 'f') {
          searchAddon.showSearchAddon(); // Note: SearchAddon doesn't have a built-in UI, it's just the logic.
          // We might need to implement a simple prompt or just use the addon logic.
          const termToSearch = prompt('Search term:');
          if (termToSearch) {
            searchAddon.findNext(termToSearch);
          }
          return false;
        }
        // Allow Tab and Shift+Tab to bubble up to the global listener for pane switching
        if (e.key === 'Tab') {
          return false;
        }
        return true;
      });

      socket.on(`term:${id}:data`, (data: string) => term.write(data));
      term.onData((data) => socket.emit('term:input', { termId: id, input: data }));
    });

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(() => {
        terminalsRegistry.current.forEach(({ term, fit }, id) => {
          try {
            fit.fit();
            socket.emit('term:resize', { termId: id, cols: term.cols, rows: term.rows });
          } catch (e) { }
        });
      }, 50);
    });
    if (gridRef.current) resizeObserver.observe(gridRef.current);

    return () => {
      socket.disconnect();
      terminalsRegistry.current.forEach(({ term }) => term.dispose());
      resizeObserver.disconnect();
    };
  }, []);

  // 2. Focused terminal keyboard listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Tab or Ctrl + T to cycle Focused Terminal
      if ((e.key === 'Tab' && !e.shiftKey) || (e.ctrlKey && e.key === 't')) {
        e.preventDefault();
        const nextId = TERM_IDS[(TERM_IDS.indexOf(focusedTerm || 'term1') + 1) % TERM_IDS.length];
        setFocusedTerm(nextId);
        terminalsRegistry.current.get(nextId)?.term.focus();
      }

      // Shift + Tab to cycle focus backward
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        const currentIndex = TERM_IDS.indexOf(focusedTerm || 'term1');
        const prevId = TERM_IDS[(currentIndex - 1 + TERM_IDS.length) % TERM_IDS.length];
        setFocusedTerm(prevId);
        terminalsRegistry.current.get(prevId)?.term.focus();
      }

      // Alt + Enter to Fullscreen (Maximize Focused Terminal)
      if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        if (focusedTerm) {
          setMaximizedTerm(maximizedTerm === focusedTerm ? null : focusedTerm);
        }
      }

      // Shift + Esc to Kill Process (Send Ctrl+C interrupt)
      if (e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        if (focusedTerm) {
          socketRef.current?.emit('term:input', { termId: focusedTerm, input: '\x03' });
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [focusedTerm, maximizedTerm]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/config`);
      const data = await res.json();
      setConfig(data);
    } catch (e) { }
  };

  const saveConfig = async (newConfig: SystemConfig) => {
    await fetch(`${API_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    setConfig(newConfig);
  };

  const fetchMissions = async () => {
    try {
      const res = await fetch(`${API_URL}/missions`);
      const data = await res.json();
      setMissions(data || []);
    } catch (e) { }
  };

  const triggerRespawn = (termId: string) => {
    socketRef.current?.emit('term:respawn', { termId });
  };

  const updateMapping = (termId: string, agentName: string | null) => {
    const newMapping = { ...config.termMapping, [termId]: agentName };
    const newConfig = { ...config, termMapping: newMapping };
    saveConfig(newConfig);
    triggerRespawn(termId);
  };

  const handleSelectWorkspace = async () => {
    if (window.electron && window.electron.selectDirectory) {
      const path = await window.electron.selectDirectory();
      if (path) {
        const newConfig = { ...config, workspaceDir: path };
        saveConfig(newConfig);
        TERM_IDS.forEach(id => triggerRespawn(id));
      }
    }
  };

  const syncInstructions = async () => {
    const res = await fetch(`${API_URL}/initialize-instructions`, { method: 'POST' });
    const data = await res.json();
    alert(data.message || 'Error syncing instructions');
  };

  const handleExecuteChain = (chain: TemporalChain) => {
    chain.steps.forEach(step => {
      setTimeout(() => {
        const prompt = config.promptLibrary?.prompts.find(p => p.id === step.promptId);
        if (prompt) {
          const content = prompt.blockIds.map(blockId => {
            const block = config.promptLibrary?.blocks.find(b => b.id === blockId);
            return block ? block.content : '';
          }).join('\n\n');
          socketRef.current?.emit('term:input', { termId: step.terminalId, input: content + '\r' });
        }
      }, step.delaySeconds * 1000);
    });
    setActiveTab('TERMINAL');
  };

  const renderTerminal = (id: string, ref: React.RefObject<HTMLDivElement>) => {
    const isMaximized = maximizedTerm === id;
    const isHidden = maximizedTerm !== null && !isMaximized;
    const mappedAgentName = config.termMapping[id];

    return (
      <div
        className={`term-wrapper ${focusedTerm === id ? 'focused' : ''} ${isMaximized ? 'maximized' : ''}`}
        style={{ display: isHidden ? 'none' : 'flex' }}
        onClick={() => { setFocusedTerm(id); terminalsRegistry.current.get(id)?.term.focus(); }}
      >
        <div className="term-header">
          <span>{mappedAgentName ? mappedAgentName.toUpperCase() : 'SHELL'}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="term-btn" onClick={(e) => { e.stopPropagation(); triggerRespawn(id); }}>🔄</button>
            <button className="term-btn" onClick={(e) => { e.stopPropagation(); setMaximizedTerm(maximizedTerm === id ? null : id); }}>{isMaximized ? '↘' : '↗'}</button>
          </div>
        </div>
        <div ref={ref} className="xterm-container" />
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button
          type="button"
          className="sidebar-brand"
          aria-label={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <span className="brand-tile" aria-hidden="true">
            <img src="/assets/chronos_logo.png" className="brand-mark" alt="" />
          </span>
          <span className="brand-meta">
            <span className="brand-name">CHRONOS</span>
            <span className="brand-version">V.2.0 CORE</span>
          </span>
        </button>

        <div
          className={`nav-item ${activeTab === 'TERMINAL' ? 'active' : ''}`}
          onClick={() => setActiveTab('TERMINAL')}
          title={sidebarCollapsed ? 'LIVE COMMAND' : undefined}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
          <span>LIVE COMMAND</span>
        </div>

        <div
          className={`nav-item ${activeTab === 'DASHBOARD' ? 'active' : ''}`}
          onClick={() => setActiveTab('DASHBOARD')}
          title={sidebarCollapsed ? 'MISSION CONTROL' : undefined}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          <span>MISSION CONTROL</span>
        </div>

        <div
          className={`nav-item ${activeTab === 'LIBRARY' ? 'active' : ''}`}
          onClick={() => setActiveTab('LIBRARY')}
          title={sidebarCollapsed ? 'PROTOCOLS' : undefined}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          <span>PROTOCOLS</span>
        </div>

        <div className="sidebar-divider" />
        <div className="sidebar-heading">Active Missions</div>
        <div className="mission-list">
          {missions.map((m, i) => (
            <div key={i} className="mission-item" onClick={() => {
              if (confirm(`Execute tactical objective: ${m}?`)) {
                fetch(`${API_URL}/run`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename: m })
                });
                setActiveTab('TERMINAL');
              }
            }}>
              {m.replace('.yaml', '').replace('.yml', '').toUpperCase()}
            </div>
          ))}
          {missions.length === 0 && <div className="mission-item empty">Awaiting directives...</div>}
        </div>
      </div>

      <div className="main-content">
        {/* Stealth Window Controls */}
        <div style={{
          position: 'absolute',
          top: '0',
          right: '0',
          zIndex: 9999,
          display: 'flex'
        }}>
          <button
            onClick={() => window.electron?.close()}
            style={{
              background: 'rgba(255, 0, 0, 0.1)',
              border: 'none',
              color: '#ff4444',
              width: '40px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
              borderBottomLeftRadius: '8px'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ff0000'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 0, 0, 0.1)'; e.currentTarget.style.color = '#ff4444'; }}
          >
            ✕
          </button>
        </div>

        {/* Floating Search (Minimal) */}
        {!sidebarCollapsed && (
          <div style={{ position: 'absolute', top: '20px', left: '320px', zIndex: 100 }}>
            <input
              type="text"
              placeholder="CMD..."
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid var(--glass-border)',
                padding: '8px 15px',
                borderRadius: '4px',
                color: 'var(--primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                width: '200px',
                outline: 'none',
                backdropFilter: 'blur(5px)'
              }}
            />
          </div>
        )}

        {activeTab === 'DASHBOARD' && (
          <div className="config-section">
            <h1 style={{ marginBottom: '10px' }}>MISSION_CONTROL_CENTER</h1>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '40px' }}>
              <input className="mgmt-input" style={{ flex: 1, margin: 0 }} placeholder="Specify target workspace..." value={config.workspaceDir} onChange={e => saveConfig({ ...config, workspaceDir: e.target.value })} />
              <button className="mgmt-btn" onClick={handleSelectWorkspace}>ALIGN_PATH</button>
            </div>

            <div style={{ marginBottom: '60px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>GLOBAL_PROTOCOLS</h2>
                <button className="mgmt-btn" onClick={syncInstructions}>SYNC_TO_AGENTS</button>
              </div>
              <textarea
                className="mgmt-input"
                style={{ height: '150px', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.6', background: 'rgba(0,0,0,0.4)', color: 'var(--primary)' }}
                value={config.workspaceInstructions}
                onChange={e => setConfig({ ...config, workspaceInstructions: e.target.value })}
                onBlur={() => saveConfig(config)}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '10px', fontFamily: 'var(--font-mono)' }}>// INSTRUCTIONS ARE PREPENDED TO AGENT CONTROL FILES. SYNC TO PROPAGATE CHANGES.</p>
            </div>

            <h2 style={{ marginBottom: '30px' }}>SYSTEM_MOSAIC_MAPPING</h2>
            <div style={{ display: 'flex', gap: '60px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: '15px', display: 'block' }}>QUADRANT_STATUS</label>
                <div className="mini-mosaic">
                  {TERM_IDS.map(id => {
                    const current = config.termMapping[id];
                    const others = TERM_IDS.filter(tid => tid !== id).map(tid => config.termMapping[tid]);
                    const available = config.agents.filter(a => !others.includes(a.name));
                    const cycle = [null, ...available.map(a => a.name)];

                    return (
                      <div key={id} className={`mini-slot ${current ? 'mapped' : ''}`} onClick={() => {
                        const nextIdx = (cycle.indexOf(current as any) + 1) % cycle.length;
                        updateMapping(id, cycle[nextIdx]);
                      }}>
                        <span style={{ fontSize: '8px', opacity: 0.5, marginBottom: '2px' }}>{id.toUpperCase()}</span>
                        <b style={{ fontSize: '9px', color: current ? 'var(--primary)' : 'var(--text-dim)' }}>{current ? current.toUpperCase() : 'EMPTY'}</b>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: '15px', display: 'block' }}>TACTICAL_UNITS</label>
                  <button className="mgmt-btn" onClick={() => setEditingAgent({ name: 'new_unit', command: '', args: [], type: 'generic', instructionFile: 'PROTOCOL.md', role: 'General Intelligence' })}>INITIALIZE_UNIT</button>
                </div>

                <div className="agent-list">
                  {config.agents.map((agent, idx) => {
                    const assignedTerm = Object.entries(config.termMapping).find(([_, name]) => name === agent.name)?.[0];
                    return (
                      <div key={idx} className="agent-editor-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ color: 'var(--primary)', letterSpacing: '2px' }}>{agent.name.toUpperCase()}</h3>
                            {assignedTerm && (
                              <span style={{
                                background: 'rgba(0, 243, 255, 0.15)',
                                color: 'var(--primary)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--primary)',
                                fontSize: '9px',
                                fontWeight: 800
                              }}>
                                {assignedTerm.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="term-btn" onClick={() => setEditingAgent(agent)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                            </button>
                            <button className="term-btn" onClick={() => {
                              if (confirm(`DECOMMISSION UNIT: ${agent.name}?`)) {
                                const newAgents = config.agents.filter(a => a.name !== agent.name);
                                saveConfig({ ...config, agents: newAgents });
                              }
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '15px' }}>
                          <code style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>{agent.command} {agent.args?.join(' ')}</code><br />
                          <div style={{ marginTop: '10px' }}>
                            <span style={{ color: 'var(--primary)', opacity: 0.7 }}>Protocol:</span> <span style={{ color: '#fff' }}>{agent.instructionFile}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {editingAgent && (
              <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setEditingAgent(null)}>
                <div className="agent-editor-card" style={{ width: '500px', background: '#050510' }} onClick={e => e.stopPropagation()}>
                  <h2>EDIT AGENT</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label>Name</label>
                      <input className="mgmt-input" value={editingAgent.name} onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })} />
                    </div>
                    <div>
                      <label>Protocol File (e.g. CLAUDE.md)</label>
                      <input className="mgmt-input" value={editingAgent.instructionFile} onChange={e => setEditingAgent({ ...editingAgent, instructionFile: e.target.value })} />
                    </div>
                  </div>
                  <label>Base Command</label>
                  <input className="mgmt-input" value={editingAgent.command} onChange={e => setEditingAgent({ ...editingAgent, command: e.target.value })} />
                  <label>Args (comma separated)</label>
                  <input className="mgmt-input" value={editingAgent.args?.join(', ')} onChange={e => setEditingAgent({ ...editingAgent, args: e.target.value.split(',').map(s => s.trim()) })} />
                  <label>Prelaunch Commands (one per line, runs before agent starts)</label>
                  <textarea
                    className="mgmt-input"
                    style={{ height: '100px', fontFamily: 'monospace', fontSize: '11px' }}
                    placeholder={'start "MCP Gateway" powershell -NoExit -File "C:\\path\\to\\script.ps1"\ntimeout /t 15 /nobreak >nul'}
                    value={editingAgent.prelaunchCommands || ''}
                    onChange={e => setEditingAgent({ ...editingAgent, prelaunchCommands: e.target.value })}
                  />
                  <label>Specific Role Instructions</label>
                  <textarea className="mgmt-input" style={{ height: '80px' }} value={editingAgent.role} onChange={e => setEditingAgent({ ...editingAgent, role: e.target.value })} />

                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button className="mgmt-btn" style={{ flex: 1 }} onClick={() => {
                      const exists = config.agents.find(a => a.name === editingAgent.name);
                      const newAgents = exists ? config.agents.map(a => a.name === editingAgent.name ? editingAgent : a) : [...config.agents, editingAgent];
                      saveConfig({ ...config, agents: newAgents });
                      setEditingAgent(null);
                    }}>SAVE</button>
                    <button className="mgmt-btn" style={{ flex: 1, background: '#333' }} onClick={() => setEditingAgent(null)}>CANCEL</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'LIBRARY' && (
          <PromptLibraryView
            library={config.promptLibrary || { blocks: [], prompts: [], chains: [] }}
            onUpdate={(lib) => saveConfig({ ...config, promptLibrary: lib })}
            onExecuteChain={handleExecuteChain}
          />
        )}

        <div
          ref={gridRef}
          className={`mosaic-container ${maximizedTerm ? 'maximized-mode' : ''}`}
          style={{ display: activeTab === 'TERMINAL' ? 'grid' : 'none' }}
        >
          {renderTerminal('term1', termRefs.term1)}
          {renderTerminal('term2', termRefs.term2)}
          {renderTerminal('term3', termRefs.term3)}
          {renderTerminal('term4', termRefs.term4)}
        </div>
      </div>
    </div>
  );
}

export default App;
