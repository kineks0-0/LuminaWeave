import type { SettingDefinition, SettingOption } from '../../types/plugin';

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
    config.type === 'nexus-select' ||
    config.type === 'options' ||
    config.type === 'theme' ||
    settingKey === 'fontFamily';

export const getSettingControlClass = (
    config: SettingControlConfig,
    isVerticalLayout: boolean
): string => {
    const classes: string[] = [];
    if (config.type === 'theme') classes.push('theme-options');
    if (config.type === 'stepper') classes.push('stepper-control');
    if (isVerticalLayout) classes.push('full-width');
    return classes.join(' ');
};

export const getSettingControlBodyClass = (config: SettingControlConfig): string => {
    const classes: string[] = [];
    if (config.type === 'theme') classes.push('theme-options');
    if (config.type === 'options') classes.push('options-control');
    if (config.type === 'stepper') classes.push('stepper-body');
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
