import { markRaw } from 'vue';
import LauncherRoot from './LauncherRoot.vue';
import { LuminaPlugin } from '../../types/plugin';

const plugin: LuminaPlugin = {
  id: 'lumina-launcher',
  name: '启动台',
  icon: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>`,
  slots: ['mainView'],
  component: markRaw(LauncherRoot)
};

export default plugin;
