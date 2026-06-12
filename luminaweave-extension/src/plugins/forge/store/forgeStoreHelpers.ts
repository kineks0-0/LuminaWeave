import { llmEngine } from '../../../api/llmEngine.js';
import { lwStorage } from '../../../api/storage.js';
import { promptPresetRegistry } from '../../../api/core/hal/prompt/PromptPresetRegistry.js';
import { clonePromptPresetGenerationSettings } from '../../../api/core/utils/promptPresetGenerationSettings.js';
import type { CleanedMessage } from '../../../types/nexus.js';
import { MessageUtils, type LuminaChatMessage } from '@shared/LuminaMessage.js';
import type {
    ForgeRequestLorebookEntrySummary,
    ForgeRequestNodeSummaryItem,
    ForgeRuntimeEvent
} from '../../../types/ForgeRuntimeTypes.js';
import type { PromptPresetProfileId } from '../../../types/PromptPresetTypes.js';
import type {
    ForgeTimelineMessageItem,
    ForgeTimelineOperationItem,
    ForgeTimelineOperationKind,
    ForgeTimelineOperationStatus
} from '../../../types/ForgeTimelineTypes.js';
import type { ForgePiSessionEntry } from '@shared/ForgePiTypes.js';

export type BackendPresetMeta = {
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
};

export type BackendPresetDetail = {
    preset?: {
        blob?: {
            prompts?: Array<{
                content?: string;
            }>;
        };
    };
};

export type ForgeTimelineFeedItem =
    | {
        id: string;
        kind: 'message';
        timestamp: number;
        item: ForgeTimelineMessageItem;
        message: LuminaChatMessage;
    }
    | {
        id: string;
        kind: 'operation';
        timestamp: number;
        item: ForgeTimelineOperationItem;
    };

export interface BuildForgePiTimelineFeedInput {
    entries: ForgePiSessionEntry[];
    activeNodeId: string | null;
    sessionChatId: string;
}

const createPrefixedId = (prefix: string): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

export const generateSessionChatId = (): string => createPrefixedId('lw_card');

export const generateVirtualLorebookEntryId = (): string => createPrefixedId('forge_lore');

export const generateDraftNodeId = (): string => createPrefixedId('forge_draft');

export const generateForgeRequestTraceId = (): string => createPrefixedId('forge_req');

export const resolveRuntimePresetId = (preferredPresetId?: string | null): string => (
    preferredPresetId ||
    lwStorage.get('lumina-forge.nexusPreset', '', 'Global') ||
    lwStorage.get('lumina-chat.nexusPreset', 'Global', 'Global')
);

export const summarizeRequestNodeSummary = (presetId: string): ForgeRequestNodeSummaryItem[] =>
    llmEngine.resolveNodesFromPreset(presetId).map((node: any) => {
        const provider = String(node?.provider || 'unknown');
        const model = typeof node?.model === 'string' && node.model.trim() ? node.model.trim() : null;
        return {
            provider,
            model,
            label: provider === 'st_current'
                ? '宿主当前模型'
                : [provider, model].filter(Boolean).join(' / ')
        };
    });

export const sanitizeHistoryMessages = (input: Array<Pick<LuminaChatMessage, 'role' | 'mes' | 'mesRaw' | 'name'>>): CleanedMessage[] =>
    input
        .filter((message) => (message.mes || message.mesRaw || '').trim() !== '')
        .map((message) => ({
            role: message.role as CleanedMessage['role'],
            content: message.mes || message.mesRaw || '',
            name: message.name
        }));

export interface CreateForgeMessageNodeInput {
    role: 'user' | 'assistant';
    content: string;
    parentId: string | null;
    sessionChatId: string;
    timestamp?: number;
    nodeId?: string;
}

export const createForgeMessageNode = ({
    role,
    content,
    parentId,
    sessionChatId,
    timestamp = Date.now(),
    nodeId = MessageUtils.generateNodeId()
}: CreateForgeMessageNodeInput): LuminaChatMessage => {
    const isUser = role === 'user';
    return {
        id: nodeId,
        parentId,
        name: isUser ? 'You' : 'Forge Assistant',
        role,
        is_user: isUser,
        conversationType: 'forge',
        conversationId: sessionChatId,
        nodeKind: 'message',
        mesRaw: content,
        mes: content,
        thinkingText: null,
        pluginRaw: isUser ? null : content,
        fingerprint: MessageUtils.getFingerprint(content),
        extra: {
            send_date: timestamp,
            conversationType: 'forge',
            conversationId: sessionChatId,
            nodeKind: 'message'
        },
        createdAt: timestamp,
        syncStatus: 'local'
    };
};

export const resolveForgePiActiveBranchEntries = (
    entries: ForgePiSessionEntry[],
    activeNodeId?: string | null
): ForgePiSessionEntry[] => {
    if (!activeNodeId) return [...entries];
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const activeEntry = byId.get(activeNodeId);
    if (!activeEntry) return [];

    const branchIds = new Set<string>();
    let current: ForgePiSessionEntry | undefined = activeEntry;
    while (current) {
        branchIds.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    return entries.filter(entry => branchIds.has(entry.id));
};

export const buildForgePiTimelineFeed = ({
    entries,
    activeNodeId,
    sessionChatId
}: BuildForgePiTimelineFeedInput): ForgeTimelineFeedItem[] => {
    const branchEntries = resolveForgePiActiveBranchEntries(entries, activeNodeId);
    const feed: ForgeTimelineFeedItem[] = [];
    let previousMessageId: string | null = null;

    for (const entry of branchEntries) {
        if (entry.kind === 'user' || entry.kind === 'assistant') {
            const role = entry.kind;
            const messageId = `forge_pi_message_${entry.id}`;
            const message = createForgeMessageNode({
                role,
                content: extractPiEntryText(entry),
                parentId: previousMessageId,
                sessionChatId,
                timestamp: entry.createdAt,
                nodeId: messageId
            });
            const item: ForgeTimelineMessageItem = {
                id: `forge_pi_message_item_${entry.id}`,
                kind: 'message',
                messageId,
                origin: createPiOrigin(entry),
                createdAt: entry.createdAt,
                updatedAt: entry.createdAt
            };
            feed.push({
                id: item.id,
                kind: 'message',
                timestamp: item.createdAt,
                item,
                message
            });
            previousMessageId = messageId;
            continue;
        }

        const operation = createPiFeedOperationItem(entry);
        if (!operation) continue;
        feed.push({
            id: operation.id,
            kind: 'operation',
            timestamp: operation.createdAt,
            item: operation
        });
    }

    return feed.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
};

const HIDDEN_PI_FEED_ENTRY_KINDS = new Set<ForgePiSessionEntry['kind']>([
    'metadata',
    'session_info',
    'context_bundle',
    'checkout'
]);

const createPiFeedOperationItem = (entry: ForgePiSessionEntry): ForgeTimelineOperationItem | null => {
    if (HIDDEN_PI_FEED_ENTRY_KINDS.has(entry.kind)) return null;
    const presentation = resolvePiFeedOperationPresentation(entry);
    return {
        id: `forge_pi_${entry.id}`,
        kind: 'operation',
        operationKind: presentation.operationKind,
        status: presentation.status,
        title: presentation.title,
        summary: presentation.summary || entry.summary,
        detail: presentation.detail,
        sourceTag: `pi:${entry.kind}`,
        dedupeKey: null,
        targetEntryId: resolvePiTargetEntryId(entry.payload),
        relatedMessageId: null,
        layer: null,
        origin: createPiOrigin(entry),
        createdAt: entry.createdAt,
        updatedAt: entry.createdAt,
        completedAt: presentation.status === 'running' ? null : entry.createdAt
    };
};

const resolvePiFeedOperationPresentation = (entry: ForgePiSessionEntry): {
    operationKind: ForgeTimelineOperationKind;
    status: ForgeTimelineOperationStatus;
    title: string;
    summary: string;
    detail: string | null;
} => {
    if (entry.kind === 'process') {
        return {
            operationKind: 'execution',
            status: 'completed',
            title: 'Agent 过程',
            summary: extractPiEntryText(entry),
            detail: extractPiEntryText(entry) || null
        };
    }
    if (entry.kind === 'tool_call') {
        return {
            operationKind: 'execution',
            status: 'running',
            title: `工具调用 · ${resolvePiToolName(entry.payload) ?? 'unknown'}`,
            summary: entry.summary,
            detail: stringifyPiPayload(entry.payload)
        };
    }
    if (entry.kind === 'tool_result') {
        return {
            operationKind: isPiErrorPayload(entry.payload) ? 'system' : 'execution',
            status: isPiErrorPayload(entry.payload) ? 'failed' : 'completed',
            title: `工具结果 · ${resolvePiToolName(entry.payload) ?? 'unknown'}`,
            summary: entry.summary,
            detail: stringifyPiPayload(entry.payload)
        };
    }
    if (entry.kind === 'approval_needed' || entry.kind === 'approval_resolved') {
        return {
            operationKind: 'gate',
            status: entry.kind === 'approval_needed' ? 'blocked' : resolvePiApprovalStatus(entry.payload),
            title: entry.kind === 'approval_needed' ? '等待审阅授权' : '审阅授权结果',
            summary: entry.summary,
            detail: stringifyPiPayload(entry.payload)
        };
    }
    if (entry.kind === 'staging_proposal') {
        return {
            operationKind: 'gate',
            status: 'blocked',
            title: '暂存建议',
            summary: entry.summary,
            detail: stringifyPiPayload(entry.payload)
        };
    }
    if (entry.kind === 'workspace_patch' || entry.kind === 'workspace_checkpoint') {
        return {
            operationKind: 'workspace_write',
            status: 'completed',
            title: entry.kind === 'workspace_patch' ? '工作区变更记录' : '工作区版本检查点',
            summary: entry.summary,
            detail: stringifyPiPayload(entry.payload)
        };
    }
    return {
        operationKind: 'system',
        status: 'completed',
        title: entry.title,
        summary: entry.summary,
        detail: stringifyPiPayload(entry.payload)
    };
};

const createPiOrigin = (entry: ForgePiSessionEntry): ForgeTimelineMessageItem['origin'] => ({
    runtime: 'forge-pi',
    sessionId: entry.sessionId,
    nodeId: entry.id,
    parentNodeId: entry.parentId,
    entryType: entry.kind,
    toolCallId: extractPiToolCallId(entry.payload)
});

const extractPiEntryText = (entry: ForgePiSessionEntry): string => {
    if (isRecord(entry.payload) && typeof entry.payload.text === 'string') return entry.payload.text;
    return entry.summary;
};

const extractPiToolCallId = (payload: unknown): string | undefined =>
    isRecord(payload) && typeof payload.toolCallId === 'string' ? payload.toolCallId : undefined;

const resolvePiToolName = (payload: unknown): string | null =>
    isRecord(payload) && typeof payload.toolName === 'string' ? payload.toolName : null;

const resolvePiTargetEntryId = (payload: unknown): string | null =>
    isRecord(payload) && typeof payload.targetEntryId === 'string' ? payload.targetEntryId : null;

const resolvePiApprovalStatus = (payload: unknown): ForgeTimelineOperationStatus => {
    if (!isRecord(payload) || typeof payload.approved !== 'boolean') return 'completed';
    return payload.approved ? 'completed' : 'cancelled';
};

const isPiErrorPayload = (payload: unknown): boolean =>
    isRecord(payload) && payload.isError === true;

const stringifyPiPayload = (payload: unknown): string | null => {
    if (!isRecord(payload)) return null;
    try {
        return JSON.stringify(payload, null, 2);
    } catch {
        return null;
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const summarizeLorebookEntries = (entries: LuminaLorebookEntry[]): ForgeRequestLorebookEntrySummary[] =>
    entries.map((entry: any) => {
        const keywords = Array.isArray(entry?.key)
            ? entry.key
            : Array.isArray(entry?.keywords)
                ? entry.keywords
                : Array.isArray(entry?.keys)
                    ? entry.keys
                    : [];
        return {
            id: String(entry?.uid || entry?.comment || keywords[0] || 'forge_lorebook_entry'),
            title: String(entry?.comment || entry?.uid || keywords[0] || '未命名条目'),
            comment: String(entry?.comment || ''),
            keywords: keywords.map((keyword: unknown) => String(keyword)),
            disabled: Boolean(entry?.disable)
        };
    });

type ForgeAssistantStreamEvent = Extract<ForgeRuntimeEvent, { type: 'stream_chunk' | 'stream_done' }>;

export interface ForgeAssistantStreamMessageUpdate {
    streamText: string;
    streamThinkingText: string;
    isDone: boolean;
    message: LuminaChatMessage;
}

export interface ForgeAssistantStreamCommitPolicy {
    silentWorldlineUpdate: boolean;
    bumpTimelineRevision: boolean;
}

export const resolveAssistantStreamCommitPolicy = (
    event: ForgeAssistantStreamEvent
): ForgeAssistantStreamCommitPolicy => {
    const isDone = event.type === 'stream_done';
    return {
        silentWorldlineUpdate: !isDone,
        bumpTimelineRevision: isDone
    };
};

export const createAssistantStreamMessageUpdate = (
    event: ForgeAssistantStreamEvent,
    assistantNode: LuminaChatMessage,
    timestamp: number = Date.now()
): ForgeAssistantStreamMessageUpdate => {
    const isDone = event.type === 'stream_done';
    return {
        streamText: event.displayText,
        streamThinkingText: event.thinkingText,
        isDone,
        message: {
            ...assistantNode,
            mesRaw: event.displayText,
            mes: event.displayText,
            thinkingText: event.thinkingText || null,
            pluginRaw: event.rawText,
            fingerprint: MessageUtils.getFingerprint(event.rawText),
            syncStatus: isDone ? 'local' : 'streaming',
            extra: {
                ...assistantNode.extra,
                ...(isDone
                    ? { completedAt: timestamp }
                    : {
                        send_date: assistantNode.extra?.send_date,
                        lastChunkAt: timestamp
                    })
            }
        }
    };
};

export const resolvePromptPresetGenerationSettings = (profileId: PromptPresetProfileId) => (
    clonePromptPresetGenerationSettings(
        promptPresetRegistry.getActivePreset(profileId).generationSettings
    )
);
