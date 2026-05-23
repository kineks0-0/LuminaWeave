import type { CleanedMessage } from './nexus.js';
import type { MemorySnapshot } from './MemorySnapshotTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from './ForgeStructuredTypes.js';
import type { ForgeMemoryTree } from './ForgeMemoryTypes.js';
import type { ForgeWorkflowSnapshot } from './ForgeWorkflowTypes.js';
import type { ResourceDiagnostic, ResourceRef } from '@shared/resources/index.js';
import type { ForgePromptSlotPolicy, PromptSourceUnit } from './PromptAssemblyTypes.js';

export type PromptPresetProfileId = 'forge-main' | 'forge-executor' | 'forge-test-chat';
export type PromptPresetEngine = 'composed' | 'st_preset';
export type PromptPresetSpecialKey =
    | 'plannerSystemPrompt'
    | 'conversationSystemPrompt'
    | 'analystSystemPrompt'
    | 'executorSystemPrompt';

export type ForgeAgentPromptMode = 'planner' | 'conversation' | 'analyst' | 'executor';

export type ForgeAgentPromptResourceKind = 'contract' | 'system' | 'mode_prompt' | 'skill';

export interface ForgeAgentPromptResource {
    path: string;
    kind: ForgeAgentPromptResourceKind;
    content: string;
    title?: string;
}

export type ForgeAgentSkillLoadPolicy = 'on_demand' | 'always';

export interface ForgeAgentSkillResource {
    name: string;
    path: string;
    content: string;
    title?: string;
    description?: string;
    loadPolicy?: ForgeAgentSkillLoadPolicy;
}

export type ForgeAgentPromptOrchestrationStepKind =
    | 'contract'
    | 'system'
    | 'mode_prompt'
    | 'ui_dsl'
    | 'reasoning_boundary'
    | 'skills'
    | 'capabilities'
    | 'memory_index'
    | 'context_files'
    | 'branch_messages';

export interface ForgeAgentPromptOrchestrationStep {
    kind: ForgeAgentPromptOrchestrationStepKind;
    enabled: boolean;
    path?: string;
    title?: string;
}

export interface ForgeAgentPromptOrchestration {
    label: string;
    steps: ForgeAgentPromptOrchestrationStep[];
}

export interface ForgeAgentPromptResourceSet {
    contract: ForgeAgentPromptResource;
    system: ForgeAgentPromptResource;
    modes: Record<ForgeAgentPromptMode, ForgeAgentPromptResource>;
    skills?: ForgeAgentSkillResource[];
}

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

export type PromptWorldbookInsertionPosition =
    | 'before'
    | 'after'
    | 'an_top'
    | 'an_bottom'
    | 'em_top'
    | 'em_bottom'
    | 'at_depth'
    | 'outlet';

export interface PromptWorldbookActivatedEntry {
    uid: string | number;
    comment: string;
    content: string;
    role: CleanedMessage['role'];
    depth: number;
    order: number;
    resourceRef?: ResourceRef;
    sourceId?: string;
    resourceId?: string;
    sourcePath?: string;
    insertion: {
        position: PromptWorldbookInsertionPosition;
        depth?: number;
        role?: CleanedMessage['role'];
        outletName?: string;
        anchor?: 'character' | 'authors_note' | 'example_messages' | 'depth' | 'outlet';
        anchorPosition?: 'before' | 'after';
    };
}

export interface PromptWorldbookActivationSnapshot {
    entries: PromptWorldbookActivatedEntry[];
    insertionBuckets: Record<PromptWorldbookInsertionPosition, PromptWorldbookActivatedEntry[]>;
    trace: unknown[];
    diagnostics: ResourceDiagnostic[];
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
    forgeAgentResources?: ForgeAgentPromptResourceSet;
    forgeAgentOrchestration?: ForgeAgentPromptOrchestration;
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
    worldbookActivation?: PromptWorldbookActivationSnapshot | null;
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
    resourceRefs?: ResourceRef[];
    resourceDiagnostics?: ResourceDiagnostic[];
    forgeAgentSourceUnits?: PromptSourceUnit[];
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
    forgeSlotPolicy?: ForgePromptSlotPolicy;
}

export interface PromptPresetSpecialDefinition {
    key: PromptPresetSpecialKey;
    label: string;
    description?: string;
}
