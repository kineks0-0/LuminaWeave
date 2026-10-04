import { CoreXMLTagNames, globalXMLTagRegistry, type LifecycleType } from '@shared/XMLTagRegistry.js';

/**
 * 内置标签过滤规则（`[Lumina] Tag Filter`）的纯构建逻辑。
 *
 * 与 `RegexSyncService` 同步到 ST 的全局正则同源：
 * transient / ephemeral / persistent 标签（排除 Chat_Reply 与 presentational 展示型标签）
 * 在显示与写回文本中整体剔除；未闭合标签从开标签起剔除到文本末尾。
 * 消息净化面板用它只读展示规则内容。
 */

export const TAG_FILTER_RULE_NAME = '[Lumina] Tag Filter';

export const TAG_FILTER_LIFECYCLES: readonly LifecycleType[] = ['transient', 'ephemeral', 'persistent'];

/** 需要从显示 / 写回文本中剔除的标签（保留正文与展示型容器）。 */
export const resolveTagFilterTags = (): string[] => {
    const chatReply = CoreXMLTagNames.CHAT_REPLY.toLowerCase();
    return globalXMLTagRegistry.getAllDefinitions()
        .filter(definition => TAG_FILTER_LIFECYCLES.includes(definition.lifecycle))
        .map(definition => definition.tag)
        .filter(tag => tag.toLowerCase() !== chatReply);
};

/** ST 兼容的 find_regex 字符串。 */
export const buildTagFilterRegex = (tags: readonly string[]): string => {
    const parts = tags.map(tag => `<${tag}\\b[^>]*?>(?:[\\s\\S]*?)<\\/${tag}>|<${tag}\\b[^>]*?>(?:[\\s\\S]*?)$`);
    return `/(?:${parts.join('|')})/gisu`;
};
