import { shallowReactive, shallowRef, type Ref } from 'vue';
import type { SettingDefinition } from '../../types/plugin.js';
import { builtinDesktopModes } from '../builtins/index.js';
import { normalizeDesktopModePackage } from './package.js';
import type {
    ComponentThemeContext,
    DesktopModeManifest,
    DesktopModePackage,
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

export type DesktopModeRegistrationListener = (modePackage: DesktopModePackage) => void;
export type DesktopModeUnregistrationListener = (modePackage: DesktopModePackage) => void;
export type DesktopModeRegistrationValidator = (modePackage: DesktopModePackage) => void;

const builtinDesktopModeIds: ReadonlySet<string> = new Set(builtinDesktopModes.map(mode => mode.id));

const registrationRevision = shallowRef(0);
/** 模式注册或注销时递增，供设置面板等响应式消费者 watch。 */
export const desktopModeRegistrationVersion: Readonly<Ref<number>> = registrationRevision;

class DesktopModeRegistry {
    public readonly modes = shallowReactive<Record<string, DesktopModeManifest>>(
        {} as Record<string, DesktopModeManifest>
    );
    // 模式包（含 shell renderer / componentOverrides / styles）不进入响应式层，组件不参与代理。
    private readonly packages = new Map<string, DesktopModePackage>();
    // 模式 id -> 注册它的插件 id（经 context 注册时才有；内置与门面注册没有）。
    private readonly owners = new Map<string, string>();
    private readonly registrationListeners = new Set<DesktopModeRegistrationListener>();
    private readonly unregistrationListeners = new Set<DesktopModeUnregistrationListener>();
    private readonly registrationValidators = new Set<DesktopModeRegistrationValidator>();

    register(input: DesktopModeManifest | DesktopModePackage, ownerPluginId?: string): void {
        const modePackage = normalizeDesktopModePackage(input);
        const { manifest } = modePackage;
        if (this.modes[manifest.id]) {
            throw new Error(`[DesktopModeRegistry] Duplicate desktop mode id: ${manifest.id}`);
        }
        this.registrationValidators.forEach(validate => validate(modePackage));
        // owner 必须先于 listener 写入：运行时描述符在 listener 里创建并读取它。
        if (ownerPluginId) this.owners.set(manifest.id, ownerPluginId);
        this.packages.set(manifest.id, modePackage);
        this.modes[manifest.id] = manifest;
        registrationRevision.value += 1;
        this.registrationListeners.forEach(listener => listener(modePackage));
    }

    /** 只删除仍是同一个 manifest 对象的条目（过期句柄不误删同 id 的新注册）；内置模式不可注销。 */
    unregister(id: string, manifest: DesktopModeManifest): boolean {
        if (builtinDesktopModeIds.has(id)) {
            throw new Error(`[DesktopModeRegistry] Cannot unregister built-in desktop mode: ${id}`);
        }
        if (this.modes[id] !== manifest) return false;
        const modePackage = this.packages.get(id) ?? { manifest };
        delete this.modes[id];
        this.packages.delete(id);
        this.owners.delete(id);
        registrationRevision.value += 1;
        this.unregistrationListeners.forEach(listener => listener(modePackage));
        return true;
    }

    getPackage(id: string): DesktopModePackage | undefined {
        return this.packages.get(id);
    }

    listPackages(): DesktopModePackage[] {
        return Array.from(this.packages.values());
    }

    onUnregister(listener: DesktopModeUnregistrationListener): () => void {
        this.unregistrationListeners.add(listener);
        return () => {
            this.unregistrationListeners.delete(listener);
        };
    }

    get(desktopModeId: string) {
        return this.modes[desktopModeId];
    }

    getOwnerPluginId(desktopModeId: string): string | undefined {
        return this.owners.get(desktopModeId);
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

export const registerDesktopMode = (
    input: DesktopModeManifest | DesktopModePackage,
    ownerPluginId?: string
) => desktopModeRegistry.register(input, ownerPluginId);
export const getDesktopModeOwnerPluginId = (desktopModeId: string): string | undefined =>
    desktopModeRegistry.getOwnerPluginId(desktopModeId);
export const unregisterDesktopMode = (id: string, manifest: DesktopModeManifest): boolean =>
    desktopModeRegistry.unregister(id, manifest);
export const onDesktopModeUnregistered = (listener: DesktopModeUnregistrationListener): (() => void) =>
    desktopModeRegistry.onUnregister(listener);
export const onDesktopModeRegistered = (listener: DesktopModeRegistrationListener) =>
    desktopModeRegistry.onRegister(listener);
export const onDesktopModeRegistering = (validator: DesktopModeRegistrationValidator): (() => void) =>
    desktopModeRegistry.onBeforeRegister(validator);
export const listDesktopModes = () => desktopModeRegistry.list();
export const listDesktopModePackages = () => desktopModeRegistry.listPackages();
export const getDesktopModePackage = (desktopModeId: string) => desktopModeRegistry.getPackage(desktopModeId);
export const getDesktopMode = (desktopModeId: string) => desktopModeRegistry.get(desktopModeId);
export const getDesktopModeOrDefault = (desktopModeId?: string | null) =>
    getDesktopMode(desktopModeId || DEFAULT_DESKTOP_MODE_ID) || getDesktopMode(DEFAULT_DESKTOP_MODE_ID)!;

/** 持久化 id 未注册（例如第三方模式尚未加载）时回退到默认模式；不改写持久化值。 */
export const resolveRegisteredDesktopModeId = (desktopModeId?: string | null): string =>
    desktopModeId && getDesktopMode(desktopModeId) ? desktopModeId : DEFAULT_DESKTOP_MODE_ID;

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
