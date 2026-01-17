#!/usr/bin/env node
/**
 * Swarm Manager - Main Entry Point
 * Hierarchical swarm orchestration system
 */
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { fileURLToPath } from 'url';
import path from 'path';

import ManagerCLI from './manager-cli.js';
import KnowledgeBase from './knowledge-base.js';
import TaskEngine from './task-engine.js';
import SandboxManager from './agent-sandbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const argv = yargs(hideBin(process.argv))
    .scriptName('swarm-manager')
    .usage('$0 [command]')
    .command('interactive', 'Start interactive CLI', {}, async () => {
      const cli = new ManagerCLI();
      await cli.start();
    })
    .command('add <note>', 'Add a new note', (yargs) => {
      yargs.positional('note', {
        describe: 'Note content (supports #project @tags)',
        type: 'string'
      });
    }, async (argv) => {
      const kb = new KnowledgeBase();
      await kb.init();

      const content = argv.note || '';
      const projectMatch = content.match(/#(\w+)/);
      const projectId = projectMatch ? projectMatch[1] : 'general';

      const note = await kb.addNote(content, {
        project: projectId
      });

      console.log(`Added note: ${note.id}`);
    })
    .command('notes', 'List all notes', {}, async () => {
      const kb = new KnowledgeBase();
      await kb.init();

      const notes = Array.from(kb.notes.values());
      notes.forEach(note => {
        console.log(`[${note.status.toUpperCase()}] ${note.title} (${note.projectId})`);
      });
    })
    .command('status', 'Show system status', {}, async () => {
      const kb = new KnowledgeBase();
      await kb.init();

      console.log(`Notes: ${kb.notes.size}`);
      console.log(`Projects: ${kb.projects.size}`);
      console.log(`Agents: ${kb.agents.size}`);
    })
    .option('interactive', {
      alias: 'i',
      type: 'boolean',
      description: 'Start in interactive mode'
    })
    .help()
    .alias('help', 'h')
    .version('1.0.0')
    .parse();

  // Default to interactive mode if no command specified
  if (argv._.length === 0 || argv.interactive) {
    const cli = new ManagerCLI();
    await cli.start();
  }
}

main().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
