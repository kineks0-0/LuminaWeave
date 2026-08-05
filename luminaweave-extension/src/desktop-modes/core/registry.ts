import { shallowReactive } from 'vue';
import type { SettingDefinition } from '../../types/plugin.js';
import { builtinDesktopModes } from '../builtins/index.js';
import type {
    ComponentThemeContext,
    DesktopModeManifest,
    DesktopModeShellDefinition,
    SurfaceSkinDefinition,
    ThemeNavigationPreset,
    ThemeSurfacePreset,
    ThemeValueMap,
    ThemeValueResolver,
    ThemeWorkspaceMode,
} from './types.js';

export const DEFAULT_DESKTOP_MODE_ID = 'classic';
const DESKTOP_MODE_SETTINGS_PREFIX = 'desktop-mode-';
export const ACTIVE_DESKTOP_MODE_STORAGE_KEY = 'lumina-settings.activeDesktopMode';

export const getDesktopModeSettingsPluginId = (desktopModeId: string) =>
    `${DESKTOP_MODE_SETTINGS_PREFIX}${desktopModeId}`;

export const isDesktopModeSettingsPluginId = (pluginId: string) =>
    pluginId.startsWith(DESKTOP_MODE_SETTINGS_PREFIX);

export const getDesktopModeIdFromSettingsPluginId = (pluginId: string) =>
    isDesktopModeSettingsPluginId(pluginId)
        ? pluginId.slice(DESKTOP_MODE_SETTINGS_PREFIX.length)
        : pluginId;

export const getDesktopModeSettingStorageKey = (desktopModeId: string, settingKey: string) =>
    `${getDesktopModeSettingsPluginId(desktopModeId)}.${settingKey}`;

export const getActiveDesktopModeIdFromSettings = (settings: Record<string, any>) =>
    String(settings[ACTIVE_DESKTOP_MODE_STORAGE_KEY] || DEFAULT_DESKTOP_MODE_ID);

const cleanResolvedValues = (values: ThemeValueMap): Record<string, string | number> => {
    const cleaned: Record<string, string | number> = {};
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined) {
            cleaned[key] = value;
        }
    });
    return cleaned;
};

export const resolveDesktopModeValues = (
    resolver: ThemeValueResolver | undefined,
    context: ComponentThemeContext
): Record<string, string | number> => {
    if (!resolver) return {};
    const raw = typeof resolver === 'function' ? resolver(context) : resolver;
    return cleanResolvedValues(raw);
};

export type DesktopModeRegistrationListener = (manifest: DesktopModeManifest) => void;
export type DesktopModeRegistrationValidator = (manifest: DesktopModeManifest) => void;

class DesktopModeRegistry {
    public readonly modes = shallowReactive<Record<string, DesktopModeManifest>>(
        {} as Record<string, DesktopModeManifest>
    );
    private readonly registrationListeners = new Set<DesktopModeRegistrationListener>();
    private readonly registrationValidators = new Set<DesktopModeRegistrationValidator>();

    register(manifest: DesktopModeManifest): void {
        if (this.modes[manifest.id]) {
            throw new Error(`[DesktopModeRegistry] Duplicate desktop mode id: ${manifest.id}`);
        }
        this.registrationValidators.forEach(validate => validate(manifest));
        this.modes[manifest.id] = manifest;
        this.registrationListeners.forEach(listener => listener(manifest));
    }

    get(desktopModeId: string) {
        return this.modes[desktopModeId];
    }

    list() {
        return Object.values(this.modes);
    }

    onRegister(listener: DesktopModeRegistrationListener) {
        this.registrationListeners.add(listener);
        return () => {
            this.registrationListeners.delete(listener);
        };
    }

    onBeforeRegister(validator: DesktopModeRegistrationValidator): () => void {
        this.registrationValidators.add(validator);
        return () => {
            this.registrationValidators.delete(validator);
        };
    }
}

export const desktopModeRegistry = new DesktopModeRegistry();

builtinDesktopModes.forEach(mode => desktopModeRegistry.register(mode));

export const registerDesktopMode = (manifest: DesktopModeManifest) => desktopModeRegistry.register(manifest);
export const onDesktopModeRegistered = (listener: DesktopModeRegistrationListener) =>
    desktopModeRegistry.onRegister(listener);
export const onDesktopModeRegistering = (validator: DesktopModeRegistrationValidator): (() => void) =>
    desktopModeRegistry.onBeforeRegister(validator);
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

export const getDesktopModeShell = (desktopModeId: string): DesktopModeShellDefinition =>
    getDesktopModeOrDefault(desktopModeId).shell;

export const getDesktopModeNavigationPreset = (desktopModeId: string): ThemeNavigationPreset => {
    const mode = getDesktopModeOrDefault(desktopModeId);
    return {
        traditional: {
            headerVariant: mode.navigationPreset?.traditional?.headerVariant || 'default',
            leftRail: mode.navigationPreset?.traditional?.leftRail || 'none',
            widgetVariant: mode.navigationPreset?.traditional?.widgetVariant || 'default',
            headerDesktopPosition: mode.navigationPreset?.traditional?.headerDesktopPosition || 'follow-setting',
            headerMobilePosition: mode.navigationPreset?.traditional?.headerMobilePosition || 'follow-setting',
        },
        freeform: {
            menuVariant: mode.navigationPreset?.freeform?.menuVariant,
            stageVariant: mode.navigationPreset?.freeform?.stageVariant,
        },
    };
};

export const getDesktopModeSurfacePreset = (desktopModeId: string): ThemeSurfacePreset => {
    const mode = getDesktopModeOrDefault(desktopModeId);
    return {
        mainSurfaceVariant: mode.surfacePreset?.mainSurfaceVariant || 'default',
        widgetSurfaceVariant: mode.surfacePreset?.widgetSurfaceVariant || 'default',
        chatVariant: mode.surfacePreset?.chatVariant || 'default',
        settingsVariant: mode.surfacePreset?.settingsVariant || 'default',
        timelineVariant: mode.surfacePreset?.timelineVariant || 'default',
    };
};

export const isDesktopShellKindAvailable = (desktopModeId: string, shellKind: ThemeWorkspaceMode) =>
    getDesktopModeShell(desktopModeId).kind === shellKind;

export const resolveDesktopShellKind = (
    desktopModeId: string,
    preferredShellKind?: ThemeWorkspaceMode | null
): ThemeWorkspaceMode => {
    void preferredShellKind;
    return getDesktopModeShell(desktopModeId).kind;
};

export const getDesktopModeSettingValue = (
    activeSettings: Record<string, any>,
    desktopModeId: string,
    settingKey: string,
    fallback?: any
) => {
    const explicitValue = activeSettings[getDesktopModeSettingStorageKey(desktopModeId, settingKey)];
    if (explicitValue !== undefined && explicitValue !== null) {
        return explicitValue;
    }

    const manifest = getDesktopModeSettingsManifest(desktopModeId);
    if (manifest[settingKey]) {
        return manifest[settingKey].default;
    }
    return fallback;
};

export const resolveSurfaceSkin = (
    desktopModeId: string,
    componentId: string,
    context: ComponentThemeContext
): {
    desktopMode: DesktopModeManifest;
    skin?: SurfaceSkinDefinition;
    cssVars: Record<string, string | number>;
    tokens: Record<string, string | number>;
    classMap: Record<string, string>;
    variant?: string;
} => {
    const desktopMode = getDesktopModeOrDefault(desktopModeId);
    const skin = desktopMode.surfaceSkins?.[componentId];
    return {
        desktopMode,
        skin,
        cssVars: resolveDesktopModeValues(skin?.cssVars, context),
        tokens: resolveDesktopModeValues(skin?.tokens, context),
        classMap: skin?.classMap || {},
        variant: skin?.variant || desktopMode.rendererVariants?.[componentId]
    };
};
