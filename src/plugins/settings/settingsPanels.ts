import { defineAsyncComponent, type Component } from 'vue';
import type { SettingsPanelId } from './settingsTaxonomy.js';

/** settingsTaxonomy 中 SETTINGS_PANELS 的组件映射 */
export const SETTINGS_PANEL_COMPONENTS: Record<SettingsPanelId, Component> = {
    'nexus-presets': defineAsyncComponent(() => import('./panels/SettingsNexusPanel.vue')),
    'generation-preset': defineAsyncComponent(() => import('./panels/SettingsGenerationPresetPanel.vue')),
    'sync-status': defineAsyncComponent(() => import('./panels/SettingsSyncPanel.vue')),
    'storage-migration': defineAsyncComponent(() => import('./SettingsStoragePanel.vue')),
    'plugin-prompt-permissions': defineAsyncComponent(() => import('./panels/SettingsPromptPermissionsPanel.vue'))
};
