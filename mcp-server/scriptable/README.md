# Chronos Mobile - Scriptable Setup Guide

## 📱 What This Is

A beautiful iOS interface for Chronos that runs in the **Scriptable** app. Control your desktop agents from your iPhone!

## 🚀 Quick Setup (5 Minutes)

### 1. Install Scriptable

Download from the App Store: [Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188)

### 2. Deploy Your MCP Server

Follow the main `QUICKSTART.md` to deploy to Render. You'll need the URL.

### 3. Add the Script

1. Open **Scriptable** on your iPhone
2. Tap **+** (top right)
3. Paste the entire contents of `Chronos.js`
4. **Important**: Update line 4 with your Render URL:
   ```javascript
   const MCP_URL = "https://your-actual-url.onrender.com";
   ```
5. Tap **Done**
6. Rename the script to "Chronos"

### 4. Run It!

Tap the script in Scriptable to launch the full interface.

## 🎨 Features

### Agent List View
- See all your configured agents
- Status indicators (online/offline)
- Tap any agent for details

### Agent Detail View
- Role and workspace information
- Current terminal assignment
- Instruction file preview
- Quick task delegation

### Task Delegation
- Tap "Delegate Task" on any agent
- Enter your prompt
- Task is sent to the agent's terminal
- Confirmation when sent

### Home Screen Widget
- Add Chronos to your home screen
- Shows agent status at a glance
- Tap to open full interface
- Auto-refreshes every 30 seconds

## 📲 Adding the Widget

1. Long-press your home screen
2. Tap **+** (top left)
3. Search for "Scriptable"
4. Choose widget size (Medium recommended)
5. Tap "Add Widget"
6. Long-press the widget → "Edit Widget"
7. Select "Chronos" as the script
8. Done!

## 💡 Usage Examples

### Quick Task Delegation
1. Open Scriptable → Chronos
2. Tap the agent (e.g., "gemini")
3. Tap "📝 Delegate Task"
4. Type: "Write a Python script to parse CSV files"
5. Tap "Send"

### Check Agent Status
Just glance at your home screen widget to see which agents are online.

### View Agent Context
1. Tap any agent
2. See their workspace, role, and instructions
3. Understand what they're working on

## 🎨 Customization

### Change Colors

Edit the `CONFIG.theme` object (lines 10-20):

```javascript
theme: {
  bg: new Color("#050508"),        // Background
  primary: new Color("#00f3ff"),   // Cyan accent
  secondary: new Color("#7000ff"), // Purple accent
  // ... etc
}
```

### Adjust Refresh Rate

Change `refreshInterval` in CONFIG (line 9):

```javascript
refreshInterval: 30, // seconds
```

### Widget Size

The widget automatically adapts to small/medium/large sizes. Medium is recommended for best visibility.

## 🔧 Troubleshooting

### "Connection Failed"
- Make sure your MCP server is deployed and running
- Check the URL in line 4 is correct
- Verify you have internet connection
- Test the URL in Safari first

### "Cannot reach server"
- Your Render service might be sleeping (free tier)
- Wait 30 seconds and try again
- Check Render dashboard for errors

### Widget not updating
- Widgets refresh based on iOS schedule
- Open the app to force a refresh
- Check widget settings in Scriptable

### "Agent not assigned to terminal"
- Open Chronos desktop app
- Go to Orchestration tab
- Assign agents to terminals using the mini-mosaic

## 📱 Screenshots

### Main View
- Clean list of all agents
- Status indicators
- Tap to view details

### Agent Detail
- Full context information
- Quick action buttons
- Instruction preview

### Widget
- Compact status display
- At-a-glance monitoring
- Tap to open full app

## 🎯 Pro Tips

1. **Add to Home Screen**: Use the widget for quick status checks
2. **Siri Shortcuts**: Create shortcuts to delegate common tasks
3. **Notifications**: The script can be extended to send notifications when tasks complete
4. **Multiple Widgets**: Add multiple widgets with different configurations

## 🔐 Security Notes

- The script stores no data locally
- All communication is HTTPS
- No credentials are stored
- Consider adding authentication to your MCP server for production use

## 🚀 Advanced Features

### Add Siri Shortcuts

1. Open Shortcuts app
2. Create new shortcut
3. Add "Run Script" action
4. Select "Chronos"
5. Add parameters for specific agents

### Custom Actions

Edit the script to add custom buttons:

```javascript
const customRow = new UITableRow();
const customBtn = customRow.addButton("🎯 Custom Action");
customBtn.onTap = () => {
  // Your custom code here
};
table.addRow(customRow);
```

## 📚 API Reference

The script uses these MCP endpoints:

- `GET /health` - Check server status
- `POST /mcp/execute-tool` - Execute MCP tools
  - `list_agents` - Get all agents
  - `get_agent_context` - Get agent details
  - `delegate_to_{agent}` - Send task

## 🎨 Theming

The app uses the same color scheme as Chronos desktop:
- **Primary**: Cyan (#00f3ff)
- **Secondary**: Purple (#7000ff)
- **Accent**: Pink (#ff0055)
- **Background**: Dark (#050508)

---

**Need help?** Check the main MCP server documentation or open an issue on GitHub.

**Want to contribute?** The script is open for customization and improvements!
