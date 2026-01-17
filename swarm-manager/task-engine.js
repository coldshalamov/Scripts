/**
 * Task Decomposition Engine
 * Transforms user notes into structured research/plan/execute/review tasks
 * Manages task lifecycles and verification checkpoints
 */
export class TaskEngine {
  constructor(kb) {
    this.kb = kb;
    this.tasks = new Map();
    this.taskQueue = [];
    this.activeTask = null;
  }

  async noteToTasks(note) {
    console.log(`\n[TaskEngine] Decomposing note: "${note.title}"`);

    // Simple decomposition strategy (can be enhanced with LLM later)
    const phases = this.analyzeNote(note);

    const tasks = [];

    // Research Phase
    if (phases.needsResearch) {
      tasks.push(this.createTask({
        type: 'research',
        phase: 'research',
        parentNoteId: note.id,
        projectId: note.projectId,
        title: `Research: ${note.title}`,
        description: this.generateResearchPrompt(note),
        agentType: 'researcher', // Or specific agent
        priority: note.priority === 'high' ? 'high' : 'medium',
        estimatedDuration: 5, // minutes
        verification: {
          checklist: [
            'Identified key requirements',
            'Documented technical constraints',
            'Found relevant examples/patterns',
            'Assessed feasibility'
          ]
        }
      }));
    }

    // Planning Phase
    if (phases.needsPlanning || phases.needsDesign) {
      tasks.push(this.createTask({
        type: 'planning',
        phase: 'planning',
        parentNoteId: note.id,
        projectId: note.projectId,
        title: `Plan: ${note.title}`,
        description: this.generatePlanningPrompt(note, phases),
        agentType: 'planner',
        dependsOn: tasks.at(-1)?.id, // Depends on research if exists
        priority: note.priority,
        estimatedDuration: 10,
        verification: {
          checklist: [
            'Created detailed implementation plan',
            'Breakdown into subtasks',
            'Identified dependencies',
            'Estimated resources needed'
          ]
        }
      }));
    }

    // Execution Phase (split into subtasks)
    if (phases.needsExecution) {
      const subtasks = this.generateExecutionSubtasks(note, phases);

      subtasks.forEach(subtask => {
        tasks.push(this.createTask({
          type: 'execution',
          phase: 'execute',
          parentNoteId: note.id,
          projectId: note.projectId,
          title: subtask.title,
          description: subtask.description,
          agentType: subtask.agentType || 'executor',
          dependsOn: tasks.at(-1)?.id,
          priority: note.priority,
          estimatedDuration: subtask.duration || 15,
          verification: {
            checklist: subtask.verification || [
              'Implementation complete',
              'Tested functionality',
              'No obvious errors'
            ]
          }
        }));
      });
    }

    // Review Phase
    tasks.push(this.createTask({
      type: 'review',
      phase: 'review',
      parentNoteId: note.id,
      projectId: note.projectId,
      title: `Review: ${note.title}`,
      description: this.generateReviewPrompt(note),
      agentType: 'reviewer',
      dependsOn: tasks.at(-1)?.id,
      priority: note.priority === 'high' ? 'high' : 'medium',
      estimatedDuration: 5,
      verification: {
        checklist: [
          'Verified against original requirements',
          'Tested edge cases',
          'Documentation complete',
          'Ready for deployment'
        ]
      }
    }));

    console.log(`[TaskEngine] Generated ${tasks.length} tasks`);

    return tasks;
  }

  analyzeNote(note) {
    const content = note.content.toLowerCase();
    const phases = {
      needsResearch: false,
      needsPlanning: false,
      needsDesign: false,
      needsExecution: false,
      needsReview: true // Always review
    };

    // Detect research needs
    const researchKeywords = ['investigate', 'explore', 'research', 'analyze', 'find', 'evaluate', 'assess', 'study', 'understand'];
    if (researchKeywords.some(kw => content.includes(kw))) {
      phases.needsResearch = true;
    } else if (!content.includes('create') && !content.includes('build') && !content.includes('implement') && !content.includes('fix')) {
      // Default to research if no clear action verb
      phases.needsResearch = true;
    }

    // Detect planning needs
    const planningKeywords = ['plan', 'design', 'architecture', 'structure', 'organize', 'how to', 'best approach'];
    phases.needsPlanning = planningKeywords.some(kw => content.includes(kw));

    // Detect design needs
    const designKeywords = ['ui', 'interface', 'visual', 'layout', 'component', 'schema', 'api', 'system'];
    phases.needsDesign = designKeywords.some(kw => content.includes(kw));

    // Detect execution needs
    const executionKeywords = ['create', 'build', 'implement', 'fix', 'add', 'write', 'develop', 'code'];
    phases.needsExecution = executionKeywords.some(kw => content.includes(kw));

    return phases;
  }

  generateResearchPrompt(note) {
    return `
Research Task: ${note.title}

USER NOTE:
${note.content}

OBJECTIVES:
1. Understand the full scope and requirements
2. Identify technical constraints and dependencies
3. Find relevant patterns, examples, or best practices
4. Assess feasibility and potential risks

DELIVERABLES:
- Summary of requirements
- Technical constraints document
- Relevant patterns/references
- Feasibility assessment
- Recommendations for next steps
    `.trim();
  }

  generatePlanningPrompt(note, phases) {
    return `
Planning Task: ${note.title}

USER NOTE:
${note.content}

CONTEXT:
${phases.needsResearch ? 'Research phase completed. Use research findings.' : 'No research phase - plan from scratch.'}

OBJECTIVES:
1. Create a detailed implementation plan
2. Break down into clear subtasks
3. Identify dependencies and risks
4. Estimate resources and timeline
5. Design the architecture/approach

DELIVERABLES:
- Detailed implementation plan
- Subtask breakdown
- Dependency graph
- Risk assessment
- Resource estimates
    `.trim();
  }

  generateExecutionSubtasks(note, phases) {
    // Extract natural task structure from note content
    const lines = note.content.split('\n').filter(l => l.trim());

    const subtasks = [];

    // Check for numbered/bullet points in note
    const hasExplicitTasks = lines.some(l =>
      /^\s*(\d+\.|[-*])\s/.test(l)
    );

    if (hasExplicitTasks) {
      // Use user-defined subtasks
      for (const line of lines) {
        const taskMatch = line.match(/^\s*(\d+\.|[-*])\s+(.+)/);
        if (taskMatch) {
          const taskText = taskMatch[2];
          subtasks.push({
            title: taskText.slice(0, 50),
            description: `Execute: ${taskText}`,
            duration: 15,
            verification: ['Task completed', 'Verified', 'No errors']
          });
        }
      }
    } else {
      // Default breakdown based on content
      if (note.content.toLowerCase().includes('feature') || note.content.toLowerCase().includes('add')) {
        subtasks.push({
          title: 'Implement core functionality',
          description: `Implement the main feature described in "${note.title}"`,
          duration: 20,
          agentType: 'executor',
          verification: ['Core feature works', 'Tests pass', 'Code quality acceptable']
        });
        subtasks.push({
          title: 'Add tests',
          description: 'Write tests for the implemented functionality',
          duration: 10,
          agentType: 'executor',
          verification: ['Test coverage adequate', 'All tests pass']
        });
      }

      if (note.content.toLowerCase().includes('fix') || note.content.toLowerCase().includes('bug')) {
        subtasks.push({
          title: 'Diagnose issue',
          description: 'Identify root cause of the bug',
          duration: 10,
          agentType: 'debugger',
          verification: ['Root cause identified']
        });
        subtasks.push({
          title: 'Implement fix',
          description: 'Fix the identified issue',
          duration: 15,
          agentType: 'executor',
          verification: ['Fix verified', 'No regressions']
        });
      }

      // Default fallback
      if (subtasks.length === 0) {
        subtasks.push({
          title: 'Implementation',
          description: note.content,
          duration: 20,
          agentType: 'executor',
          verification: ['Implementation complete', 'Tested', 'Verified']
        });
      }
    }

    return subtasks;
  }

  generateReviewPrompt(note) {
    return `
Review Task: ${note.title}

OBJECTIVES:
1. Verify implementation matches original requirements
2. Test functionality and edge cases
3. Check code quality and documentation
4. Identify any issues or improvements
5. Approve or request changes

CHECKLIST:
- Requirements met?
- Tests pass?
- Documentation complete?
- No obvious bugs?
- Production ready?

DECISION:
APPROVE or REQUEST CHANGES (with specific feedback)
    `.trim();
  }

  createTask(params) {
    const task = {
      id: this.generateTaskId(),
      type: params.type,
      phase: params.phase,
      title: params.title,
      description: params.description,
      parentNoteId: params.parentNoteId,
      projectId: params.projectId,
      agentType: params.agentType,
      dependsOn: params.dependsOn || null,
      status: 'pending',
      priority: params.priority,
      estimatedDuration: params.estimatedDuration,
      actualDuration: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      assignedAgent: null,
      verification: params.verification || {},
      verificationResults: null,
      output: null,
      notes: ''
    };

   this.tasks.set(task.id, task);
    this.taskQueue.push(task.id);

    return task;
  }

  getNextTask() {
    // Find tasks with no pending dependencies
    for (const taskId of this.taskQueue) {
      const task = this.tasks.get(taskId);

      if (task && task.status === 'pending' && this.dependenciesSatisfied(task)) {
        return task;
      }
    }

    return null;
  }

  dependenciesSatisfied(task) {
    if (!task.dependsOn) return true;

    const dependentTask = this.tasks.get(task.dependsOn);
    return dependentTask && dependentTask.status === 'completed';
  }

  startTask(taskId, agentId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = 'in_progress';
    task.startedAt = new Date();
    task.assignedAgent = agentId;

    this.activeTask = taskId;
    this.tasks.set(taskId, task);

    return task;
  }

  completeTask(taskId, output, verificationPassed = true) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = verificationPassed ? 'completed' : 'failed';
    task.completedAt = new Date();
    task.actualDuration = (task.completedAt - task.startedAt) / 1000 / 60; // minutes
    task.output = output;

    this.tasks.set(taskId, task);

    if (this.activeTask === taskId) {
      this.activeTask = null;
    }

    return task;
  }

  failTask(taskId, error) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = 'failed';
    task.completedAt = new Date();
    task.actualDuration = (task.completedAt - task.startedAt) / 1000 / 60;
    task.output = { error: error };

    this.tasks.set(taskId, task);

    if (this.activeTask === taskId) {
      this.activeTask = null;
    }

    return task;
  }

  generateTaskId() {
    const prefixes = ['RES', 'PLN', 'EXEC', 'REV'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Date.now().toString(36).toUpperCase();
    return `${prefix}-${suffix}`;
  }

  getQueueStatus() {
    return {
      total: this.tasks.size,
      pending: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
      inProgress: Array.from(this.tasks.values()).filter(t => t.status === 'in_progress').length,
      completed: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length,
      failed: Array.from(this.tasks.values()).filter(t => t.status === 'failed').length,
      activeTask: this.activeTask ? this.tasks.get(this.activeTask) : null
    };
  }

  getTasksByNote(noteId) {
    return Array.from(this.tasks.values()).filter(t => t.parentNoteId === noteId);
  }

  getTasksByProject(projectId) {
    return Array.from(this.tasks.values()).filter(t => t.projectId === projectId);
  }
}

export default TaskEngine;
