import { shallowReactive } from 'vue';
import type { SettingDefinition } from '../types/plugin';
import { builtinDesktopModes } from './builtinThemePacks';
import type {
    ComponentSkinDefinition,
    ComponentThemeContext,
    DesktopModeManifest,
    DesktopModeShellDefinition,
    ThemeNavigationPreset,
    ThemePack,
    ThemeSurfacePreset,
    ThemeValueMap,
    ThemeValueResolver,
    ThemeWorkspaceMode,
    ThemeWorkspacePreset,
} from './types';

export const DEFAULT_THEME_PACK_ID = 'classic';
export const DEFAULT_DESKTOP_MODE_ID = DEFAULT_THEME_PACK_ID;
const DEFAULT_WORKSPACE_MODES: ThemeWorkspaceMode[] = ['traditional', 'freeform'];
const DESKTOP_MODE_SETTINGS_PREFIX = 'desktop-mode-';
const LEGACY_THEME_SETTINGS_PREFIX = 'theme-pack-';
export const ACTIVE_DESKTOP_MODE_STORAGE_KEY = 'lumina-settings.activeDesktopMode';
export const LEGACY_ACTIVE_THEME_PACK_STORAGE_KEY = 'lumina-settings.activeThemePack';

export const getDesktopModeSettingsPluginId = (desktopModeId: string) => `${DESKTOP_MODE_SETTINGS_PREFIX}${desktopModeId}`;
export const getThemeSettingsPluginId = getDesktopModeSettingsPluginId;
export const isDesktopModeSettingsPluginId = (pluginId: string) => pluginId.startsWith(DESKTOP_MODE_SETTINGS_PREFIX);
export const isThemeSettingsPluginId = (pluginId: string) =>
    isDesktopModeSettingsPluginId(pluginId) || pluginId.startsWith(LEGACY_THEME_SETTINGS_PREFIX);
export const getDesktopModeIdFromSettingsPluginId = (pluginId: string) =>
    pluginId.replace(/^(desktop-mode-|theme-pack-)/, '');
export const getThemeIdFromSettingsPluginId = getDesktopModeIdFromSettingsPluginId;
export const getDesktopModeSettingStorageKey = (desktopModeId: string, settingKey: string) =>
    `${getDesktopModeSettingsPluginId(desktopModeId)}.${settingKey}`;
export const getThemeSettingStorageKey = getDesktopModeSettingStorageKey;
export const getLegacyThemeSettingStorageKey = (themeId: string, settingKey: string) =>
    `${LEGACY_THEME_SETTINGS_PREFIX}${themeId}.${settingKey}`;
export const getDesktopModeSettingStorageKeys = (desktopModeId: string, settingKey: string) => [
    getDesktopModeSettingStorageKey(desktopModeId, settingKey),
    getLegacyThemeSettingStorageKey(desktopModeId, settingKey),
];
export const getLegacySettingsStorageKey = (storageKey: string): string | null => {
    if (storageKey === ACTIVE_DESKTOP_MODE_STORAGE_KEY) {
        return LEGACY_ACTIVE_THEME_PACK_STORAGE_KEY;
    }
    if (storageKey.startsWith(DESKTOP_MODE_SETTINGS_PREFIX)) {
        return storageKey.replace(DESKTOP_MODE_SETTINGS_PREFIX, LEGACY_THEME_SETTINGS_PREFIX);
    }
    return null;
};
export const getCanonicalSettingsStorageKey = (storageKey: string): string => {
    if (storageKey === LEGACY_ACTIVE_THEME_PACK_STORAGE_KEY) {
        return ACTIVE_DESKTOP_MODE_STORAGE_KEY;
    }
    if (storageKey.startsWith(LEGACY_THEME_SETTINGS_PREFIX)) {
        return storageKey.replace(LEGACY_THEME_SETTINGS_PREFIX, DESKTOP_MODE_SETTINGS_PREFIX);
    }
    return storageKey;
};
export const getActiveDesktopModeIdFromSettings = (settings: Record<string, any>) =>
    String(
        settings[ACTIVE_DESKTOP_MODE_STORAGE_KEY]
        || settings[LEGACY_ACTIVE_THEME_PACK_STORAGE_KEY]
        || DEFAULT_DESKTOP_MODE_ID
    );

const cleanResolvedValues = (values: ThemeValueMap): Record<string, string | number> => {
    const cleaned: Record<string, string | number> = {};
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined) {
            cleaned[key] = value;
        }
    });
    return cleaned;
};

export const resolveThemeValues = (
    resolver: ThemeValueResolver | undefined,
    context: ComponentThemeContext
): Record<string, string | number> => {
    if (!resolver) return {};
    const raw = typeof resolver === 'function' ? resolver(context) : resolver;
    return cleanResolvedValues(raw);
};

class ThemeRegistry {
    public readonly packs = shallowReactive<Record<string, DesktopModeManifest>>({} as Record<string, DesktopModeManifest>);

    register(pack: DesktopModeManifest) {
        if (this.packs[pack.id]) {
            throw new Error(`[DesktopModeRegistry] Duplicate desktop mode id: ${pack.id}`);
        }
        this.packs[pack.id] = pack;
    }

    get(themeId: string) {
        return this.packs[themeId];
    }

    list() {
        return Object.values(this.packs);
    }
}

export const themeRegistry = new ThemeRegistry();
export const desktopModeRegistry = themeRegistry;

builtinDesktopModes.forEach(mode => desktopModeRegistry.register(mode));

export const registerDesktopMode = (manifest: DesktopModeManifest) => desktopModeRegistry.register(manifest);
export const listDesktopModes = () => desktopModeRegistry.list();
export const getDesktopMode = (desktopModeId: string) => desktopModeRegistry.get(desktopModeId);
export const getDesktopModeOrDefault = (desktopModeId?: string | null) =>
    getDesktopMode(desktopModeId || DEFAULT_DESKTOP_MODE_ID) || getDesktopMode(DEFAULT_DESKTOP_MODE_ID)!;
export const getDesktopModeOptions = () => listDesktopModes().map(mode => ({
    value: mode.id,
    label: mode.name,
    description: mode.description || `${mode.name} 桌面模式`
}));
export const getDesktopModeSettingsManifest = (desktopModeId: string): Record<string, SettingDefinition> =>
    getDesktopModeOrDefault(desktopModeId).settingsManifest || {};
export const getDesktopModeShell = (desktopModeId: string): DesktopModeShellDefinition => {
    const mode = getDesktopModeOrDefault(desktopModeId);
    if (mode.shell) {
        return mode.shell;
    }
    return {
        kind: mode.workspacePreset?.defaultMode || 'traditional'
    };
};

export const getThemePackOrDefault = (themeId?: string | null) =>
    getDesktopModeOrDefault(themeId);

export const getThemePackOptions = getDesktopModeOptions;

export const getThemeSettingsManifest = (themeId: string): Record<string, SettingDefinition> =>
    getDesktopModeSettingsManifest(themeId);

export const getThemeWorkspacePreset = (themeId: string): ThemeWorkspacePreset => {
    const pack = getDesktopModeOrDefault(themeId);
    const preset = pack.workspacePreset;
    const shell = getDesktopModeShell(themeId);
    return {
        defaultMode: shell.kind,
        availableModes: preset?.availableModes?.length ? preset.availableModes : [shell.kind],
        lockedMode: true,
        traditional: preset?.traditional,
        freeform: preset?.freeform,
    };
};

export const getThemeNavigationPreset = (themeId: string): ThemeNavigationPreset => {
    const pack = getDesktopModeOrDefault(themeId);
    return {
        traditional: {
            headerVariant: pack.navigationPreset?.traditional?.headerVariant || 'default',
            leftRail: pack.navigationPreset?.traditional?.leftRail || 'none',
            widgetVariant: pack.navigationPreset?.traditional?.widgetVariant || 'default',
            headerDesktopPosition: pack.navigationPreset?.traditional?.headerDesktopPosition || 'follow-setting',
            headerMobilePosition: pack.navigationPreset?.traditional?.headerMobilePosition || 'follow-setting',
        },
        freeform: {
            menuVariant: pack.navigationPreset?.freeform?.menuVariant,
            stageVariant: pack.navigationPreset?.freeform?.stageVariant,
        },
    };
};

export const getThemeSurfacePreset = (themeId: string): ThemeSurfacePreset => {
    const pack = getDesktopModeOrDefault(themeId);
    return {
        mainSurfaceVariant: pack.surfacePreset?.mainSurfaceVariant || 'default',
        widgetSurfaceVariant: pack.surfacePreset?.widgetSurfaceVariant || 'default',
        chatVariant: pack.surfacePreset?.chatVariant || 'default',
        settingsVariant: pack.surfacePreset?.settingsVariant || 'default',
        timelineVariant: pack.surfacePreset?.timelineVariant || 'default',
    };
};

export const isThemeLayoutModeAvailable = (themeId: string, layoutMode: ThemeWorkspaceMode) =>
    getDesktopModeShell(themeId).kind === layoutMode;

export const resolveThemeLayoutMode = (themeId: string, preferredMode?: ThemeWorkspaceMode | null): ThemeWorkspaceMode => {
    void preferredMode;
    return getDesktopModeShell(themeId).kind;
};

export const getThemeSettingValue = (
    activeSettings: Record<string, any>,
    themeId: string,
    settingKey: string,
    fallback?: any
) => {
    const manifest = getThemeSettingsManifest(themeId);
    const storageKeys = getDesktopModeSettingStorageKeys(themeId, settingKey);
    for (const storageKey of storageKeys) {
        const explicitValue = activeSettings[storageKey];
        if (explicitValue !== undefined && explicitValue !== null) {
            return explicitValue;
        }
    }
    if (manifest[settingKey]) {
        return manifest[settingKey].default;
    }
    return fallback;
};

export const resolveComponentSkin = (
    themeId: string,
    componentId: string,
    context: ComponentThemeContext
): {
    themePack: ThemePack;
    desktopMode: DesktopModeManifest;
    skin?: ComponentSkinDefinition;
    cssVars: Record<string, string | number>;
    tokens: Record<string, string | number>;
    classMap: Record<string, string>;
    variant?: string;
} => {
    const desktopMode = getDesktopModeOrDefault(themeId);
    const skin = desktopMode.surfaceSkins?.[componentId] || desktopMode.componentSkins?.[componentId];
    return {
        themePack: desktopMode,
        desktopMode,
        skin,
        cssVars: resolveThemeValues(skin?.cssVars, context),
        tokens: resolveThemeValues(skin?.tokens, context),
        classMap: skin?.classMap || {},
        variant: skin?.variant || desktopMode.rendererVariants?.[componentId]
    };
};
