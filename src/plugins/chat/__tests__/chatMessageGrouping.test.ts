import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { describe, expect, it } from 'vitest';
import {
    buildChatMessageGroups,
    resolveChatMessageTimestamp
} from '../presentation/chatMessageGrouping.js';

const at = (iso: string): number => new Date(iso).getTime();

const message = (
    id: string,
    isUser: boolean,
    createdAt?: number,
    name = isUser ? 'User' : 'Alice'
): LuminaChatMessage => ({
    id,
    parentId: null,
    name,
    role: isUser ? 'user' : 'assistant',
    is_user: isUser,
    mesRaw: id,
    mes: id,
    fingerprint: id,
    extra: {},
    createdAt
});

const NOW = at('2026-10-04T12:00:00');

describe('buildChatMessageGroups', () => {
    it('groups consecutive messages from the same author within the time window', () => {
        const groups = buildChatMessageGroups([
            message('a1', false, at('2026-10-04T10:00:00')),
            message('a2', false, at('2026-10-04T10:03:00')),
            message('a3', false, at('2026-10-04T10:20:00')),
            message('u1', true, at('2026-10-04T10:21:00'))
        ], NOW);

        expect(groups.map(group => [group.groupStart, group.groupEnd])).toEqual([
            [true, false],
            [false, true],
            [true, true],
            [true, true]
        ]);
    });

    it('starts a new group when the author name changes', () => {
        const groups = buildChatMessageGroups([
            message('a1', false, at('2026-10-04T10:00:00'), 'Alice'),
            message('b1', false, at('2026-10-04T10:01:00'), 'Bob')
        ], NOW);
        expect(groups[1].groupStart).toBe(true);
    });

    it('groups by author alone when timestamps are missing', () => {
        const groups = buildChatMessageGroups([message('a1', false), message('a2', false)], NOW);
        expect(groups.map(group => group.groupStart)).toEqual([true, false]);
        expect(groups[0].timeLabel).toBe('');
    });

    it('formats times and inserts day labels when the day changes', () => {
        const groups = buildChatMessageGroups([
            message('a1', false, at('2026-10-02T09:05:00')),
            message('a2', false, at('2026-10-03T23:59:00')),
            message('u1', true, at('2026-10-04T08:30:00'))
        ], NOW);

        expect(groups.map(group => group.timeLabel)).toEqual(['09:05', '23:59', '08:30']);
        expect(groups.map(group => group.dayLabel)).toEqual(['10月2日', '昨天', '今天']);
        expect(groups[1].groupStart).toBe(true);
    });
});

describe('resolveChatMessageTimestamp', () => {
    it('prefers createdAt and falls back to SillyTavern send_date', () => {
        expect(resolveChatMessageTimestamp({ ...message('a', false, 1000) })).toBe(1000);
        expect(resolveChatMessageTimestamp({ ...message('a', false), extra: { send_date: 2000 } })).toBe(2000);
        expect(resolveChatMessageTimestamp({ ...message('a', false), extra: { send_date: 'October 4, 2026 2:59am' } }))
            .toBe(at('2026-10-04T02:59:00'));
        expect(resolveChatMessageTimestamp({ ...message('a', false), extra: { send_date: 'not a date' } })).toBeNull();
    });
});
