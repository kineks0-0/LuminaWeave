import ChatStream from './ChatStream.vue';
import ChatPreview from './ChatPreview.vue';
import { LuminaPlugin } from '../../types/plugin';
import ChatRoot from './ChatRoot.vue';
import { useChatStore } from '../../stores/useChatStore';

const plugin: LuminaPlugin = {
    id: 'lumina-chat',
    name: '剧情演播',
    icon: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    slots: ['mainView'],
    component: ChatRoot,
    settingsPreviewComponent: ChatPreview,
    settingsManifest: {
        theme: { default: 'gray', label: '阅读主题', common: true, type: 'theme', allowedScopes: ['Global', 'Character'] },
        fontFamily: { default: 'sans-serif', label: '正文字体', common: true, type: 'options', options: [{ value: 'sans-serif', label: '黑体' }, { value: 'serif', label: '宋体' }, { value: 'kaiti', label: '楷体' }], allowedScopes: ['Global', 'Character'] },
        fontWeight: { default: 400, label: '字体字重', common: true, type: 'stepper', min: 100, max: 900, step: 100, allowedScopes: ['Global', 'Character'] },
        fontSize: { default: 16, label: '正文字号', common: true, type: 'stepper', min: 12, max: 72, allowedScopes: ['Global', 'Character', 'Chat', 'Session'] },
        viewMode: { default: 'chat', label: '视图模式', common: true, type: 'options', options: [{ value: 'chat', label: '聊天模式' }, { value: 'document', label: '文档阅读' }], allowedScopes: ['Global', 'Character', 'Session'] },
        nexusPreset: { default: '', label: '专用模型/网关预设', common: true, type: 'nexus-select', allowedScopes: ['Global', 'Character'] },
        pageWidth: { default: 'auto', label: '最大横向宽度', common: false, type: 'options', options: [{ value: 'auto', label: '自动' }, { value: 640, label: '640' }, { value: 800, label: '800' }, { value: 900, label: '900' }, { value: 1000, label: '1000' }, { value: 1280, label: '1280' }], allowedScopes: ['Global', 'Character'] },
        lineHeight: { default: 1.6, label: '排版行高', common: false, type: 'slider', min: 1.0, max: 3.0, step: 0.05, allowedScopes: ['Global', 'Character'] },
        paragraphSpacing: { default: 16, label: '段落间距', common: false, type: 'slider', min: 0, max: 64, step: 1, allowedScopes: ['Global', 'Character'] },
        letterSpacing: { default: 0, label: '文字间距', common: false, type: 'slider', min: 0, max: 10, step: 0.1, allowedScopes: ['Global', 'Character'] },
        streamingSmoothness: {
            default: false,
            label: '流式输出平滑',
            common: true,
            type: 'boolean',
            allowedScopes: ['Global', 'Character']
        },
        streamingSmoothnessFactor: {
            default: 2,
            label: '平滑速度因子',
            common: true,
            type: 'slider',
            min: 1,
            max: 7,
            step: 1,
            allowedScopes: ['Global', 'Character']
        },
        streamingMaxSpeed: {
            default: 20,
            label: '平滑输出最高限速 (字/帧)',
            common: false,
            type: 'slider',
            min: 1,
            max: 100,
            step: 1,
            allowedScopes: ['Global', 'Character']
        }
    },
    init() {
        useChatStore().bind();
        console.log('[Plugin: Chat] initialized');
    }
};

export default plugin;
