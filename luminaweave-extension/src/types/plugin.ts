import { Component } from 'vue';

export interface SettingOption {
    value: string | number;
    label: string;
    description?: string;
}

export interface SettingDefinition {
    default: any;
    label: string;
    description?: string;
    common?: boolean;
    type: 'theme' | 'options' | 'stepper' | 'nexus-select' | 'slider' | 'boolean' | 'text';
    options?: SettingOption[];
    allowedScopes?: ('Global' | 'Character' | 'Chat' | 'Session')[];
    min?: number;
    max?: number;
    step?: number;
    /** 条件显示：根据当前设置状态决定该项是否显示 */
    showIf?: (settings: Record<string, any>) => boolean;
}

export interface LuminaPlugin {
    id: string;
    name: string;
    icon: string;
    slots: ('mainView' | 'widget' | 'headerCenter' | 'headerRight')[];
    component: Component;
    headerCenterComponent?: Component;
    headerRightComponent?: Component;
    settingsPreviewComponent?: Component;
    settingsManifest?: Record<string, SettingDefinition>;
    init?: () => void;
    hooks?: {
        /** 在消息被添加到历史记录前触发，常用于注入快照 (snapshots) */
        onMessageAdding?: (message: any, trace: any[]) => void;
        /** 在消息被添加到历史记录后触发，常用于异步规划或后台任务 */
        onMessageAdded?: (message: any, trace: any[]) => void;
        /** 在 LLM 生成彻底结束后触发，常用于状态清理 */
        onGenerationEnded?: (finalText: string) => void;
        /** 当用户在时间轴切换选中的消息节点时触发，用于“时空倒流”状态恢复 */
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
