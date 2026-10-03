import { describe, expect, it } from 'vitest';
import type { SettingDefinition } from '../../../types/plugin.js';
import {
    DEFAULT_SETTINGS_CATEGORY,
    OVERVIEW_SETTING_KEYS,
    SETTINGS_CATEGORIES,
    SETTINGS_PANELS,
    buildSettingsCategoryIndex,
    groupCategorySettings,
    isSettingsCategoryId,
    resolvePluginComponentCategory,
    resolveSettingCategory,
    resolveSettingsView,
    type SettingsSourceDescriptor
} from '../settingsTaxonomy.js';

const definition = (overrides: Partial<SettingDefinition> = {}): SettingDefinition => ({
    default: false,
    label: '测试',
    type: 'boolean',
    ...overrides
});

const pluginSource = (
    pluginId: string,
    manifest: Record<string, SettingDefinition>,
    overrides: Partial<SettingsSourceDescriptor> = {}
): SettingsSourceDescriptor => ({
    pluginId,
    pluginName: pluginId,
    kind: 'plugin',
    manifest,
    hasPluginComponent: false,
    ...overrides
});

describe('settingsTaxonomy', () => {
    it('declares seven task categories with unique ids', () => {
        const ids = SETTINGS_CATEGORIES.map(category => category.id);
        expect(ids).toEqual(['appearance', 'conversation', 'generation', 'context', 'workshop', 'storage', 'advanced']);
        expect(new Set(ids).size).toBe(ids.length);
        expect(DEFAULT_SETTINGS_CATEGORY).toBe('advanced');
        expect(isSettingsCategoryId('workshop')).toBe(true);
        expect(isSettingsCategoryId('lumina-forge')).toBe(false);
    });

    it('routes desktop mode settings to appearance and unknown categories to advanced', () => {
        const desktopMode = pluginSource('desktop-mode:telegram', {}, { kind: 'desktop-mode', pluginName: 'Telegram' });
        const thirdParty = pluginSource('acme-plugin', {});

        expect(resolveSettingCategory(desktopMode, definition({ category: 'context' }))).toBe('appearance');
        expect(resolveSettingCategory(thirdParty, definition({ category: 'generation' }))).toBe('generation');
        expect(resolveSettingCategory(thirdParty, definition())).toBe('advanced');
    });

    it('puts every setting in exactly one category, grouped in declaration order', () => {
        const chat = pluginSource('lumina-chat', {
            streamingEffect: definition({ category: 'conversation', group: '流式显示' }),
            filterChatReply: definition({ category: 'conversation', group: '回复过滤' }),
            streamingMaxSpeed: definition({ category: 'conversation', group: '流式显示', advanced: true }),
            nexusPreset: definition({ category: 'generation', group: '模型预设' })
        }, { pluginName: '剧情演播' });
        const thirdParty = pluginSource('acme-plugin', { token: definition() }, { pluginName: 'Acme' });

        const index = buildSettingsCategoryIndex([chat, thirdParty]);
        const allKeys = SETTINGS_CATEGORIES.flatMap(category => index[category.id].map(item => item.storageKey));

        expect(allKeys.sort()).toEqual([
            'acme-plugin.token',
            'lumina-chat.filterChatReply',
            'lumina-chat.nexusPreset',
            'lumina-chat.streamingEffect',
            'lumina-chat.streamingMaxSpeed'
        ]);

        const groups = groupCategorySettings(index.conversation);
        expect(groups.map(group => group.label)).toEqual(['流式显示', '回复过滤']);
        expect(groups[0].settings.map(item => item.settingKey)).toEqual(['streamingEffect', 'streamingMaxSpeed']);
        expect(groups[0].settings[1].advanced).toBe(true);

        // 未声明分组的第三方设置按插件名分组
        expect(groupCategorySettings(index.advanced).map(group => group.label)).toEqual(['Acme']);
    });

    it('resolves plugin-level settings components to an explicit or derived category', () => {
        expect(resolvePluginComponentCategory(pluginSource('lumina-forge', {
            nexusPreset: definition({ category: 'generation' })
        }, { settingsCategory: 'workshop', hasPluginComponent: true }))).toBe('workshop');

        expect(resolvePluginComponentCategory(pluginSource('acme', {
            mode: definition({ category: 'context' })
        }, { hasPluginComponent: true }))).toBe('context');

        expect(resolvePluginComponentCategory(pluginSource('acme', {}, { hasPluginComponent: true }))).toBe('advanced');
    });

    it('maps the settings route value to overview, a category, or a legacy plugin id', () => {
        const sources = [
            pluginSource('lumina-forge', { nexusPreset: definition({ category: 'generation' }) }, { settingsCategory: 'workshop' }),
            pluginSource('desktop-mode:discord', {}, { kind: 'desktop-mode' })
        ];

        expect(resolveSettingsView(null, sources)).toEqual({ kind: 'home' });
        expect(resolveSettingsView('overview', sources)).toEqual({ kind: 'overview' });
        expect(resolveSettingsView('context', sources)).toEqual({ kind: 'category', categoryId: 'context' });
        expect(resolveSettingsView('lumina-forge', sources)).toEqual({ kind: 'category', categoryId: 'workshop' });
        expect(resolveSettingsView('desktop-mode:discord', sources)).toEqual({ kind: 'category', categoryId: 'appearance' });
        expect(resolveSettingsView('missing-plugin', sources)).toEqual({ kind: 'home' });
    });

    it('only lists custom panels that point at valid categories', () => {
        const panelIds = SETTINGS_PANELS.map(panel => panel.id);
        expect(new Set(panelIds).size).toBe(panelIds.length);
        SETTINGS_PANELS.forEach(panel => {
            expect(isSettingsCategoryId(panel.category)).toBe(true);
            expect(panel.keywords.length).toBeGreaterThan(0);
        });
    });

    it('keeps the overview short', () => {
        expect(OVERVIEW_SETTING_KEYS.length).toBeLessThanOrEqual(6);
        expect(new Set(OVERVIEW_SETTING_KEYS).size).toBe(OVERVIEW_SETTING_KEYS.length);
    });
});
