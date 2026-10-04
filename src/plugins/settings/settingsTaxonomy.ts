import type { SettingDefinition, SettingsCategoryId } from '../../types/plugin.js';

/**
 * 设置页的任务分类。纯数据与纯函数，不依赖 Vue 或插件注册表，便于测试。
 * 分类归属由设置项自身的 `category` 声明；桌面模式的设置固定归入“外观与桌面”，
 * 未声明的第三方设置归入“高级”并按插件名分组。
 */

export type SettingsCategoryIcon =
    | 'palette'
    | 'message'
    | 'cpu'
    | 'brain'
    | 'hammer'
    | 'database'
    | 'wrench';

export interface SettingsCategory {
    id: SettingsCategoryId;
    label: string;
    description: string;
    icon: SettingsCategoryIcon;
}

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
    { id: 'appearance', label: '外观与桌面', description: '明暗、桌面模式、动效与窗口布局', icon: 'palette' },
    { id: 'conversation', label: '对话与流式', description: '吐字效果、回复过滤、思维链与互动组件', icon: 'message' },
    { id: 'generation', label: '模型与生成', description: '模型预设、生成参数与提示词注入', icon: 'cpu' },
    { id: 'context', label: '上下文与记忆', description: '历史发送范围、长线记忆与世界书', icon: 'brain' },
    { id: 'workshop', label: '工坊', description: 'Forge 制卡流程、联网研究与排版', icon: 'hammer' },
    { id: 'storage', label: '存储与同步', description: '与 SillyTavern 的同步、存储位置与迁移', icon: 'database' },
    { id: 'advanced', label: '高级', description: '插件权限、样式隔离与开发者工具', icon: 'wrench' }
];

export const DEFAULT_SETTINGS_CATEGORY: SettingsCategoryId = 'advanced';

const CATEGORY_IDS = new Set<string>(SETTINGS_CATEGORIES.map(category => category.id));

export const isSettingsCategoryId = (value: unknown): value is SettingsCategoryId =>
    typeof value === 'string' && CATEGORY_IDS.has(value);

export const getSettingsCategory = (categoryId: SettingsCategoryId): SettingsCategory =>
    SETTINGS_CATEGORIES.find(category => category.id === categoryId) ?? SETTINGS_CATEGORIES[SETTINGS_CATEGORIES.length - 1];

/** 概览页只放最常改的几项（存储 key） */
export const OVERVIEW_SETTING_KEYS: readonly string[] = [
    'lumina-settings.appearance',
    'lumina-settings.activeDesktopMode',
    'lumina-chat.streamingEffect',
    'lumina-settings.thinkingDisplayMode',
    'lumina-chat.nexusPreset',
    'lumina-settings.motionPerformance'
];

export type SettingsPanelId =
    | 'nexus-presets'
    | 'generation-preset'
    | 'chat-prompt-presets'
    | 'chat-regex-scripts'
    | 'sync-status'
    | 'storage-migration'
    | 'plugin-prompt-permissions';

/** 分类页里不由 schema 生成的整块面板（组件映射见 settingsPanels.ts） */
export interface SettingsPanelDefinition {
    id: SettingsPanelId;
    category: SettingsCategoryId;
    title: string;
    description: string;
    keywords: string[];
}

export const SETTINGS_PANELS: readonly SettingsPanelDefinition[] = [
    {
        id: 'nexus-presets',
        category: 'generation',
        title: '模型与网关预设',
        description: '管理自定义 API、模型与密钥，供聊天、状态分析与工坊选用。',
        keywords: ['Nexus', 'API', '密钥', 'Key', '网关', '模型', '预设']
    },
    {
        id: 'generation-preset',
        category: 'generation',
        title: '全局生成参数',
        description: '切换 SillyTavern 当前 API 使用的生成参数预设。',
        keywords: ['温度', 'temperature', '采样', '生成参数', 'preset']
    },
    {
        id: 'chat-prompt-presets',
        category: 'generation',
        title: '提示词预设库',
        description: '导入、编辑与启用聊天使用的提示词预设（ST Chat Completion 兼容）。',
        keywords: ['预设', 'preset', '提示词', 'prompt', 'Chat Completion', '导入', '导出']
    },
    {
        id: 'chat-regex-scripts',
        category: 'generation',
        title: '消息净化',
        description: '内置 XML 标签过滤与正则脚本，控制消息在显示、写回与提示词中的形态。',
        keywords: ['正则', 'regex', '替换', '过滤', '脚本', '测试', '净化', '后处理', '标签', 'XML']
    },
    {
        id: 'sync-status',
        category: 'storage',
        title: '同步状态',
        description: '查看与 SillyTavern 的同步结果，处理数据差异。',
        keywords: ['同步', '差异', '冲突', '回写', '强制同步', 'ST']
    },
    {
        id: 'storage-migration',
        category: 'storage',
        title: '存储位置与迁移',
        description: '全局设置的持久化位置，以及导入导出。',
        keywords: ['存储', '迁移', '导入', '导出', 'JSON', 'JSONL', '备份']
    },
    {
        id: 'plugin-prompt-permissions',
        category: 'advanced',
        title: '插件提示词注入',
        description: '逐个控制插件是否可以向提示词注入内容。',
        keywords: ['权限', '提示词', '注入', 'prompt']
    }
];

export interface SettingsSourceDescriptor {
    pluginId: string;
    pluginName: string;
    kind: 'plugin' | 'desktop-mode';
    manifest: Readonly<Record<string, SettingDefinition>>;
    /** 插件声明的设置组件分类（预览/内嵌组件） */
    settingsCategory?: SettingsCategoryId;
    /** 是否带有插件自身的设置组件 */
    hasPluginComponent: boolean;
}

export interface CategorizedSetting {
    storageKey: string;
    pluginId: string;
    pluginName: string;
    settingKey: string;
    definition: SettingDefinition;
    category: SettingsCategoryId;
    group: string;
    advanced: boolean;
}

export type SettingsCategoryIndex = Record<SettingsCategoryId, CategorizedSetting[]>;

export const resolveSettingCategory = (
    source: Pick<SettingsSourceDescriptor, 'kind'>,
    definition: Pick<SettingDefinition, 'category'>
): SettingsCategoryId => {
    if (source.kind === 'desktop-mode') return 'appearance';
    return isSettingsCategoryId(definition.category) ? definition.category : DEFAULT_SETTINGS_CATEGORY;
};

const resolveSettingGroup = (source: SettingsSourceDescriptor, definition: SettingDefinition): string => {
    const group = definition.group?.trim();
    if (source.kind === 'desktop-mode') return group ? `${source.pluginName} · ${group}` : source.pluginName;
    return group || source.pluginName;
};

const createEmptyIndex = (): SettingsCategoryIndex => ({
    appearance: [],
    conversation: [],
    generation: [],
    context: [],
    workshop: [],
    storage: [],
    advanced: []
});

export const buildSettingsCategoryIndex = (sources: readonly SettingsSourceDescriptor[]): SettingsCategoryIndex => {
    const index = createEmptyIndex();
    sources.forEach(source => {
        Object.entries(source.manifest).forEach(([settingKey, definition]) => {
            const category = resolveSettingCategory(source, definition);
            index[category].push({
                storageKey: `${source.pluginId}.${settingKey}`,
                pluginId: source.pluginId,
                pluginName: source.pluginName,
                settingKey,
                definition,
                category,
                group: resolveSettingGroup(source, definition),
                advanced: definition.advanced === true
            });
        });
    });
    return index;
};

export interface SettingsGroup {
    label: string;
    settings: CategorizedSetting[];
}

/** 按分组首次出现的顺序归并，组内保持声明顺序 */
export const groupCategorySettings = (settings: readonly CategorizedSetting[]): SettingsGroup[] => {
    const groups: SettingsGroup[] = [];
    const byLabel = new Map<string, SettingsGroup>();
    settings.forEach(setting => {
        let group = byLabel.get(setting.group);
        if (!group) {
            group = { label: setting.group, settings: [] };
            byLabel.set(setting.group, group);
            groups.push(group);
        }
        group.settings.push(setting);
    });
    return groups;
};

export const resolvePluginComponentCategory = (
    source: Pick<SettingsSourceDescriptor, 'kind' | 'manifest' | 'settingsCategory'>
): SettingsCategoryId => {
    if (source.kind === 'desktop-mode') return 'appearance';
    if (isSettingsCategoryId(source.settingsCategory)) return source.settingsCategory;
    const [firstDefinition] = Object.values(source.manifest);
    return firstDefinition ? resolveSettingCategory(source, firstDefinition) : DEFAULT_SETTINGS_CATEGORY;
};

/** 显式打开概览页的路由值；null 表示设置首页（大窗为概览，小窗为分类列表） */
export const SETTINGS_OVERVIEW_ROUTE = 'overview';

export type SettingsView =
    | { kind: 'home' }
    | { kind: 'overview' }
    | { kind: 'category'; categoryId: SettingsCategoryId };

/**
 * 解析设置页路由值（`currentDetailedView`）。null 为首页，'overview' 为概览，分类 id 直接打开分类页；
 * 插件 id 或桌面模式设置 id（旧入口）打开其设置组件所在的分类。
 */
export const resolveSettingsView = (
    value: string | null,
    sources: readonly Pick<SettingsSourceDescriptor, 'pluginId' | 'kind' | 'manifest' | 'settingsCategory'>[]
): SettingsView => {
    if (!value) return { kind: 'home' };
    if (value === SETTINGS_OVERVIEW_ROUTE) return { kind: 'overview' };
    if (isSettingsCategoryId(value)) return { kind: 'category', categoryId: value };
    const source = sources.find(item => item.pluginId === value);
    return source
        ? { kind: 'category', categoryId: resolvePluginComponentCategory(source) }
        : { kind: 'home' };
};
