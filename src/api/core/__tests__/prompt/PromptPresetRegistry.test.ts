import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';

const { storageGet, storageSet } = vi.hoisted(() => ({
    storageGet: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
    storageSet: vi.fn()
}));

vi.mock('@/api/storage.js', () => ({
    lwStorage: {
        get: storageGet,
        set: storageSet
    }
}));

import { promptPresetRegistry } from '@/api/core/hal/prompt/PromptPresetRegistry.js';

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
        expect(duplicated?.forgeAgentResources?.contract.path).toBe('./AGENTS.md');
        expect(duplicated?.forgeAgentOrchestration?.steps.map(step => step.kind)).toEqual([
            'contract',
            'system',
            'mode_prompt',
            'ui_dsl',
            'reasoning_boundary',
            'skills',
            'capabilities',
            'memory_index',
            'context_files',
            'branch_messages'
        ]);

        promptPresetRegistry.setActivePreset('forge-main', duplicated!.id);
        expect(promptPresetRegistry.getActivePresetId('forge-main')).toBe(duplicated!.id);

        promptPresetRegistry.deletePreset('forge-main', duplicated!.id);
        expect(promptPresetRegistry.listPresets('forge-main').some(preset => preset.id === duplicated!.id)).toBe(false);
        expect(promptPresetRegistry.getActivePresetId('forge-main')).toBe('built-in:forge-main-default');

        promptPresetRegistry.restoreProfileDefault('forge-main');
        expect(promptPresetRegistry.getActivePresetId('forge-main')).toBe('built-in:forge-main-default');
    });

    it('不再注册参考提炼内置预设且不修改默认 bindings', () => {
        const mainPresets = promptPresetRegistry.listPresets('forge-main');
        const executorPresets = promptPresetRegistry.listPresets('forge-executor');
        const testChatPresets = promptPresetRegistry.listPresets('forge-test-chat');

        expect(mainPresets.some(preset => preset.id === 'built-in:forge-main-reference-extract')).toBe(false);
        expect(executorPresets.some(preset => preset.id === 'built-in:forge-executor-reference-extract')).toBe(false);
        expect(testChatPresets.some(preset => preset.id === 'built-in:forge-test-chat-reference-extract')).toBe(false);

        expect(promptPresetRegistry.getActivePresetId('forge-main')).toBe('built-in:forge-main-default');
        expect(promptPresetRegistry.getActivePresetId('forge-executor')).toBe('built-in:forge-executor-default');
        expect(promptPresetRegistry.getActivePresetId('forge-test-chat')).toBe('built-in:forge-test-chat-st-preset');
    });

    it('Forge 主预设应暴露 agent 资源包和提示词编排，而不是依赖 slot 列表', () => {
        const preset = promptPresetRegistry.getPreset('forge-main', 'built-in:forge-main-default');

        expect(preset?.forgeAgentResources).toEqual(expect.objectContaining({
            contract: expect.objectContaining({ path: './AGENTS.md' }),
            system: expect.objectContaining({ path: './.forge/agent/SYSTEM.md' }),
            modes: expect.objectContaining({
                planner: expect.objectContaining({ path: './.forge/agent/PLANNER.md' }),
                conversation: expect.objectContaining({ path: './.forge/agent/CONVERSATION.md' }),
                analyst: expect.objectContaining({ path: './.forge/agent/ANALYST.md' }),
                executor: expect.objectContaining({ path: './.forge/agent/EXECUTOR.md' })
            })
        }));
        expect(preset?.forgeAgentOrchestration?.steps.map(step => step.kind)).toEqual([
            'contract',
            'system',
            'mode_prompt',
            'ui_dsl',
            'reasoning_boundary',
            'skills',
            'capabilities',
            'memory_index',
            'context_files',
            'branch_messages'
        ]);
        expect(preset?.entries).toEqual([]);
        expect(preset?.forgeAgentResources?.skills).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'reference-needs-capture',
                title: '需求捕捉与支撑点识别',
                path: './agent/skills/reference-needs-capture/SKILL.md',
                loadPolicy: 'on_demand',
                content: expect.stringContaining('需求捕捉与支撑点识别')
            }),
            expect.objectContaining({
                name: 'reference-anti-cliche',
                title: '反八股与偏向强化',
                path: './agent/skills/reference-anti-cliche/SKILL.md',
                loadPolicy: 'on_demand',
                content: expect.stringContaining('反八股与偏向强化')
            }),
            expect.objectContaining({
                name: 'reference-xp-capture',
                title: 'XP 捕捉附加条目',
                path: './agent/skills/reference-xp-capture/SKILL.md',
                loadPolicy: 'on_demand',
                content: expect.stringContaining('XP 捕捉附加条目')
            })
        ]));
    });

    it('复制已移除的参考提炼内置预设时返回 null', () => {
        const duplicated = promptPresetRegistry.duplicatePreset('forge-main', 'built-in:forge-main-reference-extract');

        expect(duplicated).toBeNull();
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

    it('旧绑定指向已移除参考提炼预设时应回落到默认预设', () => {
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => {
            switch (key) {
                case 'lumina-prompt-presets.registry':
                    return [];
                case 'lumina-prompt-presets.bindings':
                    return {
                        'forge-main': 'built-in:forge-main-reference-extract',
                        'forge-executor': 'built-in:forge-executor-reference-extract',
                        'forge-test-chat': 'built-in:forge-test-chat-reference-extract'
                    };
                default:
                    return defaultValue;
            }
        });

        promptPresetRegistry.listPresets('forge-main');

        expect(promptPresetRegistry.getActivePresetId('forge-main')).toBe('built-in:forge-main-default');
        expect(promptPresetRegistry.getActivePresetId('forge-executor')).toBe('built-in:forge-executor-default');
        expect(promptPresetRegistry.getActivePresetId('forge-test-chat')).toBe('built-in:forge-test-chat-st-preset');
        expect(storageSet).toHaveBeenCalledWith(
            'lumina-prompt-presets.bindings',
            {
                'forge-main': 'built-in:forge-main-default',
                'forge-executor': 'built-in:forge-executor-default',
                'forge-test-chat': 'built-in:forge-test-chat-st-preset'
            },
            'Global'
        );
    });

    it('测试聊天参考提炼预设已移除', () => {
        const preset = promptPresetRegistry.getPreset('forge-test-chat', 'built-in:forge-test-chat-reference-extract');

        expect(preset).toBeNull();
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

        promptPresetRegistry.listPresets('forge-main');

        expect(storageSet).toHaveBeenCalledWith(
            'lumina-prompt-presets.builtin-overrides',
            {},
            'Global'
        );
    });

    it('移除参考提炼预设后不再支持内置条目启停覆写', () => {
        const updated = promptPresetRegistry.setBuiltInEntryEnabled(
            'forge-main',
            'built-in:forge-main-reference-extract',
            'custom:xp_capture',
            true
        );

        expect(updated).toBeNull();
    });
});
