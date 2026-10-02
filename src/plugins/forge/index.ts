import { defineAsyncComponent } from 'vue';
import { LuminaPlugin } from '../../types/plugin.js';
import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from './forgeAuxPanels.js';
import type { PluginManifestV2 } from '../../platform/plugin/types.js';
import { forgeConversationGateway } from '../../api/core/forge/project/ForgeConversationGateway.js';
import { useCardMakerStore } from './CardMakerStore.js';
import { ForgeAuxPanelView } from './app/forgeAsyncComponents.js';

const CardMakerPanel = defineAsyncComponent(() => import('./app/CardMakerPanel.vue'));
const ForgePromptPresetInlineSummary = defineAsyncComponent(() => import('./ForgePromptPresetInlineSummary.vue'));
const ForgePromptPresetWorkbench = defineAsyncComponent(() => import('./ForgePromptPresetWorkbench.vue'));

const settingsSchema = {
    nexusPreset: {
        default: '',
        label: '制卡专用 Nexus 预设',
        description: '为 Forge 制卡流程指定独立的生成链路。若未指定，将自动跟随聊天主预设。',
        common: true,
        type: 'nexus-select',
        allowedScopes: ['Global']
    },
    tavilyApiKey: {
        default: '',
        label: 'Tavily API Key',
        description: '用于 Forge Agent 的 webResearch 联网研究工具。该值按现有设置存储持久化，界面仅遮罩显示，不提供加密 secret storage。',
        common: true,
        type: 'password',
        allowedScopes: ['Global']
    },
    formAssistanceMode: {
        default: 'prefill',
        label: '表单辅助模式',
        description: '选择 Forge 如何辅助你填写表单。自动预填 (Prefill) 会直接写入建议值；预设建议 (Suggestion) 则在输入框下方显示可选芯片供你点击；关闭则完全手动。',
        common: true,
        type: 'options',
        options: [
            { value: 'prefill', label: '自动预填 (Prefill)' },
            { value: 'suggestion', label: '预设建议 (Suggestion)' },
            { value: 'off', label: '关闭辅助 (Off)' }
        ],
        allowedScopes: ['Global']
    },
    maxHistoryMessages: {
        default: 20,
        label: '对话历史发送条数',
        description: '发送给模型时，对话历史最多保留的最近 N 条消息（Planner / Conversation 角色）。Analyst 角色有独立的截断配置，默认 10 条。设为 0 表示不限制。',
        common: true,
        type: 'stepper',
        min: 0,
        max: 200,
        step: 5,
        allowedScopes: ['Global']
    },
    entryContentFormat: {
        default: 'json',
        label: '条目内容格式',
        description: '指定模型通过 tool calling 生成写入提案时使用的数据格式。JSON 最易被系统解析；YAML 更易阅读；TOML 适合键值配置；自由格式则不限制结构。',
        common: true,
        type: 'options',
        options: [
            { value: 'json', label: 'JSON（推荐）' },
            { value: 'yaml', label: 'YAML' },
            { value: 'toml', label: 'TOML' },
            { value: 'free', label: '自由格式' }
        ],
        allowedScopes: ['Global']
    },
    aiReplyFontSize: {
        default: 14,
        label: 'AI 回复字号',
        description: '仅影响 Forge 工作台中 AI 回复正文，不影响主聊天或其他桌面模式。',
        common: true,
        type: 'slider',
        min: 11,
        max: 20,
        step: 0.5,
        allowedScopes: ['Global']
    },
    aiReplyLineHeight: {
        default: 1.7,
        label: 'AI 回复行距',
        description: '控制 Forge AI 回复正文行高。长文本建议保持 1.55 以上。',
        common: true,
        type: 'slider',
        min: 1.2,
        max: 2.2,
        step: 0.05,
        allowedScopes: ['Global']
    },
    aiReplyLetterSpacing: {
        default: 0,
        label: 'AI 回复字距',
        description: '控制 Forge AI 回复正文的字距，单位 px。中文正文通常保持 0。',
        common: true,
        type: 'slider',
        min: 0,
        max: 1.2,
        step: 0.05,
        allowedScopes: ['Global']
    },
    userInputFontSize: {
        default: 14,
        label: '用户输入字号',
        description: '影响 Forge 用户消息与底部输入框文字。',
        common: true,
        type: 'slider',
        min: 11,
        max: 20,
        step: 0.5,
        allowedScopes: ['Global']
    },
    userInputLineHeight: {
        default: 1.5,
        label: '用户输入行距',
        description: '影响 Forge 用户消息与底部输入框行高。',
        common: true,
        type: 'slider',
        min: 1.2,
        max: 2,
        step: 0.05,
        allowedScopes: ['Global']
    },
    userInputLetterSpacing: {
        default: 0,
        label: '用户输入字距',
        description: '控制 Forge 用户消息与输入框字距，单位 px。',
        common: true,
        type: 'slider',
        min: 0,
        max: 1.2,
        step: 0.05,
        allowedScopes: ['Global']
    },
    componentFontSize: {
        default: 12,
        label: '组件字号',
        description: '影响 Forge 消息内表单、选项、提案等组件文本。',
        common: true,
        type: 'slider',
        min: 10,
        max: 18,
        step: 0.5,
        allowedScopes: ['Global']
    },
    componentLineHeight: {
        default: 1.45,
        label: '组件行距',
        description: '影响 Forge 消息内组件文本行高。',
        common: true,
        type: 'slider',
        min: 1.15,
        max: 2,
        step: 0.05,
        allowedScopes: ['Global']
    },
    componentLetterSpacing: {
        default: 0,
        label: '组件字距',
        description: '影响 Forge 消息内组件文本字距，单位 px。',
        common: true,
        type: 'slider',
        min: 0,
        max: 1.2,
        step: 0.05,
        allowedScopes: ['Global']
    }
} satisfies LuminaPlugin['settingsManifest'];

const platformManifest: PluginManifestV2 = {
    id: 'lumina-forge',
    name: '制卡工坊',
    primarySurface: 'forge.workspace',
    capabilities: [
        { id: 'forge.workspace', description: '运行 Forge 制卡工作流与工作台。' },
        { id: 'forge.prompt-presets', description: '管理 Forge 主模型、执行模型和测试聊天预设。' }
    ],
    settingsSchema,
    surfaces: [
        { id: 'forge.workspace', ownerPluginId: 'lumina-forge', description: 'Forge 主工作台 surface。' },
        { id: 'forge.settings.summary', ownerPluginId: 'lumina-forge', description: 'Forge 设置概览 surface。' },
        { id: 'forge.settings.workbench', ownerPluginId: 'lumina-forge', description: 'Forge Prompt Preset 工作台 surface。' }
    ],
    businessRenderers: {
        'forge.workspace': { contractId: 'forge.workspace', component: CardMakerPanel },
        'forge.settings.summary': { contractId: 'forge.settings.summary', component: ForgePromptPresetInlineSummary },
        'forge.settings.workbench': { contractId: 'forge.settings.workbench', component: ForgePromptPresetWorkbench }
    }
};

/**
 * Forge (制卡工坊) 插件
 * 提供五阶段前台流程 + 七层后台设计模型。
 * 当前已从 App.vue 手动注册模式迁移至标准插件化模式。
 */
const plugin: LuminaPlugin = {
    id: 'lumina-forge',
    name: '制卡工坊',
    icon: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    component: CardMakerPanel,
    settingsInlineComponent: ForgePromptPresetInlineSummary,
    settingsPreviewComponent: ForgePromptPresetWorkbench,
    settingsManifest: settingsSchema,
    platformManifest,
    init() {
        forgeConversationGateway.setStoreProvider(() => useCardMakerStore());

        // 在微内核中注册面板，以便通过 ID 唤起 (兼容旧有 Tab/Window 调度)
        const lw = (window as any).LuminaWeave;
        const desktopSurface = lw?.services?.desktopSurface;
        if (desktopSurface && typeof desktopSurface.registerPanel === 'function') {
            desktopSurface.registerPanel('card_maker', CardMakerPanel, {
                title: '制卡工坊',
                icon: '🧩',
                defaultMode: 'tab',
                surfaceContractId: 'forge.workspace'
            });

            FORGE_AUX_PANEL_ORDER.forEach((kind) => {
                const panel = FORGE_AUX_PANEL_META[kind];
                desktopSurface.registerPanel(panel.id, ForgeAuxPanelView, {
                    title: panel.title,
                    icon: panel.icon,
                    defaultMode: 'tab',
                    defaultInput: { kind },
                    navigation: { group: '制卡辅助' }
                });
            });
        }
        console.log('[Plugin: Forge] initialized');
    }
};

export default plugin;
