import type { LuminaChatMessage } from './LuminaMessage.js';
import type {
    ConversationDocument,
    ForgeConversationPluginState
} from './ConversationTypes.js';
import { createEmptyConversationDocument } from './ConversationTypes.js';
import { resolveConversationSummary } from './ConversationSummaryResolver.js';

type LegacyForgeSessionRecord = {
    id: string;
    sessionChatId?: string;
    title?: string;
    createdAt?: number;
    updatedAt?: number;
    presetId?: string;
    activeLeafId?: string | null;
    worldlineNodes?: LuminaChatMessage[];
    selectedChatSessionId?: string | null;
    selectedChatSnapshotId?: string | null;
    draftInput?: string;
    stagingEntries?: unknown[];
    commitReadyEntries?: unknown[];
    virtualLorebookEntries?: unknown[];
    importedLorebookId?: string | null;
    workflowSnapshot?: unknown | null;
    structuredState?: unknown;
    draftTree?: unknown;
    forgeMemoryTree?: unknown;
    completedLayers?: string[];
    publishState?: 'drafting' | 'workspace_frozen';
    activeLayer?: string | null;
    activeAuxPanel?: string;
    auxPresentationMode?: 'embedded' | 'detached' | 'widget' | 'hidden';
    worldlineSnapshots?: Record<string, unknown>;
    detailMode?: string | null;
    entryMode?: string | null;
};

type LegacyChatMetadata = {
    activeLeafId?: string | null;
    updatedAt?: number;
    pluginData?: Record<string, unknown> | null;
    transaction?: {
        lastCommittedSeq?: number;
        lastTransactionId?: string;
    };
};

const cloneNodes = (nodes: LuminaChatMessage[] | undefined): LuminaChatMessage[] =>
    Array.isArray(nodes) ? nodes.map((node) => ({ ...node })) : [];

export const migrateLegacyChatArray = (
    id: string,
    payload: unknown,
    conversationType: 'chat' | 'forge' = id.startsWith('lw_card_') ? 'forge' : 'chat'
): ConversationDocument => {
    const rows = Array.isArray(payload) ? payload : [];
    const metadata = (rows[0] && rows[0]?.type === 'metadata' ? rows[0] : null) as LegacyChatMetadata | null;
    const nodes = (metadata ? rows.slice(1) : rows) as LuminaChatMessage[];
    const lastNode = nodes[nodes.length - 1];

    const document = createEmptyConversationDocument({
        id,
        conversationType,
        title: `Conversation ${id.slice(0, 12)}`,
        createdAt: Number(lastNode?.createdAt || Date.now()),
        updatedAt: Number(metadata?.updatedAt || lastNode?.createdAt || Date.now()),
        activeLeafId: metadata?.activeLeafId || lastNode?.id || null,
        nodes: cloneNodes(nodes),
        pluginState: metadata?.pluginData ? { chat: { pluginData: metadata.pluginData } } : {},
        transaction: {
            lastCommittedSeq: Number(metadata?.transaction?.lastCommittedSeq || 0),
            lastTransactionId: metadata?.transaction?.lastTransactionId || null
        },
        legacy: { legacyChatId: id }
    });

    document.summary = resolveConversationSummary(document);
    document.summary.messageCount = document.nodes.length;
    return document;
};

export const migrateLegacyForgeSession = (
    session: LegacyForgeSessionRecord,
    legacyChatPayload?: unknown
): ConversationDocument => {
    const nodes = session.worldlineNodes?.length
        ? session.worldlineNodes
        : (Array.isArray(legacyChatPayload) ? migrateLegacyChatArray(session.sessionChatId || session.id, legacyChatPayload, 'forge').nodes : []);

    const forgeState: ForgeConversationPluginState = {
        structuredState: session.structuredState,
        draftTree: session.draftTree,
        forgeMemoryTree: session.forgeMemoryTree,
        stagingEntries: session.stagingEntries || [],
        commitReadyEntries: session.commitReadyEntries || [],
        virtualLorebookEntries: session.virtualLorebookEntries || [],
        workflowSnapshot: session.workflowSnapshot || null,
        activeLayer: session.activeLayer || null,
        completedLayers: session.completedLayers || [],
        publishState: session.publishState || 'drafting',
        activeAuxPanel: session.activeAuxPanel,
        auxPresentationMode: session.auxPresentationMode,
        worldlineSnapshots: session.worldlineSnapshots,
        selectedChatSessionId: session.selectedChatSessionId || null,
        selectedChatSnapshotId: session.selectedChatSnapshotId || null,
        importedLorebookId: session.importedLorebookId || null,
        detailMode: session.detailMode || null,
        entryMode: session.entryMode || null,
        draftInput: session.draftInput || '',
        presetId: session.presetId || '',
        sessionChatId: session.sessionChatId || session.id
    };

    const document = createEmptyConversationDocument({
        id: session.id,
        conversationType: 'forge',
        title: session.title || `Forge Workspace ${session.id.slice(0, 12)}`,
        createdAt: Number(session.createdAt || Date.now()),
        updatedAt: Number(session.updatedAt || session.createdAt || Date.now()),
        activeLeafId: session.activeLeafId || nodes[nodes.length - 1]?.id || null,
        nodes: cloneNodes(nodes),
        pluginState: { forge: forgeState },
        legacy: {
            legacyChatId: session.sessionChatId || undefined,
            legacyForgeSessionId: session.id
        }
    });

    document.summary = resolveConversationSummary(document);
    document.summary.messageCount = document.nodes.length;
    return document;
};
