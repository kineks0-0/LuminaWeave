import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    resolveNodesFromPreset,
    createSession,
    cleanMessages,
    composePromptPreset,
    buildSTPresetMessages,
    getPreset,
    getInstructSettings,
    runTask,
    storageGet,
    storageOn,
    storageOff,
    registryReload,
    registryListPresets,
    registryGetActivePresetId,
    registryGetActivePreset
} = vi.hoisted(() => ({
    resolveNodesFromPreset: vi.fn(() => [{ id: 'node-1', provider: 'openai', model: 'gpt-test' }]),
    createSession: vi.fn((options) => ({ options })),
    cleanMessages: vi.fn((messages) => messages),
    composePromptPreset: vi.fn(() => ({
        messages: [
            { role: 'system', content: 'preset system prompt' },
            { role: 'user', content: 'hello' }
        ],
        resolvedEntries: []
    })),
    buildSTPresetMessages: vi.fn(() => [
        { role: 'system', content: 'st preset system prompt' },
        { role: 'user', content: 'hello' }
    ]),
    getPreset: vi.fn(async () => ({
        prompts: [{ id: 'main', enabled: true, role: 'system', content: 'ST preset' }],
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
            case 'lumina-forge.nexusPreset':
                return 'forge-preset';
            case 'lumina-chat.nexusPreset':
                return 'chat-preset';
            case 'lumina-chat.unlimitedResponse':
                return false;
            default:
                return defaultValue;
        }
    }),
    storageOn: vi.fn(),
    storageOff: vi.fn(),
    registryReload: vi.fn(),
    registryListPresets: vi.fn(() => []),
    registryGetActivePresetId: vi.fn(() => 'built-in:forge-test-chat-roleplay'),
    registryGetActivePreset: vi.fn(() => ({
        id: 'built-in:forge-test-chat-roleplay',
        name: '角色扮演',
        profileId: 'forge-test-chat',
        builtIn: true,
        engine: 'composed',
        charCardMode: 'from_st',
        entries: [],
        specials: {},
        generationSettings: {},
        createdAt: 1,
        updatedAt: 1
    }))
}));

vi.mock('../../llmEngine.js', () => ({
    llmEngine: {
        resolveNodesFromPreset,
        createSession,
        cleanMessages
    }
}));

vi.mock('../../storage.js', () => ({
    lwStorage: {
        get: storageGet,
        set: vi.fn(),
        on: storageOn,
        off: storageOff
    }
}));

vi.mock('../hal/prompt/PromptPresetComposer.js', () => ({
    PromptPresetComposer: {
        compose: composePromptPreset
    }
}));

vi.mock('../hal/prompt/PromptPresetRegistry.js', () => ({
    promptPresetRegistry: {
        reload: registryReload,
        listPresets: registryListPresets,
        getActivePresetId: registryGetActivePresetId,
        getActivePreset: registryGetActivePreset,
        setActivePreset: vi.fn()
    }
}));

vi.mock('../forge/ForgeTestChatPromptBuilder.js', () => ({
    buildSTPresetMessages
}));

vi.mock('../generation/LuminaGenerationTask.js', () => ({
    LuminaGenerationTask: vi.fn().mockImplementation(function MockLuminaGenerationTask(_session: unknown) {
        return {
            run: runTask,
            abort: vi.fn()
        };
    })
}));

import { ForgeTestChatService } from '../forge/ForgeTestChatService.js';
import { configureForgeTestChatHostPort } from '../forge/ForgeTestChatHostPort.js';

describe('ForgeTestChatService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        configureForgeTestChatHostPort({
            createPromptContext: () => ({
                substituteMacros: (text: string) => text,
                snapshotVariables: () => ({}),
                restoreVariables: vi.fn()
            }),
            resolveCurrentCharCard: () => ({
                name: '测试角色',
                description: '角色描述',
                personality: '角色性格',
                scenario: '角色场景',
                systemPrompt: '角色系统提示词'
            }),
            getPreset,
            getInstructSettings
        });
        resolveNodesFromPreset.mockReturnValue([{ id: 'node-1', provider: 'openai', model: 'gpt-test' }]);
        createSession.mockImplementation((options) => ({ options }));
        cleanMessages.mockImplementation((messages) => messages);
        composePromptPreset.mockReturnValue({
            messages: [
                { role: 'system', content: 'preset system prompt' },
                { role: 'user', content: 'hello' }
            ],
            resolvedEntries: []
        });
        buildSTPresetMessages.mockReturnValue([
            { role: 'system', content: 'st preset system prompt' },
            { role: 'user', content: 'hello' }
        ]);
        getPreset.mockResolvedValue({
            prompts: [{ id: 'main', enabled: true, role: 'system', content: 'ST preset' }],
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
        registryListPresets.mockReturnValue([]);
        registryGetActivePresetId.mockReturnValue('built-in:forge-test-chat-roleplay');
        registryGetActivePreset.mockReturnValue({
            id: 'built-in:forge-test-chat-roleplay',
            name: '角色扮演',
            profileId: 'forge-test-chat',
            builtIn: true,
            engine: 'composed',
            charCardMode: 'from_st',
            entries: [],
            specials: {},
            generationSettings: {},
            createdAt: 1,
            updatedAt: 1
        });
    });

    it('应在 composed 预设下走统一 composer，并继承主聊天当前预设的生成参数', async () => {
        const service = new ForgeTestChatService({
            getVirtualLorebookEntries: () => [],
            getNexusPresetId: () => 'forge-preset',
            getWorkspaceTitle: () => 'Forge Test',
            getWorkspaceSessionId: () => 'forge_ws_test',
            createModelRequestTrace: vi.fn(),
            markModelRequestFirstResponse: vi.fn(),
            updateModelRequestStream: vi.fn(),
            completeModelRequestTrace: vi.fn(),
            failModelRequestTrace: vi.fn(),
            abortModelRequestTrace: vi.fn(),
            setActiveModelRequestTrace: vi.fn()
        });

        await service.sendMessage('你好');

        expect(storageOn).toHaveBeenCalledWith('*', expect.any(Function));
        expect(composePromptPreset).toHaveBeenCalledWith(
            'forge-test-chat',
            'built-in:forge-test-chat-roleplay',
            expect.objectContaining({
                lorebookEntries: [],
                charCard: expect.objectContaining({
                    name: '测试角色',
                    description: '角色描述'
                }),
                conversationHistory: [{ role: 'user', content: '你好' }]
            })
        );
        expect(buildSTPresetMessages).not.toHaveBeenCalled();
        expect(getPreset).toHaveBeenCalledWith('in_use');
        expect(runTask).toHaveBeenCalledTimes(1);
        const inheritedSettings = (runTask.mock.calls[0] as unknown[] | undefined)?.[2];
        expect(inheritedSettings).toEqual({
            temperature: 0.61,
            top_p: 0.92,
            max_tokens: 888
        });
    });

    it('应在 st_preset 预设下继续走 ST 兼容链路', async () => {
        registryGetActivePresetId.mockReturnValue('built-in:forge-test-chat-st-preset');
        registryGetActivePreset.mockReturnValue({
            id: 'built-in:forge-test-chat-st-preset',
            name: 'ST 预设',
            profileId: 'forge-test-chat',
            builtIn: true,
            engine: 'st_preset',
            charCardMode: 'from_st',
            entries: [],
            specials: {},
            generationSettings: { temperature: 0.74 },
            createdAt: 1,
            updatedAt: 1
        });

        const service = new ForgeTestChatService({
            getVirtualLorebookEntries: () => [],
            getNexusPresetId: () => 'forge-preset',
            getWorkspaceSessionId: () => 'forge_ws_test',
            createModelRequestTrace: vi.fn(),
            markModelRequestFirstResponse: vi.fn(),
            updateModelRequestStream: vi.fn(),
            completeModelRequestTrace: vi.fn(),
            failModelRequestTrace: vi.fn(),
            abortModelRequestTrace: vi.fn(),
            setActiveModelRequestTrace: vi.fn()
        });

        await service.sendMessage('继续');

        expect(buildSTPresetMessages).toHaveBeenCalledWith(
            expect.objectContaining({
                stPreset: expect.objectContaining({
                    prompts: expect.any(Array)
                }),
                conversationHistory: [{ role: 'user', content: '继续' }]
            })
        );
        expect(composePromptPreset).not.toHaveBeenCalled();
        expect(runTask).toHaveBeenCalledTimes(1);
    });

    it('在流式无限输出开启时应移除继承参数中的 max_tokens', async () => {
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => {
            switch (key) {
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
            getNexusPresetId: () => 'forge-preset',
            getWorkspaceSessionId: () => 'forge_ws_test',
            createModelRequestTrace: vi.fn(),
            markModelRequestFirstResponse: vi.fn(),
            updateModelRequestStream: vi.fn(),
            completeModelRequestTrace: vi.fn(),
            failModelRequestTrace: vi.fn(),
            abortModelRequestTrace: vi.fn(),
            setActiveModelRequestTrace: vi.fn()
        });

        await service.sendMessage('继续');

        expect(runTask).toHaveBeenCalledTimes(1);
        const inheritedSettings = (runTask.mock.calls[0] as unknown[] | undefined)?.[2];
        expect(inheritedSettings).toEqual({
            temperature: 0.61,
            top_p: 0.92
        });
    });

    it('应将预设生成参数叠加到测试聊天请求，并写入 trace', async () => {
        registryGetActivePresetId.mockReturnValue('user:forge-test-chat:1');
        registryGetActivePreset.mockReturnValue({
            id: 'user:forge-test-chat:1',
            name: '自定义参数预设',
            profileId: 'forge-test-chat',
            builtIn: false,
            engine: 'composed',
            charCardMode: 'from_st',
            entries: [],
            specials: {},
            generationSettings: {
                temperature: 0.8,
                top_p: 0.97,
                top_k: 24,
                seed: 42
            },
            createdAt: 1,
            updatedAt: 1
        });

        const createModelRequestTrace = vi.fn();

        const service = new ForgeTestChatService({
            getVirtualLorebookEntries: () => [],
            getNexusPresetId: () => 'forge-preset',
            getWorkspaceTitle: () => 'Forge Test',
            getWorkspaceSessionId: () => 'forge_ws_test',
            createModelRequestTrace,
            markModelRequestFirstResponse: vi.fn(),
            updateModelRequestStream: vi.fn(),
            completeModelRequestTrace: vi.fn(),
            failModelRequestTrace: vi.fn(),
            abortModelRequestTrace: vi.fn(),
            setActiveModelRequestTrace: vi.fn()
        });

        await service.sendMessage('参数测试');

        const mergedSettings = (runTask.mock.calls[0] as unknown[] | undefined)?.[2];
        expect(mergedSettings).toEqual({
            temperature: 0.8,
            top_p: 0.97,
            top_k: 24,
            max_tokens: 888,
            seed: 42
        });
        expect(createModelRequestTrace).toHaveBeenCalledWith(expect.objectContaining({
            requestParameters: {
                temperature: 0.8,
                top_p: 0.97,
                top_k: 24,
                max_tokens: 888,
                seed: 42
            }
        }));
    });

    it('writes test chat request traces through the shared transient trace callbacks', async () => {
        runTask.mockImplementationOnce(async (_messages, hooks?: {
            onChunk?: (chunk: string, fullText: string) => void;
            onDone?: (fullText: string) => void;
        }) => {
            hooks?.onChunk?.('测', '测试');
            hooks?.onDone?.('测试回复');
        });

        const createModelRequestTrace = vi.fn();
        const markModelRequestFirstResponse = vi.fn();
        const updateModelRequestStream = vi.fn();
        const completeModelRequestTrace = vi.fn();

        const service = new ForgeTestChatService({
            getVirtualLorebookEntries: () => [],
            getNexusPresetId: () => 'forge-preset',
            getWorkspaceTitle: () => 'Forge Test',
            getWorkspaceSessionId: () => 'forge_ws_test',
            createModelRequestTrace,
            markModelRequestFirstResponse,
            updateModelRequestStream,
            completeModelRequestTrace,
            failModelRequestTrace: vi.fn(),
            abortModelRequestTrace: vi.fn(),
            setActiveModelRequestTrace: vi.fn()
        });

        await service.sendMessage('trace');

        expect(createModelRequestTrace).toHaveBeenCalledTimes(1);
        expect(createModelRequestTrace).toHaveBeenCalledWith(expect.objectContaining({
            requestParameters: {
                temperature: 0.61,
                top_p: 0.92,
                max_tokens: 888
            }
        }));
        expect(markModelRequestFirstResponse).toHaveBeenCalledTimes(1);
        expect(updateModelRequestStream).toHaveBeenCalledWith(expect.objectContaining({
            responseRaw: '测试'
        }));
        expect(completeModelRequestTrace).toHaveBeenCalledWith(expect.objectContaining({
            responseDisplay: '测试回复'
        }));
    });
});
