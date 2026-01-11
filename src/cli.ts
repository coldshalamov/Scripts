#!/usr/bin/env node
import { Command } from 'commander';
import { Engine } from './engine';
import { Planner } from './planner';
import { ConfigManager } from './config';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import logSymbols from 'log-symbols';

const program = new Command();
const engine = new Engine();
const planner = new Planner();
const config = new ConfigManager();

console.log(chalk.cyan(`
   _____ _    _ _____   ____  _   _  ____   _____ 
  / ____| |  | |  __ \\ / __ \\| \\ | |/ __ \\ / ____|
 | |    | |__| | |__) | |  | |  \\| | |  | | (___  
 | |    |  __  |  _  /| |  | | . \` | |  | |\\___ \\ 
 | |____| |  | | | \\ \\| |__| | |\\  | |__| |____) |
  \\_____|_|  |_|_|  \\_\\\\____/|_| \\_|\\____/|_____/ 
                                                  
  ${chalk.yellow('Autonomous Agent Orchestrator v1.0')}
`));

program
    .name('chronos')
    .description('Autonomous Agent Orchestrator & Scheduler')
    .version('1.0.0');

program
    .command('run <file>')
    .description('Execute a mission file')
    .action(async (file) => {
        const filePath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
            console.error(chalk.red(`File not found: ${filePath}`));
            process.exit(1);
        }
        const content = fs.readFileSync(filePath, 'utf8');
        try {
            const mission = yaml.parse(content);
            await engine.runMission(mission);
        } catch (e: any) {
            console.error(chalk.red('Failed to parse mission:'), e.message);
        }
    });

program
    .command('plan <request>')
    .description('Generate a new mission plan autonomously')
    .option('-o, --out <filename>', 'Output filename', `mission-${Date.now()}.yaml`)
    .action(async (request, options) => {
        try {
            await planner.createPlan(request, options.out);
        } catch (e) {
            process.exit(1);
        }
    });

program
    .command('config')
    .description('List configured agents')
    .action(() => {
        const agents = config.getConfig().agents;
        console.log(chalk.bold.blue('\nconfigured Agents:'));
        agents.forEach(a => {
            console.log(`- ${chalk.yellow(a.name)}: ${chalk.gray(a.command)} (${a.type})`);
        });
    });

program.parse(process.argv);
