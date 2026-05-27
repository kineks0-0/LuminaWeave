<template>
  <transition name="fade">
    <SplashPage
      v-if="showSplash && isExpanded"
      :statusText="initStatusText"
      :isReady="isApiReady"
      @finished="showSplash = false"
    />
  </transition>
  <AppRootContainer :isExpanded="isExpanded" :resolvedTheme="resolvedTheme" :activeDesktopModeId="activeDesktopModeId"
    :motionPerformanceSetting="motionPerformanceSetting" :layoutMode="layoutMode" :appRootStyle="appRootStyle"
    :rootFrameStyle="rootFrameStyle" :shellAppVariant="shellAppVariant || 'default'" :showMiniSidebar="!isStandalone" @expand="toggleExpand">
    <LuminaShellRoot ref="shellRootRef" :layoutMode="layoutMode" :panelHeaderVariant="panelHeaderVariant"
      :traditionalHeaderPosition="traditionalHeaderPosition" :activeMainTab="activeMainTab" :dynamicTabs="dynamicTabs"
      :isMobile="isMobile" :activeDesktopModeId="activeDesktopModeId" :desktopModeOptions="desktopModeOptions"
      :widgetPanelList="widgetPanelList" :widgetGroups="widgetGroups" :activeRightPanel="visibleRightPanel"
      :discordChannelMarkVisible="discordChannelMarkVisible" :shellPanelBodyStyle="shellPanelBodyStyle"
      :isApiReady="isApiReady" :showSplash="showSplash" :initStatusText="initStatusText" :shouldShowDiscordGuildRail="shouldShowDiscordGuildRail"
      :discordGuildEntries="discordGuildEntries" :shouldShowForgeSidebar="shouldShowForgeSidebar"
      :isForgeSidebarCollapsed="isForgeSidebarCollapsed"
      :shouldShowDiscordCharacterRail="shouldShowDiscordCharacterRail" :characterChannelState="characterChannelState"
      :isDiscordMobileMode="isDiscordMobileMode" :isTelegramMobileMode="isTelegramMobileMode"
      :shouldShowDiscordMobileShell="shouldShowDiscordMobileShell"
      :discordMobileGuildRailPosition="discordMobileGuildRailPosition"
      :discordMobileCharacterEntryPosition="discordMobileCharacterEntryPosition"
      :showDiscordMobileCharacterRail="showDiscordMobileCharacterRail"
      :discordMobileCharacterEntryStyle="discordMobileCharacterEntryStyle"
      :telegramSelectedCharacterKey="telegramSelectedCharacterKey" :telegramToolEntries="telegramToolEntries"
      :activeTelegramToolId="activeTelegramToolId" :telegramConversationListMode="telegramConversationListMode"
      :telegramDesktopLeftRoute="telegramDesktopLeftRoute" :telegramMobileActiveTab="telegramMobileActiveTab"
      :telegramMobileCurrentRoute="telegramMobileCurrentRoute" :mainPlugins="mainPlugins"
      :shellMainSurfaceVariant="shellMainSurfaceVariant" :shellMainSurfaceStyle="shellMainSurfaceStyle"
      :discordMobileMainStyle="discordMobileMainStyle" :isTimelineLoadedOnce="isTimelineLoadedOnce"
      :isForgeActiveInTraditional="isForgeActiveInTraditional" :sidebarMode="sidebarMode"
      :shellWidgetSurfaceVariant="shellWidgetSurfaceVariant" :shellWidgetStyle="shellWidgetStyle"
      :widgetWidth="visibleWidgetWidth" :isResizing="isResizing" :telegramLeftRailWidth="telegramLeftRailWidth"
      :isTelegramLeftRailResizing="isTelegramLeftRailResizing" :currentDetailedView="currentDetailedView"
      :saveStatus="saveStatus" :activeForgeAuxKind="activeForgeAuxKind" :rawSidebarMode="rawSidebarMode"
      :activeWidgetPlugin="activeWidgetPlugin" :activeRegisteredPanel="activeRegisteredPanel"
      :showWidgetDropdown="showWidgetDropdown" :showNexus="visibleShowNexus" :getPluginName="getPluginName"
      :showWorkspaceMenu="showWorkspaceMenu" :shellWorkspaceMenuVariant="shellWorkspaceMenuVariant || 'default'"
      :shellWorkspaceMenuStyle="shellWorkspaceMenuStyle"
      :shellWorkspaceStageVariant="shellWorkspaceStageVariant || 'default'"
      :shellWorkspaceStageStyle="shellWorkspaceStageStyle" :isWorkspaceStageStripVisible="isWorkspaceStageStripVisible"
      :workspaceStageStripItems="workspaceStageStripItems" :isWorkspaceNavigationVisible="isWorkspaceNavigationVisible"
      :activeStageWindowEntries="activeStageWindowEntries" :activeWorkspaceWindowId="activeWorkspaceWindowId"
      :workspaceSceneInsets="workspaceSceneInsets" :showWorkspaceLaunchpad="showWorkspaceLaunchpad"
      :isWorkspaceDockVisible="isWorkspaceDockVisible" :workspaceDockDisplayItems="workspaceDockDisplayItems"
      :onSwitchMainView="handleSwitchMainView" :onCloseTab="closeTab" :onClose="toggleExpand"
      :onOpenSettingsPanel="openSettingsPanel" :onToggleDiscordGuildRail="toggleDiscordGuildRail"
      :onUpdateDesktopMode="updateDesktopMode" :onHandleOpenWidget="handleOpenWidget"
      :onToggleForgeSidebarCollapse="toggleForgeSidebarCollapse" :onSetSidebarMode="setSidebarMode"
      :onOpenDiscordChatSession="handleOpenDiscordChatSession"
      :onOpenDiscordMobileChatSession="handleOpenDiscordMobileChatSession"
      :onCreateDiscordChatSession="handleCreateDiscordChatSession"
      :onCreateDiscordMobileChatSession="handleCreateDiscordMobileChatSession"
      :onRenameDiscordChatSession="renameDiscordChatSession" :onDeleteDiscordChatSession="deleteDiscordChatSession"
      :onToggleDiscordCharacterGroup="toggleDiscordCharacterGroup"
      :onToggleDiscordCharacterSessionExpansion="toggleDiscordCharacterSessionExpansion"
      :onHandleDiscordMobileMainViewSwitch="handleDiscordMobileMainViewSwitch"
      :onUpdateShowDiscordMobileCharacterRail="updateShowDiscordMobileCharacterRail"
      :onSelectTelegramCharacterOverview="selectTelegramCharacterOverview"
      :onOpenTelegramToolEntry="openTelegramToolEntry"
      :onSetTelegramConversationListMode="setTelegramConversationListMode"
      :onSetTelegramDesktopLeftRoute="setTelegramDesktopLeftRoute" :onPushTelegramMobileRoute="pushTelegramMobileRoute"
      :onPopTelegramMobileRoute="popTelegramMobileRoute" :onResizeStart="initResize"
      :onTelegramLeftRailResizeStart="initLeftRailResize" :onBackFromDetailedSettings="backFromDetailedSettings"
      :onToggleWidgetDropdown="toggleWidgetDropdown" :onSwitchRightPanel="switchRightPanel"
      :onRestoreSidebarLeft="restoreSidebarLeft" :onClosePanel="closeWidgetPanel" :onUpdateShowNexus="updateShowNexus"
      :onSelectTelegramBottomNav="handleTelegramBottomNavSelect"
      :onCreateStageWithLauncher="createStageWithLauncherAndCloseMenu"
      :onOpenWorkspaceSettings="openWorkspaceSettingsAndCloseMenu"
      :onActivateWorkspaceStageWithNavigation="activateWorkspaceStageWithNavigation"
      :onCreateWorkspaceStageFromStrip="createWorkspaceStageFromStrip"
      :onHoldWorkspaceNavigation="holdWorkspaceNavigation"
      :onScheduleWorkspaceNavigationHide="scheduleWorkspaceNavigationHideWrapper"
      :onToggleWorkspaceNavigation="toggleWorkspaceNavigation" :onToggleWorkspaceMenu="toggleWorkspaceMenu"
      :onHandleFreeformScenePointerDown="handleFreeformScenePointerDown"
      :onUpdateWorkspaceLayout="updateWorkspaceLayout" :onCloseWorkspaceWindow="closeWorkspaceWindow"
      :onFocusWorkspaceWindow="focusWorkspaceWindow" :onFocusAdjacentWorkspaceWindow="focusAdjacentWorkspaceWindow"
      :onCloseWorkspaceLaunchpad="closeWorkspaceLaunchpad"
      :onHandleWorkspaceDockOpenWithNavigation="handleWorkspaceDockOpenWithNavigation"
      :onStageElementChange="handleStageElementChange" :onPanelBodyElementChange="handlePanelBodyElementChange" />
  </AppRootContainer>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref, watch, type CSSProperties } from 'vue';
import { luminaWeaveApi as lwApi } from './api/index.js';
import { lwStorage } from './api/storage.js';
import { pluginManager } from './core/PluginManager.js';
import { useSettings, currentDetailedView } from './plugins/settings/useSettings.js';
import { useResponsiveLayout } from './composables/useResponsiveLayout.js';
import { useWorkspaceManager } from './composables/useWorkspaceManager.js';
import { useHostLayoutViewport } from './composables/shell/useHostLayoutViewport.js';
import {
  resolveRootSafeAreaStyle,
  rootSafeAreaStyleConsumesInsets
} from './composables/shell/rootSafeArea.js';
import { useShellBootstrap } from './composables/shell/useShellBootstrap.js';
import { useTelegramShell } from './composables/shell/useTelegramShell.js';
import { useWidgetPanels } from './composables/shell/useWidgetPanels.js';
import { useWorkspaceNavigation } from './composables/shell/useWorkspaceNavigation.js';
import { useDiscordShell } from './composables/shell/useDiscordShell.js';
import {
  getDesktopModeOptions,
  resolveThemeValues
} from './theme/themeRegistry.js';
import { useComponentSkin } from './theme/useComponentSkin.js';
import { useThemePack } from './theme/useThemePack.js';
import type { ThemeTraditionalNavigationPreset } from './theme/types.js';
import type { DynamicTabConfig, TelegramRailToolEntry } from './shell/types.js';
import { registerLuminaPlugins } from './bootstrap/registerPlugins.js';
import { HostDetector } from './api/core/host-drivers/HostDetector.js';

import AppRootContainer from './shell/AppRootContainer.vue';
import LuminaShellRoot from './shell/LuminaShellRoot.vue';
import SplashPage from './components/SplashPage.vue';

type LayoutMode = 'traditional' | 'freeform';

registerLuminaPlugins();

const hostContainer = inject<HTMLElement | null>('lwHostContainer', null);
const shellRootRef = ref<InstanceType<typeof LuminaShellRoot> | null>(null);

const { initSettings, saveStatus, activeSettings, updateSetting } = useSettings();

const isStandalone = computed(() => HostDetector.isStandalone);
const isExpanded = ref(isStandalone.value);
const isApiReady = ref(false);
const showSplash = ref(true);
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
let initialRightPanel = String(lwStorage.get('luminaWeave.activeRightPanel', 'lumina-settings', 'Global'));
// 兼容旧版本：lumina-nexus 已经被移出侧边栏插件并独立，如果缓存中仍是它，重置为设置面板
/*if (initialRightPanel === 'lumina-nexus') {
  initialRightPanel = 'lumina-settings';
  lwStorage.set('luminaWeave.activeRightPanel', 'lumina-settings', 'Global');
}

const activeRightPanel = ref(initialRightPanel);
const lastKnownRightPanel = ref(initialRightPanel !== 'none' ? initialRightPanel : 'lumina-settings');
*/
const activeRightPanel = ref(lwStorage.get('luminaWeave.activeRightPanel', 'lumina-settings', 'Global'));
const lastKnownRightPanel = ref(lwStorage.get('luminaWeave.activeRightPanel', 'lumina-settings', 'Global'));

const showWidgetDropdown = ref(false);
const showNexus = ref(lwStorage.get('luminaWeave.showNexus', true, 'Global'));
const telegramSelectedCharacterKey = ref<string | null>(null);

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

const desktopModeOptions = computed(() => getDesktopModeOptions());
const {
  desktopModeId: activeDesktopModeId,
  desktopMode: activeDesktopMode,
  desktopShell,
  resolvedAppearance,
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
const resolvedTheme = computed(() => resolvedAppearance.value);

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
  telegramLeftRailWidth,
  isTelegramLeftRailResizing,
  activeWidgetPlugin,
  activeRegisteredPanel,
  activeForgeAuxKind,
  widgetPanelList,
  widgetGroups,
  openTemporaryWidgetTab,
  switchRightPanel,
  handleOpenWidget,
  closeWidgetPanel,
  initResize,
  initLeftRailResize
} = useWidgetPanels({
  activeRightPanel,
  lastKnownRightPanel,
  showWidgetDropdown,
  showNexus,
  widgetPlugins,
  layoutMode,
  isMobile,
  activeDesktopModeId,
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
  toggleDiscordGuildRail,
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
  updateSetting,
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

const rootSafeAreaStyle = computed<CSSProperties>(() => resolveRootSafeAreaStyle({
  isAndroidGenericTauri: HostDetector.isGenericTauriApp && HostDetector.isAndroid,
  layoutSource: layoutSource.value,
  safeInsets: {
    top: safeInsetTopPx.value,
    right: safeInsetRightPx.value,
    bottom: safeInsetBottomPx.value,
    left: safeInsetLeftPx.value
  }
}));

const rootFrameSafeAreaStyle = computed<CSSProperties>(() =>
  rootSafeAreaStyleConsumesInsets(rootSafeAreaStyle.value)
    ? {
        '--lw-safe-top': '0px',
        '--lw-safe-right': '0px',
        '--lw-safe-bottom': '0px',
        '--lw-safe-left': '0px'
      }
    : {}
);

const parseCssPixel = (value: unknown): number => {
  const parsed = Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
};

watch([
  viewportOffsetTopPx,
  safeInsetTopPx,
  layoutSource,
  rootSafeAreaStyle
], () => {
  if (!HostDetector.isGenericTauriApp || !HostDetector.isAndroid) {
    return;
  }

  const rootSafeTopPx = parseCssPixel(rootSafeAreaStyle.value['--lw-root-safe-top']);
  const topPxBefore = viewportOffsetTopPx.value;
  const topPxAfter = topPxBefore + rootSafeTopPx;

  console.debug('[LuminaWeave][RootSafeArea] topPx before/after', {
    layoutSource: layoutSource.value,
    viewportTopPx: viewportOffsetTopPx.value,
    safeInsetTopPx: safeInsetTopPx.value,
    rootSafeTopPx,
    topPxBefore,
    topPxAfter
  });
}, { immediate: true });

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
  ...rootSafeAreaStyle.value,
  ...resolveThemeValues(activeDesktopMode.value.designTokens, {
    activeSettings,
    resolvedAppearance: resolvedTheme.value,
    themePackId: activeDesktopModeId.value,
    desktopModeId: activeDesktopModeId.value
  })
}));

const rootFrameStyle = computed<CSSProperties>(() => {
  const baseStyle = shellAppSkinVars.value as CSSProperties;
  const safeAreaStyle = rootFrameSafeAreaStyle.value;
  if (rootPanelShiftPx.value <= 0) {
    return {
      ...baseStyle,
      ...safeAreaStyle
    };
  }

  const existingTransform = typeof baseStyle.transform === 'string' ? baseStyle.transform : '';
  const nextTransform = `translateY(-${rootPanelShiftPx.value}px)`;

  return {
    ...baseStyle,
    ...safeAreaStyle,
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

const selectTelegramCharacterOverview = (groupKey: string | null) => {
  telegramSelectedCharacterKey.value = groupKey;
  if (groupKey && activeDesktopModeId.value === 'telegram') {
    showDiscordMobileCharacterRail.value = false;
    handleSwitchMainView('lumina-chat');
  }
};

const clearTelegramCharacterOverview = () => {
  telegramSelectedCharacterKey.value = null;
};

const telegramToolEntries = computed<TelegramRailToolEntry[]>(() => {
  const launcher = pluginManager.getPlugin('lumina-launcher');
  const forge = pluginManager.getPlugin('lumina-forge');
  const entries: TelegramRailToolEntry[] = [];

  if (launcher) {
    entries.push({
      id: 'lumina-launcher',
      label: launcher.name || '启动台',
      description: '打开 LuminaWeave 功能入口',
      icon: launcher.icon || '↗'
    });
  }
  if (forge) {
    entries.push({
      id: 'lumina-forge',
      label: forge.name || '制卡工坊',
      description: '创建与整理角色卡',
      icon: forge.icon || '✦'
    });
  }

  return entries;
});

const activeTelegramToolId = computed<string | null>(() => {
  if (activeDesktopModeId.value !== 'telegram') return null;
  return activeMainTab.value === 'lumina-launcher' || activeMainTab.value === 'lumina-forge'
    ? activeMainTab.value
    : null;
});

const openTelegramToolEntry = (toolId: TelegramRailToolEntry['id']) => {
  clearTelegramCharacterOverview();
  showDiscordMobileCharacterRail.value = false;
  handleSwitchMainView(toolId);
};

const handleOpenDiscordChatSession = async (sessionId: string) => {
  clearTelegramCharacterOverview();
  await openDiscordChatSession(sessionId);
};

const handleOpenDiscordMobileChatSession = async (sessionId: string) => {
  clearTelegramCharacterOverview();
  await openDiscordMobileChatSession(sessionId);
};

const handleCreateDiscordChatSession = async (payload: Parameters<typeof createDiscordChatSession>[0]) => {
  clearTelegramCharacterOverview();
  await createDiscordChatSession(payload);
};

const handleCreateDiscordMobileChatSession = async (payload: Parameters<typeof createDiscordMobileChatSession>[0]) => {
  clearTelegramCharacterOverview();
  await createDiscordMobileChatSession(payload);
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

const {
  isTelegramMobileMode,
  visibleRightPanel,
  visibleWidgetWidth,
  visibleShowNexus,
  telegramConversationListMode,
  telegramDesktopLeftRoute,
  telegramMobileActiveTab,
  telegramMobileCurrentRoute,
  openProfilePanel: openTelegramProfilePanel,
  openCharacters: openTelegramCharacters,
  selectBottomNav: handleTelegramBottomNavSelect,
  setTelegramConversationListMode,
  setTelegramDesktopLeftRoute,
  pushTelegramMobileRoute,
  popTelegramMobileRoute
} = useTelegramShell({
  activeDesktopModeId,
  layoutMode,
  isMobile,
  activeSettings,
  viewportWidthPx,
  widgetWidth,
  showNexus,
  activeRightPanel,
  showCharacterRail: showDiscordMobileCharacterRail,
  switchMainView: handleSwitchMainView
});

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

  // 独立模式下强制保持展开
  if (isStandalone.value) {
    isExpanded.value = true;
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
  onReady: () => { },
  onShowConflictPanel: () => shellRootRef.value?.openConflictViewer(),
  onShowSyncReportPanel: () => shellRootRef.value?.openSyncReportViewer(),
  onOpenTelegramProfile: openTelegramProfilePanel,
  onOpenTelegramCharacters: openTelegramCharacters,
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
  if (value !== 'lumina-chat') {
    clearTelegramCharacterOverview();
  }
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
