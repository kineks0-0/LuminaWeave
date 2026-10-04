import type { CleanedMessage } from '../../../../types/nexus.js';
import { resolveCharacterCardSource } from '@shared/resources/index.js';

/**
 * 角色卡全字段投影：供聊天管线把 ST 角色卡字段映射到预设 slot / marker。
 *
 * 纯函数，不做宏展开（宏由 MacroRuntime 统一处理）；字段名兼容 v2/v3 的
 * `snake_case` 与部分卡片的 `camelCase` 写法。
 */

export interface CharacterDepthPrompt {
    prompt: string;
    depth: number;
    role: 'system' | 'user' | 'assistant';
    /** ST `extensions.depth_prompt.position` 原值，插入语义由管线解释。 */
    position: number;
}

export interface ChatCharacterFields {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    systemPrompt: string;
    postHistoryInstructions: string;
    dialogueExamples: string;
    depthPrompt: CharacterDepthPrompt | null;
    firstMessage: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const asRole = (value: unknown): 'system' | 'user' | 'assistant' => {
    if (value === 'user' || value === 'assistant') return value;
    return 'system';
};

const parseDepthPrompt = (source: Record<string, unknown>): CharacterDepthPrompt | null => {
    const extensions = asRecord(source.extensions);
    const raw = asRecord(extensions.depth_prompt);
    const prompt = asString(raw.prompt);
    if (!prompt) return null;
    const depth = Number(raw.depth);
    const position = Number(raw.position);
    return {
        prompt,
        depth: Number.isFinite(depth) ? depth : 4,
        role: asRole(raw.role),
        position: Number.isFinite(position) ? position : 0
    };
};

export const resolveCharacterFields = (raw: unknown): ChatCharacterFields => {
    const root = asRecord(raw);
    const source = resolveCharacterCardSource(root);
    return {
        name: asString(source.name) || asString(root.name),
        description: asString(source.description),
        personality: asString(source.personality),
        scenario: asString(source.scenario),
        systemPrompt: asString(source.system_prompt) || asString(source.systemPrompt),
        postHistoryInstructions: asString(source.post_history_instructions) || asString(source.postHistoryInstructions),
        dialogueExamples: asString(source.mes_example) || asString(source.mesExample),
        depthPrompt: parseDepthPrompt(source),
        firstMessage: asString(source.first_mes) || asString(source.firstMessage)
    };
};

export interface DialogueExampleNames {
    charName?: string;
    userName?: string;
}

interface PendingExampleMessage {
    role: 'user' | 'assistant';
    lines: string[];
}

const buildLabelSets = (names: DialogueExampleNames): { char: Set<string>; user: Set<string> } => {
    const char = new Set<string>(['{{char}}', 'char']);
    const user = new Set<string>(['{{user}}', 'user']);
    if (names.charName?.trim()) char.add(names.charName.trim().toLowerCase());
    if (names.userName?.trim()) user.add(names.userName.trim().toLowerCase());
    return { char, user };
};

/**
 * 解析 ST `mes_example`：
 * - 按行首 `<START>` 分块；
 * - 块内以 `{{user}}:` / `{{char}}:`（或字面名字）前缀切换说话人；
 * - 无前缀的块默认按角色发言（assistant）处理。
 *
 * ponytail: 无前缀块的默认角色是最小可用规则；金样对齐 ST 时如有差异再收紧。
 */
export const parseDialogueExamples = (
    text: string,
    names: DialogueExampleNames = {}
): CleanedMessage[] => {
    if (!text.trim()) return [];
    const labels = buildLabelSets(names);
    const blocks = text.split(/^<START>$/m).map(block => block.trim()).filter(Boolean);
    const messages: CleanedMessage[] = [];

    for (const block of blocks) {
        const blockMessages: PendingExampleMessage[] = [];
        let current: PendingExampleMessage | null = null;

        for (const line of block.split('\n')) {
            const match = /^([^\n:]{1,64}?)\s*:\s?([\s\S]*)$/.exec(line);
            const label = match ? match[1].trim().toLowerCase() : null;
            if (match && label && (labels.char.has(label) || labels.user.has(label))) {
                if (current) blockMessages.push(current);
                current = {
                    role: labels.char.has(label) ? 'assistant' : 'user',
                    lines: [match[2]]
                };
            } else if (current) {
                current.lines.push(line);
            } else {
                current = { role: 'assistant', lines: [line] };
            }
        }
        if (current) blockMessages.push(current);

        for (const message of blockMessages) {
            const content = message.lines.join('\n').trim();
            if (content) messages.push({ role: message.role, content });
        }
    }

    return messages;
};
