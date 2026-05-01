import { markRaw } from 'vue';
import LauncherRoot from './LauncherRoot.vue';
import { LuminaPlugin } from '../../types/plugin';
import type { PluginManifestV2 } from '../../platform/plugin/types';

const platformManifest: PluginManifestV2 = {
  id: 'lumina-launcher',
  name: '启动台',
  capabilities: [
    { id: 'launcher.app-grid', description: '展示可打开的插件和工作区入口。' }
  ],
  surfaces: [
    { id: 'launcher.root', ownerPluginId: 'lumina-launcher', description: '启动台 surface。' }
  ],
  businessRenderers: {
    'launcher.root': { contractId: 'launcher.root', component: LauncherRoot }
  }
};

const plugin: LuminaPlugin = {
  id: 'lumina-launcher',
  name: '启动台',
  icon: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>`,
  component: markRaw(LauncherRoot),
  platformManifest
};

export default plugin;
