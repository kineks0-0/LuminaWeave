import type { Component } from 'vue';
import { pluginManager } from '../../core/PluginManager.js';
import type {
    SettingDefinition,
    SettingsCategoryId,
    SettingsPreviewSurface
} from '../../types/plugin.js';
import type { SettingsSourceDescriptor } from './settingsTaxonomy.js';
import {
    getDesktopModeIdFromSettingsPluginId,
    getDesktopModeSettingsPluginId,
    getDesktopModeOrDefault,
    getDesktopModeSettingsManifest,
    isDesktopModeSettingsPluginId,
    listDesktopModes
} from '../../desktop-modes/core/registry.js';

export interface SettingsSourceEntry {
    pluginId: string;
    pluginName: string;
    pluginIcon: string;
    manifest: Record<string, SettingDefinition>;
    kind: 'plugin' | 'desktop-mode';
    settingsPreviewComponent?: Component;
    settingsPreviewSurface?: SettingsPreviewSurface;
    settingsInlineComponent?: Component;
    settingsCategory?: SettingsCategoryId;
    /** 插件是否启用（插件未声明 isEnabled 时视为启用） */
    isEnabled: () => boolean;
}

export const getRegisteredSettingsCatalog = (): Record<string, Record<string, SettingDefinition>> => {
    const catalog: Record<string, Record<string, SettingDefinition>> = {
        ...pluginManager.registeredSettings
    };

    listDesktopModes().forEach(desktopMode => {
        const desktopModeManifest = desktopMode.settingsManifest;
        if (desktopModeManifest && Object.keys(desktopModeManifest).length > 0) {
            catalog[getDesktopModeSettingsPluginId(desktopMode.id)] = desktopModeManifest;
        }
    });

    return catalog;
};

export const getSettingsEntry = (pluginId: string): SettingsSourceEntry | null => {
    if (isDesktopModeSettingsPluginId(pluginId)) {
        const desktopModeId = getDesktopModeIdFromSettingsPluginId(pluginId);
        const desktopMode = getDesktopModeOrDefault(desktopModeId);
        return {
            pluginId: getDesktopModeSettingsPluginId(desktopModeId),
            pluginName: `${desktopMode.name}`,
            pluginIcon: desktopMode.icon || '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 3a9 9 0 1 0 9 9c0-.34-.02-.67-.06-1A7 7 0 0 1 12 3z"></path></svg>',
            manifest: getDesktopModeSettingsManifest(desktopModeId),
            kind: 'desktop-mode',
            isEnabled: () => true
        };
    }

    const plugin = pluginManager.getPlugin(pluginId);
    if (!plugin || !plugin.settingsManifest) {
        return null;
    }

    return {
        pluginId,
        pluginName: plugin.name,
        pluginIcon: plugin.icon,
        manifest: plugin.settingsManifest,
        kind: 'plugin',
        settingsPreviewComponent: plugin.settingsPreviewComponent,
        settingsPreviewSurface: plugin.settingsPreviewSurface,
        settingsInlineComponent: plugin.settingsInlineComponent,
        settingsCategory: plugin.settingsCategory,
        isEnabled: () => plugin.isEnabled?.() !== false
    };
};

export const getVisibleSettingsEntries = (activeDesktopModeId: string): SettingsSourceEntry[] => {
    const entries: SettingsSourceEntry[] = [];
    Object.keys(pluginManager.registeredSettings).forEach(pluginId => {
        const entry = getSettingsEntry(pluginId);
        if (entry) {
            entries.push(entry);
        }
    });

    const desktopModeEntry = getSettingsEntry(getDesktopModeSettingsPluginId(activeDesktopModeId));
    if (desktopModeEntry) {
        entries.push(desktopModeEntry);
    }

    return entries;
};

export const toSettingsSourceDescriptor = (entry: SettingsSourceEntry): SettingsSourceDescriptor => ({
    pluginId: entry.pluginId,
    pluginName: entry.pluginName,
    kind: entry.kind,
    manifest: entry.manifest,
    settingsCategory: entry.settingsCategory,
    hasPluginComponent: Boolean(entry.settingsPreviewSurface || entry.settingsPreviewComponent || entry.settingsInlineComponent)
});
