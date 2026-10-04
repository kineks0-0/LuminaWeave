import type { CleanedMessage } from '../../../../types/nexus.js';
import type { ResourceDiagnostic } from '@shared/resources/index.js';
import {
    ST_DEFAULT_CHARACTER_ID,
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
    personaDescription?: string;
    userName?: string;
    charName?: string;
    worldbookActivation?: PromptWorldbookActivationSnapshot | null;
    regexScripts?: RegexScript[];
    variables: MacroVariableView;
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

interface OrderedPrompt {
    identifier: string;
    enabled: boolean;
}

const resolveOrder = (preset: ChatCompletionPreset | null): OrderedPrompt[] => {
    if (!preset) {
        return DEFAULT_MARKER_ORDER.map(identifier => ({ identifier, enabled: true }));
    }
    const group = preset.promptOrder.find(item => item.characterId === ST_DEFAULT_CHARACTER_ID)
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
        regexApplied: []
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
    const order = resolveOrder(input.preset);
    const enabledIdentifiers = resolveEnabledIdentifiers(order);

    const presetDepthInjections = (input.preset?.prompts ?? []).filter(entry =>
        enabledIdentifiers.has(entry.identifier) && entry.injectionPosition === 1
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
        const result = [...regexedHistory];
        const worldbookDepth = [...(buckets?.at_depth ?? [])]
            .sort((left, right) => (right.depth ?? 0) - (left.depth ?? 0) || (left.order ?? 0) - (right.order ?? 0));
        const injects = [
            ...worldbookDepth.map(entry => ({
                depth: Math.max(0, Number(entry.insertion.depth ?? entry.depth ?? 0)),
                order: Number(entry.order ?? 0),
                role: (entry.insertion.role ?? entry.role ?? 'system') as CleanedMessage['role'],
                content: resolveWorldbookContent(entry)
            })),
            ...depthInjections
        ].sort((left, right) => right.depth - left.depth || left.order - right.order);
        for (const inject of injects) {
            const index = Math.max(0, result.length - inject.depth);
            result.splice(index, 0, { role: inject.role, content: inject.content });
        }
        return result;
    };
    const historyMessages = resolveHistory();

    for (const item of order) {
        if (!item.enabled) continue;
        const entry = entryById.get(item.identifier) ?? null;
        const character = input.character ?? null;

        switch (item.identifier) {
            case MARKERS.worldInfoBefore:
                pushWorldbookBucket(item.identifier, buckets?.before);
                break;
            case MARKERS.worldInfoAfter:
                pushWorldbookBucket(item.identifier, buckets?.after);
                break;
            case MARKERS.main: {
                const override = character?.systemPrompt?.trim();
                const content = override || entry?.content || '';
                pushFragment(item.identifier, entry?.name ?? '主提示词', 'preset', entry?.role ?? 'system', content);
                break;
            }
            case MARKERS.charDescription:
                pushFragment(item.identifier, '角色描述', 'character', entry?.role ?? 'system', character?.description || entry?.content || '');
                break;
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
                const override = character?.postHistoryInstructions?.trim();
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

    for (const entry of buckets?.outlet ?? []) {
        pushFragment('outlet', entry.comment ?? String(entry.uid ?? 'outlet'), 'worldbook', entry.insertion.role ?? 'system', resolveWorldbookContent(entry));
    }

    if (input.personaDescription?.trim()) {
        fragments.unshift({
            identifier: 'personaDescription',
            label: '用户设定',
            sourceKind: 'persona',
            role: 'system',
            content: input.personaDescription
        });
    }

    const messages: CleanedMessage[] = [];
    for (const fragment of fragments) {
        const resolved = resolveMacros(fragment.content, baseContext);
        trace.warnings.push(...resolved.trace.warnings);
        trace.usedMacros.push(...resolved.trace.usedMacros);
        if (!resolved.text.trim()) continue;
        const index = messages.length;
        messages.push({ role: fragment.role, content: resolved.text });
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
        }
    }

    trace.usedMacros = Array.from(new Set(trace.usedMacros));
    return {
        messages,
        settings: toSettings(input.preset),
        trace
    };
};
