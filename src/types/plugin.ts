import type { Component } from 'vue';
import type { PluginManifestV2 } from '../platform/plugin/types.js';
import type {
    SurfaceContractId,
    SurfaceInput
} from '../platform/surface/types.js';

export type SettingsPreviewSurface = {
    [K in SurfaceContractId]: Readonly<{
        contractId: K;
        input: SurfaceInput<K>;
    }>;
}[SurfaceContractId];

export interface SettingOption {
    value: string | number;
    label: string;
    description?: string;
}

export type SettingOptionsResolver = SettingOption[] | (() => SettingOption[]);

/** 设置页按任务划分的分类；未声明或无法识别的设置归入“高级”。 */
export type SettingsCategoryId =
    | 'appearance'
    | 'conversation'
    | 'generation'
    | 'context'
    | 'workshop'
    | 'storage'
    | 'advanced';

export type SettingScope = 'Global' | 'Character' | 'Chat' | 'Session';

export interface SettingDefinition {
    default: unknown;
    label: string;
    description?: string;
    type: 'theme' | 'options' | 'stepper' | 'nexus-select' | 'slider' | 'boolean' | 'text' | 'password';
    options?: SettingOptionsResolver;
    allowedScopes?: SettingScope[];
    min?: number;
    max?: number;
    step?: number;
    /** 所属分类；桌面模式的设置固定归入“外观与桌面” */
    category?: SettingsCategoryId;
    /** 分类页内的分组标题；未声明时按插件名分组 */
    group?: string;
    /** 高级选项：默认折叠，需在分类页打开“显示高级选项” */
    advanced?: boolean;
    /** 额外的搜索关键词（同义词、英文名等） */
    keywords?: string[];
    /** 条件显示：根据当前设置状态决定该项是否显示 */
    showIf?: (settings: Readonly<Record<string, unknown>>) => boolean;
}

export interface LuminaPlugin {
    id: string;
    name: string;
    icon: string;
    slots?: ('mainView' | 'widget' | 'headerCenter' | 'headerRight')[];
    component: Component;
    headerCenterComponent?: Component;
    headerRightComponent?: Component;
    settingsPreviewComponent?: Component;
    settingsPreviewSurface?: SettingsPreviewSurface;
    /** 设置页中插件自带的设置组件，显示在该插件分类页的设置项之后 */
    settingsInlineComponent?: Component;
    /** settingsPreviewComponent / settingsPreviewSurface / settingsInlineComponent 所在的分类；未声明时取第一个设置项的分类 */
    settingsCategory?: SettingsCategoryId;
    settingsManifest?: Record<string, SettingDefinition>;
    platformManifest?: PluginManifestV2;
    init?: () => void;
    hooks?: {
        /** 在消息被添加到历史记录前触发，常用于注入快照 (snapshots) */
        onMessageAdding?: (message: any, trace: any[]) => void;
        /** 在消息被添加到历史记录后触发，常用于异步规划或后台任务 */
        onMessageAdded?: (message: any, trace: any[]) => void;
        /** 在 LLM 生成彻底结束后触发，常用于状态清理 */
        onGenerationEnded?: (finalText: string) => void;
        /** 当用户在时间轴进行“时间穿越”（回溯或分支切换）时触发 [推荐使用] */
        onTimeTravel?: (nodeId: string, trace: any[], options: { isBranchSwitch: boolean }) => void;
        /** [已废弃] 当用户在时间轴切换选中的消息节点时触发，请迁移至 onTimeTravel */
        onMessageSelected?: (messageId: string, trace: any[]) => void;
        /** 当整个对话（Chat）加载完成后触发，用于恢复初始状态 */
        onChatLoaded?: (activeLeafId: string | null, nodes: any[]) => void;
        /** 对话快照执行物理导出与保存前，允许插件注入自己的持久化元数据 */
        onMetadataExport?: (metadata: Record<string, any>) => void;
        /** 载入含有全局状态的对话快照时，派发给各插件用来恢复环境 */
        onMetadataImport?: (metadata: Record<string, any> | null) => void;
    },
    /** 
     * 动态判断插件是否启用/显示。
     * 用于根据设置实时切换功能入口（如开发菜单）。
     */
    isEnabled?: () => boolean;
}
