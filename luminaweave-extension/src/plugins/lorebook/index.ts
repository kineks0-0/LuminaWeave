import { LuminaPlugin } from '../../types/plugin';
import LorebookRoot from './LorebookRoot.vue';

const plugin: LuminaPlugin = {
    id: 'lumina-lorebook',
    name: '世界书',
    icon: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    slots: ['widget', 'mainView'],
    component: LorebookRoot,
    settingsManifest: {
        autoSync: { default: true, label: '自动同步世界书', common: true, type: 'boolean', allowedScopes: ['Global'] },
        displayMode: { default: 'list', label: '显示模式', common: true, type: 'options', options: [{ value: 'list', label: '列表' }, { value: 'grid', label: '卡片' }, { value: 'table', label: '表格' }], allowedScopes: ['Global'] },
        interactMode: { 
            default: 'none', 
            label: '点击交互模式', 
            common: true, 
            type: 'options', 
            options: [
                { value: 'none', label: '关闭 (同窗口编辑)' },
                { value: 'large-to-sidebar', label: '大窗口点击 -> 侧边栏' },
                { value: 'sidebar-to-large', label: '侧边栏点击 -> 大窗口' }
            ], 
            allowedScopes: ['Global'] 
        },
        autoOpenSidebar: { default: true, label: '自动展开/切换侧边栏编辑器', common: true, type: 'boolean', allowedScopes: ['Global'] }
    },
    init() {
        console.log('[Plugin: Lorebook] initialized');
    }
};

export default plugin;
