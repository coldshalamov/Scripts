# 🎯 Complete Chronos Mobile Setup Guide

## Overview

You now have **three ways** to control your Chronos agents from your iPhone:

1. **ChatGPT Desktop App** - AI-powered delegation
2. **Scriptable App** - Native iOS interface
3. **Custom Integration** - Build your own with the MCP API

This guide covers all three approaches.

---

## 📱 Option 1: Scriptable App (Recommended)

### Why Choose This?
- ✅ Beautiful native iOS interface
- ✅ Home screen widget
- ✅ No AI required - direct control
- ✅ Fast and responsive
- ✅ Free (Scriptable is free)

### Setup (5 Minutes)

1. **Install Scriptable**
   - Download from [App Store](https://apps.apple.com/us/app/scriptable/id1405459188)

2. **Deploy MCP Server**
   - Follow `../QUICKSTART.md` to deploy to Render
   - Get your Render URL (e.g., `https://chronos-mcp.onrender.com`)

3. **Add Script**
   - Open Scriptable
   - Tap **+** (new script)
   - Copy entire contents of `scriptable/Chronos.js`
   - Paste into Scriptable
   - **Update line 4** with your Render URL:
     ```javascript
     const MCP_URL = "https://your-actual-url.onrender.com";
     ```
   - Tap **Done**
   - Rename to "Chronos"

4. **Run It**
   - Tap the script to launch
   - You'll see your agent list!

### Add Home Screen Widget

1. Long-press home screen
2. Tap **+** (top left)
3. Search "Scriptable"
4. Choose **Medium** widget
5. Tap "Add Widget"
6. Long-press widget → "Edit Widget"
7. Select "Chronos" script
8. Done!

### Features

| Feature | Description |
|---------|-------------|
| **Agent List** | Browse all agents with status |
| **Agent Details** | View workspace, role, instructions |
| **Task Delegation** | Send tasks with text input |
| **Widget** | Home screen status display |
| **Auto-Refresh** | Updates every 30 seconds |

---

## 🤖 Option 2: ChatGPT Desktop App

### Why Choose This?
- ✅ AI-powered task routing
- ✅ Natural language interface
- ✅ Multi-agent orchestration
- ✅ Context-aware delegation

### Setup (10 Minutes)

1. **Deploy MCP Server** (same as above)

2. **Configure ChatGPT**
   - Open ChatGPT Desktop → Settings → MCP Servers
   - Add new server:
     ```json
     {
       "name": "Chronos",
       "url": "https://your-mcp-server.onrender.com",
       "endpoints": {
         "listTools": "/mcp/list-tools",
         "executeTool": "/mcp/execute-tool"
       }
     }
     ```
   - Save and restart ChatGPT

3. **Test It**
   - Ask: "List my available agents"
   - ChatGPT will show your agents!

### Example Conversations

> **You**: "What agents do I have?"
> 
> **ChatGPT**: "You have 4 agents: gemini (code gen), claude (review), codex (full-stack), kilo (testing)"

> **You**: "Ask gemini to write a Python CSV parser"
> 
> **ChatGPT**: "I've delegated that task to gemini on term1"

> **You**: "Have gemini write it, then claude review it"
> 
> **ChatGPT**: *[Orchestrates both agents sequentially]*

---

## 🛠️ Option 3: Custom Integration

### Why Choose This?
- ✅ Full control over UI/UX
- ✅ Integrate into existing apps
- ✅ Custom workflows
- ✅ Automation possibilities

### Quick Start

Use the example client as a template:

```javascript
const axios = require('axios');
const MCP_URL = "https://your-server.onrender.com";

// List agents
const res = await axios.post(`${MCP_URL}/mcp/execute-tool`, {
  name: "list_agents",
  arguments: {}
});
console.log(res.data.result.agents);

// Delegate task
await axios.post(`${MCP_URL}/mcp/execute-tool`, {
  name: "delegate_to_gemini",
  arguments: {
    task: "Write a Python script...",
    waitForResponse: false
  }
});
```

See `example-client.js` for full implementation.

---

## 🎯 Comparison

| Feature | Scriptable | ChatGPT | Custom |
|---------|-----------|---------|--------|
| **Setup Time** | 5 min | 10 min | Varies |
| **Cost** | Free | Free | Free |
| **UI** | Native iOS | Chat | Your design |
| **AI Features** | No | Yes | Optional |
| **Customization** | Medium | Low | High |
| **Widget** | Yes | No | Possible |
| **Best For** | Quick control | AI delegation | Integration |

---

## 📋 Prerequisites (All Options)

### 1. Deploy MCP Server to Render

```bash
# 1. Expose local Chronos
ngrok http 3000

# 2. Push to GitHub
git add .
git commit -m "Add MCP server"
git push

# 3. Create Render service
# - Go to render.com
# - New Web Service
# - Connect GitHub repo
# - Root directory: mcp-server
# - Add env var: CHRONOS_API_URL = your ngrok URL + /api

# 4. Wait for deployment
# - Get your Render URL
# - Test: https://your-url.onrender.com/health
```

### 2. Assign Agents to Terminals

1. Open Chronos desktop app
2. Go to **Orchestration** tab
3. Click the **mini-mosaic** quadrants
4. Assign each agent to a terminal
5. Verify assignments show in the grid

---

## 🎨 Usage Patterns

### Quick Status Check
**Scriptable Widget**: Glance at home screen

### Simple Task
**Scriptable App**: Tap agent → Delegate → Type task

### Complex Orchestration
**ChatGPT**: "Have gemini write X, claude review it, then codex deploy"

### Automation
**Custom Integration**: Build workflows, scheduled tasks, etc.

---

## 🐛 Troubleshooting

### "Connection Failed"
- ✅ Check MCP server is deployed
- ✅ Verify URL is correct
- ✅ Test in browser: `https://your-url.onrender.com/health`
- ✅ Check internet connection

### "Agent not assigned to terminal"
- ✅ Open Chronos desktop
- ✅ Go to Orchestration tab
- ✅ Assign agents using mini-mosaic
- ✅ Refresh mobile app

### Render Service Sleeping
- ⏱️ Free tier sleeps after 15 min
- ⏱️ First request takes ~30 seconds
- ⏱️ Subsequent requests are fast
- 💰 Upgrade to paid tier for always-on

### Widget Not Updating
- 🔄 Open Scriptable app to force refresh
- ⏰ iOS controls widget refresh schedule
- 📱 Widget updates every 30 seconds when active

---

## 🔐 Security Recommendations

### Development (Current Setup)
- ✅ HTTPS via Render
- ✅ ngrok tunnel for local access
- ⚠️ No authentication (anyone with URL can use)
- ⚠️ Suitable for personal use only

### Production Recommendations
- 🔒 Add API key authentication
- 🔒 Rate limiting
- 🔒 Deploy full Chronos to Render (no ngrok)
- 🔒 Use environment variables for secrets
- 🔒 Implement user sessions

---

## 📚 Documentation Index

| File | Purpose |
|------|---------|
| `scriptable/Chronos.js` | iOS app source code |
| `scriptable/README.md` | Full Scriptable guide |
| `scriptable/QUICK_REFERENCE.md` | Quick tips |
| `../QUICKSTART.md` | MCP server deployment |
| `../CHATGPT_SETUP.md` | ChatGPT integration |
| `../SUMMARY.md` | Technical overview |
| `../example-client.js` | Custom integration example |

---

## 🚀 Next Steps

1. **Choose your approach** (Scriptable recommended for most users)
2. **Deploy MCP server** to Render
3. **Set up your client** (Scriptable/ChatGPT/Custom)
4. **Assign agents** in Chronos desktop
5. **Start delegating!**

---

## 💡 Pro Tips

1. **Use Scriptable widget** for quick status checks
2. **Use ChatGPT** for complex multi-agent workflows
3. **Keep ngrok running** when you want mobile access
4. **Check Chronos desktop** to see tasks executing in real-time
5. **Add Siri shortcuts** to Scriptable for voice control

---

**Ready to start?** Pick your option above and follow the setup guide!

**Need help?** Check the specific README for your chosen approach.

**Want all three?** They all work together! Use the best tool for each task.
