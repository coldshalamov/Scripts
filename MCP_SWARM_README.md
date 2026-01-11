# MCP Swarm Configuration Guide

## Architecture

You now have **3 SSE servers** running on your machine:

### 1. **Swarm Senses** (Port 9090)
- **Tools**: Nucleus (shared brain), Serena (orchestration)
- **Access**: ALL agents (Claude, Codex, Gemini, Antigravity, Kilo)
- **Purpose**: Shared memory, file locks, task queue

### 2. **Opaque Hands** (Port 9092)
- **Tools**: Render, GitHub, StackOverflow, Perplexity, Arxiv
- **Access**: Gemini (via code-executor wrapper)
- **Purpose**: Heavy external API calls

### 3. **Gemini MCP** (Port 9093)
- **Tools**: Gemini CLI, Kilo CLI
- **Access**: Claude, Codex, Antigravity (NOT Gemini itself)
- **Purpose**: AI model delegation

---

## How to Configure Your Agents

### Claude Code Extension (Antigravity)
Add to your MCP config:
```json
{
  "mcpServers": {
    "senses": {
      "url": "http://localhost:9090/sse",
      "transportType": "sse"
    },
    "gemini-mcp": {
      "url": "http://localhost:9093/sse",
      "transportType": "sse"
    }
  }
}
```

### Codex Extension (Antigravity)
Same as Claude.

### Gemini CLI
Add to your MCP config:
```json
{
  "mcpServers": {
    "senses": {
      "url": "http://localhost:9090/sse",
      "transportType": "sse"
    },
    "hands": {
      "url": "http://localhost:9092/sse",
      "transportType": "sse"
    }
  }
}
```

### Kilo Code CLI
Same as Claude/Codex (Senses + Gemini MCP).

---

## Starting the Swarm

### Automatic (Recommended)
The servers will **auto-start** when you launch any agent (Claude, Codex, Gemini) via the Chronos dashboard. The `prelaunchCommands` in `chronos_config.yaml` handle this automatically.

### Manual
If you want to start them independently:
```
START_MCP_SWARM.bat
```

This will open 3 terminal windows. **Keep them running** while you work.

---

## Why This Works

- **SSE = Shared State**: All agents connect to the same port, so they see the same locks, tasks, and events.
- **No Docker**: Pure Node.js HTTP servers. Lightweight.
- **No Recursion**: Gemini doesn't see itself as a tool.
- **Code Executor**: If Claude/Codex need a "Hands" tool, they ask Gemini via the `gemini-mcp` server.

---

## Health Check

Visit these URLs in your browser:
- http://localhost:9090/health
- http://localhost:9092/health
- http://localhost:9093/health

You should see `{"status":"ok"}`.
