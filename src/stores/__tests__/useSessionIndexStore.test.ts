import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useSessionIndexStore } from '../useSessionIndexStore';
import { chatSessionIndexService } from '../../api/core/ChatSessionIndexService.js';
import { forgeSessionRepository } from '../../api/core/ForgeSessionRepository.js';
import { lwStorage } from '../../api/storage.js';
import { STClient } from '../../api/core/st-adapter/STClient.js';

vi.mock('../../api/core/ChatSessionIndexService.js', () => ({
    chatSessionIndexService: {
        listChatSessions: vi.fn()
    }
}));

vi.mock('../../api/core/ForgeSessionRepository.js', () => ({
    forgeSessionRepository: {
        refreshFromServer: vi.fn(async () => undefined),
        listSessions: vi.fn(() => []),
        getActiveSessionId: vi.fn(() => null),
        setActiveSessionId: vi.fn()
    }
}));

vi.mock('../../api/storage.js', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ chatId: 'chat_live' }))
    }
}));

vi.mock('../../api/core/st-adapter/STClient.js', () => ({
    STClient: {
        normalizeChatId: vi.fn((value: unknown) => {
            if (typeof value !== 'string' && typeof value !== 'number') {
                return null;
            }
            const normalized = String(value).trim();
            return !normalized || normalized === 'null' || normalized === 'undefined' || normalized === 'default'
                ? null
                : normalized;
        })
    }
}));

describe('useSessionIndexStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        vi.mocked(chatSessionIndexService.listChatSessions).mockResolvedValue([
            {
                id: 'chat_a',
                title: 'A',
                source: 'lumina-server',
                createdAt: 1,
                updatedAt: 1,
                messageCount: 1,
                summary: '',
                previewMessage: '',
                activeLeafId: null,
                characterId: null,
                characterName: '',
                characterAvatarUrl: null
            },
            {
                id: 'chat_b',
                title: 'B',
                source: 'lumina-server',
                createdAt: 2,
                updatedAt: 2,
                messageCount: 1,
                summary: '',
                previewMessage: '',
                activeLeafId: null,
                characterId: null,
                characterName: '',
                characterAvatarUrl: null
            }
        ]);
        vi.mocked(forgeSessionRepository.listSessions).mockReturnValue([]);
        vi.mocked(lwStorage._getContextIds).mockReturnValue({ chatId: 'default' } as any);
        vi.mocked(STClient.normalizeChatId).mockImplementation((value: unknown) => {
            if (typeof value !== 'string' && typeof value !== 'number') {
                return null;
            }
            const normalized = String(value).trim();
            return !normalized || normalized === 'null' || normalized === 'undefined' || normalized === 'default'
                ? null
                : normalized;
        });
    });

    it('clears selected chat session when current live chat disappears instead of falling back to the first archived session', async () => {
        const store = useSessionIndexStore();
        store.selectChatSession('chat_b');

        await store.refresh();

        expect(store.chatSessions.map((session) => session.id)).toEqual(['chat_a', 'chat_b']);
        expect(store.selectedChatSessionId).toBeNull();
    });
});
