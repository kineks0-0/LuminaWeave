import { describe, it, expect } from 'vitest';
import { buildRoleplayPrompt } from '@/api/core/hal/prompt/RoleplayPromptPipeline.js';
import { StagedMacroVariables } from '@/api/core/hal/prompt/macros/StagedMacroVariables.js';
import {
    DEFAULT_CHAT_COMPLETION_BEHAVIOR,
    DEFAULT_CHAT_COMPLETION_SAMPLING,
    ST_DEFAULT_CHARACTER_ID,
    type ChatCompletionPreset,
    type ChatCompletionPresetEntry,
    type ChatCompletionPresetOrderEntry
} from '@/types/ChatCompletionPresetTypes.js';
import type {
    PromptWorldbookActivatedEntry,
    PromptWorldbookActivationSnapshot,
    PromptWorldbookInsertionPosition
} from '@/types/PromptPresetTypes.js';
import type { CleanedMessage } from '@/types/nexus.js';
import type { ChatCharacterFields } from '@/api/core/hal/prompt/CharacterFields.js';

const entry = (identifier: string, overrides: Partial<ChatCompletionPresetEntry> = {}): ChatCompletionPresetEntry => ({
    identifier,
    name: identifier,
    role: 'system',
    systemPrompt: false,
    content: '',
    injectionPosition: 0,
    injectionDepth: 0,
    injectionOrder: 100,
    marker: false,
    forbidOverrides: false,
    injectionTrigger: null,
    ...overrides
});

const createPreset = (
    prompts: ChatCompletionPresetEntry[],
    order: ChatCompletionPresetOrderEntry[],
    overrides: Partial<ChatCompletionPreset> = {}
): ChatCompletionPreset => ({
    name: '测试预设',
    prompts,
    promptOrder: [{ characterId: ST_DEFAULT_CHARACTER_ID, order }],
    sampling: { ...DEFAULT_CHAT_COMPLETION_SAMPLING },
    behavior: { ...DEFAULT_CHAT_COMPLETION_BEHAVIOR },
    ...overrides
});

const createCharacter = (overrides: Partial<ChatCharacterFields> = {}): ChatCharacterFields => ({
    name: '爱丽丝',
    description: '角色描述',
    personality: '角色性格',
    scenario: '场景',
    systemPrompt: '',
    postHistoryInstructions: '',
    dialogueExamples: '',
    depthPrompt: null,
    firstMessage: '',
    ...overrides
});

const wiEntry = (
    uid: number,
    content: string,
    position: PromptWorldbookInsertionPosition,
    overrides: Partial<PromptWorldbookActivatedEntry> = {}
): PromptWorldbookActivatedEntry => ({
    uid,
    comment: `wi-${uid}`,
    content,
    role: 'system',
    depth: 0,
    order: 100,
    insertion: { position, role: 'system' },
    ...overrides
});

const createActivation = (
    buckets: Partial<Record<PromptWorldbookInsertionPosition, PromptWorldbookActivatedEntry[]>>
): PromptWorldbookActivationSnapshot => ({
    entries: Object.values(buckets).flat(),
    insertionBuckets: {
        before: [],
        after: [],
        an_top: [],
        an_bottom: [],
        em_top: [],
        em_bottom: [],
        at_depth: [],
        outlet: [],
        ...buckets
    },
    trace: [],
    diagnostics: []
});

const history: CleanedMessage[] = [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好呀' },
    { role: 'user', content: '今天去哪' }
];

const createVariables = (): StagedMacroVariables => new StagedMacroVariables({ local: {}, global: {} });

describe('buildRoleplayPrompt 基础组装', () => {
    it('按 prompt_order 组装 marker，角色 system prompt 覆盖 main，post_history 覆盖 jailbreak', () => {
        const preset = createPreset(
            [
                entry('main', { content: '预设主提示词' }),
                entry('charDescription'),
                entry('chatHistory'),
                entry('jailbreak', { content: '预设越狱' })
            ],
            [
                { identifier: 'main', enabled: true },
                { identifier: 'charDescription', enabled: true },
                { identifier: 'chatHistory', enabled: true },
                { identifier: 'jailbreak', enabled: true }
            ]
        );
        const result = buildRoleplayPrompt({
            history,
            preset,
            character: createCharacter({ systemPrompt: '角色系统指令', postHistoryInstructions: '历史后指令' }),
            charName: '爱丽丝',
            userName: '玩家',
            variables: createVariables()
        });

        expect(result.messages.map(item => item.content)).toEqual([
            '角色系统指令',
            '角色描述',
            '你好',
            '你好呀',
            '今天去哪',
            '历史后指令'
        ]);
        expect(result.messages[0].role).toBe('system');
        expect(result.messages.at(-1)?.role).toBe('system');
    });

    it('禁用条目被跳过', () => {
        const preset = createPreset(
            [entry('main', { content: '主' }), entry('scenario')],
            [
                { identifier: 'main', enabled: true },
                { identifier: 'scenario', enabled: false }
            ]
        );
        const result = buildRoleplayPrompt({
            history: [],
            preset,
            character: createCharacter(),
            variables: createVariables()
        });

        expect(result.messages).toEqual([{ role: 'system', content: '主' }]);
    });

    it('无预设时走默认顺序并只输出历史', () => {
        const result = buildRoleplayPrompt({
            history,
            preset: null,
            variables: createVariables()
        });

        expect(result.messages).toEqual(history);
        expect(result.settings).toEqual({});
    });

    it('人物设定置于最前，自定义提示词按 order 插入', () => {
        const preset = createPreset(
            [
                entry('main', { content: '主' }),
                entry('custom-style', { name: '文风', content: '简洁', role: 'assistant' }),
                entry('chatHistory')
            ],
            [
                { identifier: 'main', enabled: true },
                { identifier: 'custom-style', enabled: true },
                { identifier: 'chatHistory', enabled: true }
            ]
        );
        const result = buildRoleplayPrompt({
            history: [{ role: 'user', content: '嗨' }],
            preset,
            personaDescription: '一位旅人',
            variables: createVariables()
        });

        expect(result.messages.map(item => item.content)).toEqual(['一位旅人', '主', '简洁', '嗨']);
        expect(result.messages[2].role).toBe('assistant');
    });
});

describe('buildRoleplayPrompt 世界书注入', () => {
    it('before/after 进入对应 marker，an/em 夹住 jailbreak 与示例', () => {
        const preset = createPreset(
            [
                entry('worldInfoBefore'),
                entry('main', { content: '主' }),
                entry('worldInfoAfter'),
                entry('dialogueExamples'),
                entry('chatHistory'),
                entry('jailbreak', { content: '越狱' })
            ],
            [
                { identifier: 'worldInfoBefore', enabled: true },
                { identifier: 'main', enabled: true },
                { identifier: 'worldInfoAfter', enabled: true },
                { identifier: 'dialogueExamples', enabled: true },
                { identifier: 'chatHistory', enabled: true },
                { identifier: 'jailbreak', enabled: true }
            ]
        );
        const result = buildRoleplayPrompt({
            history: [],
            preset,
            character: createCharacter({ dialogueExamples: '{{char}}: 示例' }),
            worldbookActivation: createActivation({
                before: [wiEntry(1, '前置设定', 'before')],
                after: [wiEntry(2, '后置设定', 'after')],
                em_top: [wiEntry(3, '示例前', 'em_top')],
                em_bottom: [wiEntry(4, '示例后', 'em_bottom')],
                an_top: [wiEntry(5, 'AN前', 'an_top')],
                an_bottom: [wiEntry(6, 'AN后', 'an_bottom')]
            }),
            variables: createVariables()
        });

        expect(result.messages.map(item => item.content)).toEqual([
            '前置设定',
            '主',
            '后置设定',
            '示例前',
            '示例',
            '示例后',
            'AN前',
            '越狱',
            'AN后'
        ]);
    });

    it('at_depth 条目按深度插入历史', () => {
        const preset = createPreset(
            [entry('chatHistory')],
            [{ identifier: 'chatHistory', enabled: true }]
        );
        const result = buildRoleplayPrompt({
            history,
            preset,
            worldbookActivation: createActivation({
                at_depth: [
                    wiEntry(7, '深度0', 'at_depth', { depth: 0, insertion: { position: 'at_depth', depth: 0, role: 'system' } }),
                    wiEntry(8, '深度2', 'at_depth', { depth: 2, insertion: { position: 'at_depth', depth: 2, role: 'system' } })
                ]
            }),
            variables: createVariables()
        });

        expect(result.messages.map(item => item.content)).toEqual([
            '你好',
            '深度2',
            '你好呀',
            '今天去哪',
            '深度0'
        ]);
    });

    it('outlet 条目追加在末尾', () => {
        const preset = createPreset(
            [entry('chatHistory')],
            [{ identifier: 'chatHistory', enabled: true }]
        );
        const result = buildRoleplayPrompt({
            history: [{ role: 'user', content: '嗨' }],
            preset,
            worldbookActivation: createActivation({ outlet: [wiEntry(9, 'outlet 内容', 'outlet')] }),
            variables: createVariables()
        });

        expect(result.messages.at(-1)?.content).toBe('outlet 内容');
    });
});

describe('buildRoleplayPrompt 深度注入、宏、正则与参数', () => {
    it('绝对深度提示词与 depth_prompt 注入历史', () => {
        const preset = createPreset(
            [
                entry('chatHistory'),
                entry('depth-note', {
                    name: '深度注释',
                    content: '绝对注入',
                    injectionPosition: 1,
                    injectionDepth: 1,
                    injectionOrder: 50
                })
            ],
            [
                { identifier: 'chatHistory', enabled: true },
                { identifier: 'depth-note', enabled: true }
            ]
        );
        const result = buildRoleplayPrompt({
            history,
            preset,
            character: createCharacter({
                depthPrompt: { prompt: '角色深度设定', depth: 2, role: 'assistant', position: 0 }
            }),
            variables: createVariables()
        });

        expect(result.messages.map(item => item.content)).toEqual([
            '你好',
            '角色深度设定',
            '你好呀',
            '绝对注入',
            '今天去哪'
        ]);
    });

    it('宏在片段内容上展开', () => {
        const preset = createPreset(
            [entry('main', { content: '你是{{char}}，服务于{{user}}。' })],
            [{ identifier: 'main', enabled: true }]
        );
        const result = buildRoleplayPrompt({
            history: [],
            preset,
            charName: '爱丽丝',
            userName: '玩家',
            variables: createVariables()
        });

        expect(result.messages[0].content).toBe('你是爱丽丝，服务于玩家。');
        expect(result.trace.usedMacros).toContain('char');
    });

    it('变量宏写入暂存并同轮可见', () => {
        const variables = createVariables();
        const preset = createPreset(
            [entry('custom-hp', { content: '{{setvar::hp::10}}HP={{getvar::hp}}' })],
            [{ identifier: 'custom-hp', enabled: true }]
        );
        const result = buildRoleplayPrompt({
            history: [],
            preset,
            variables
        });

        expect(result.messages[0].content).toBe('HP=10');
        expect(variables.get('local', 'hp')).toBe('10');
    });

    it('用户输入与 AI 输出正则作用于历史', () => {
        const preset = createPreset([entry('chatHistory')], [{ identifier: 'chatHistory', enabled: true }]);
        const result = buildRoleplayPrompt({
            history: [
                { role: 'user', content: '状态: 正常' },
                { role: 'assistant', content: '收到 (状态栏)' }
            ],
            preset,
            regexScripts: [
                {
                    id: 'r1',
                    scriptName: '去状态',
                    enabled: true,
                    findRegex: '/状态:\\s*\\S+/g',
                    replaceString: '状态: 隐藏',
                    trimStrings: [],
                    placement: [1],
                    markdownOnly: false,
                    promptOnly: false,
                    runOnEdit: false,
                    substituteRegex: 0,
                    minDepth: null,
                    maxDepth: null
                },
                {
                    id: 'r2',
                    scriptName: '去状态栏',
                    enabled: true,
                    findRegex: '/\\s*\\(状态栏\\)/g',
                    replaceString: '',
                    trimStrings: [],
                    placement: [2],
                    markdownOnly: false,
                    promptOnly: false,
                    runOnEdit: false,
                    substituteRegex: 0,
                    minDepth: null,
                    maxDepth: null
                }
            ],
            variables: createVariables()
        });

        expect(result.messages.map(item => item.content)).toEqual(['状态: 隐藏', '收到']);
    });

    it('assistant prefill 追加为末尾 assistant 消息', () => {
        const preset = createPreset(
            [entry('chatHistory')],
            [{ identifier: 'chatHistory', enabled: true }],
            { behavior: { ...DEFAULT_CHAT_COMPLETION_BEHAVIOR, assistantPrefill: '好的，' } }
        );
        const result = buildRoleplayPrompt({
            history: [{ role: 'user', content: '嗨' }],
            preset,
            variables: createVariables()
        });

        expect(result.messages.at(-1)).toEqual({ role: 'assistant', content: '好的，' });
    });

    it('采样参数映射为 camelCase 设置', () => {
        const preset = createPreset(
            [entry('chatHistory')],
            [{ identifier: 'chatHistory', enabled: true }],
            {
                sampling: {
                    ...DEFAULT_CHAT_COMPLETION_SAMPLING,
                    temperature: 0.8,
                    topP: 0.9,
                    topK: 40,
                    maxTokens: 500,
                    seed: 7
                }
            }
        );
        const result = buildRoleplayPrompt({
            history: [],
            preset,
            variables: createVariables()
        });

        expect(result.settings).toMatchObject({
            temperature: 0.8,
            topP: 0.9,
            topK: 40,
            maxTokens: 500,
            seed: 7
        });
    });

    it('未知 order identifier 给出 warning', () => {
        const preset = createPreset(
            [entry('chatHistory')],
            [
                { identifier: 'chatHistory', enabled: true },
                { identifier: 'ghost-prompt', enabled: true }
            ]
        );
        const result = buildRoleplayPrompt({
            history: [],
            preset,
            variables: createVariables()
        });

        expect(result.trace.warnings.some(item => item.includes('ghost-prompt'))).toBe(true);
    });
});
