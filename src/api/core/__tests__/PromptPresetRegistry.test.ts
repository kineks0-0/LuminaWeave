import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from './halMock.js';

const { storageGet, storageSet } = vi.hoisted(() => ({
    storageGet: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
    storageSet: vi.fn()
}));

vi.mock('../../storage.js', () => ({
    lwStorage: {
        get: storageGet,
        set: storageSet
    }
}));

import { promptPresetRegistry } from '../hal/prompt/PromptPresetRegistry.js';

describe('PromptPresetRegistry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initMockHAL();
        promptPresetRegistry.resetForTests();
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => defaultValue);
    });

    it('应将旧测试聊天预设迁移到新 registry/bindings', () => {
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => {
            switch (key) {
                case 'lumina-prompt-presets.registry':
                    return [];
                case 'lumina-prompt-presets.bindings':
                    return null;
                case 'lumina-forge.testChatPresets':
                    return [{
                        id: 'user:legacy',
                        name: '旧测试聊天',
                        promptMode: 'custom',
                        charCardMode: 'custom',
                        customCharCard: { name: '角色A', description: 'desc' },
                        promptEntries: [
                            { type: 'slot', slot: 'char_description', enabled: true },
                            { type: 'custom', id: 'custom-1', enabled: true, prompt: { role: 'system', content: '额外约束' } }
                        ],
                        createdAt: 1,
                        updatedAt: 2
                    }];
                case 'lumina-forge.testChatActivePreset':
                    return 'user:legacy';
                default:
                    return defaultValue;
            }
        });

        const presets = promptPresetRegistry.listPresets('forge-test-chat');
        const migrated = presets.find(preset => preset.id === 'user:legacy');

        expect(migrated?.charCardMode).toBe('custom');
        expect(migrated?.customCharCard?.name).toBe('角色A');
        expect(migrated?.generationSettings).toEqual({});
        expect(promptPresetRegistry.getActivePresetId('forge-test-chat')).toBe('user:legacy');
        expect(storageSet).toHaveBeenCalled();
    });

    it('应支持复制预设、切换绑定、删除副本并恢复默认绑定', () => {
        const duplicated = promptPresetRegistry.duplicatePreset('forge-main', 'built-in:forge-main-default');

        expect(duplicated).not.toBeNull();
        expect(duplicated?.builtIn).toBe(false);
        expect(duplicated?.name).toContain('副本');

        promptPresetRegistry.setActivePreset('forge-main', duplicated!.id);
        expect(promptPresetRegistry.getActivePresetId('forge-main')).toBe(duplicated!.id);

        promptPresetRegistry.deletePreset('forge-main', duplicated!.id);
        expect(promptPresetRegistry.listPresets('forge-main').some(preset => preset.id === duplicated!.id)).toBe(false);
        expect(promptPresetRegistry.getActivePresetId('forge-main')).toBe('built-in:forge-main-default');

        promptPresetRegistry.restoreProfileDefault('forge-main');
        expect(promptPresetRegistry.getActivePresetId('forge-main')).toBe('built-in:forge-main-default');
    });

    it('应列出参考提炼内置预设且不修改默认 bindings', () => {
        const mainPresets = promptPresetRegistry.listPresets('forge-main');
        const executorPresets = promptPresetRegistry.listPresets('forge-executor');
        const testChatPresets = promptPresetRegistry.listPresets('forge-test-chat');

        expect(mainPresets.some(preset => preset.id === 'built-in:forge-main-reference-extract')).toBe(true);
        expect(executorPresets.some(preset => preset.id === 'built-in:forge-executor-reference-extract')).toBe(true);
        expect(testChatPresets.some(preset => preset.id === 'built-in:forge-test-chat-reference-extract')).toBe(true);

        expect(promptPresetRegistry.getActivePresetId('forge-main')).toBe('built-in:forge-main-default');
        expect(promptPresetRegistry.getActivePresetId('forge-executor')).toBe('built-in:forge-executor-default');
        expect(promptPresetRegistry.getActivePresetId('forge-test-chat')).toBe('built-in:forge-test-chat-st-preset');
    });

    it('复制参考提炼内置预设后，应保留默认启用与关闭状态', () => {
        const duplicated = promptPresetRegistry.duplicatePreset('forge-main', 'built-in:forge-main-reference-extract');

        expect(duplicated).not.toBeNull();
        expect(duplicated?.builtIn).toBe(false);
        expect(duplicated?.entries.find(entry => entry.id === 'custom:needs_capture')?.enabled).toBe(true);
        expect(duplicated?.entries.find(entry => entry.id === 'custom:anti_cliche')?.enabled).toBe(true);
        expect(duplicated?.entries.find(entry => entry.id === 'custom:xp_capture')?.enabled).toBe(false);
        expect(duplicated?.generationSettings).toEqual({});
    });

    it('应持久化并归一化预设生成参数', () => {
        const created = promptPresetRegistry.createPreset('forge-main', {
            name: '带参数预设',
            generationSettings: {
                temperature: 0.55,
                top_p: 0.88,
                top_k: 48,
                seed: -1 as unknown as number
            }
        });

        expect(created.generationSettings).toEqual({
            temperature: 0.55,
            top_p: 0.88,
            top_k: 48
        });

        const updated = promptPresetRegistry.updatePreset('forge-main', created.id, {
            generationSettings: {
                temperature: 0.72,
                max_tokens: 640
            }
        });

        expect(updated?.generationSettings).toEqual({
            temperature: 0.72,
            max_tokens: 640
        });
    });

    it('在 bindings 已合法时，初始化不应重复持久化 bindings', () => {
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => {
            switch (key) {
                case 'lumina-prompt-presets.registry':
                    return [];
                case 'lumina-prompt-presets.bindings':
                    return {
                        'forge-main': 'built-in:forge-main-default',
                        'forge-executor': 'built-in:forge-executor-default',
                        'forge-test-chat': 'built-in:forge-test-chat-st-preset'
                    };
                default:
                    return defaultValue;
            }
        });

        promptPresetRegistry.listPresets('forge-main');

        expect(storageSet).not.toHaveBeenCalled();
    });

    it('测试聊天参考提炼预设应保持 composed engine 和 from_st 角色卡模式', () => {
        const preset = promptPresetRegistry.getPreset('forge-test-chat', 'built-in:forge-test-chat-reference-extract');

        expect(preset?.engine).toBe('composed');
        expect(preset?.charCardMode).toBe('from_st');
        expect(preset?.entries.find(entry => entry.id === 'custom:test_chat_behavior')?.enabled).toBe(true);
        expect(preset?.entries.find(entry => entry.id === 'custom:test_chat_dialogue')?.enabled).toBe(true);
        expect(preset?.entries.find(entry => entry.id === 'custom:test_chat_xp')?.enabled).toBe(false);
    });

    it('应加载内置预设条目覆写，并清理不存在或冗余的覆写项', () => {
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => {
            switch (key) {
                case 'lumina-prompt-presets.registry':
                    return [];
                case 'lumina-prompt-presets.bindings':
                    return null;
                case 'lumina-prompt-presets.builtin-overrides':
                    return {
                        'built-in:forge-main-reference-extract': {
                            'custom:xp_capture': true,
                            'custom:anti_cliche': true,
                            'custom:missing': false
                        },
                        'built-in:missing-preset': {
                            ghost: true
                        }
                    };
                default:
                    return defaultValue;
            }
        });

        const preset = promptPresetRegistry.getPreset('forge-main', 'built-in:forge-main-reference-extract');

        expect(preset?.entries.find(entry => entry.id === 'custom:xp_capture')?.enabled).toBe(true);
        expect(preset?.entries.find(entry => entry.id === 'custom:anti_cliche')?.enabled).toBe(true);
        expect(storageSet).toHaveBeenCalledWith(
            'lumina-prompt-presets.builtin-overrides',
            {
                'built-in:forge-main-reference-extract': {
                    'custom:xp_capture': true
                }
            },
            'Global'
        );
    });

    it('应支持更新内置预设条目启停状态且不影响其它预设', () => {
        const updated = promptPresetRegistry.setBuiltInEntryEnabled(
            'forge-main',
            'built-in:forge-main-reference-extract',
            'custom:xp_capture',
            true
        );

        expect(updated?.entries.find(entry => entry.id === 'custom:xp_capture')?.enabled).toBe(true);
        expect(promptPresetRegistry.getPreset('forge-main', 'built-in:forge-main-reference-extract')?.entries.find(entry => entry.id === 'custom:xp_capture')?.enabled).toBe(true);
        expect(promptPresetRegistry.getPreset('forge-test-chat', 'built-in:forge-test-chat-reference-extract')?.entries.find(entry => entry.id === 'custom:test_chat_xp')?.enabled).toBe(false);
        expect(storageSet).toHaveBeenCalledWith(
            'lumina-prompt-presets.builtin-overrides',
            {
                'built-in:forge-main-reference-extract': {
                    'custom:xp_capture': true
                }
            },
            'Global'
        );
    });
});
