import type { ResourceDiagnostic } from '@shared/resources/index.js';

/**
 * ST Chat Completion 预设的规范化模型。
 *
 * 设计口径：
 * - 已知字段被规范化成 camelCase；未消费的原始字段通过索引签名原样保留，
 *   由 `serializeChatCompletionPreset` 回写为 ST 兼容 JSON，保证“导入 → 编辑 → 导出”往返不丢数据。
 * - `enabled` 不存在于 prompt 条目上，只存在于 `promptOrder` 中（与 ST 一致）。
 */

export type ChatCompletionPresetFormat = 'chat-completion' | 'text-completion' | 'unknown';

export type ChatCompletionPromptRole = 'system' | 'user' | 'assistant';

/** ST `injection_position`：0 = 相对位置，1 = 绝对深度位置。 */
export type ChatCompletionInjectionPosition = 0 | 1;

/** ST `names_behavior`：0 = 默认，1 = 从不附加名字，2 = 总是附加名字。 */
export type ChatCompletionNamesBehavior = 0 | 1 | 2;

export interface ChatCompletionPresetEntry {
    identifier: string;
    name: string;
    role: ChatCompletionPromptRole;
    /** ST `system_prompt`，标记该条目是否作为系统提示处理。 */
    systemPrompt: boolean;
    content: string;
    injectionPosition: ChatCompletionInjectionPosition;
    injectionDepth: number;
    injectionOrder: number;
    marker: boolean;
    forbidOverrides: boolean;
    injectionTrigger: string[] | null;
    /** 未消费的原始字段，序列化时原样带回。 */
    [key: string]: unknown;
}

export interface ChatCompletionPresetOrderEntry {
    identifier: string;
    enabled: boolean;
}

export interface ChatCompletionPresetOrderGroup {
    /** ST `character_id`；`100000` 是 ST 的默认/全局分组。 */
    characterId: number | null;
    order: ChatCompletionPresetOrderEntry[];
}

export interface ChatCompletionSamplingSettings {
    temperature: number;
    frequencyPenalty: number;
    presencePenalty: number;
    topP: number;
    topK: number;
    minP: number;
    repetitionPenalty: number;
    /** ST 用 `-1` 表示未固定；模型中为 `null`。 */
    seed: number | null;
    maxContext: number;
    maxTokens: number;
    maxContextUnlocked: boolean;
    stream: boolean;
}

export interface ChatCompletionBehaviorSettings {
    namesBehavior: ChatCompletionNamesBehavior;
    wrapInQuotes: boolean;
    sendIfEmpty: string;
    assistantPrefill: string;
    assistantImpersonation: boolean;
}

export interface ChatCompletionPreset {
    name: string;
    prompts: ChatCompletionPresetEntry[];
    promptOrder: ChatCompletionPresetOrderGroup[];
    sampling: ChatCompletionSamplingSettings;
    behavior: ChatCompletionBehaviorSettings;
    /** 未消费的原始字段，序列化时原样带回。 */
    [key: string]: unknown;
}

export interface ChatCompletionPresetParseResult {
    preset: ChatCompletionPreset | null;
    format: ChatCompletionPresetFormat;
    diagnostics: ResourceDiagnostic[];
}

export const DEFAULT_CHAT_COMPLETION_SAMPLING: ChatCompletionSamplingSettings = {
    temperature: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    topP: 1,
    topK: 0,
    minP: 0,
    repetitionPenalty: 1,
    seed: null,
    maxContext: 4095,
    maxTokens: 300,
    maxContextUnlocked: false,
    stream: false
};

export const DEFAULT_CHAT_COMPLETION_BEHAVIOR: ChatCompletionBehaviorSettings = {
    namesBehavior: 0,
    wrapInQuotes: false,
    sendIfEmpty: '',
    assistantPrefill: '',
    assistantImpersonation: false
};

export const DEFAULT_CHAT_COMPLETION_ENTRY = {
    role: 'system',
    systemPrompt: false,
    injectionPosition: 0,
    injectionDepth: 0,
    injectionOrder: 100,
    marker: false,
    forbidOverrides: false,
    injectionTrigger: null
} as const satisfies Omit<ChatCompletionPresetEntry, 'identifier' | 'name' | 'content'>;

/** ST 默认/全局 prompt_order 分组的 character_id。 */
export const ST_DEFAULT_CHARACTER_ID = 100000;
