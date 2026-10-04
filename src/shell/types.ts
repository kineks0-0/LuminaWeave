import type { Component, CSSProperties } from 'vue';
import type { CharacterChannelState, CreateChatConversationInput } from '../types/ConversationContextTypes.js';
import type { LuminaPlugin } from '../types/plugin.js';
import type { SurfaceContractId } from '../platform/surface/types.js';
import type {
  ActivityDescriptor,
  ActivityModeHandler,
  ActivityPanelPayload
} from '../platform/activity/types.js';

export interface DynamicTabConfig {
  id: string;
  name: string;
  icon: string;
  component?: Component | string;
  surfaceContractId?: SurfaceContractId;
  props?: Record<string, unknown>;
  activity?: ActivityDescriptor;
}

export interface RegisteredPanelConfig {
  title: string;
  icon?: string;
  defaultMode?: 'tab' | 'modal';
  surfaceContractId?: SurfaceContractId;
  defaultInput?: Record<string, unknown>;
  navigation?: {
    group?: string;
    hidden?: boolean;
  };
}

export interface RegisteredPanelEntry {
  id: string;
  component: Component;
  config: RegisteredPanelConfig;
}

export interface WidgetPanelItem {
  id: string;
  name: string;
  icon: string;
}

export interface WidgetPanelGroup {
  label?: string;
  items: WidgetPanelItem[];
}

export type WidgetPluginEntry = LuminaPlugin;

export interface WorkspaceStageStripItem {
  id: string;
  label: string;
  isActive: boolean;
  isEmpty: boolean;
  windowCount: number;
  appIcons: string[];
  previewTitles: string[];
}

export interface WorkspaceDockItem {
  id: string;
  title: string;
  icon: string;
  isRunning: boolean;
  isActive: boolean;
}

export interface WorkspaceSceneInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface WorkspaceWindowEntry {
  id: string;
  appId: string;
  title: string;
  icon: string;
  component: Component;
  props: object;
  kind: 'main' | 'widget' | 'panel';
  eyebrow: string;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  zIndex: number;
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isCompact: boolean;
}

export interface ShellRuntimeFrame {
  panelHeaderVariant: string;
  traditionalHeaderPosition: 'top' | 'bottom';
  panelBodyStyle: CSSProperties;
  showSplash: boolean;
  /** 全局 header 的导航开关可见性（由模式 chrome 配置解析，Discord 用它收起角色栏）。 */
  headerRailVisible: boolean;
}

export interface ShellRuntimeContext {
  shellKind: 'traditional' | 'freeform';
  activeDesktopModeId: string;
  desktopModeOptions: Array<{ value: string; label: string; description?: string }>;
  activeMainTab: string;
  isMobile: boolean;
  viewportWidthPx: number;
  saveStatus: string;
  widgetGroups: WidgetPanelGroup[];
  characterChannelState: CharacterChannelState;
  traditional: {
    isTimelineLoadedOnce: boolean;
    sidebarMode: 'left' | 'right' | 'widget' | 'hidden';
    activeRightPanel: string;
    widgetWidth: number;
    isResizing: boolean;
    activeWidgetPlugin: LuminaPlugin | null;
    activeRegisteredPanel: RegisteredPanelEntry | null;
    activeRightPanelActivity: ActivityPanelPayload | null;
    showWidgetDropdown: boolean;
  };
  freeform: {
    showWorkspaceMenu: boolean;
    isWorkspaceStageStripVisible: boolean;
    isWorkspaceNavigationVisible: boolean;
    activeWorkspaceWindowId: string | null;
    workspaceSceneInsets: WorkspaceSceneInsets;
    isWorkspaceDockVisible: boolean;
  };
}

export interface ShellRuntimeSurfaces {
  dynamicTabs: DynamicTabConfig[];
  widgetPanelList: WidgetPanelItem[];
  traditional: {
    mainPlugins: LuminaPlugin[];
    mainSurfaceVariant: string;
    mainSurfaceStyle: CSSProperties;
    widgetSurfaceVariant: string;
    widgetStyle: CSSProperties;
  };
  freeform: {
    workspaceMenuVariant: string;
    workspaceMenuStyle: CSSProperties;
    workspaceStageVariant: string;
    workspaceStageStyle: CSSProperties;
    stageStripItems: WorkspaceStageStripItem[];
    stageWindowEntries: WorkspaceWindowEntry[];
    dockDisplayItems: WorkspaceDockItem[];
  };
}

export interface ShellRuntimeActions {
  getPluginName: (pluginId: string | null) => string;
  resolvePluginPrimarySurface: (pluginId: string) => SurfaceContractId | null;
  resolveRegisteredPanelSurface: (panelId: string) => SurfaceContractId | null;
  navigation: {
    switchMainView: (tabId: string) => void;
    closeTab: (tabId: string) => void;
    close: () => void;
    updateDesktopMode: (desktopModeId: string) => void;
    openSettingsPanel: () => void;
    /** 清除当前 Activity 的标题栏 / 状态栏等临时元数据。 */
    clearActivityMetadata: () => void;
  };
  events: {
    /** 订阅 lwApi 事件；返回退订函数。 */
    on(event: string, listener: (...args: unknown[]) => void): () => void;
  };
  frame: {
    panelBodyElementChange: (element: HTMLElement | null) => void;
  };
  traditional: {
    /** 全局 header 导航开关：按模式 chrome 配置切换模式设置。 */
    toggleHeaderRail: () => void;
    handleOpenWidget: (panelId: string) => void;
    /** 通用会话导航：不在聊天页时先切页再打开。 */
    openConversationSession: (sessionId: string) => void;
    createConversationSession: (payload: CreateChatConversationInput) => void;
    /** 写当前模式的设置键（内部拼接 `desktop-mode-<id>.<key>`）。 */
    updateDesktopModeSetting: (key: string, value: unknown) => void | Promise<void>;
    resizeStart: (event?: MouseEvent) => void;
    toggleWidgetDropdown: () => void;
    switchRightPanel: (panelId: string) => void;
    closePanel: () => void;
    /** 模式 shell 注册 Activity 形态接管器；返回撤销函数。 */
    registerActivityModeHandler: (handler: ActivityModeHandler) => () => void;
  };
  freeform: {
    createWorkspaceStage: () => void;
    activateWorkspaceStageWithNavigation: (stageId: string) => void;
    createWorkspaceStageFromStrip: () => void;
    holdWorkspaceNavigation: () => void;
    scheduleWorkspaceNavigationHide: () => void;
    toggleWorkspaceNavigation: () => void;
    toggleWorkspaceMenu: () => void;
    handleFreeformScenePointerDown: (event: PointerEvent) => void;
    updateWorkspaceLayout: (entryId: string, patch: { x?: number; y?: number; width?: number; height?: number; interaction?: 'move' | 'resize'; isFinal?: boolean }) => void;
    closeWorkspaceWindow: (entryId: string) => void;
    focusWorkspaceWindow: (entryId: string) => void;
    focusAdjacentWorkspaceWindow: (entryId: string, direction: 'prev' | 'next') => void;
    handleWorkspaceDockOpenWithNavigation: (appId: string) => void;
    stageElementChange: (element: HTMLElement | null) => void;
  };
}
