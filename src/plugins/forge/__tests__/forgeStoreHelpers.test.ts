import { describe, expect, it } from 'vitest';
import {
    buildForgePiTimelineFeed,
    createForgeMessageNode,
    sanitizeHistoryMessages,
    summarizeLorebookEntries
} from '../store/forgeStoreHelpers.js';
import { MessageUtils } from '@shared/LuminaMessage.js';
import type { ForgePiSessionEntry } from '@shared/ForgePiTypes.js';

const entry = (
    id: string,
    parentId: string | null,
    kind: ForgePiSessionEntry['kind'],
    payload: ForgePiSessionEntry['payload'],
    summary = `${kind} summary`,
    createdAt = Number(id.replace(/\D/g, '') || 0)
): ForgePiSessionEntry => ({
    id,
    sessionId: 'forge_project__conversation',
    parentId,
    kind,
    title: kind,
    summary,
    createdAt,
    payload
});

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

    it('builds the Forge feed from the active pi branch instead of the old worldline path', () => {
        const feed = buildForgePiTimelineFeed({
            sessionChatId: 'session-1',
            activeNodeId: 'n8',
            entries: [
                entry('n1', null, 'metadata', {}),
                entry('n2', 'n1', 'user', { role: 'user', text: '分支 A' }),
                entry('n3', 'n2', 'assistant', { role: 'assistant', text: '回复 A' }),
                entry('n4', 'n1', 'user', { role: 'user', text: '分支 B' }),
                entry('n5', 'n4', 'process', { role: 'process', text: '正在读取 B.md。' }),
                entry('n6', 'n5', 'workspace_patch', {
                    nodeId: 'n6',
                    changes: [{
                        path: './B.md',
                        kind: 'update',
                        beforeHash: 'before',
                        afterHash: 'after'
                    }]
                }, '1 file change(s)'),
                entry('n7', 'n6', 'assistant', { role: 'assistant', text: '回复 B' }),
                entry('n8', 'n7', 'label', { label: '当前分支' })
            ]
        });

        expect(feed.map(item => item.kind === 'message'
            ? `${item.message.role}:${item.message.mes}`
            : `${item.item.origin?.entryType}:${item.item.summary}`)).toEqual([
            'user:分支 B',
            'process:正在读取 B.md。',
            'workspace_patch:1 file change(s)',
            'assistant:回复 B',
            'label:label summary'
        ]);
        expect(feed.filter(item => item.kind === 'message').map(item => item.message.conversationId)).toEqual([
            'session-1',
            'session-1'
        ]);
        expect(feed.map(item => item.kind === 'message'
            ? item.item.origin?.nodeId
            : item.item.origin?.nodeId)).toEqual(['n4', 'n5', 'n6', 'n7', 'n8']);
    });
});
