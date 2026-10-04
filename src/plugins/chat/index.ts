import ChatPreview from './ChatPreview.vue';
import { LuminaPlugin } from '../../types/plugin.js';
import ChatRoot from './ChatRoot.vue';
import type { PluginManifestV2 } from '../../platform/plugin/types.js';
import CharacterRosterSurface from './surfaces/CharacterRosterSurface.vue';
import ConversationSessionListSurface from './surfaces/ConversationSessionListSurface.vue';
import ChatTranscriptSurface from './surfaces/ChatTranscriptSurface.vue';
import ChatComposerSurface from './surfaces/ChatComposerSurface.vue';
import ChatPromptInspectorSurface from './surfaces/ChatPromptInspectorSurface.vue';
import ChatMainSurface from './surfaces/ChatMainSurface.vue';
import {
    createCharacterRosterSurfaceContext,
    createConversationSessionListSurfaceContext,
    createChatTranscriptSurfaceContext,
    createChatComposerSurfaceContext,
    createChatPromptInspectorSurfaceContext,
    createChatMainSurfaceContext
} from './surfaces/createChatSurfaceContexts.js';

const settingsSchema = {
    nexusPreset: { category: 'generation', group: '专用模型', default: '', label: '专用模型/网关预设', type: 'nexus-select', allowedScopes: ['Global', 'Character'] },
    userName: {
        category: 'conversation',
        group: '本地身份',
        default: 'User',
        label: '本地用户名称',
        description: '独立运行模式下用于消息署名与 {{user}} 宏；SillyTavern 模式下仍使用酒馆 persona。',
        type: 'text',
        allowedScopes: ['Global']
    },
    personaDescription: {
        category: 'conversation',
        group: '本地身份',
        default: '',
        label: '本地 persona 描述',
        description: '非空时作为 system 提示注入独立运行模式的 Lumina 生成。',
        type: 'text',
        allowedScopes: ['Global']
    },
    syncIgnoreST: {
        category: 'storage',
        group: '同步策略',
        default: false,
        label: '强制忽略 ST 侧改动',
        description: '开启后，同步时不拉取 ST 侧新增/编辑内容，始终以插件侧数据为准回写 ST（除非显式选择以 ST 为准或执行强制全量同步）。',
        type: 'boolean',
        allowedScopes: ['Global']
    },
    'streamingEffect': {
        category: 'conversation',
        group: '流式显示',
        keywords: ['吐字', '打字机', '动画'],
        default: 'instant',
        label: '流式文本显示效果',
        type: 'options',
        options: [
            { value: 'instant', label: '即时显示' },
            { value: 'fade-in', label: '淡入效果' },
            { value: 'gpt-style', label: 'GPT 风格（淡入+颜色过渡）' },
            { value: 'typewriter', label: '打字机效果' }
        ],
        allowedScopes: ['Global']
    },
    streamingSmoothness: {
        category: 'conversation',
        group: '流式显示',
        default: false,
        label: '流式输出平滑',
        type: 'boolean',
        allowedScopes: ['Global']
    },
    streamingSmoothnessFactor: {
        showIf: (settings) => settings['lumina-chat.streamingSmoothness'] === true || settings['lumina-chat.streamingEffect'] === 'typewriter',
        category: 'conversation',
        group: '流式显示',
        default: 2,
        label: '平滑速度因子',
        type: 'slider',
        min: 1,
        max: 7,
        step: 1,
        allowedScopes: ['Global']
    },
    streamingMaxSpeed: {
        showIf: (settings) => settings['lumina-chat.streamingSmoothness'] === true || settings['lumina-chat.streamingEffect'] === 'typewriter',
        category: 'conversation',
        group: '流式显示',
        advanced: true,
        default: 20,
        label: '平滑输出最高限速 (字/帧)',
        type: 'slider',
        min: 1,
        max: 100,
        step: 1,
        allowedScopes: ['Global']
    },
    filterChatReply: {
        category: 'conversation',
        group: '回复过滤',
        keywords: ['Chat_Reply', '标签'],
        default: false,
        label: '只显示 Chat_Reply 内容',
        description: '屏蔽预思考与动作标签（如 Character_Action），只展示回复主体。',
        type: 'boolean',
        allowedScopes: ['Global']
    },
    allowTopLevelInFilter: {
        category: 'conversation',
        group: '回复过滤',
        default: true,
        label: '保留不在标签内的正文',
        description: '模型输出了不带任何标签的文本时照常显示；关闭则只显示指定标签内的内容。',
        type: 'boolean',
        allowedScopes: ['Global'],
        showIf: (settings) => settings['lumina-chat.filterChatReply'] === true
    },
    implicitThinkingInFilter: {
        category: 'conversation',
        group: '回复过滤',
        advanced: true,
        default: false,
        label: '开头的无标签文本视为思考',
        description: '消息以普通文本而不是标签开头时，把这段文本当作思考过程隐藏，直到遇到下一个标签。',
        type: 'boolean',
        allowedScopes: ['Global'],
        showIf: (settings) => settings['lumina-chat.filterChatReply'] === true
    },
    aggressiveThinking: {
        category: 'conversation',
        group: '回复过滤',
        advanced: true,
        default: false,
        label: '隐藏到第一个 </thinking> 为止',
        description: '第一个 </thinking> 标签及其之前的所有内容都视为思考过程并隐藏。',
        type: 'boolean',
        allowedScopes: ['Global'],
        showIf: (settings) => settings['lumina-chat.filterChatReply'] === true
            && settings['lumina-chat.implicitThinkingInFilter'] === true
    },
    unlimitedResponse: {
        category: 'generation',
        group: '输出长度',
        keywords: ['max_tokens', '长度'],
        default: false,
        label: '不限制回复长度',
        description: '不向后端传递 max_tokens，由模型自行决定输出长度。',
        type: 'boolean',
        allowedScopes: ['Global']
    },
    renderHtmlBlocks: {
        category: 'conversation',
        group: '互动组件',
        keywords: ['HTML', 'iframe', '沙箱', '互动', '选项'],
        default: false,
        label: '渲染消息中的 HTML 交互块',
        description: '把消息里 ```html 代码块渲染为沙箱交互组件（如预设的选项面板）。组件无法访问宿主数据；填入/发送操作会转发到聊天。',
        type: 'boolean',
        allowedScopes: ['Global']
    },
    'dialogueUIFrequency': {
        category: 'conversation',
        group: '互动组件',
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
        category: 'conversation',
        group: '互动组件',
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
    'contextControl.fullMode': {
        category: 'context',
        group: '全量发送范围',
        keywords: ['DCC'],
        label: '全量发送限制类型',
        type: 'options',
        default: 'count',
        options: [
            { value: 'count', label: '按消息条数' },
            { value: 'token', label: '按 Token 数量' },
            { value: 'char', label: '按字符长度' }
        ],
        allowedScopes: ['Global', 'Character']
    },
    'contextControl.fullValueCount': {
        category: 'context',
        group: '全量发送范围',
        keywords: ['DCC'],
        label: '全量发送范围 (条数)',
        type: 'stepper',
        default: 10,
        min: 1,
        max: 500,
        allowedScopes: ['Global', 'Character'],
        showIf: (s) => s['lumina-chat.contextControl.fullMode'] === 'count'
    },
    'contextControl.fullValueToken': {
        category: 'context',
        group: '全量发送范围',
        keywords: ['DCC'],
        label: '全量发送范围 (Token)',
        type: 'stepper',
        default: 2000,
        min: 100,
        max: 8000,
        step: 100,
        allowedScopes: ['Global', 'Character'],
        showIf: (s) => s['lumina-chat.contextControl.fullMode'] === 'token'
    },
    'contextControl.fullValueChar': {
        category: 'context',
        group: '全量发送范围',
        keywords: ['DCC'],
        label: '全量发送范围 (字符数)',
        type: 'stepper',
        default: 5000,
        min: 100,
        max: 20000,
        step: 100,
        allowedScopes: ['Global', 'Character'],
        showIf: (s) => s['lumina-chat.contextControl.fullMode'] === 'char'
    },
    'contextControl.summaryMode': {
        category: 'context',
        group: '概览发送范围',
        keywords: ['DCC', '摘要'],
        label: '概览发送限制类型',
        type: 'options',
        default: 'count',
        options: [
            { value: 'count', label: '按额外消息条数' },
            { value: 'token', label: '按额外 Token 数量' },
            { value: 'char', label: '按额外字符长度' }
        ],
        allowedScopes: ['Global', 'Character']
    },
    'contextControl.summaryValueCount': {
        category: 'context',
        group: '概览发送范围',
        keywords: ['DCC', '摘要'],
        label: '概览额外发送范围 (条数)',
        type: 'stepper',
        default: 30,
        min: 0,
        max: 1000,
        allowedScopes: ['Global', 'Character'],
        showIf: (s) => s['lumina-chat.contextControl.summaryMode'] === 'count'
    },
    'contextControl.summaryValueToken': {
        category: 'context',
        group: '概览发送范围',
        keywords: ['DCC', '摘要'],
        label: '概览额外发送范围 (Token)',
        type: 'stepper',
        default: 4000,
        min: 0,
        max: 20000,
        step: 100,
        allowedScopes: ['Global', 'Character'],
        showIf: (s) => s['lumina-chat.contextControl.summaryMode'] === 'token'
    },
    'contextControl.summaryValueChar': {
        category: 'context',
        group: '概览发送范围',
        keywords: ['DCC', '摘要'],
        label: '概览额外发送范围 (字符数)',
        type: 'stepper',
        default: 10000,
        min: 0,
        max: 50000,
        step: 100,
        allowedScopes: ['Global', 'Character'],
        showIf: (s) => s['lumina-chat.contextControl.summaryMode'] === 'char'
    },
    'contextControl.tokenSplitAllowed': {
        category: 'context',
        group: '截断与兜底',
        advanced: true,
        label: '允许 Token/字数 强制截断文本',
        type: 'boolean',
        default: false,
        description: '超出全量限制后，是否允许在单词/句子中间截断以严格遵守物理限制。',
        allowedScopes: ['Global', 'Character']
    },
    'contextControl.tokenMaxFloat': {
        category: 'context',
        group: '截断与兜底',
        advanced: true,
        label: 'Token/字数 允许浮动范围',
        type: 'stepper',
        default: 200,
        min: 0,
        max: 2000,
        allowedScopes: ['Global', 'Character']
    },
    'contextControl.enableFallbackSummary': {
        category: 'context',
        group: '截断与兜底',
        advanced: true,
        label: '无摘要消息兜底截断',
        type: 'boolean',
        default: false,
        description: '开启后，概况区内没有有效摘要的 AI 消息将截取原文前 100 字作为摘要（而非保留全量）。关闭（默认）则这类消息在概况区内以全量形式保留，更安全但占用更多 token。',
        allowedScopes: ['Global', 'Character']
    }
} satisfies LuminaPlugin['settingsManifest'];

const platformManifest: PluginManifestV2 = {
    id: 'lumina-chat',
    name: '剧情演播',
    primarySurface: 'chat.main',
    capabilities: [
        { id: 'conversation.playback', description: '渲染当前会话消息流。' },
        { id: 'conversation.generation', description: '通过聊天 intent 触发生成。' }
    ],
    settingsSchema,
    surfaces: [
        {
            id: 'character.roster',
            ownerPluginId: 'lumina-chat',
            description: '角色列表 surface。',
            requiredIntents: ['refresh', 'openSession', 'createSession', 'toggleGroup', 'importCharacter']
        },
        {
            id: 'conversation.sessionList',
            ownerPluginId: 'lumina-chat',
            description: '角色会话列表 surface。',
            requiredIntents: [
                'openSession',
                'renameSession',
                'deleteSession',
                'closeCurrentSession',
                'toggleGroupSessionExpansion'
            ]
        },
        {
            id: 'chat.transcript',
            ownerPluginId: 'lumina-chat',
            description: '消息与流式状态 surface。',
            requiredIntents: ['editMessage', 'deleteMessage', 'regenerate', 'branchMessage']
        },
        {
            id: 'chat.composer',
            ownerPluginId: 'lumina-chat',
            description: '输入与生成控制 surface。',
            requiredIntents: ['sendMessage', 'stopGeneration', 'togglePromptInspector']
        },
        {
            id: 'chat.promptInspector',
            ownerPluginId: 'lumina-chat',
            description: 'Prompt 查看、探测与编辑 surface。',
            requiredIntents: ['probePrompt', 'runEditedPrompt']
        },
        {
            id: 'chat.main',
            ownerPluginId: 'lumina-chat',
            description: '组合消息、Prompt Inspector 与输入区的主对话 surface。',
            requiredIntents: [
                'sendMessage',
                'stopGeneration',
                'editMessage',
                'deleteMessage',
                'regenerate',
                'branchMessage',
                'togglePromptInspector',
                'probePrompt',
                'runEditedPrompt'
            ]
        },
        { id: 'chat.preview', ownerPluginId: 'lumina-chat', description: '设置与主题中使用的对话预览 surface。' }
    ],
    businessRenderers: {
        'character.roster': {
            contractId: 'character.roster',
            component: CharacterRosterSurface,
            createContext: createCharacterRosterSurfaceContext
        },
        'conversation.sessionList': {
            contractId: 'conversation.sessionList',
            component: ConversationSessionListSurface,
            createContext: createConversationSessionListSurfaceContext
        },
        'chat.transcript': {
            contractId: 'chat.transcript',
            component: ChatTranscriptSurface,
            createContext: createChatTranscriptSurfaceContext
        },
        'chat.composer': {
            contractId: 'chat.composer',
            component: ChatComposerSurface,
            createContext: createChatComposerSurfaceContext
        },
        'chat.promptInspector': {
            contractId: 'chat.promptInspector',
            component: ChatPromptInspectorSurface,
            createContext: createChatPromptInspectorSurfaceContext
        },
        'chat.main': {
            contractId: 'chat.main',
            component: ChatMainSurface,
            createContext: createChatMainSurfaceContext
        },
        'chat.preview': { contractId: 'chat.preview', component: ChatPreview }
    }
};

const plugin: LuminaPlugin = {
    id: 'lumina-chat',
    name: '剧情演播',
    icon: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    component: ChatRoot,
    settingsPreviewSurface: { contractId: 'chat.preview', input: {} },
    settingsCategory: 'conversation',
    settingsManifest: settingsSchema,
    platformManifest
};

export default plugin;
