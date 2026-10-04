import { describe, it, expect } from 'vitest';
import {
    detectChatCompletionPresetFormat,
    parseChatCompletionPreset,
    serializeChatCompletionPreset
} from '@/api/core/hal/prompt/chat/ChatCompletionPresetParser.js';
import { ST_DEFAULT_CHARACTER_ID } from '@/types/ChatCompletionPresetTypes.js';

const createChatCompletionFixture = (): Record<string, unknown> => ({
    name: '测试预设',
    temperature: 0.9,
    frequency_penalty: 0.2,
    presence_penalty: 0.1,
    top_p: 0.95,
    top_k: 40,
    min_p: 0.05,
    repetition_penalty: 1.1,
    seed: -1,
    openai_max_context: 8192,
    openai_max_tokens: 600,
    max_context_unlocked: false,
    stream_openai: true,
    names_behavior: 2,
    wrap_in_quotes: true,
    assistant_prefill: '好的，',
    assistant_impersonation: false,
    prompts: [
        {
            identifier: 'main',
            name: '主提示词',
            system_prompt: true,
            role: 'system',
            content: '你是{{char}}。',
            injection_position: 0,
            injection_depth: 4,
            injection_order: 100
        },
        {
            identifier: 'worldInfoBefore',
            name: '世界书 before',
            system_prompt: true,
            role: 'system',
            content: '',
            marker: true
        },
        {
            identifier: 'custom-1',
            name: '文风',
            system_prompt: true,
            role: 'assistant',
            content: '保持简洁。',
            injection_position: 1,
            injection_depth: 1,
            injection_order: 50,
            forbid_overrides: true,
            injection_trigger: ['文风', '风格']
        },
        {
            identifier: 'chatHistory',
            name: '对话历史',
            system_prompt: false,
            role: 'user',
            content: '',
            marker: true
        },
        {
            identifier: 'jailbreak',
            name: '越狱',
            system_prompt: true,
            role: 'system',
            content: '保持角色。'
        }
    ],
    prompt_order: [
        {
            character_id: ST_DEFAULT_CHARACTER_ID,
            order: [
                { identifier: 'main', enabled: true },
                { identifier: 'worldInfoBefore', enabled: true },
                { identifier: 'custom-1', enabled: true },
                { identifier: 'chatHistory', enabled: true },
                { identifier: 'jailbreak', enabled: false }
            ]
        }
    ],
    custom_unknown_field: { nested: true }
});

describe('detectChatCompletionPresetFormat', () => {
    it('识别 Chat Completion 预设', () => {
        expect(detectChatCompletionPresetFormat(createChatCompletionFixture())).toBe('chat-completion');
    });

    it('识别 Text Completion 预设', () => {
        expect(detectChatCompletionPresetFormat({ instruct: { input_sequence: '###' }, temp: 0.8 })).toBe('text-completion');
        expect(detectChatCompletionPresetFormat({ sampler_order: [0, 1, 2], rep_pen: 1.1 })).toBe('text-completion');
    });

    it('无法识别时返回 unknown', () => {
        expect(detectChatCompletionPresetFormat(null)).toBe('unknown');
        expect(detectChatCompletionPresetFormat('text')).toBe('unknown');
        expect(detectChatCompletionPresetFormat({})).toBe('unknown');
    });
});

describe('parseChatCompletionPreset', () => {
    it('解析完整 Chat Completion 预设', () => {
        const result = parseChatCompletionPreset(createChatCompletionFixture());

        expect(result.format).toBe('chat-completion');
        expect(result.preset).not.toBeNull();
        const preset = result.preset!;

        expect(preset.name).toBe('测试预设');
        expect(preset.sampling.temperature).toBe(0.9);
        expect(preset.sampling.frequencyPenalty).toBe(0.2);
        expect(preset.sampling.topK).toBe(40);
        expect(preset.sampling.minP).toBe(0.05);
        expect(preset.sampling.maxContext).toBe(8192);
        expect(preset.sampling.maxTokens).toBe(600);
        expect(preset.sampling.stream).toBe(true);
        expect(preset.sampling.seed).toBeNull();

        expect(preset.behavior.namesBehavior).toBe(2);
        expect(preset.behavior.wrapInQuotes).toBe(true);
        expect(preset.behavior.assistantPrefill).toBe('好的，');

        expect(preset.prompts).toHaveLength(5);
        const main = preset.prompts[0];
        expect(main.identifier).toBe('main');
        expect(main.systemPrompt).toBe(true);
        expect(main.injectionDepth).toBe(4);
        expect(main.injectionOrder).toBe(100);

        const custom = preset.prompts[2];
        expect(custom.injectionPosition).toBe(1);
        expect(custom.role).toBe('assistant');
        expect(custom.forbidOverrides).toBe(true);
        expect(custom.injectionTrigger).toEqual(['文风', '风格']);

        expect(preset.prompts[1].marker).toBe(true);
        expect(preset.promptOrder).toHaveLength(1);
        expect(preset.promptOrder[0].characterId).toBe(ST_DEFAULT_CHARACTER_ID);
        expect(preset.promptOrder[0].order[4]).toEqual({ identifier: 'jailbreak', enabled: false });
    });

    it('保留未消费的原始字段', () => {
        const fixture = createChatCompletionFixture();
        (fixture.prompts as Array<Record<string, unknown>>)[0].custom_entry_field = 'keep-me';
        const result = parseChatCompletionPreset(fixture);

        expect(result.preset!.custom_unknown_field).toEqual({ nested: true });
        expect(result.preset!.prompts[0].custom_entry_field).toBe('keep-me');
    });

    it('拒绝 Text Completion 预设并给出诊断', () => {
        const result = parseChatCompletionPreset({ instruct: { input_sequence: '###' }, temp: 0.8 });

        expect(result.preset).toBeNull();
        expect(result.format).toBe('text-completion');
        expect(result.diagnostics.some(item => item.code === 'preset.text_completion_unsupported')).toBe(true);
    });

    it('非对象输入报 invalid_format', () => {
        const result = parseChatCompletionPreset([]);

        expect(result.preset).toBeNull();
        expect(result.diagnostics[0].code).toBe('preset.invalid_format');
    });

    it('没有 prompts 与 prompt_order 报 empty', () => {
        const result = parseChatCompletionPreset({ temperature: 0.8 });

        expect(result.preset).toBeNull();
        expect(result.diagnostics.some(item => item.code === 'preset.empty')).toBe(true);
    });

    it('跳过非法条目并保留合法条目', () => {
        const result = parseChatCompletionPreset({
            prompts: [null, 42, { name: '没有 identifier' }, { identifier: 'ok', content: 'hi' }],
            prompt_order: []
        });

        expect(result.preset!.prompts).toHaveLength(1);
        expect(result.preset!.prompts[0].identifier).toBe('ok');
        expect(result.diagnostics.filter(item => item.code === 'preset.prompt_invalid')).toHaveLength(3);
    });

    it('role 非法时回退 system 并警告', () => {
        const result = parseChatCompletionPreset({
            prompts: [{ identifier: 'x', role: 'tool', content: 'hi' }],
            prompt_order: [{ character_id: 1, order: [{ identifier: 'x', enabled: true }] }]
        });

        expect(result.preset!.prompts[0].role).toBe('system');
        expect(result.diagnostics.some(item => item.code === 'preset.prompt_role_invalid')).toBe(true);
    });

    it('prompt_order 引用不存在的 identifier 时警告', () => {
        const result = parseChatCompletionPreset({
            prompts: [{ identifier: 'x' }],
            prompt_order: [{ character_id: 1, order: [{ identifier: 'x', enabled: true }, { identifier: 'ghost', enabled: true }] }]
        });

        expect(result.preset).not.toBeNull();
        expect(result.diagnostics.some(item => item.code === 'preset.order_unknown_identifier')).toBe(true);
    });

    it('缺省字段使用 ST 默认值', () => {
        const result = parseChatCompletionPreset({ prompts: [{ identifier: 'x' }] });

        const preset = result.preset!;
        expect(preset.sampling.temperature).toBe(1);
        expect(preset.sampling.maxContext).toBe(4095);
        expect(preset.sampling.maxTokens).toBe(300);
        expect(preset.behavior.namesBehavior).toBe(0);
        expect(preset.prompts[0]).toMatchObject({
            name: 'x',
            role: 'system',
            systemPrompt: false,
            content: '',
            injectionPosition: 0,
            injectionDepth: 0,
            injectionOrder: 100,
            marker: false,
            forbidOverrides: false,
            injectionTrigger: null
        });
    });

    it('没有名称时使用 nameHint 并提示', () => {
        const result = parseChatCompletionPreset(
            { prompts: [{ identifier: 'x' }] },
            { nameHint: 'my-preset.json' }
        );

        expect(result.preset!.name).toBe('my-preset.json');
        expect(result.diagnostics.some(item => item.code === 'preset.name_missing')).toBe(true);
    });

    it('preset_name 作为名称回退', () => {
        const result = parseChatCompletionPreset({ preset_name: '旧格式名称', prompts: [{ identifier: 'x' }] });

        expect(result.preset!.name).toBe('旧格式名称');
    });
});

describe('serializeChatCompletionPreset', () => {
    it('往返序列化保持关键字段与未知字段', () => {
        const parsed = parseChatCompletionPreset(createChatCompletionFixture()).preset!;
        const serialized = serializeChatCompletionPreset(parsed);

        expect(serialized.name).toBe('测试预设');
        expect(serialized.temperature).toBe(0.9);
        expect(serialized.openai_max_context).toBe(8192);
        expect(serialized.seed).toBe(-1);
        expect(serialized.prompt_order).toEqual([
            {
                character_id: ST_DEFAULT_CHARACTER_ID,
                order: [
                    { identifier: 'main', enabled: true },
                    { identifier: 'worldInfoBefore', enabled: true },
                    { identifier: 'custom-1', enabled: true },
                    { identifier: 'chatHistory', enabled: true },
                    { identifier: 'jailbreak', enabled: false }
                ]
            }
        ]);
        expect(serialized.custom_unknown_field).toEqual({ nested: true });

        const entries = serialized.prompts as Array<Record<string, unknown>>;
        expect(entries[0].system_prompt).toBe(true);
        expect(entries[2].injection_position).toBe(1);
        expect(entries[2].injection_trigger).toEqual(['文风', '风格']);

        const reparsed = parseChatCompletionPreset(serialized);
        expect(reparsed.preset!.name).toBe(parsed.name);
        expect(reparsed.preset!.sampling).toEqual(parsed.sampling);
        expect(reparsed.preset!.behavior).toEqual(parsed.behavior);
        expect(reparsed.preset!.prompts).toEqual(parsed.prompts);
        expect(reparsed.preset!.promptOrder).toEqual(parsed.promptOrder);
    });

    it('seed 为 null 时序列化为 -1', () => {
        const preset = parseChatCompletionPreset({ prompts: [{ identifier: 'x' }] }).preset!;
        expect(serializeChatCompletionPreset(preset).seed).toBe(-1);
    });
});
