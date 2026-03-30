import { LuminaPlugin } from '../../types/plugin';
import SettingsRoot from './SettingsRoot.vue';

const plugin: LuminaPlugin = {
    id: 'lumina-settings',
    name: '设置面板',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    slots: ['widget'],
    component: SettingsRoot,
    settingsManifest: {
        useShadowDom: {
            default: true,
            label: '启用 Shadow DOM 样式隔离 (需要刷新)',
            common: true,
            type: 'boolean',
            allowedScopes: ['Global']
        },
        isPromptInjectionEnabled: {
            default: true,
            label: '启用插件提示词 (世界书与宏)',
            description: '如果关闭，LuminaWeave 将停止同步系统世界书和宏替换，完全使用 ST 原生提示词。',
            common: true,
            type: 'boolean',
            allowedScopes: ['Global']
        },
        dedicatedPromptLorebookName: {
            default: 'LuminaWeave_System',
            label: '提示词专用世界书名称',
            description: '插件将提示词和宏注入到该独立世界书中。修改后需点击“强制同步”以生效。',
            common: true,
            type: 'text',
            allowedScopes: ['Global']
        }
    },
    init() {
        console.log('[Plugin: Settings] initialized');
    }
};

export default plugin;
