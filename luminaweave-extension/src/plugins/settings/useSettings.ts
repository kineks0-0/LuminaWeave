import { reactive, ref, onUnmounted } from 'vue';
import { lwStorage } from '../../api/storage';
import { getRegisteredSettingsCatalog } from './settingsRegistry';
import { getCanonicalSettingsStorageKey, getLegacySettingsStorageKey } from '../../theme/themeRegistry';

// 全局响应式状态存放配置的当前值
export const activeSettings = reactive<Record<string, any>>({});
// 存放用户当前选择的编辑作用域，默认 Global
export const activeScopes = reactive<Record<string, string>>({});
// 同步状态指示器 'idle' | 'saving' | 'saved' | 'failed'
export const saveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
// 当前显示的详细设置面板 ID (用于头部导航整合)
export const currentDetailedView = ref<string | null>(null);

export function useSettings() {
    const resolveStoredValue = (storageKey: string, scope?: string) => {
        const primaryValue = scope !== undefined
            ? (lwStorage as any).get(storageKey, scope)
            : lwStorage.get(storageKey);
        if (primaryValue !== null && primaryValue !== undefined) {
            return primaryValue;
        }
        const legacyStorageKey = getLegacySettingsStorageKey(storageKey);
        if (!legacyStorageKey) {
            return primaryValue;
        }
        return scope !== undefined
            ? (lwStorage as any).get(legacyStorageKey, scope)
            : lwStorage.get(legacyStorageKey);
    };

    const resolveStoredScope = (storageKey: string) => {
        const directScope = (lwStorage as any).getScopeOf(storageKey);
        if (directScope) {
            return directScope;
        }
        const legacyStorageKey = getLegacySettingsStorageKey(storageKey);
        return legacyStorageKey ? (lwStorage as any).getScopeOf(legacyStorageKey) : null;
    };

    // 初始化并拉取最新值
    const initSettings = () => {
        const registered = getRegisteredSettingsCatalog();
        Object.keys(registered).forEach(pluginId => {
            const manifest = registered[pluginId];
            Object.keys(manifest).forEach(key => {
                const storageKey = `${pluginId}.${key}`;
                const fallback = manifest[key].allowedScopes && manifest[key].allowedScopes.length ? manifest[key].allowedScopes[0] : 'Global';
                const realScope = resolveStoredScope(storageKey);

                if (realScope) {
                    const allowed = manifest[key].allowedScopes || ['Global'];
                    activeScopes[storageKey] = allowed.includes(realScope) ? realScope : fallback;
                } else {
                    activeScopes[storageKey] = fallback;
                }

                // 读取当前的有效值
                const val = resolveStoredValue(storageKey);
                activeSettings[storageKey] = (val !== null && val !== undefined) ? val : manifest[key].default;
            });
        });
    };

    // 存储更新时同步到 Vue 响应式数据
    const handleStorageChange = (data: { key: string }) => {
        if (data && data.key) {
            const canonicalKey = getCanonicalSettingsStorageKey(data.key);
            const targetKey = Object.prototype.hasOwnProperty.call(activeSettings, canonicalKey) ? canonicalKey : data.key;
            // Re-evaluate what is the effective value (since we might have modified Character scope but fallen back to Global)
            activeSettings[targetKey] = resolveStoredValue(targetKey);
        }
    };

    // 默认开启全局监听，确保多组件间状态同步
    lwStorage.on('*', handleStorageChange);

    onUnmounted(() => {
        lwStorage.off('*', handleStorageChange);
    });

    const updateSetting = async (storageKey: string, value: any) => {
        const scope = activeScopes[storageKey] || 'Global';
        activeSettings[storageKey] = value;
        try {
            saveStatus.value = 'saving';
            // 落盘到底层数据中
            await (lwStorage as any).set(storageKey, value, scope);
            const legacyStorageKey = getLegacySettingsStorageKey(storageKey);
            if (legacyStorageKey) {
                await (lwStorage as any).set(legacyStorageKey, value, scope);
            }
            showSaveSuccess();
        } catch (e) {
            showSaveFailed();
        }
    };

    const updateScope = async (storageKey: string, newScope: string) => {
        activeScopes[storageKey] = newScope;
        // 切换作用域后，我们可能需要重新拉取那个作用域下的值，或者维持现状并写入新底座
        // 此处逻辑：如果那个作用域下有独立值，拉取它；如果没有，拉取下钻的默认值
        const explicitValue = resolveStoredValue(storageKey, newScope);
        if (explicitValue !== null && explicitValue !== undefined) {
            activeSettings[storageKey] = explicitValue;
        } else {
            // 写入一次将当前显示值绑定到新作用域
            try {
                saveStatus.value = 'saving';
                await (lwStorage as any).set(storageKey, activeSettings[storageKey], newScope);
                const legacyStorageKey = getLegacySettingsStorageKey(storageKey);
                if (legacyStorageKey) {
                    await (lwStorage as any).set(legacyStorageKey, activeSettings[storageKey], newScope);
                }
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
        updateScope,
        saveStatus
    };
}
