import { LuminaPlugin } from '../../types/plugin';
import LuminaStats from './LuminaStats.vue';

const plugin: LuminaPlugin = {
    id: 'lumina-stats',
    name: '状态',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20v-6M6 20v-2M18 20v-4M3 11l9-7 9 7-9 7-9-7z"></path><path d="M12 14l9-7-9-7-9 7 9 7z"></path></svg>',
    slots: ['widget'],
    component: LuminaStats,
    settingsManifest: {
        nexusPreset: { default: '', label: '状态分析专用模型预设', common: true, type: 'nexus-select', allowedScopes: ['Global', 'Character'] }
    },
    init() {
        console.log('[Plugin: Stats] initialized');
    }
};

export default plugin;
