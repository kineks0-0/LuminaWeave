<template>
  <AppRootContainer
    :isExpanded="isExpanded"
    :resolvedTheme="resolvedTheme"
    :activeDesktopModeId="activeDesktopModeId"
    :motionPerformanceSetting="motionPerformanceSetting"
    :layoutMode="layoutMode"
    :appRootStyle="appRootStyle"
    :rootFrameStyle="rootFrameStyle"
    :shellAppVariant="shellAppVariant || 'default'"
    @expand="toggleExpand"
  >
    <LuminaShellRoot
      ref="shellRootRef"
      :layoutMode="layoutMode"
      :panelHeaderVariant="panelHeaderVariant"
      :traditionalHeaderPosition="traditionalHeaderPosition"
      :activeMainTab="activeMainTab"
      :dynamicTabs="dynamicTabs"
      :isMobile="isMobile"
      :activeDesktopModeId="activeDesktopModeId"
      :desktopModeOptions="desktopModeOptions"
      :widgetPanelList="widgetPanelList"
      :widgetGroups="widgetGroups"
      :activeRightPanel="activeRightPanel"
      :discordChannelMarkVisible="discordChannelMarkVisible"
      :shellPanelBodyStyle="shellPanelBodyStyle"
      :isApiReady="isApiReady"
      :initStatusText="initStatusText"
      :shouldShowDiscordGuildRail="shouldShowDiscordGuildRail"
      :discordGuildEntries="discordGuildEntries"
      :shouldShowForgeSidebar="shouldShowForgeSidebar"
      :isForgeSidebarCollapsed="isForgeSidebarCollapsed"
      :shouldShowDiscordCharacterRail="shouldShowDiscordCharacterRail"
      :characterChannelState="characterChannelState"
      :isDiscordMobileMode="isDiscordMobileMode"
      :shouldShowDiscordMobileShell="shouldShowDiscordMobileShell"
      :discordMobileGuildRailPosition="discordMobileGuildRailPosition"
      :discordMobileCharacterEntryPosition="discordMobileCharacterEntryPosition"
      :showDiscordMobileCharacterRail="showDiscordMobileCharacterRail"
      :discordMobileCharacterEntryStyle="discordMobileCharacterEntryStyle"
      :mainPlugins="mainPlugins"
      :tabComponentRegistry="tabComponentRegistry"
      :shellMainSurfaceVariant="shellMainSurfaceVariant"
      :shellMainSurfaceStyle="shellMainSurfaceStyle"
      :discordMobileMainStyle="discordMobileMainStyle"
      :isTimelineLoadedOnce="isTimelineLoadedOnce"
      :isForgeActiveInTraditional="isForgeActiveInTraditional"
      :sidebarMode="sidebarMode"
      :shellWidgetSurfaceVariant="shellWidgetSurfaceVariant"
      :shellWidgetStyle="shellWidgetStyle"
      :widgetWidth="widgetWidth"
      :isResizing="isResizing"
      :currentDetailedView="currentDetailedView"
      :saveStatus="saveStatus"
      :activeForgeAuxKind="activeForgeAuxKind"
      :rawSidebarMode="rawSidebarMode"
      :activeWidgetPlugin="activeWidgetPlugin"
      :activeRegisteredPanel="activeRegisteredPanel"
      :showWidgetDropdown="showWidgetDropdown"
      :showNexus="showNexus"
      :getPluginName="getPluginName"
      :showWorkspaceMenu="showWorkspaceMenu"
      :shellWorkspaceMenuVariant="shellWorkspaceMenuVariant || 'default'"
      :shellWorkspaceMenuStyle="shellWorkspaceMenuStyle"
      :shellWorkspaceStageVariant="shellWorkspaceStageVariant || 'default'"
      :shellWorkspaceStageStyle="shellWorkspaceStageStyle"
      :isWorkspaceStageStripVisible="isWorkspaceStageStripVisible"
      :workspaceStageStripItems="workspaceStageStripItems"
      :isWorkspaceNavigationVisible="isWorkspaceNavigationVisible"
      :activeStageWindowEntries="activeStageWindowEntries"
      :activeWorkspaceWindowId="activeWorkspaceWindowId"
      :workspaceSceneInsets="workspaceSceneInsets"
      :showWorkspaceLaunchpad="showWorkspaceLaunchpad"
      :isWorkspaceDockVisible="isWorkspaceDockVisible"
      :workspaceDockDisplayItems="workspaceDockDisplayItems"
      :onSwitchMainView="handleSwitchMainView"
      :onCloseTab="closeTab"
      :onClose="toggleExpand"
      :onOpenSettingsPanel="openSettingsPanel"
      :onToggleDiscordGuildRail="toggleDiscordGuildRail"
      :onUpdateDesktopMode="updateDesktopMode"
      :onHandleOpenWidget="handleOpenWidget"
      :onToggleForgeSidebarCollapse="toggleForgeSidebarCollapse"
      :onSetSidebarMode="setSidebarMode"
      :onOpenDiscordChatSession="openDiscordChatSession"
      :onOpenDiscordMobileChatSession="openDiscordMobileChatSession"
      :onCreateDiscordChatSession="createDiscordChatSession"
      :onCreateDiscordMobileChatSession="createDiscordMobileChatSession"
      :onRenameDiscordChatSession="renameDiscordChatSession"
      :onDeleteDiscordChatSession="deleteDiscordChatSession"
      :onToggleDiscordCharacterGroup="toggleDiscordCharacterGroup"
      :onToggleDiscordCharacterSessionExpansion="toggleDiscordCharacterSessionExpansion"
      :onHandleDiscordMobileMainViewSwitch="handleDiscordMobileMainViewSwitch"
      :onUpdateShowDiscordMobileCharacterRail="updateShowDiscordMobileCharacterRail"
      :onResizeStart="initResize"
      :onBackFromDetailedSettings="backFromDetailedSettings"
      :onToggleWidgetDropdown="toggleWidgetDropdown"
      :onSwitchRightPanel="switchRightPanel"
      :onRestoreSidebarLeft="restoreSidebarLeft"
      :onClosePanel="closeWidgetPanel"
      :onUpdateShowNexus="updateShowNexus"
      :onCreateStageWithLauncher="createStageWithLauncherAndCloseMenu"
      :onOpenWorkspaceSettings="openWorkspaceSettingsAndCloseMenu"
      :onActivateWorkspaceStageWithNavigation="activateWorkspaceStageWithNavigation"
      :onCreateWorkspaceStageFromStrip="createWorkspaceStageFromStrip"
      :onHoldWorkspaceNavigation="holdWorkspaceNavigation"
      :onScheduleWorkspaceNavigationHide="scheduleWorkspaceNavigationHideWrapper"
      :onToggleWorkspaceNavigation="toggleWorkspaceNavigation"
      :onToggleWorkspaceMenu="toggleWorkspaceMenu"
      :onHandleFreeformScenePointerDown="handleFreeformScenePointerDown"
      :onUpdateWorkspaceLayout="updateWorkspaceLayout"
      :onCloseWorkspaceWindow="closeWorkspaceWindow"
      :onFocusWorkspaceWindow="focusWorkspaceWindow"
      :onFocusAdjacentWorkspaceWindow="focusAdjacentWorkspaceWindow"
      :onCloseWorkspaceLaunchpad="closeWorkspaceLaunchpad"
      :onHandleWorkspaceDockOpenWithNavigation="handleWorkspaceDockOpenWithNavigation"
      :onStageElementChange="handleStageElementChange"
      :onPanelBodyElementChange="handlePanelBodyElementChange"
    />
  </AppRootContainer>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref, watch, type Component, type CSSProperties } from 'vue';
import { luminaWeaveApi as lwApi } from './api/index';
import { lwStorage } from './api/storage';
import { pluginManager } from './core/PluginManager';
import { useSettings, currentDetailedView } from './plugins/settings/useSettings';
import { useResponsiveLayout } from './composables/useResponsiveLayout';
import { useWorkspaceManager } from './composables/useWorkspaceManager';
import { useHostLayoutViewport } from './composables/shell/useHostLayoutViewport';
import { useShellBootstrap } from './composables/shell/useShellBootstrap';
import { useWidgetPanels } from './composables/shell/useWidgetPanels';
import { useWorkspaceNavigation } from './composables/shell/useWorkspaceNavigation';
import { useDiscordShell } from './composables/shell/useDiscordShell';
import {
  getDesktopModeOptions,
  getDesktopModeSettingStorageKey,
  resolveThemeValues
} from './theme/themeRegistry';
import { useComponentSkin } from './theme/useComponentSkin';
import { useThemePack } from './theme/useThemePack';
import type { ThemeTraditionalNavigationPreset } from './theme/types';
import type { DynamicTabConfig } from './shell/types';
import { registerLuminaPlugins } from './bootstrap/registerPlugins';

import AppRootContainer from './shell/AppRootContainer.vue';
import LuminaShellRoot from './shell/LuminaShellRoot.vue';
import ConflictDiffViewer from './plugins/chat/ConflictDiffViewer.vue';
import SyncReportViewer from './plugins/chat/SyncReportViewer.vue';
import SettingsRoot from './plugins/settings/SettingsRoot.vue';
import LauncherRoot from './plugins/launcher/LauncherRoot.vue';

type LayoutMode = 'traditional' | 'freeform';

const tabComponentRegistry = {
  ConflictDiffViewer,
  SyncReportViewer,
  SettingsRoot,
  LauncherRoot
} satisfies Record<string, Component>;

registerLuminaPlugins();

const hostContainer = inject<HTMLElement | null>('lwHostContainer', null);
const shellRootRef = ref<InstanceType<typeof LuminaShellRoot> | null>(null);

const { initSettings, saveStatus, activeSettings, updateSetting } = useSettings();

const isExpanded = ref(false);
const isApiReady = ref(false);
const initStatusText = ref('等待系统启动...');
const settingsRevision = ref(0);
const panelBodyRef = ref<HTMLElement | null>(null);
const freeformStageRef = ref<HTMLElement | null>(null);
const isTimelineLoadedOnce = ref(false);
const showWorkspaceMenu = ref(false);
const isForgeSidebarCollapsed = ref(false);
const systemPrefersDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches);
const workspaceNavigationVisibleState = ref(false);

const activeMainTab = ref(lwStorage.get('luminaWeave.activeMainTab', 'lumina-chat', 'Global'));
const dynamicTabs = ref<DynamicTabConfig[]>([]);
const activeRightPanel = ref(lwStorage.get('luminaWeave.activeRightPanel', 'lumina-settings', 'Global'));
const lastKnownRightPanel = ref(lwStorage.get('luminaWeave.activeRightPanel', 'lumina-settings', 'Global'));
const showWidgetDropdown = ref(false);
const showNexus = ref(lwStorage.get('luminaWeave.showNexus', true, 'Global'));

const mainPlugins = computed(() => pluginManager.getPluginsInSlot('mainView'));
const widgetPlugins = computed(() => {
  settingsRevision.value;
  return pluginManager.getPluginsInSlot('widget');
});

const {
  isMobile: responsiveIsMobile,
  sidebarMode,
  rawSidebarMode,
  setSidebarMode
} = useResponsiveLayout(panelBodyRef);
const isMobile = responsiveIsMobile;

const appearanceSetting = computed(() => activeSettings['lumina-settings.appearance'] || 'system');
const desktopModeOptions = computed(() => getDesktopModeOptions());
const {
  desktopModeId: activeDesktopModeId,
  desktopMode: activeDesktopMode,
  desktopShell,
  navigationPreset,
  surfacePreset
} = useThemePack();
const layoutMode = computed<LayoutMode>(() => desktopShell.value.kind as LayoutMode);

const traditionalNavigationPreset = computed<Required<ThemeTraditionalNavigationPreset>>(() => ({
  headerVariant: navigationPreset.value.traditional?.headerVariant || 'default',
  leftRail: navigationPreset.value.traditional?.leftRail || 'none',
  widgetVariant: navigationPreset.value.traditional?.widgetVariant || 'default',
  headerDesktopPosition: navigationPreset.value.traditional?.headerDesktopPosition || 'follow-setting',
  headerMobilePosition: navigationPreset.value.traditional?.headerMobilePosition || 'follow-setting'
}));

const panelHeaderVariant = computed(() => traditionalNavigationPreset.value.headerVariant || 'default');
const resolvedTheme = computed(() => {
  if (activeDesktopMode.value.preferredAppearance === 'light' || activeDesktopMode.value.preferredAppearance === 'dark') {
    return activeDesktopMode.value.preferredAppearance;
  }
  if (appearanceSetting.value === 'light' || appearanceSetting.value === 'dark') {
    return appearanceSetting.value;
  }
  return systemPrefersDark.value ? 'dark' : 'light';
});

const workspaceShowStageStripSetting = computed(() => activeSettings['lumina-settings.workspaceShowStageStrip'] !== false);
const workspaceShowDockSetting = computed(() => activeSettings['lumina-settings.workspaceShowDock'] !== false);
const motionPerformanceSetting = computed(() => activeSettings['lumina-settings.motionPerformance'] || 'full');
const traditionalHeaderDesktopPosition = computed(() => {
  if (traditionalNavigationPreset.value.headerDesktopPosition === 'top' || traditionalNavigationPreset.value.headerDesktopPosition === 'bottom') {
    return traditionalNavigationPreset.value.headerDesktopPosition;
  }
  return activeSettings['lumina-settings.traditionalHeaderDesktopPosition'] || 'top';
});
const traditionalHeaderMobilePosition = computed(() => {
  if (traditionalNavigationPreset.value.headerMobilePosition === 'top' || traditionalNavigationPreset.value.headerMobilePosition === 'bottom') {
    return traditionalNavigationPreset.value.headerMobilePosition;
  }
  return activeSettings['lumina-settings.traditionalHeaderMobilePosition'] || 'top';
});
const traditionalHeaderPosition = computed<'top' | 'bottom'>(() =>
  (isMobile.value ? traditionalHeaderMobilePosition.value : traditionalHeaderDesktopPosition.value) === 'bottom'
    ? 'bottom'
    : 'top'
);

const { cssVars: shellAppSkinVars, variant: shellAppVariant } = useComponentSkin('shell.app');
const { cssVars: shellPanelBodySkinVars } = useComponentSkin('shell.panelBody');
const { cssVars: shellMainSurfaceSkinVars } = useComponentSkin('shell.mainSurface');
const { cssVars: shellWidgetSkinVars } = useComponentSkin('shell.widget');
const { cssVars: shellWorkspaceStageSkinVars, variant: shellWorkspaceStageVariant } = useComponentSkin('shell.workspaceStage');
const { cssVars: shellWorkspaceMenuSkinVars, variant: shellWorkspaceMenuVariant } = useComponentSkin('shell.workspaceMenu');

const {
  activeWorkspaceWindowId,
  activeStageWindowEntries,
  workspaceStageStripItems,
  workspaceDockItems,
  workspaceSceneInsets,
  reconcileWorkspaceState,
  reflowWorkspaceWindows,
  updateWorkspaceLayout,
  focusWorkspaceWindow,
  focusAdjacentWorkspaceWindow,
  closeWorkspaceWindow,
  activateWorkspaceStage,
  createWorkspaceStage,
  createStageWithLauncher,
  openWorkspaceSettings,
  handleWorkspaceDockOpen,
  openWorkspaceApp,
  closeWorkspaceApps,
  closeTab: closeWorkspaceTab,
  getWorkspaceAppIdForMainTab,
  workspaceAppMap
} = useWorkspaceManager({
  mainPlugins,
  widgetPlugins,
  dynamicTabs,
  activeMainTab,
  activeRightPanel,
  isMobile,
  freeformStageRef,
  workspaceNavigationVisible: workspaceNavigationVisibleState,
  componentMap: tabComponentRegistry,
  getPluginName
});

function getPluginName(pluginId: string | null) {
  if (!pluginId) return '';
  const plugin = pluginManager.getPlugin(pluginId);
  return plugin ? plugin.name : pluginId;
}

const {
  widgetWidth,
  isResizing,
  activeWidgetPlugin,
  activeRegisteredPanel,
  activeForgeAuxKind,
  widgetPanelList,
  widgetGroups,
  openTemporaryWidgetTab,
  switchRightPanel,
  handleOpenWidget,
  closeWidgetPanel,
  initResize
} = useWidgetPanels({
  activeRightPanel,
  lastKnownRightPanel,
  showWidgetDropdown,
  showNexus,
  widgetPlugins,
  layoutMode,
  isMobile,
  workspaceAppMap,
  openWorkspaceApp,
  getPluginName
});

const {
  showWorkspaceNavigation,
  workspaceNavigationPeek,
  workspaceNavigationVisibleRef,
  showWorkspaceLaunchpad,
  isWorkspaceNavigationVisible,
  isWorkspaceStageStripVisible,
  isWorkspaceDockVisible,
  shouldShowWorkspaceNavigationOnEntry,
  clearWorkspaceNavigationHideTimer,
  scheduleWorkspaceNavigationHide,
  holdWorkspaceNavigation,
  closeWorkspaceLaunchpad,
  toggleWorkspaceNavigation,
  handleFreeformScenePointerDown
} = useWorkspaceNavigation({
  isMobile,
  layoutMode,
  activeStageWindowCount: computed(() => activeStageWindowEntries.value.length),
  reflowWorkspaceWindows,
  reconcileWorkspaceState,
  workspaceShowStageStripSetting,
  workspaceShowDockSetting
});

const workspaceDockDisplayItems = computed(() =>
  workspaceDockItems.value.map((item) => (
    item.id === 'plugin:lumina-launcher'
      ? { ...item, isActive: showWorkspaceLaunchpad.value || item.isActive }
      : item
  ))
);

const isForgeActiveInTraditional = computed(() =>
  layoutMode.value === 'traditional' && (activeMainTab.value === 'lumina-forge' || activeMainTab.value === 'card_maker')
);
const shouldShowForgeSidebar = computed(() =>
  isForgeActiveInTraditional.value && sidebarMode.value === 'left' && !isMobile.value
);

const {
  contextStore,
  characterChannelState,
  discordChannelMarkVisible,
  isDiscordMobileMode,
  shouldShowDiscordMobileShell,
  shouldShowDiscordGuildRail,
  discordMobileGuildRailPosition,
  discordMobileCharacterEntryPosition,
  shouldShowDiscordCharacterRail,
  discordGuildEntries,
  showDiscordMobileCharacterRail,
  discordMobileMainStyle,
  discordMobileCharacterEntryStyle,
  handleDiscordMobileMainViewSwitch,
  openDiscordChatSession,
  openDiscordMobileChatSession,
  createDiscordChatSession,
  createDiscordMobileChatSession,
  renameDiscordChatSession,
  deleteDiscordChatSession,
  toggleDiscordCharacterGroup,
  toggleDiscordCharacterSessionExpansion
} = useDiscordShell({
  activeDesktopModeId,
  layoutMode,
  isMobile,
  activeSettings,
  traditionalLeftRail: computed(() => traditionalNavigationPreset.value.leftRail),
  mainPlugins,
  dynamicTabs,
  activeMainTab,
  shouldShowForgeSidebar,
  onSwitchMainView: (tabId) => {
    handleSwitchMainView(tabId);
  }
});

const {
  viewportHeightPx,
  viewportWidthPx,
  viewportOffsetTopPx,
  viewportOffsetLeftPx,
  safeInsetTopPx,
  safeInsetRightPx,
  safeInsetBottomPx,
  safeInsetLeftPx,
  layoutSource,
  rootPanelShiftPx
} = useHostLayoutViewport({
  hostContainer,
  isExpanded,
  layoutMode,
  reflowWorkspaceWindows
});

const appRootStyle = computed<CSSProperties>(() => ({
  pointerEvents: isExpanded.value ? 'auto' : 'none',
  '--lw-app-height': `${viewportHeightPx.value}px`,
  '--lw-app-width': `${viewportWidthPx.value}px`,
  '--lw-layout-viewport-height': `${viewportHeightPx.value}px`,
  '--lw-layout-viewport-width': `${viewportWidthPx.value}px`,
  '--lw-viewport-offset-top': `${viewportOffsetTopPx.value}px`,
  '--lw-viewport-offset-left': `${viewportOffsetLeftPx.value}px`,
  '--lw-safe-top': `${safeInsetTopPx.value}px`,
  '--lw-safe-right': `${safeInsetRightPx.value}px`,
  '--lw-safe-bottom': `${safeInsetBottomPx.value}px`,
  '--lw-safe-left': `${safeInsetLeftPx.value}px`,
  ...resolveThemeValues(activeDesktopMode.value.designTokens, {
    activeSettings,
    resolvedAppearance: resolvedTheme.value,
    themePackId: activeDesktopModeId.value,
    desktopModeId: activeDesktopModeId.value
  })
}));

const rootFrameStyle = computed<CSSProperties>(() => {
  const baseStyle = shellAppSkinVars.value as CSSProperties;
  if (rootPanelShiftPx.value <= 0) {
    return baseStyle;
  }

  const existingTransform = typeof baseStyle.transform === 'string' ? baseStyle.transform : '';
  const nextTransform = `translateY(-${rootPanelShiftPx.value}px)`;

  return {
    ...baseStyle,
    '--lw-root-panel-shift': `${rootPanelShiftPx.value}px`,
    transform: existingTransform ? `${nextTransform} ${existingTransform}` : nextTransform
  };
});

const shellPanelBodyStyle = computed<CSSProperties>(() => shellPanelBodySkinVars.value as CSSProperties);
const shellMainSurfaceStyle = computed<CSSProperties>(() => shellMainSurfaceSkinVars.value as CSSProperties);
const shellWidgetStyle = computed<CSSProperties>(() => shellWidgetSkinVars.value as CSSProperties);
const shellWorkspaceStageStyle = computed<CSSProperties>(() => shellWorkspaceStageSkinVars.value as CSSProperties);
const shellWorkspaceMenuStyle = computed<CSSProperties>(() => shellWorkspaceMenuSkinVars.value as CSSProperties);
const shellMainSurfaceVariant = computed(() => surfacePreset.value.mainSurfaceVariant || 'default');
const shellWidgetSurfaceVariant = computed(() =>
  traditionalNavigationPreset.value.widgetVariant || surfacePreset.value.widgetSurfaceVariant || 'default'
);

const updateShowDiscordMobileCharacterRail = (value: boolean) => {
  showDiscordMobileCharacterRail.value = value;
};

const backFromDetailedSettings = () => {
  currentDetailedView.value = null;
};

const toggleWidgetDropdown = () => {
  showWidgetDropdown.value = !showWidgetDropdown.value;
};

const updateShowNexus = (value: boolean) => {
  showNexus.value = value;
};

const restoreSidebarLeft = () => {
  setSidebarMode('left');
};

const toggleForgeSidebarCollapse = () => {
  isForgeSidebarCollapsed.value = !isForgeSidebarCollapsed.value;
};

const handlePanelBodyElementChange = (element: HTMLElement | null) => {
  panelBodyRef.value = element;
};

const handleStageElementChange = (element: HTMLElement | null) => {
  freeformStageRef.value = element;
};

const handleOpenTab = (tabConfig: DynamicTabConfig) => {
  const existingIndex = dynamicTabs.value.findIndex((tab) => tab.id === tabConfig.id);
  if (existingIndex === -1) {
    dynamicTabs.value.push(tabConfig);
  } else {
    dynamicTabs.value[existingIndex] = { ...dynamicTabs.value[existingIndex], ...tabConfig };
  }
  activeMainTab.value = tabConfig.id;
  if (layoutMode.value === 'freeform') {
    openWorkspaceApp(`tab:${tabConfig.id}`);
  }
};

const handleSwitchMainView = (tabId: string) => {
  activeMainTab.value = tabId;
  if (layoutMode.value === 'freeform') {
    openWorkspaceApp(getWorkspaceAppIdForMainTab(tabId));
  }
};

const closeTab = (tabId: string) => {
  closeWorkspaceTab(tabId);
};

const handleToggleWidgetPanel = (panelId: string) => {
  if (layoutMode.value === 'freeform') {
    const widgetId = `widget:${panelId}`;
    const pluginId = `plugin:${panelId}`;
    openWorkspaceApp(workspaceAppMap.value.has(widgetId) ? widgetId : pluginId);
    return;
  }
  if (isMobile.value) {
    openTemporaryWidgetTab(panelId);
    return;
  }
  activeRightPanel.value = activeRightPanel.value === panelId ? 'none' : panelId;
};

const openSettingsPanel = () => {
  if (layoutMode.value === 'freeform') {
    openWorkspaceSettings();
    return;
  }
  if (isMobile.value) {
    openTemporaryWidgetTab('lumina-settings');
    return;
  }
  activeRightPanel.value = 'lumina-settings';
};

const createStageWithLauncherAndCloseMenu = () => {
  createStageWithLauncher();
  showWorkspaceMenu.value = false;
};

const openWorkspaceSettingsAndCloseMenu = () => {
  openWorkspaceSettings();
  showWorkspaceMenu.value = false;
};

const activateWorkspaceStageWithNavigation = (stageId: string) => {
  activateWorkspaceStage(stageId);
  if (!showWorkspaceNavigation.value) {
    scheduleWorkspaceNavigationHide(isMobile.value ? 1100 : 420);
  }
};

const createWorkspaceStageFromStrip = () => {
  createWorkspaceStage(true);
};

const handleWorkspaceDockOpenWithNavigation = (appId: string) => {
  if (appId === 'plugin:lumina-launcher') {
    if (showWorkspaceLaunchpad.value) {
      closeWorkspaceLaunchpad();
    } else {
      showWorkspaceLaunchpad.value = true;
      clearWorkspaceNavigationHideTimer();
      workspaceNavigationPeek.value = false;
    }
    return;
  }
  closeWorkspaceLaunchpad();
  handleWorkspaceDockOpen(appId);
  if (!showWorkspaceNavigation.value) {
    scheduleWorkspaceNavigationHide(isMobile.value ? 1100 : 420);
  }
};

const scheduleWorkspaceNavigationHideWrapper = () => {
  scheduleWorkspaceNavigationHide();
};

const toggleWorkspaceMenu = () => {
  showWorkspaceMenu.value = !showWorkspaceMenu.value;
};

const updateDesktopMode = async (desktopModeId: string) => {
  showWorkspaceMenu.value = false;
  closeWorkspaceLaunchpad();
  if (desktopModeId === activeDesktopModeId.value) {
    return;
  }
  await updateSetting('lumina-settings.activeDesktopMode', desktopModeId);
};

const toggleDiscordGuildRail = async () => {
  if (activeDesktopModeId.value !== 'discord') {
    return;
  }

  await updateSetting(
    getDesktopModeSettingStorageKey(activeDesktopModeId.value, 'discord-channel-mark'),
    !discordChannelMarkVisible.value
  );
};

const handleThemeChange = (event: MediaQueryListEvent) => {
  systemPrefersDark.value = event.matches;
};

const handleWorkspaceKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !showWorkspaceLaunchpad.value) return;
  event.preventDefault();
  closeWorkspaceLaunchpad();
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
  if (!isExpanded.value) {
    showWorkspaceMenu.value = false;
    closeWorkspaceLaunchpad();
    showWorkspaceNavigation.value = false;
    workspaceNavigationPeek.value = false;
    clearWorkspaceNavigationHideTimer();
    showDiscordMobileCharacterRail.value = false;
    return;
  }

  setTimeout(() => {
    lwApi.emit('SCROLL_TO_BOTTOM', { force: true });
  }, 400);

  setTimeout(() => {
    const state = lwApi.getSyncDiff?.();
    if (state?.hasDivergence) {
      shellRootRef.value?.openConflictViewer();
    }
  }, 100);
};

useShellBootstrap({
  isApiReady,
  initStatusText,
  settingsRevision,
  handleOpenTab,
  handleSwitchMainView,
  handleSwitchWidgetPanel: switchRightPanel,
  handleToggleWidgetPanel,
  setSidebarMode,
  onWorkspaceKeydown: handleWorkspaceKeydown,
  onThemeChange: handleThemeChange,
  onReady: () => {},
  onShowConflictPanel: () => shellRootRef.value?.openConflictViewer(),
  onShowSyncReportPanel: () => shellRootRef.value?.openSyncReportViewer(),
  onLayoutReady: () => {
    if (layoutMode.value === 'freeform') {
      showWorkspaceNavigation.value = shouldShowWorkspaceNavigationOnEntry();
      workspaceNavigationPeek.value = false;
      requestAnimationFrame(() => reconcileWorkspaceState(true));
    }
  },
  initSettings
});

watch(activeMainTab, (value) => {
  lwStorage.set('luminaWeave.activeMainTab', value, 'Global');
  if (value === 'lumina-timeline') {
    isTimelineLoadedOnce.value = true;
  }
  contextStore.syncFromTab(value);
});

watch(isMobile, (mobile, wasMobile) => {
  if (mobile && !wasMobile && layoutMode.value === 'traditional' && activeRightPanel.value !== 'none') {
    openTemporaryWidgetTab(activeRightPanel.value);
  }
});

watch(showWorkspaceMenu, (isOpen) => {
  if (isOpen) {
    closeWorkspaceLaunchpad();
    holdWorkspaceNavigation();
    return;
  }
  scheduleWorkspaceNavigationHide(isMobile.value ? 1600 : 760);
});

watch(isWorkspaceNavigationVisible, (value) => {
  workspaceNavigationVisibleState.value = value;
}, { immediate: true });

provide('lwApi', lwApi);
provide('lwWorkspaceActions', {
  openWorkspaceApp: (appId: string) => openWorkspaceApp(appId),
  closeWorkspaceApps: (appIds: string[]) => closeWorkspaceApps(appIds)
});
</script>
