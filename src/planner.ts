import execa from 'execa';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { Mission, Stage } from './types';

const SYSTEM_PROMPT = `
You are the Strategic Planner for an Autonomous Agent System called Chronos.
Your goal is to accept a high-level user request and break it down into a structured "Mission" configuration.

OUTPUT FORMAT:
You must output ONLY valid YAML calling the following schema:

name: "Mission Name"
description: "Mission Description"
stages:
  - id: "step-1"
    name: "Research"
    agent: "gemini" # or "claude", "codex"
    prompt: "Detailed prompt for the agent..."
    timeoutSeconds: 300
  - id: "step-2"
    name: "Implementation"
    agent: "claude"
    prompt: "Detailed prompt..."
    dependsOn: ["step-1"]
    contextFrom: ["step-1"]

RULES:
1. Break tasks into logical steps (Research -> Plan -> Execute -> Review).
2. Choose the best agent for the task (Gemini for planning, Claude/Codex for coding).
3. Ensure IDs are unique.
4. Use 'dependsOn' to enforce order.
5. Use 'contextFrom' to pass information between agents.
`;

export class Planner {
    async createPlan(request: string, outputFilename: string): Promise<string> {
        console.log(chalk.cyan('🧠 Thinking about the plan... (Calling Gemini)'));

        // We construct a prompt that includes the system prompt and the user request
        const fullPrompt = `${SYSTEM_PROMPT}\n\nUSER REQUEST: "${request}"\n\nPlease generate the Mission YAML.`;

        try {
            // NOTE: This assumes 'gemini' is in the path and accepts a prompt string.
            // If gemini-cli requires specific args like "gemini prompt '...'", adjust here.
            const { stdout } = await execa('gemini', [fullPrompt]);

            // Attempt to extract YAML block if the model chats
            const match = stdout.match(/```yaml([\s\S]*?)```/) || stdout.match(/```([\s\S]*?)```/);
            const yamlContent = match ? match[1] : stdout;

            const cleanYaml = yamlContent.trim();

            // Validate YAML
            const parsed = yaml.parse(cleanYaml);
            if (!parsed.stages) throw new Error("Generated YAML missing 'stages'");

            const outputPath = path.resolve(process.cwd(), 'missions', outputFilename);
            const missionsDir = path.dirname(outputPath);
            if (!fs.existsSync(missionsDir)) await fs.promises.mkdir(missionsDir, { recursive: true });

            await fs.promises.writeFile(outputPath, cleanYaml);
            console.log(chalk.green(`✅ Plan saved to ${outputPath}`));

            return outputPath;

        } catch (e: any) {
            console.error(chalk.red('Planning failed:'), e.message);
            throw e;
        }
    }
}
