import type { SettingDefinition } from '../types/plugin';

export type ThemePackAppearance = 'light' | 'dark' | 'follow-setting';
export type ResolvedThemeAppearance = 'light' | 'dark';
export type ThemeWorkspaceMode = 'traditional' | 'freeform';
export type DesktopModeShellKind = ThemeWorkspaceMode;
export type DesktopModeAppearance = ThemePackAppearance;
export type ThemeHeaderVariant = 'default' | 'discord';
export type ThemeRailMode = 'none' | 'character-rail';
export type ThemeSurfaceVariant = 'default' | 'discord';

export interface ComponentThemeContext {
    activeSettings: Record<string, any>;
    resolvedAppearance: ResolvedThemeAppearance;
    themePackId: string;
    desktopModeId?: string;
}

export type ThemeValueMap = Record<string, string | number | undefined>;
export type ThemeValueResolver = ThemeValueMap | ((context: ComponentThemeContext) => ThemeValueMap);

export interface SurfaceSkinDefinition {
    componentId: string;
    tokens?: ThemeValueResolver;
    cssVars?: ThemeValueResolver;
    classMap?: Record<string, string>;
    variant?: string;
}

export type ComponentSkinDefinition = SurfaceSkinDefinition;

export interface ThemeableComponentContract {
    componentId: string;
    exposedCssVars?: string[];
    supportedVariants?: string[];
}

export interface ThemeWorkspaceModePreset {
    shellVariant?: string;
    panelBodyVariant?: string;
    menuVariant?: string;
    stageVariant?: string;
}

export interface DesktopModeShellDefinition extends ThemeWorkspaceModePreset {
    kind: DesktopModeShellKind;
}

export interface ThemeWorkspacePreset {
    defaultMode: ThemeWorkspaceMode;
    availableModes?: ThemeWorkspaceMode[];
    lockedMode?: boolean;
    traditional?: ThemeWorkspaceModePreset;
    freeform?: ThemeWorkspaceModePreset;
}

export interface ThemeTraditionalNavigationPreset {
    headerVariant?: ThemeHeaderVariant;
    leftRail?: ThemeRailMode;
    widgetVariant?: ThemeSurfaceVariant;
    headerDesktopPosition?: 'top' | 'bottom' | 'follow-setting';
    headerMobilePosition?: 'top' | 'bottom' | 'follow-setting';
}

export interface ThemeFreeformNavigationPreset {
    menuVariant?: string;
    stageVariant?: string;
}

export interface ThemeNavigationPreset {
    traditional?: ThemeTraditionalNavigationPreset;
    freeform?: ThemeFreeformNavigationPreset;
}

export interface ThemeSurfacePreset {
    mainSurfaceVariant?: ThemeSurfaceVariant;
    widgetSurfaceVariant?: ThemeSurfaceVariant;
    chatVariant?: ThemeSurfaceVariant;
    settingsVariant?: ThemeSurfaceVariant;
    timelineVariant?: ThemeSurfaceVariant;
}

export interface ThemeWindowPreset {
    workspaceWindowVariant?: string;
}

export interface DesktopModeManifest {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    preferredAppearance?: DesktopModeAppearance;
    shell: DesktopModeShellDefinition;
    /**
     * @deprecated Keep only as a compatibility layer while the codebase migrates
     * from Theme Pack workspace presets to desktop-mode-first shells.
     */
    workspacePreset?: ThemeWorkspacePreset;
    navigationPreset?: ThemeNavigationPreset;
    surfacePreset?: ThemeSurfacePreset;
    windowPreset?: ThemeWindowPreset;
    designTokens?: ThemeValueResolver;
    surfaceSkins?: Record<string, SurfaceSkinDefinition>;
    /**
     * @deprecated Keep only as a compatibility layer while the codebase migrates
     * from component-skin-first theming to pack-driven shell presets.
     */
    componentSkins?: Record<string, ComponentSkinDefinition>;
    settingsManifest?: Record<string, SettingDefinition>;
    rendererVariants?: Record<string, string>;
}

export type ThemePack = DesktopModeManifest;
