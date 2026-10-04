import { watch } from 'vue';
import { settingsDomainService } from '../../api/services/SettingsDomainService.js';
import { pluginManager } from '../../core/PluginManager.js';
import { desktopModeRegistrationVersion } from '../../desktop-modes/core/registry.js';
import {
    activeScopes,
    activeSettings,
    currentDetailedView,
    resetSetting,
    saveStatus,
    setSettingScope,
    setSettingValue,
    updateScope,
    updateSetting
} from '../../stores/settingsState.js';
import { getRegisteredSettingsCatalog } from './settingsRegistry.js';
import { planSettingsHydration, resolveInitialSettingScope, type SettingsHydrationItem } from './settingsHydration.js';

export {
    activeScopes,
    activeSettings,
    currentDetailedView,
    resetSetting,
    saveStatus,
    updateScope,
    updateSetting
};

const hydrateItems = (items: readonly SettingsHydrationItem[]): void => {
    items.forEach(({ storageKey, definition }) => {
        setSettingScope(storageKey, resolveInitialSettingScope(definition, settingsDomainService.getEffectiveScope(storageKey)));
        const value = settingsDomainService.getEffectiveValue(storageKey);
        setSettingValue(storageKey, value !== null && value !== undefined ? value : definition.default);
    });
};

let registrationWatchStarted = false;

// 运行时注册的插件或桌面模式出现后，只补齐新增的设置项，已载入的值不覆盖
const startRegistrationWatch = (): void => {
    if (registrationWatchStarted) return;
    registrationWatchStarted = true;
    watch([pluginManager.registrationVersion, desktopModeRegistrationVersion], () => {
        hydrateItems(planSettingsHydration(getRegisteredSettingsCatalog(), new Set(Object.keys(activeSettings))));
    });
};

export function useSettings() {
    // 从存储重新读取目录中全部设置的当前值与作用域
    const initSettings = (): void => {
        hydrateItems(planSettingsHydration(getRegisteredSettingsCatalog(), new Set()));
        startRegistrationWatch();
    };

    return {
        activeSettings,
        activeScopes,
        initSettings,
        resetSetting,
        saveStatus,
        updateSetting,
        updateScope
    };
}
