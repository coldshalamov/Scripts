/**
 * Agent Sandbox System
 * Provides scoped resources for sub-agents with controlled access
 * Creates isolated environment for each agent task
 */
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.join(__dirname, 'sandboxes');

export class AgentSandbox {
  constructor(task) {
    this.task = task;
    this.sandboxId = this.generateSandboxId(task.id, task.agentType);
    this.sandboxPath = path.join(SANDBOX_DIR, this.sandboxId);
    this.process = null;
    this.status = 'idle';
    this.startTime = null;
  }

  async init() {
    // Create sandbox directory
    await fs.mkdir(this.sandboxPath, { recursive: true });

    // Create sandbox structure
    await this.createSandboxStructure();

    // Write task context to sandbox
    await this.writeTaskContext();

    console.log(`[Sandbox ${this.sandboxId}] Initialized for ${this.task.title}`);
    return this;
  }

  async createSandboxStructure() {
    const dirs = [
      'workspace',  // Agent working directory
      'output',     // Agent outputs, files created
      'logs',       // Agent execution logs
      'tmp'         // Temporary files
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.sandboxPath, dir), { recursive: true });
    }
  }

  async writeTaskContext() {
    const context = {
      task: {
        id: this.task.id,
        type: this.task.type,
        phase: this.task.phase,
        title: this.task.title,
        description: this.task.description,
        parentNoteId: this.task.parentNoteId,
        projectId: this.task.projectId,
        priority: this.task.priority,
        estimatedDuration: this.task.estimatedDuration
      },
      sandbox: {
        id: this.sandboxId,
        workspace: path.join(this.sandboxPath, 'workspace'),
        output: path.join(this.sandboxPath, 'output'),
        tmp: path.join(this.sandboxPath, 'tmp')
      },
      verification: this.task.verification,
      rules: {
        workspace: 'Working directory for this task',
        output: 'Save all outputs here',
        logs: 'All logs go here',
        'max-duration': `${this.task.estimatedDuration} minutes`
      },
      created: new Date()
    };

    await fs.writeFile(
      path.join(this.sandboxPath, 'task-context.json'),
      JSON.stringify(context, null, 2),
      'utf-8'
    );

    // Write README in workspace
    const checklist = (this.task.verification && this.task.verification.checklist && this.task.verification.checklist.length > 0)
      ? this.task.verification.checklist.map(item => `- [ ] ${item}`).join('\n')
      : 'No checklist';

    const readmeContent = `# Task: ${this.task.title}

${this.task.description}

## Sandbox Directory Structure
- \`workspace/\`: Your working directory
- \`output/\`: Save your outputs here
- \`logs/\`: Execution logs (automated)
- \`tmp/\`: Temporary files

## Task Details
- ID: ${this.task.id}
- Type: ${this.task.type}
- Phase: ${this.task.phase}
- Project: ${this.task.projectId}
- Priority: ${this.task.priority}
- Estimated Duration: ${this.task.estimatedDuration} minutes

## Verification Checklist
${checklist}

## Completion
When complete, create a \`completion-report.md\` in \`output/\` directory with:
1. Summary of what was done
2. Results/outcomes
3. Any issues encountered
4. Verification of checklist items
`;

    await fs.writeFile(
      path.join(this.sandboxPath, 'workspace', 'README.md'),
      readmeContent,
      'utf-8'
    );
  }

  async launchAgent(agentType) {
    console.log(`[Sandbox ${this.sandboxId}] Launching agent: ${agentType}`);

    // Determine command based on agent type
    // In a real implementation, this would use the existing agent CLIs from Chronos
    const command = this.getAgentCommand(agentType, this.sandboxPath);

    this.process = spawn('cmd', ['/c', command], {
      cwd: path.join(this.sandboxPath, 'workspace'),
      shell: true,
      env: {
        ...process.env,
        SANDBOX_ID: this.sandboxId,
        TASK_ID: this.task.id,
        AGENT_TYPE: agentType,
        WORKSPACE_DIR: path.join(this.sandboxPath, 'workspace'),
        OUTPUT_DIR: path.join(this.sandboxPath, 'output')
      }
    });

    this.status = 'running';
    this.startTime = new Date();

    // Capture output
    const logPath = path.join(this.sandboxPath, 'logs', 'execution.log');
    const logStream = await fs.open(logPath, 'a');

    this.process.stdout.on('data', (data) => {
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] STDOUT: ${data}`;
      logStream.write(logLine);
    });

    this.process.stderr.on('data', (data) => {
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] STDERR: ${data}`;
      logStream.write(logLine);
    });

    this.process.on('close', async (code) => {
      this.status = code === 0 ? 'completed' : 'failed';
      await logStream.close();
      console.log(`[Sandbox ${this.sandboxId}] Agent process exited with code ${code}`);
    });

    return this.process;
  }

  getAgentCommand(agentType, sandboxPath) {
    // Map agent types to Chronos CLI commands
    // This would integrate with your existing Chronos system
    const agentCommands = {
      'researcher': 'claude-cli',
      'planner': 'claude-cli',
      'executor': 'claude-cli',
      'reviewer': 'claude-cli',
      'debugger': 'claude-cli',
      'default': 'claude-cli'
    };

    const cli = agentCommands[agentType] || agentCommands['default'];

    // Construct command with sandbox-specific instructions
    const instructions = `
You are operating in an isolated sandbox for a specific task.

Task: ${this.task.title}
Description: ${this.task.description}
Type: ${this.task.type}

Your working directory is: ${path.join(sandboxPath, 'workspace')}
Save outputs to: ${path.join(sandboxPath, 'output')}

When complete, create a completion report in the output directory.
    `.trim();

    // In real implementation, this would pass instructions via CLI or IPC
    return `echo "${instructions.replace(/\n/g, ' ')}" && ${cli}`;
  }

  getStatus() {
    return {
      sandboxId: this.sandboxId,
      status: this.status,
      startTime: this.startTime,
      pid: this.process?.pid,
      uptime: this.startTime ? (new Date() - this.startTime) / 1000 : 0
    };
  }

  async collectOutput() {
    const outputDir = path.join(this.sandboxPath, 'output');

    // Look for completion report
    try {
      const reportPath = path.join(outputDir, 'completion-report.md');
      const report = await fs.readFile(reportPath, 'utf-8');
      return { success: true, report };
    } catch {
      return { success: false, error: 'No completion report found' };
    }
  }

  async getLogs() {
    const logPath = path.join(this.sandboxPath, 'logs', 'execution.log');
    try {
      return await fs.readFile(logPath, 'utf-8');
    } catch {
      return 'No logs available';
    }
  }

  async cleanup() {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }

    // Optionally keep sandbox for debugging or remove it
    // await fs.rm(this.sandboxPath, { recursive: true });

    console.log(`[Sandbox ${this.sandboxId}] Cleaned up`);
  }

  generateSandboxId(taskId, agentType) {
    const shortId = taskId.split('-').slice(-1)[0];
    return `${agentType}-${shortId}-${Date.now().toString(36)}`;
  }
}

export class SandboxManager {
  constructor() {
    this.activeSandboxes = new Map();
  }

  async createSandbox(task) {
    const sandbox = new AgentSandbox(task);
    await sandbox.init();
    this.activeSandboxes.set(sandbox.sandboxId, sandbox);
    return sandbox;
  }

  async launchAndExecute(task, agentType) {
    const sandbox = await this.createSandbox(task);

    try {
      const process = await sandbox.launchAgent(agentType);

      // Monitor for timeout or completion
      const timeoutMs = task.estimatedDuration * 60 * 1000 + 5 * 60 * 1000; // estimated + 5min buffer

      await new Promise((resolve, reject) => {
        if (process.killed) {
          resolve();
        } else {
          process.on('close', resolve);

          // Timeout safety
          setTimeout(() => {
            if (!sandbox.status.match(/completed|failed/)) {
              sandbox.status = 'timeout';
              process.kill();
              resolve();
            }
          }, timeoutMs);
        }
      });

      const output = await sandbox.collectOutput();
      const logs = await sandbox.getLogs();

      return {
        success: output.success,
        output: output,
        logs: logs,
        status: sandbox.status,
        sandboxId: sandbox.sandboxId
      };

    } finally {
      // Keep sandbox for review, but mark as completed
      // await sandbox.cleanup();
    }
  }

  async getSandboxStatus(sandboxId) {
    const sandbox = this.activeSandboxes.get(sandboxId);
    return sandbox ? sandbox.getStatus() : null;
  }

  async cleanupSandbox(sandboxId) {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (sandbox) {
      await sandbox.cleanup();
      this.activeSandboxes.delete(sandboxId);
    }
  }

  cleanupAll() {
    for (const sandbox of this.activeSandboxes.values()) {
      sandbox.cleanup();
    }
    this.activeSandboxes.clear();
  }
}

export default SandboxManager;
