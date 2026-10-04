import { describe, expect, it, vi } from 'vitest';
import type { ResourceRef } from '@shared/resources/index.js';

const mocks = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    let chatId = 'chat-1';
    return {
        store,
        setChatId: (id: string) => { chatId = id; },
        lwStorage: {
            _getContextIds: () => ({ chatId }),
            get: (key: string, fallback: unknown) => store.has(key) ? store.get(key) : fallback,
            set: (key: string, value: unknown) => { store.set(key, value); }
        }
    };
});

vi.mock('@/api/storage.js', () => ({ lwStorage: mocks.lwStorage }));

import {
    isWorldbookEnabledForCurrentChat,
    isWorldbookEnabledGlobally,
    setWorldbookEnabledForCurrentChat,
    setWorldbookEnabledGlobally
} from '../sessionWorldbookBindings.js';

const worldbookRef = (id: string): ResourceRef => ({
    sourceId: 'local',
    resourceType: 'worldbook',
    resourceId: id,
    path: `lumina://local/worldbook/${id}`,
    writable: true
});

describe('session worldbook bindings', () => {
    it('enables and disables a worldbook for the current chat only', () => {
        const book = worldbookRef('book-a');
        const other = worldbookRef('book-b');

        setWorldbookEnabledForCurrentChat(book, true);
        expect(isWorldbookEnabledForCurrentChat(book)).toBe(true);
        expect(isWorldbookEnabledForCurrentChat(other)).toBe(false);

        setWorldbookEnabledForCurrentChat(book, false);
        expect(isWorldbookEnabledForCurrentChat(book)).toBe(false);
    });

    it('does nothing when there is no active chat', () => {
        mocks.setChatId('');
        const book = worldbookRef('book-c');
        setWorldbookEnabledForCurrentChat(book, true);
        expect(isWorldbookEnabledForCurrentChat(book)).toBe(false);
        mocks.setChatId('chat-1');
    });

    it('enables and disables a worldbook globally without touching the chat state', () => {
        const book = worldbookRef('book-global');

        setWorldbookEnabledGlobally(book, true);
        expect(isWorldbookEnabledGlobally(book)).toBe(true);
        expect(isWorldbookEnabledForCurrentChat(book)).toBe(false);

        setWorldbookEnabledGlobally(book, false);
        expect(isWorldbookEnabledGlobally(book)).toBe(false);
    });
});
