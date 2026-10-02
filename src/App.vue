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
    <LuminaShellRoot
      ref="shellRootRef"
      :runtimeContext="shellRuntimeContext"
      :runtimeSurfaces="shellRuntimeSurfaces"
      :runtimeActions="shellRuntimeActions"
      :runtimeFrame="shellRuntimeFrame"
    />
  </AppRootContainer>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref, watch, type CSSProperties } from 'vue';
import { luminaWeaveApi as lwApi } from './api/index.js';
import { lwStorage } from './api/storage.js';
import { pluginManager } from './core/PluginManager.js';
import { getPrimarySurfaceContractIdForPlugin } from './platform/plugin/officialPluginSurfaces.js';
import { useSettings, currentDetailedView } from './plugins/settings/useSettings.js';
import { useResponsiveLayout } from './composables/useResponsiveLayout.js';
import { useWorkspaceManager } from './composables/useWorkspaceManager.js';
import { useHostLayoutViewport } from './composables/shell/useHostLayoutViewport.js';
import {
  resolveRootSafeAreaStyle,
  resolveRootSafeAreaResidualStyle
} from './composables/shell/rootSafeArea.js';
import { useShellBootstrap } from './composables/shell/useShellBootstrap.js';
import { useShellRuntimePayload } from './composables/shell/useShellRuntimePayload.js';
import { useTelegramShell } from './composables/shell/useTelegramShell.js';
import { useWidgetPanels } from './composables/shell/useWidgetPanels.js';
import { useWorkspaceNavigation } from './composables/shell/useWorkspaceNavigation.js';
import { useActivityLaunchState } from './composables/shell/useActivityLaunchState.js';
import { useDiscordShell } from './composables/shell/useDiscordShell.js';
import { useDesktopExperienceRuntime } from './composables/useDesktopExperienceRuntime.js';
import { resolveActivityLaunchPlacement } from './platform/activity/activityLaunchResolver.js';
import {
  createActivityStatusBarStyle,
  resolveActivityStatusBarAppearance
} from './platform/activity/statusBarAppearance.js';
import { applyAndroidStatusBarAppearance } from './platform/activity/androidStatusBarBridge.js';
import type { ActivityLaunchIntent, ActivityStatusBarDescriptor } from './platform/activity/types.js';
import {
  getDesktopModeOptions,
  resolveDesktopModeValues
} from './desktop-modes/core/registry.js';
import { useSurfaceSkin } from './desktop-modes/core/useSurfaceSkin.js';
import { useDesktopMode } from './desktop-modes/core/useDesktopMode.js';
import type { ThemeTraditionalNavigationPreset } from './desktop-modes/core/types.js';
import type {
  DynamicTabConfig,
  TelegramRailToolEntry
} from './shell/types.js';
import { registerLuminaPlugins } from './bootstrap/registerPlugins.js';
import { HostDetector } from './api/core/host-drivers/HostDetector.js';

import AppRootContainer from './shell/AppRootContainer.vue';
import LuminaShellRoot from './shell/LuminaShellRoot.vue';
import SplashPage from './components/SplashPage.vue';

type ShellKind = 'traditional' | 'freeform';

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

const mainPlugins = computed(() => pluginManager.getPluginsInSlot('mainView'));
const widgetPlugins = computed(() => {
  settingsRevision.value;
  return pluginManager.getPluginsInSlot('widget');
});
const workspacePlugins = computed(() => {
  settingsRevision.value;
  return pluginManager.getPlugins();
});

const {
  isMobile: responsiveIsMobile,
  sidebarMode,
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
} = useDesktopMode();
const shellKind = computed<ShellKind>(() => desktopShell.value.kind as ShellKind);
const layoutMode = shellKind;

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

const { cssVars: shellAppSkinVars, variant: shellAppVariant } = useSurfaceSkin('shell.app');
const { cssVars: shellPanelBodySkinVars } = useSurfaceSkin('shell.panelBody');
const { cssVars: shellMainSurfaceSkinVars } = useSurfaceSkin('shell.mainSurface');
const { cssVars: shellWidgetSkinVars } = useSurfaceSkin('shell.widget');
const { cssVars: shellWorkspaceStageSkinVars, variant: shellWorkspaceStageVariant } = useSurfaceSkin('shell.workspaceStage');
const { cssVars: shellWorkspaceMenuSkinVars, variant: shellWorkspaceMenuVariant } = useSurfaceSkin('shell.workspaceMenu');

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
  handleWorkspaceDockOpen,
  openWorkspaceApp,
  closeWorkspaceApps,
  closeTab: closeWorkspaceTab,
  getWorkspaceAppIdForMainTab,
  workspaceAppMap
} = useWorkspaceManager({
  plugins: workspacePlugins,
  dynamicTabs,
  activeMainTab,
  activeRightPanel,
  activeDesktopModeId,
  isMobile,
  freeformStageRef,
  workspaceNavigationVisible: workspaceNavigationVisibleState
});

function getPluginName(pluginId: string | null) {
  if (!pluginId) return '';
  const plugin = pluginManager.getPlugin(pluginId);
  return plugin ? plugin.name : pluginId;
}

const resolvePluginPrimarySurface = (pluginId: string) => {
  const plugin = pluginManager.getPlugin(pluginId);
  return plugin ? getPrimarySurfaceContractIdForPlugin(plugin) : null;
};

const resolveRegisteredPanelSurface = (panelId: string) =>
  lwApi.services.desktopSurface.registeredPanels.get(panelId)?.config.surfaceContractId || null;

const {
  widgetWidth,
  isResizing,
  telegramLeftRailWidth,
  isTelegramLeftRailResizing,
  activeWidgetPlugin,
  activeRegisteredPanel,
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
  isWorkspaceNavigationVisible,
  isWorkspaceStageStripVisible,
  isWorkspaceDockVisible,
  shouldShowWorkspaceNavigationOnEntry,
  clearWorkspaceNavigationHideTimer,
  scheduleWorkspaceNavigationHide,
  holdWorkspaceNavigation,
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

const {
  runtime: desktopExperienceRuntime,
  contextStore
} = useDesktopExperienceRuntime();
const {
  characterChannelState,
  discordChannelMarkVisible,
  isDiscordMobileMode,
  shouldShowDiscordMobileShell,
  shouldShowDiscordGuildRail,
  discordMobileGuildRailPosition,
  discordMobileCharacterEntryPosition,
  shouldShowCharacterNavigationPane,
  discordGuildEntries,
  showDiscordMobileCharacterRail,
  discordMobileMainStyle,
  discordMobileCharacterEntryStyle,
  handleDiscordMobileMainViewSwitch,
  toggleDiscordGuildRail,
  openDiscordChatSession,
  openDiscordMobileChatSession,
  createDiscordChatSession,
  createDiscordMobileChatSession
} = useDiscordShell({
  activeDesktopModeId,
  layoutMode,
  isMobile,
  activeSettings,
  traditionalLeftRail: computed(() => traditionalNavigationPreset.value.leftRail),
  mainPlugins,
  dynamicTabs,
  activeMainTab,
  desktopExperienceRuntime,
  contextStore,
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
  reflowWorkspaceWindows,
  safeAreaCssSource: HostDetector.isGenericTauriApp && HostDetector.isAndroid ? 'lumina-native' : 'auto'
});

const {
  activeActivityStatusBar,
  activeRightPanelActivity,
  applyLaunchResolution,
  setActivityStatusBarOverride,
  clearTransientActivityMetadata
} = useActivityLaunchState();

const resolvedActivityStatusBarAppearance = computed(() => resolveActivityStatusBarAppearance({
  statusBar: activeActivityStatusBar.value,
  resolvedAppearance: resolvedTheme.value
}));

const activityStatusBarStyle = computed<CSSProperties>(() =>
  createActivityStatusBarStyle(resolvedActivityStatusBarAppearance.value)
);

const rootSafeAreaStyle = computed<CSSProperties>(() => resolveRootSafeAreaStyle({
  isAndroidGenericTauri: HostDetector.isGenericTauriApp && HostDetector.isAndroid,
  layoutSource: layoutSource.value,
  statusBarSafeArea: resolvedActivityStatusBarAppearance.value.safeArea,
  safeInsets: {
    top: safeInsetTopPx.value,
    right: safeInsetRightPx.value,
    bottom: safeInsetBottomPx.value,
    left: safeInsetLeftPx.value
  }
}));

const rootFrameSafeAreaStyle = computed<CSSProperties>(() =>
  resolveRootSafeAreaResidualStyle(rootSafeAreaStyle.value)
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
  const panelTopPx = viewportOffsetTopPx.value;
  const panelPaddingTopPx = rootSafeTopPx;

  console.debug('[LuminaWeave][RootSafeArea] topPx/paddingTop', {
    layoutSource: layoutSource.value,
    viewportTopPx: viewportOffsetTopPx.value,
    safeInsetTopPx: safeInsetTopPx.value,
    rootSafeTopPx,
    panelTopPx,
    panelPaddingTopPx
  });
}, { immediate: true });

watch(resolvedActivityStatusBarAppearance, (appearance) => {
  applyAndroidStatusBarAppearance({
    appearance,
    isAndroidGenericTauri: HostDetector.isGenericTauriApp && HostDetector.isAndroid
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
  ...activityStatusBarStyle.value,
  ...resolveDesktopModeValues(activeDesktopMode.value.designTokens, {
    activeSettings,
    resolvedAppearance: resolvedTheme.value,
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
  showDiscordMobileCharacterRail.value = false;
  handleSwitchMainView(toolId);
};

const handleOpenDiscordChatSession = async (sessionId: string) => {
  await openDiscordChatSession(sessionId);
};

const handleOpenDiscordMobileChatSession = async (sessionId: string) => {
  await openDiscordMobileChatSession(sessionId);
};

const handleCreateDiscordChatSession = async (payload: Parameters<typeof createDiscordChatSession>[0]) => {
  await createDiscordChatSession(payload);
};

const handleCreateDiscordMobileChatSession = async (payload: Parameters<typeof createDiscordMobileChatSession>[0]) => {
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

const resolveWorkspaceActivityAppId = (preferredAppId: string | undefined, panelId: string | undefined) => {
  const candidates = [
    preferredAppId,
    panelId ? `panel:${panelId}` : undefined,
    panelId ? `widget:${panelId}` : undefined,
    panelId ? `plugin:${panelId}` : undefined
  ].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => workspaceAppMap.value.has(candidate)) || candidates[0] || '';
};

const handleLaunchActivity = (intent: ActivityLaunchIntent) => {
  const resolved = resolveActivityLaunchPlacement(intent, {
    shellKind: shellKind.value,
    isMobile: isMobile.value,
    desktopModeId: activeDesktopModeId.value
  });
  applyLaunchResolution(resolved);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lw:activity-change', {
      detail: {
        activity: resolved.activity,
        placement: resolved.placement,
        panelId: resolved.panelId
      }
    }));
  }

  if (resolved.placement === 'modal') {
    if (resolved.modalEvent) {
      lwApi.emit(resolved.modalEvent, intent.props || {});
    }
    return;
  }

  if (resolved.placement === 'telegram-stack') {
    if (resolved.telegramRoute) {
      pushTelegramMobileRoute(resolved.telegramRoute);
    }
    return;
  }

  if (resolved.placement === 'workspace-window') {
    const appId = resolveWorkspaceActivityAppId(resolved.workspaceAppId, resolved.panelId);
    if (appId && workspaceAppMap.value.has(appId)) {
      openWorkspaceApp(appId);
      return;
    }
    if (resolved.tab) {
      handleOpenTab(resolved.tab);
    }
    return;
  }

  if (resolved.placement === 'right-panel') {
    activeRightPanel.value = resolved.panelId || intent.id || 'lumina-settings';
    showWidgetDropdown.value = false;
    return;
  }

  if (resolved.placement === 'main' && intent.target.kind === 'plugin') {
    handleSwitchMainView(intent.target.pluginId, { preserveActivityMetadata: true });
    return;
  }

  if (resolved.tab) {
    handleOpenTab(resolved.tab);
  }
};

const handleSetActivityStatusBar = (statusBar: ActivityStatusBarDescriptor | null) => {
  setActivityStatusBarOverride(statusBar);
};

const handleSwitchMainView = (tabId: string, options: { preserveActivityMetadata?: boolean } = {}) => {
  if (!options.preserveActivityMetadata) {
    clearTransientActivityMetadata();
  }
  activeMainTab.value = tabId;
  if (layoutMode.value === 'freeform') {
    openWorkspaceApp(getWorkspaceAppIdForMainTab(tabId));
  }
};

const closeTab = (tabId: string) => {
  if (activeMainTab.value === tabId) {
    clearTransientActivityMetadata();
  }
  closeWorkspaceTab(tabId);
};

const handleToggleWidgetPanel = (panelId: string) => {
  clearTransientActivityMetadata();
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
  clearTransientActivityMetadata();
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
  telegramDesktopLeftRoute,
  telegramMobileActiveTab,
  telegramMobileCurrentRoute,
  openProfilePanel: openTelegramProfilePanel,
  openCharacters: openTelegramCharacters,
  selectBottomNav: handleTelegramBottomNavSelect,
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

const handleSwitchRightPanel = (panelId: string) => {
  clearTransientActivityMetadata();
  switchRightPanel(panelId);
};

const handleOpenWidgetWithActivityReset = (panelId: string) => {
  clearTransientActivityMetadata();
  handleOpenWidget(panelId);
};

const handleCloseWidgetPanel = () => {
  clearTransientActivityMetadata();
  closeWidgetPanel();
};

const pushTelegramMobileRouteWithActivityReset = (route: Parameters<typeof pushTelegramMobileRoute>[0]) => {
  clearTransientActivityMetadata();
  pushTelegramMobileRoute(route);
};

const popTelegramMobileRouteWithActivityReset = () => {
  clearTransientActivityMetadata();
  popTelegramMobileRoute();
};

const handleTelegramBottomNavSelectWithActivityReset = (
  itemId: Parameters<typeof handleTelegramBottomNavSelect>[0]
) => {
  clearTransientActivityMetadata();
  handleTelegramBottomNavSelect(itemId);
};

const createWorkspaceStageAndCloseMenu = () => {
  createWorkspaceStage(true);
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
  if (desktopModeId === activeDesktopModeId.value) {
    return;
  }
  await updateSetting('lumina-settings.activeDesktopMode', desktopModeId);
};

const handleThemeChange = (event: MediaQueryListEvent) => {
  systemPrefersDark.value = event.matches;
};

const handleWorkspaceKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !showWorkspaceMenu.value) return;
  event.preventDefault();
  showWorkspaceMenu.value = false;
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
  if (!isExpanded.value) {
    showWorkspaceMenu.value = false;
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

const {
  shellRuntimeContext,
  shellRuntimeSurfaces,
  shellRuntimeActions,
  shellRuntimeFrame
} = useShellRuntimePayload({
  context: {
    shellKind,
    activeDesktopModeId,
    desktopModeOptions,
    activeMainTab,
    isMobile,
    currentDetailedView,
    saveStatus,
    widgetGroups,
    characterChannelState,
    traditional: {
      shouldShowDiscordGuildRail,
      discordGuildEntries,
      shouldShowCharacterNavigationPane,
      isDiscordMobileMode,
      isTelegramMobileMode,
      shouldShowDiscordMobileShell,
      discordMobileGuildRailPosition,
      discordMobileCharacterEntryPosition,
      showDiscordMobileCharacterRail,
      discordMobileCharacterEntryStyle,
      telegramToolEntries,
      activeTelegramToolId,
      telegramDesktopLeftRoute,
      telegramMobileActiveTab,
      telegramMobileCurrentRoute,
      isTimelineLoadedOnce,
      sidebarMode,
      activeRightPanel: visibleRightPanel,
      widgetWidth: visibleWidgetWidth,
      isResizing,
      telegramLeftRailWidth,
      isTelegramLeftRailResizing,
      activeWidgetPlugin,
      activeRegisteredPanel,
      activeRightPanelActivity,
      showWidgetDropdown,
      showNexus: visibleShowNexus
    },
    freeform: {
      showWorkspaceMenu,
      isWorkspaceStageStripVisible,
      isWorkspaceNavigationVisible,
      activeWorkspaceWindowId,
      workspaceSceneInsets,
      isWorkspaceDockVisible
    }
  },
  surfaces: {
    dynamicTabs,
    widgetPanelList,
    traditional: {
      mainPlugins,
      mainSurfaceVariant: shellMainSurfaceVariant,
      mainSurfaceStyle: shellMainSurfaceStyle,
      mobileMainStyle: discordMobileMainStyle,
      widgetSurfaceVariant: shellWidgetSurfaceVariant,
      widgetStyle: shellWidgetStyle
    },
    freeform: {
      workspaceMenuVariant: computed(() => shellWorkspaceMenuVariant.value || 'default'),
      workspaceMenuStyle: shellWorkspaceMenuStyle,
      workspaceStageVariant: computed(() => shellWorkspaceStageVariant.value || 'default'),
      workspaceStageStyle: shellWorkspaceStageStyle,
      stageStripItems: workspaceStageStripItems,
      stageWindowEntries: activeStageWindowEntries,
      dockDisplayItems: workspaceDockItems
    }
  },
  actions: {
    getPluginName,
    resolvePluginPrimarySurface,
    resolveRegisteredPanelSurface,
    navigation: {
      switchMainView: handleSwitchMainView,
      closeTab,
      close: toggleExpand,
      updateDesktopMode,
      openSettingsPanel
    },
    frame: {
      panelBodyElementChange: handlePanelBodyElementChange
    },
    traditional: {
      toggleDiscordGuildRail,
      handleOpenWidget: handleOpenWidgetWithActivityReset,
      openDiscordChatSession: handleOpenDiscordChatSession,
      openDiscordMobileChatSession: handleOpenDiscordMobileChatSession,
      createDiscordChatSession: handleCreateDiscordChatSession,
      createDiscordMobileChatSession: handleCreateDiscordMobileChatSession,
      handleDiscordMobileMainViewSwitch,
      updateShowDiscordMobileCharacterRail,
      openTelegramToolEntry,
      setTelegramDesktopLeftRoute,
      pushTelegramMobileRoute: pushTelegramMobileRouteWithActivityReset,
      popTelegramMobileRoute: popTelegramMobileRouteWithActivityReset,
      resizeStart: initResize,
      telegramLeftRailResizeStart: initLeftRailResize,
      backFromDetailedSettings,
      toggleWidgetDropdown,
      switchRightPanel: handleSwitchRightPanel,
      closePanel: handleCloseWidgetPanel,
      updateShowNexus,
      selectTelegramBottomNav: handleTelegramBottomNavSelectWithActivityReset
    },
    freeform: {
      createWorkspaceStage: createWorkspaceStageAndCloseMenu,
      activateWorkspaceStageWithNavigation,
      createWorkspaceStageFromStrip,
      holdWorkspaceNavigation,
      scheduleWorkspaceNavigationHide: scheduleWorkspaceNavigationHideWrapper,
      toggleWorkspaceNavigation,
      toggleWorkspaceMenu,
      handleFreeformScenePointerDown,
      updateWorkspaceLayout,
      closeWorkspaceWindow,
      focusWorkspaceWindow,
      focusAdjacentWorkspaceWindow,
      handleWorkspaceDockOpenWithNavigation,
      stageElementChange: handleStageElementChange
    }
  },
  frame: {
    panelHeaderVariant,
    traditionalHeaderPosition,
    panelBodyStyle: shellPanelBodyStyle,
    showSplash,
    discordChannelMarkVisible
  }
});

useShellBootstrap({
  isApiReady,
  initStatusText,
  settingsRevision,
  handleOpenTab,
  handleLaunchActivity,
  handleSetActivityStatusBar,
  handleSwitchMainView,
  handleSwitchWidgetPanel: handleSwitchRightPanel,
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
