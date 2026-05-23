import { describe, expect, it } from 'vitest';
import { MessageUtils, type LuminaChatMessage } from '@shared/LuminaMessage.js';
import {
    createAssistantStreamMessageUpdate,
    resolveAssistantStreamCommitPolicy
} from '../store/forgeStoreHelpers.js';
import type { ForgeRuntimeEvent } from '../../../types/ForgeRuntimeTypes.js';

const createAssistantNode = (): LuminaChatMessage => ({
    id: 'assistant-1',
    parentId: 'user-1',
    name: 'Forge Assistant',
    role: 'assistant',
    is_user: false,
    conversationType: 'forge',
    conversationId: 'session-1',
    nodeKind: 'message',
    mesRaw: '',
    mes: '',
    thinkingText: null,
    pluginRaw: '',
    fingerprint: '',
    extra: {
        send_date: 100,
        conversationType: 'forge'
    },
    createdAt: 100,
    syncStatus: 'streaming'
});

describe('forge runtime stream presentation', () => {
    it('keeps assistant message streaming while a chunk arrives', () => {
        const event: ForgeRuntimeEvent = {
            type: 'stream_chunk',
            requestId: 'request-1',
            displayText: '可见文本',
            thinkingText: '思考文本',
            rawText: '<thinking>思考文本</thinking>可见文本'
        };

        const update = createAssistantStreamMessageUpdate(event, createAssistantNode(), 123);

        expect(update.streamText).toBe('可见文本');
        expect(update.streamThinkingText).toBe('思考文本');
        expect(update.isDone).toBe(false);
        expect(update.message.syncStatus).toBe('streaming');
        expect(update.message.pluginRaw).toBe('<thinking>思考文本</thinking>可见文本');
        expect(update.message.fingerprint).toBe(MessageUtils.getFingerprint('<thinking>思考文本</thinking>可见文本'));
        expect(update.message.extra).toMatchObject({
            send_date: 100,
            lastChunkAt: 123
        });
    });

    it('treats intermediate chunks as transient UI updates', () => {
        const event: ForgeRuntimeEvent = {
            type: 'stream_chunk',
            requestId: 'request-1',
            displayText: '增量文本',
            thinkingText: '',
            rawText: '增量文本'
        };

        expect(resolveAssistantStreamCommitPolicy(event)).toEqual({
            silentWorldlineUpdate: true,
            bumpTimelineRevision: false
        });
    });

    it('marks assistant message local when the stream is done', () => {
        const event: ForgeRuntimeEvent = {
            type: 'stream_done',
            requestId: 'request-1',
            displayText: '最终文本',
            thinkingText: '',
            rawText: '最终文本',
            completedAt: 456
        };

        const update = createAssistantStreamMessageUpdate(event, createAssistantNode(), 789);

        expect(update.streamText).toBe('最终文本');
        expect(update.streamThinkingText).toBe('');
        expect(update.isDone).toBe(true);
        expect(update.message.syncStatus).toBe('local');
        expect(update.message.pluginRaw).toBe('最终文本');
        expect(update.message.extra).toMatchObject({
            conversationType: 'forge',
            completedAt: 789
        });
    });

    it('commits the final stream update to the conversation timeline', () => {
        const event: ForgeRuntimeEvent = {
            type: 'stream_done',
            requestId: 'request-1',
            displayText: '最终文本',
            thinkingText: '',
            rawText: '最终文本',
            completedAt: 456
        };

        expect(resolveAssistantStreamCommitPolicy(event)).toEqual({
            silentWorldlineUpdate: false,
            bumpTimelineRevision: true
        });
    });
});
