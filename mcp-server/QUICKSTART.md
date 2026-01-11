# Quick Start Guide - Chronos MCP Server

## 🎯 What This Does

This MCP server lets ChatGPT (or any MCP client) delegate tasks to your local Chronos agents. You can talk to ChatGPT on your phone and have it send work to your desktop agents.

## 🚀 Quick Deploy to Render

### 1. Expose Your Local Chronos

```bash
# Download ngrok from https://ngrok.com/download
# Then run:
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### 2. Push to GitHub

```bash
cd d:/GitHub/Scripts
git add .
git commit -m "Add Chronos MCP server"
git push
```

### 3. Deploy on Render

1. Go to https://render.com/dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `chronos-mcp`
   - **Root Directory**: `mcp-server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add Environment Variable:
   - **Key**: `CHRONOS_API_URL`
   - **Value**: `https://your-ngrok-url.ngrok-free.app/api`
6. Click **"Create Web Service"**

### 4. Get Your MCP URL

Once deployed, Render will give you a URL like:
`https://chronos-mcp.onrender.com`

## 📱 Configure ChatGPT

### Option A: ChatGPT Desktop App (Recommended)

1. Open ChatGPT Desktop → Settings → MCP Servers
2. Add new server:
   ```json
   {
     "name": "Chronos",
     "url": "https://chronos-mcp.onrender.com",
     "endpoints": {
       "listTools": "/mcp/list-tools",
       "executeTool": "/mcp/execute-tool"
     }
   }
   ```
3. Save and restart ChatGPT

### Option B: Custom MCP Client

Use the test script as a reference:
```bash
cd mcp-server
MCP_URL=https://chronos-mcp.onrender.com node test-mcp.js
```

## 💬 Example ChatGPT Conversations

Once configured, you can say:

> "List my available agents"

> "Get context for the gemini agent"

> "Delegate to claude: Review the authentication code in my workspace"

> "Ask gemini to write a Python script that processes CSV files"

## 🧪 Test Locally First

Before deploying, test everything locally:

```bash
# Terminal 1: Start Chronos
npm run app

# Terminal 2: Start MCP Server
cd mcp-server
npm run dev

# Terminal 3: Test it
cd mcp-server
node test-mcp.js
```

## 🔧 Troubleshooting

### "Cannot connect to Chronos API"
- Make sure ngrok is running
- Check the `CHRONOS_API_URL` in Render matches your ngrok URL
- Verify Chronos is running locally on port 3000

### "Agent not assigned to terminal"
- Open Chronos → Orchestration tab
- Click the mini-mosaic quadrants to assign agents
- Each agent needs a terminal assignment to receive tasks

### Render service sleeping
- Free tier services sleep after 15 min of inactivity
- First request after sleep takes ~30 seconds
- Upgrade to paid tier for always-on service

## 📚 Available Tools

| Tool | What It Does |
|------|--------------|
| `list_agents` | Shows all your agents and their assignments |
| `get_agent_context` | Reads an agent's role, workspace, and instruction file |
| `delegate_to_{agent}` | Sends a task to a specific agent |

## 🎨 Pro Tips

1. **Keep ngrok running** - Your phone can't reach your desktop without it
2. **Assign agents first** - Use the Orchestration tab to map agents to terminals
3. **Check terminal output** - Watch Chronos to see tasks being executed
4. **Use waitForResponse** - Set to `true` if you want ChatGPT to see the output

---

**Need more help?** Check `CHATGPT_SETUP.md` for detailed instructions.
