import { defineAsyncComponent, markRaw } from 'vue';
import type { LuminaPlugin } from '../../types/plugin.js';
import type { PluginManifestV2 } from '../../platform/plugin/types.js';

const TerminalRoot = defineAsyncComponent(() => import('./TerminalRoot.vue'));

const platformManifest: PluginManifestV2 = {
  id: 'lumina-terminal',
  name: '资源终端',
  description: '提供面向 Resource Domain 的 VFS 命令终端。',
  primarySurface: 'terminal.root',
  navigationSlots: ['widget'],
  capabilities: [
    { id: 'terminal.vfs', description: '通过 VFS 命令浏览、搜索和受控编辑资源。' }
  ],
  surfaces: [
    { id: 'terminal.root', ownerPluginId: 'lumina-terminal', description: '资源终端 surface。' }
  ],
  businessRenderers: {
    'terminal.root': { contractId: 'terminal.root', component: TerminalRoot }
  }
};

const plugin: LuminaPlugin = {
  id: 'lumina-terminal',
  name: '资源终端',
  icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>',
  component: markRaw(TerminalRoot),
  platformManifest,
  init() {
    console.log('[Plugin: Terminal] initialized');
  }
};

export default plugin;
