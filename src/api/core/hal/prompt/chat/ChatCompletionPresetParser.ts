import type { ResourceDiagnostic } from '@shared/resources/index.js';
import {
    DEFAULT_CHAT_COMPLETION_BEHAVIOR,
    DEFAULT_CHAT_COMPLETION_ENTRY,
    DEFAULT_CHAT_COMPLETION_SAMPLING,
    ST_DEFAULT_CHARACTER_ID,
    type ChatCompletionBehaviorSettings,
    type ChatCompletionInjectionPosition,
    type ChatCompletionNamesBehavior,
    type ChatCompletionPreset,
    type ChatCompletionPresetEntry,
    type ChatCompletionPresetFormat,
    type ChatCompletionPresetOrderEntry,
    type ChatCompletionPresetOrderGroup,
    type ChatCompletionPresetParseResult,
    type ChatCompletionPromptRole,
    type ChatCompletionSamplingSettings
} from '../../../../../types/ChatCompletionPresetTypes.js';

export interface ChatCompletionPresetParseOptions {
    /** 预设 JSON 没有 `name`/`preset_name` 时使用（通常是文件名）。 */
    nameHint?: string;
}

const CONSUMED_TOP_LEVEL_KEYS: readonly string[] = [
    'name',
    'preset_name',
    'prompts',
    'prompt_order',
    'temperature',
    'frequency_penalty',
    'presence_penalty',
    'top_p',
    'top_k',
    'min_p',
    'repetition_penalty',
    'seed',
    'openai_max_context',
    'openai_max_tokens',
    'max_context_unlocked',
    'stream_openai',
    'names_behavior',
    'wrap_in_quotes',
    'send_if_empty',
    'assistant_prefill',
    'assistant_impersonation',
    'promptOrder',
    'sampling',
    'behavior'
];

const CONSUMED_ENTRY_KEYS: readonly string[] = [
    'identifier',
    'name',
    'system_prompt',
    'role',
    'content',
    'injection_position',
    'injection_depth',
    'injection_order',
    'marker',
    'forbid_overrides',
    'injection_trigger'
];

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const toTrimmedString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const toNumber = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
};

const toBoolean = (value: unknown, fallback = false): boolean => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === 'true' || value === '1') return true;
    if (value === 0 || value === 'false' || value === '0') return false;
    return fallback;
};

const toRole = (value: unknown, diagnostics: ResourceDiagnostic[], identifier: string): ChatCompletionPromptRole => {
    if (value === 'system' || value === 'user' || value === 'assistant') return value;
    // 部分预设/生态用 "model" 表示模型侧消息，映射为 assistant。
    if (value === 'model') return 'assistant';
    if (value !== undefined && value !== null && value !== '') {
        diagnostics.push({
            level: 'warning',
            code: 'preset.prompt_role_invalid',
            message: `提示词「${identifier}」的 role 非法，已按 system 处理。`
        });
    }
    return 'system';
};

const toInjectionPosition = (value: unknown): ChatCompletionInjectionPosition => toNumber(value, 0) === 1 ? 1 : 0;

const toNamesBehavior = (value: unknown): ChatCompletionNamesBehavior => {
    const parsed = toNumber(value, 0);
    return parsed === 1 || parsed === 2 ? parsed : 0;
};

const toSeed = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    return value;
};

const collectExtras = (record: Record<string, unknown>, consumedKeys: readonly string[]): Record<string, unknown> => {
    const extras: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
        if (!consumedKeys.includes(key)) extras[key] = value;
    }
    return extras;
};

export const detectChatCompletionPresetFormat = (input: unknown): ChatCompletionPresetFormat => {
    const record = asRecord(input);
    if (!record) return 'unknown';
    const prompts = record.prompts;
    const order = record.prompt_order;
    if ((Array.isArray(prompts) && prompts.length > 0) || (Array.isArray(order) && order.length > 0)) {
        return 'chat-completion';
    }
    if (
        asRecord(record.instruct) !== null
        || record.temp !== undefined
        || record.rep_pen !== undefined
        || record.sampler_order !== undefined
    ) {
        return 'text-completion';
    }
    return 'unknown';
};

const normalizePromptEntry = (
    raw: unknown,
    index: number,
    diagnostics: ResourceDiagnostic[]
): ChatCompletionPresetEntry | null => {
    const record = asRecord(raw);
    if (!record) {
        diagnostics.push({
            level: 'warning',
            code: 'preset.prompt_invalid',
            message: `第 ${index + 1} 条提示词不是对象，已跳过。`
        });
        return null;
    }
    const identifier = toTrimmedString(record.identifier);
    if (!identifier) {
        diagnostics.push({
            level: 'warning',
            code: 'preset.prompt_invalid',
            message: `第 ${index + 1} 条提示词缺少 identifier，已跳过。`
        });
        return null;
    }
    const trigger = record.injection_trigger;
    return {
        ...collectExtras(record, CONSUMED_ENTRY_KEYS),
        identifier,
        name: toTrimmedString(record.name) || identifier,
        role: toRole(record.role, diagnostics, identifier),
        systemPrompt: toBoolean(record.system_prompt),
        content: typeof record.content === 'string' ? record.content : '',
        injectionPosition: toInjectionPosition(record.injection_position),
        injectionDepth: toNumber(record.injection_depth, DEFAULT_CHAT_COMPLETION_ENTRY.injectionDepth),
        injectionOrder: toNumber(record.injection_order, DEFAULT_CHAT_COMPLETION_ENTRY.injectionOrder),
        marker: toBoolean(record.marker),
        forbidOverrides: toBoolean(record.forbid_overrides),
        injectionTrigger: Array.isArray(trigger)
            ? trigger.map(item => toTrimmedString(item)).filter(Boolean)
            : null
    };
};

const normalizePromptOrder = (raw: unknown, diagnostics: ResourceDiagnostic[]): ChatCompletionPresetOrderGroup[] => {
    if (!Array.isArray(raw)) return [];
    const groups: ChatCompletionPresetOrderGroup[] = [];
    raw.forEach((rawGroup, groupIndex) => {
        const groupRecord = asRecord(rawGroup);
        if (!groupRecord) {
            diagnostics.push({
                level: 'warning',
                code: 'preset.order_invalid',
                message: `prompt_order 第 ${groupIndex + 1} 组不是对象，已跳过。`
            });
            return;
        }
        const order: ChatCompletionPresetOrderEntry[] = [];
        const rawOrder = groupRecord.order;
        if (Array.isArray(rawOrder)) {
            rawOrder.forEach(rawItem => {
                const itemRecord = asRecord(rawItem);
                const identifier = itemRecord ? toTrimmedString(itemRecord.identifier) : '';
                if (!itemRecord || !identifier) {
                    diagnostics.push({
                        level: 'warning',
                        code: 'preset.order_invalid',
                        message: `prompt_order 存在缺少 identifier 的条目，已跳过。`
                    });
                    return;
                }
                order.push({ identifier, enabled: toBoolean(itemRecord.enabled, true) });
            });
        }
        const characterId = toNumber(groupRecord.character_id, Number.NaN);
        groups.push({ characterId: Number.isFinite(characterId) ? characterId : null, order });
    });
    return groups;
};

const parseSampling = (record: Record<string, unknown>): ChatCompletionSamplingSettings => ({
    temperature: toNumber(record.temperature, DEFAULT_CHAT_COMPLETION_SAMPLING.temperature),
    frequencyPenalty: toNumber(record.frequency_penalty, DEFAULT_CHAT_COMPLETION_SAMPLING.frequencyPenalty),
    presencePenalty: toNumber(record.presence_penalty, DEFAULT_CHAT_COMPLETION_SAMPLING.presencePenalty),
    topP: toNumber(record.top_p, DEFAULT_CHAT_COMPLETION_SAMPLING.topP),
    topK: toNumber(record.top_k, DEFAULT_CHAT_COMPLETION_SAMPLING.topK),
    minP: toNumber(record.min_p, DEFAULT_CHAT_COMPLETION_SAMPLING.minP),
    repetitionPenalty: toNumber(record.repetition_penalty, DEFAULT_CHAT_COMPLETION_SAMPLING.repetitionPenalty),
    seed: toSeed(record.seed),
    maxContext: toNumber(record.openai_max_context, DEFAULT_CHAT_COMPLETION_SAMPLING.maxContext),
    maxTokens: toNumber(record.openai_max_tokens, DEFAULT_CHAT_COMPLETION_SAMPLING.maxTokens),
    maxContextUnlocked: toBoolean(record.max_context_unlocked, DEFAULT_CHAT_COMPLETION_SAMPLING.maxContextUnlocked),
    stream: toBoolean(record.stream_openai, DEFAULT_CHAT_COMPLETION_SAMPLING.stream)
});

const parseBehavior = (record: Record<string, unknown>): ChatCompletionBehaviorSettings => ({
    namesBehavior: toNamesBehavior(record.names_behavior),
    wrapInQuotes: toBoolean(record.wrap_in_quotes, DEFAULT_CHAT_COMPLETION_BEHAVIOR.wrapInQuotes),
    sendIfEmpty: typeof record.send_if_empty === 'string' ? record.send_if_empty : DEFAULT_CHAT_COMPLETION_BEHAVIOR.sendIfEmpty,
    assistantPrefill: typeof record.assistant_prefill === 'string' ? record.assistant_prefill : DEFAULT_CHAT_COMPLETION_BEHAVIOR.assistantPrefill,
    assistantImpersonation: typeof record.assistant_impersonation === 'string'
        ? record.assistant_impersonation
        : DEFAULT_CHAT_COMPLETION_BEHAVIOR.assistantImpersonation
});

/**
 * 解析 ST Chat Completion 预设 JSON。
 *
 * 纯函数，不读写存储；失败时返回 `preset: null` 并带 `error` 级诊断。
 * 未消费字段原样保留在返回模型中，用于导出时的往返保真。
 */
export const parseChatCompletionPreset = (
    input: unknown,
    options: ChatCompletionPresetParseOptions = {}
): ChatCompletionPresetParseResult => {
    const diagnostics: ResourceDiagnostic[] = [];
    const record = asRecord(input);
    if (!record) {
        return {
            preset: null,
            format: 'unknown',
            diagnostics: [{ level: 'error', code: 'preset.invalid_format', message: '预设必须是 JSON 对象。' }]
        };
    }

    const format = detectChatCompletionPresetFormat(record);
    if (format === 'text-completion') {
        return {
            preset: null,
            format,
            diagnostics: [{
                level: 'error',
                code: 'preset.text_completion_unsupported',
                message: '这份预设是 Text Completion（instruct）格式，当前版本只支持 Chat Completion 预设。'
            }]
        };
    }

    const prompts: ChatCompletionPresetEntry[] = [];
    const seenIdentifiers = new Set<string>();
    if (Array.isArray(record.prompts)) {
        record.prompts.forEach((rawEntry, index) => {
            const entry = normalizePromptEntry(rawEntry, index, diagnostics);
            if (!entry) return;
            if (seenIdentifiers.has(entry.identifier)) {
                diagnostics.push({
                    level: 'warning',
                    code: 'preset.prompt_duplicate_identifier',
                    message: `提示词 identifier「${entry.identifier}」重复出现，后一条仍会保留。`
                });
            }
            seenIdentifiers.add(entry.identifier);
            prompts.push(entry);
        });
    }

    const promptOrder = normalizePromptOrder(record.prompt_order, diagnostics);
    if (prompts.length === 0 && promptOrder.length === 0) {
        return {
            preset: null,
            format: 'unknown',
            diagnostics: [
                ...diagnostics,
                {
                    level: 'error',
                    code: 'preset.empty',
                    message: '预设不包含 prompts 或 prompt_order，无法识别为 Chat Completion 预设。'
                }
            ]
        };
    }

    for (const group of promptOrder) {
        for (const item of group.order) {
            if (!seenIdentifiers.has(item.identifier)) {
                diagnostics.push({
                    level: 'warning',
                    code: 'preset.order_unknown_identifier',
                    message: `prompt_order 引用了不存在的提示词「${item.identifier}」。`
                });
            }
        }
    }

    const rawName = toTrimmedString(record.name) || toTrimmedString(record.preset_name);
    const name = rawName || options.nameHint?.trim() || '未命名预设';
    if (!rawName) {
        diagnostics.push({
            level: 'info',
            code: 'preset.name_missing',
            message: options.nameHint ? `预设没有名称，使用文件名「${name}」。` : `预设没有名称，已使用「${name}」。`
        });
    }

    return {
        format: 'chat-completion',
        preset: {
            ...collectExtras(record, CONSUMED_TOP_LEVEL_KEYS),
            name,
            prompts,
            promptOrder,
            sampling: parseSampling(record),
            behavior: parseBehavior(record)
        },
        diagnostics
    };
};

const serializePromptEntry = (entry: ChatCompletionPresetEntry): Record<string, unknown> => {
    const serialized: Record<string, unknown> = {
        ...collectExtras(entry, CONSUMED_ENTRY_KEYS),
        identifier: entry.identifier,
        name: entry.name,
        system_prompt: entry.systemPrompt,
        role: entry.role,
        content: entry.content,
        injection_position: entry.injectionPosition,
        injection_depth: entry.injectionDepth,
        injection_order: entry.injectionOrder,
        marker: entry.marker,
        forbid_overrides: entry.forbidOverrides
    };
    if (entry.injectionTrigger && entry.injectionTrigger.length > 0) {
        serialized.injection_trigger = [...entry.injectionTrigger];
    }
    return serialized;
};

/** 把模型序列化回 ST 兼容 JSON；未消费的原始字段原样带回。 */
export const serializeChatCompletionPreset = (preset: ChatCompletionPreset): Record<string, unknown> => ({
    ...collectExtras(preset, CONSUMED_TOP_LEVEL_KEYS),
    name: preset.name,
    prompts: preset.prompts.map(serializePromptEntry),
    prompt_order: preset.promptOrder.map(group => ({
        character_id: group.characterId ?? ST_DEFAULT_CHARACTER_ID,
        order: group.order.map(item => ({ identifier: item.identifier, enabled: item.enabled }))
    })),
    temperature: preset.sampling.temperature,
    frequency_penalty: preset.sampling.frequencyPenalty,
    presence_penalty: preset.sampling.presencePenalty,
    top_p: preset.sampling.topP,
    top_k: preset.sampling.topK,
    min_p: preset.sampling.minP,
    repetition_penalty: preset.sampling.repetitionPenalty,
    seed: preset.sampling.seed ?? -1,
    openai_max_context: preset.sampling.maxContext,
    openai_max_tokens: preset.sampling.maxTokens,
    max_context_unlocked: preset.sampling.maxContextUnlocked,
    stream_openai: preset.sampling.stream,
    names_behavior: preset.behavior.namesBehavior,
    wrap_in_quotes: preset.behavior.wrapInQuotes,
    send_if_empty: preset.behavior.sendIfEmpty,
    assistant_prefill: preset.behavior.assistantPrefill,
    assistant_impersonation: preset.behavior.assistantImpersonation
});
