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
        syncIgnoreST: {
            default: false,
            label: '强制忽略 ST 侧改动',
            description: '开启后，同步时不拉取 ST 侧新增/编辑内容，始终以插件侧数据为准回写 ST（除非显式选择以 ST 为准或执行强制全量同步）。',
            common: true,
            type: 'boolean',
            allowedScopes: ['Global']
        },
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
        },
        'dialogueUIFrequency': {
            label: '互动 UI 出现频率',
            description: '控制 AI 在回复中输出交互组件（如行动选项、数值变化）的倾向性。',
            type: 'options',
            default: 1,
            allowedScopes: ['Global', 'Character'],
            options: [
                { value: 0, label: '关闭', description: '彻底禁用 UI 引导提示词，AI 不会输出任何 UI 标签。' },
                { value: 1, label: '极低', description: '仅在重大的剧情折返点或转场时才使用 UI 组件。' },
                { value: 2, label: '适中', description: '作为叙事辅助手段适量出现，保持沉浸感。' },
                { value: 3, label: '频繁', description: '较积极地使用 UI 组件来增强剧情的互动性。' },
                { value: 4, label: '极高', description: '尽可能频繁地出现 UI 组件，使其成为叙事手段的一部分。' }
            ]
        },
        'dialogueUIInteraction': {
            label: '互动 UI 点击行为',
            description: '设置点击 UI 选项（如 Choices）时的触发逻辑。',
            type: 'options',
            default: 'generate',
            allowedScopes: ['Global'],
            options: [
                { value: 'generate', label: '立即发送', description: '点击选项后立即发送指令并开始下一轮生成。' },
                { value: 'fill', label: '填写框', description: '点击选项后仅将指令填入输入框，由用户确认后手动发送。' }
            ]
        },
        'streamingEffect': {
            default: 'instant',
            label: '流式文本显示效果',
            common: true,
            type: 'options',
            options: [
                { value: 'instant', label: '即时显示' },
                { value: 'fade-in', label: '淡入效果' },
                { value: 'gpt-style', label: 'GPT 风格（淡入+颜色过渡）' },
                { value: 'typewriter', label: '打字机效果' }
            ],
            allowedScopes: ['Global', 'Character']
        },
        'contextControl.fullMode': {
            label: '全量发送限制类型',
            type: 'options',
            default: 'count',
            options: [
                { value: 'count', label: '按消息条数' },
                { value: 'token', label: '按 Token 数量' },
                { value: 'char', label: '按字符长度' }
            ],
            common: true,
            allowedScopes: ['Global', 'Character']
        },
        'contextControl.fullValueCount': {
            label: '全量发送范围 (条数)',
            type: 'stepper',
            default: 10,
            min: 1,
            max: 500,
            common: true,
            allowedScopes: ['Global', 'Character'],
            showIf: (s) => s['lumina-chat.contextControl.fullMode'] === 'count'
        },
        'contextControl.fullValueToken': {
            label: '全量发送范围 (Token)',
            type: 'stepper',
            default: 2000,
            min: 100,
            max: 8000,
            step: 100,
            common: true,
            allowedScopes: ['Global', 'Character'],
            showIf: (s) => s['lumina-chat.contextControl.fullMode'] === 'token'
        },
        'contextControl.fullValueChar': {
            label: '全量发送范围 (字符数)',
            type: 'stepper',
            default: 5000,
            min: 100,
            max: 20000,
            step: 100,
            common: true,
            allowedScopes: ['Global', 'Character'],
            showIf: (s) => s['lumina-chat.contextControl.fullMode'] === 'char'
        },
        'contextControl.summaryMode': {
            label: '概览发送限制类型',
            type: 'options',
            default: 'count',
            options: [
                { value: 'count', label: '按额外消息条数' },
                { value: 'token', label: '按额外 Token 数量' },
                { value: 'char', label: '按额外字符长度' }
            ],
            common: true,
            allowedScopes: ['Global', 'Character']
        },
        'contextControl.summaryValueCount': {
            label: '概览额外发送范围 (条数)',
            type: 'stepper',
            default: 30,
            min: 0,
            max: 1000,
            common: true,
            allowedScopes: ['Global', 'Character'],
            showIf: (s) => s['lumina-chat.contextControl.summaryMode'] === 'count'
        },
        'contextControl.summaryValueToken': {
            label: '概览额外发送范围 (Token)',
            type: 'stepper',
            default: 4000,
            min: 0,
            max: 20000,
            step: 100,
            common: true,
            allowedScopes: ['Global', 'Character'],
            showIf: (s) => s['lumina-chat.contextControl.summaryMode'] === 'token'
        },
        'contextControl.summaryValueChar': {
            label: '概览额外发送范围 (字符数)',
            type: 'stepper',
            default: 10000,
            min: 0,
            max: 50000,
            step: 100,
            common: true,
            allowedScopes: ['Global', 'Character'],
            showIf: (s) => s['lumina-chat.contextControl.summaryMode'] === 'char'
        },
        'contextControl.tokenSplitAllowed': {
            label: '允许 Token/字数 强制截断文本',
            type: 'boolean',
            default: false,
            description: '超出全量限制后，是否允许在单词/句子中间截断以严格遵守物理限制。',
            common: false,
            allowedScopes: ['Global', 'Character']
        },
        'contextControl.tokenMaxFloat': {
            label: 'Token/字数 允许浮动范围',
            type: 'stepper',
            default: 200,
            min: 0,
            max: 2000,
            common: false,
            allowedScopes: ['Global', 'Character']
        },
        'contextControl.enableFallbackSummary': {
            label: '无摘要消息兜底截断',
            type: 'boolean',
            default: false,
            description: '开启后，概况区内没有有效摘要的 AI 消息将截取原文前 100 字作为摘要（而非保留全量）。关闭（默认）则这类消息在概况区内以全量形式保留，更安全但占用更多 token。',
            common: false,
            allowedScopes: ['Global', 'Character']
        }
    },
    init() {
        useChatStore().bind();
        console.log('[Plugin: Chat] initialized');
    }
};

export default plugin;
