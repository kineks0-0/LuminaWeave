import type { SettingDefinition, SettingScope } from '../../types/plugin.js';

export interface SettingsHydrationItem {
    storageKey: string;
    definition: SettingDefinition;
}

/**
 * 列出目录中尚未载入响应式状态的设置项。运行时注册的插件或桌面模式出现后，
 * 只补齐新增的 key，已载入的值不会被覆盖；注销时不清理，存储值保留。
 */
export const planSettingsHydration = (
    catalog: Readonly<Record<string, Readonly<Record<string, SettingDefinition>>>>,
    hydratedKeys: ReadonlySet<string>
): SettingsHydrationItem[] => {
    const plan: SettingsHydrationItem[] = [];
    Object.entries(catalog).forEach(([pluginId, manifest]) => {
        Object.entries(manifest).forEach(([settingKey, definition]) => {
            const storageKey = `${pluginId}.${settingKey}`;
            if (!hydratedKeys.has(storageKey)) plan.push({ storageKey, definition });
        });
    });
    return plan;
};

export const resolveInitialSettingScope = (
    definition: Pick<SettingDefinition, 'allowedScopes'>,
    storedScope: string | null
): SettingScope => {
    const allowed = definition.allowedScopes?.length ? definition.allowedScopes : (['Global'] as SettingScope[]);
    const fallback = allowed[0];
    return storedScope && (allowed as string[]).includes(storedScope) ? storedScope as SettingScope : fallback;
};
