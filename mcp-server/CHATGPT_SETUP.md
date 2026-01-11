# How to Use Chronos MCP Server with ChatGPT

## 🎯 Overview

This guide shows you how to connect ChatGPT (via the ChatGPT desktop app or API) to your Chronos agents running locally or on Render.

## 📋 Prerequisites

1. **Chronos running locally** with agents configured
2. **MCP server deployed** to Render (or running locally)
3. **ChatGPT Desktop App** or custom MCP client

## 🚀 Quick Start

### Step 1: Expose Your Local Chronos (if not deployed)

Since Chronos runs on your computer, you need to expose it to the internet so the Render-hosted MCP server can reach it:

```bash
# Install ngrok if you haven't
# Download from https://ngrok.com/download

# Expose your local Chronos API (port 3000)
ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok-free.app`

### Step 2: Deploy MCP Server to Render

1. **Push to GitHub**:
   ```bash
   cd d:/GitHub/Scripts
   git add mcp-server/
   git commit -m "Add Chronos MCP server"
   git push
   ```

2. **Create Render Service**:
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Set **Root Directory**: `mcp-server`
   - Render will auto-detect the `render.yaml`

3. **Set Environment Variable**:
   - In Render dashboard, add environment variable:
     - Key: `CHRONOS_API_URL`
     - Value: `https://your-ngrok-url.ngrok-free.app/api`

4. **Deploy** and wait for it to go live

### Step 3: Configure ChatGPT Desktop App

The ChatGPT desktop app supports MCP servers. Here's how to configure it:

1. **Open ChatGPT Settings** → **MCP Servers**

2. **Add a new server**:
   ```json
   {
     "name": "Chronos",
     "url": "https://your-mcp-server.onrender.com",
     "type": "http",
     "endpoints": {
       "listTools": "/mcp/list-tools",
       "executeTool": "/mcp/execute-tool"
     }
   }
   ```

3. **Save and Restart** ChatGPT

### Step 4: Use It!

Now you can talk to ChatGPT and it will see your agents as available tools:

**Example Conversations:**

> **You**: "What agents do I have available?"
> 
> **ChatGPT**: *[Calls `list_agents` tool]* "You have 4 agents configured:
> - **gemini** - Role: Code generation and analysis, assigned to term1
> - **claude** - Role: Code review and documentation, assigned to term2
> - **codex** - Role: Full-stack development, assigned to term3
> - **kilo** - Role: Testing and debugging, unassigned"

---

> **You**: "Get the context for the gemini agent"
> 
> **ChatGPT**: *[Calls `get_agent_context` with agentName: "gemini"]* "The gemini agent is working in `D:/Projects/MyApp` and has the following instructions: [shows instruction file content]"

---

> **You**: "Ask gemini to write a Python script that scrapes a website"
> 
> **ChatGPT**: *[Calls `delegate_to_gemini` with task: "Write a Python script..."]* "I've delegated that task to gemini on terminal term1. The agent should be working on it now."

## 📱 Using from Your Phone

Since the MCP server is deployed on Render, you can use ChatGPT on your phone and it will still be able to delegate tasks to your local Chronos instance (as long as ngrok is running).

## 🔒 Production Setup (Optional)

For a more permanent setup without ngrok:

1. **Deploy Chronos Backend to Render** as a separate service
2. **Update MCP Server** to point to the deployed Chronos URL
3. **Use Render's internal networking** if both services are on Render

## 🧪 Testing Locally

Before deploying, test the MCP server locally:

```bash
# Terminal 1: Start Chronos
npm run app

# Terminal 2: Start MCP Server
cd mcp-server
npm run dev

# Terminal 3: Run tests
cd mcp-server
node test-mcp.js
```

## 🛠️ Troubleshooting

### "Agent not assigned to terminal"
- Make sure you've assigned agents to terminals in the Chronos Orchestration tab
- The mini-mosaic should show which agent is in which quadrant

### "Cannot connect to Chronos API"
- Check that ngrok is running and the URL is correct
- Verify the `CHRONOS_API_URL` environment variable in Render
- Check Render logs for connection errors

### "Tool not found"
- Ensure the MCP server is properly deployed
- Check that ChatGPT's MCP configuration has the correct endpoints

## 📚 Available MCP Tools

| Tool | Description | Arguments |
|------|-------------|-----------|
| `list_agents` | List all configured agents | None |
| `get_agent_context` | Get agent details and instructions | `agentName` |
| `delegate_to_{agent}` | Send task to specific agent | `task`, `waitForResponse?` |

## 🎨 Example Use Cases

1. **Code Review**: "Ask claude to review the authentication code in my workspace"
2. **Documentation**: "Have gemini write API documentation for the user service"
3. **Testing**: "Delegate to kilo: Run all unit tests and report failures"
4. **Multi-Agent**: "Ask claude to review what gemini just wrote"

---

**Need help?** Check the main README.md or open an issue on GitHub.
