/**
 * ForgeTestChatPromptBuilder
 *
 * 纯函数，负责将预设配置 + 虚拟世界书条目 + 对话历史
 * 组装为 CleanedMessage[]，直接送入 LuminaGenerationTask。
 *
 * 支持两种合成模式：
 * - custom：使用 ForgeTestChatPreset 的 promptEntries 自定义组合
 * - st_preset：使用 ST 当前预设的 prompts 列表合成
 *
 * 设计原则：
 * - 无副作用，无 Vue 响应式依赖
 * - 空内容自动跳过，不注入空 system 消息
 * - 世界书格式参考 ArcTavern worldInfo 注入风格
 *
 * ST 预设宏处理策略：
 * - 占位符 ID（worldInfoBefore / chatHistory 等）由测试聊天自有数据解析
 * - 普通 prompt 的 content 通过 STClient.substituteMacros 替换宏
 *   但 {{worldinfo}}、{{wiBefore}}、{{wiAfter}} 等世界书相关宏
 *   会被替换为测试聊天自己的虚拟世界书内容
 */

import { EnvDetector } from './EnvDetector.js';
import { STClient } from './st-adapter/STClient.js';
import type { CleanedMessage } from '../../types/nexus.js';
import type { ForgeVirtualLorebookEntry } from '../../types/SessionTypes.js';
import type {
    ForgeTestChatPreset,
    ForgeTestChatCharCard,
    ForgeTestChatPromptEntry
} from '../../types/ForgeTestChatTypes.js';

export interface BuildTestChatOptions {
    preset: ForgeTestChatPreset;
    virtualLorebookEntries: ForgeVirtualLorebookEntry[];
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    workspaceTitle?: string;
}

export interface BuildSTPresetOptions {
    stPreset: Record<string, any>;
    virtualLorebookEntries: ForgeVirtualLorebookEntry[];
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    workspaceTitle?: string;
}

// ──────────────────────────────────────────────
// 角色卡读取
// ──────────────────────────────────────────────

function resolveCharCard(preset: ForgeTestChatPreset): Partial<ForgeTestChatCharCard> | null {
    if (preset.charCardMode === 'none') return null;

    if (preset.charCardMode === 'custom') {
        return preset.customCharCard ?? null;
    }

    return resolveCharCardFromST();
}

function resolveCharCardFromST(): Partial<ForgeTestChatCharCard> | null {
    try {
        const ctx = EnvDetector.ctx as any;
        if (!ctx) return null;
        const charId = ctx.characterId;
        const char = ctx.characters?.[charId];
        const data = char?.data ?? char;
        if (!data) return null;
        return {
            name: data.name ?? char?.name ?? '',
            description: data.description ?? '',
            personality: data.personality ?? '',
            scenario: data.scenario ?? '',
            systemPrompt: data.system_prompt ?? data.systemPrompt ?? ''
        };
    } catch {
        return null;
    }
}

// ──────────────────────────────────────────────
// 世界书格式化
// ──────────────────────────────────────────────

function formatWorldInfo(entries: ForgeVirtualLorebookEntry[]): string {
    const activeEntries = entries
        .filter(e => !e.entry.disable && e.entry.content?.trim())
        .sort((a, b) => (a.entry.order ?? 0) - (b.entry.order ?? 0));

    if (activeEntries.length === 0) return '';

    const lines = activeEntries.map(e => {
        const title = e.entry.comment?.trim() || e.id;
        return `### ${title}\n${e.entry.content.trim()}`;
    });

    return `## 世界设定\n\n${lines.join('\n\n')}`;
}

// ──────────────────────────────────────────────
// 槽位内容解析（custom 模式）
// ──────────────────────────────────────────────

function resolveSlotContent(
    entry: ForgeTestChatPromptEntry,
    charCard: Partial<ForgeTestChatCharCard> | null,
    worldInfoText: string
): CleanedMessage | null {
    if (!entry.enabled) return null;

    if (entry.type === 'custom') {
        const content = entry.prompt.content.trim();
        if (!content) return null;
        return { role: entry.prompt.role, content };
    }

    // type === 'slot'
    if (entry.slot === 'chat_history') {
        return null;
    }

    if (entry.slot === 'world_info') {
        if (!worldInfoText) return null;
        return { role: 'system', content: worldInfoText };
    }

    if (!charCard) return null;

    let content = '';
    switch (entry.slot) {
        case 'char_system_prompt':
            content = charCard.systemPrompt?.trim() ?? '';
            break;
        case 'char_description':
            content = charCard.description?.trim() ?? '';
            break;
        case 'char_personality':
            content = charCard.personality?.trim() ?? '';
            break;
        case 'scenario':
            content = charCard.scenario?.trim() ?? '';
            break;
    }

    if (!content) return null;
    return { role: 'system', content };
}

// ──────────────────────────────────────────────
// ST 预设占位符解析
// ──────────────────────────────────────────────

const ST_PLACEHOLDER_IDS = new Set([
    'worldInfoBefore',
    'personaDescription',
    'charDescription',
    'charPersonality',
    'scenario',
    'worldInfoAfter',
    'dialogueExamples',
    'chatHistory',
]);

function resolveSTPlaceholderContent(
    promptId: string,
    charCard: Partial<ForgeTestChatCharCard> | null,
    worldInfoText: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): CleanedMessage[] | null {
    switch (promptId) {
        case 'chatHistory':
            if (conversationHistory.length === 0) return null;
            return conversationHistory.map(m => ({ role: m.role, content: m.content }));

        case 'worldInfoBefore':
        case 'worldInfoAfter':
            if (!worldInfoText) return null;
            return [{ role: 'system' as const, content: worldInfoText }];

        case 'charDescription':
            if (!charCard?.description?.trim()) return null;
            return [{ role: 'system' as const, content: charCard.description.trim() }];

        case 'charPersonality':
            if (!charCard?.personality?.trim()) return null;
            return [{ role: 'system' as const, content: charCard.personality.trim() }];

        case 'scenario':
            if (!charCard?.scenario?.trim()) return null;
            return [{ role: 'system' as const, content: charCard.scenario.trim() }];

        case 'personaDescription': {
            try {
                const st = EnvDetector.stMain as any;
                const personaDesc = st?.powerUserSettings?.persona?.description ?? '';
                if (!personaDesc.trim()) return null;
                return [{ role: 'system' as const, content: personaDesc.trim() }];
            } catch {
                return null;
            }
        }

        case 'dialogueExamples': {
            try {
                const ctx = EnvDetector.ctx as any;
                const charId = ctx?.characterId;
                const char = ctx?.characters?.[charId];
                const data = char?.data ?? char;
                const examples = data?.mes_example ?? '';
                if (!examples.trim()) return null;
                return [{ role: 'system' as const, content: examples.trim() }];
            } catch {
                return null;
            }
        }

        default:
            return null;
    }
}

// ──────────────────────────────────────────────
// ST 预设宏替换
// ──────────────────────────────────────────────

const WI_MACRO_PATTERN = /\{\{(worldinfo|wiBefore|wiAfter|loreBefore|loreAfter)\}\}/gi;

function substituteSTPresetMacros(
    content: string,
    worldInfoText: string,
): string {
    let result = content;

    if (worldInfoText) {
        result = result.replace(WI_MACRO_PATTERN, worldInfoText);
    } else {
        result = result.replace(WI_MACRO_PATTERN, '');
    }

    result = STClient.substituteMacros(result);

    return result;
}

// ──────────────────────────────────────────────
// ST 变量隔离（防止 setvar/addvar 污染当前聊天）
// ──────────────────────────────────────────────

interface VariableSnapshot {
    local: Record<string, any>;
    global: Record<string, any>;
}

function snapshotVariables(): VariableSnapshot {
    const glob = EnvDetector.stGlobal;
    const localVars = glob?.chat_metadata?.variables;
    const globalVars = glob?.extension_settings?.variables?.global;
    return {
        local: localVars ? JSON.parse(JSON.stringify(localVars)) : {},
        global: globalVars ? JSON.parse(JSON.stringify(globalVars)) : {},
    };
}

function restoreVariables(snapshot: VariableSnapshot): void {
    const glob = EnvDetector.stGlobal;
    if (!glob) return;

    const chatMeta = glob.chat_metadata;
    if (chatMeta) {
        chatMeta.variables = JSON.parse(JSON.stringify(snapshot.local));
    }

    const extSettings = glob.extension_settings;
    if (extSettings?.variables) {
        extSettings.variables.global = JSON.parse(JSON.stringify(snapshot.global));
    }
}

// ──────────────────────────────────────────────
// custom 模式主函数
// ──────────────────────────────────────────────

export function buildTestChatMessages(options: BuildTestChatOptions): CleanedMessage[] {
    const { preset, virtualLorebookEntries, conversationHistory } = options;

    const charCard = resolveCharCard(preset);
    const worldInfoText = formatWorldInfo(virtualLorebookEntries);

    const messages: CleanedMessage[] = [];

    for (const entry of preset.promptEntries) {
        if (entry.type === 'slot' && entry.slot === 'chat_history') {
            for (const msg of conversationHistory) {
                messages.push({ role: msg.role, content: msg.content });
            }
            continue;
        }

        const msg = resolveSlotContent(entry, charCard, worldInfoText);
        if (msg) messages.push(msg);
    }

    const hasChatHistorySlot = preset.promptEntries.some(
        e => e.type === 'slot' && e.slot === 'chat_history' && e.enabled
    );
    if (!hasChatHistorySlot) {
        for (const msg of conversationHistory) {
            messages.push({ role: msg.role, content: msg.content });
        }
    }

    return messages;
}

// ──────────────────────────────────────────────
// st_preset 模式主函数
// ──────────────────────────────────────────────

export function buildSTPresetMessages(options: BuildSTPresetOptions): CleanedMessage[] {
    const { stPreset, virtualLorebookEntries, conversationHistory } = options;

    const prompts: Array<Record<string, any>> = Array.isArray(stPreset.prompts) ? stPreset.prompts : [];
    const charCard = resolveCharCardFromST();
    const worldInfoText = formatWorldInfo(virtualLorebookEntries);

    const varSnapshot = snapshotVariables();

    const messages: CleanedMessage[] = [];
    const inChatBuffer: Array<{ order: number; depth: number; msgs: CleanedMessage[] }> = [];
    let chatHistoryInserted = false;

    try {
        for (const prompt of prompts) {
            if (!prompt.enabled) continue;

            const promptId = String(prompt.id ?? '');
            const isPlaceholder = ST_PLACEHOLDER_IDS.has(promptId);

            if (isPlaceholder) {
                const resolved = resolveSTPlaceholderContent(
                    promptId, charCard, worldInfoText, conversationHistory
                );
                if (!resolved || resolved.length === 0) continue;

                if (promptId === 'chatHistory') {
                    chatHistoryInserted = true;
                }

                const pos = prompt.position;
                if (pos && pos.type === 'in_chat' && typeof pos.depth === 'number') {
                    inChatBuffer.push({
                        order: pos.order ?? 0,
                        depth: pos.depth,
                        msgs: resolved
                    });
                } else {
                    messages.push(...resolved);
                }
                continue;
            }

            const rawContent = String(prompt.content ?? '').trim();
            if (!rawContent) continue;

            const content = substituteSTPresetMacros(rawContent, worldInfoText);
            if (!content.trim()) continue;

            const role = String(prompt.role ?? 'system') as CleanedMessage['role'];
            const pos = prompt.position;

            if (pos && pos.type === 'in_chat' && typeof pos.depth === 'number') {
                inChatBuffer.push({
                    order: pos.order ?? 0,
                    depth: pos.depth,
                    msgs: [{ role, content }]
                });
            } else {
                messages.push({ role, content });
            }
        }

        if (!chatHistoryInserted && conversationHistory.length > 0) {
            for (const msg of conversationHistory) {
                messages.push({ role: msg.role, content: msg.content });
            }
        }

        if (inChatBuffer.length > 0) {
            inChatBuffer.sort((a, b) => a.depth - b.depth || a.order - b.order);
            for (const item of inChatBuffer) {
                const insertIdx = Math.max(0, messages.length - item.depth);
                messages.splice(insertIdx, 0, ...item.msgs);
            }
        }
    } finally {
        restoreVariables(varSnapshot);
    }

    return messages;
}
