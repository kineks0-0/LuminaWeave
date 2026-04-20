import { beforeEach, describe, expect, it, vi } from 'vitest';

const stClientMock = vi.hoisted(() => ({
    getCharacterRoster: vi.fn(),
    switchToCharacterChat: vi.fn(),
    createNewCharacterChat: vi.fn(),
    renameCharacterChat: vi.fn(),
    deleteCharacterChat: vi.fn(),
    closeCurrentChatView: vi.fn(),
    getChatSessionCharacterMeta: vi.fn()
}));

const chatSessionIndexServiceMock = vi.hoisted(() => ({
    listChatSessions: vi.fn()
}));

vi.mock('../st-adapter/STClient.js', () => ({
    STClient: stClientMock
}));

vi.mock('../ChatSessionIndexService.js', () => ({
    chatSessionIndexService: chatSessionIndexServiceMock
}));

import { CompositeChatHostProvider } from '../chat-host/ChatHostPorts.js';

describe('CompositeChatHostProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stClientMock.getCharacterRoster.mockResolvedValue([]);
        stClientMock.switchToCharacterChat.mockResolvedValue({ success: true });
        stClientMock.createNewCharacterChat.mockResolvedValue({ success: true, resolvedChatFile: 'chat_new' });
        stClientMock.renameCharacterChat.mockResolvedValue({ success: true, resolvedChatFile: 'chat_renamed' });
        stClientMock.deleteCharacterChat.mockResolvedValue({ success: true });
        stClientMock.closeCurrentChatView.mockResolvedValue(true);
        stClientMock.getChatSessionCharacterMeta.mockResolvedValue(null);
        chatSessionIndexServiceMock.listChatSessions.mockResolvedValue([]);
    });

    it('opens sessions through ST only and does not expose host-history capabilities', async () => {
        const provider = new CompositeChatHostProvider();

        await expect(provider.openSession({
            sessionId: 'chat_beta',
            characterId: '2',
            characterName: 'Beta',
            characterAvatarUrl: '/beta.png'
        })).resolves.toBe(true);

        expect(stClientMock.switchToCharacterChat).toHaveBeenCalledWith({
            characterId: '2',
            characterName: 'Beta',
            characterAvatarUrl: '/beta.png',
            chatFile: 'chat_beta'
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
            supportsCurrentWindowInfo: false
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
