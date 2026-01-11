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
