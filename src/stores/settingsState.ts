import { reactive, ref } from 'vue';
import type { StorageScope } from '../api/storage.js';
import { settingsDomainService, type SettingsStorageChange } from '../api/services/SettingsDomainService.js';
import type { SettingDefinition } from '../types/plugin.js';

export type SettingsSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/** 全局响应式状态存放配置的当前值 */
export const activeSettings = reactive<Record<string, unknown>>({});
/** 存放用户当前选择的编辑作用域，默认 Global */
export const activeScopes = reactive<Record<string, string>>({});
/** 同步状态指示器 */
export const saveStatus = ref<SettingsSaveStatus>('idle');
/**
 * 设置页路由：null 为概览，否则为分类 id（见 settingsTaxonomy）。
 * 兼容旧入口：传入插件 id 时打开该插件设置组件所在的分类。
 */
export const currentDetailedView = ref<string | null>(null);

/**
 * 单一全局订阅：模块加载时注册一次，随应用存活。
 * 替代此前每次 `useSettings()` 调用各注册一个 `onAnyChange`（App 启动曾产生约 7-8 个重复订阅）。
 */
settingsDomainService.onAnyChange((data: SettingsStorageChange) => {
    if (!data?.key) return;
    const canonicalKey = settingsDomainService.canonicalizeStorageKey(data.key);
    const targetKey = Object.prototype.hasOwnProperty.call(activeSettings, canonicalKey) ? canonicalKey : data.key;
    activeSettings[targetKey] = settingsDomainService.getEffectiveValue(targetKey);
});

export const setSettingValue = (storageKey: string, value: unknown): void => {
    activeSettings[storageKey] = value;
};

export const setSettingScope = (storageKey: string, scope: string): void => {
    activeScopes[storageKey] = scope;
};

const showSaveSuccess = (): void => {
    setTimeout(() => {
        saveStatus.value = 'saved';
        setTimeout(() => {
            if (saveStatus.value === 'saved') saveStatus.value = 'idle';
        }, 2000);
    }, 300);
};

const showSaveFailed = (): void => {
    saveStatus.value = 'failed';
    setTimeout(() => {
        if (saveStatus.value === 'failed') saveStatus.value = 'idle';
    }, 3000);
};

export const updateSetting = async (storageKey: string, value: unknown): Promise<void> => {
    const scope = (activeScopes[storageKey] || 'Global') as StorageScope;
    activeSettings[storageKey] = value;
    try {
        saveStatus.value = 'saving';
        await settingsDomainService.setSetting(storageKey, value, scope);
        showSaveSuccess();
    } catch (e) {
        showSaveFailed();
    }
};

/** 在当前编辑作用域写入 schema 默认值（存储层没有删除覆盖的接口） */
export const resetSetting = (storageKey: string, definition: Pick<SettingDefinition, 'default'>): Promise<void> =>
    updateSetting(storageKey, definition.default);

export const updateScope = async (storageKey: string, newScope: string): Promise<void> => {
    activeScopes[storageKey] = newScope;
    // 切换作用域后：该作用域已有独立值时拉取它，否则写入一次将当前显示值绑定到新作用域
    const explicitValue = settingsDomainService.getEffectiveValue(storageKey, newScope as StorageScope);
    if (explicitValue !== null && explicitValue !== undefined) {
        activeSettings[storageKey] = explicitValue;
        return;
    }
    try {
        saveStatus.value = 'saving';
        await settingsDomainService.setSetting(storageKey, activeSettings[storageKey], newScope as StorageScope);
        showSaveSuccess();
    } catch (e) {
        showSaveFailed();
    }
};
