import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { CharacterChannelService } from '../../api/core/conversation/CharacterChannelService.js';
import { installCharacterRuntime, type CharacterRuntimeHost } from '../installCharacterRuntime.js';

const createHost = (): CharacterRuntimeHost => ({
    on: vi.fn(),
    off: vi.fn(),
    waitForReady: vi.fn(async () => false),
    syncFromST: vi.fn(async () => undefined),
    createChatSession: vi.fn(),
    renameChatSession: vi.fn(),
    deleteChatSession: vi.fn(),
    importCharacterCard: vi.fn(),
    getAssistantName: vi.fn(() => 'Assistant'),
    getCharAvatar: vi.fn(() => ''),
    getUserAvatar: vi.fn(() => ''),
    DEFAULT_AVATAR: 'default.png',
    attachCharacterRuntime: vi.fn()
});

describe('installCharacterRuntime', () => {
    it('builds one CharacterChannelService from the pinia store and attaches it to the api', () => {
        setActivePinia(createPinia());
        const host = createHost();

        const runtime = installCharacterRuntime(host);

        expect(runtime).toBeInstanceOf(CharacterChannelService);
        expect(host.attachCharacterRuntime).toHaveBeenCalledTimes(1);
        expect(host.attachCharacterRuntime).toHaveBeenCalledWith(runtime);
        // bind() 在构造时订阅了 api 事件
        expect(host.on).toHaveBeenCalledWith('CHAT_CHANGED', expect.any(Function));
    });
});
