import { describe, expect, it } from 'vitest';
import type { SettingDefinition } from '../../../types/plugin.js';
import { buildSettingsCategoryIndex, type SettingsPanelDefinition, type SettingsSourceDescriptor } from '../settingsTaxonomy.js';
import { buildSettingsSearchDocuments, normalizeSettingsQuery, searchSettings } from '../settingsSearch.js';

const definition = (overrides: Partial<SettingDefinition>): SettingDefinition => ({
    default: false,
    label: '未命名',
    type: 'boolean',
    ...overrides
});

const source: SettingsSourceDescriptor = {
    pluginId: 'lumina-chat',
    pluginName: '剧情演播',
    kind: 'plugin',
    hasPluginComponent: false,
    manifest: {
        streamingEffect: definition({
            label: '流式文本显示效果',
            type: 'options',
            category: 'conversation',
            options: [
                { value: 'instant', label: '即时显示' },
                { value: 'typewriter', label: '打字机效果' }
            ]
        }),
        streamingSmoothness: definition({ label: '流式输出平滑', category: 'conversation' }),
        unlimitedResponse: definition({
            label: '不限制回复长度',
            description: '不向后端传递 max_tokens，流式输出由模型决定长度。',
            category: 'generation'
        }),
        tavilyApiKey: definition({ label: 'Tavily 联网研究', type: 'password', category: 'workshop', keywords: ['密钥', 'API Key'] })
    }
};

const panels: SettingsPanelDefinition[] = [
    { id: 'nexus-presets', category: 'generation', title: '模型与网关预设', description: '管理自定义 API', keywords: ['密钥', '网关'] }
];

const documents = buildSettingsSearchDocuments(buildSettingsCategoryIndex([source]), panels);

describe('settingsSearch', () => {
    it('normalizes whitespace and case', () => {
        expect(normalizeSettingsQuery('  API   key ')).toBe('api key');
    });

    it('returns nothing for an empty query', () => {
        expect(searchSettings(documents, '   ')).toEqual([]);
    });

    it('ranks label prefix over label substring over description', () => {
        const ids = searchSettings(documents, '流式').map(result => result.id);
        expect(ids).toEqual([
            'setting:lumina-chat.streamingEffect',
            'setting:lumina-chat.streamingSmoothness',
            'setting:lumina-chat.unlimitedResponse'
        ]);
    });

    it('matches option labels, keywords and panels', () => {
        expect(searchSettings(documents, '打字机').map(result => result.id)).toEqual(['setting:lumina-chat.streamingEffect']);
        expect(searchSettings(documents, '密钥').map(result => result.id)).toEqual([
            'setting:lumina-chat.tavilyApiKey',
            'panel:nexus-presets'
        ]);
    });

    it('matches category names and reports the jump target', () => {
        const [result] = searchSettings(documents, '工坊');
        expect(result).toMatchObject({
            id: 'setting:lumina-chat.tavilyApiKey',
            categoryId: 'workshop',
            anchor: 'lumina-chat.tavilyApiKey'
        });
    });

    it('caps the number of results', () => {
        expect(searchSettings(documents, '流式', 2)).toHaveLength(2);
    });
});
