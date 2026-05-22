import type { ForgeDraftTree, ForgeStructuredState } from './ForgeStructuredTypes.js';
import type { ForgeMemoryTree } from './ForgeMemoryTypes.js';
import type { CleanedMessage } from './nexus.js';
import type { MemorySnapshot } from './MemorySnapshotTypes.js';
import type { ForgeWorkflowPromptMode, ForgeWorkflowSnapshot } from './ForgeWorkflowTypes.js';
import type { PromptAssemblyResult } from './PromptAssemblyTypes.js';
import type { ForgePromptPreviewAgentContext } from './ForgeAgentTypes.js';
import type {
    ForgeExecutionRequest,
    ForgeModelRequestToolSummary,
    ForgeRuntimeContext
} from './ForgeRuntimeTypes.js';
import type {
    ForgePiContextBundleSummary,
    ForgePiTreeNode
} from '@shared/ForgePiTypes.js';

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
    submitConfigsDigest: string;
    submittedScopesDigest: string;
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
    collectionMode: string;
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
    assembly?: PromptAssemblyResult | null;
    agent?: ForgePromptPreviewAgentContext | null;
    pi?: ForgePromptPreviewPiContext | null;
    sourceLabel?: string | null;
    targetEntryId?: string | null;
}

export interface ForgePromptPreviewBundle {
    primary: ForgePromptPreviewTab;
    executor: ForgePromptPreviewTab;
}

export interface ForgePromptPreviewPiContext {
    requestId: string;
    systemPrompt: string;
    contextBundleSummary: ForgePiContextBundleSummary;
    loadedExtensions: string[];
    activeTools: ForgeModelRequestToolSummary[];
    piSessionState: {
        tree: ForgePiTreeNode[];
        activeNodeId: string | null;
        contextBundleSummary?: ForgePiContextBundleSummary | null;
        loadedExtensions?: string[];
    };
}

export interface ForgePromptPreviewPiInput {
    command: { type: 'send_user_input'; input: string };
    commandInput: string;
    context: ForgeRuntimeContext;
    request: ForgeExecutionRequest;
}

export interface ForgePromptPreviewPiResult extends ForgePromptPreviewPiContext {
    prompt: Array<{
        role: string;
        content?: unknown;
        name?: string;
    }>;
    branchMessages: unknown[];
}
