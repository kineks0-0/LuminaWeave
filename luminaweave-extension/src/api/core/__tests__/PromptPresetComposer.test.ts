import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storageGet, storageSet } = vi.hoisted(() => ({
    storageGet: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
    storageSet: vi.fn()
}));

vi.mock('../../storage', () => ({
    lwStorage: {
        get: storageGet,
        set: storageSet
    }
}));

import { PromptPresetComposer } from '../PromptPresetComposer';
import { promptPresetRegistry } from '../PromptPresetRegistry';
import type { PromptPresetDefinition } from '../../../types/PromptPresetTypes';

describe('PromptPresetComposer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        promptPresetRegistry.resetForTests();
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => defaultValue);
    });

    it('应按条目顺序和启用状态输出最终消息', () => {
        const preset: PromptPresetDefinition = {
            id: 'test-chat-preset',
            name: '测试聊天',
            profileId: 'forge-test-chat',
            engine: 'composed',
            entries: [
                { id: 'slot:desc', type: 'slot', slotId: 'char_description', enabled: true },
                { id: 'custom:1', type: 'custom', enabled: true, role: 'user', content: '额外用户约束' },
                { id: 'slot:history', type: 'slot', slotId: 'chat_history', enabled: false }
            ],
            specials: {},
            generationSettings: {},
            createdAt: 1,
            updatedAt: 1
        };

        const result = PromptPresetComposer.compose('forge-test-chat', preset, {
            charCard: { description: '角色描述' },
            conversationHistory: [{ role: 'assistant', content: '不会输出' }]
        });

        expect(result.messages).toEqual([
            { role: 'system', content: '角色描述' },
            { role: 'user', content: '额外用户约束' }
        ]);
        expect(result.resolvedEntries.map(entry => entry.id)).toEqual(['slot:desc', 'custom:1']);
    });

    it('应在 slot 与 profile 不兼容时拒绝构建', () => {
        const preset: PromptPresetDefinition = {
            id: 'invalid-preset',
            name: 'invalid',
            profileId: 'forge-test-chat',
            engine: 'composed',
            entries: [
                { id: 'slot:memory', type: 'slot', slotId: 'memory_snapshot', enabled: true }
            ],
            specials: {},
            generationSettings: {},
            createdAt: 1,
            updatedAt: 1
        };

        expect(() => PromptPresetComposer.compose('forge-test-chat', preset, {})).toThrow('not compatible');
    });

    it('应对内置预设覆写后的 disabled 条目跳过消息生成', () => {
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => {
            switch (key) {
                case 'lumina-prompt-presets.registry':
                    return [];
                case 'lumina-prompt-presets.bindings':
                    return null;
                case 'lumina-prompt-presets.builtin-overrides':
                    return {
                        'built-in:forge-test-chat-roleplay': {
                            'slot:char_description': false
                        }
                    };
                default:
                    return defaultValue;
            }
        });

        const result = PromptPresetComposer.compose('forge-test-chat', 'built-in:forge-test-chat-roleplay', {
            charCard: {
                systemPrompt: '系统设定',
                description: '角色描述',
                personality: '角色性格',
                scenario: '场景设定'
            }
        });

        expect(result.messages).toEqual([
            { role: 'system', content: '系统设定' },
            { role: 'system', content: '角色性格' },
            { role: 'system', content: '场景设定' }
        ]);
        expect(result.resolvedEntries.map(entry => entry.id)).toEqual([
            'slot:char_system_prompt',
            'slot:char_personality',
            'slot:scenario'
        ]);
    });
});
