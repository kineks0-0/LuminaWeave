import { describe, expect, it } from 'vitest';
import {
    createForgeMessageNode,
    sanitizeHistoryMessages,
    summarizeLorebookEntries
} from '../store/forgeStoreHelpers.js';
import { MessageUtils } from '@shared/LuminaMessage.js';

describe('forgeStoreHelpers', () => {
    it('sanitizes non-empty chat history messages for runtime requests', () => {
        const messages = sanitizeHistoryMessages([
            { role: 'user', mes: ' hello ', mesRaw: '', name: 'Alice' },
            { role: 'assistant', mes: '', mesRaw: 'raw reply', name: 'Bot' },
            { role: 'user', mes: '   ', mesRaw: '', name: 'Empty' }
        ]);

        expect(messages).toEqual([
            { role: 'user', content: ' hello ', name: 'Alice' },
            { role: 'assistant', content: 'raw reply', name: 'Bot' }
        ]);
    });

    it('summarizes lorebook entries with stable fallback titles and keywords', () => {
        const entries = summarizeLorebookEntries([
            { uid: 'entry-1', comment: '地点', key: ['城市'], disable: false },
            { comment: '', keywords: ['备用'], disable: true }
        ] as any);

        expect(entries).toEqual([
            {
                id: 'entry-1',
                title: '地点',
                comment: '地点',
                keywords: ['城市'],
                disabled: false
            },
            {
                id: '备用',
                title: '备用',
                comment: '',
                keywords: ['备用'],
                disabled: true
            }
        ]);
    });

    it('creates deterministic Forge message nodes for a session', () => {
        const node = createForgeMessageNode({
            role: 'assistant',
            content: '回复内容',
            parentId: 'parent-1',
            sessionChatId: 'session-1',
            timestamp: 123,
            nodeId: 'node-1'
        });

        expect(node).toMatchObject({
            id: 'node-1',
            parentId: 'parent-1',
            name: 'Forge Assistant',
            role: 'assistant',
            is_user: false,
            conversationType: 'forge',
            conversationId: 'session-1',
            nodeKind: 'message',
            mesRaw: '回复内容',
            mes: '回复内容',
            pluginRaw: '回复内容',
            fingerprint: MessageUtils.getFingerprint('回复内容'),
            createdAt: 123,
            syncStatus: 'local'
        });
        expect(node.extra).toMatchObject({
            send_date: 123,
            conversationType: 'forge',
            conversationId: 'session-1',
            nodeKind: 'message'
        });
    });
});
