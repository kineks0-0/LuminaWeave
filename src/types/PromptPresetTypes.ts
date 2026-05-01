import type { CleanedMessage } from './nexus.js';
import type { MemorySnapshot } from './MemorySnapshotTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from './ForgeStructuredTypes.js';
import type { ForgeMemoryTree } from './ForgeMemoryTypes.js';
import type { ForgeWorkflowSnapshot } from './ForgeWorkflowTypes.js';

export type PromptPresetProfileId = 'forge-main' | 'forge-executor' | 'forge-test-chat';
export type PromptPresetEngine = 'composed' | 'st_preset';
export type PromptPresetSpecialKey =
    | 'plannerSystemPrompt'
    | 'conversationSystemPrompt'
    | 'analystSystemPrompt'
    | 'executorSystemPrompt';

export interface PromptPresetCharCard {
    name?: string;
    description?: string;
    personality?: string;
    scenario?: string;
    systemPrompt?: string;
}

export interface PromptPresetExecutorTask {
    instruction: string;
    entryId: string;
    originalContent?: string;
}

export interface PromptPresetEntry {
    id: string;
    type: 'slot' | 'custom';
    slotId?: string;
    enabled: boolean;
    role?: CleanedMessage['role'];
    content?: string;
}

export interface PromptPresetGenerationSettings {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    max_tokens?: number;
    max_length?: number;
    seed?: number;
}

export interface PromptPresetDefinition {
    id: string;
    name: string;
    profileId: PromptPresetProfileId;
    builtIn?: boolean;
    engine: PromptPresetEngine;
    charCardMode?: 'from_st' | 'custom' | 'none';
    customCharCard?: PromptPresetCharCard;
    entries: PromptPresetEntry[];
    specials: Partial<Record<PromptPresetSpecialKey, string>>;
    generationSettings: PromptPresetGenerationSettings;
    createdAt: number;
    updatedAt: number;
}

export interface PromptPresetBindingMap {
    'forge-main': string;
    'forge-executor': string;
    'forge-test-chat': string;
}

export interface PromptComposeSources {
    baseSystemPromptKey?: PromptPresetSpecialKey;
    lorebookEntries?: LuminaLorebookEntry[];
    charCard?: PromptPresetCharCard | null;
    conversationHistory?: CleanedMessage[];
    memorySnapshot?: MemorySnapshot;
    forgeMemoryTree?: ForgeMemoryTree;
    structuredState?: ForgeStructuredState;
    draftTree?: ForgeDraftTree;
    workflowSnapshot?: ForgeWorkflowSnapshot | null;
    executorTask?: PromptPresetExecutorTask | null;
    systemProtocolText?: string | null;
    macroContext?: Record<string, string>;
}

export interface PromptComposeResolvedEntry {
    id: string;
    type: 'slot' | 'custom';
    slotId?: string;
    role: CleanedMessage['role'];
    content: string;
}

export interface PromptComposeResult {
    messages: CleanedMessage[];
    resolvedEntries: PromptComposeResolvedEntry[];
}

export interface PromptPresetSlotDefinition {
    id: string;
    label: string;
    description?: string;
    defaultRole: CleanedMessage['role'];
    supportsRoleOverride?: boolean;
}

export interface PromptPresetSpecialDefinition {
    key: PromptPresetSpecialKey;
    label: string;
    description?: string;
}
