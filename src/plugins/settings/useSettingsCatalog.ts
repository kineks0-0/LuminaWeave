import { computed } from 'vue';
import { pluginManager } from '../../core/PluginManager.js';
import {
    desktopModeRegistrationVersion,
    getActiveDesktopModeIdFromSettings,
    resolveRegisteredDesktopModeId
} from '../../desktop-modes/core/registry.js';
import { activeSettings, currentDetailedView } from './useSettings.js';
import { getVisibleSettingsEntries, toSettingsSourceDescriptor } from './settingsRegistry.js';
import {
    SETTINGS_PANELS,
    buildSettingsCategoryIndex,
    resolvePluginComponentCategory,
    resolveSettingsView
} from './settingsTaxonomy.js';
import { buildSettingsSearchDocuments } from './settingsSearch.js';

/** 设置页共享的目录视图：当前生效的桌面模式、分类索引、搜索文档与路由 */
export function useSettingsCatalog() {
    // 持久化的模式未注册时显示回退后的模式，不改写存储值
    const activeDesktopModeId = computed(() =>
        resolveRegisteredDesktopModeId(getActiveDesktopModeIdFromSettings(activeSettings))
    );

    const entries = computed(() => {
        // 运行时注册/注销插件或桌面模式后重新收集
        void pluginManager.registrationVersion.value;
        void desktopModeRegistrationVersion.value;
        return getVisibleSettingsEntries(activeDesktopModeId.value);
    });

    const sources = computed(() => entries.value.map(toSettingsSourceDescriptor));
    const categoryIndex = computed(() => buildSettingsCategoryIndex(sources.value));
    const searchDocuments = computed(() => buildSettingsSearchDocuments(categoryIndex.value, SETTINGS_PANELS));
    const view = computed(() => resolveSettingsView(currentDetailedView.value, sources.value));

    /** 带有插件自身设置组件的条目及其所在分类 */
    const pluginComponentEntries = computed(() => entries.value
        .filter(entry => entry.settingsPreviewSurface || entry.settingsPreviewComponent || entry.settingsInlineComponent)
        .map(entry => ({ entry, categoryId: resolvePluginComponentCategory(toSettingsSourceDescriptor(entry)) })));

    return {
        activeDesktopModeId,
        entries,
        sources,
        categoryIndex,
        searchDocuments,
        view,
        pluginComponentEntries
    };
}
