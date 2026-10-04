import { CoreXMLTagNames, globalXMLTagRegistry, type XMLTagDefinition } from '@shared/XMLTagRegistry.js';
import { settingsDomainService } from '../../../api/services/SettingsDomainService.js';
import { getCachedRegexScripts } from '../../../api/core/hal/regex/LuminaRegexAssetCache.js';
import {
    readBoundRegexOverrides,
    resolveBoundRegexEnabled,
    type BoundRegexOverride
} from '../../../api/core/hal/regex/BoundRegexOverrideStore.js';
import {
    buildTagFilterRegex,
    resolveTagFilterTags,
    TAG_FILTER_RULE_NAME
} from '../../../api/core/hal/regex/TagFilterPattern.js';
import type { RegexPlacement } from '../../../types/RegexScriptTypes.js';

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

export interface BuiltinTagFilterRule {
    /** ST 宿主同步的全局规则名。 */
    name: string;
    tags: string[];
    pattern: string;
}

/** 内置标签过滤规则内容（与 `RegexSyncService` 同步的 find_regex 同源）。 */
export const resolveBuiltinTagFilterRule = (): BuiltinTagFilterRule => {
    const tags = resolveTagFilterTags();
    return {
        name: TAG_FILTER_RULE_NAME,
        tags,
        pattern: buildTagFilterRegex(tags)
    };
};

export type BoundRegexSource = 'preset' | 'character';

export interface BoundRegexRule {
    id: string;
    name: string;
    source: BoundRegexSource;
    sourceLabel: string;
    /** 资产原始 `enabled`。 */
    sourceEnabled: boolean;
    /** 本机覆盖（`lumina-chat.boundRegexOverrides`）；无覆盖时跟随来源。 */
    override: BoundRegexOverride | null;
    /** 实际是否参与执行。 */
    effectiveEnabled: boolean;
    placement: RegexPlacement[];
}

/**
 * 预设 / 角色卡绑定正则的只读视图（含本机启用/禁用覆盖）。
 * 与显示层同源（`LuminaRegexAssetCache`），按 预设 → 角色卡 顺序、同 id 去重；
 * 同 id 时预设优先，与 `LuminaRegexDisplayService` 的应用顺序一致。
 */
export const listBoundRegexRules = (): BoundRegexRule[] => {
    const cached = getCachedRegexScripts();
    const overrides = readBoundRegexOverrides();
    const seen = new Set<string>();
    const rules: BoundRegexRule[] = [];

    const append = (scripts: typeof cached.presetScripts, source: BoundRegexSource, label: string): void => {
        scripts.forEach(script => {
            if (seen.has(script.id)) return;
            seen.add(script.id);
            rules.push({
                id: script.id,
                name: script.scriptName || '未命名脚本',
                source,
                sourceLabel: label,
                sourceEnabled: script.enabled,
                override: overrides[script.id] ?? null,
                effectiveEnabled: resolveBoundRegexEnabled(script.id, script.enabled, overrides),
                placement: [...script.placement]
            });
        });
    };

    append(cached.presetScripts, 'preset', cached.presetName ? `预设「${cached.presetName}」` : '预设');
    append(cached.characterScripts, 'character', cached.characterName ? `角色卡「${cached.characterName}」` : '角色卡');
    return rules;
};
