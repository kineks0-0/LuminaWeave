import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type { ForgeTimelineOperationItem } from '../../../types/ForgeTimelineTypes.js';
import type { ForgeTimelineFeedItem } from '../store/forgeStoreHelpers.js';
import {
    buildForgeAgentProcessPresentation,
    type ForgeAgentProcessPresentation
} from './forgeAgentProcessPresentation.js';
import type { ForgeFeedWorkspaceChange } from './forgeWorkspaceChangePresentation.js';

export interface ForgeGroupedFeedMessage {
    kind: 'message';
    id: string;
    /** 按回合序号生成的渲染 key：流式 feed 与提交后的 pi feed 结构相同则 key 相同，Vue 原地复用 DOM */
    renderKey: string;
    message: LuminaChatMessage;
    workspaceChanges?: ForgeFeedWorkspaceChange[];
    suppressThinking?: boolean;
}

export interface ForgeGroupedFeedProcess {
    kind: 'agent-process';
    id: string;
    renderKey: string;
    presentation: ForgeAgentProcessPresentation;
}

export type ForgeGroupedFeedItem = ForgeGroupedFeedMessage | ForgeGroupedFeedProcess;

export interface BuildForgeGroupedFeedInput {
    feed: readonly ForgeTimelineFeedItem[];
    workspaceChangesByAssistantTurn: readonly ForgeFeedWorkspaceChange[][];
    streamThinkingText: string | null;
    isGenerating: boolean;
}

/** 连续的 agent operation 聚合为"执行过程"，与消息交错排列。 */
export const buildForgeGroupedFeed = ({
    feed,
    workspaceChangesByAssistantTurn,
    streamThinkingText,
    isGenerating
}: BuildForgeGroupedFeedInput): ForgeGroupedFeedItem[] => {
    const result: ForgeGroupedFeedItem[] = [];
    let opBuffer: ForgeTimelineOperationItem[] = [];
    let turn = 0;
    let processIndexInTurn = 0;
    const roleIndexInTurn = new Map<string, number>();
    let assistantIndex = 0;

    const flushProcess = (options: {
        workspaceChanges?: ForgeFeedWorkspaceChange[];
        hasAssistantReply?: boolean;
        streamProcessText?: string | null;
        isActive: boolean;
    }): void => {
        const workspaceChanges = options.workspaceChanges ?? [];
        const streamProcessText = options.streamProcessText?.trim() || null;
        if (opBuffer.length === 0 && workspaceChanges.length === 0 && !streamProcessText) return;
        const renderKey = `t${turn}:proc:${processIndexInTurn}`;
        processIndexInTurn += 1;
        result.push({
            kind: 'agent-process',
            id: renderKey,
            renderKey,
            presentation: buildForgeAgentProcessPresentation({
                id: renderKey,
                operations: [...opBuffer],
                workspaceChanges,
                streamProcessText,
                hasAssistantReply: options.hasAssistantReply ?? false,
                isActive: options.isActive
            })
        });
        opBuffer = [];
    };

    const nextMessageKey = (role: string): string => {
        const index = roleIndexInTurn.get(role) ?? 0;
        roleIndexInTurn.set(role, index + 1);
        return `t${turn}:msg:${role}:${index}`;
    };

    for (const entry of feed) {
        if (entry.kind === 'operation') {
            opBuffer.push(entry.item);
            continue;
        }

        const message = entry.message;
        if (message.role === 'assistant') {
            const workspaceChanges = workspaceChangesByAssistantTurn[assistantIndex] ?? [];
            const isStreamingAssistant = message.syncStatus === 'streaming';
            const hasReplyText = Boolean(message.mes || message.mesRaw);
            const streamProcessText = isStreamingAssistant ? streamThinkingText : null;
            flushProcess({
                workspaceChanges,
                hasAssistantReply: !isStreamingAssistant && hasReplyText,
                streamProcessText,
                // 回复正文开始输出前，执行过程保持展开
                isActive: isStreamingAssistant && !hasReplyText
            });
            result.push({
                kind: 'message',
                id: entry.id,
                renderKey: nextMessageKey('assistant'),
                message,
                suppressThinking: Boolean(streamProcessText),
                workspaceChanges
            });
            assistantIndex += 1;
            continue;
        }

        flushProcess({ isActive: false });
        if (message.role === 'user') {
            turn += 1;
            processIndexInTurn = 0;
            roleIndexInTurn.clear();
        }
        result.push({ kind: 'message', id: entry.id, renderKey: nextMessageKey(message.role), message });
    }

    flushProcess({ isActive: isGenerating });
    return result;
};
