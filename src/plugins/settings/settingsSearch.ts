import type { SettingsCategoryId } from '../../types/plugin.js';
import {
    SETTINGS_CATEGORIES,
    getSettingsCategory,
    type SettingsCategoryIndex,
    type SettingsPanelDefinition
} from './settingsTaxonomy.js';

export interface SettingsSearchDocument {
    id: string;
    kind: 'setting' | 'panel';
    categoryId: SettingsCategoryId;
    /** 分类页内用于滚动定位与高亮的 data-setting-anchor 值 */
    anchor: string;
    title: string;
    /** 结果副标题：分类 · 分组 */
    context: string;
    description: string;
    optionLabels: string[];
    keywords: string[];
}

export interface SettingsSearchResult extends SettingsSearchDocument {
    rank: number;
}

export const normalizeSettingsQuery = (value: string): string =>
    value.trim().replace(/\s+/g, ' ').toLowerCase();

const resolveOptionLabels = (options: SettingsCategoryIndex[SettingsCategoryId][number]['definition']['options']): string[] => {
    if (!options) return [];
    const list = typeof options === 'function' ? options() : options;
    return list.map(option => option.label);
};

export const buildSettingsSearchDocuments = (
    index: SettingsCategoryIndex,
    panels: readonly SettingsPanelDefinition[]
): SettingsSearchDocument[] => {
    const documents: SettingsSearchDocument[] = [];
    SETTINGS_CATEGORIES.forEach(category => {
        index[category.id].forEach(setting => {
            documents.push({
                id: `setting:${setting.storageKey}`,
                kind: 'setting',
                categoryId: category.id,
                anchor: setting.storageKey,
                title: setting.definition.label,
                context: `${category.label} · ${setting.group}`,
                description: setting.definition.description ?? '',
                optionLabels: resolveOptionLabels(setting.definition.options),
                keywords: setting.definition.keywords ?? []
            });
        });
    });
    panels.forEach(panel => {
        documents.push({
            id: `panel:${panel.id}`,
            kind: 'panel',
            categoryId: panel.category,
            anchor: `panel:${panel.id}`,
            title: panel.title,
            context: getSettingsCategory(panel.category).label,
            description: panel.description,
            optionLabels: [],
            keywords: panel.keywords
        });
    });
    return documents;
};

const includes = (value: string, query: string): boolean => value.toLowerCase().includes(query);

/** 0 标题前缀，1 标题包含，2 关键词，3 描述或选项，4 分类名；不匹配返回 null */
const rankDocument = (document: SettingsSearchDocument, query: string): number | null => {
    const title = document.title.toLowerCase();
    if (title.startsWith(query)) return 0;
    if (title.includes(query)) return 1;
    if (document.keywords.some(keyword => includes(keyword, query))) return 2;
    if (includes(document.description, query) || document.optionLabels.some(label => includes(label, query))) return 3;
    if (includes(getSettingsCategory(document.categoryId).label, query)) return 4;
    return null;
};

export const searchSettings = (
    documents: readonly SettingsSearchDocument[],
    rawQuery: string,
    limit = 30
): SettingsSearchResult[] => {
    const query = normalizeSettingsQuery(rawQuery);
    if (!query) return [];
    const results: SettingsSearchResult[] = [];
    documents.forEach(document => {
        const rank = rankDocument(document, query);
        if (rank !== null) results.push({ ...document, rank });
    });
    // Array.prototype.sort 是稳定排序，同级结果保持文档顺序（设置在面板之前）
    return results.sort((left, right) => left.rank - right.rank).slice(0, limit);
};
