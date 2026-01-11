import { AgentConfig, SystemConfig } from './types';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as path from 'path';

const DEFAULT_INSTRUCTIONS = `# AGENT COORDINATION RULES (DETERMINISTIC)
1. You MUST only append single lines to 'edit.log'.
2. Format for starting work: EDIT-OPEN | <your_name> | <file_path> | <reason>
3. Format for finishing work: EDIT-CLOSE | <your_name> | <file_path> | <outcome>
4. NEVER read, rewrite, or prune 'edit.log'. The system handles archival.
5. Check 'edit.log' to see if another agent is currently editing a file you need.`;

const DEFAULT_AGENTS: AgentConfig[] = [
    { name: 'claude', command: 'claude', args: ['--yolo'], type: 'claude', instructionFile: 'CLAUDE.md', role: 'Main Developer' },
    { name: 'codex', command: 'codex', args: ['--yolo'], type: 'codex', instructionFile: 'AGENTS.md', role: 'Architect & Builder' },
    { name: 'gemini', command: 'gemini', args: ['--yolo'], type: 'gemini', instructionFile: 'GEMINI.md', role: 'Planner & Researcher' },
    { name: 'cline', command: 'wsl', args: ['cline'], type: 'cline', instructionFile: '.clinerules', role: 'QA & Reviewer' }
];

const DEFAULT_MAPPING = {
    'term1': null,
    'term2': 'codex',
    'term3': 'gemini',
    'term4': 'cline'
};

const DEFAULT_WORKSPACE = process.cwd();

export class ConfigManager {
    private configPath = path.join(process.cwd(), 'chronos_config.yaml');

    getConfig(): SystemConfig {
        if (fs.existsSync(this.configPath)) {
            try {
                const file = fs.readFileSync(this.configPath, 'utf8');
                const parsed = yaml.parse(file);
                return {
                    agents: parsed.agents || DEFAULT_AGENTS,
                    termMapping: parsed.termMapping || DEFAULT_MAPPING,
                    workspaceDir: parsed.workspaceDir || DEFAULT_WORKSPACE,
                    workspaceInstructions: parsed.workspaceInstructions || DEFAULT_INSTRUCTIONS,
                    promptLibrary: parsed.promptLibrary || { blocks: [], prompts: [], chains: [] }
                };
            } catch (e) {
                console.error("Error parsing config, using defaults", e);
            }
        }
        return {
            agents: DEFAULT_AGENTS,
            termMapping: DEFAULT_MAPPING,
            workspaceDir: DEFAULT_WORKSPACE,
            workspaceInstructions: DEFAULT_INSTRUCTIONS,
            promptLibrary: { blocks: [], prompts: [], chains: [] }
        };
    }

    saveConfig(config: SystemConfig) {
        const data = yaml.stringify(config);
        fs.writeFileSync(this.configPath, data);
    }
}
