import { useState } from 'react';
import './PromptLibrary.css';

interface PromptBlock {
    id: string;
    name: string;
    content: string;
    scope: 'global' | 'workspace';
}

interface ComposablePrompt {
    id: string;
    name: string;
    blockIds: string[];
    scope: 'global' | 'workspace';
}

interface TemporalChainStep {
    id: string;
    promptId: string;
    terminalId: string;
    delaySeconds: number;
}

interface TemporalChain {
    id: string;
    name: string;
    steps: TemporalChainStep[];
    scope: 'global' | 'workspace';
}

interface PromptLibrary {
    blocks: PromptBlock[];
    prompts: ComposablePrompt[];
    chains: TemporalChain[];
}

interface Props {
    library: PromptLibrary;
    onUpdate: (library: PromptLibrary) => void;
    onExecuteChain: (chain: TemporalChain) => void;
}

export function PromptLibraryView({ library, onUpdate, onExecuteChain }: Props) {
    const [activeTab, setActiveTab] = useState<'blocks' | 'prompts' | 'chains'>('blocks');
    const [editingBlock, setEditingBlock] = useState<PromptBlock | null>(null);
    const [editingPrompt, setEditingPrompt] = useState<ComposablePrompt | null>(null);
    const [editingChain, setEditingChain] = useState<TemporalChain | null>(null);

    const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const createBlock = () => {
        setEditingBlock({ id: generateId(), name: 'New Block', content: '', scope: 'workspace' });
    };

    const saveBlock = (block: PromptBlock) => {
        const exists = library.blocks.find(b => b.id === block.id);
        const newBlocks = exists ? library.blocks.map(b => b.id === block.id ? block : b) : [...library.blocks, block];
        onUpdate({ ...library, blocks: newBlocks });
        setEditingBlock(null);
    };

    const deleteBlock = (id: string) => {
        onUpdate({ ...library, blocks: library.blocks.filter(b => b.id !== id) });
    };

    const createPrompt = () => {
        setEditingPrompt({ id: generateId(), name: 'New Prompt', blockIds: [], scope: 'workspace' });
    };

    const savePrompt = (prompt: ComposablePrompt) => {
        const exists = library.prompts.find(p => p.id === prompt.id);
        const newPrompts = exists ? library.prompts.map(p => p.id === prompt.id ? prompt : p) : [...library.prompts, prompt];
        onUpdate({ ...library, prompts: newPrompts });
        setEditingPrompt(null);
    };

    const deletePrompt = (id: string) => {
        onUpdate({ ...library, prompts: library.prompts.filter(p => p.id !== id) });
    };

    const createChain = () => {
        setEditingChain({ id: generateId(), name: 'New Chain', steps: [], scope: 'workspace' });
    };

    const saveChain = (chain: TemporalChain) => {
        const exists = library.chains.find(c => c.id === chain.id);
        const newChains = exists ? library.chains.map(c => c.id === chain.id ? chain : c) : [...library.chains, chain];
        onUpdate({ ...library, chains: newChains });
        setEditingChain(null);
    };

    const deleteChain = (id: string) => {
        onUpdate({ ...library, chains: library.chains.filter(c => c.id !== id) });
    };

    const getPromptContent = (prompt: ComposablePrompt): string => {
        return prompt.blockIds.map(blockId => {
            const block = library.blocks.find(b => b.id === blockId);
            return block ? block.content : '';
        }).join('\n\n');
    };

    return (
        <div className="prompt-library">
            <div className="library-tabs">
                <button className={activeTab === 'blocks' ? 'active' : ''} onClick={() => setActiveTab('blocks')}>📦 BLOCKS</button>
                <button className={activeTab === 'prompts' ? 'active' : ''} onClick={() => setActiveTab('prompts')}>🧩 PROMPTS</button>
                <button className={activeTab === 'chains' ? 'active' : ''} onClick={() => setActiveTab('chains')}>⏱️ CHAINS</button>
            </div>

            {activeTab === 'blocks' && (
                <div className="library-content">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                        <button className="mgmt-btn" onClick={createBlock}>+ New Block</button>
                    </div>
                    <div className="block-list">
                        {library.blocks.map(block => (
                            <div key={block.id} className="block-card">
                                <div className="block-header">
                                    <h3>{block.name}</h3>
                                    <span className={`scope-badge ${block.scope}`}>{block.scope}</span>
                                </div>
                                <p className="block-preview">{block.content.substring(0, 100)}...</p>
                                <div className="block-actions">
                                    <button className="term-btn" onClick={() => setEditingBlock(block)}>✏️</button>
                                    <button className="term-btn" onClick={() => deleteBlock(block.id)}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'prompts' && (
                <div className="library-content">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                        <button className="mgmt-btn" onClick={createPrompt}>+ New Prompt</button>
                    </div>
                    <div className="block-list">
                        {library.prompts.map(prompt => (
                            <div key={prompt.id} className="block-card">
                                <div className="block-header">
                                    <h3>{prompt.name}</h3>
                                    <span className={`scope-badge ${prompt.scope}`}>{prompt.scope}</span>
                                </div>
                                <p className="block-preview">{prompt.blockIds.length} blocks</p>
                                <div className="block-actions">
                                    <button className="term-btn" onClick={() => setEditingPrompt(prompt)}>✏️</button>
                                    <button className="term-btn" onClick={() => deletePrompt(prompt.id)}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'chains' && (
                <div className="library-content">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                        <button className="mgmt-btn" onClick={createChain}>+ New Chain</button>
                    </div>
                    <div className="block-list">
                        {library.chains.map(chain => (
                            <div key={chain.id} className="block-card">
                                <div className="block-header">
                                    <h3>{chain.name}</h3>
                                    <span className={`scope-badge ${chain.scope}`}>{chain.scope}</span>
                                </div>
                                <p className="block-preview">{chain.steps.length} steps</p>
                                <div className="block-actions">
                                    <button className="mgmt-btn" style={{ fontSize: '10px' }} onClick={() => onExecuteChain(chain)}>▶️ RUN</button>
                                    <button className="term-btn" onClick={() => setEditingChain(chain)}>✏️</button>
                                    <button className="term-btn" onClick={() => deleteChain(chain.id)}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Block Editor Modal */}
            {editingBlock && (
                <div className="modal-overlay" onClick={() => setEditingBlock(null)}>
                    <div className="prompt-editor" onClick={e => e.stopPropagation()}>
                        <h2>Edit Building Block</h2>
                        <label>Name</label>
                        <input className="mgmt-input" value={editingBlock.name} onChange={e => setEditingBlock({ ...editingBlock, name: e.target.value })} />
                        <label>Scope</label>
                        <select className="mgmt-input" value={editingBlock.scope} onChange={e => setEditingBlock({ ...editingBlock, scope: e.target.value as 'global' | 'workspace' })}>
                            <option value="workspace">Workspace</option>
                            <option value="global">Global</option>
                        </select>
                        <label>Content</label>
                        <textarea className="mgmt-input" style={{ height: '300px', fontFamily: 'monospace' }} value={editingBlock.content} onChange={e => setEditingBlock({ ...editingBlock, content: e.target.value })} />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button className="mgmt-btn" style={{ flex: 1 }} onClick={() => saveBlock(editingBlock)}>SAVE</button>
                            <button className="mgmt-btn" style={{ flex: 1, background: '#333' }} onClick={() => setEditingBlock(null)}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompt Editor Modal */}
            {editingPrompt && (
                <div className="modal-overlay" onClick={() => setEditingPrompt(null)}>
                    <div className="prompt-editor" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px', height: '600px' }}>
                            <div className="block-sidebar">
                                <h3>Available Blocks</h3>
                                <div className="block-palette">
                                    {library.blocks.map(block => (
                                        <div key={block.id} className="palette-block" onClick={() => {
                                            if (!editingPrompt.blockIds.includes(block.id)) {
                                                setEditingPrompt({ ...editingPrompt, blockIds: [...editingPrompt.blockIds, block.id] });
                                            }
                                        }}>
                                            {block.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h2>Composing Prompt...</h2>
                                <label>Name</label>
                                <input className="mgmt-input" value={editingPrompt.name} onChange={e => setEditingPrompt({ ...editingPrompt, name: e.target.value })} />
                                <label>Scope</label>
                                <select className="mgmt-input" value={editingPrompt.scope} onChange={e => setEditingPrompt({ ...editingPrompt, scope: e.target.value as 'global' | 'workspace' })}>
                                    <option value="workspace">Workspace</option>
                                    <option value="global">Global</option>
                                </select>
                                <label>Selected Blocks (click to remove)</label>
                                <div className="selected-blocks">
                                    {editingPrompt.blockIds.map((blockId, idx) => {
                                        const block = library.blocks.find(b => b.id === blockId);
                                        return block ? (
                                            <div key={idx} className="selected-block" onClick={() => setEditingPrompt({ ...editingPrompt, blockIds: editingPrompt.blockIds.filter(id => id !== blockId) })}>
                                                {idx + 1}. {block.name} ✕
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                                <label>Preview</label>
                                <textarea className="mgmt-input" style={{ height: '200px', fontFamily: 'monospace', fontSize: '11px' }} value={getPromptContent(editingPrompt)} readOnly />
                                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                    <button className="mgmt-btn" style={{ flex: 1 }} onClick={() => savePrompt(editingPrompt)}>SAVE</button>
                                    <button className="mgmt-btn" style={{ flex: 1, background: '#333' }} onClick={() => setEditingPrompt(null)}>CANCEL</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Chain Editor Modal */}
            {editingChain && (
                <div className="modal-overlay" onClick={() => setEditingChain(null)}>
                    <div className="prompt-editor" onClick={e => e.stopPropagation()}>
                        <h2>Edit Temporal Chain</h2>
                        <label>Name</label>
                        <input className="mgmt-input" value={editingChain.name} onChange={e => setEditingChain({ ...editingChain, name: e.target.value })} />
                        <label>Scope</label>
                        <select className="mgmt-input" value={editingChain.scope} onChange={e => setEditingChain({ ...editingChain, scope: e.target.value as 'global' | 'workspace' })}>
                            <option value="workspace">Workspace</option>
                            <option value="global">Global</option>
                        </select>
                        <label>Steps</label>
                        <div className="chain-steps">
                            {editingChain.steps.map((step, idx) => {
                                const prompt = library.prompts.find(p => p.id === step.promptId);
                                return (
                                    <div key={step.id} className="chain-step">
                                        <span className="step-number">{idx + 1}</span>
                                        <select className="mgmt-input" value={step.promptId} onChange={e => {
                                            const newSteps = [...editingChain.steps];
                                            newSteps[idx] = { ...step, promptId: e.target.value };
                                            setEditingChain({ ...editingChain, steps: newSteps });
                                        }}>
                                            <option value="">Select Prompt</option>
                                            {library.prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <select className="mgmt-input" value={step.terminalId} onChange={e => {
                                            const newSteps = [...editingChain.steps];
                                            newSteps[idx] = { ...step, terminalId: e.target.value };
                                            setEditingChain({ ...editingChain, steps: newSteps });
                                        }}>
                                            <option value="">Terminal</option>
                                            <option value="term1">Term 1</option>
                                            <option value="term2">Term 2</option>
                                            <option value="term3">Term 3</option>
                                            <option value="term4">Term 4</option>
                                        </select>
                                        <input className="mgmt-input" type="number" placeholder="Delay (s)" value={step.delaySeconds} onChange={e => {
                                            const newSteps = [...editingChain.steps];
                                            newSteps[idx] = { ...step, delaySeconds: parseInt(e.target.value) || 0 };
                                            setEditingChain({ ...editingChain, steps: newSteps });
                                        }} />
                                        <button className="term-btn" onClick={() => setEditingChain({ ...editingChain, steps: editingChain.steps.filter((_, i) => i !== idx) })}>🗑️</button>
                                    </div>
                                );
                            })}
                        </div>
                        <button className="mgmt-btn" onClick={() => setEditingChain({ ...editingChain, steps: [...editingChain.steps, { id: generateId(), promptId: '', terminalId: '', delaySeconds: 0 }] })}>+ Add Step</button>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button className="mgmt-btn" style={{ flex: 1 }} onClick={() => saveChain(editingChain)}>SAVE</button>
                            <button className="mgmt-btn" style={{ flex: 1, background: '#333' }} onClick={() => setEditingChain(null)}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
