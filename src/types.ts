export type AgentType = 'claude' | 'codex' | 'gemini' | 'jules' | 'cline' | 'generic';

export interface AgentConfig {
    name: string;
    command: string; // The base command, e.g., "claude"
    args?: string[]; // Default args
    type: AgentType;
    instructionFile?: string; // e.g., "CLAUDE.md"
    role?: string; // Specific role instructions
    prelaunchCommands?: string; // Multi-line commands to run before agent starts
}

export interface Stage {
    id: string;
    name: string;
    agent: string; // Refers to an AgentConfig name
    prompt: string; // The instruction for the agent
    promptFile?: string; // Optional path to a text file containing the prompt
    dependsOn?: string[]; // IDs of stages that must finish first
    contextFrom?: string[]; // IDs of stages whose output should be prepended
    startAt?: string; // ISO Date string for scheduled start
    timeoutSeconds?: number;
}

export interface Mission {
    name: string;
    description?: string;
    stages: Stage[];
}

export interface ExecutionLog {
    missionId: string;
    stageId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    output: string;
    error?: string;
}

export interface PromptBlock {
    id: string;
    name: string;
    content: string;
    scope: 'global' | 'workspace';
}

export interface ComposablePrompt {
    id: string;
    name: string;
    blockIds: string[];
    scope: 'global' | 'workspace';
}

export interface TemporalChainStep {
    id: string;
    promptId: string;
    terminalId: string;
    delaySeconds: number;
}

export interface TemporalChain {
    id: string;
    name: string;
    steps: TemporalChainStep[];
    scope: 'global' | 'workspace';
}

export interface PromptLibrary {
    blocks: PromptBlock[];
    prompts: ComposablePrompt[];
    chains: TemporalChain[];
}

export interface SystemConfig {
    agents: AgentConfig[];
    termMapping: Record<string, string | null>; // e.g., { 'term1': 'master', 'term2': 'codex' }
    workspaceDir?: string;
    workspaceInstructions?: string;
    promptLibrary?: PromptLibrary;
}
