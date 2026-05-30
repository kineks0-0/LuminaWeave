import type { Component, CSSProperties } from 'vue';
import type {
  CharacterChannelState,
  CreateChatConversationInput,
  DeleteChatConversationInput,
  RenameChatConversationInput
} from '../types/ConversationContextTypes.js';
import type { LuminaPlugin } from '../types/plugin.js';
import type { SurfaceContractId } from '../platform/surface/types.js';
import type { ActivityDescriptor, ActivityPanelPayload } from '../platform/activity/types.js';

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

export interface TelegramRailToolEntry {
  id: 'lumina-launcher' | 'lumina-forge';
  label: string;
  description: string;
  icon: string;
}

export type TelegramConversationListMode = 'groupedByRole' | 'conversationFiles';
export type TelegramDesktopLeftRoute = 'conversationList' | 'roleList';
export type TelegramMobileTabId = 'conversations' | 'roles' | 'settings' | 'profile';
export type TelegramStackRouteName =
  | 'conversationList'
  | 'roleList'
  | 'characterOverview'
  | 'roleProfile'
  | 'chat'
  | 'tool'
  | 'settings'
  | 'profile';

export interface TelegramStackRoute {
  name: TelegramStackRouteName;
  groupKey?: string | null;
  sessionId?: string;
  panelId?: string;
  toolId?: TelegramRailToolEntry['id'];
  title?: string;
  icon?: string;
  contractId?: SurfaceContractId;
  activity?: ActivityDescriptor;
  props?: Record<string, unknown>;
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
  props: Record<string, unknown>;
  kind: 'launcher' | 'main' | 'widget' | 'panel';
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

export interface ShellRuntimeContext {
  layoutMode: 'traditional' | 'freeform';
  activeDesktopModeId: string;
  desktopModeOptions: Array<{ value: string; label: string; description?: string }>;
  activeMainTab: string;
  isMobile: boolean;
  currentDetailedView: string | null;
  saveStatus: string;
  widgetGroups: WidgetPanelGroup[];
  characterChannelState: CharacterChannelState;
  traditional: {
    shouldShowDiscordGuildRail: boolean;
    discordGuildEntries: Array<{ id: string; name: string; icon: string }>;
    shouldShowForgeSidebar: boolean;
    isForgeSidebarCollapsed: boolean;
    shouldShowDiscordCharacterRail: boolean;
    isDiscordMobileMode: boolean;
    isTelegramMobileMode: boolean;
    shouldShowDiscordMobileShell: boolean;
    discordMobileGuildRailPosition: 'top' | 'bottom' | 'left' | 'right';
    discordMobileCharacterEntryPosition: 'top' | 'bottom' | 'left' | 'right';
    showDiscordMobileCharacterRail: boolean;
    discordMobileCharacterEntryStyle: CSSProperties;
    telegramSelectedCharacterKey: string | null;
    telegramToolEntries: TelegramRailToolEntry[];
    activeTelegramToolId: string | null;
    telegramConversationListMode: TelegramConversationListMode;
    telegramDesktopLeftRoute: TelegramDesktopLeftRoute;
    telegramMobileActiveTab: TelegramMobileTabId;
    telegramMobileCurrentRoute: TelegramStackRoute;
    isTimelineLoadedOnce: boolean;
    isForgeActiveInTraditional: boolean;
    sidebarMode: 'left' | 'right' | 'widget' | 'hidden';
    activeRightPanel: string;
    widgetWidth: number;
    isResizing: boolean;
    telegramLeftRailWidth: number;
    isTelegramLeftRailResizing: boolean;
    activeForgeAuxKind: string | null;
    rawSidebarMode: 'left' | 'right' | 'widget' | 'hidden';
    activeWidgetPlugin: LuminaPlugin | null;
    activeRegisteredPanel: RegisteredPanelEntry | null;
    activeRightPanelActivity: ActivityPanelPayload | null;
    showWidgetDropdown: boolean;
    showNexus: boolean;
  };
  freeform: {
    showWorkspaceMenu: boolean;
    isWorkspaceStageStripVisible: boolean;
    isWorkspaceNavigationVisible: boolean;
    activeWorkspaceWindowId: string | null;
    workspaceSceneInsets: WorkspaceSceneInsets;
    showWorkspaceLaunchpad: boolean;
    isWorkspaceDockVisible: boolean;
  };
}

export interface ShellRuntimeSurfaces {
  dynamicTabs: DynamicTabConfig[];
  traditional: {
    mainPlugins: LuminaPlugin[];
    mainSurfaceVariant: string;
    mainSurfaceStyle: CSSProperties;
    mobileMainStyle: CSSProperties;
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
  navigation: {
    switchMainView: (tabId: string) => void;
    close: () => void;
    updateDesktopMode: (desktopModeId: string) => void;
    openSettingsPanel: () => void;
  };
  traditional: {
    toggleDiscordGuildRail: () => void;
    handleOpenWidget: (panelId: string) => void;
    toggleForgeSidebarCollapse: () => void;
    setSidebarMode: (mode: 'left' | 'right' | 'widget') => void;
    openDiscordChatSession: (sessionId: string) => void;
    openDiscordMobileChatSession: (sessionId: string) => void;
    createDiscordChatSession: (payload: CreateChatConversationInput) => void;
    createDiscordMobileChatSession: (payload: CreateChatConversationInput) => void;
    renameDiscordChatSession: (payload: RenameChatConversationInput) => Promise<void> | void;
    deleteDiscordChatSession: (payload: DeleteChatConversationInput) => Promise<void> | void;
    toggleDiscordCharacterGroup: (groupKey: string) => void;
    toggleDiscordCharacterSessionExpansion: (groupKey: string) => void;
    handleDiscordMobileMainViewSwitch: (tabId: string) => void;
    updateShowDiscordMobileCharacterRail: (value: boolean) => void;
    selectTelegramCharacterOverview: (groupKey: string | null) => void;
    openTelegramToolEntry: (toolId: TelegramRailToolEntry['id']) => void;
    setTelegramConversationListMode: (mode: TelegramConversationListMode) => void;
    setTelegramDesktopLeftRoute: (route: TelegramDesktopLeftRoute) => void;
    pushTelegramMobileRoute: (route: TelegramStackRoute) => void;
    popTelegramMobileRoute: () => void;
    resizeStart: (event?: MouseEvent) => void;
    telegramLeftRailResizeStart: (event?: MouseEvent) => void;
    backFromDetailedSettings: () => void;
    toggleWidgetDropdown: () => void;
    switchRightPanel: (panelId: string) => void;
    restoreSidebarLeft: () => void;
    closePanel: () => void;
    updateShowNexus: (value: boolean) => void;
    selectTelegramBottomNav: (itemId: 'chat' | 'characters' | 'settings' | 'profile') => void;
  };
  freeform: {
    createStageWithLauncher: () => void;
    openWorkspaceSettings: () => void;
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
    backFromDetailedSettings: () => void;
    closeWorkspaceLaunchpad: () => void;
    handleWorkspaceDockOpenWithNavigation: (appId: string) => void;
    stageElementChange: (element: HTMLElement | null) => void;
  };
}
