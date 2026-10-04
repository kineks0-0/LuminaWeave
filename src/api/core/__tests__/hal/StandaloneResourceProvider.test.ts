import { beforeEach, describe, expect, it } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { StandaloneResourceProvider } from '@/api/core/hal/adapters/standalone/StandaloneResourceProvider.js';
import {
    clearStandaloneChatContext,
    setStandaloneChatContext
} from '@/api/core/host-drivers/standalone/StandaloneChatContext.js';

describe('StandaloneResourceProvider', () => {
    beforeEach(() => {
        initMockHAL();
        clearStandaloneChatContext();
    });

    it('exposes the local chat pointer as the current character/chat', () => {
        const provider = new StandaloneResourceProvider();
        expect(provider.getCurrentChatId()).toBeNull();
        expect(provider.getCurrentCharacterId()).toBeNull();

        setStandaloneChatContext({
            chatId: 'lw_chat_1',
            characterId: 'Alice',
            characterName: 'Alice',
            characterAvatarUrl: null
        });

        expect(provider.getCurrentChatId()).toBe('lw_chat_1');
        expect(provider.getCurrentCharacterId()).toBe('Alice');
    });

    it('has no host-side worldbook or preset state', async () => {
        const provider = new StandaloneResourceProvider();
        expect(provider.getActiveLorebookEntries()).toEqual([]);
        await expect(provider.getPreset('in_use')).resolves.toBeNull();
    });
});
