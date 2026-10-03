import { reactive, ref, onUnmounted, watch } from 'vue';
import type { StorageScope } from '../../api/storage.js';
import { settingsDomainService, type SettingsStorageChange } from '../../api/services/SettingsDomainService.js';
import { pluginManager } from '../../core/PluginManager.js';
import { desktopModeRegistrationVersion } from '../../desktop-modes/core/registry.js';
import type { SettingDefinition } from '../../types/plugin.js';
import { getRegisteredSettingsCatalog } from './settingsRegistry.js';
import { planSettingsHydration, resolveInitialSettingScope, type SettingsHydrationItem } from './settingsHydration.js';

// 全局响应式状态存放配置的当前值
export const activeSettings = reactive<Record<string, any>>({});
// 存放用户当前选择的编辑作用域，默认 Global
export const activeScopes = reactive<Record<string, string>>({});
// 同步状态指示器 'idle' | 'saving' | 'saved' | 'failed'
export const saveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
/**
 * 设置页路由：null 为概览，否则为分类 id（见 settingsTaxonomy）。
 * 兼容旧入口：传入插件 id 时打开该插件设置组件所在的分类。
 */
export const currentDetailedView = ref<string | null>(null);

const hydrateItems = (items: readonly SettingsHydrationItem[]): void => {
    items.forEach(({ storageKey, definition }) => {
        activeScopes[storageKey] = resolveInitialSettingScope(definition, settingsDomainService.getEffectiveScope(storageKey));
        const value = settingsDomainService.getEffectiveValue(storageKey);
        activeSettings[storageKey] = value !== null && value !== undefined ? value : definition.default;
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
    const initSettings = () => {
        hydrateItems(planSettingsHydration(getRegisteredSettingsCatalog(), new Set()));
        startRegistrationWatch();
    };

    // 存储更新时同步到 Vue 响应式数据
    const handleStorageChange = (data: SettingsStorageChange) => {
        if (data && data.key) {
            const canonicalKey = settingsDomainService.canonicalizeStorageKey(data.key);
            const targetKey = Object.prototype.hasOwnProperty.call(activeSettings, canonicalKey) ? canonicalKey : data.key;
            // Re-evaluate what is the effective value (since we might have modified Character scope but fallen back to Global)
            activeSettings[targetKey] = settingsDomainService.getEffectiveValue(targetKey);
        }
    };

    // 默认开启全局监听，确保多组件间状态同步
    const stopSettingsWatch = settingsDomainService.onAnyChange(handleStorageChange);

    onUnmounted(() => {
        stopSettingsWatch();
    });

    const updateSetting = async (storageKey: string, value: unknown) => {
        const scope = (activeScopes[storageKey] || 'Global') as StorageScope;
        activeSettings[storageKey] = value;
        try {
            saveStatus.value = 'saving';
            // 落盘到底层数据中
            await settingsDomainService.setSetting(storageKey, value, scope);
            showSaveSuccess();
        } catch (e) {
            showSaveFailed();
        }
    };

    /** 在当前编辑作用域写入 schema 默认值（存储层没有删除覆盖的接口） */
    const resetSetting = (storageKey: string, definition: Pick<SettingDefinition, 'default'>) =>
        updateSetting(storageKey, definition.default);

    const updateScope = async (storageKey: string, newScope: string) => {
        activeScopes[storageKey] = newScope;
        // 切换作用域后，我们可能需要重新拉取那个作用域下的值，或者维持现状并写入新底座
        // 此处逻辑：如果那个作用域下有独立值，拉取它；如果没有，拉取下钻的默认值
        const explicitValue = settingsDomainService.getEffectiveValue(storageKey, newScope as StorageScope);
        if (explicitValue !== null && explicitValue !== undefined) {
            activeSettings[storageKey] = explicitValue;
        } else {
            // 写入一次将当前显示值绑定到新作用域
            try {
                saveStatus.value = 'saving';
                await settingsDomainService.setSetting(storageKey, activeSettings[storageKey], newScope as StorageScope);
                showSaveSuccess();
            } catch (e) {
                showSaveFailed();
            }
        }
    };

    const showSaveSuccess = () => {
        setTimeout(() => {
            saveStatus.value = 'saved';
            setTimeout(() => {
                if (saveStatus.value === 'saved') saveStatus.value = 'idle';
            }, 2000);
        }, 300);
    };

    const showSaveFailed = () => {
        saveStatus.value = 'failed';
        setTimeout(() => {
            if (saveStatus.value === 'failed') saveStatus.value = 'idle';
        }, 3000);
    };

    return {
        activeSettings,
        activeScopes,
        initSettings,
        handleStorageChange,
        updateSetting,
        resetSetting,
        updateScope,
        saveStatus
    };
}
