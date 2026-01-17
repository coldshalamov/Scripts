import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KB_ROOT = path.join(__dirname, 'kb');
const NOTES_DIR = path.join(KB_ROOT, 'notes');
const PROJECTS_DIR = path.join(KB_ROOT, 'projects');
const AGENTS_DIR = path.join(KB_ROOT, 'agents');
const LOGS_DIR = path.join(KB_ROOT, 'logs');

/**
 * Knowledge Base System
 * Manages notes, projects, and agent instructions
 * Transforms text inputs into structured knowledge
 */
export class KnowledgeBase {
  constructor() {
    this.notes = new Map();
    this.projects = new Map();
    this.agents = new Map();
    this.cache = {};
    this.cacheTime = null;
  }

  async init() {
    await this.loadAll();
    console.log(`[KB] Loaded ${this.notes.size} notes, ${this.projects.size} projects, ${this.agents.size} agent profiles`);
  }

  async loadAll() {
    await Promise.all([
      this.loadNotes(),
      this.loadProjects(),
      this.loadAgents()
    ]);
    this.cacheTime = Date.now();
  }

  async loadNotes() {
    this.notes.clear();
    const files = await fs.readdir(NOTES_DIR, { recursive: true });

    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.txt')) continue;

      const filePath = path.join(NOTES_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      const note = this.parseNote(content, {
        path: filePath,
        created: stats.birthtime,
        modified: stats.mtime
      });

      this.notes.set(note.id, note);
    }
  }

  async loadProjects() {
    this.projects.clear();

    try {
      const files = await fs.readdir(PROJECTS_DIR);

      for (const file of files) {
        if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

        const filePath = path.join(PROJECTS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const project = yaml.load(content);

        this.projects.set(project.id, project);
      }
    } catch (err) {
      // Directory might not exist yet
    }
  }

  async loadAgents() {
    this.agents.clear();

    try {
      const files = await fs.readdir(AGENTS_DIR);

      for (const file of files) {
        if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

        const filePath = path.join(AGENTS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const agent = yaml.load(content);

        this.agents.set(agent.id, agent);
      }
    } catch (err) {
      // Directory might not exist yet
    }
  }

  parseNote(content, metadata = {}) {
    const lines = content.split('\n');

    // Extract frontmatter
    let frontmatter = {};
    let bodyStart = 0;

    if (lines.length > 0 && lines[0].trim() === '---') {
      let i = 1;
      while (i < lines.length && lines[i].trim() !== '---') {
        const [key, ...value] = lines[i].split(':');
        if (key) {
          frontmatter[key.trim()] = value.join(':').trim();
        }
        i++;
      }
      bodyStart = i + 1;
    }

    const body = lines.slice(bodyStart).join('\n').trim();

    // Extract title from multiple sources (in order of priority)
    let title = 'Untitled';
    if (metadata.title) {
      title = metadata.title;
    } else if (frontmatter.title) {
      title = frontmatter.title;
    } else if (metadata.path) {
      title = metadata.path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'Untitled';
    }

    // Extract project ID
    const projectId = metadata.projectId || metadata.project || frontmatter.project || 'general';

    // Extract tags
    let tags = [];
    if (metadata.tags) {
      tags = typeof metadata.tags === 'string' ? metadata.tags.split(',').map(t => t.trim()) : metadata.tags;
    } else if (frontmatter.tags) {
      tags = frontmatter.tags.split(',').map(t => t.trim());
    }

    // Extract priority
    const priority = metadata.priority || metadata.priority || frontmatter.priority || 'medium';

    // Extract status
    const status = metadata.status || metadata.status || frontmatter.status || 'pending';

    return {
      id: metadata.id || this.generateId(title),
      title,
      content: body,
      projectId,
      tags,
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      status: status,
      created: metadata.created || new Date(),
      modified: metadata.modified || new Date(),
      path: metadata.path,
      frontmatter
    };
  }

  async addNote(content, frontmatter = {}) {
    // Merge frontmatter into content metadata for parseNote
    const metadata = {
      created: new Date(),
      modified: new Date(),
      ...frontmatter
    };

    const note = this.parseNote(content, metadata);

    const filename = `${note.id}.md`;
    const filePath = path.join(NOTES_DIR, filename);

    const fileContent = this.formatNote(note);
    await fs.writeFile(filePath, fileContent, 'utf-8');

    this.notes.set(note.id, note);

    // Auto-associate with project if specified
    if (note.projectId) {
      await this.addToProject(note.projectId, note.id);
    }

    return note;
  }

  formatNote(note) {
    const frontmatter = [
      '---',
      `title: ${note.title}`,
      note.projectId ? `project: ${note.projectId}` : '',
      note.tags.length ? `tags: ${note.tags.join(',')}` : '',
      `priority: ${note.priority}`,
      `status: ${note.status}`,
      `created: ${note.created.toISOString()}`,
      '---',
      '',
      note.content
    ].filter(line => line !== '').join('\n');

    return frontmatter;
  }

  async updateNote(noteId, updates = {}) {
    const note = this.notes.get(noteId);
    if (!note) throw new Error(`Note not found: ${noteId}`);

    Object.assign(note, updates);
    note.modified = new Date();

    const filePath = path.join(NOTES_DIR, `${noteId}.md`);
    const fileContent = this.formatNote(note);
    await fs.writeFile(filePath, fileContent, 'utf-8');

    this.notes.set(noteId, note);

    return note;
  }

  async createProject(name, description = '') {
    const project = {
      id: this.generateId(name),
      name,
      description,
      status: 'active',
      created: new Date(),
      notes: [],
      tasks: []
    };

    const filePath = path.join(PROJECTS_DIR, `${project.id}.yaml`);
    await fs.writeFile(filePath, yaml.dump(project), 'utf-8');

    this.projects.set(project.id, project);

    return project;
  }

  async addToProject(projectId, noteId) {
    let project = this.projects.get(projectId);

    if (!project) {
      // Auto-create project if it doesn't exist
      project = await this.createProject(projectId);
      // Update projects map immediately
      this.projects.set(projectId, project);
    }

    if (!project.notes.includes(noteId)) {
      project.notes.push(noteId);
      project.modified = new Date();
      await this.saveProject(project);
      // Update projects map after save
      this.projects.set(projectId, project);
    }

    return project;
  }

  async saveProject(project) {
    const filePath = path.join(PROJECTS_DIR, `${project.id}.yaml`);
    await fs.writeFile(filePath, yaml.dump(project), 'utf-8');
    this.projects.set(project.id, project);
  }

  searchNotes(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const note of this.notes.values()) {
      const matches = {
        title: note.title.toLowerCase().includes(lowerQuery),
        content: note.content.toLowerCase().includes(lowerQuery),
        tags: note.tags.some(t => t.toLowerCase().includes(lowerQuery))
      };

      if (matches.title || matches.content || matches.tags) {
        results.push({
          ...note,
          matches
        });
      }
    }

    return results.sort((a, b) => {
      // Title matches first, then content
      if (a.matches.title && !b.matches.title) return -1;
      if (!a.matches.title && b.matches.title) return 1;
      return 0;
    });
  }

  async getAgentInstructions(agentId) {
    const agent = this.agents.get(agentId);

    if (!agent) {
      // Return default instructions
      return {
        id: agentId,
        name: agentId,
        type: 'llm',
        capabilities: ['execute', 'research', 'plan', 'review'],
        instructions: `
You are ${agentId}, a specialized agent in the swarm.

CAPABILITIES:
- Execute assigned tasks with precision
- Communicate clearly about progress and issues
- Work within your defined scope
- Verify your work before reporting completion

BEHAVIOR PRINCIPLES:
1. Be transparent about what you're doing
2. Ask questions when uncertain
3. Report mistakes immediately
4. Mark tasks complete only when done

WORKFLOW:
- Accept task from manager
- Plan your approach
- Execute systematically
- Verify results
- Report back with status
        `.trim()
      };
    }

    return agent;
  }

  async updateAgentInstructions(agentId, updates) {
    let agent = await this.getAgentInstructions(agentId);

    Object.assign(agent, updates);
    agent.modified = new Date();

    const filePath = path.join(AGENTS_DIR, `${agentId}.yaml`);
    await fs.writeFile(filePath, yaml.dump(agent), 'utf-8');

    this.agents.set(agentId, agent);

    // Reload agents to reflect changes in memory
    await this.loadAgents();

    return agent;
  }

  generateId(str) {
    const clean = str.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    const suffix = Date.now().toString(36);
    return `${clean}-${suffix}`.replace(/^-|-$|^-.-/g, '');
  }

  getStats() {
    return {
      notes: this.notes.size,
      projects: this.projects.size,
      agents: this.agents.size,
      pending: Array.from(this.notes.values()).filter(n => n.status === 'pending').length,
      completed: Array.from(this.notes.values()).filter(n => n.status === 'completed').length,
      cacheTime: this.cacheTime
    };
  }
}

export default KnowledgeBase;
