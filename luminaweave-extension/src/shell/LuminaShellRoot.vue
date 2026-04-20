<template>
  <PanelHeader
    v-if="layoutMode === 'traditional' && traditionalHeaderPosition === 'top'"
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

    <TraditionalShell
      v-else-if="layoutMode === 'traditional'"
      :shouldShowDiscordGuildRail="shouldShowDiscordGuildRail"
      :discordGuildEntries="discordGuildEntries"
      :activeMainTab="activeMainTab"
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
      :dynamicTabs="dynamicTabs"
      :tabComponentRegistry="tabComponentRegistry"
      :shellMainSurfaceVariant="shellMainSurfaceVariant"
      :shellMainSurfaceStyle="shellMainSurfaceStyle"
      :discordMobileMainStyle="discordMobileMainStyle"
      :isTimelineLoadedOnce="isTimelineLoadedOnce"
      :isForgeActiveInTraditional="isForgeActiveInTraditional"
      :sidebarMode="sidebarMode"
      :activeRightPanel="activeRightPanel"
      :isMobile="isMobile"
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
      :widgetGroups="widgetGroups"
      :showWidgetDropdown="showWidgetDropdown"
      :showNexus="showNexus"
      :getPluginName="getPluginName"
      :onSwitchMainView="onSwitchMainView"
      :onToggleSettings="onOpenSettingsPanel"
      :onClose="onClose"
      :onToggleForgeSidebarCollapse="onToggleForgeSidebarCollapse"
      :onSetSidebarMode="onSetSidebarMode"
      :onOpenDiscordChatSession="onOpenDiscordChatSession"
      :onOpenDiscordMobileChatSession="onOpenDiscordMobileChatSession"
      :onCreateDiscordChatSession="onCreateDiscordChatSession"
      :onCreateDiscordMobileChatSession="onCreateDiscordMobileChatSession"
      :onRenameDiscordChatSession="onRenameDiscordChatSession"
      :onDeleteDiscordChatSession="onDeleteDiscordChatSession"
      :onToggleDiscordCharacterGroup="onToggleDiscordCharacterGroup"
      :onToggleDiscordCharacterSessionExpansion="onToggleDiscordCharacterSessionExpansion"
      :onHandleDiscordMobileMainViewSwitch="onHandleDiscordMobileMainViewSwitch"
      :onUpdateShowDiscordMobileCharacterRail="onUpdateShowDiscordMobileCharacterRail"
      :onResizeStart="onResizeStart"
      :onBackFromDetailedSettings="onBackFromDetailedSettings"
      :onToggleWidgetDropdown="onToggleWidgetDropdown"
      :onSwitchRightPanel="onSwitchRightPanel"
      :onRestoreSidebarLeft="onRestoreSidebarLeft"
      :onClosePanel="onClosePanel"
      :onUpdateShowNexus="onUpdateShowNexus"
    />

    <FreeformShell
      v-else
      :activeDesktopModeId="activeDesktopModeId"
      :desktopModeOptions="desktopModeOptions"
      :showWorkspaceMenu="showWorkspaceMenu"
      :shellWorkspaceMenuVariant="shellWorkspaceMenuVariant"
      :shellWorkspaceMenuStyle="shellWorkspaceMenuStyle"
      :shellWorkspaceStageVariant="shellWorkspaceStageVariant"
      :shellWorkspaceStageStyle="shellWorkspaceStageStyle"
      :isWorkspaceStageStripVisible="isWorkspaceStageStripVisible"
      :workspaceStageStripItems="workspaceStageStripItems"
      :isMobile="isMobile"
      :isWorkspaceNavigationVisible="isWorkspaceNavigationVisible"
      :activeStageWindowEntries="activeStageWindowEntries"
      :activeWorkspaceWindowId="activeWorkspaceWindowId"
      :workspaceSceneInsets="workspaceSceneInsets"
      :currentDetailedView="currentDetailedView"
      :showWorkspaceLaunchpad="showWorkspaceLaunchpad"
      :activeMainTab="activeMainTab"
      :isWorkspaceDockVisible="isWorkspaceDockVisible"
      :workspaceDockDisplayItems="workspaceDockDisplayItems"
      :onSetDesktopMode="onUpdateDesktopMode"
      :onCreateStageWithLauncher="onCreateStageWithLauncher"
      :onOpenWorkspaceSettings="onOpenWorkspaceSettings"
      :onActivateWorkspaceStageWithNavigation="onActivateWorkspaceStageWithNavigation"
      :onCreateWorkspaceStageFromStrip="onCreateWorkspaceStageFromStrip"
      :onHoldWorkspaceNavigation="onHoldWorkspaceNavigation"
      :onScheduleWorkspaceNavigationHide="onScheduleWorkspaceNavigationHide"
      :onToggleWorkspaceNavigation="onToggleWorkspaceNavigation"
      :onToggleWorkspaceMenu="onToggleWorkspaceMenu"
      :onClose="onClose"
      :onHandleFreeformScenePointerDown="onHandleFreeformScenePointerDown"
      :onUpdateWorkspaceLayout="onUpdateWorkspaceLayout"
      :onCloseWorkspaceWindow="onCloseWorkspaceWindow"
      :onFocusWorkspaceWindow="onFocusWorkspaceWindow"
      :onFocusAdjacentWorkspaceWindow="onFocusAdjacentWorkspaceWindow"
      :onBackFromDetailedSettings="onBackFromDetailedSettings"
      :onCloseWorkspaceLaunchpad="onCloseWorkspaceLaunchpad"
      :onHandleWorkspaceDockOpenWithNavigation="onHandleWorkspaceDockOpenWithNavigation"
      :onStageElementChange="onStageElementChange"
    />
  </div>

  <PanelHeader
    v-if="layoutMode === 'traditional' && traditionalHeaderPosition === 'bottom'"
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

  <ConflictDiffViewer ref="globalConflictViewer" />
  <SyncReportViewer ref="globalSyncReportViewer" />
</template>

<script setup lang="ts">
import { ref, watch, type Component, type CSSProperties } from 'vue';
import PanelHeader from '../components/PanelHeader.vue';
import ConflictDiffViewer from '../plugins/chat/ConflictDiffViewer.vue';
import SyncReportViewer from '../plugins/chat/SyncReportViewer.vue';
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
  WorkspaceDockItem,
  WorkspaceSceneInsets,
  WorkspaceStageStripItem,
  WorkspaceWindowEntry
} from './types';
import FreeformShell from './freeform/FreeformShell.vue';
import TraditionalShell from './traditional/TraditionalShell.vue';

const globalConflictViewer = ref<InstanceType<typeof ConflictDiffViewer> | null>(null);
const globalSyncReportViewer = ref<InstanceType<typeof SyncReportViewer> | null>(null);
const panelBodyElement = ref<HTMLElement | null>(null);

const props = defineProps<{
  layoutMode: 'traditional' | 'freeform';
  panelHeaderVariant: 'default' | 'discord';
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
  shouldShowDiscordMobileShell: boolean;
  discordMobileGuildRailPosition: 'top' | 'bottom' | 'left' | 'right';
  discordMobileCharacterEntryPosition: 'top' | 'bottom' | 'left' | 'right';
  showDiscordMobileCharacterRail: boolean;
  discordMobileCharacterEntryStyle: CSSProperties;
  mainPlugins: LuminaPlugin[];
  tabComponentRegistry: Record<string, Component>;
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
  onResizeStart: () => void;
  onBackFromDetailedSettings: () => void;
  onToggleWidgetDropdown: () => void;
  onSwitchRightPanel: (panelId: string) => void;
  onRestoreSidebarLeft: () => void;
  onClosePanel: () => void;
  onUpdateShowNexus: (value: boolean) => void;
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

const openConflictViewer = () => {
  globalConflictViewer.value?.open();
};

const openSyncReportViewer = () => {
  globalSyncReportViewer.value?.open();
};

defineExpose({
  openConflictViewer,
  openSyncReportViewer
});

watch(panelBodyElement, (element) => {
  props.onPanelBodyElementChange(element);
}, { immediate: true });
</script>
