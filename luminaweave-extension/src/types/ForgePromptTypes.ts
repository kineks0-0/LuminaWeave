import type { ForgeDraftTree, ForgeStructuredState } from './ForgeStructuredTypes.js';
import type { ForgeMemoryTree } from './ForgeMemoryTypes.js';
import type { CleanedMessage } from './nexus';
import type { MemorySnapshot } from './MemorySnapshotTypes';
import type { ForgeWorkflowPromptMode, ForgeWorkflowSnapshot } from './ForgeWorkflowTypes';

export interface ForgeMemorySnapshotTemplateInput {
    sourceId: string;
    sessionId: string;
    activeLeafId: string;
    messageCount: number;
    lorebookMode: string;
    lorebookEntryCount: number;
    referenceChatLine: string;
    referenceSnapshotLine: string;
}

export interface ForgeExecutorRewriteTemplateInput {
    instruction: string;
    originalContent: string;
    entryId: string;
}

export interface ForgeStructuredStateTemplateInput {
    activeFormId: string;
    activeMessageFormId: string;
    formCount: number;
    lastUpdatedAt: number;
    formsDigest: string;
    formsDetail: string;
}

export interface ForgeFileMemoryTemplateInput {
    entryCount: number;
    lastUpdatedAt: number;
    entriesDigest: string;
    entriesDetail: string;
}

export interface ForgeDraftTreeTemplateInput {
    draftCount: number;
    proposalCount: number;
    workspaceReadyCount: number;
    titlesDigest: string;
}

export interface ForgeStageSnapshotTemplateInput {
    stage: string;
    visiblePhase: string;
    activeLayer: string;
    nextRecommendedLayer: string;
    allowedActions: string;
    missingFields: string;
    completedLayers: string;
}

export interface ForgeWorkflowSnapshotTemplateInput {
    stage: string;
    visiblePhase: string;
    detailMode: string;
    activeLayer: string;
    subLayer: string;
    promptMode: string;
    reason: string;
    recommendedAction: string;
    shouldGenerate: boolean;
    stagingCount: string;
    commitReadyCount: string;
    draftCount: string;
    missingFields: string;
    allowedActions: string;
    nextRecommendedLayer: string;
    requiresUserDecision: boolean;
}

export interface ForgePlannerPromptPayload {
    systemPrompt: string;
    messages: CleanedMessage[];
    resolvedLorebookEntries: LuminaLorebookEntry[];
    memorySnapshot: MemorySnapshot;
    forgeMemoryTree?: ForgeMemoryTree;
    structuredState?: ForgeStructuredState;
    draftTree?: ForgeDraftTree;
    workflowSnapshot?: ForgeWorkflowSnapshot | null;
}

export interface ForgePromptPreviewTab {
    key: 'primary' | 'executor';
    mode: ForgeWorkflowPromptMode;
    title: string;
    subtitle: string;
    payload: CleanedMessage[];
    sourceLabel?: string | null;
    targetEntryId?: string | null;
}

export interface ForgePromptPreviewBundle {
    primary: ForgePromptPreviewTab;
    executor: ForgePromptPreviewTab;
}
