import { defineAsyncComponent } from 'vue'
import { LuminaPlugin } from '../../types/plugin'
import { lwStorage } from '../../api/storage'
import type { PluginManifestV2 } from '../../platform/plugin/types'

const DevSettings = defineAsyncComponent(() => import('./DevSettings.vue'))

const settingsSchema = {
  devMode: {
    default: true,
    label: '启用开发者模式',
    description: '显示高级调试工具。',
    common: true,
    type: 'boolean',
    allowedScopes: ['Global']
  }
} satisfies LuminaPlugin['settingsManifest']

const platformManifest: PluginManifestV2 = {
  id: 'lumina-dev',
  name: '开发菜单',
  capabilities: [
    { id: 'dev.tools', description: '暴露开发和调试工具。' }
  ],
  settingsSchema,
  surfaces: [
    { id: 'dev.tools', ownerPluginId: 'lumina-dev', description: '开发工具 surface。' }
  ],
  businessRenderers: {
    'dev.tools': { contractId: 'dev.tools', component: DevSettings }
  }
}

const plugin: LuminaPlugin = {
  id: 'lumina-dev',
  name: '开发菜单',
  icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
  component: DevSettings,
  settingsPreviewComponent: DevSettings,
  settingsManifest: settingsSchema,
  platformManifest,
  init() {
    console.log('[Plugin: Dev] initialized')
  },
  isEnabled() {
    return lwStorage.get('lumina-dev.devMode', true, 'Global')
  }
}

export default plugin
