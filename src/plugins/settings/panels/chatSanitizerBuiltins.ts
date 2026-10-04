import { CoreXMLTagNames, globalXMLTagRegistry, type XMLTagDefinition } from '@shared/XMLTagRegistry.js';
import { settingsDomainService } from '../../../api/services/SettingsDomainService.js';

/**
 * 「消息净化」面板内置处理区的只读视图模型。
 *
 * 标签过滤由 XML 拦截器按标签注册表的生命周期执行，这里只做展示映射，
 * 不提供编辑入口；回复过滤开关仍由「对话与流式 › 回复过滤」管理。
 */

export type BuiltinTagDisposition =
    | 'hide-content'
    | 'hidden-from-ui'
    | 'keep-content'
    | 'preserve'
    | 'body';

export interface BuiltinTagRule {
    tag: string;
    aliases: string[];
    description: string;
    disposition: BuiltinTagDisposition;
    dispositionLabel: string;
}

export interface BuiltinReplyFilterState {
    enabled: boolean;
    allowTopLevel: boolean;
    implicitThinking: boolean;
    aggressiveThinking: boolean;
}

export type BuiltinSettingReader = (key: string, fallback: unknown) => unknown;

const DISPOSITION_LABELS: Record<BuiltinTagDisposition, string> = {
    'hide-content': '内容隐藏',
    'hidden-from-ui': '内容保留 · 显示隐藏',
    'keep-content': '剥标签留正文',
    preserve: '原样保留',
    body: '可见正文'
};

const DISPOSITION_RANK: Record<BuiltinTagDisposition, number> = {
    'hide-content': 0,
    'hidden-from-ui': 1,
    'keep-content': 2,
    preserve: 3,
    body: 4
};

const CHAT_PROMPT_CONTEXTS = new Set(['chat', 'shared']);

const defaultRead: BuiltinSettingReader = (key, fallback) => settingsDomainService.getGlobalValue(key, fallback);

const matchesChatContext = (definition: XMLTagDefinition): boolean => {
    const contexts = definition.promptContexts && definition.promptContexts.length > 0
        ? definition.promptContexts
        : ['chat'];
    return contexts.some(context => CHAT_PROMPT_CONTEXTS.has(context));
};

const resolveDisposition = (definition: XMLTagDefinition): BuiltinTagDisposition => {
    if (definition.tag === CoreXMLTagNames.CHAT_REPLY) return 'body';
    if (definition.lifecycle === 'presentational') return 'preserve';
    if (definition.lifecycle === 'transient' || definition.lifecycle === 'ephemeral') return 'hide-content';
    return definition.uiHidden ? 'hidden-from-ui' : 'keep-content';
};

export const listBuiltinTagRules = (): BuiltinTagRule[] => globalXMLTagRegistry
    .getAllDefinitions()
    .filter(matchesChatContext)
    .map(definition => {
        const disposition = resolveDisposition(definition);
        return {
            tag: definition.tag,
            aliases: [...(definition.aliases ?? [])],
            description: definition.description ?? '',
            disposition,
            dispositionLabel: DISPOSITION_LABELS[disposition]
        };
    })
    .sort((left, right) => {
        const rank = DISPOSITION_RANK[left.disposition] - DISPOSITION_RANK[right.disposition];
        return rank !== 0 ? rank : left.tag.localeCompare(right.tag);
    });

export const resolveReplyFilterState = (
    read: BuiltinSettingReader = defaultRead
): BuiltinReplyFilterState => ({
    enabled: Boolean(read('lumina-chat.filterChatReply', false)),
    allowTopLevel: Boolean(read('lumina-chat.allowTopLevelInFilter', true)),
    implicitThinking: Boolean(read('lumina-chat.implicitThinkingInFilter', false)),
    aggressiveThinking: Boolean(read('lumina-chat.aggressiveThinking', false))
});
