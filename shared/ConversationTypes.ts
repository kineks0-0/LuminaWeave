import type { LuminaChatMessage } from './LuminaMessage.js';
import type { TransactionRecord } from './api/TransactionTypes.js';

export const CONVERSATION_SCHEMA_VERSION = 1;

export type LuminaConversationDocumentType = 'chat' | 'forge';

export interface ForgeConversationPluginState {
    structuredState?: unknown;
    draftTree?: unknown;
    forgeMemoryTree?: unknown;
    stagingEntries?: unknown[];
    commitReadyEntries?: unknown[];
    virtualLorebookEntries?: unknown[];
    workflowSnapshot?: unknown | null;
    activeLayer?: string | null;
    completedLayers?: string[];
    publishState?: 'drafting' | 'workspace_frozen';
    activeAuxPanel?: string;
    auxPresentationMode?: 'embedded' | 'detached' | 'widget' | 'hidden';
    worldlineSnapshots?: Record<string, unknown>;
    selectedChatSessionId?: string | null;
    selectedChatSnapshotId?: string | null;
    importedLorebookId?: string | null;
    detailMode?: string | null;
    entryMode?: string | null;
    draftInput?: string;
    presetId?: string;
    sessionChatId?: string;
}

export interface ChatConversationPluginState {
    pluginData?: Record<string, unknown> | null;
    characterId?: string | number | null;
    characterName?: string;
    characterAvatarUrl?: string | null;
}

export interface ConversationPluginState {
    chat?: ChatConversationPluginState;
    forge?: ForgeConversationPluginState;
}

export interface ConversationTransactionState {
    lastCommittedSeq: number;
    lastTransactionId: string | null;
}

export interface ConversationSummary {
    id: string;
    schemaVersion: number;
    conversationType: LuminaConversationDocumentType;
    title: string;
    createdAt: number;
    updatedAt: number;
    activeLeafId: string | null;
    previewMessage: string;
    messageCount: number;
    characterId?: string | number | null;
    characterName?: string;
    characterAvatarUrl?: string | null;
}

export interface ConversationLegacyState {
    legacyChatId?: string;
    legacyForgeSessionId?: string;
}

export interface ConversationDocument {
    schemaVersion: number;
    id: string;
    conversationType: LuminaConversationDocumentType;
    title: string;
    createdAt: number;
    updatedAt: number;
    activeLeafId: string | null;
    nodes: LuminaChatMessage[];
    pluginState: ConversationPluginState;
    transaction: ConversationTransactionState;
    summary: Pick<ConversationSummary, 'previewMessage' | 'messageCount'>;
    legacy?: ConversationLegacyState;
}

export interface ConversationNodeMutation {
    replace?: LuminaChatMessage[];
    added?: LuminaChatMessage[];
    updated?: LuminaChatMessage[];
    deletedIds?: string[];
}

export interface ConversationMutation {
    title?: string;
    activeLeafId?: string | null;
    nodes?: ConversationNodeMutation;
    pluginState?: Partial<ConversationPluginState>;
    transaction?: Partial<ConversationTransactionState>;
    updatedAt?: number;
}

export interface ConversationMutationResult {
    success: boolean;
    document: ConversationDocument;
    summary: ConversationSummary;
    lastCommittedSeq: number;
    transaction?: TransactionRecord;
}

export interface ConversationDeleteResult {
    success: boolean;
    id: string;
}

export interface ConversationListResponse {
    conversations: ConversationSummary[];
}

export interface ConversationGetResponse {
    document: ConversationDocument | null;
}

export const createEmptyConversationDocument = (params: {
    id: string;
    conversationType: LuminaConversationDocumentType;
    title?: string;
    createdAt?: number;
    updatedAt?: number;
    activeLeafId?: string | null;
    nodes?: LuminaChatMessage[];
    pluginState?: ConversationPluginState;
    transaction?: Partial<ConversationTransactionState>;
    legacy?: ConversationLegacyState;
}): ConversationDocument => {
    const now = params.updatedAt ?? params.createdAt ?? Date.now();
    const nodes = params.nodes ? params.nodes.map((node) => ({ ...node })) : [];
    return {
        schemaVersion: CONVERSATION_SCHEMA_VERSION,
        id: params.id,
        conversationType: params.conversationType,
        title: params.title || `Conversation ${params.id.slice(0, 12)}`,
        createdAt: params.createdAt ?? now,
        updatedAt: now,
        activeLeafId: params.activeLeafId ?? nodes[nodes.length - 1]?.id ?? null,
        nodes,
        pluginState: {
            chat: params.pluginState?.chat ? { ...params.pluginState.chat } : undefined,
            forge: params.pluginState?.forge ? { ...params.pluginState.forge } : undefined
        },
        transaction: {
            lastCommittedSeq: params.transaction?.lastCommittedSeq ?? 0,
            lastTransactionId: params.transaction?.lastTransactionId ?? null
        },
        summary: {
            previewMessage: '',
            messageCount: nodes.length
        },
        legacy: params.legacy ? { ...params.legacy } : undefined
    };
};
