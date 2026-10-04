import type { CleanedMessage } from '../../../../types/nexus.js';
import type { ResourceDiagnostic } from '@shared/resources/index.js';
import {
    ST_DEFAULT_CHARACTER_ID,
    ST_GLOBAL_ORDER_ID,
    type ChatCompletionPreset,
    type ChatCompletionPresetEntry
} from '../../../../types/ChatCompletionPresetTypes.js';
import type {
    PromptWorldbookActivatedEntry,
    PromptWorldbookActivationSnapshot
} from '../../../../types/PromptPresetTypes.js';
import { REGEX_PLACEMENTS, type RegexScript } from '../../../../types/RegexScriptTypes.js';
import { RegexScriptEngine } from '../regex/RegexScriptEngine.js';
import { resolveMacros } from './macros/MacroRuntime.js';
import type { MacroContext, MacroVariableView } from './macros/MacroTypes.js';
import { parseDialogueExamples, type ChatCharacterFields } from './CharacterFields.js';

/**
 * 聊天角色扮演提示词管线（ST Chat Completion 兼容）。
 *
 * 顺序：预设 prompt_order → marker 填充（角色/世界书/示例/历史/越狱）
 * → 正则（历史 + 世界书）→ 宏展开 → 绝对深度注入 → assistant prefill。
 *
 * 纯函数：资源读取、变量持久化由调用方（ChatPromptCompositionService）负责。
 */

export interface RoleplayPromptInput {
    /** 已过滤隐藏消息、已取 mesST/mesRaw/mes 的历史。 */
    history: CleanedMessage[];
    preset: ChatCompletionPreset | null;
    character?: ChatCharacterFields | null;
    /** 当前角色 id；用于选择预设里按角色绑定的 prompt_order 分组。 */
    characterId?: string | number | null;
    personaDescription?: string;
    userName?: string;
    charName?: string;
    worldbookActivation?: PromptWorldbookActivationSnapshot | null;
    regexScripts?: RegexScript[];
    variables: MacroVariableView;
    /** 同步 token 估算；缺省使用 CJK 感知的字符估算。 */
    estimateTokens?: (text: string) => number;
    now?: Date;
    random?: () => number;
    pickSeed?: string;
    locale?: string;
}

export type RoleplayPromptSourceKind =
    | 'preset'
    | 'character'
    | 'persona'
    | 'worldbook'
    | 'examples'
    | 'history'
    | 'depth';

export interface RoleplayPromptTraceEntry {
    identifier: string;
    label: string;
    sourceKind: RoleplayPromptSourceKind;
    outputMessageIndex: number;
    rawLength: number;
    finalLength: number;
}

export interface RoleplayPromptTrace {
    entries: RoleplayPromptTraceEntry[];
    diagnostics: ResourceDiagnostic[];
    warnings: string[];
    usedMacros: string[];
    regexApplied: string[];
    /** 上下文预算结果；未配置 maxContext 时为 null。 */
    budget: { maxContext: number; usedTokens: number; droppedHistory: number } | null;
}

export interface RoleplayPromptResult {
    messages: CleanedMessage[];
    settings: Record<string, unknown>;
    trace: RoleplayPromptTrace;
}

const MARKERS = {
    worldInfoBefore: 'worldInfoBefore',
    worldInfoAfter: 'worldInfoAfter',
    main: 'main',
    personaDescription: 'personaDescription',
    charDescription: 'charDescription',
    charPersonality: 'charPersonality',
    scenario: 'scenario',
    dialogueExamples: 'dialogueExamples',
    chatHistory: 'chatHistory',
    jailbreak: 'jailbreak'
} as const;

const DEFAULT_MARKER_ORDER: readonly string[] = [
    MARKERS.worldInfoBefore,
    MARKERS.main,
    MARKERS.personaDescription,
    MARKERS.charDescription,
    MARKERS.charPersonality,
    MARKERS.scenario,
    MARKERS.worldInfoAfter,
    MARKERS.dialogueExamples,
    MARKERS.chatHistory,
    MARKERS.jailbreak
];

const KNOWN_MARKERS = new Set<string>(DEFAULT_MARKER_ORDER);

const PREFILL_IDENTIFIER = 'assistant_prefill';

/** 每条消息的固定开销（role/分隔符等），与 ST 预算口径接近。 */
export const PROMPT_MESSAGE_OVERHEAD_TOKENS = 4;

/** 同步 token 估算：CJK 约 1 token/字，其余约 1/4 token/字符。 */
export const estimatePromptTokens = (text: string): number => {
    let cjk = 0;
    let other = 0;
    for (const char of text) {
        if (/[\u3000-\u303f\u3040-\u30ff\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(char)) cjk += 1;
        else other += 1;
    }
    return Math.ceil(cjk + other / 4);
};

export interface PromptBudgetResult {
    messages: CleanedMessage[];
    usedTokens: number;
    droppedHistory: number;
    /** 保留下来的消息在原数组中的下标，用于重映射 trace。 */
    keptIndices: number[];
}

/**
 * 按 `maxContext` 裁剪提示词：只丢弃最早的历史消息，system / 角色 / 世界书 / prefill 等保留。
 * 无法满足预算时保持原样（强保留部分不可安全裁剪），由 trace 反映实际用量。
 */
export const trimMessagesToContextBudget = (
    messages: CleanedMessage[],
    sourceKinds: readonly RoleplayPromptSourceKind[],
    maxContext: number,
    estimateTokens: (text: string) => number = estimatePromptTokens
): PromptBudgetResult => {
    const allIndices = messages.map((_, index) => index);
    const costOf = (message: CleanedMessage): number => estimateTokens(message.content) + PROMPT_MESSAGE_OVERHEAD_TOKENS;
    const costs = messages.map(costOf);
    let total = costs.reduce((sum, value) => sum + value, 0);
    if (maxContext <= 0 || messages.length === 0 || total <= maxContext) {
        return { messages, usedTokens: total, droppedHistory: 0, keptIndices: allIndices };
    }

    const keep = messages.map(() => true);
    let droppedHistory = 0;
    for (let index = 0; index < messages.length && total > maxContext; index += 1) {
        if (sourceKinds[index] !== 'history') continue;
        keep[index] = false;
        total -= costs[index];
        droppedHistory += 1;
    }

    return {
        messages: messages.filter((_, index) => keep[index]),
        usedTokens: total,
        droppedHistory,
        keptIndices: allIndices.filter(index => keep[index])
    };
};

interface OrderedPrompt {
    identifier: string;
    enabled: boolean;
}

const resolveOrder = (
    preset: ChatCompletionPreset | null,
    characterId?: string | number | null
): OrderedPrompt[] => {
    if (!preset) {
        return DEFAULT_MARKER_ORDER.map(identifier => ({ identifier, enabled: true }));
    }
    const normalizedCharacterId = characterId === undefined || characterId === null ? '' : String(characterId);
    const group = (normalizedCharacterId
        ? preset.promptOrder.find(item => item.characterId !== null && String(item.characterId) === normalizedCharacterId)
        : undefined)
        ?? preset.promptOrder.find(item => item.characterId === ST_GLOBAL_ORDER_ID)
        ?? preset.promptOrder.find(item => item.characterId === ST_DEFAULT_CHARACTER_ID)
        ?? preset.promptOrder[0];
    if (group && group.order.length > 0) return group.order;
    return preset.prompts.map(entry => ({ identifier: entry.identifier, enabled: true }));
};

const resolveEnabledIdentifiers = (order: OrderedPrompt[]): Set<string> =>
    new Set(order.filter(item => item.enabled).map(item => item.identifier));

const toSettings = (preset: ChatCompletionPreset | null): Record<string, unknown> => {
    if (!preset) return {};
    const settings: Record<string, unknown> = {
        temperature: preset.sampling.temperature,
        topP: preset.sampling.topP,
        topK: preset.sampling.topK,
        minP: preset.sampling.minP,
        frequencyPenalty: preset.sampling.frequencyPenalty,
        presencePenalty: preset.sampling.presencePenalty,
        repetitionPenalty: preset.sampling.repetitionPenalty,
        maxTokens: preset.sampling.maxTokens
    };
    if (preset.sampling.seed !== null) settings.seed = preset.sampling.seed;
    return settings;
};

export const buildRoleplayPrompt = (input: RoleplayPromptInput): RoleplayPromptResult => {
    const trace: RoleplayPromptTrace = {
        entries: [],
        diagnostics: [...(input.worldbookActivation?.diagnostics ?? [])],
        warnings: [],
        usedMacros: [],
        regexApplied: [],
        budget: null
    };
    const charName = input.charName ?? input.character?.name ?? '';
    const userName = input.userName ?? '';
    const entryById = new Map<string, ChatCompletionPresetEntry>(
        (input.preset?.prompts ?? []).map(entry => [entry.identifier, entry])
    );
    const regexEngine = new RegexScriptEngine(input.regexScripts ?? []);

    const substitute = (text: string): string => resolveMacros(text, createMacroContext(text)).text;
    const createMacroContext = (inputText: string): MacroContext => ({
        characterName: charName,
        userName,
        persona: input.personaDescription ?? '',
        description: input.character?.description ?? '',
        personality: input.character?.personality ?? '',
        scenario: input.character?.scenario ?? '',
        input: inputText,
        messages: input.history,
        variables: input.variables,
        now: input.now,
        random: input.random,
        pickSeed: input.pickSeed,
        locale: input.locale
    });

    const applyHistoryRegex = (history: CleanedMessage[]): CleanedMessage[] =>
        history.map((message, index) => {
            const source = message.role === 'user'
                ? REGEX_PLACEMENTS.userInput
                : message.role === 'assistant' ? REGEX_PLACEMENTS.aiOutput : null;
            if (source === null) return message;
            const result = regexEngine.apply(message.content, {
                source,
                destination: 'prompt',
                depth: history.length - 1 - index,
                resolveSubstitution: substitute
            });
            trace.regexApplied.push(...result.applied);
            trace.warnings.push(...result.warnings);
            return { ...message, content: result.text };
        });

    const regexedHistory = applyHistoryRegex(input.history);
    const lastUserContent = [...regexedHistory].reverse().find(message => message.role === 'user')?.content ?? '';
    const baseContext = createMacroContext(lastUserContent);

    const resolveWorldbookContent = (entry: PromptWorldbookActivatedEntry): string => {
        const result = regexEngine.apply(entry.content, {
            source: REGEX_PLACEMENTS.worldInfo,
            destination: 'prompt',
            resolveSubstitution: (text) => resolveMacros(text, baseContext).text
        });
        trace.regexApplied.push(...result.applied);
        trace.warnings.push(...result.warnings);
        return result.text;
    };

    type Fragment = { identifier: string; label: string; sourceKind: RoleplayPromptSourceKind; role: CleanedMessage['role']; content: string };
    const fragments: Fragment[] = [];
    const depthInjections: Array<{ depth: number; order: number; role: CleanedMessage['role']; content: string; identifier: string }> = [];

    const pushFragment = (
        identifier: string,
        label: string,
        sourceKind: RoleplayPromptSourceKind,
        role: CleanedMessage['role'],
        content: string
    ): void => {
        if (!content.trim()) return;
        fragments.push({ identifier, label, sourceKind, role, content });
    };

    const pushWorldbookBucket = (identifier: string, entries: PromptWorldbookActivatedEntry[] | undefined): void => {
        for (const entry of entries ?? []) {
            pushFragment(
                identifier,
                entry.comment ?? String(entry.uid ?? 'worldbook'),
                'worldbook',
                entry.insertion.role ?? entry.role ?? 'system',
                resolveWorldbookContent(entry)
            );
        }
    };

    const buckets = input.worldbookActivation?.insertionBuckets;
    const order = resolveOrder(input.preset, input.characterId);
    const enabledIdentifiers = resolveEnabledIdentifiers(order);

    /** ST injection_trigger：条目带触发词时，仅在最近用户输入命中时注入。 */
    const triggerMatches = (entry: ChatCompletionPresetEntry | null): boolean => {
        const triggers = entry?.injectionTrigger ?? [];
        if (triggers.length === 0) return true;
        const haystack = lastUserContent.toLowerCase();
        return triggers.some(trigger => trigger && haystack.includes(trigger.toLowerCase()));
    };

    const presetDepthInjections = (input.preset?.prompts ?? []).filter(entry =>
        enabledIdentifiers.has(entry.identifier) && entry.injectionPosition === 1 && triggerMatches(entry)
    );
    for (const entry of presetDepthInjections) {
        depthInjections.push({
            depth: Math.max(0, entry.injectionDepth),
            order: entry.injectionOrder,
            role: entry.role,
            content: entry.content,
            identifier: entry.identifier
        });
    }
    if (input.character?.depthPrompt?.prompt) {
        depthInjections.push({
            depth: Math.max(0, input.character.depthPrompt.depth),
            order: 0,
            role: input.character.depthPrompt.role,
            content: input.character.depthPrompt.prompt,
            identifier: 'depth_prompt'
        });
    }

    const resolveHistory = (): CleanedMessage[] => {
        const behavior = input.preset?.behavior ?? null;
        const lastUserIndex = regexedHistory.reduce(
            (found, message, index) => message.role === 'user' ? index : found,
            -1
        );
        const formatMessage = (message: CleanedMessage, index: number): CleanedMessage => {
            let content = message.content;
            if (behavior?.sendIfEmpty && index === lastUserIndex && content.trim() === '') {
                content = behavior.sendIfEmpty;
            }
            if (behavior?.namesBehavior === 2) {
                const name = message.role === 'user' ? userName : message.role === 'assistant' ? charName : '';
                if (name) content = `${name}: ${content}`;
            }
            if (behavior?.wrapInQuotes && message.role !== 'system' && content.trim()) {
                content = `"${content}"`;
            }
            return content === message.content ? message : { ...message, content };
        };

        const result = regexedHistory.map((message, index) => formatMessage(message, index));
        const injects = [
            ...(buckets?.at_depth ?? []).map(entry => ({
                depth: Math.max(0, Number(entry.insertion.depth ?? entry.depth ?? 0)),
                order: Number(entry.order ?? 0),
                role: (entry.insertion.role ?? entry.role ?? 'system') as CleanedMessage['role'],
                content: resolveWorldbookContent(entry)
            })),
            ...depthInjections
        ];
        // 对齐 ST populationInjectionPrompts：在「最新在前」的数组上按 depth 插入，
        // 同 depth 下按 injection_order 从高到低、同 order 同 role 用 \n 合并为一条消息。
        const reversed = [...result].reverse();
        const depths = Array.from(new Set(injects.map(inject => inject.depth))).sort((left, right) => left - right);
        let totalInserted = 0;
        for (const depth of depths) {
            const atDepth = injects.filter(inject => inject.depth === depth && inject.content.trim());
            if (atDepth.length === 0) continue;
            const orderKeys = Array.from(new Set(atDepth.map(inject => inject.order))).sort((left, right) => right - left);
            const roleMessages: CleanedMessage[] = [];
            for (const order of orderKeys) {
                const group = atDepth.filter(inject => inject.order === order);
                for (const role of ['system', 'user', 'assistant'] as const) {
                    const content = group
                        .filter(inject => inject.role === role)
                        .map(inject => inject.content.trim())
                        .filter(Boolean)
                        .join('\n');
                    if (content) roleMessages.push({ role, content });
                }
            }
            if (roleMessages.length > 0) {
                reversed.splice(depth + totalInserted, 0, ...roleMessages);
                totalInserted += roleMessages.length;
            }
        }
        return reversed.reverse();
    };
    const historyMessages = resolveHistory();

    for (const item of order) {
        if (!item.enabled) continue;
        const entry = entryById.get(item.identifier) ?? null;
        const character = input.character ?? null;
        if (entry && !triggerMatches(entry)) continue;

        switch (item.identifier) {
            case MARKERS.worldInfoBefore:
                pushWorldbookBucket(item.identifier, buckets?.before);
                break;
            case MARKERS.worldInfoAfter:
                pushWorldbookBucket(item.identifier, buckets?.after);
                break;
            case MARKERS.main: {
                // forbid_overrides 条目不允许角色卡 system prompt 覆盖。
                const override = entry?.forbidOverrides ? '' : character?.systemPrompt?.trim();
                const content = override || entry?.content || '';
                pushFragment(item.identifier, entry?.name ?? '主提示词', 'preset', entry?.role ?? 'system', content);
                break;
            }
            case MARKERS.charDescription:
                pushFragment(item.identifier, '角色描述', 'character', entry?.role ?? 'system', character?.description || entry?.content || '');
                break;
            case MARKERS.personaDescription: {
                const personaContent = input.personaDescription?.trim() ? input.personaDescription : (entry?.content ?? '');
                pushFragment(item.identifier, '用户设定', 'persona', entry?.role ?? 'system', personaContent);
                break;
            }
            case MARKERS.charPersonality:
                pushFragment(item.identifier, '角色性格', 'character', entry?.role ?? 'system', character?.personality || entry?.content || '');
                break;
            case MARKERS.scenario:
                pushFragment(item.identifier, '场景', 'character', entry?.role ?? 'system', character?.scenario || entry?.content || '');
                break;
            case MARKERS.dialogueExamples: {
                pushWorldbookBucket(item.identifier, buckets?.em_top);
                const parseRegexedExamples = regexEngine.apply(character?.dialogueExamples ?? '', {
                    source: REGEX_PLACEMENTS.aiOutput,
                    destination: 'prompt',
                    resolveSubstitution: substitute
                });
                trace.regexApplied.push(...parseRegexedExamples.applied);
                const examples = parseDialogueExamples(parseRegexedExamples.text, { charName, userName });
                if (examples.length > 0) {
                    for (const example of examples) {
                        pushFragment(item.identifier, '示例对话', 'examples', example.role, example.content);
                    }
                } else if (entry?.content) {
                    pushFragment(item.identifier, entry.name ?? '示例对话', 'preset', entry.role, entry.content);
                }
                pushWorldbookBucket(item.identifier, buckets?.em_bottom);
                break;
            }
            case MARKERS.chatHistory:
                for (const message of historyMessages) {
                    pushFragment(item.identifier, '对话历史', 'history', message.role, message.content);
                }
                break;
            case MARKERS.jailbreak: {
                pushWorldbookBucket(item.identifier, buckets?.an_top);
                // forbid_overrides 条目不允许角色卡 post_history_instructions 覆盖。
                const override = entry?.forbidOverrides ? '' : character?.postHistoryInstructions?.trim();
                const content = override || entry?.content || '';
                pushFragment(item.identifier, entry?.name ?? '越狱', 'preset', entry?.role ?? 'system', content);
                pushWorldbookBucket(item.identifier, buckets?.an_bottom);
                break;
            }
            default: {
                if (!entry) {
                    if (!KNOWN_MARKERS.has(item.identifier)) {
                        trace.warnings.push(`预设引用了未知提示词「${item.identifier}」，已跳过。`);
                    }
                    break;
                }
                if (entry.injectionPosition === 1) break;
                pushFragment(item.identifier, entry.name, 'preset', entry.role, entry.content);
                break;
            }
        }
    }

    const personaInOrder = order.some(item => item.enabled && item.identifier === MARKERS.personaDescription);
    if (!personaInOrder && input.personaDescription?.trim()) {
        // ST：顺序里没有 personaDescription 标记时，追加到集合末尾（而不是最前）。
        fragments.push({
            identifier: 'personaDescription',
            label: '用户设定',
            sourceKind: 'persona',
            role: 'system',
            content: input.personaDescription
        });
    }

    for (const entry of buckets?.outlet ?? []) {
        pushFragment('outlet', entry.comment ?? String(entry.uid ?? 'outlet'), 'worldbook', entry.insertion.role ?? 'system', resolveWorldbookContent(entry));
    }

    const messages: CleanedMessage[] = [];
    const messageSourceKinds: RoleplayPromptSourceKind[] = [];
    for (const fragment of fragments) {
        const resolved = resolveMacros(fragment.content, baseContext);
        trace.warnings.push(...resolved.trace.warnings);
        trace.usedMacros.push(...resolved.trace.usedMacros);
        if (!resolved.text.trim()) continue;
        const index = messages.length;
        messages.push({ role: fragment.role, content: resolved.text });
        messageSourceKinds.push(fragment.sourceKind);
        trace.entries.push({
            identifier: fragment.identifier,
            label: fragment.label,
            sourceKind: fragment.sourceKind,
            outputMessageIndex: index,
            rawLength: fragment.content.length,
            finalLength: resolved.text.length
        });
    }

    if (input.preset?.behavior.assistantPrefill?.trim()) {
        const prefill = resolveMacros(input.preset.behavior.assistantPrefill, baseContext);
        if (prefill.text.trim()) {
            trace.entries.push({
                identifier: PREFILL_IDENTIFIER,
                label: 'assistant prefill',
                sourceKind: 'preset',
                outputMessageIndex: messages.length,
                rawLength: input.preset.behavior.assistantPrefill.length,
                finalLength: prefill.text.length
            });
            messages.push({ role: 'assistant', content: prefill.text });
            messageSourceKinds.push('preset');
        }
    }

    const maxContext = input.preset?.sampling.maxContext ?? 0;
    const budget = trimMessagesToContextBudget(
        messages,
        messageSourceKinds,
        maxContext,
        input.estimateTokens
    );
    if (budget.droppedHistory > 0) {
        const remap = new Map(budget.keptIndices.map((original, next) => [original, next]));
        trace.entries = trace.entries
            .filter(entry => remap.has(entry.outputMessageIndex))
            .map(entry => ({ ...entry, outputMessageIndex: remap.get(entry.outputMessageIndex)! }));
    }
    if (maxContext > 0) {
        trace.budget = {
            maxContext,
            usedTokens: budget.usedTokens,
            droppedHistory: budget.droppedHistory
        };
    }
    if (budget.droppedHistory > 0) {
        trace.warnings.push(`上下文预算裁剪：丢弃 ${budget.droppedHistory} 条最早的历史消息。`);
    }

    trace.usedMacros = Array.from(new Set(trace.usedMacros));
    return {
        messages: budget.messages,
        settings: toSettings(input.preset),
        trace
    };
};
