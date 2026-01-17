# Swarm Manager - Installation & Integration Guide

## Overview

This guide walks through installing and integrating Swarm Manager with your existing Chronos system.

## Prerequisites

- Node.js 18+ 
- Existing Chronos dashboard at `D:\GitHub\Scripts\`
- Your agent CLIs configured and working

## Installation

### 1. Install Dependencies

```bash
cd D:\GitHub\Scripts\swarm-manager
npm install
```

Expected output:
```
added 243 packages, and audited 244 packages
```

### 2. Verify Installation

```bash
cd D:\GitHub\Scripts\swarm-manager
node test/test.js
```

All tests should pass with green checkmarks.

## Integration with Chronos

### Step 1: Add Manager Panel to Dashboard

#### Option A: Copy Component to Existing Dashboard

```bash
# Copy the React component
cp D:\GitHub\Scripts\swarm-manager\ManagerPanel.jsx D:\GitHub\Scripts\dashboard\src\components\ManagerPanel.jsx
```

#### Option B: Use Inline Component

The component code is in `swarm-manager/dashboard-integration.js` - paste it into your dashboard.

### Step 2: Import in Dashboard

Edit `D:\GitHub\Scripts\dashboard\src\App.jsx` (or equivalent main component):

```jsx
import ManagerPanel from './components/ManagerPanel';

// In your component's JSX:
<ManagerPanel />
```

### Step 3: Update Chronos.js

Edit `D:\GitHub\Scripts\Chronos.js` to auto-start the manager API:

```javascript
// Find where PTY server is spawned and add:

// Start Manager API Server
const managerServer = spawn('node', ['swarm-manager/api-server.js'], {
  cwd: SCRIPT_DIR,
  shell: true
});

managerServer.stdout.on('data', (data) => {
  console.log('[Manager]', data.toString());
});

managerServer.on('close', (code) => {
  console.log(`[Manager] exited with code ${code}`);
});

// Add to your cleanup function along with PTY server
```

### Step 4: Run and Test

```bash
# Start Chronos (which now starts both PTY and Manager servers)
node Chronos.js

# Or start manager standalone:
cd D:\GitHub\Scripts\swarm-manager
node api-server.js
```

You should see:
```
[Manager API] Server running on http://localhost:8081
[Manager API] Socket.io connected
[Manager API] Check http://localhost:8081/api/status for health
[Manager] Initialized and ready
```

Open your dashboard - you should see a new "🐝 Swarm Manager" panel.

## Quick Start

### Using the CLI

```bash
cd D:\GitHub\Scripts\swarm-manager
node index.js
```

Example session:

```
swarm> note Add user authentication #auth @feature
✓ Note added: add-user-authentication-abc123
   ID: add-user-authentication-abc123 | Project: auth | Tags: feature

Decompose into tasks now? (y/n): y

Decomposing note: Add user authentication
✓ Created 4 tasks

1. research: Research: Add user authentication
   Phase: research | Agent: researcher
2. planning: Plan: Add user authentication
   Phase: planning | Agent: planner
3. execution: Implement core functionality
   Phase: execute | Agent: executor
4. review: Review: Add user authentication
   Phase: review | Agent: reviewer

Ready to orchestrate. Type "orchestrate" to execute next task.

swarm> orchestrate

╔════════════════════════════════════════════╗
║  EXECUTING TASK                              ║
╚════════════════════════════════════════════╝

Research: Add user authentication
ID: RES-ABC123
Type: research | Agent: researcher
Estimated: 5 minutes

✓ Assigned to: claude
Launching sandbox...

... (agent executes task)
```

### Using the Dashboard

1. Open Chronos dashboard
2. Find the Swarm Manager panel
3. Type in the input: `Add user authentication #auth @feature`
4. Press Enter
5. Click "Orchestrate" or enable "Auto: ON"

## Manual Testing

### Test 1: Add Note via API

```bash
curl -X POST http://localhost:8081/api/notes \
  -H "Content-Type: application/json" \
  -d '{"content": "Test task via API #demo @test"}'
```

### Test 2: Check Status

```bash
curl http://localhost:8081/api/status
```

### Test 3: Trigger Orchestration

```bash
curl -X POST http://localhost:8081/api/orchestrate
```

### Test 4: View Queue

```bash
curl http://localhost:8081/api/notes
```

## Configuration

The manager can be configured via `config.yaml`:

```yaml
manager:
  autoOrchestrate: false      # Enable auto-execution
  pollInterval: 30000        # Check every 30 seconds
  maxConcurrent: 1           # Run tasks serially

knowledge_base:
  notes_dir: "./kb/notes"
  projects_dir: "./kb/projects"

sandbox:
  base_dir: "./sandboxes"
  cleanup_after_hours: 24
```

## Directory Structure After Setup

```
D:\GitHub\Scripts\
├── Chronos.js                    # Modified to start manager
├── swarm-manager/
│   ├── index.js                  # CLI entry point
│   ├── manager-cli.js            # Interactive CLI
│   ├── api-server.js             # Dashboard API
│   ├── knowledge-base.js         # KB system
│   ├── task-engine.js           # Task decomposition
│   ├── agent-sandbox.js         # Sandbox management
│   ├── config.yaml              # Configuration
│   ├── kb/                     # Knowledge base
│   │   ├── notes/              # User notes
│   │   ├── projects/           # Auto-generated projects
│   │   └── agents/             # Agent instructions
│   ├── sandboxes/              # Agent execution environments
│   └── test/
│       └── test.js             # Test suite
└── dashboard/
    └── src/
        └── components/
            └── ManagerPanel.jsx # NEW: Manager UI
```

## Troubleshooting

### Manager API won't start

```bash
# Check port availability
netstat -ano | findstr :8081

# Change port if needed
# Edit swarm-manager/api-server.js line ~245:
# const PORT = process.env.MANAGER_PORT || 8082;
```

### Dashboard shows "Not Connected"

1. Verify manager server is running:
   ```bash
   curl http://localhost:8081/api/status
   ```

2. Check browser console for errors (F12)

3. Verify CORS in api-server.js:
   ```bash
   curl -X OPTIONS http://localhost:8081/api/status -H "Origin: http://localhost:5173" -v
   ```

### Tasks stuck in "pending"

- Check if dependencies are complete
- Verify an agent is available
- Check logs: `node index.js` → `logs <sandbox-id>`

### Agents not found

Edit `config.yaml` to match your Chronos agent mappings:

```yaml
agents:
  researcher: claude      # Map "researcher" → "claude" (chronos_config.yaml)
  planner: claude
  executor: codex
```

## Next Steps

1. ✅ Install dependencies: `cd swarm-manager && npm install`
2. ✅ Run tests: `node test/test.js`
3. ✅ Add ManagerPanel to dashboard
4. ✅ Update Chronos.js to start manager API
5. ✅ Test with a simple note
6. ✅ Enable auto-orchestrate for unattended operation

## Advanced Usage

See `README.md` for:
- Self-modifying agent instructions
- Custom task templates
- Multi-project workflows
- Advanced verification checklists
- API documentation
- Best practices
