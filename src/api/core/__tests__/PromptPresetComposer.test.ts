import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { PromptPresetComposer } from '../hal/prompt/PromptPresetComposer.js';
import { promptPresetRegistry } from '../hal/prompt/PromptPresetRegistry.js';
import type {
    PromptPresetDefinition,
    PromptWorldbookActivatedEntry,
    PromptWorldbookInsertionPosition
} from '../../../types/PromptPresetTypes.js';

const createWorldbookEntry = (
    position: PromptWorldbookInsertionPosition,
    label: string,
    order = 0
): PromptWorldbookActivatedEntry => ({
    uid: `${position}-${label}`,
    comment: `${position} ${label}`,
    content: `${position} content`,
    role: 'system',
    depth: 0,
    order,
    resourceRef: {
        sourceId: 'local',
        resourceType: 'worldbook',
        resourceId: `${position}-book`,
        path: `/sources/local/worldbooks/${position}-book`,
        writable: true
    },
    sourceId: 'local',
    resourceId: `${position}-book`,
    sourcePath: `/sources/local/worldbooks/${position}-book`,
    insertion: {
        position,
        role: 'system'
    }
});

const emptyWorldbookBuckets = () => ({
    before: [] as PromptWorldbookActivatedEntry[],
    after: [] as PromptWorldbookActivatedEntry[],
    an_top: [] as PromptWorldbookActivatedEntry[],
    an_bottom: [] as PromptWorldbookActivatedEntry[],
    em_top: [] as PromptWorldbookActivatedEntry[],
    em_bottom: [] as PromptWorldbookActivatedEntry[],
    at_depth: [] as PromptWorldbookActivatedEntry[],
    outlet: [] as PromptWorldbookActivatedEntry[]
});

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

    it('应输出可追踪的 Prompt source trace，并在合并 system 后保留 offset', () => {
        const preset: PromptPresetDefinition = {
            id: 'trace-preset',
            name: 'Trace',
            profileId: 'forge-test-chat',
            engine: 'composed',
            entries: [
                { id: 'slot:system', type: 'slot', slotId: 'char_system_prompt', enabled: true },
                { id: 'slot:desc', type: 'slot', slotId: 'char_description', enabled: true },
                { id: 'slot:history', type: 'slot', slotId: 'chat_history', enabled: true }
            ],
            specials: {},
            generationSettings: {},
            createdAt: 1,
            updatedAt: 1
        };

        const result = PromptPresetComposer.composeWithTrace('forge-test-chat', preset, {
            charCard: {
                systemPrompt: '系统设定',
                description: '角色描述'
            },
            conversationHistory: [{ role: 'user', content: '你好' }],
            resourceRefs: [{
                sourceId: 'local',
                resourceType: 'character',
                resourceId: 'char-a',
                path: '/sources/local/characters/char-a',
                writable: true
            }]
        }, { mergeLeadingSystemMessages: true });

        expect(result.messages).toEqual([
            { role: 'system', content: '系统设定\n\n角色描述' },
            { role: 'user', content: '你好' }
        ]);
        expect(result.trace).toHaveLength(3);
        expect(result.trace[0]).toMatchObject({
            sourceKind: 'character',
            kind: 'information',
            outputMessageIndex: 0,
            outputStart: 0,
            outputEnd: 4
        });
        expect(result.trace[1]).toMatchObject({
            sourceKind: 'character',
            outputMessageIndex: 0,
            outputStart: 6,
            outputEnd: 10
        });
        expect(result.trace[1].transforms.some(transform => transform.type === 'merge' && transform.lossy === false)).toBe(true);
        expect(result.trace[2]).toMatchObject({
            sourceKind: 'history',
            outputMessageIndex: 1,
            outputStart: 0,
            outputEnd: 2
        });
        expect(result.trace[0].resourceRef?.path).toBe('/sources/local/characters/char-a');
    });

    it('应按 worldbook activation 的 at_depth 插入历史，并保留世界书来源 trace', () => {
        const worldbookRef = {
            sourceId: 'local',
            resourceType: 'worldbook' as const,
            resourceId: 'depth-book',
            path: '/sources/local/worldbooks/depth-book',
            writable: true
        };
        const preset: PromptPresetDefinition = {
            id: 'worldbook-depth-preset',
            name: 'Worldbook Depth',
            profileId: 'forge-test-chat',
            engine: 'composed',
            entries: [
                { id: 'slot:history', type: 'slot', slotId: 'chat_history', enabled: true }
            ],
            specials: {},
            generationSettings: {},
            createdAt: 1,
            updatedAt: 1
        };

        const result = PromptPresetComposer.composeWithTrace('forge-test-chat', preset, {
            conversationHistory: [
                { role: 'user', content: 'old' },
                { role: 'assistant', content: 'recent' }
            ],
            worldbookActivation: {
                entries: [{
                    uid: 'depth-entry',
                    comment: 'Depth Entry',
                    content: 'Inserted world info.',
                    role: 'system',
                    depth: 1,
                    order: 0,
                    resourceRef: worldbookRef,
                    sourceId: 'local',
                    resourceId: 'depth-book',
                    sourcePath: '/sources/local/worldbooks/depth-book',
                    insertion: {
                        position: 'at_depth',
                        depth: 1,
                        role: 'system'
                    }
                }],
                insertionBuckets: {
                    ...emptyWorldbookBuckets(),
                    at_depth: [{
                        uid: 'depth-entry',
                        comment: 'Depth Entry',
                        content: 'Inserted world info.',
                        role: 'system',
                        depth: 1,
                        order: 0,
                        resourceRef: worldbookRef,
                        sourceId: 'local',
                        resourceId: 'depth-book',
                        sourcePath: '/sources/local/worldbooks/depth-book',
                        insertion: {
                            position: 'at_depth',
                            depth: 1,
                            role: 'system'
                        }
                    }]
                },
                trace: [],
                diagnostics: []
            }
        }, { mergeLeadingSystemMessages: false });

        expect(result.messages).toEqual([
            { role: 'user', content: 'old' },
            { role: 'system', content: '[World Info: depth-entry]\nInserted world info.' },
            { role: 'assistant', content: 'recent' }
        ]);
        expect(result.trace[1]).toMatchObject({
            sourceKind: 'worldbook',
            resourceRef: worldbookRef,
            sourcePath: '/sources/local/worldbooks/depth-book',
            label: '世界书: Depth Entry',
            outputMessageIndex: 1
        });
    });

    it('应按 worldbook placement buckets 注入 before/after/an/em/outlet 虚拟消息并保留来源 trace', () => {
        const before = createWorldbookEntry('before', 'entry');
        const after = createWorldbookEntry('after', 'entry');
        const anTop = createWorldbookEntry('an_top', 'entry');
        const anBottom = createWorldbookEntry('an_bottom', 'entry');
        const emTop = createWorldbookEntry('em_top', 'entry');
        const emBottom = createWorldbookEntry('em_bottom', 'entry');
        const outlet = createWorldbookEntry('outlet', 'entry');
        const preset: PromptPresetDefinition = {
            id: 'worldbook-placement-preset',
            name: 'Worldbook Placement',
            profileId: 'forge-test-chat',
            engine: 'composed',
            entries: [
                { id: 'slot:desc', type: 'slot', slotId: 'char_description', enabled: true },
                { id: 'slot:world', type: 'slot', slotId: 'world_info', enabled: true },
                { id: 'slot:history', type: 'slot', slotId: 'chat_history', enabled: true }
            ],
            specials: {},
            generationSettings: {},
            createdAt: 1,
            updatedAt: 1
        };

        const result = PromptPresetComposer.composeWithTrace('forge-test-chat', preset, {
            charCard: { description: '角色描述' },
            conversationHistory: [{ role: 'user', content: 'history' }],
            worldbookActivation: {
                entries: [before, after, anTop, anBottom, emTop, emBottom, outlet],
                insertionBuckets: {
                    ...emptyWorldbookBuckets(),
                    before: [before],
                    after: [after],
                    an_top: [anTop],
                    an_bottom: [anBottom],
                    em_top: [emTop],
                    em_bottom: [emBottom],
                    outlet: [outlet]
                },
                trace: [],
                diagnostics: []
            }
        }, { mergeLeadingSystemMessages: false });

        expect(result.messages.map(message => message.content)).toEqual([
            '[World Info: before-entry]\nbefore content',
            '角色描述',
            '[World Info: after-entry]\nafter content',
            '[World Info: an_top-entry]\nan_top content',
            '[World Info: em_top-entry]\nem_top content',
            '[World Info: outlet-entry]\noutlet content',
            'history',
            '[World Info: an_bottom-entry]\nan_bottom content',
            '[World Info: em_bottom-entry]\nem_bottom content'
        ]);
        const worldbookTraces = result.trace.filter(trace => trace.sourceKind === 'worldbook');
        expect(worldbookTraces).toHaveLength(7);
        expect(worldbookTraces.map(trace => trace.resourceRef?.resourceId)).toEqual([
            'before-book',
            'after-book',
            'an_top-book',
            'em_top-book',
            'outlet-book',
            'an_bottom-book',
            'em_bottom-book'
        ]);
    });
});
