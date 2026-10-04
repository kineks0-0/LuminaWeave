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
  activeDesktopModeId: Source<ShellRuntimeContext['activeDesktopModeId']>;
  desktopModeOptions: Source<ShellRuntimeContext['desktopModeOptions']>;
  activeMainTab: Source<ShellRuntimeContext['activeMainTab']>;
  isMobile: Source<ShellRuntimeContext['isMobile']>;
  viewportWidthPx: Source<ShellRuntimeContext['viewportWidthPx']>;
  saveStatus: Source<ShellRuntimeContext['saveStatus']>;
  widgetGroups: Source<ShellRuntimeContext['widgetGroups']>;
  characterChannelState: Source<ShellRuntimeContext['characterChannelState']>;
  traditional: {
    isTimelineLoadedOnce: Source<ShellRuntimeContext['traditional']['isTimelineLoadedOnce']>;
    sidebarMode: Source<ShellRuntimeContext['traditional']['sidebarMode']>;
    activeRightPanel: Source<ShellRuntimeContext['traditional']['activeRightPanel']>;
    widgetWidth: Source<ShellRuntimeContext['traditional']['widgetWidth']>;
    isResizing: Source<ShellRuntimeContext['traditional']['isResizing']>;
    activeWidgetPlugin: Source<ShellRuntimeContext['traditional']['activeWidgetPlugin']>;
    activeRegisteredPanel: Source<ShellRuntimeContext['traditional']['activeRegisteredPanel']>;
    activeRightPanelActivity: Source<ShellRuntimeContext['traditional']['activeRightPanelActivity']>;
    showWidgetDropdown: Source<ShellRuntimeContext['traditional']['showWidgetDropdown']>;
  };
  freeform: {
    showWorkspaceMenu: Source<ShellRuntimeContext['freeform']['showWorkspaceMenu']>;
    isWorkspaceStageStripVisible: Source<ShellRuntimeContext['freeform']['isWorkspaceStageStripVisible']>;
    isWorkspaceNavigationVisible: Source<ShellRuntimeContext['freeform']['isWorkspaceNavigationVisible']>;
    activeWorkspaceWindowId: Source<ShellRuntimeContext['freeform']['activeWorkspaceWindowId']>;
    workspaceSceneInsets: Source<ShellRuntimeContext['freeform']['workspaceSceneInsets']>;
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
  headerRailVisible: Source<ShellRuntimeFrame['headerRailVisible']>;
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
    activeDesktopModeId: read(input.context.activeDesktopModeId),
    desktopModeOptions: read(input.context.desktopModeOptions),
    activeMainTab: read(input.context.activeMainTab),
    isMobile: read(input.context.isMobile),
    viewportWidthPx: read(input.context.viewportWidthPx),
    saveStatus: read(input.context.saveStatus),
    widgetGroups: read(input.context.widgetGroups),
    characterChannelState: read(input.context.characterChannelState),
    traditional: {
      isTimelineLoadedOnce: read(input.context.traditional.isTimelineLoadedOnce),
      sidebarMode: read(input.context.traditional.sidebarMode),
      activeRightPanel: read(input.context.traditional.activeRightPanel),
      widgetWidth: read(input.context.traditional.widgetWidth),
      isResizing: read(input.context.traditional.isResizing),
      activeWidgetPlugin: read(input.context.traditional.activeWidgetPlugin),
      activeRegisteredPanel: read(input.context.traditional.activeRegisteredPanel),
      activeRightPanelActivity: read(input.context.traditional.activeRightPanelActivity),
      showWidgetDropdown: read(input.context.traditional.showWidgetDropdown)
    },
    freeform: {
      showWorkspaceMenu: read(input.context.freeform.showWorkspaceMenu),
      isWorkspaceStageStripVisible: read(input.context.freeform.isWorkspaceStageStripVisible),
      isWorkspaceNavigationVisible: read(input.context.freeform.isWorkspaceNavigationVisible),
      activeWorkspaceWindowId: read(input.context.freeform.activeWorkspaceWindowId),
      workspaceSceneInsets: read(input.context.freeform.workspaceSceneInsets),
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
    headerRailVisible: read(input.frame.headerRailVisible)
  }));

  return {
    shellRuntimeContext,
    shellRuntimeSurfaces,
    shellRuntimeActions,
    shellRuntimeFrame
  };
};
