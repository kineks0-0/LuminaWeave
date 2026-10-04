import type { Component } from 'vue';
import type { SettingDefinition } from '../../types/plugin.js';
import type {
    SurfaceContractId,
    SurfaceInput,
    SurfaceRendererDefinition
} from '../../platform/surface/types.js';
export type { ThemeAvatarPlacement, ThemeMessageShape } from '../../platform/surface/types.js';

export type DesktopModeAppearance = 'light' | 'dark' | 'follow-setting';
export type ResolvedDesktopAppearance = 'light' | 'dark';
export type DesktopModeShellKind = 'traditional' | 'freeform';
export type ThemeWorkspaceMode = DesktopModeShellKind;
/** 变体为开放字符串：模式自定义变体名，组件用 `data-skin-variant` 暴露，由模式样式接管。 */
export type ThemeHeaderVariant = string;
export type ThemeRailMode = 'none' | 'character-rail';
export type ThemeSurfaceVariant = string;

export type DesktopCompositionDirection = 'row' | 'column';
export type DesktopCompositionSize = 'content' | 'fill';
export type DesktopCompositionVisibility = 'visible' | 'hidden';
export type DesktopCompositionViewport = 'desktop' | 'mobile';

export interface DesktopCompositionNodeLayout {
    size: DesktopCompositionSize;
    visibility: DesktopCompositionVisibility;
    /** 随桌面模式的导航开关一起收起（如 Discord 点 # 同时收起角色栏） */
    collapsesWithNavigation?: boolean;
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

/**
 * 受信模式包里的组件覆盖声明。运行时把它归一化为 `SurfaceRendererDefinition`
 * （kind 固定为 `desktop-override`），第三方不会被官方 contract 覆盖检查放行。
 */
export interface DesktopModeComponentOverride<K extends SurfaceContractId = SurfaceContractId> {
    contractId: K;
    component: Component;
    variant?: string;
    createContext?: SurfaceRendererDefinition<K>['createContext'];
}

export type DesktopModeComponentOverrideUnion = {
    [K in SurfaceContractId]: DesktopModeComponentOverride<K>;
}[SurfaceContractId];

/** 全局壳层 chrome 的声明式开关：由模式包声明，平台通用代码消费，避免按模式 ID 特判。 */
export interface DesktopModeShellChrome {
    /** 隐藏 root shell 的全局 PanelHeader（模式自带导航时使用）。 */
    hideGlobalHeader?: boolean;
    /** 全局 header 上的导航开关写哪个模式设置键（如 Discord 的 `discord-channel-mark`）。 */
    headerRailToggle?: {
        settingKey: string;
        default?: boolean;
    };
}

/**
 * 模式包是桌面模式在受信代码侧的完整交付单元：声明式 manifest + 可选 shell renderer、
 * component overrides、全局 chrome 开关与模式专属 CSS。CSS 以 `[data-desktop-mode]` /
 * `data-skin-variant` 为选择器根注入，注销时移除；不进入 manifest，保持 manifest 为纯数据。
 */
export interface DesktopModePackage {
    manifest: DesktopModeManifest;
    shellRenderer?: Component;
    componentOverrides?: DesktopModeComponentOverrideUnion[];
    shellChrome?: DesktopModeShellChrome;
    styles?: string;
}
