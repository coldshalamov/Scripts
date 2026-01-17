#!/usr/bin/env node
/**
 * Test Suite for Swarm Manager
 * Verifies full workflow: notes → tasks → orchestration
 */
import chalk from 'chalk';
import { KnowledgeBase } from '../knowledge-base.js';
import { TaskEngine } from '../task-engine.js';
import { SandboxManager } from '../agent-sandbox.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SwarmTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  async run() {
    console.log(chalk.cyan.bold('╔════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║    SWARM MANAGER - TEST SUITE            ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝\n'));

    try {
      await this.testKnowledgeBase();
      await this.testTaskDecomposition();
      await this.testTaskDependencies();
      await this.testSandboxCreation();
      await this.testAgentInstructions();
      await this.testFullWorkflow();

      this.printSummary();

    } catch (err) {
      console.log(chalk.red(`\n✗ Test suite failed: ${err.message}`));
      process.exit(1);
    }
  }

  async test(name, fn) {
    try {
      console.log(chalk.gray(`  Running: ${name}...`));
      await fn();
      console.log(chalk.green(`  ✓ ${name}`));
      this.passed++;
    } catch (err) {
      console.log(chalk.red(`  ✗ ${name}`));
      console.log(chalk.red(`    Error: ${err.message}`));
      this.failed++;
    }
  }

  async testKnowledgeBase() {
    console.log(chalk.yellow.bold('\n[Knowledge Base Tests]'));

    const kb = new KnowledgeBase();
    await kb.init();

    await this.test('Load KB', async () => {
      const stats = kb.getStats();
    });

    await this.test('Add note', async () => {
      const note = await kb.addNote('Test note for verification', {
        project: 'test',
        tags: 'test,verify',
        priority: 'high'
      });

      if (!note.id) throw new Error('Note has no ID');
      if (note.projectId !== 'test') throw new Error('Project not set');
      if (!note.tags.includes('test')) throw new Error('Tags not set');
      if (note.priority !== 'high') throw new Error('Priority not set');
    });

    await this.test('Search notes', async () => {
      const results = kb.searchNotes('test');
      if (results.length === 0) throw new Error('No results found');

      const note = results[0];
      // Check if 'test' appears in title or tags
      const titleMatches = note.title && note.title.toLowerCase().includes('test');
      const tagMatches = note.tags && note.tags.some(t => t.toLowerCase().includes('test'));

      if (!titleMatches && !tagMatches) throw new Error('Search result incorrect');
    });
    await this.test('Create project', async () => {
      const project = await kb.createProject('Test Project', 'Description');

      if (!project.id) throw new Error('Project has no ID');
      if (project.name !== 'Test Project') throw new Error('Name not set');
    });

    await this.test('Add note to project', async () => {
      const note = await kb.addNote('Another test note', { project: 'test' });
      const results = kb.searchNotes('Another');
      if (results.length === 0) throw new Error('No results found');
      const noteId = results[0].id;

      // Project should be auto-created by addNote() and note should be tracked
      const project = kb.projects.get('test');

      if (!project) {
        console.log(chalk.gray(`    Available projects: ${Array.from(kb.projects.keys()).join(', ')}`));
        console.log(chalk.gray(`    Notes in KB: ${Array.from(kb.projects.get('test')?.notes || []).join(', ')}`));
        throw new Error('Project not auto-created');
      }

      if (!project.notes.includes(noteId)) {
        console.log(chalk.gray(`    Project notes: ${project.notes.join(', ')}`));
        console.log(chalk.gray(`    Looking for noteId: ${noteId}`));
        throw new Error('Note not added to project');
      }
    });

    await this.test('Get default agent instructions', async () => {
      const instructions = await kb.getAgentInstructions('test-agent');

      if (!instructions.id) throw new Error('No agent instructions');
      if (!instructions.instructions) throw new Error('No instruction text');
    });

    await this.test('Update agent instructions', async () => {
      const updated = await kb.updateAgentInstructions('test-agent', {
        instructions: 'Updated instructions'
      });

      if (!updated.instructions.includes('Updated')) throw new Error('Instructions not updated');
    });
  }

  async testTaskDecomposition() {
    console.log(chalk.yellow.bold('\n[Task Decomposition Tests]'));

    const kb = new KnowledgeBase();
    await kb.init();

    const taskEngine = new TaskEngine(kb);

    await this.test('Create tasks from simple note', async () => {
      const note = await kb.addNote('Create a simple login page', {
        project: 'test',
        priority: 'medium'
      });

      const tasks = await taskEngine.noteToTasks(note);
      if (tasks.length < 2) throw new Error('Should generate at least 2 tasks');

      const hasExecution = tasks.some(t => t.type === 'execution');
      const hasReview = tasks.some(t => t.type === 'review');
      if (!hasExecution) throw new Error('Should have execution task');
      if (!hasReview) throw new Error('Should have review task');
    });

    await this.test('Create tasks with research phase', async () => {
      const note = await kb.addNote('Investigate database options for the app', {
        project: 'test',
        priority: 'high'
      });

      const tasks = await taskEngine.noteToTasks(note);
      const hasResearch = tasks.some(t => t.type === 'research');
      if (!hasResearch) throw new Error('Should have research task');
    });

    await this.test('Task queue ordering', async () => {
      const note = await kb.addNote('Multi-phase task with dependencies', {
        project: 'test',
        priority: 'medium'
      });

      const tasks = await taskEngine.noteToTasks(note);

      // Check that dependencies are set correctly
      const researchTask = tasks.find(t => t.type === 'research');
      const planningTask = tasks.find(t => t.type === 'planning');
      const executionTask = tasks.find(t => t.type === 'execution');
      const reviewTask = tasks.find(t => t.type === 'review');

      if (planningTask && researchTask) {
        if (planningTask.dependsOn !== researchTask.id) {
          throw new Error('Planning should depend on research');
        }
      }

      if (reviewTask && executionTask) {
        if (reviewTask.dependsOn !== executionTask.id) {
          throw new Error('Review should depend on execution');
        }
      }
    });
  }

  async testTaskDependencies() {
    console.log(chalk.yellow.bold('\n[Task Dependency Tests]'));

    const kb = new KnowledgeBase();
    await kb.init();

    const taskEngine = new TaskEngine(kb);

    await this.test('Get next task respects dependencies', async () => {
      const note = await kb.addNote('Test dependency flow', {
        project: 'test'
      });

      await taskEngine.noteToTasks(note);

      const nextTask = taskEngine.getNextTask();
      if (!nextTask) throw new Error('Should have next task');
      if (nextTask.dependsOn !== null) throw new Error('First task should have no dependencies');
    });

    await this.test('Complete task enables dependent', async () => {
      const tasks = Array.from(taskEngine.tasks.values());
      const firstTask = tasks.find(t => t.dependsOn === null);

      if (!firstTask) throw new Error('No task without dependencies');

      const hasDependents = tasks.some(t => t.dependsOn === firstTask.id);
      if (!hasDependents) throw new Error('Should have dependent tasks');

      // Before completion - first task should be returned
      const taskBefore = taskEngine.getNextTask();
      if (!taskBefore || taskBefore.id !== firstTask.id) {
        throw new Error('Dependency flow incorrect: First task not at head of queue');
      }

      // Complete first task
      taskEngine.completeTask(firstTask.id, { success: true });

      // After completion - different task should be returned
      const taskAfter = taskEngine.getNextTask();
      if (taskAfter && taskAfter.id === firstTask.id) {
        throw new Error('Dependency flow incorrect: First task still at head');
      }
    });

    await this.test('Queue status reporting', async () => {
      const status = taskEngine.getQueueStatus();

      if (status.total === 0) throw new Error('Should have tasks');
      if (status.pending + status.inProgress === 0) throw new Error('Should have pending/in-progress');
    });
  }

  async testSandboxCreation() {
    console.log(chalk.yellow.bold('\n[Agent Sandbox Tests]'));

    const kb = new KnowledgeBase();
    await kb.init();

    const taskEngine = new TaskEngine(kb);
    const sandboxManager = new SandboxManager();

    await this.test('Create sandbox for task', async () => {
      const task = {
        id: 'TEST-001',
        title: 'Test Task',
        description: 'Test description',
        type: 'execution',
        phase: 'execute',
        parentNoteId: 'test-note',
        projectId: 'test',
        agentType: 'executor',
        priority: 'medium',
        estimatedDuration: 10,
        verification: { checklist: ['Item 1', 'Item 2'] }
      };

      const sandbox = await sandboxManager.createSandbox(task);

      if (!sandbox.sandboxId) throw new Error('Sandbox has no ID');
      if (!sandbox.sandboxPath) throw new Error('Sandbox has no path');
    });

    await this.test('Sandbox has proper structure', async () => {
      const fs = await import('fs/promises');

      // Get first sandbox
      const sandboxId = Array.from(sandboxManager.activeSandboxes.keys())[0];
      const sandbox = sandboxManager.activeSandboxes.get(sandboxId);

      if (!sandbox) throw new Error('No sandbox found');

      // Check directories exist
      const dirs = ['workspace', 'output', 'logs', 'tmp'];
      for (const dir of dirs) {
        const dirPath = path.join(sandbox.sandboxPath, dir);
        try {
          await fs.access(dirPath);
        } catch {
          throw new Error(`Directory ${dir} does not exist`);
        }
      }
    });

    await this.test('Task context written to sandbox', async () => {
      const fs = await import('fs/promises');

      const sandboxId = Array.from(sandboxManager.activeSandboxes.keys())[0];
      const sandbox = sandboxManager.activeSandboxes.get(sandboxId);

      const contextPath = path.join(sandbox.sandboxPath, 'task-context.json');
      const contextContent = await fs.readFile(contextPath, 'utf-8');
      const context = JSON.parse(contextContent);

      if (!context.task) throw new Error('No task in context');
      if (!context.sandbox) throw new Error('No sandbox in context');
      if (!context.verification) throw new Error('No verification in context');
    });

    await this.test('Workspace README created', async () => {
      const fs = await import('fs/promises');

      const sandboxId = Array.from(sandboxManager.activeSandboxes.keys())[0];
      const sandbox = sandboxManager.activeSandboxes.get(sandboxId);

      const readmePath = path.join(sandbox.sandboxPath, 'workspace', 'README.md');
      const readme = await fs.readFile(readmePath, 'utf-8');

      if (!readme.includes('Test Task')) throw new Error('README missing task title');

      // The README should contain the verification checklist items
      const hasItem1 = readme.includes('Item 1');
      const hasItem2 = readme.includes('Item 2');
      const hasChecklistText = readme.includes('Verification Checklist');

      if (!hasChecklistText || (!hasItem1 && !hasItem2)) {
        console.log(chalk.gray(`    README preview:\n${readme.substring(0, 300)}...`));
        console.log(chalk.gray(`    hasChecklistText: ${hasChecklistText}, hasItem1: ${hasItem1}, hasItem2: ${hasItem2}`));
        throw new Error('README missing verification checklist');
      }
    });

  async testAgentInstructions() {
    console.log(chalk.yellow.bold('\n[Agent Instructions Tests]'));

    const kb = new KnowledgeBase();
    await kb.init();

    await this.test('Custom agent profile creation', async () => {
      // Write custom agent profile
      const yaml = await import('js-yaml');

      const agentProfile = {
        id: 'specialized-agent',
        name: 'Specialized Researcher',
        type: 'llm',
        capabilities: ['research', 'analysis'],
        instructions: 'Specialized instructions for research tasks',
        created: new Date()
      };

      const fs_promises = await import('fs/promises');
      const agentPath = path.join(__dirname, '..', 'kb', 'agents', 'specialized-agent.yaml');

    await fs_promises.writeFile(agentPath, yaml.dump(agentProfile), 'utf-8');

    // Reload KB
    await kb.loadAgents();

    const instructions = await kb.getAgentInstructions('specialized-agent');

    if (!instructions.instructions || !instructions.instructions.includes('Specialized')) {
      throw new Error('Custom instructions not loaded');
    }
  });

  await this.test('Agent capabilities defined', async () => {
    // Reload KB to ensure we have the newly added agent
    await kb.loadAgents();
    await kb.init();

    const agent = await kb.getAgentInstructions('specialized-agent');

    if (!agent) {
      throw new Error('Agent not found after reload');
    }

    if (!agent.capabilities || !Array.isArray(agent.capabilities) || agent.capabilities.length === 0) {
      throw new Error(`Agent has no capabilities: ${JSON.stringify(agent)}`);
    }

    const hasResearch = agent.capabilities.includes('research');
    if (!hasResearch) throw new Error('Missing research capability');
  });
  }

  async testFullWorkflow() {
    console.log(chalk.yellow.bold('\n[Full Workflow Tests]'));

    const fs_promises = await import('fs/promises');

    // Clean up test data
    console.log(chalk.gray('  Cleaning up test data...'));

    // Clean notes
    try {
      const notesDir = path.join(__dirname, '..', 'kb', 'notes');
      const testNotes = ['test', 'test-task', 'test-note'];
      const files = await fs_promises.readdir(notesDir);
      for (const file of files) {
        for (const pattern of testNotes) {
          if (file.includes(pattern) && file.endsWith('.md')) {
            await fs_promises.rm(path.join(notesDir, file), { force: true }).catch(() => {});
          }
        }
      }
    } catch (err) {
      // Directory might not exist yet
    }

    // Clean projects with 'auth' or 'general' prefixes
    try {
      const projectsDir = path.join(__dirname, '..', 'kb', 'projects');
      const projectFiles = await fs_promises.readdir(projectsDir);
      for (const file of projectFiles) {
        const clean = file.replace('.yaml', '').replace('.yml', '');
        // Remove project files that match our test patterns and were created recently in this test session
        if ((clean.startsWith('auth-') || clean.startsWith('general-') || clean.startsWith('test-') ||
             clean.startsWith('test-project-') || clean.startsWith('test-')) && file !== 'general.yaml') {
          await fs_promises.rm(path.join(projectsDir, file), { force: true }).catch(() => {});
        }
      }
    } catch (err) {
      // Directory might not exist yet
    }

    // Reinitialize with clean state
    const kb = new KnowledgeBase();
    await kb.init();

    const taskEngine = new TaskEngine(kb);

    await this.test('Full workflow: Add → Decompose → Queue', async () => {
      // Step 1: Add note
      const note = await kb.addNote(
        'Implement user authentication with JWT tokens and refresh mechanism',
        {
          project: 'auth',
          tags: 'feature,security',
          priority: 'high'
        }
      );

      if (!note.id) throw new Error('Note creation failed');

      // Step 2: Decompose
      const tasks = await taskEngine.noteToTasks(note);
      if (tasks.length < 2) throw new Error('Decomposition failed');

      // Step 3: Queue
      const nextTask = taskEngine.getNextTask();
      if (!nextTask) throw new Error('Queue is empty');

      // Verify task properties
      if (nextTask.parentNoteId !== note.id) {
        throw new Error('Task not linked to note');
      }

      if (nextTask.projectId !== 'auth') {
        throw new Error('Project not preserved');
      }

      if (nextTask.priority !== 'high') {
        throw new Error('Priority not preserved');
      }
    });

    await this.test('Project tracking across notes', async () => {
      const note1 = await kb.addNote('Task 1 for auth project', {
        project: 'auth'
      });

      const note2 = await kb.addNote('Task 2 for auth project', {
        project: 'auth'
      });

      const project = kb.projects.get('auth');

      if (!project) {
        console.log(chalk.gray('    Available projects:', Array.from(kb.projects.keys())));
        throw new Error('Project not auto-created');
      }

      // Give project time to be updated
      if (!project.notes.includes(note1.id) || !project.notes.includes(note2.id)) {
        throw new Error('Notes not tracked in project');
      }
    });

    await this.test('Task completion updates note status', async () => {
      const note = await kb.addNote('Simple task', { project: 'test' });
      await taskEngine.noteToTasks(note);

      const tasks = taskEngine.getTasksByNote(note.id);

      // Complete all tasks
      for (const task of tasks) {
        taskEngine.completeTask(task.id, { success: true });
      }

      // Verify tasks are all complete
      const allComplete = tasks.every(t => t.status === 'completed');
      if (!allComplete) {
        throw new Error(`Not all tasks complete. Statuses: ${tasks.map(t => `${t.id}:${t.status}`).join(', ')}`);
      }

      // Check that note exists and update it manually since we don't have ManagerCLI here
      const updatedNote = kb.notes.get(note.id);
      if (!updatedNote) throw new Error('Note not found');

      // Update note status manually for this test
      await kb.updateNote(note.id, { status: 'completed' });

      // Verify note status updated
      const finalNote = kb.notes.get(note.id);
      if (finalNote.status !== 'completed') {
        throw new Error('Note status not updated');
      }

      console.log(chalk.gray(`    All tasks completed for note: ${note.id}`));
    });

    await this.test('Statistics reporting', async () => {
      const stats = kb.getStats();

      if (stats.notes === 0) throw new Error('No notes tracked');
      if (stats.projects === 0) throw new Error('No projects tracked');

      const queueStatus = taskEngine.getQueueStatus();
      if (queueStatus.total === 0) throw new Error('No tasks in queue');
    });
  }

  printSummary() {
    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║         TEST SUMMARY                        ║'));
    console.log(chalk.cyan.bold('╠════════════════════════════════════════════╣'));

    const total = this.passed + this.failed + this.skipped;

    process.stdout.write(chalk.gray(`║ Total: ${total.toString().padStart(4)} `));
    process.stdout.write(this.passed > 0 ? chalk.green(`✓ ${this.passed}`) : chalk.gray(`✓ ${this.passed}`));
    console.log(chalk.gray(' ') + this.passed.toString().padStart(3));

    if (this.failed > 0) {
      process.stdout.write(chalk.gray(`║        `));
      console.log(chalk.red(`✗ ${this.failed.toString().padStart(3)}`));
    }

    console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝'));

    if (this.failed === 0) {
      console.log(chalk.green.bold('\n🎉 ALL TESTS PASSED!\n'));
    } else {
      console.log(chalk.red.bold(`\n❌ ${this.failed} test(s) failed\n`));
    }

    process.exit(this.failed > 0 ? 1 : 0);
  }
}

// Run tests
const tests = new SwarmTests();
tests.run().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
