import type { SettingDefinition, SettingOption } from '../../types/plugin.js';

export type SettingControlConfig = SettingDefinition;

export const settingScopeLabels: Record<string, string> = {
    Global: '全局',
    Character: '随角色',
    Chat: '随对话',
    Session: '仅本地缓存'
};

export const getSettingStorageKey = (pluginId: string, settingKey: string): string => `${pluginId}.${settingKey}`;

export const getSettingValue = (
    activeSettings: Record<string, any>,
    storageKey: string,
    defaultValue: any
): any => {
    const value = activeSettings[storageKey];
    return value !== undefined && value !== null ? value : defaultValue;
};

export const getSettingScope = (
    activeScopes: Record<string, string>,
    storageKey: string,
    allowedScopes?: string[]
): string => activeScopes[storageKey] || allowedScopes?.[0] || 'Global';

export const isSettingVisible = (
    config: SettingControlConfig,
    settings: Record<string, any>
): boolean => {
    if (typeof config.showIf !== 'function') {
        return true;
    }

    return config.showIf(settings);
};

export const hasSettingScopeSelector = (config: SettingControlConfig): boolean =>
    Boolean(config.allowedScopes && config.allowedScopes.length > 1);

export const resolveSettingOptions = (config: SettingControlConfig): SettingOption[] => {
    if (!config.options) {
        return [];
    }

    return typeof config.options === 'function' ? config.options() : config.options;
};

export const getActiveSettingOptionDescription = (
    options: SettingOption[],
    currentValue: any
): string | null => {
    const option = options.find(item => item.value === currentValue);
    return option?.description || null;
};

export const isRowToggleSetting = (config: SettingControlConfig, settingKey: string): boolean =>
    config.type === 'boolean' && settingKey === 'discord-channel-mark';

export const shouldUseVerticalSettingLayout = (
    config: SettingControlConfig,
    settingKey: string
): boolean =>
    config.type === 'slider' ||
    config.type === 'text' ||
    config.type === 'password' ||
    config.type === 'nexus-select' ||
    config.type === 'options' ||
    config.type === 'theme' ||
    settingKey === 'fontFamily';

export const getSettingControlClass = (
    config: SettingControlConfig,
    isVerticalLayout: boolean
): string => {
    const classes: string[] = [];
    if (config.type === 'theme') classes.push('theme-options tw:flex-wrap tw:gap-2.5');
    if (config.type === 'stepper') classes.push('stepper-control');
    if (isVerticalLayout) classes.push('full-width');
    return classes.join(' ');
};

export const getSettingControlBodyClass = (config: SettingControlConfig): string => {
    const classes: string[] = [];
    if (config.type === 'theme') classes.push('theme-options');
    if (config.type === 'options') classes.push('options-control');
    if (config.type === 'stepper') classes.push('stepper-body tw:max-[720px]:justify-start');
    return classes.join(' ');
};

export const clampSettingNumber = (
    rawValue: string,
    config: Pick<SettingControlConfig, 'min' | 'max'>
): number | null => {
    const value = Number.parseFloat(rawValue);
    if (Number.isNaN(value)) {
        return null;
    }

    const min = config.min ?? 0;
    const max = config.max ?? 100;
    return Math.max(min, Math.min(max, value));
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isStructurallyEqual = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length && left.every((item, index) => isStructurallyEqual(item, right[index]));
    }
    if (isPlainObject(left) && isPlainObject(right)) {
        const leftKeys = Object.keys(left);
        return leftKeys.length === Object.keys(right).length
            && leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) && isStructurallyEqual(left[key], right[key]));
    }
    return false;
};

/** 未写入（null/undefined）的值视为默认值 */
export const isSettingAtDefault = (value: unknown, defaultValue: unknown): boolean =>
    value === undefined || value === null || isStructurallyEqual(value, defaultValue);

export type SettingControlKind =
    | 'theme'
    | 'segmented'
    | 'select'
    | 'toggle'
    | 'stepper'
    | 'slider'
    | 'nexus-select'
    | 'text'
    | 'password';

/** 选项不超过该数量时用分段控件，否则用下拉框 */
export const SEGMENTED_OPTION_LIMIT = 3;

export const resolveControlKind = (config: SettingControlConfig): SettingControlKind => {
    switch (config.type) {
        case 'boolean': return 'toggle';
        case 'options': return resolveSettingOptions(config).length <= SEGMENTED_OPTION_LIMIT ? 'segmented' : 'select';
        case 'theme': return 'theme';
        case 'stepper': return 'stepper';
        case 'slider': return 'slider';
        case 'nexus-select': return 'nexus-select';
        case 'text': return 'text';
        case 'password': return 'password';
    }
};

/** 存储值不在当前可选项中（例如已卸载的桌面模式）时，显示实际生效的默认项，存储值不变 */
export const resolveDisplayedOptionValue = (
    options: readonly SettingOption[],
    value: unknown,
    defaultValue: unknown
): unknown => {
    if (options.length === 0) return value;
    return options.some(option => option.value === value) ? value : defaultValue;
};

/** 原生 select 只回传字符串，按字符串比对还原为选项原始值（保留数字类型） */
export const resolveSelectedOptionValue = (
    options: readonly SettingOption[],
    rawValue: string
): string | number => options.find(option => String(option.value) === rawValue)?.value ?? rawValue;
