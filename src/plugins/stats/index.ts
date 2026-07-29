import { defineAsyncComponent } from 'vue';
import { LuminaPlugin } from '../../types/plugin.js';
import type { PluginManifestV2 } from '../../platform/plugin/types.js';

const LuminaStats = defineAsyncComponent(() => import('./LuminaStats.vue'));

const settingsSchema = {
    nexusPreset: { default: '', label: '状态分析专用模型预设', common: true, type: 'nexus-select', allowedScopes: ['Global', 'Character'] }
} satisfies LuminaPlugin['settingsManifest'];

const platformManifest: PluginManifestV2 = {
    id: 'lumina-stats',
    name: '状态',
    primarySurface: 'stats.panel',
    capabilities: [
        { id: 'context.stats', description: '展示当前会话派生状态与数值面板。' }
    ],
    settingsSchema,
    surfaces: [
        { id: 'stats.panel', ownerPluginId: 'lumina-stats', description: '状态面板 surface。' }
    ],
    businessRenderers: {
        'stats.panel': { contractId: 'stats.panel', component: LuminaStats }
    }
};

const plugin: LuminaPlugin = {
    id: 'lumina-stats',
    name: '状态',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20v-6M6 20v-2M18 20v-4M3 11l9-7 9 7-9 7-9-7z"></path><path d="M12 14l9-7-9-7-9 7 9 7z"></path></svg>',
    component: LuminaStats,
    settingsManifest: settingsSchema,
    platformManifest,
    init() {
        console.log('[Plugin: Stats] initialized');
    }
};

export default plugin;
