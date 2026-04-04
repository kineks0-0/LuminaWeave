import { LuminaPlugin } from '../../types/plugin'
import { lwStorage } from '../../api/storage'
import DevSettings from './DevSettings.vue'

const plugin: LuminaPlugin = {
  id: 'lumina-dev',
  name: '开发菜单',
  icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
  slots: ['widget'],
  component: DevSettings,
  settingsPreviewComponent: DevSettings,
  settingsManifest: {
    devMode: {
      default: true,
      label: '启用开发者模式',
      description: '显示高级调试工具。',
      common: true,
      type: 'boolean',
      allowedScopes: ['Global']
    }
  },
  init() {
    console.log('[Plugin: Dev] initialized')
  },
  isEnabled() {
    return lwStorage.get('lumina-dev.devMode', true, 'Global')
  }
}

export default plugin
