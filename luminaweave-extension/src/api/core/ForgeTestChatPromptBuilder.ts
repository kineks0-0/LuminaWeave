/**
 * ForgeTestChatPromptBuilder
 *
 * 纯函数，负责将预设配置 + 虚拟世界书条目 + 对话历史
 * 组装为 CleanedMessage[]，直接送入 LuminaGenerationTask。
 *
 * 设计原则：
 * - 无副作用，无 Vue 响应式依赖
 * - 空内容自动跳过，不注入空 system 消息
 * - 世界书格式参考 ArcTavern worldInfo 注入风格
 */

import { EnvDetector } from './EnvDetector.js';
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

// ──────────────────────────────────────────────
// 角色卡读取
// ──────────────────────────────────────────────

function resolveCharCard(preset: ForgeTestChatPreset): Partial<ForgeTestChatCharCard> | null {
    if (preset.charCardMode === 'none') return null;

    if (preset.charCardMode === 'custom') {
        return preset.customCharCard ?? null;
    }

    // from_st: 从 ST 上下文读取当前角色卡
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
// 槽位内容解析
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
        // chat_history 由调用方追加，此处跳过
        return null;
    }

    if (entry.slot === 'world_info') {
        if (!worldInfoText) return null;
        return { role: 'system', content: worldInfoText };
    }

    // 角色卡相关槽位
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
// 主函数
// ──────────────────────────────────────────────

export function buildTestChatMessages(options: BuildTestChatOptions): CleanedMessage[] {
    const { preset, virtualLorebookEntries, conversationHistory } = options;

    const charCard = resolveCharCard(preset);
    const worldInfoText = formatWorldInfo(virtualLorebookEntries);

    const messages: CleanedMessage[] = [];

    for (const entry of preset.promptEntries) {
        if (entry.type === 'slot' && entry.slot === 'chat_history') {
            // chat_history 槽位：追加对话历史后继续
            for (const msg of conversationHistory) {
                messages.push({ role: msg.role, content: msg.content });
            }
            continue;
        }

        const msg = resolveSlotContent(entry, charCard, worldInfoText);
        if (msg) messages.push(msg);
    }

    // 若预设中没有 chat_history 槽位，兜底追加（确保对话始终可用）
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
