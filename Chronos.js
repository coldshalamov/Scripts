// Chronos Mobile - iOS Scriptable App
// A mobile interface for controlling your Chronos agents
const MCP_URL = "https://chronosmcp.onrender.com";

// ============================================
// Configuration
// ============================================

const CONFIG = {
    mcpUrl: MCP_URL,
    theme: {
        bg: new Color("#050508"),
        bgPanel: new Color("#0a0a12", 0.85),
        primary: new Color("#00f3ff"),
        secondary: new Color("#7000ff"),
        accent: new Color("#ff0055"),
        textMain: new Color("#e2e2e9"),
        textDim: new Color("#8e8e9c"),
        border: new Color("#ffffff", 0.08)
    }
};

// ============================================
// API Client
// ============================================

class ChronosAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    }

    async _request(endpoint, body) {
        try {
            const req = new Request(`${this.baseUrl}${endpoint}`);
            req.method = "POST";
            req.headers = { "Content-Type": "application/json" };
            req.body = JSON.stringify(body);
            req.timeoutInterval = 60; // Increased for Render cold starts

            // Handle potential HTML response (404/500)
            let res;
            try {
                res = await req.loadJSON();
            } catch (e) {
                // Try to read as text to see if it's HTML
                const text = await req.loadString();
                if (text.includes("<!DOCTYPE html>")) {
                    throw new Error("Server returned HTML instead of JSON. Check your MCP_URL.");
                }
                throw e;
            }

            if (!res) throw new Error("Empty response from server");
            if (res.error) throw new Error(res.error);
            if (!res.result && !endpoint.includes("delegate")) {
                // delegate might return simple success
                if (res.success) return res;
                throw new Error("Missing result in response");
            }
            return res.result || res;
        } catch (e) {
            throw new Error(`API Error (${endpoint}): ${e.message}`);
        }
    }

    async listAgents() {
        return this._request("/mcp/execute-tool", { name: "list_agents", arguments: {} });
    }

    async getAgentContext(agentName) {
        return this._request("/mcp/execute-tool", { name: "get_agent_context", arguments: { agentName } });
    }

    async delegateTask(agentName, task) {
        return this._request("/mcp/execute-tool", { name: `delegate_to_${agentName}`, arguments: { task } });
    }

    async healthCheck() {
        try {
            const req = new Request(`${this.baseUrl}/health`);
            req.timeoutInterval = 60; // Increased to 60s for Render cold starts
            const res = await req.loadJSON();
            return res && res.status === "ok";
        } catch (e) {
            return false;
        }
    }
}

// ============================================
// UI Controllers
// ============================================

async function showAgentList() {
    const api = new ChronosAPI(CONFIG.mcpUrl);

    // 1. Connectivity Check
    const isOnline = await api.healthCheck();
    if (!isOnline) {
        const alert = new Alert();
        alert.title = "Connection Failed";
        alert.message = `Cannot reach Chronos MCP server.\n\nURL: ${CONFIG.mcpUrl}\n\n1. Check if Render/ngrok is running.\n2. Verify the URL in the script.\n3. Render free tier takes ~30s to wake up.`;
        alert.addAction("Retry");
        alert.addCancelAction("Cancel");
        if (await alert.presentAlert() === 0) {
            return showAgentList();
        }
        return;
    }

    // 2. Data Fetching
    try {
        const data = await api.listAgents();
        if (!data || !data.agents) {
            throw new Error("Server responded but sent no agent data.");
        }

        const agents = data.agents;
        const table = new UITable();
        table.showSeparators = true;

        // Header
        const header = new UITableRow();
        header.isHeader = true;
        header.backgroundColor = CONFIG.theme.bgPanel;
        const headerText = header.addText("🕰️ CHRONOS AGENTS");
        headerText.titleFont = Font.boldSystemFont(20);
        headerText.titleColor = CONFIG.theme.primary;
        table.addRow(header);

        // Agent rows
        for (const agent of agents) {
            const row = new UITableRow();
            row.dismissOnSelect = false;
            row.onSelect = () => {
                showAgentDetail(agent).catch(e => {
                    const a = new Alert(); a.title = "Error"; a.message = e.message; a.present();
                });
            };

            const nameText = row.addText(agent.name.toUpperCase());
            nameText.titleFont = Font.boldSystemFont(14);
            nameText.titleColor = CONFIG.theme.textMain;

            const roleText = row.addText(agent.role || "General");
            roleText.subtitleFont = Font.systemFont(11);
            roleText.subtitleColor = CONFIG.theme.textDim;

            const isAssigned = agent.assignedTerminal !== "unassigned";
            const statusText = row.addText(isAssigned ? "●" : "○");
            statusText.titleFont = Font.systemFont(16);
            statusText.titleColor = isAssigned ? CONFIG.theme.secondary : CONFIG.theme.textDim;
            statusText.widthWeight = 10;

            table.addRow(row);
        }

        // Footer actions
        const footer = new UITableRow();
        footer.backgroundColor = CONFIG.theme.bgPanel;
        const refreshBtn = footer.addButton("🔄 Refresh Status");
        refreshBtn.onTap = () => showAgentList();
        table.addRow(footer);

        await table.present();
    } catch (e) {
        const alert = new Alert();
        alert.title = "Data Error";
        alert.message = `${e.message}\n\nCheck your backend logs.`;
        alert.addAction("Retry");
        alert.addCancelAction("Exit");
        if (await alert.presentAlert() === 0) {
            return showAgentList();
        }
    }
}

async function showAgentDetail(agent) {
    const api = new ChronosAPI(CONFIG.mcpUrl);

    // Show Loading indicator
    const context = await api.getAgentContext(agent.name);

    // Create detail table
    const table = new UITable();

    // Header
    const header = new UITableRow();
    header.isHeader = true;
    const headerText = header.addText(`${agent.name.toUpperCase()}`);
    headerText.titleFont = Font.boldSystemFont(22);
    headerText.titleColor = CONFIG.theme.primary;
    table.addRow(header);

    // Stats
    const info = [
        { label: "Role", value: context.role || "General Assistant", color: CONFIG.theme.textMain },
        { label: "Terminal", value: context.assignedTerminal || "unassigned", color: context.assignedTerminal ? CONFIG.theme.secondary : CONFIG.theme.textDim },
        { label: "Workspace", value: context.workspace || "Not set", color: CONFIG.theme.textDim, font: Font.systemFont(10) }
    ];

    for (const item of info) {
        const row = new UITableRow();
        row.addText(item.label).titleColor = CONFIG.theme.textDim;
        const valText = row.addText(item.value);
        valText.titleColor = item.color;
        if (item.font) valText.titleFont = item.font;
        table.addRow(row);
    }

    // Action: Delegate
    const delegateRow = new UITableRow();
    delegateRow.backgroundColor = CONFIG.theme.secondary;
    const delegateBtn = delegateRow.addButton("📝 DELEGATE TASK");
    delegateBtn.onTap = async () => {
        const prompt = new Alert();
        prompt.title = `Delegate to ${agent.name}`;
        prompt.addTextField("What should the agent do?");
        prompt.addAction("Execute");
        prompt.addCancelAction("Cancel");

        if (await prompt.presentAlert() === 0) {
            const task = prompt.textFieldValue(0);
            if (task?.trim()) {
                try {
                    await api.delegateTask(agent.name, task);
                    const s = new Alert(); s.title = "Done"; s.message = "Task forwarded."; await s.present();
                } catch (e) {
                    const a = new Alert(); a.title = "Failed"; a.message = e.message; await a.present();
                }
            }
        }
    };
    table.addRow(delegateRow);

    // Action: View Instructions
    if (context.instructionContent) {
        const instrRow = new UITableRow();
        const instrBtn = instrRow.addButton("📄 View Instructions");
        instrBtn.onTap = async () => {
            const alert = new Alert();
            alert.title = `${agent.name} Instructions`;
            alert.message = context.instructionContent.substring(0, 500) + "...";
            await alert.present();
        };
        table.addRow(instrRow);
    }

    // Navigation: Back
    const backRow = new UITableRow();
    backRow.addButton("← Back to List").onTap = () => showAgentList();
    table.addRow(backRow);

    await table.present();
}

// ============================================
// Home Screen Widget
// ============================================

async function createWidget() {
    const widget = new ListWidget();
    widget.backgroundColor = CONFIG.theme.bg;

    const title = widget.addText("🕰️ CHRONOS");
    title.font = Font.boldSystemFont(16);
    title.textColor = CONFIG.theme.primary;

    const api = new ChronosAPI(CONFIG.mcpUrl);
    try {
        const data = await api.listAgents();
        widget.addSpacer(8);
        for (const a of data.agents.slice(0, 4)) {
            const row = widget.addStack();
            const dot = row.addText(a.assignedTerminal !== "unassigned" ? "● " : "○ ");
            dot.textColor = a.assignedTerminal !== "unassigned" ? CONFIG.theme.secondary : CONFIG.theme.textDim;
            const nm = row.addText(a.name);
            nm.textColor = CONFIG.theme.textMain;
            nm.font = Font.systemFont(12);
            widget.addSpacer(4);
        }
    } catch (e) {
        widget.addText("Offline").textColor = CONFIG.theme.accent;
    }

    return widget;
}

// ============================================
// Execution
// ============================================

(async () => {
    try {
        if (config.runsInWidget) {
            const widget = await createWidget();
            Script.setWidget(widget);
        } else {
            await showAgentList();
        }
    } catch (e) {
        console.error(e);
    }
    Script.complete();
})();
