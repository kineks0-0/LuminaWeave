import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { resourceService } from '@/api/core/hal/resource/index.js';
import { registerLocalResourceSource } from '@/api/core/hal/adapters/standalone/LocalResourceSourceProvider.js';
import { StandaloneChatSessionDirectoryProvider } from '@/api/core/host-drivers/standalone/StandaloneChatHostProvider.js';
import {
    clearStandaloneChatContext,
    getStandaloneChatContext
} from '@/api/core/host-drivers/standalone/StandaloneChatContext.js';
import {
    resetStandaloneCharacterCacheForTests
} from '@/api/core/host-drivers/standalone/StandaloneCharacterDirectory.js';
import { lwStorage } from '@/api/storage.js';

const store = new Map<string, unknown>();

const createProvider = (): StandaloneChatSessionDirectoryProvider =>
    new StandaloneChatSessionDirectoryProvider();

const importAlice = async (): Promise<void> => {
    await resourceService.importResource('local', 'character', {
        data: {
            name: 'Alice',
            first_mes: '你好，{{user}}！我是{{char}}。',
            description: '骑士'
        },
        _lumina_avatar: 'data:image/png;base64,AAAA'
    });
};

describe('StandaloneChatSessionDirectoryProvider', () => {
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

    it('lists local character resources as the roster', async () => {
        await importAlice();

        await expect(createProvider().listCharacterRoster()).resolves.toEqual([{
            characterId: 'Alice',
            characterName: 'Alice',
            characterAvatarUrl: 'data:image/png;base64,AAAA'
        }]);
    });

    it('creates a local session with pointer and greeting initial nodes', async () => {
        await importAlice();
        lwStorage.set('lumina-chat.userName', '旅行者', 'Global');

        const result = await createProvider().createSession({
            characterId: 'Alice',
            characterName: 'Alice',
            characterAvatarUrl: null
        });

        expect(result).toMatchObject({
            success: true,
            resolvedCharacterId: 'Alice',
            resolvedCharacterName: 'Alice'
        });
        expect(result.resolvedChatFile).toMatch(/^lw_chat_Alice_/);
        expect(getStandaloneChatContext()).toMatchObject({
            chatId: result.resolvedChatFile,
            characterId: 'Alice',
            characterName: 'Alice'
        });

        const greeting = result.initialNodes?.[0];
        expect(greeting).toMatchObject({
            role: 'assistant',
            is_user: false,
            name: 'Alice',
            characterId: 'Alice',
            parentId: null
        });
        expect(greeting?.mes).toBe('你好，旅行者！我是Alice。');
    });

    it('opens sessions by updating the local pointer', async () => {
        await expect(createProvider().openSession({
            sessionId: 'lw_chat_x',
            characterId: 'Alice',
            characterName: 'Alice',
            characterAvatarUrl: null
        })).resolves.toBe(true);

        expect(getStandaloneChatContext()?.chatId).toBe('lw_chat_x');
    });

    it('clears the pointer when the current session is deleted', async () => {
        const provider = createProvider();
        const created = await provider.createSession({ characterId: null, characterName: '' });

        await provider.deleteSession({ sessionId: created.resolvedChatFile! });

        expect(getStandaloneChatContext()).toBeNull();
    });
});
