# 📱 Chronos Scriptable - Quick Reference

## 🚀 One-Time Setup

1. **Install Scriptable** from App Store
2. **Deploy MCP Server** to Render (see main QUICKSTART.md)
3. **Copy script** from `Chronos.js` into Scriptable app
4. **Update URL** on line 4 with your Render URL
5. **Run it!**

## 📋 What You Get

### Full App Interface
- **Agent List**: See all agents and their status
- **Agent Details**: View workspace, role, instructions
- **Task Delegation**: Send tasks directly to agents
- **Real-time Status**: Check which agents are online

### Home Screen Widget
- **Quick Status**: See agent availability at a glance
- **One-Tap Access**: Tap widget to open full app
- **Auto-Refresh**: Updates every 30 seconds

## 💬 Common Tasks

### Delegate a Task
```
1. Open Chronos in Scriptable
2. Tap the agent (e.g., "gemini")
3. Tap "📝 Delegate Task"
4. Enter your task
5. Tap "Send"
```

### Check Agent Status
```
Just look at your home screen widget!
● = Online and assigned
○ = Offline or unassigned
```

### View Agent Context
```
1. Tap any agent in the list
2. See their full details
3. Tap "📄 View Instructions" to read their role
```

## 🎨 Features

| Feature | Description |
|---------|-------------|
| **Agent List** | Browse all configured agents |
| **Live Status** | See which agents are online |
| **Task Delegation** | Send prompts to specific agents |
| **Context View** | Read agent roles and workspaces |
| **Instructions** | View agent instruction files |
| **Widget** | Home screen status display |

## 🔧 Configuration

### Update Server URL
```javascript
const MCP_URL = "https://your-server.onrender.com";
```

### Change Theme Colors
```javascript
CONFIG.theme = {
  primary: new Color("#00f3ff"),   // Cyan
  secondary: new Color("#7000ff"), // Purple
  // ... customize as needed
}
```

### Adjust Widget Refresh
```javascript
CONFIG.refreshInterval = 30; // seconds
```

## 🎯 Pro Tips

1. **Add Widget**: Long-press home screen → + → Scriptable → Choose Chronos
2. **Quick Access**: Keep widget on first home screen page
3. **Siri Shortcuts**: Create shortcuts for common delegations
4. **Multiple Widgets**: Add different size widgets for different views

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection Failed" | Check MCP server URL and internet |
| Widget not updating | Open app to force refresh |
| "Agent not assigned" | Assign agents in desktop Chronos |
| Server sleeping | Wait 30s for Render to wake up |

## 📱 Widget Sizes

- **Small**: Agent count only
- **Medium**: 4 agents with status (recommended)
- **Large**: All agents + last updated time

## 🎨 UI Elements

### Status Indicators
- **● Purple** = Agent online and assigned
- **○ Gray** = Agent offline or unassigned

### Buttons
- **📝 Delegate Task** = Send new task
- **📄 View Instructions** = Read agent role
- **🔄 Refresh** = Update agent list
- **← Back** = Return to previous screen

## 🔐 Security

- No data stored locally
- All communication over HTTPS
- No credentials in script
- Server-side authentication recommended

## 📚 Resources

- **Full Guide**: See `README.md` in this folder
- **MCP Server Docs**: See `../QUICKSTART.md`
- **Scriptable Docs**: [docs.scriptable.app](https://docs.scriptable.app)

---

**Quick Start**: Copy script → Update URL → Run!

**Need Help**: Check the full README.md in this folder.
