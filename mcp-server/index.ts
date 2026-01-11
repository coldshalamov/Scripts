import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 8080;
const CHRONOS_API = process.env.CHRONOS_API_URL || 'http://localhost:3000/api';

app.use(cors());
app.use(express.json());

interface AgentConfig {
    name: string;
    command: string;
    args?: string[];
    type: string;
    instructionFile?: string;
    role?: string;
    prelaunchCommands?: string;
}

interface SystemConfig {
    agents: AgentConfig[];
    termMapping: Record<string, string | null>;
    workspaceDir?: string;
    workspaceInstructions?: string;
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'chronos-mcp-server' });
});

// MCP Protocol: List available tools
app.post('/mcp/list-tools', async (req, res) => {
    try {
        const configRes = await axios.get(`${CHRONOS_API}/config`);
        const config: SystemConfig = configRes.data;

        const tools: any[] = config.agents.map(agent => ({
            name: `delegate_to_${agent.name}`,
            description: `Delegate a task to ${agent.name}. Role: ${agent.role || 'General Assistant'}. Works in: ${config.workspaceDir || 'unknown workspace'}`,
            inputSchema: {
                type: 'object',
                properties: {
                    task: {
                        type: 'string',
                        description: 'The task or prompt to send to this agent'
                    },
                    waitForResponse: {
                        type: 'boolean',
                        description: 'Whether to wait and return the agent output (default: false)',
                        default: false
                    }
                },
                required: ['task']
            }
        }));

        // Add workspace inspection tools
        tools.push({
            name: 'get_agent_context',
            description: 'Get detailed context about an agent including their role, workspace, and instruction file contents',
            inputSchema: {
                type: 'object',
                properties: {
                    agentName: {
                        type: 'string',
                        description: 'Name of the agent to inspect'
                    }
                },
                required: ['agentName']
            }
        });

        tools.push({
            name: 'list_agents',
            description: 'List all available agents with their roles and current assignments',
            inputSchema: {
                type: 'object',
                properties: {},
                required: []
            }
        });

        res.json({ tools });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// MCP Protocol: Execute a tool
app.post('/mcp/execute-tool', async (req, res) => {
    const { name, arguments: args } = req.body;

    try {
        const configRes = await axios.get(`${CHRONOS_API}/config`);
        const config: SystemConfig = configRes.data;

        if (name === 'list_agents') {
            const agentList = config.agents.map(agent => {
                const assignedTerm = Object.entries(config.termMapping).find(([_, n]) => n === agent.name)?.[0];
                return {
                    name: agent.name,
                    role: agent.role || 'General Assistant',
                    command: `${agent.command} ${agent.args?.join(' ') || ''}`,
                    instructionFile: agent.instructionFile,
                    assignedTerminal: assignedTerm || 'unassigned',
                    workspace: config.workspaceDir
                };
            });

            return res.json({
                result: {
                    agents: agentList,
                    globalInstructions: config.workspaceInstructions
                }
            });
        }

        if (name === 'get_agent_context') {
            const agent = config.agents.find(a => a.name === args.agentName);
            if (!agent) {
                return res.status(404).json({ error: `Agent ${args.agentName} not found` });
            }

            let instructionContent = '';
            if (agent.instructionFile && config.workspaceDir) {
                const instructionPath = path.join(config.workspaceDir, agent.instructionFile);
                if (fs.existsSync(instructionPath)) {
                    instructionContent = fs.readFileSync(instructionPath, 'utf8');
                }
            }

            const assignedTerm = Object.entries(config.termMapping).find(([_, n]) => n === agent.name)?.[0];

            return res.json({
                result: {
                    name: agent.name,
                    role: agent.role,
                    workspace: config.workspaceDir,
                    instructionFile: agent.instructionFile,
                    instructionContent,
                    assignedTerminal: assignedTerm,
                    command: `${agent.command} ${agent.args?.join(' ') || ''}`,
                    globalInstructions: config.workspaceInstructions
                }
            });
        }

        // Handle delegate_to_* tools
        if (name.startsWith('delegate_to_')) {
            const agentName = name.replace('delegate_to_', '');
            const agent = config.agents.find(a => a.name === agentName);

            if (!agent) {
                return res.status(404).json({ error: `Agent ${agentName} not found` });
            }

            const assignedTerm = Object.entries(config.termMapping).find(([_, n]) => n === agentName)?.[0];

            if (!assignedTerm) {
                return res.status(400).json({
                    error: `Agent ${agentName} is not currently assigned to a terminal. Please assign it in Chronos first.`
                });
            }

            // Send the task to the terminal
            await axios.post(`${CHRONOS_API}/terminal/input`, {
                termId: assignedTerm,
                command: args.task + '\r'
            });

            if (args.waitForResponse) {
                // Wait a bit for output
                await new Promise(resolve => setTimeout(resolve, 3000));

                const outputRes = await axios.get(`${CHRONOS_API}/terminal/output/${assignedTerm}`);

                return res.json({
                    result: {
                        status: 'delegated',
                        agent: agentName,
                        terminal: assignedTerm,
                        output: outputRes.data.output
                    }
                });
            }

            return res.json({
                result: {
                    status: 'delegated',
                    agent: agentName,
                    terminal: assignedTerm,
                    message: `Task sent to ${agentName} on ${assignedTerm}`
                }
            });
        }

        res.status(404).json({ error: `Tool ${name} not found` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Legacy REST endpoints for direct access
app.get('/api/agents', async (req, res) => {
    try {
        const configRes = await axios.get(`${CHRONOS_API}/config`);
        const config: SystemConfig = configRes.data;
        res.json(config.agents);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/delegate', async (req, res) => {
    const { agentName, task } = req.body;

    try {
        const configRes = await axios.get(`${CHRONOS_API}/config`);
        const config: SystemConfig = configRes.data;

        const assignedTerm = Object.entries(config.termMapping).find(([_, n]) => n === agentName)?.[0];

        if (!assignedTerm) {
            return res.status(400).json({ error: `Agent ${agentName} not assigned to terminal` });
        }

        await axios.post(`${CHRONOS_API}/terminal/input`, {
            termId: assignedTerm,
            command: task + '\r'
        });

        res.json({ success: true, terminal: assignedTerm });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Chronos MCP Server running on port ${PORT}`);
    console.log(`📡 Connected to Chronos API: ${CHRONOS_API}`);
});
