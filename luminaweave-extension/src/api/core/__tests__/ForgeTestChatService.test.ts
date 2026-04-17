import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    resolveNodesFromPreset,
    createSession,
    cleanMessages,
    buildTestChatMessages,
    getPreset,
    getInstructSettings,
    runTask,
    storageGet
} = vi.hoisted(() => ({
    resolveNodesFromPreset: vi.fn(() => [{ id: 'node-1', provider: 'openai', model: 'gpt-test' }]),
    createSession: vi.fn((options) => ({ options })),
    cleanMessages: vi.fn((messages) => messages),
    buildTestChatMessages: vi.fn(() => [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'hello' }
    ]),
    getPreset: vi.fn(async () => ({
        settings: { temperature: 0.61, top_p: 0.92, max_tokens: 888 }
    })),
    getInstructSettings: vi.fn(() => ({
        settings: { temperature: 0.33, presence_penalty: 0.2, max_tokens: 333 }
    })),
    runTask: vi.fn(async (_messages, hooks?: { onDone?: (fullText: string) => void }) => {
        hooks?.onDone?.('测试回复');
    }),
    storageGet: vi.fn((key: string, defaultValue?: unknown) => {
        switch (key) {
            case 'lumina-forge.testChatPresets':
                return [];
            case 'lumina-forge.testChatActivePreset':
                return 'built-in:roleplay';
            case 'lumina-forge.nexusPreset':
                return 'forge-preset';
            case 'lumina-chat.nexusPreset':
                return 'chat-preset';
            case 'lumina-chat.unlimitedResponse':
                return false;
            default:
                return defaultValue;
        }
    })
}));

vi.mock('../../llmEngine', () => ({
    llmEngine: {
        resolveNodesFromPreset,
        createSession,
        cleanMessages
    }
}));

vi.mock('../../storage', () => ({
    lwStorage: {
        get: storageGet,
        set: vi.fn()
    }
}));

vi.mock('../ForgeTestChatPromptBuilder', () => ({
    buildTestChatMessages
}));

vi.mock('../LuminaGenerationTask', () => ({
    LuminaGenerationTask: vi.fn().mockImplementation(function MockLuminaGenerationTask(_session: unknown) {
        return {
            run: runTask,
            abort: vi.fn()
        };
    })
}));

vi.mock('../st-adapter/STClient', () => ({
    STClient: {
        getPreset,
        getInstructSettings
    }
}));

import { ForgeTestChatService } from '../ForgeTestChatService';

describe('ForgeTestChatService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveNodesFromPreset.mockReturnValue([{ id: 'node-1', provider: 'openai', model: 'gpt-test' }]);
        createSession.mockImplementation((options) => ({ options }));
        cleanMessages.mockImplementation((messages) => messages);
        buildTestChatMessages.mockReturnValue([
            { role: 'system', content: 'system prompt' },
            { role: 'user', content: 'hello' }
        ]);
        getPreset.mockResolvedValue({
            settings: { temperature: 0.61, top_p: 0.92, max_tokens: 888 }
        });
        getInstructSettings.mockReturnValue({
            settings: { temperature: 0.33, presence_penalty: 0.2, max_tokens: 333 }
        });
        runTask.mockImplementation(async (_messages, hooks?: { onDone?: (fullText: string) => void }) => {
            hooks?.onDone?.('测试回复');
        });
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => {
            switch (key) {
                case 'lumina-forge.testChatPresets':
                    return [];
                case 'lumina-forge.testChatActivePreset':
                    return 'built-in:roleplay';
                case 'lumina-forge.nexusPreset':
                    return 'forge-preset';
                case 'lumina-chat.nexusPreset':
                    return 'chat-preset';
                case 'lumina-chat.unlimitedResponse':
                    return false;
                default:
                    return defaultValue;
            }
        });
    });

    it('应自动继承主聊天当前预设的生成参数', async () => {
        const service = new ForgeTestChatService({
            getVirtualLorebookEntries: () => [],
            getNexusPresetId: () => 'forge-preset',
            getWorkspaceTitle: () => 'Forge Test'
        });

        await service.sendMessage('你好');

        expect(getPreset).toHaveBeenCalledWith('in_use');
        expect(runTask).toHaveBeenCalledTimes(1);
        const inheritedSettings = (runTask.mock.calls[0] as unknown[] | undefined)?.[2];
        expect(inheritedSettings).toEqual({
            temperature: 0.61,
            top_p: 0.92,
            max_tokens: 888
        });
    });

    it('在流式无限输出开启时应移除继承参数中的 max_tokens', async () => {
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => {
            switch (key) {
                case 'lumina-forge.testChatPresets':
                    return [];
                case 'lumina-forge.testChatActivePreset':
                    return 'built-in:roleplay';
                case 'lumina-forge.nexusPreset':
                    return 'forge-preset';
                case 'lumina-chat.nexusPreset':
                    return 'chat-preset';
                case 'lumina-chat.unlimitedResponse':
                    return true;
                default:
                    return defaultValue;
            }
        });

        const service = new ForgeTestChatService({
            getVirtualLorebookEntries: () => [],
            getNexusPresetId: () => 'forge-preset'
        });

        await service.sendMessage('继续');

        expect(runTask).toHaveBeenCalledTimes(1);
        const inheritedSettings = (runTask.mock.calls[0] as unknown[] | undefined)?.[2];
        expect(inheritedSettings).toEqual({
            temperature: 0.61,
            top_p: 0.92
        });
    });
});
