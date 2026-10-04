import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatSessionIndexServiceMock = vi.hoisted(() => ({
    listChatSessions: vi.fn()
}));

vi.mock('@/api/core/conversation/ChatSessionIndexService.js', () => ({
    chatSessionIndexService: chatSessionIndexServiceMock
}));

import { CompositeChatHostProvider, type ChatSessionDirectoryPort } from '@/api/core/conversation/ChatHostPorts.js';

describe('CompositeChatHostProvider', () => {
    const directoryPort: ChatSessionDirectoryPort = {
        listCharacterRoster: vi.fn(async () => []),
        openSession: vi.fn(async () => true),
        createSession: vi.fn(async () => ({
            success: true,
            resolvedCharacterId: null,
            resolvedCharacterName: null,
            resolvedCharacterAvatarUrl: null,
            resolvedChatFile: 'chat_new'
        })),
        renameSession: vi.fn(async () => ({
            success: true,
            resolvedCharacterId: null,
            resolvedCharacterName: null,
            resolvedCharacterAvatarUrl: null,
            resolvedChatFile: 'chat_renamed',
            previousChatFile: null
        })),
        deleteSession: vi.fn(async () => ({
            success: true,
            resolvedCharacterId: null,
            resolvedCharacterName: null,
            resolvedCharacterAvatarUrl: null,
            resolvedChatFile: null
        })),
        closeCurrentSession: vi.fn(async () => true),
        resolveSessionCharacterMeta: vi.fn(async () => null)
    };

    beforeEach(() => {
        vi.clearAllMocks();
        chatSessionIndexServiceMock.listChatSessions.mockResolvedValue([]);
    });

    it('opens sessions through the registered directory port and does not expose host-history capabilities', async () => {
        const provider = new CompositeChatHostProvider(directoryPort);

        await expect(provider.openSession({
            sessionId: 'chat_beta',
            characterId: '2',
            characterName: 'Beta',
            characterAvatarUrl: '/beta.png'
        })).resolves.toBe(true);

        expect(directoryPort.openSession).toHaveBeenCalledWith({
            sessionId: 'chat_beta',
            characterId: '2',
            characterName: 'Beta',
            characterAvatarUrl: '/beta.png'
        });
        expect(provider.getCapabilityFlags()).toEqual({
            supportsCharacterRoster: true,
            supportsCreateSession: true,
            supportsRenameSession: true,
            supportsDeleteSession: true,
            supportsCloseCurrentSession: true,
            supportsNativeOpenSession: false,
            supportsHostHistory: false,
            supportsHostSearch: false,
            supportsFindLastMessage: false,
            supportsStableSessionId: false,
            supportsCurrentWindowInfo: false,
            supportsCharacterImport: false
        });
    });

    it('returns null for disabled host-history reads', async () => {
        const provider = new CompositeChatHostProvider();
        const target = {
            sessionId: 'chat_beta',
            characterId: '2',
            characterName: 'Beta',
            characterAvatarUrl: '/beta.png'
        };

        await expect(provider.getCurrentRef()).resolves.toBeNull();
        await expect(provider.getWindowInfo()).resolves.toBeNull();
        await expect(provider.getRecentHistory(target, 5)).resolves.toBeNull();
        await expect(provider.searchMessages(target, 'hello')).resolves.toBeNull();
        await expect(provider.findLastMessage(target, { role: 'assistant' })).resolves.toBeNull();
        await expect(provider.getSessionSummary(target)).resolves.toBeNull();
        await expect(provider.getStableSessionId(target)).resolves.toBeNull();
    });
});
