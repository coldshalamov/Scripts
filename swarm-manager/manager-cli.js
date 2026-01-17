/**
 * Manager CLI
 * Orchestrates agents, manages task queue, provides unified interface
 * Supports timer-based orchestration and verification layers
 */
import chalk from 'chalk';
import readline from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

import KnowledgeBase from './knowledge-base.js';
import TaskEngine from './task-engine.js';
import SandboxManager from './agent-sandbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ManagerCLI {
  constructor(config = {}) {
    this.kb = new KnowledgeBase();
    this.taskEngine = new TaskEngine(this.kb);
    this.sandboxManager = new SandboxManager();

    this.agents = new Map();
    this.isRunning = false;
    this.autoOrchestrate = false;
    this.checkInterval = null;

    this.config = {
      pollInterval: 30000, // 30 seconds
      maxConcurrent: 1, // Start conservative
      ...config
    };

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async init() {
    console.log(chalk.cyan.bold('╔════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║     SWARM MANAGER - Initialization          ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝\n'));

    await this.kb.init();
    await this.loadAgentConfig();

    console.log(chalk.green(`✓ Knowledge Base loaded: ${this.kb.getStats().notes} notes, ${this.kb.getStats().projects} projects`));
    console.log(chalk.green(`✓ Available agents: ${Array.from(this.agents.keys()).join(', ')}`));
    console.log(chalk.green(`✓ Task Engine initialized`));
    console.log(chalk.green(`✓ Sandbox Manager initialized\n`));

    this.setupAutoOrchestration();
  }

  async loadAgentConfig() {
    // Load agent definitions from kb/agents/ or use defaults
    const defaultAgents = {
      'claude': { type: 'llm', capabilities: ['research', 'plan', 'execute', 'review'], cli: 'claude-cli' },
      'gemini': { type: 'llm', capabilities: ['research', 'plan', 'execute'], cli: 'gemini-cli' },
      'codex': { type: 'llm', capabilities: ['execute', 'code'], cli: 'codex-cli' },
      'jules': { type: 'llm', capabilities: ['execute', 'fix'], cli: 'jules-cli' }
    };

    for (const [id, config] of Object.entries(defaultAgents)) {
      this.agents.set(id, config);
    }

    // Load custom agent profiles from KB
    for (const [agentId, agentConfig] of this.kb.agents) {
      this.agents.set(agentId, agentConfig);
    }
  }

  setupAutoOrchestration() {
    // periodic check for pending tasks
    this.checkInterval = setInterval(() => {
      if (this.autoOrchestrate) {
        this.orchestrateNext();
      }
    }, this.config.pollInterval);
  }

  async start() {
    await this.init();
    this.isRunning = true;

    console.log(chalk.yellow('\nType "help" for available commands\n'));

    while (this.isRunning) {
      const command = await this.prompt(chalk.cyan('swarm> '));
      await this.executeCommand(command.trim());
    }

    this.rl.close();
  }

  async prompt(question) {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }

  async executeCommand(input) {
    if (!input) return;

    const [cmd, ...args] = input.split(' ').filter(Boolean);
    const command = cmd.toLowerCase();

    try {
      switch (command) {
        case 'help':
        case '?':
          this.showHelp();
          break;

        case 'note':
        case 'add-note':
          await this.handleAddNote(args.join(' '));
          break;

        case 'notes':
        case 'list-notes':
          this.listNotes();
          break;

        case 'tasks':
          this.listTasks();
          break;

        case 'queue':
          this.showQueue();
          break;

        case 'decompose':
          await this.decomposeNote(args[0]);
          break;

        case 'orchestrate':
          await this.orchestrateNext();
          break;

        case 'auto':
          this.toggleAutoOrchestration();
          break;

        case 'agents':
          this.listAgents();
          break;

        case 'agent':
          await this.showAgentInfo(args[0]);
          break;

        case 'projects':
          this.listProjects();
          break;

        case 'status':
          this.showStatus();
          break;

        case 'stats':
          this.showStats();
          break;

        case 'logs':
          await this.showLogs(args[0]);
          break;

        case 'test':
          await this.runTest();
          break;

        case 'exit':
        case 'quit':
        case 'q':
          await this.shutdown();
          break;

        default:
          console.log(chalk.red(`Unknown command: ${command}`));
          console.log(chalk.yellow('Type "help" for available commands'));
      }
    } catch (err) {
      console.log(chalk.red(`Error: ${err.message}`));
    }
  }

  showHelp() {
    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║              COMMANDS                        ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝\n'));

    console.log(chalk.yellow('Knowledge Base:'));
    console.log('  note <content>        - Add a new note (supports #project @tags)');
    console.log('  notes                 - List all notes');
    console.log('  projects              - List all projects\n');

    console.log(chalk.yellow('Task Management:'));
    console.log('  tasks                 - Show all tasks');
    console.log('  queue                 - Show task queue status');
    console.log('  decompose <note-id>   - Convert note to tasks\n');

    console.log(chalk.yellow('Orchestration:'));
    console.log('  orchestrate           - Execute next task in queue');
    console.log('  auto                  - Toggle auto-orchestration mode');
    console.log('  status                - Show current system status\n');

    console.log(chalk.yellow('Agent Management:'));
    console.log('  agents                - List available agents');
    console.log('  agent <id>            - Show agent details\n');

    console.log(chalk.yellow('System:'));
    console.log('  stats                 - Show statistics');
    console.log('  logs <sandbox-id>      - View sandbox logs');
    console.log('  test                  - Run test workflow');
    console.log('  exit                  - Shutdown manager\n');
  }

  async handleAddNote(content) {
    if (!content) {
      console.log(chalk.yellow('Usage: note <content>'));
      console.log(chalk.gray('Examples:'));
      console.log(chalk.gray('  note Add authentication feature #backend @feature'));
      console.log(chalk.gray('  note Fix login bug #frontend @bug @high'));
      return;
    }

    // Parse tags and project from content
    const tags = [];
    let projectId = 'general';
    let cleanContent = content;

    // Parse # tags (project)
    const projectMatch = content.match(/#(\w+)/);
    if (projectMatch) {
      projectId = projectMatch[1];
      cleanContent = cleanContent.replace(projectMatch[0], '');
    }

    // Parse @ tags (tags)
    const tagMatches = content.matchAll(/@(\w+)/g);
    for (const match of tagMatches) {
      tags.push(match[1]);
      cleanContent = cleanContent.replace(match[0], '');
    }

    const note = await this.kb.addNote(cleanContent.trim(), {
      project: projectId,
      tags: tags.join(', ')
    });

    console.log(chalk.green(`✓ Note added: ${note.title}`));
    console.log(chalk.gray(`   ID: ${note.id} | Project: ${projectId} | Tags: ${tags.join(', ') || 'none'}`));

    // Ask if user wants to decompose immediately
    const answer = await this.prompt(chalk.yellow('Decompose into tasks now? (y/n): '));
    if (answer.toLowerCase() === 'y') {
      await this.decomposeNote(note.id);
    }
  }

  listNotes() {
    const notes = Array.from(this.kb.notes.values())
      .sort((a, b) => b.created - a.created);

    if (notes.length === 0) {
      console.log(chalk.gray('No notes found'));
      return;
    }

    console.log(chalk.cyan.bold(`\nNOTES (${notes.length})\n`));

    notes.forEach((note, idx) => {
      const statusColors = {
        pending: chalk.yellow,
        in_progress: chalk.blue,
        completed: chalk.green
      };
      const statusColor = statusColors[note.status] || chalk.gray;

      console.log(`${idx + 1}. ${statusColor(`[${note.status.toUpperCase()}]`)} ${chalk.bold(note.title)}`);
      console.log(`   ID: ${note.id}`);
      console.log(`   Project: ${note.projectId} | Tags: ${note.tags.join(', ') || 'none'}`);
      console.log(`   ${note.content.slice(0, 100)}${note.content.length > 100 ? '...' : ''}`);
      console.log('');
    });
  }

  listTasks() {
    const tasks = Array.from(this.taskEngine.tasks.values())
      .sort((a, b) => b.createdAt - a.createdAt);

    if (tasks.length === 0) {
      console.log(chalk.gray('No tasks found. Decompose a note to create tasks.'));
      return;
    }

    console.log(chalk.cyan.bold(`\nTASKS (${tasks.length})\n`));

    tasks.forEach((task) => {
      const statusColors = {
        pending: chalk.gray,
        in_progress: chalk.blue,
        completed: chalk.green,
        failed: chalk.red
      };
      const statusColor = statusColors[task.status] || chalk.gray;

      console.log(`${statusColor(`[${task.status.toUpperCase()}]`)} ${task.title}`);
      console.log(`   ID: ${task.id} | Type: ${task.type} | Agent: ${task.agentType}`);
      console.log(`   Phase: ${task.phase} | Priority: ${task.priority}`);
      if (task.assignedAgent) {
        console.log(`   Assigned to: ${task.assignedAgent}`);
      }
      if (task.dependsOn) {
        console.log(`   Depends on: ${task.dependsOn}`);
      }
      console.log('');
    });
  }

  showQueue() {
    const queue = this.taskEngine.getQueueStatus();
    const taskQueue = this.taskEngine.taskQueue
      .map(id => this.taskEngine.tasks.get(id))
      .filter(task => task.status === 'pending' && this.taskEngine.dependenciesSatisfied(task));

    console.log(chalk.cyan.bold('\nQUEUE STATUS\n'));
    console.log(`Total: ${queue.total}`);
    console.log(chalk.gray(`  Pending: ${queue.pending}`));
    console.log(chalk.blue(`  In Progress: ${queue.inProgress}`));
    console.log(chalk.green(`  Completed: ${queue.completed}`));
    console.log(chalk.red(`  Failed: ${queue.failed}`));

    if (queue.activeTask) {
      console.log(chalk.yellow(`\nActive Task: ${queue.activeTask.title}`));
    }

    if (taskQueue.length > 0) {
      console.log(chalk.cyan.bold('\nREADY TO EXECUTE:\n'));
      taskQueue.forEach((task, idx) => {
        console.log(`${idx + 1}. ${task.title}`);
        console.log(`   ID: ${task.id} | ${task.agentType} | ~${task.estimatedDuration}min`);
      });
    }
  }

  async decomposeNote(noteId) {
    const note = this.kb.notes.get(noteId);
    if (!note) {
      console.log(chalk.red(`Note not found: ${noteId}`));
      return;
    }

    console.log(chalk.cyan(`\nDecomposing note: ${note.title}`));

    const tasks = await this.taskEngine.noteToTasks(note);

    console.log(chalk.green(`✓ Created ${tasks.length} tasks\n`));

    tasks.forEach((task, idx) => {
      console.log(`${idx + 1}. ${task.type}: ${task.title}`);
      console.log(`   Phase: ${task.phase} | Agent: ${task.agentType}`);
    });

    console.log('');
    console.log(chalk.yellow('Ready to orchestrate. Type "orchestrate" to execute next task.'));
  }

  async orchestrateNext() {
    const task = this.taskEngine.getNextTask();

    if (!task) {
      console.log(chalk.yellow('No tasks ready to execute.'));
      return;
    }

    console.log(chalk.cyan.bold(`\n╔════════════════════════════════════════════╗`));
    console.log(chalk.cyan.bold(`║  EXECUTING TASK                              ║`));
    console.log(chalk.cyan.bold(`╚════════════════════════════════════════════╝\n`));

    console.log(chalk.bold(task.title));
    console.log(chalk.gray(`ID: ${task.id}`));
    console.log(chalk.gray(`Type: ${task.type} | Agent: ${task.agentType}`));
    console.log(chalk.gray(`Estimated: ${task.estimatedDuration} minutes\n`));

    // Start task
    const agent = await this.selectAgentForTask(task);
    this.taskEngine.startTask(task.id, agent);

    console.log(chalk.blue(`✓ Assigned to: ${agent}`));
    console.log(chalk.yellow('Launching sandbox...\n'));

    try {
      // Launch in sandbox
      const result = await this.sandboxManager.launchAndExecute(task, agent);

      if (result.success && result.output.success) {
        console.log(chalk.green('\n✓ Task completed successfully'));

        const report = result.output.report;
        if (report) {
          console.log(chalk.gray('\n--- Completion Report ---'));
          console.log(report);
          console.log(chalk.gray('------------------------\n'));
        }

        this.taskEngine.completeTask(task.id, result);

        // Update parent note status if all tasks complete
        await this.checkNoteCompletion(task.parentNoteId);

      } else {
        console.log(chalk.red('\n✗ Task failed or incomplete'));
        if (result.output.error) {
          console.log(chalk.red(`Error: ${result.output.error}`));
        }
        this.taskEngine.failTask(task.id, result.output.error || 'Execution failed');
      }

      // Show next ready tasks
      const nextTasks = this.taskEngine.taskQueue
        .map(id => this.taskEngine.tasks.get(id))
        .filter(t => t.status === 'pending' && this.taskEngine.dependenciesSatisfied(t));

      if (nextTasks.length > 0) {
        console.log(chalk.cyan.bold(`\n${nextTasks.length} task(s) ready for execution`));
      } else {
        console.log(chalk.cyan.bold(`\nNo more tasks ready. Waiting for dependencies...`));
      }

    } catch (err) {
      console.log(chalk.red(`\n✗ Error: ${err.message}`));
      this.taskEngine.failTask(task.id, err.message);
    }
  }

  async selectAgentForTask(task) {
    const taskInfo = `${task.type}/${task.phase} task "${task.title}"`;

    // Auto-select based on agent capabilities
    const agentTypes = Array.from(this.agents.entries())
      .filter(([id, config]) => config.capabilities?.includes(task.phase) || config.capabilities?.includes(task.type))
      .map(([id]) => id);

    if (agentTypes.length === 0) {
      console.log(chalk.yellow('No specialized agents found, using default...'));
      return 'claude'; // Default fallback
    }

    if (agentTypes.length === 1) {
      return agentTypes[0];
    }

    // Multiple capable agents - let user choose (or could auto-select)
    console.log(chalk.yellow(`Multiple agents available for ${taskInfo}:`));
    agentTypes.forEach((id, idx) => {
      const agent = this.agents.get(id);
      console.log(`${idx + 1}. ${id} (${agent.capabilities?.join(', ') || 'general'})`);
    });

    const answer = await this.prompt(chalk.yellow('Select agent (1): '));
    const selection = answer ? parseInt(answer) - 1 : 0;

    return agentTypes[selection] || agentTypes[0];
  }

  async checkNoteCompletion(noteId) {
    const tasks = this.taskEngine.getTasksByNote(noteId);
    const allDone = tasks.every(t => t.status === 'completed');

    if (allDone && tasks.length > 0) {
      await this.kb.updateNote(noteId, { status: 'completed' });
      console.log(chalk.green(`\n✓ Note "${noteId}" marked as complete!`));
    }
  }

  toggleAutoOrchestration() {
    this.autoOrchestrate = !this.autoOrchestrate;

    if (this.autoOrchestrate) {
      console.log(chalk.green('✓ Auto-orchestration ENABLED'));
      console.log(chalk.gray(`  Checking every ${this.config.pollInterval / 1000}s for tasks`));
      console.log(chalk.gray('  Type "auto" again to disable'));
    } else {
      console.log(chalk.yellow('✗ Auto-orchestration DISABLED'));
    }
  }

  listAgents() {
    console.log(chalk.cyan.bold('\nAVAILABLE AGENTS\n'));

    this.agents.forEach((config, id) => {
      console.log(`${chalk.bold(id)}`);
      console.log(`  Type: ${config.type || 'unknown'}`);
      console.log(`  Capabilities: ${config.capabilities?.join(', ') || 'general'}`);
      if (config.cli) {
        console.log(`  CLI: ${config.cli}`);
      }
      console.log('');
    });
  }

  async showAgentInfo(agentId) {
    const agent = this.agents.get(agentId);

    if (!agent) {
      console.log(chalk.red(`Agent not found: ${agentId}`));
      return;
    }

    console.log(chalk.cyan.bold(`\nAGENT: ${agentId}\n`));
    console.log(`Type: ${agent.type || 'unknown'}`);
    console.log(`Capabilities: ${agent.capabilities?.join(', ') || 'general'}`);
    console.log(`CLI: ${agent.cli || 'none'}`);

    // Fetch instructions from KB
    const instructions = await this.kb.getAgentInstructions(agentId);
    console.log(chalk.gray('\nInstructions:\n'));
    console.log(instructions.instructions);
  }

  listProjects() {
    const projects = Array.from(this.kb.projects.values());

    if (projects.length === 0) {
      console.log(chalk.gray('No projects found'));
      return;
    }

    console.log(chalk.cyan.bold('\nPROJECTS\n'));

    projects.forEach(project => {
      console.log(`${chalk.bold(project.name)}`);
      console.log(`  ID: ${project.id}`);
      console.log(`  Status: ${project.status}`);
      console.log(`  Notes: ${project.notes.length}`);
      console.log(`  Description: ${project.description || 'none'}`);
      console.log('');
    });
  }

  showStatus() {
    const kbStats = this.kb.getStats();
    const queue = this.taskEngine.getQueueStatus();

    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║           SYSTEM STATUS                    ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝\n'));

    console.log(chalk.bold('Knowledge Base:'));
    console.log(`  Notes: ${kbStats.notes} (pending: ${kbStats.pending}, completed: ${kbStats.completed})`);
    console.log(`  Projects: ${kbStats.projects}`);

    console.log(chalk.bold('\nTask Engine:'));
    console.log(`  Total tasks: ${queue.total}`);
    console.log(`  Pending: ${queue.pending} | In Progress: ${queue.inProgress}`);
    console.log(`  Completed: ${queue.completed} | Failed: ${queue.failed}`);

    if (queue.activeTask) {
      console.log(chalk.yellow(`\nActive Task: ${queue.activeTask.title}`));
    }

    console.log(chalk.bold('\nOrchestration:'));
    console.log(`  Auto-orchestrate: ${this.autoOrchestrate ? chalk.green('ON') : chalk.gray('OFF')}`);

    console.log(chalk.bold('\nSandbox Manager:'));
    console.log(`  Active sandboxes: ${this.sandboxManager.activeSandboxes.size}`);
  }

  showStats() {
    const kbStats = this.kb.getStats();
    const queue = this.taskEngine.getQueueStatus();

    console.log(chalk.cyan.bold('\nSTATISTICS\n'));

    const tasks = Array.from(this.taskEngine.tasks.values());
    const avgDuration = tasks
      .filter(t => t.actualDuration)
      .reduce((sum, t) => sum + t.actualDuration, 0) /
      (tasks.filter(t => t.actualDuration).length || 1);

    console.log(`Total Notes Processed: ${kbStats.notes}`);
    console.log(`Total Tasks Created: ${queue.total}`);
    console.log(`Tasks Completed: ${queue.completed}`);
    console.log(`Tasks Failed: ${queue.failed}`);
    console.log(`Success Rate: ${queue.total ? ((queue.completed / queue.total) * 100).toFixed(1) : 0}%`);
    console.log(`Average Task Duration: ${avgDuration.toFixed(2)} minutes`);
  }

  async showLogs(sandboxId) {
    if (!sandboxId) {
      // List recent sandboxes
      const sandboxes = Array.from(this.sandboxManager.activeSandboxes.keys()).slice(-10);

      if (sandboxes.length === 0) {
        console.log(chalk.gray('No sandbox logs available'));
        return;
      }

      console.log(chalk.cyan.bold('\nRECENT SANDBOXES\n'));
      sandboxes.forEach(id => {
        const sandbox = this.sandboxManager.activeSandboxes.get(id);
        console.log(`${id} - Status: ${sandbox.status}`);
      });

      return;
    }

    const sandbox = this.sandboxManager.activeSandboxes.get(sandboxId);

    if (!sandbox) {
      console.log(chalk.red(`Sandbox not found: ${sandboxId}`));
      return;
    }

    const logs = await sandbox.getLogs();

    console.log(chalk.cyan.bold(`\nLOGS: ${sandboxId}\n`));
    console.log(logs);
  }

  async runTest() {
    console.log(chalk.yellow('\nRunning test workflow...\n'));

    // Add test note
    const note = await this.kb.addNote(
      'Create a simple REST API endpoint for user authentication',
      {
        project: 'test-project',
        tags: 'feature,api',
        priority: 'medium'
      }
    );

    console.log(chalk.green(`✓ Added test note: ${note.id}`));

    // Decompose
    await this.decomposeNote(note.id);

    // Orchestrate first task (research)
    const answer = await this.prompt(chalk.yellow('Execute first task? (y/n): '));
    if (answer.toLowerCase() === 'y') {
      await this.orchestrateNext();
    }
  }

  async shutdown() {
    console.log(chalk.cyan('\nShutting down Swarm Manager...'));

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.sandboxManager.cleanupAll();

    console.log(chalk.green('✓ Clean shutdown complete'));
  }
}

export default ManagerCLI;
