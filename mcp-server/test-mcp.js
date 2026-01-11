#!/usr/bin/env node

/**
 * Test script for Chronos MCP Server
 * This simulates how ChatGPT would interact with the MCP server
 */

const axios = require('axios');

const MCP_URL = process.env.MCP_URL || 'http://localhost:8080';

async function testMCPServer() {
    console.log('🧪 Testing Chronos MCP Server...\n');

    try {
        // 1. Health check
        console.log('1️⃣ Health Check...');
        const health = await axios.get(`${MCP_URL}/health`);
        console.log('✅ Server is healthy:', health.data);
        console.log('');

        // 2. List available tools
        console.log('2️⃣ Listing available tools...');
        const toolsRes = await axios.post(`${MCP_URL}/mcp/list-tools`);
        console.log(`✅ Found ${toolsRes.data.tools.length} tools:`);
        toolsRes.data.tools.forEach(tool => {
            console.log(`   - ${tool.name}: ${tool.description}`);
        });
        console.log('');

        // 3. List agents
        console.log('3️⃣ Listing all agents...');
        const listRes = await axios.post(`${MCP_URL}/mcp/execute-tool`, {
            name: 'list_agents',
            arguments: {}
        });
        console.log('✅ Agents:', JSON.stringify(listRes.data.result, null, 2));
        console.log('');

        // 4. Get context for first agent (if any)
        if (listRes.data.result.agents.length > 0) {
            const firstAgent = listRes.data.result.agents[0].name;
            console.log(`4️⃣ Getting context for agent: ${firstAgent}...`);
            const contextRes = await axios.post(`${MCP_URL}/mcp/execute-tool`, {
                name: 'get_agent_context',
                arguments: { agentName: firstAgent }
            });
            console.log('✅ Agent Context:');
            console.log(`   Role: ${contextRes.data.result.role}`);
            console.log(`   Workspace: ${contextRes.data.result.workspace}`);
            console.log(`   Terminal: ${contextRes.data.result.assignedTerminal}`);
            console.log(`   Instruction File: ${contextRes.data.result.instructionFile}`);
            if (contextRes.data.result.instructionContent) {
                console.log(`   Instructions (first 200 chars): ${contextRes.data.result.instructionContent.substring(0, 200)}...`);
            }
            console.log('');

            // 5. Test delegation (optional - commented out to avoid spamming)
            console.log(`5️⃣ Testing delegation to ${firstAgent}...`);
            console.log('   ⚠️  Skipping actual delegation to avoid spamming your terminal');
            console.log('   To test delegation, uncomment the code in test-mcp.js');
            console.log('');

            /*
            const delegateRes = await axios.post(`${MCP_URL}/mcp/execute-tool`, {
              name: `delegate_to_${firstAgent}`,
              arguments: { 
                task: 'echo "Hello from MCP test!"',
                waitForResponse: false
              }
            });
            console.log('✅ Delegation result:', delegateRes.data.result);
            */
        }

        console.log('✅ All tests passed!\n');
        console.log('📱 You can now use this MCP server with ChatGPT by pointing it to:');
        console.log(`   ${MCP_URL}`);

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

testMCPServer();
