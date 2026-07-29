import { defineAsyncComponent } from 'vue';
import { LuminaPlugin } from '../../types/plugin.js';
import type { PluginManifestV2 } from '../../platform/plugin/types.js';

const LuminaTimeline = defineAsyncComponent(() => import('./LuminaTimeline.vue'));

const platformManifest: PluginManifestV2 = {
    id: 'lumina-timeline',
    name: '世界线',
    primarySurface: 'timeline.navigator',
    capabilities: [
        { id: 'conversation.timeline', description: '浏览和切换当前会话世界线。' }
    ],
    surfaces: [
        { id: 'timeline.navigator', ownerPluginId: 'lumina-timeline', description: '世界线导航 surface。' }
    ],
    businessRenderers: {
        'timeline.navigator': { contractId: 'timeline.navigator', component: LuminaTimeline }
    }
};

const plugin: LuminaPlugin = {
    id: 'lumina-timeline',
    name: '世界线',
    icon: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>',
    component: LuminaTimeline,
    platformManifest,
    init() {
        console.log('[Plugin: Timeline] initialized');
    }
};

export default plugin;
