import { Mission, Stage, ExecutionLog, AgentConfig } from './types';
import { ConfigManager } from './config';
import * as fs from 'fs';
import * as path from 'path';
import execa from 'execa';
import chalk from 'chalk';
import { Server } from 'socket.io'; // Import type

export class Engine {
    private configManager = new ConfigManager();
    private agents: Map<string, AgentConfig>;
    private logs: Map<string, ExecutionLog> = new Map();
    private missionDir: string;
    private io?: Server;

    constructor(io?: Server, missionDir: string = 'missions') {
        this.io = io;
        this.missionDir = missionDir;
        this.agents = new Map(this.configManager.getConfig().agents.map(a => [a.name, a]));
    }

    private getLogPath(missionName: string, stageId: string): string {
        const dir = path.join(process.cwd(), 'logs', missionName);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return path.join(dir, `${stageId}.log`);
    }

    private emitLog(agent: string, data: string) {
        if (this.io) {
            this.io.emit('term:data', `\r\n\x1b[36m[${agent}]\x1b[0m ${data.replace(/\n/g, '\r\n')}`);
        }
    }

    private async executeStage(mission: Mission, stage: Stage): Promise<boolean> {
        const agent = this.agents.get(stage.agent);
        if (!agent) {
            console.error(chalk.red(`Agent ${stage.agent} not found for stage ${stage.id}`));
            return false;
        }

        console.log(chalk.blue(`🚀 Starting Stage: ${stage.name} (${stage.id}) using ${agent.name}`));
        this.emitLog('SYSTEM', `🚀 Starting Stage: ${stage.name} using ${agent.name}`);

        // 1. Prepare Prompt
        let prompt = stage.prompt || '';
        if (stage.promptFile) {
            const pPath = path.resolve(process.cwd(), stage.promptFile);
            if (fs.existsSync(pPath)) {
                prompt += '\n' + fs.readFileSync(pPath, 'utf8');
            }
        }

        // 2. Inject Context
        if (stage.contextFrom) {
            prompt += '\n\n--- CONTEXT FROM PREVIOUS STEPS ---\n';
            for (const depsId of stage.contextFrom) {
                const logPath = this.getLogPath(mission.name, depsId);
                if (fs.existsSync(logPath)) {
                    const contextData = fs.readFileSync(logPath, 'utf8');
                    prompt += `\n[Output from ${depsId}]:\n${contextData}\n`;
                }
            }
        }

        // 3. Execute
        const logPath = this.getLogPath(mission.name, stage.id);

        try {
            this.emitLog(agent.name, `Executing command: ${agent.command} ...`);

            // Use execa but stream stdout
            const subprocess = execa(agent.command, [...(agent.args || []), prompt], {
                all: true
            });

            if (subprocess.stdout) {
                subprocess.stdout.on('data', (chunk) => {
                    this.emitLog(agent.name, chunk.toString());
                });
            }

            if (subprocess.stderr) {
                subprocess.stderr.on('data', (chunk) => {
                    this.emitLog(agent.name, `\x1b[31m${chunk.toString()}\x1b[0m`);
                });
            }

            const result = await subprocess;
            fs.writeFileSync(logPath, result.all || '');

            this.emitLog('SYSTEM', `✅ Stage ${stage.id} completed.`);
            console.log(chalk.green(`✅ Stage ${stage.id} completed.`));
            return true;

        } catch (error: any) {
            console.error(chalk.red(`❌ Stage ${stage.id} failed:`), error.message);
            this.emitLog('SYSTEM', `❌ Stage ${stage.id} failed: ${error.message}`);

            // Try to salvage stdout from error object
            const output = error.all || error.message;
            fs.writeFileSync(logPath, `FAILED: ${error.message}\n${output}`);
            return false;
        }
    }

    async runMission(mission: Mission) {
        console.log(chalk.yellow(`\n📜 Starting Mission: ${mission.name}`));
        this.emitLog('SYSTEM', `📜 Starting Mission: ${mission.name}`);

        const completed = new Set<string>();
        const failed = new Set<string>();
        const pending = [...mission.stages];

        while (pending.length > 0) {
            let madeProgress = false;
            const executable: Stage[] = [];

            for (let i = 0; i < pending.length; i++) {
                const stage = pending[i];
                const depsMet = !stage.dependsOn || stage.dependsOn.every(d => completed.has(d));
                const timeMet = !stage.startAt || new Date(stage.startAt) <= new Date();

                if (depsMet && timeMet) {
                    executable.push(stage);
                    pending.splice(i, 1);
                    i--;
                }
            }

            if (executable.length === 0 && pending.length > 0) {
                const blocked = pending.some(p => p.dependsOn?.some(d => failed.has(d)));
                if (blocked) {
                    console.error('Dependencies failed');
                    this.emitLog('SYSTEM', '💀 Mission Deadlocked: Dependencies failed.');
                    break;
                }
                if (pending.some(p => p.startAt)) {
                    await new Promise(r => setTimeout(r, 5000));
                    continue;
                }
                break;
            }

            await Promise.all(executable.map(async (stage) => {
                const success = await this.executeStage(mission, stage);
                if (success) completed.add(stage.id);
                else failed.add(stage.id);
            }));

            madeProgress = true;
        }

        console.log(chalk.yellow(`Mission Finished.`));
        this.emitLog('SYSTEM', `Mission Finished. Completed: ${completed.size}, Failed: ${failed.size}`);
    }
}
