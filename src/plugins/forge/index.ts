import { LuminaPlugin } from '../../types/plugin';
import CardMakerPanel from './CardMakerPanel.vue';
import ForgeAuxPanelView from './ForgeAuxPanelView.vue';
import ForgeTestChatSettings from './ForgeTestChatSettings.vue';
import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from './forgeAuxPanels';

/**
 * Forge (制卡工坊) 插件
 * 提供五阶段前台流程 + 七层后台设计模型。
 * 当前已从 App.vue 手动注册模式迁移至标准插件化模式。
 */
const plugin: LuminaPlugin = {
    id: 'lumina-forge',
    name: '制卡工坊',
    icon: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    slots: ['mainView'], // 默认在主视图显示
    component: CardMakerPanel,
    settingsInlineComponent: ForgeTestChatSettings,
    settingsManifest: {
        nexusPreset: {
            default: '',
            label: '制卡专用 Nexus 预设',
            description: '为 Forge 制卡流程指定独立的生成链路。若未指定，将自动跟随聊天主预设。',
            common: true,
            type: 'nexus-select',
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
            description: '指定模型在 <entry_update> 内输出条目正文时使用的数据格式。JSON 最易被系统解析；YAML 更易阅读；TOML 适合键值配置；自由格式则不限制结构。',
            common: true,
            type: 'options',
            options: [
                { value: 'json', label: 'JSON（推荐）' },
                { value: 'yaml', label: 'YAML' },
                { value: 'toml', label: 'TOML' },
                { value: 'free', label: '自由格式' }
            ],
            allowedScopes: ['Global']
        }
    },
    init() {
        // 在微内核中注册面板，以便通过 ID 唤起 (兼容旧有 Tab/Window 调度)
        const lw = (window as any).LuminaWeave;
        if (lw && typeof lw.registerPanel === 'function') {
            lw.registerPanel('card_maker', CardMakerPanel, {
                title: '制卡工坊',
                icon: '🧩',
                defaultMode: 'tab'
            });

            FORGE_AUX_PANEL_ORDER.forEach((kind) => {
                const panel = FORGE_AUX_PANEL_META[kind];
                lw.registerPanel(panel.id, ForgeAuxPanelView, {
                    title: panel.title,
                    icon: panel.icon,
                    defaultMode: 'tab'
                });
            });
        }
        console.log('[Plugin: Forge] initialized');
    }
};

export default plugin;
