# Swarm Manager

Hierarchical swarm management system for autonomous agent orchestration.

## Overview

The Swarm Manager provides:

1. **Knowledge Base** - Structured storage for notes, projects, and agent instructions
2. **Task Decomposition** - Converts user notes into research/plan/execute/review tasks
3. **Agent Sandboxes** - Isolated environments for agent execution
4. **Orchestration CLI** - Interactive interface for managing swarm operations
5. **Dashboard Integration** - Real-time UI panel for monitoring and control

## Architecture

```
User Notes
   ↓
Knowledge Base (notes → projects → agents)
   ↓
Task Engine (decompose into phases)
   ↓
[Research] → [Plan] → [Execute] → [Review]
   ↓                  ↓
   ↓            Agent Sandboxes
   ↓                  ↓
Dashboard ← ← Manager CLI ← ←
```

## Quick Start

### Installation

```bash
cd D:\GitHub\Scripts\swarm-manager
npm install
```

### Start API Server (for Dashboard)

```bash
node api-server.js
```

The API server runs on `http://localhost:8081` and provides:
- HTTP REST endpoints
- Socket.io real-time updates

### Start Interactive CLI

```bash
node index.js
```

Or use the shortcut:
```bash
npm start
```

## CLI Commands

### Adding Notes

```bash
swarm> note Add authentication feature #backend @feature
```

Tags:
- `#project` - Associate with a project
- `@tag` - Add searchable tags

### Viewing Notes

```bash
swarm> notes
```

### Decomposing Notes into Tasks

```bash
swarm> decompose <note-id>
```

Or it will prompt you after adding a note.

### Task Management

```bash
swarm> tasks              # List all tasks
swarm> queue              # Show queue status
swarm> orchestrate        # Execute next task
swarm> auto               # Toggle auto-orchestrate
```

### Agent Management

```bash
swarm> agents             # List available agents
swarm> agent <id>         # Show agent details
```

### System

```bash
swarm> status             # System overview
swarm> stats              # Statistics
swarm> logs <sandbox-id>  # View sandbox logs
```

## File Structure

```
swarm-manager/
├── index.js              # Main entry point
├── manager-cli.js        # Interactive CLI
├── knowledge-base.js     # KB system (notes, projects, agents)
├── task-engine.js        # Task decomposition engine
├── agent-sandbox.js      # Sandbox system
├── api-server.js         # HTTP/Socket.io API for dashboard
├── dashboard-integration.js  # Dashboard components
├── kb/
│   ├── notes/            # User notes (.md files)
│   ├── projects/         # Project definitions (.yaml)
│   ├── agents/           # Agent instructions (.yaml)
│   └── logs/             # System logs
└── sandboxes/            # Agent execution environments
    ├── <task-id>/
    │   ├── workspace/    # Agent working dir
    │   ├── output/       # Agent outputs
    │   ├── logs/         # Execution logs
    │   └── tmp/          # Temporary files
```

## Knowledge Base Format

### Note Format (Markdown)

```markdown
---
title: Add Authentication
project: backend
tags: feature, security
priority: high
status: pending
---

Implement JWT-based authentication for the API.
Need login endpoint, token validation, and refresh logic.
```

### Project Format (YAML)

```yaml
id: backend-auth
name: Backend Authentication
description: User authentication and authorization system
status: active
created: 2026-01-17T00:00:00.000Z
notes: [note-id-1, note-id-2]
tasks: []
```

### Agent Instructions Format (YAML)

```yaml
id: claude
name: Claude Agent
type: llm
capabilities: [research, plan, execute, review]

instructions: |
  You are Claude, a specialized swarm agent.

  CAPABILITIES:
  - Research technical topics
  - Create detailed plans
  - Execute code implementations
  - Review and verify work

  BEHAVIOR:
  - Be transparent about progress
  - Ask when uncertain
  - Report errors immediately
  - Verify completion explicitly
```

## Task Decomposition

When a note is decomposed, it generates tasks for each phase:

### Research Phase
- Understand requirements
- Identify constraints
- Find patterns/examples
- Assess feasibility

### Planning Phase
- Create implementation plan
- Breakdown into subtasks
- Identify dependencies
- Estimate resources

### Execution Phase
- Implementation tasks (auto-generated or user-specified)
- Each spawns isolated sandbox
- Agent works in scoped environment

### Review Phase
- Verify against requirements
- Test edge cases
- Verify quality
- Approve or request changes

## Dashboard Integration

### 1. Add API Server to Chronos.js

Start the manager-server alongside PTY server:

```javascript
const managerServer = spawn('node', ['swarm-manager/api-server.js'], {
  cwd: SCRIPT_DIR
});
```

### 2. Add Manager Panel to Dashboard

Copy the component from `dashboard-integration.js` to:
`dashboard/src/components/ManagerPanel.jsx`

Import in your main app:

```jsx
import ManagerPanel from './components/ManagerPanel';

// In your layout
<ManagerPanel />
```

### 3. API Endpoints

GET `/api/status` - System status
POST `/api/notes` - Add new note
GET `/api/notes` - List notes
POST `/api/notes/:id/decompose` - Decompose note
POST `/api/orchestrate` - Execute next task
POST `/api/orchestrate/auto` - Toggle auto mode
GET `/api/agents` - List agents
PUT `/api/agents/:id` - Update agent instructions
GET `/api/stats` - Statistics

## Auto-Orchestration

When enabled, the manager automatically:
- Polls for ready tasks every 30s (configurable)
- Executes next available task
- Handles failures gracefully
- Updates UI in real-time

Enable via CLI: `auto`
Enable via API: `POST /api/orchestrate/auto`

## Agent Orchestration Flow

1. **User** adds note via dashboard or CLI
2. **KB** stores and categorizes note
3. **Task Engine** decomposes into phases
4. **Manager** orchestrates tasks in order
5. **Sandbox** creates isolated environment
6. **Agent** executes task in sandbox
7. **Verification** checklist validates completion
8. **Next task** starts or queue waits
9. **Note** marked complete when all tasks done

## Self-Modifying Instructions

Agents can update their own instructions:

```bash
swarm> agent claude
# View current instructions

# Via API:
PUT /api/agents/claude
{
  "instructions": "Updated instructions..."
}
```

Agents can write to `kb/agents/claude.yaml` to self-modify.

## Project Organization

Notes automatically organized by project tag:

```bash
# Add note to project
swarm> note Fix database connection #inventory @bug

# View project notes
# (auto-tracked via project field)
```

## Best Practices

1. **Use descriptive titles** - Helps task naming
2. **Specify projects** - Keeps work organized
3. **Use priority tags** - Influences execution order
4. **Review verification checklists** - Customize per task type
5. **Monitor logs** - Check execution in sandboxes
6. **Update agent instructions** - Improve over time
7. **Use auto mode for batches** - Run unattended
8. **Manual orchestrate for control** - Step through carefully

## Troubleshooting

### Tasks stuck in pending
- Check dependencies are complete
- Verify agents are available
- Review logs: `logs <sandbox-id>`

### Agent failure
- Check sandbox execution logs
- Verify agent instructions
- Test with simpler task

### Dashboard not updating
- Verify API server is running on 8081
- Check browser console for errors
- Test `/api/status` endpoint directly

## Future Enhancements

- [ ] LLM-based task decomposition (smarter breakdown)
- [ ] Multi-agent collaborative tasks
- [ ] Learned agent heuristics
- [ ] Resource-aware scheduling
- [ ] Project budgeting
- [ ] Cross-project dependencies
- [ ] Agent reputation scoring
- [ ] Auto-optimization of instruction templates
- [ ] Knowledge graph linking
- [ ] Timeline visualization

## Status Report

See `STATUS.md` for current implementation status and roadmap.
