import type { LuminaChatMessage } from '@shared/LuminaMessage.js';

export type StreamStatus = 'idle' | 'running' | 'success' | 'error' | 'aborted';
export type TransactionStatus = 'pending' | 'running' | 'committed' | 'aborted' | 'rolled_back';
export type TransactionScope = 'chat.save' | 'chat.patch' | 'chat.generate' | 'nexus.generate';
export type TransactionErrorCode = 'TXN_SEQUENCE_CONFLICT' | 'TXN_INVALID_TRANSITION' | 'TXN_STORAGE_WRITE_FAILED';

export interface TransactionError {
    code: TransactionErrorCode;
    message: string;
    retryable: boolean;
}

export interface TransactionRecord {
    id: string;
    chatId: string;
    seq: number;
    status: TransactionStatus;
    scope: TransactionScope;
    payloadDigest: string;
    idempotencyKey: string;
    error: TransactionError | null;
    createdAt: number;
    updatedAt: number;
}

export interface TransactionContext {
    expectedSeq?: number;
    idempotencyKey?: string;
    lastTransactionId?: string;
}

export interface StreamState {
    buffer: string;
    rawBuffer?: string;
    isGenerating: boolean;
    generationId: string | null;
    lastChunkTime: number;
    nodeIndex: number;
    status: StreamStatus;
    errorMessage: string | null;
    finishedAt: number;
    lastTransactionId?: string;
    activeLeafId?: string | null;
}

export interface PresetRecord {
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
    blob: any;
}

export interface ForgeStagingRecord {
    id: string;
    originalContent: string;
    proposedContent: string;
    description: string;
    targetEntryId: string;
    timestamp: number;
}

export interface ForgeVirtualLorebookRecord {
    id: string;
    entry: Record<string, unknown>;
    sourceBookId: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface ForgeWorkflowRecord {
    phase: 'clarify' | 'plan' | 'review' | 'finalize';
    promptMode: 'planner' | 'executor';
    reason: string;
    recommendedAction: string;
    shouldGenerate: boolean;
    updatedAt: number;
}

export interface ForgeSessionRecord {
    id: string;
    sessionChatId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    presetId: string;
    activeLeafId: string | null;
    worldlineNodes: LuminaChatMessage[];
    selectedChatSessionId: string | null;
    selectedChatSnapshotId: string | null;
    draftInput: string;
    stagingEntries: ForgeStagingRecord[];
    commitReadyEntries?: ForgeStagingRecord[];
    virtualLorebookEntries?: ForgeVirtualLorebookRecord[];
    importedLorebookId?: string | null;
    workflowSnapshot?: ForgeWorkflowRecord | null;
    structuredState?: any;
    draftTree?: any;
    forgeMemoryTree?: any;
    completedLayers?: string[];
    publishState?: 'drafting' | 'workspace_frozen';
    workspaceMode: 'workspace';
}


export type NexusProviderType = 'openai' | 'openai_compatible' | 'anthropic' | 'google';

export interface NexusApiConfig {
    id: string;
    name?: string;
    type?: NexusProviderType;
    url?: string;
    key?: string;
}
