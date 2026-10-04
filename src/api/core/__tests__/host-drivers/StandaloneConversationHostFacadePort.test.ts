import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { resourceService } from '@/api/core/hal/resource/index.js';
import { registerLocalResourceSource } from '@/api/core/hal/adapters/standalone/LocalResourceSourceProvider.js';
import { StandaloneConversationHostFacadePort } from '@/api/core/host-drivers/standalone/StandaloneConversationHostFacadePort.js';
import { clearStandaloneChatContext, setStandaloneChatContext } from '@/api/core/host-drivers/standalone/StandaloneChatContext.js';
import { listStandaloneCharacters, resetStandaloneCharacterCacheForTests } from '@/api/core/host-drivers/standalone/StandaloneCharacterDirectory.js';
import { lwStorage } from '@/api/storage.js';

const store = new Map<string, unknown>();

describe('StandaloneConversationHostFacadePort', () => {
    beforeEach(() => {
        store.clear();
        initMockHAL({ runtime: {
            extensionStore: {
                listKeys: vi.fn(async () => Array.from(store.keys())),
                getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null),
                setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }),
                updateJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }),
                deleteJson: vi.fn(async ({ key }: { key: string }) => { store.delete(key); }),
                setBlob: vi.fn(),
                getBlob: vi.fn()
            }
        } });
        registerLocalResourceSource();
        resetStandaloneCharacterCacheForTests();
        lwStorage.set('lumina-chat.userName', '', 'Global');
        clearStandaloneChatContext();
    });

    it('reads assistant name from the local pointer and user name from the persona setting', () => {
        const port = new StandaloneConversationHostFacadePort();
        setStandaloneChatContext({
            chatId: 'lw_chat_1',
            characterId: 'Alice',
            characterName: 'Alice',
            characterAvatarUrl: null
        });
        lwStorage.set('lumina-chat.userName', '旅行者', 'Global');

        expect(port.getAssistantName()).toBe('Alice');
        expect(port.getUserName()).toBe('旅行者');
    });

    it('resolves roster, avatar and name from the local character cache', async () => {
        await resourceService.importResource('local', 'character', {
            data: { name: 'Alice' },
            _lumina_avatar: 'data:image/png;base64,AAAA'
        });
        await listStandaloneCharacters();
        const port = new StandaloneConversationHostFacadePort();

        expect(port.getCharacterRoster()).toEqual([{
            characterId: 'Alice',
            characterName: 'Alice',
            characterAvatarUrl: 'data:image/png;base64,AAAA'
        }]);
        expect(port.getCharacterNameById('Alice')).toBe('Alice');
        expect(port.getCharacterAvatar('Alice')).toBe('data:image/png;base64,AAAA');
    });
});
