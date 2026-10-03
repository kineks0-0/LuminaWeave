import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { describe, expect, it } from 'vitest';
import type { ForgeTimelineOperationItem } from '../../../types/ForgeTimelineTypes.js';
import type { ForgeTimelineFeedItem } from '../store/forgeStoreHelpers.js';
import { buildForgeGroupedFeed } from '../project/forgeGroupedFeed.js';

const message = (id: string, role: 'user' | 'assistant', text: string, syncStatus?: LuminaChatMessage['syncStatus']): ForgeTimelineFeedItem => ({
    id: `feed-${id}`,
    kind: 'message',
    timestamp: 0,
    item: { id: `feed-${id}`, kind: 'message', messageId: id, createdAt: 0, updatedAt: 0 },
    message: {
        id,
        parentId: null,
        name: role,
        role,
        is_user: role === 'user',
        mesRaw: text,
        mes: text,
        fingerprint: id,
        extra: {},
        syncStatus
    }
});

const operation = (id: string, status: ForgeTimelineOperationItem['status']): ForgeTimelineFeedItem => ({
    id,
    kind: 'operation',
    timestamp: 0,
    item: {
        id,
        kind: 'operation',
        operationKind: 'execution',
        status,
        title: 'read',
        summary: 'read',
        detail: null,
        sourceTag: 'pi:tool_call',
        dedupeKey: null,
        targetEntryId: null,
        relatedMessageId: null,
        layer: null,
        requestPrompt: null,
        origin: undefined,
        createdAt: 0,
        updatedAt: 0,
        completedAt: status === 'running' ? null : 0
    }
});

const baseInput = {
    workspaceChangesByAssistantTurn: [],
    streamThinkingText: null,
    isGenerating: false
};

describe('buildForgeGroupedFeed', () => {
    it('keeps a process group key stable when its first operation arrives after streamed thinking', () => {
        const beforeOperation = buildForgeGroupedFeed({
            ...baseInput,
            isGenerating: true,
            streamThinkingText: 'planning',
            feed: [message('u1', 'user', 'hi'), message('a1', 'assistant', '', 'streaming')]
        });
        const afterOperation = buildForgeGroupedFeed({
            ...baseInput,
            isGenerating: true,
            streamThinkingText: 'planning',
            feed: [message('u1', 'user', 'hi'), operation('op-1', 'running'), message('a1', 'assistant', '', 'streaming')]
        });
        const processKey = (items: ReturnType<typeof buildForgeGroupedFeed>) => items.find(item => item.kind === 'agent-process')?.renderKey;
        expect(processKey(beforeOperation)).toBe('t1:proc:0');
        expect(processKey(afterOperation)).toBe('t1:proc:0');
    });

    it('derives identical keys for live and committed feeds with the same turn structure', () => {
        const live = buildForgeGroupedFeed({
            ...baseInput,
            feed: [message('node-u1', 'user', 'hi'), operation('op-1', 'completed'), message('node-a1', 'assistant', 'done')]
        });
        const committed = buildForgeGroupedFeed({
            ...baseInput,
            feed: [message('forge_pi_message_u1', 'user', 'hi'), operation('forge_pi_op_1', 'completed'), message('forge_pi_message_a1', 'assistant', 'done')]
        });
        expect(live.map(item => item.renderKey)).toEqual(committed.map(item => item.renderKey));
        expect(live.map(item => item.renderKey)).toEqual(['t1:msg:user:0', 't1:proc:0', 't1:msg:assistant:0']);
    });

    it('keeps the trailing process group active while the assistant has not started replying', () => {
        const items = buildForgeGroupedFeed({
            ...baseInput,
            isGenerating: true,
            streamThinkingText: 'thinking only',
            feed: [message('u1', 'user', 'hi'), message('a1', 'assistant', '', 'streaming')]
        });
        const process = items.find(item => item.kind === 'agent-process');
        expect(process?.kind === 'agent-process' && process.presentation.isDone).toBe(false);
    });

    it('marks the process done once the streaming assistant reply has visible text', () => {
        const items = buildForgeGroupedFeed({
            ...baseInput,
            isGenerating: true,
            feed: [message('u1', 'user', 'hi'), operation('op-1', 'completed'), message('a1', 'assistant', 'Answer', 'streaming')]
        });
        const process = items.find(item => item.kind === 'agent-process');
        expect(process?.kind === 'agent-process' && process.presentation.isDone).toBe(true);
    });

    it('keeps a trailing operation group active while generation continues', () => {
        const items = buildForgeGroupedFeed({
            ...baseInput,
            isGenerating: true,
            feed: [message('u1', 'user', 'hi'), operation('op-1', 'completed')]
        });
        const process = items.find(item => item.kind === 'agent-process');
        expect(process?.kind === 'agent-process' && process.presentation.isDone).toBe(false);
    });
});
