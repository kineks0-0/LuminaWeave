<template>
  <PanelHeader
    v-if="layoutMode === 'traditional' && traditionalHeaderPosition === 'top' && shouldRenderTraditionalHeader"
    :activeMainTab="activeMainTab"
    :dynamicTabs="dynamicTabs"
    :isMobile="isMobile"
    :activeDesktopModeId="activeDesktopModeId"
    :desktopModes="desktopModeOptions"
    :variant="panelHeaderVariant"
    :headerPlacement="traditionalHeaderPosition"
    :widgetPanels="widgetPanelList"
    :widgetGroups="widgetGroups"
    :activeWidgetId="activeRightPanel !== 'none' ? activeRightPanel : ''"
    :guildRailVisible="discordChannelMarkVisible"
    @switchMainView="onSwitchMainView"
    @closeTab="onCloseTab"
    @close="onClose"
    @toggleSettings="onOpenSettingsPanel"
    @toggleGuildRail="onToggleDiscordGuildRail"
    @setDesktopMode="onUpdateDesktopMode"
    @openWidget="onHandleOpenWidget"
  />

  <div
    ref="panelBodyElement"
    class="lw-panel-body"
    :class="{ 'is-freeform': layoutMode === 'freeform' }"
    :style="shellPanelBodyStyle"
  >
    <div v-if="!isApiReady" class="lw-global-loading">
      <div class="spinner"></div>
      <span>环境加载中... 若长时间无响应请检查 ST 相关扩展(例如 JS-Slash-Runner)是否正常。</span>
      <span style="color: var(--lw-primary); font-weight: bold; margin-top: 8px;">当前进度: {{ initStatusText }}</span>
    </div>

    <component
      v-else
      :is="currentShellRenderer"
      v-bind="shellRendererProps"
    />
  </div>

  <PanelHeader
    v-if="layoutMode === 'traditional' && traditionalHeaderPosition === 'bottom' && shouldRenderTraditionalHeader"
    :activeMainTab="activeMainTab"
    :dynamicTabs="dynamicTabs"
    :isMobile="isMobile"
    :activeDesktopModeId="activeDesktopModeId"
    :desktopModes="desktopModeOptions"
    :variant="panelHeaderVariant"
    :headerPlacement="traditionalHeaderPosition"
    :widgetPanels="widgetPanelList"
    :widgetGroups="widgetGroups"
    :activeWidgetId="activeRightPanel !== 'none' ? activeRightPanel : ''"
    :guildRailVisible="discordChannelMarkVisible"
    @switchMainView="onSwitchMainView"
    @closeTab="onCloseTab"
    @close="onClose"
    @toggleSettings="onOpenSettingsPanel"
    @toggleGuildRail="onToggleDiscordGuildRail"
    @setDesktopMode="onUpdateDesktopMode"
    @openWidget="onHandleOpenWidget"
  />

  <LegacyGlobalPanels ref="legacyGlobalPanels" />
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue';
import PanelHeader from '../components/PanelHeader.vue';
import { desktopModeRuntimeRegistry } from '../platform/desktop/DesktopModeRuntimeRegistry';
import type { LuminaPlugin } from '../types/plugin';
import type {
  CharacterChannelState,
  CreateChatConversationInput,
  DeleteChatConversationInput,
  RenameChatConversationInput
} from '../types/ConversationContextTypes';
import type {
  DynamicTabConfig,
  RegisteredPanelEntry,
  WidgetPanelGroup,
  WidgetPanelItem,
  TelegramRailToolEntry,
  WorkspaceDockItem,
  ShellRuntimeActions,
  ShellRuntimeContext,
  ShellRuntimeSurfaces,
  WorkspaceSceneInsets,
  WorkspaceStageStripItem,
  WorkspaceWindowEntry
} from './types';
import FreeformShell from './freeform/FreeformShell.vue';
import LegacyGlobalPanels from './LegacyGlobalPanels.vue';
import TraditionalShell from './traditional/TraditionalShell.vue';

const legacyGlobalPanels = ref<InstanceType<typeof LegacyGlobalPanels> | null>(null);
const panelBodyElement = ref<HTMLElement | null>(null);

const props = defineProps<{
  layoutMode: 'traditional' | 'freeform';
  panelHeaderVariant: 'default' | 'discord' | 'telegram';
  traditionalHeaderPosition: 'top' | 'bottom';
  activeMainTab: string;
  dynamicTabs: DynamicTabConfig[];
  isMobile: boolean;
  activeDesktopModeId: string;
  desktopModeOptions: Array<{ value: string; label: string; description?: string }>;
  widgetPanelList: WidgetPanelItem[];
  widgetGroups: WidgetPanelGroup[];
  activeRightPanel: string;
  discordChannelMarkVisible: boolean;
  shellPanelBodyStyle: CSSProperties;
  isApiReady: boolean;
  initStatusText: string;
  shouldShowDiscordGuildRail: boolean;
  discordGuildEntries: Array<{ id: string; name: string; icon: string }>;
  shouldShowForgeSidebar: boolean;
  isForgeSidebarCollapsed: boolean;
  shouldShowDiscordCharacterRail: boolean;
  characterChannelState: CharacterChannelState;
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
  mainPlugins: LuminaPlugin[];
  shellMainSurfaceVariant: string;
  shellMainSurfaceStyle: CSSProperties;
  discordMobileMainStyle: CSSProperties;
  isTimelineLoadedOnce: boolean;
  isForgeActiveInTraditional: boolean;
  sidebarMode: 'left' | 'right' | 'widget' | 'hidden';
  shellWidgetSurfaceVariant: string;
  shellWidgetStyle: CSSProperties;
  widgetWidth: number;
  isResizing: boolean;
  telegramLeftRailWidth: number;
  isTelegramLeftRailResizing: boolean;
  currentDetailedView: string | null;
  saveStatus: string;
  activeForgeAuxKind: string | null;
  rawSidebarMode: 'left' | 'right' | 'widget' | 'hidden';
  activeWidgetPlugin: LuminaPlugin | null;
  activeRegisteredPanel: RegisteredPanelEntry | null;
  showWidgetDropdown: boolean;
  showNexus: boolean;
  getPluginName: (pluginId: string | null) => string;
  showWorkspaceMenu: boolean;
  shellWorkspaceMenuVariant: string;
  shellWorkspaceMenuStyle: CSSProperties;
  shellWorkspaceStageVariant: string;
  shellWorkspaceStageStyle: CSSProperties;
  isWorkspaceStageStripVisible: boolean;
  workspaceStageStripItems: WorkspaceStageStripItem[];
  isWorkspaceNavigationVisible: boolean;
  activeStageWindowEntries: WorkspaceWindowEntry[];
  activeWorkspaceWindowId: string | null;
  workspaceSceneInsets: WorkspaceSceneInsets;
  showWorkspaceLaunchpad: boolean;
  isWorkspaceDockVisible: boolean;
  workspaceDockDisplayItems: WorkspaceDockItem[];
  onSwitchMainView: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onClose: () => void;
  onOpenSettingsPanel: () => void;
  onToggleDiscordGuildRail: () => void;
  onUpdateDesktopMode: (desktopModeId: string) => void;
  onHandleOpenWidget: (panelId: string) => void;
  onToggleForgeSidebarCollapse: () => void;
  onSetSidebarMode: (mode: 'left' | 'right' | 'widget') => void;
  onOpenDiscordChatSession: (sessionId: string) => void;
  onOpenDiscordMobileChatSession: (sessionId: string) => void;
  onCreateDiscordChatSession: (payload: CreateChatConversationInput) => void;
  onCreateDiscordMobileChatSession: (payload: CreateChatConversationInput) => void;
  onRenameDiscordChatSession: (payload: RenameChatConversationInput) => Promise<void> | void;
  onDeleteDiscordChatSession: (payload: DeleteChatConversationInput) => Promise<void> | void;
  onToggleDiscordCharacterGroup: (groupKey: string) => void;
  onToggleDiscordCharacterSessionExpansion: (groupKey: string) => void;
  onHandleDiscordMobileMainViewSwitch: (tabId: string) => void;
  onUpdateShowDiscordMobileCharacterRail: (value: boolean) => void;
  onSelectTelegramCharacterOverview: (groupKey: string | null) => void;
  onOpenTelegramToolEntry: (toolId: TelegramRailToolEntry['id']) => void;
  onResizeStart: (event?: MouseEvent) => void;
  onTelegramLeftRailResizeStart: (event?: MouseEvent) => void;
  onBackFromDetailedSettings: () => void;
  onToggleWidgetDropdown: () => void;
  onSwitchRightPanel: (panelId: string) => void;
  onRestoreSidebarLeft: () => void;
  onClosePanel: () => void;
  onUpdateShowNexus: (value: boolean) => void;
  onSelectTelegramBottomNav: (itemId: 'chat' | 'characters' | 'settings' | 'profile') => void;
  onCreateStageWithLauncher: () => void;
  onOpenWorkspaceSettings: () => void;
  onActivateWorkspaceStageWithNavigation: (stageId: string) => void;
  onCreateWorkspaceStageFromStrip: () => void;
  onHoldWorkspaceNavigation: () => void;
  onScheduleWorkspaceNavigationHide: () => void;
  onToggleWorkspaceNavigation: () => void;
  onToggleWorkspaceMenu: () => void;
  onHandleFreeformScenePointerDown: (event: PointerEvent) => void;
  onUpdateWorkspaceLayout: (entryId: string, patch: { x?: number; y?: number; width?: number; height?: number; interaction?: 'move' | 'resize'; isFinal?: boolean }) => void;
  onCloseWorkspaceWindow: (entryId: string) => void;
  onFocusWorkspaceWindow: (entryId: string) => void;
  onFocusAdjacentWorkspaceWindow: (entryId: string, direction: 'prev' | 'next') => void;
  onCloseWorkspaceLaunchpad: () => void;
  onHandleWorkspaceDockOpenWithNavigation: (appId: string) => void;
  onStageElementChange: (element: HTMLElement | null) => void;
  onPanelBodyElementChange: (element: HTMLElement | null) => void;
}>();

const shouldRenderTraditionalHeader = computed(() => (
  props.activeDesktopModeId !== 'telegram' || props.isMobile
));

const currentShellRenderer = computed(() => (
  desktopModeRuntimeRegistry.get(props.activeDesktopModeId)?.shellRenderer
  || (props.layoutMode === 'freeform' ? FreeformShell : TraditionalShell)
));

const shellContext = computed<ShellRuntimeContext>(() => ({
  layoutMode: props.layoutMode,
  activeDesktopModeId: props.activeDesktopModeId,
  desktopModeOptions: props.desktopModeOptions,
  activeMainTab: props.activeMainTab,
  isMobile: props.isMobile,
  currentDetailedView: props.currentDetailedView,
  saveStatus: props.saveStatus,
  widgetGroups: props.widgetGroups,
  characterChannelState: props.characterChannelState,
  traditional: {
    shouldShowDiscordGuildRail: props.shouldShowDiscordGuildRail,
    discordGuildEntries: props.discordGuildEntries,
    shouldShowForgeSidebar: props.shouldShowForgeSidebar,
    isForgeSidebarCollapsed: props.isForgeSidebarCollapsed,
    shouldShowDiscordCharacterRail: props.shouldShowDiscordCharacterRail,
    isDiscordMobileMode: props.isDiscordMobileMode,
    isTelegramMobileMode: props.isTelegramMobileMode,
    shouldShowDiscordMobileShell: props.shouldShowDiscordMobileShell,
    discordMobileGuildRailPosition: props.discordMobileGuildRailPosition,
    discordMobileCharacterEntryPosition: props.discordMobileCharacterEntryPosition,
    showDiscordMobileCharacterRail: props.showDiscordMobileCharacterRail,
    discordMobileCharacterEntryStyle: props.discordMobileCharacterEntryStyle,
    telegramSelectedCharacterKey: props.telegramSelectedCharacterKey,
    telegramToolEntries: props.telegramToolEntries,
    activeTelegramToolId: props.activeTelegramToolId,
    isTimelineLoadedOnce: props.isTimelineLoadedOnce,
    isForgeActiveInTraditional: props.isForgeActiveInTraditional,
    sidebarMode: props.sidebarMode,
    activeRightPanel: props.activeRightPanel,
    widgetWidth: props.widgetWidth,
    isResizing: props.isResizing,
    telegramLeftRailWidth: props.telegramLeftRailWidth,
    isTelegramLeftRailResizing: props.isTelegramLeftRailResizing,
    activeForgeAuxKind: props.activeForgeAuxKind,
    rawSidebarMode: props.rawSidebarMode,
    activeWidgetPlugin: props.activeWidgetPlugin,
    activeRegisteredPanel: props.activeRegisteredPanel,
    showWidgetDropdown: props.showWidgetDropdown,
    showNexus: props.showNexus
  },
  freeform: {
    showWorkspaceMenu: props.showWorkspaceMenu,
    isWorkspaceStageStripVisible: props.isWorkspaceStageStripVisible,
    isWorkspaceNavigationVisible: props.isWorkspaceNavigationVisible,
    activeWorkspaceWindowId: props.activeWorkspaceWindowId,
    workspaceSceneInsets: props.workspaceSceneInsets,
    showWorkspaceLaunchpad: props.showWorkspaceLaunchpad,
    isWorkspaceDockVisible: props.isWorkspaceDockVisible
  }
}));

const shellSurfaces = computed<ShellRuntimeSurfaces>(() => ({
  dynamicTabs: props.dynamicTabs,
  traditional: {
    mainPlugins: props.mainPlugins,
    mainSurfaceVariant: props.shellMainSurfaceVariant,
    mainSurfaceStyle: props.shellMainSurfaceStyle,
    mobileMainStyle: props.discordMobileMainStyle,
    widgetSurfaceVariant: props.shellWidgetSurfaceVariant,
    widgetStyle: props.shellWidgetStyle
  },
  freeform: {
    workspaceMenuVariant: props.shellWorkspaceMenuVariant,
    workspaceMenuStyle: props.shellWorkspaceMenuStyle,
    workspaceStageVariant: props.shellWorkspaceStageVariant,
    workspaceStageStyle: props.shellWorkspaceStageStyle,
    stageStripItems: props.workspaceStageStripItems,
    stageWindowEntries: props.activeStageWindowEntries,
    dockDisplayItems: props.workspaceDockDisplayItems
  }
}));

const shellActions = computed<ShellRuntimeActions>(() => ({
  getPluginName: props.getPluginName,
  navigation: {
    switchMainView: props.onSwitchMainView,
    close: props.onClose,
    updateDesktopMode: props.onUpdateDesktopMode,
    openSettingsPanel: props.onOpenSettingsPanel
  },
  traditional: {
    toggleDiscordGuildRail: props.onToggleDiscordGuildRail,
    handleOpenWidget: props.onHandleOpenWidget,
    toggleForgeSidebarCollapse: props.onToggleForgeSidebarCollapse,
    setSidebarMode: props.onSetSidebarMode,
    openDiscordChatSession: props.onOpenDiscordChatSession,
    openDiscordMobileChatSession: props.onOpenDiscordMobileChatSession,
    createDiscordChatSession: props.onCreateDiscordChatSession,
    createDiscordMobileChatSession: props.onCreateDiscordMobileChatSession,
    renameDiscordChatSession: props.onRenameDiscordChatSession,
    deleteDiscordChatSession: props.onDeleteDiscordChatSession,
    toggleDiscordCharacterGroup: props.onToggleDiscordCharacterGroup,
    toggleDiscordCharacterSessionExpansion: props.onToggleDiscordCharacterSessionExpansion,
    handleDiscordMobileMainViewSwitch: props.onHandleDiscordMobileMainViewSwitch,
    updateShowDiscordMobileCharacterRail: props.onUpdateShowDiscordMobileCharacterRail,
    selectTelegramCharacterOverview: props.onSelectTelegramCharacterOverview,
    openTelegramToolEntry: props.onOpenTelegramToolEntry,
    resizeStart: props.onResizeStart,
    telegramLeftRailResizeStart: props.onTelegramLeftRailResizeStart,
    backFromDetailedSettings: props.onBackFromDetailedSettings,
    toggleWidgetDropdown: props.onToggleWidgetDropdown,
    switchRightPanel: props.onSwitchRightPanel,
    restoreSidebarLeft: props.onRestoreSidebarLeft,
    closePanel: props.onClosePanel,
    updateShowNexus: props.onUpdateShowNexus,
    selectTelegramBottomNav: props.onSelectTelegramBottomNav
  },
  freeform: {
    createStageWithLauncher: props.onCreateStageWithLauncher,
    openWorkspaceSettings: props.onOpenWorkspaceSettings,
    activateWorkspaceStageWithNavigation: props.onActivateWorkspaceStageWithNavigation,
    createWorkspaceStageFromStrip: props.onCreateWorkspaceStageFromStrip,
    holdWorkspaceNavigation: props.onHoldWorkspaceNavigation,
    scheduleWorkspaceNavigationHide: props.onScheduleWorkspaceNavigationHide,
    toggleWorkspaceNavigation: props.onToggleWorkspaceNavigation,
    toggleWorkspaceMenu: props.onToggleWorkspaceMenu,
    handleFreeformScenePointerDown: props.onHandleFreeformScenePointerDown,
    updateWorkspaceLayout: props.onUpdateWorkspaceLayout,
    closeWorkspaceWindow: props.onCloseWorkspaceWindow,
    focusWorkspaceWindow: props.onFocusWorkspaceWindow,
    focusAdjacentWorkspaceWindow: props.onFocusAdjacentWorkspaceWindow,
    backFromDetailedSettings: props.onBackFromDetailedSettings,
    closeWorkspaceLaunchpad: props.onCloseWorkspaceLaunchpad,
    handleWorkspaceDockOpenWithNavigation: props.onHandleWorkspaceDockOpenWithNavigation,
    stageElementChange: props.onStageElementChange
  }
}));

const traditionalShellProps = computed(() => ({
  runtimeContext: shellContext.value,
  runtimeSurfaces: shellSurfaces.value,
  runtimeActions: shellActions.value
}));

const freeformShellProps = computed(() => ({
  runtimeContext: shellContext.value,
  runtimeSurfaces: shellSurfaces.value,
  runtimeActions: shellActions.value
}));

const shellRendererProps = computed(() => (
  props.layoutMode === 'freeform'
    ? freeformShellProps.value
    : traditionalShellProps.value
));

const openConflictViewer = () => {
  legacyGlobalPanels.value?.openConflictViewer();
};

const openSyncReportViewer = () => {
  legacyGlobalPanels.value?.openSyncReportViewer();
};

defineExpose({
  openConflictViewer,
  openSyncReportViewer
});

watch(panelBodyElement, (element) => {
  props.onPanelBodyElementChange(element);
}, { immediate: true });
</script>
