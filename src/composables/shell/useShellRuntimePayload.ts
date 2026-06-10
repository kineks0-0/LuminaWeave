import { computed, unref, type ComputedRef, type Ref } from 'vue';
import type {
  ShellRuntimeActions,
  ShellRuntimeContext,
  ShellRuntimeFrame,
  ShellRuntimeSurfaces
} from '../../shell/types.js';

type Source<T> = Ref<T> | ComputedRef<T>;

const read = <T>(source: Source<T>): T => unref(source);

interface ShellRuntimePayloadContextInput {
  shellKind: Source<ShellRuntimeContext['shellKind']>;
  layoutMode: Source<ShellRuntimeContext['layoutMode']>;
  activeDesktopModeId: Source<ShellRuntimeContext['activeDesktopModeId']>;
  desktopModeOptions: Source<ShellRuntimeContext['desktopModeOptions']>;
  activeMainTab: Source<ShellRuntimeContext['activeMainTab']>;
  isMobile: Source<ShellRuntimeContext['isMobile']>;
  currentDetailedView: Source<ShellRuntimeContext['currentDetailedView']>;
  saveStatus: Source<ShellRuntimeContext['saveStatus']>;
  widgetGroups: Source<ShellRuntimeContext['widgetGroups']>;
  characterChannelState: Source<ShellRuntimeContext['characterChannelState']>;
  traditional: {
    shouldShowDiscordGuildRail: Source<ShellRuntimeContext['traditional']['shouldShowDiscordGuildRail']>;
    discordGuildEntries: Source<ShellRuntimeContext['traditional']['discordGuildEntries']>;
    shouldShowForgeSidebar: Source<ShellRuntimeContext['traditional']['shouldShowForgeSidebar']>;
    isForgeSidebarCollapsed: Source<ShellRuntimeContext['traditional']['isForgeSidebarCollapsed']>;
    shouldShowDiscordCharacterRail: Source<ShellRuntimeContext['traditional']['shouldShowDiscordCharacterRail']>;
    isDiscordMobileMode: Source<ShellRuntimeContext['traditional']['isDiscordMobileMode']>;
    isTelegramMobileMode: Source<ShellRuntimeContext['traditional']['isTelegramMobileMode']>;
    shouldShowDiscordMobileShell: Source<ShellRuntimeContext['traditional']['shouldShowDiscordMobileShell']>;
    discordMobileGuildRailPosition: Source<ShellRuntimeContext['traditional']['discordMobileGuildRailPosition']>;
    discordMobileCharacterEntryPosition: Source<ShellRuntimeContext['traditional']['discordMobileCharacterEntryPosition']>;
    showDiscordMobileCharacterRail: Source<ShellRuntimeContext['traditional']['showDiscordMobileCharacterRail']>;
    discordMobileCharacterEntryStyle: Source<ShellRuntimeContext['traditional']['discordMobileCharacterEntryStyle']>;
    telegramSelectedCharacterKey: Source<ShellRuntimeContext['traditional']['telegramSelectedCharacterKey']>;
    telegramToolEntries: Source<ShellRuntimeContext['traditional']['telegramToolEntries']>;
    activeTelegramToolId: Source<ShellRuntimeContext['traditional']['activeTelegramToolId']>;
    telegramConversationListMode: Source<ShellRuntimeContext['traditional']['telegramConversationListMode']>;
    telegramDesktopLeftRoute: Source<ShellRuntimeContext['traditional']['telegramDesktopLeftRoute']>;
    telegramMobileActiveTab: Source<ShellRuntimeContext['traditional']['telegramMobileActiveTab']>;
    telegramMobileCurrentRoute: Source<ShellRuntimeContext['traditional']['telegramMobileCurrentRoute']>;
    isTimelineLoadedOnce: Source<ShellRuntimeContext['traditional']['isTimelineLoadedOnce']>;
    isForgeActiveInTraditional: Source<ShellRuntimeContext['traditional']['isForgeActiveInTraditional']>;
    sidebarMode: Source<ShellRuntimeContext['traditional']['sidebarMode']>;
    activeRightPanel: Source<ShellRuntimeContext['traditional']['activeRightPanel']>;
    widgetWidth: Source<ShellRuntimeContext['traditional']['widgetWidth']>;
    isResizing: Source<ShellRuntimeContext['traditional']['isResizing']>;
    telegramLeftRailWidth: Source<ShellRuntimeContext['traditional']['telegramLeftRailWidth']>;
    isTelegramLeftRailResizing: Source<ShellRuntimeContext['traditional']['isTelegramLeftRailResizing']>;
    activeForgeAuxKind: Source<ShellRuntimeContext['traditional']['activeForgeAuxKind']>;
    rawSidebarMode: Source<ShellRuntimeContext['traditional']['rawSidebarMode']>;
    activeWidgetPlugin: Source<ShellRuntimeContext['traditional']['activeWidgetPlugin']>;
    activeRegisteredPanel: Source<ShellRuntimeContext['traditional']['activeRegisteredPanel']>;
    activeRightPanelActivity: Source<ShellRuntimeContext['traditional']['activeRightPanelActivity']>;
    showWidgetDropdown: Source<ShellRuntimeContext['traditional']['showWidgetDropdown']>;
    showNexus: Source<ShellRuntimeContext['traditional']['showNexus']>;
  };
  freeform: {
    showWorkspaceMenu: Source<ShellRuntimeContext['freeform']['showWorkspaceMenu']>;
    isWorkspaceStageStripVisible: Source<ShellRuntimeContext['freeform']['isWorkspaceStageStripVisible']>;
    isWorkspaceNavigationVisible: Source<ShellRuntimeContext['freeform']['isWorkspaceNavigationVisible']>;
    activeWorkspaceWindowId: Source<ShellRuntimeContext['freeform']['activeWorkspaceWindowId']>;
    workspaceSceneInsets: Source<ShellRuntimeContext['freeform']['workspaceSceneInsets']>;
    showWorkspaceLaunchpad: Source<ShellRuntimeContext['freeform']['showWorkspaceLaunchpad']>;
    isWorkspaceDockVisible: Source<ShellRuntimeContext['freeform']['isWorkspaceDockVisible']>;
  };
}

interface ShellRuntimePayloadSurfacesInput {
  dynamicTabs: Source<ShellRuntimeSurfaces['dynamicTabs']>;
  widgetPanelList: Source<ShellRuntimeSurfaces['widgetPanelList']>;
  traditional: {
    mainPlugins: Source<ShellRuntimeSurfaces['traditional']['mainPlugins']>;
    mainSurfaceVariant: Source<ShellRuntimeSurfaces['traditional']['mainSurfaceVariant']>;
    mainSurfaceStyle: Source<ShellRuntimeSurfaces['traditional']['mainSurfaceStyle']>;
    mobileMainStyle: Source<ShellRuntimeSurfaces['traditional']['mobileMainStyle']>;
    widgetSurfaceVariant: Source<ShellRuntimeSurfaces['traditional']['widgetSurfaceVariant']>;
    widgetStyle: Source<ShellRuntimeSurfaces['traditional']['widgetStyle']>;
  };
  freeform: {
    workspaceMenuVariant: Source<ShellRuntimeSurfaces['freeform']['workspaceMenuVariant']>;
    workspaceMenuStyle: Source<ShellRuntimeSurfaces['freeform']['workspaceMenuStyle']>;
    workspaceStageVariant: Source<ShellRuntimeSurfaces['freeform']['workspaceStageVariant']>;
    workspaceStageStyle: Source<ShellRuntimeSurfaces['freeform']['workspaceStageStyle']>;
    stageStripItems: Source<ShellRuntimeSurfaces['freeform']['stageStripItems']>;
    stageWindowEntries: Source<ShellRuntimeSurfaces['freeform']['stageWindowEntries']>;
    dockDisplayItems: Source<ShellRuntimeSurfaces['freeform']['dockDisplayItems']>;
  };
}

interface ShellRuntimePayloadFrameInput {
  panelHeaderVariant: Source<ShellRuntimeFrame['panelHeaderVariant']>;
  traditionalHeaderPosition: Source<ShellRuntimeFrame['traditionalHeaderPosition']>;
  panelBodyStyle: Source<ShellRuntimeFrame['panelBodyStyle']>;
  showSplash: Source<ShellRuntimeFrame['showSplash']>;
  discordChannelMarkVisible: Source<ShellRuntimeFrame['discordChannelMarkVisible']>;
}

export interface UseShellRuntimePayloadInput {
  context: ShellRuntimePayloadContextInput;
  surfaces: ShellRuntimePayloadSurfacesInput;
  actions: ShellRuntimeActions;
  frame: ShellRuntimePayloadFrameInput;
}

export const useShellRuntimePayload = (input: UseShellRuntimePayloadInput) => {
  const shellRuntimeContext = computed<ShellRuntimeContext>(() => ({
    shellKind: read(input.context.shellKind),
    layoutMode: read(input.context.layoutMode),
    activeDesktopModeId: read(input.context.activeDesktopModeId),
    desktopModeOptions: read(input.context.desktopModeOptions),
    activeMainTab: read(input.context.activeMainTab),
    isMobile: read(input.context.isMobile),
    currentDetailedView: read(input.context.currentDetailedView),
    saveStatus: read(input.context.saveStatus),
    widgetGroups: read(input.context.widgetGroups),
    characterChannelState: read(input.context.characterChannelState),
    traditional: {
      shouldShowDiscordGuildRail: read(input.context.traditional.shouldShowDiscordGuildRail),
      discordGuildEntries: read(input.context.traditional.discordGuildEntries),
      shouldShowForgeSidebar: read(input.context.traditional.shouldShowForgeSidebar),
      isForgeSidebarCollapsed: read(input.context.traditional.isForgeSidebarCollapsed),
      shouldShowDiscordCharacterRail: read(input.context.traditional.shouldShowDiscordCharacterRail),
      isDiscordMobileMode: read(input.context.traditional.isDiscordMobileMode),
      isTelegramMobileMode: read(input.context.traditional.isTelegramMobileMode),
      shouldShowDiscordMobileShell: read(input.context.traditional.shouldShowDiscordMobileShell),
      discordMobileGuildRailPosition: read(input.context.traditional.discordMobileGuildRailPosition),
      discordMobileCharacterEntryPosition: read(input.context.traditional.discordMobileCharacterEntryPosition),
      showDiscordMobileCharacterRail: read(input.context.traditional.showDiscordMobileCharacterRail),
      discordMobileCharacterEntryStyle: read(input.context.traditional.discordMobileCharacterEntryStyle),
      telegramSelectedCharacterKey: read(input.context.traditional.telegramSelectedCharacterKey),
      telegramToolEntries: read(input.context.traditional.telegramToolEntries),
      activeTelegramToolId: read(input.context.traditional.activeTelegramToolId),
      telegramConversationListMode: read(input.context.traditional.telegramConversationListMode),
      telegramDesktopLeftRoute: read(input.context.traditional.telegramDesktopLeftRoute),
      telegramMobileActiveTab: read(input.context.traditional.telegramMobileActiveTab),
      telegramMobileCurrentRoute: read(input.context.traditional.telegramMobileCurrentRoute),
      isTimelineLoadedOnce: read(input.context.traditional.isTimelineLoadedOnce),
      isForgeActiveInTraditional: read(input.context.traditional.isForgeActiveInTraditional),
      sidebarMode: read(input.context.traditional.sidebarMode),
      activeRightPanel: read(input.context.traditional.activeRightPanel),
      widgetWidth: read(input.context.traditional.widgetWidth),
      isResizing: read(input.context.traditional.isResizing),
      telegramLeftRailWidth: read(input.context.traditional.telegramLeftRailWidth),
      isTelegramLeftRailResizing: read(input.context.traditional.isTelegramLeftRailResizing),
      activeForgeAuxKind: read(input.context.traditional.activeForgeAuxKind),
      rawSidebarMode: read(input.context.traditional.rawSidebarMode),
      activeWidgetPlugin: read(input.context.traditional.activeWidgetPlugin),
      activeRegisteredPanel: read(input.context.traditional.activeRegisteredPanel),
      activeRightPanelActivity: read(input.context.traditional.activeRightPanelActivity),
      showWidgetDropdown: read(input.context.traditional.showWidgetDropdown),
      showNexus: read(input.context.traditional.showNexus)
    },
    freeform: {
      showWorkspaceMenu: read(input.context.freeform.showWorkspaceMenu),
      isWorkspaceStageStripVisible: read(input.context.freeform.isWorkspaceStageStripVisible),
      isWorkspaceNavigationVisible: read(input.context.freeform.isWorkspaceNavigationVisible),
      activeWorkspaceWindowId: read(input.context.freeform.activeWorkspaceWindowId),
      workspaceSceneInsets: read(input.context.freeform.workspaceSceneInsets),
      showWorkspaceLaunchpad: read(input.context.freeform.showWorkspaceLaunchpad),
      isWorkspaceDockVisible: read(input.context.freeform.isWorkspaceDockVisible)
    }
  }));

  const shellRuntimeSurfaces = computed<ShellRuntimeSurfaces>(() => ({
    dynamicTabs: read(input.surfaces.dynamicTabs),
    widgetPanelList: read(input.surfaces.widgetPanelList),
    traditional: {
      mainPlugins: read(input.surfaces.traditional.mainPlugins),
      mainSurfaceVariant: read(input.surfaces.traditional.mainSurfaceVariant),
      mainSurfaceStyle: read(input.surfaces.traditional.mainSurfaceStyle),
      mobileMainStyle: read(input.surfaces.traditional.mobileMainStyle),
      widgetSurfaceVariant: read(input.surfaces.traditional.widgetSurfaceVariant),
      widgetStyle: read(input.surfaces.traditional.widgetStyle)
    },
    freeform: {
      workspaceMenuVariant: read(input.surfaces.freeform.workspaceMenuVariant),
      workspaceMenuStyle: read(input.surfaces.freeform.workspaceMenuStyle),
      workspaceStageVariant: read(input.surfaces.freeform.workspaceStageVariant),
      workspaceStageStyle: read(input.surfaces.freeform.workspaceStageStyle),
      stageStripItems: read(input.surfaces.freeform.stageStripItems),
      stageWindowEntries: read(input.surfaces.freeform.stageWindowEntries),
      dockDisplayItems: read(input.surfaces.freeform.dockDisplayItems)
    }
  }));

  const shellRuntimeActions = computed<ShellRuntimeActions>(() => input.actions);

  const shellRuntimeFrame = computed<ShellRuntimeFrame>(() => ({
    panelHeaderVariant: read(input.frame.panelHeaderVariant),
    traditionalHeaderPosition: read(input.frame.traditionalHeaderPosition),
    panelBodyStyle: read(input.frame.panelBodyStyle),
    showSplash: read(input.frame.showSplash),
    discordChannelMarkVisible: read(input.frame.discordChannelMarkVisible)
  }));

  return {
    shellRuntimeContext,
    shellRuntimeSurfaces,
    shellRuntimeActions,
    shellRuntimeFrame
  };
};
