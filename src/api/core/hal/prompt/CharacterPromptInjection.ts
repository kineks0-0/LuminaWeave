import type { CleanedMessage } from '../../../../types/nexus.js';
import type { PromptPresetCharCard } from '../../../../types/PromptPresetTypes.js';
import { resolveCharacterMacros } from '@shared/resources/index.js';
import {
    luminaWorldbookTriggerEngine,
    type LuminaWorldbookActivatedEntry,
    type LuminaWorldbookInsertionPosition
} from '../resource/index.js';
import { worldbookMessageFor } from './PromptUtils.js';

export type CharacterPromptSourceKind = 'character' | 'persona' | 'worldbook';

export interface CharacterPromptTraceEntry {
    sourceKind: CharacterPromptSourceKind;
    label: string;
    outputMessageIndex: number;
    rawLength: number;
    finalLength: number;
}

export interface CharacterPromptInjectionInput {
    messages: CleanedMessage[];
    charCard: PromptPresetCharCard | null;
    personaDescription?: string | null;
    worldbookEntries?: LuminaLorebookEntry[];
    userName?: string | null;
    charName?: string | null;
}

export interface CharacterPromptInjectionResult {
    messages: CleanedMessage[];
    trace: CharacterPromptTraceEntry[];
}

const trimText = (value: string | null | undefined): string =>
    typeof value === 'string' ? value.trim() : '';

const section = (title: string, content: string): string | null =>
    content ? `## ${title}\n${content}` : null;

export const buildCharacterCardSystemMessage = (
    charCard: PromptPresetCharCard | null,
    charName?: string | null
): string | null => {
    if (!charCard) return null;

    const name = trimText(charCard.name) || trimText(charName);
    const blocks = [
        name ? `# 角色卡\n名称：${name}` : '# 角色卡',
        section('角色描述', trimText(charCard.description)),
        section('性格', trimText(charCard.personality)),
        section('场景', trimText(charCard.scenario)),
        section('系统指令', trimText(charCard.systemPrompt))
    ].filter((block): block is string => Boolean(block));

    return blocks.length > 1 ? blocks.join('\n\n') : null;
};

export const buildPersonaSystemMessage = (personaDescription?: string | null): string | null => {
    const content = trimText(personaDescription);
    return content ? `# 用户设定\n${content}` : null;
};

const collectBucket = (
    buckets: Partial<Record<LuminaWorldbookInsertionPosition, LuminaWorldbookActivatedEntry[]>>,
    positions: LuminaWorldbookInsertionPosition[]
): LuminaWorldbookActivatedEntry[] => positions
    .flatMap((position) => buckets[position] ?? [])
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

/**
 * 将本地角色卡、persona 描述与卡内 character_book 注入 Lumina 聊天生成提示词。
 * 纯函数：不做资源读取，只消费已解析的输入。
 */
export const injectCharacterPromptMessages = (
    input: CharacterPromptInjectionInput
): CharacterPromptInjectionResult => {
    const names = { userName: input.userName, charName: input.charName };
    const prefix: Array<{ kind: CharacterPromptSourceKind; label: string; raw: string; message: CleanedMessage }> = [];

    const append = (kind: CharacterPromptSourceKind, label: string, text: string | null): void => {
        const resolved = text ? resolveCharacterMacros(text, names) : '';
        if (!resolved.trim()) return;
        prefix.push({
            kind,
            label,
            raw: text ?? '',
            message: { role: 'system', content: resolved }
        });
    };

    append('persona', '用户设定', buildPersonaSystemMessage(input.personaDescription));
    append('character', trimText(input.charCard?.name) || '角色卡', buildCharacterCardSystemMessage(input.charCard, input.charName));

    const historyWithAtDepth = [...input.messages];
    let worldbookTraceLabel: string | null = null;
    let worldbookRawLength = 0;
    let worldbookFinalLength = 0;

    const entries = input.worldbookEntries ?? [];
    if (entries.length > 0) {
        const inputText = [...input.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
        const activation = luminaWorldbookTriggerEngine.resolve(entries, {
            messages: input.messages,
            inputText
        });

        const beforeEntries = collectBucket(activation.insertionBuckets, ['before', 'after', 'an_top', 'em_top', 'outlet']);
        const afterEntries = collectBucket(activation.insertionBuckets, ['an_bottom', 'em_bottom']);
        const atDepthEntries = [...(activation.insertionBuckets.at_depth ?? [])]
            .sort((left, right) => (right.depth ?? 0) - (left.depth ?? 0) || (left.order ?? 0) - (right.order ?? 0));

        for (const entry of beforeEntries) {
            const message = worldbookMessageFor(entry);
            const resolved = resolveCharacterMacros(message.content, names);
            prefix.push({
                kind: 'worldbook',
                label: entry.comment ?? String(entry.uid ?? 'worldbook'),
                raw: message.content,
                message: { ...message, content: resolved }
            });
        }
        for (const entry of atDepthEntries) {
            const message = worldbookMessageFor(entry);
            const depth = Math.max(0, Number(entry.insertion.depth ?? entry.depth ?? 0));
            const index = Math.max(0, historyWithAtDepth.length - depth);
            historyWithAtDepth.splice(index, 0, {
                ...message,
                content: resolveCharacterMacros(message.content, names)
            });
        }
        worldbookTraceLabel = `character_book (${activation.activatedEntries.length})`;
        worldbookRawLength = activation.activatedEntries.reduce((sum, entry) => sum + entry.content.length, 0);
        worldbookFinalLength = activation.activatedEntries.reduce(
            (sum, entry) => sum + resolveCharacterMacros(entry.content, names).length,
            0
        );
        for (const entry of afterEntries) {
            const message = worldbookMessageFor(entry);
            historyWithAtDepth.push({
                ...message,
                content: resolveCharacterMacros(message.content, names)
            });
        }
    }

    const messages: CleanedMessage[] = [
        ...prefix.map((item) => item.message),
        ...historyWithAtDepth
    ];

    const trace: CharacterPromptTraceEntry[] = prefix.map((item) => ({
        sourceKind: item.kind,
        label: item.label,
        outputMessageIndex: messages.indexOf(item.message),
        rawLength: item.raw.length,
        finalLength: item.message.content.length
    }));
    if (worldbookTraceLabel) {
        trace.push({
            sourceKind: 'worldbook',
            label: worldbookTraceLabel,
            outputMessageIndex: -1,
            rawLength: worldbookRawLength,
            finalLength: worldbookFinalLength
        });
    }

    return { messages, trace };
};
