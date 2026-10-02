import type { SettingDefinition } from '../../types/plugin.js';
import type { SurfaceContractId, SurfaceInput } from '../../platform/surface/types.js';
export type { ThemeAvatarPlacement, ThemeMessageShape } from '../../platform/surface/types.js';

export type DesktopModeAppearance = 'light' | 'dark' | 'follow-setting';
export type ResolvedDesktopAppearance = 'light' | 'dark';
export type DesktopModeShellKind = 'traditional' | 'freeform';
export type ThemeWorkspaceMode = DesktopModeShellKind;
export type ThemeHeaderVariant = 'default' | 'discord' | 'telegram';
export type ThemeRailMode = 'none' | 'character-rail';
export type ThemeSurfaceVariant = 'default' | 'discord' | 'telegram';

export type DesktopCompositionDirection = 'row' | 'column';
export type DesktopCompositionSize = 'content' | 'fill';
export type DesktopCompositionVisibility = 'visible' | 'hidden';
export type DesktopCompositionViewport = 'desktop' | 'mobile';

export interface DesktopCompositionNodeLayout {
    size: DesktopCompositionSize;
    visibility: DesktopCompositionVisibility;
}

export interface DesktopCompositionGroupNode extends DesktopCompositionNodeLayout {
    id: string;
    kind: 'group';
    direction: DesktopCompositionDirection;
    children: DesktopCompositionNode[];
}

export interface DesktopCompositionSurfaceNodeFor<K extends SurfaceContractId> extends DesktopCompositionNodeLayout {
    id: string;
    kind: 'surface';
    contractId: K;
    input: SurfaceInput<K>;
}

export type DesktopCompositionSurfaceNode = {
    [K in SurfaceContractId]: DesktopCompositionSurfaceNodeFor<K>;
}[SurfaceContractId];

export interface DesktopCompositionActivitySlotNode extends DesktopCompositionNodeLayout {
    id: string;
    kind: 'activity-slot';
}

export type DesktopCompositionNode =
    | DesktopCompositionGroupNode
    | DesktopCompositionSurfaceNode
    | DesktopCompositionActivitySlotNode;

export interface DesktopModeComposition {
    version: 1;
    desktop: DesktopCompositionNode;
    mobile: DesktopCompositionNode;
}

export interface SurfaceSkinContext {
    activeSettings: Record<string, any>;
    resolvedAppearance: ResolvedDesktopAppearance;
    desktopModeId: string;
}

export type ComponentThemeContext = SurfaceSkinContext;
export type ThemeValueMap = Record<string, string | number | undefined>;
export type ThemeValueResolver = ThemeValueMap | ((context: SurfaceSkinContext) => ThemeValueMap);

export interface SurfaceSkinDefinition {
    componentId: string;
    tokens?: ThemeValueResolver;
    cssVars?: ThemeValueResolver;
    classMap?: Record<string, string>;
    variant?: string;
}

export interface SurfaceSkinContract {
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
    navigationPreset?: ThemeNavigationPreset;
    surfacePreset?: ThemeSurfacePreset;
    windowPreset?: ThemeWindowPreset;
    designTokens?: ThemeValueResolver;
    surfaceSkins?: Record<string, SurfaceSkinDefinition>;
    settingsManifest?: Record<string, SettingDefinition>;
    rendererVariants?: Record<string, string>;
    composition: DesktopModeComposition;
}
