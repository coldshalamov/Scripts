# Chronos MCP Server

This server exposes your Chronos agents as MCP tools that ChatGPT (or any MCP client) can use to delegate tasks.

## 🚀 Features

- **Agent Discovery**: ChatGPT can list all available agents with their roles and workspaces
- **Context Inspection**: Read agent instruction files and workspace details
- **Task Delegation**: Send prompts/tasks directly to specific agents
- **Terminal Control**: Interact with agents through their assigned terminals

## 📡 MCP Tools Exposed

### `list_agents`
Lists all configured agents with their roles, assignments, and workspace info.

### `get_agent_context(agentName)`
Gets detailed context about a specific agent including:
- Role and workspace directory
- Instruction file contents
- Current terminal assignment
- Global workspace instructions

### `delegate_to_{agentName}(task, waitForResponse?)`
Sends a task to a specific agent. For example:
- `delegate_to_gemini(task: "Write a Python script...")`
- `delegate_to_claude(task: "Review this code...", waitForResponse: true)`

## 🔧 Local Development

```bash
cd mcp-server
npm install
npm run dev
```

Server runs on `http://localhost:8080`

## ☁️ Render Deployment

### Option 1: Deploy with Chronos on Same Network (Recommended for Testing)

1. **Expose your local Chronos** using ngrok:
   ```bash
   ngrok http 3000
   ```

2. **Deploy to Render**:
   - Push this folder to GitHub
   - Create new Web Service on Render
   - Point to this repository
   - Set environment variable:
     - `CHRONOS_API_URL` = your ngrok URL + `/api` (e.g., `https://abc123.ngrok.io/api`)

### Option 2: Deploy Chronos + MCP Server Together (Production)

For production, you'd want to deploy the entire Chronos backend to Render and have the MCP server communicate with it internally.

## 🤖 Using with ChatGPT

Once deployed, configure ChatGPT's MCP settings to point to your Render URL:

```json
{
  "mcpServers": {
    "chronos": {
      "url": "https://your-app.onrender.com",
      "endpoints": {
        "listTools": "/mcp/list-tools",
        "executeTool": "/mcp/execute-tool"
      }
    }
  }
}
```

Then you can ask ChatGPT:
- "List my available agents"
- "Get context for the gemini agent"
- "Delegate this task to claude: Review the authentication code"

## 🔐 Security Notes

- **Authentication**: Add API key authentication before production use
- **Rate Limiting**: Consider adding rate limits
- **HTTPS**: Render provides HTTPS by default
- **Firewall**: Ensure your local Chronos is accessible (or deploy it too)

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (Render sets this automatically) | No |
| `CHRONOS_API_URL` | URL to your Chronos backend API | Yes |
| `NODE_ENV` | Environment (production/development) | No |
