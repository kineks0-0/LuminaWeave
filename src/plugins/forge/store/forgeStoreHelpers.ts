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
    ForgeTimelineOperationItem
} from '../../../types/ForgeTimelineTypes.js';

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
