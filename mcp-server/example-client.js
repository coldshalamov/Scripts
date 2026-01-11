#!/usr/bin/env node

/**
 * Example: Using Chronos MCP from a custom client
 * This shows how you could integrate Chronos into your own app
 */

const axios = require('axios');

const MCP_URL = process.env.MCP_URL || 'http://localhost:8080';

class ChronosClient {
    constructor(mcpUrl) {
        this.mcpUrl = mcpUrl;
    }

    async listTools() {
        const res = await axios.post(`${this.mcpUrl}/mcp/list-tools`);
        return res.data.tools;
    }

    async executeTool(name, args) {
        const res = await axios.post(`${this.mcpUrl}/mcp/execute-tool`, {
            name,
            arguments: args
        });
        return res.data.result;
    }

    async listAgents() {
        return await this.executeTool('list_agents', {});
    }

    async getAgentContext(agentName) {
        return await this.executeTool('get_agent_context', { agentName });
    }

    async delegateTask(agentName, task, waitForResponse = false) {
        return await this.executeTool(`delegate_to_${agentName}`, {
            task,
            waitForResponse
        });
    }
}

// Example usage
async function main() {
    const client = new ChronosClient(MCP_URL);

    console.log('🤖 Chronos Client Example\n');

    // List all agents
    console.log('📋 Available Agents:');
    const agentList = await client.listAgents();
    agentList.agents.forEach(agent => {
        console.log(`  - ${agent.name} (${agent.role}) → ${agent.assignedTerminal}`);
    });
    console.log('');

    // Get context for first agent
    if (agentList.agents.length > 0) {
        const firstAgent = agentList.agents[0].name;
        console.log(`🔍 Context for ${firstAgent}:`);
        const context = await client.getAgentContext(firstAgent);
        console.log(`  Workspace: ${context.workspace}`);
        console.log(`  Role: ${context.role}`);
        console.log(`  Terminal: ${context.assignedTerminal}`);
        console.log('');

        // Example: Delegate a task (commented out)
        console.log('💡 To delegate a task, uncomment the code below:');
        console.log(`   const result = await client.delegateTask('${firstAgent}', 'echo "Hello!"');`);
        console.log('');
    }

    console.log('✅ Done! You can now integrate this into your own application.');
}

main().catch(console.error);
