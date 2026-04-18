import { LuminaPlugin } from '../../types/plugin';
import SettingsRoot from './SettingsRoot.vue';
import { getDesktopModeOptions } from '../../theme/themeRegistry';

const plugin: LuminaPlugin = {
    id: 'lumina-settings',
    name: '设置面板',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    slots: ['widget'],
    component: SettingsRoot,
    settingsManifest: {
        appearance: {
            default: 'system',
            label: '界面外观',
            description: '统一 LuminaWeave 全局外观。若当前桌面模式强制指定浅/深色，则以桌面模式为准。',
            common: true,
            type: 'options',
            allowedScopes: ['Global'],
            options: [
                { value: 'system', label: '跟随系统', description: '自动匹配系统浅色或深色外观。' },
                { value: 'light', label: '浅色', description: '使用明亮的 Codex 风格工作区。' },
                { value: 'dark', label: '深色', description: '使用低眩光的 Codex 风格工作区。' }
            ]
        },
        activeDesktopMode: {
            default: 'classic',
            label: '桌面模式',
            description: '切换整套桌面模式。它会统一控制工作模式、导航组织、界面承载方式与对应表层样式。',
            common: true,
            type: 'options',
            allowedScopes: ['Global'],
            options: getDesktopModeOptions
        },
        motionPerformance: {
            default: 'full',
            label: '动效性能',
            description: '控制工作台的动画与滤镜效果。若在低端设备上感到卡顿，建议使用省电模式。',
            common: true,
            type: 'options',
            allowedScopes: ['Global'],
            options: [
                { value: 'full', label: '最高性能 (Full)', description: '启用所有物理弹性、模糊滤镜与流畅动画。' },
                { value: 'light', label: '省电模式 (Light)', description: '移除高开销的模糊滤镜，保留基本过渡动画。' },
                { value: 'none', label: '禁用动效 (None)', description: '完全关闭所有 UI 过渡与动画。' }
            ]
        },
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
        },
        luminaViewSyntaxStyle: {
            default: 'functional',
            label: 'V 语法风格',
            description: '控制提示词中 `<V>` DSL 只使用函数式还是管道式，避免同时给模型两套语法。',
            common: true,
            type: 'options',
            allowedScopes: ['Global'],
            options: [
                { value: 'functional', label: '函数式', description: '输出 `ComponentName(\"参数\")` 形式，清晰稳定。' },
                { value: 'pipe', label: '管道式', description: '输出 `Code|参数` 形式，更短，但要求统一使用缩写。' }
            ]
        },
        workspaceAllowUnderStageStrip: {
            default: false,
            label: '自由工作台窗口允许压到台前调度下方',
            description: '开启后，窗口拖拽和布局将不再避让左侧台前调度区域，可延伸到其下方。',
            common: true,
            type: 'boolean',
            allowedScopes: ['Global']
        },
        workspaceShowStageStrip: {
            default: true,
            label: '显示自由工作台台前调度栏',
            description: '关闭后，左侧台前调度栏将被隐藏，工作台按钮也不会再显示它。',
            common: true,
            type: 'boolean',
            allowedScopes: ['Global']
        },
        workspaceAllowUnderDock: {
            default: false,
            label: '自由工作台窗口允许压到 Dock 下方',
            description: '开启后，窗口拖拽和布局将不再避让底部 Dock，可延伸到其下方。',
            common: true,
            type: 'boolean',
            allowedScopes: ['Global']
        },
        workspaceShowDock: {
            default: true,
            label: '显示自由工作台 Dock 栏',
            description: '关闭后，底部 Dock 将被隐藏，工作台按钮也不会再显示它。',
            common: true,
            type: 'boolean',
            allowedScopes: ['Global']
        },
        workspaceMaxWindowsPerStage: {
            default: 4,
            label: '台前调度限制窗口数量',
            description: '当当前舞台窗口达到此限制时，新打开的窗口将自动创建并跳转至新舞台。',
            common: true,
            type: 'stepper',
            min: 1,
            max: 10,
            allowedScopes: ['Global']
        },
        traditionalHeaderDesktopPosition: {
            default: 'top',
            label: '传统桌面顶栏位置（桌面）',
            description: '控制桌面端传统桌面的主导航条固定在顶部还是底部。',
            common: true,
            type: 'options',
            allowedScopes: ['Global'],
            options: [
                { value: 'top', label: '顶部', description: '保持传统桌面的主导航位于顶部。' },
                { value: 'bottom', label: '底部', description: '将传统桌面的主导航移动到底部，更接近 Dock 式操作。' }
            ]
        },
        traditionalHeaderMobilePosition: {
            default: 'top',
            label: '传统桌面顶栏位置（移动）',
            description: '控制移动端传统桌面的主导航条固定在顶部还是底部。',
            common: true,
            type: 'options',
            allowedScopes: ['Global'],
            options: [
                { value: 'top', label: '顶部', description: '在移动端保留顶部导航栏。' },
                { value: 'bottom', label: '底部', description: '将移动端导航移到底部，更便于拇指操作。' }
            ]
        }
    },
    init() {
        console.log('[Plugin: Settings] initialized');
    }
};

export default plugin;
