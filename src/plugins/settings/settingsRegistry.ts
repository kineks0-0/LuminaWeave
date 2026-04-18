import { pluginManager } from '../../core/PluginManager';
import type { SettingDefinition } from '../../types/plugin';
import {
    getDesktopModeIdFromSettingsPluginId,
    getDesktopModeSettingsPluginId,
    getDesktopModeOrDefault,
    getDesktopModeSettingsManifest,
    isThemeSettingsPluginId,
    listDesktopModes
} from '../../theme/themeRegistry';

export interface SettingsSourceEntry {
    pluginId: string;
    pluginName: string;
    pluginIcon: string;
    manifest: Record<string, SettingDefinition>;
    kind: 'plugin' | 'desktop-mode';
    settingsPreviewComponent?: any;
    settingsInlineComponent?: any;
}

export const getRegisteredSettingsCatalog = (): Record<string, Record<string, SettingDefinition>> => {
    const catalog: Record<string, Record<string, SettingDefinition>> = {
        ...(pluginManager as any).registeredSettings
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
    if (isThemeSettingsPluginId(pluginId)) {
        const themeId = getDesktopModeIdFromSettingsPluginId(pluginId);
        const desktopMode = getDesktopModeOrDefault(themeId);
        return {
            pluginId: getDesktopModeSettingsPluginId(themeId),
            pluginName: `${desktopMode.name}`,
            pluginIcon: desktopMode.icon || '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 3a9 9 0 1 0 9 9c0-.34-.02-.67-.06-1A7 7 0 0 1 12 3z"></path></svg>',
            manifest: getDesktopModeSettingsManifest(themeId),
            kind: 'desktop-mode'
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
        settingsInlineComponent: plugin.settingsInlineComponent
    };
};

export const getVisibleSettingsEntries = (activeThemeId: string): SettingsSourceEntry[] => {
    const entries: SettingsSourceEntry[] = [];
    Object.keys((pluginManager as any).registeredSettings).forEach(pluginId => {
        const entry = getSettingsEntry(pluginId);
        if (entry) {
            entries.push(entry);
        }
    });

    const themeEntry = getSettingsEntry(getDesktopModeSettingsPluginId(activeThemeId));
    if (themeEntry) {
        entries.push(themeEntry);
    }

    return entries;
};
