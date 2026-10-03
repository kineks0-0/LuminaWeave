import { describe, expect, it } from 'vitest';
import type { CharacterChannelGroup, CharacterChannelSessionItem } from '../../../types/ConversationContextTypes.js';
import {
    buildTelegramChatListRows,
    formatChatListDate,
    resolveAvatarHue
} from '../presentation/telegramChatList.js';

const now = new Date(2026, 9, 4, 15, 30).getTime(); // 周日

const session = (id: string, characterKey: string, updatedAt: number, extra: Partial<CharacterChannelSessionItem> = {}): CharacterChannelSessionItem => ({
    id,
    title: `会话 ${id}`,
    source: 'lumina-server',
    createdAt: updatedAt,
    updatedAt,
    messageCount: 3,
    summary: '',
    previewMessage: '',
    activeLeafId: null,
    sourceId: 'chat',
    characterKey,
    recentHistoryPreview: `预览 ${id}`,
    stableSessionId: null,
    ...extra
});

const group = (key: string, name: string, sessions: CharacterChannelSessionItem[]): CharacterChannelGroup => ({
    key,
    characterId: key,
    characterName: name,
    characterAvatarUrl: null,
    characterInitial: name.slice(0, 1),
    sessions,
    recentSession: sessions[0] ?? null,
    recentPreview: sessions[0]?.recentHistoryPreview ?? ''
});

describe('formatChatListDate', () => {
    it('shows HH:mm for today', () => {
        expect(formatChatListDate(new Date(2026, 9, 4, 9, 5).getTime(), now)).toBe('09:05');
    });

    it('shows the weekday within the last six days', () => {
        expect(formatChatListDate(new Date(2026, 9, 3, 22, 0).getTime(), now)).toBe('周六');
        expect(formatChatListDate(new Date(2026, 8, 28, 10, 0).getTime(), now)).toBe('周一');
    });

    it('shows month and day within the same year, short date otherwise', () => {
        expect(formatChatListDate(new Date(2026, 1, 16, 3, 57).getTime(), now)).toBe('2月16日');
        expect(formatChatListDate(new Date(2025, 6, 22, 8, 0).getTime(), now)).toBe('25.07.22');
    });

    it('returns an empty string for missing timestamps', () => {
        expect(formatChatListDate(0, now)).toBe('');
    });
});

describe('buildTelegramChatListRows', () => {
    const groups = [
        group('alice', 'Alice', [session('a1', 'alice', now - 60_000), session('a2', 'alice', now - 86_400_000 * 3)]),
        group('bob', 'Bob', [session('b1', 'bob', now - 3_600_000, { recentHistoryPreview: '', previewMessage: '旧预览' })])
    ];

    it('lists every session newest first with its character identity', () => {
        const rows = buildTelegramChatListRows(groups, { query: '', activeSessionId: 'b1', now });
        expect(rows.map(row => row.sessionId)).toEqual(['a1', 'b1', 'a2']);
        expect(rows[1]).toMatchObject({ name: 'Bob', preview: '旧预览', isActive: true, dateLabel: '14:30' });
    });

    it('shows the session title only for characters with several sessions', () => {
        const rows = buildTelegramChatListRows(groups, { query: '', activeSessionId: null, now });
        expect(rows.find(row => row.sessionId === 'a1')?.sessionTitle).toBe('会话 a1');
        expect(rows.find(row => row.sessionId === 'b1')?.sessionTitle).toBe('');
    });

    it('filters by character name, session title and preview', () => {
        const filter = (query: string) => buildTelegramChatListRows(groups, { query, activeSessionId: null, now })
            .map(row => row.sessionId);
        expect(filter('bob')).toEqual(['b1']);
        expect(filter('会话 a2')).toEqual(['a2']);
        expect(filter('旧预')).toEqual(['b1']);
    });
});

describe('resolveAvatarHue', () => {
    it('is stable per name and within the hue circle', () => {
        expect(resolveAvatarHue('Alice')).toBe(resolveAvatarHue('Alice'));
        expect(resolveAvatarHue('Alice')).toBeGreaterThanOrEqual(0);
        expect(resolveAvatarHue('Alice')).toBeLessThan(360);
    });
});
