<template>
  <div
    class="lw-traditional-shell"
    :class="{ 'is-telegram-desktop': isTelegramDesktopMode }"
    :data-desktop-mode="activeDesktopModeId"
    :style="isTelegramMode ? telegramFrameStyle : undefined"
  >
    <DiscordGuildRail
      v-if="shouldShowDiscordGuildRail"
      :items="discordGuildEntries"
      :activeMainTab="activeMainTab"
      @switchMainView="onSwitchMainView"
      @toggleSettings="onToggleSettings"
      @close="onClose"
    />

    <ForgeSidebar
      v-if="shouldShowForgeSidebar"
      :isCollapsed="isForgeSidebarCollapsed"
      @toggleCollapse="onToggleForgeSidebarCollapse"
      @switchMode="onSetSidebarMode"
    />

    <div
      v-if="isTelegramDesktopMode && shouldShowDiscordCharacterRail"
      class="lw-telegram-left-pane"
      :style="telegramLeftRailStyle"
    >
      <div class="lw-telegram-left-stack">
        <nav class="lw-telegram-left-stack__tabs" aria-label="Telegram left pane pages">
          <button
            type="button"
            :class="{ active: telegramDesktopLeftRoute === 'conversationList' }"
            @click="onSetTelegramDesktopLeftRoute('conversationList')"
          >
            会话
          </button>
          <button
            type="button"
            :class="{ active: telegramDesktopLeftRoute === 'roleList' }"
            @click="onSetTelegramDesktopLeftRoute('roleList')"
          >
            角色
          </button>
        </nav>
        <DiscordCharacterRail
          v-if="telegramDesktopLeftRoute === 'conversationList'"
          :state="characterChannelState"
          :onRenameSession="onRenameDiscordChatSession"
          :onDeleteSession="onDeleteDiscordChatSession"
          :onOpenSession="onOpenDiscordChatSession"
          :onCreateSession="onCreateDiscordChatSession"
          :selectedCharacterKey="telegramSelectedCharacterKey"
          :telegramToolEntries="telegramToolEntries"
          :activeTelegramToolId="activeTelegramToolId"
          :telegramListMode="telegramConversationListMode"
          :onTelegramListModeChange="onSetTelegramConversationListMode"
          :onOpenTelegramToolEntry="onOpenTelegramToolEntry"
          :onSelectCharacterOverview="onSelectTelegramCharacterOverview"
          :onToggleGroup="onToggleDiscordCharacterGroup"
          :onToggleSessionExpansion="onToggleDiscordCharacterSessionExpansion"
        />
        <TelegramRoleListPage
          v-else
          :state="characterChannelState"
          @selectRole="onSelectTelegramCharacterOverview"
        />
      </div>
      <div
        class="lw-telegram-left-resizer"
        :class="{ 'is-resizing': isTelegramLeftRailResizing }"
        role="separator"
        aria-orientation="vertical"
        title="调整左侧列表宽度"
        @mousedown.stop.prevent="onTelegramLeftRailResizeStart"
      ></div>
    </div>

    <DiscordCharacterRail
      v-else-if="shouldShowDiscordCharacterRail"
      :state="characterChannelState"
      :onRenameSession="onRenameDiscordChatSession"
      :onDeleteSession="onDeleteDiscordChatSession"
      :onOpenSession="onOpenDiscordChatSession"
      :onCreateSession="onCreateDiscordChatSession"
      :selectedCharacterKey="telegramSelectedCharacterKey"
      :telegramListMode="telegramConversationListMode"
      :onTelegramListModeChange="onSetTelegramConversationListMode"
      :onSelectCharacterOverview="onSelectTelegramCharacterOverview"
      :onToggleGroup="onToggleDiscordCharacterGroup"
      :onToggleSessionExpansion="onToggleDiscordCharacterSessionExpansion"
    />

    <DiscordMobileShell
      :isDiscordMobileMode="isDiscordMobileMode"
      :shouldShowDiscordMobileShell="shouldShowDiscordMobileShell"
      :discordGuildEntries="discordGuildEntries"
      :activeMainTab="activeMainTab"
      :guildRailPosition="discordMobileGuildRailPosition"
      :characterEntryPosition="discordMobileCharacterEntryPosition"
      :showDiscordMobileCharacterRail="showDiscordMobileCharacterRail"
      :characterEntryStyle="discordMobileCharacterEntryStyle"
      :characterChannelState="characterChannelState"
      :onRenameMobileSession="onRenameDiscordChatSession"
      :onDeleteMobileSession="onDeleteDiscordChatSession"
      :onToggleMobileGroup="onToggleDiscordCharacterGroup"
      :onToggleMobileSessionExpansion="onToggleDiscordCharacterSessionExpansion"
      @switchMainView="onHandleDiscordMobileMainViewSwitch"
      @toggleSettings="onToggleSettings"
      @close="onClose"
      @openMobileSession="onOpenDiscordMobileChatSession"
      @createMobileSession="onCreateDiscordMobileChatSession"
      @updateShowDiscordMobileCharacterRail="onUpdateShowDiscordMobileCharacterRail"
    />

    <template v-if="isTelegramMobileMode">
      <div
        class="lw-main-wrapper lw-telegram-mobile-stack"
        :class="{ 'has-telegram-mobile-nav': shouldShowTelegramMobileBottomNav }"
        :data-surface-variant="shellMainSurfaceVariant"
        :style="[shellMainSurfaceStyle, discordMobileMainStyle]"
      >
        <header v-if="shouldShowTelegramMobileStackBar" class="lw-telegram-mobile-stack__bar">
          <button type="button" title="返回" @click="onPopTelegramMobileRoute">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.4" fill="none">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <strong>{{ telegramMobileRouteTitle }}</strong>
        </header>

        <DiscordCharacterRail
          v-if="telegramMobileCurrentRoute.name === 'conversationList'"
          :state="characterChannelState"
          :isMobile="true"
          :mobilePlacement="'bottom'"
          :onRenameSession="onRenameDiscordChatSession"
          :onDeleteSession="onDeleteDiscordChatSession"
          :onOpenSession="onOpenTelegramMobileSession"
          :onCreateSession="onCreateTelegramMobileSession"
          :selectedCharacterKey="telegramSelectedCharacterKey"
          :telegramToolEntries="telegramToolEntries"
          :activeTelegramToolId="activeTelegramToolId"
          :telegramListMode="telegramConversationListMode"
          :onTelegramListModeChange="onSetTelegramConversationListMode"
          :onOpenTelegramToolEntry="onOpenTelegramMobileToolEntry"
          :onSelectCharacterOverview="onOpenTelegramMobileCharacterOverview"
          :onToggleGroup="onToggleDiscordCharacterGroup"
          :onToggleSessionExpansion="onToggleDiscordCharacterSessionExpansion"
        />
        <TelegramRoleListPage
          v-else-if="telegramMobileCurrentRoute.name === 'roleList'"
          :state="characterChannelState"
          @selectRole="onOpenTelegramMobileCharacterOverview"
        />
        <TelegramCharacterOverview
          v-else-if="telegramMobileCurrentRoute.name === 'characterOverview'"
          :state="characterChannelState"
          :selectedCharacterKey="telegramMobileCurrentRoute.groupKey || telegramSelectedCharacterKey"
          :isMobile="true"
          @openSession="onOpenTelegramMobileSession"
          @createSession="onCreateTelegramMobileSession"
          @openTool="onOpenTelegramMobilePanel"
        />
        <SurfaceOutlet
          v-else-if="telegramMobileCurrentRoute.name === 'roleProfile'"
          contract-id="telegram.infoPanel"
          :state="characterChannelState"
          :mode="'large'"
          :isMobile="true"
          @openSession="onOpenTelegramMobileSession"
          @createSession="onCreateTelegramMobileSession"
          @openTool="onHandleTelegramMobileRoleProfileTool"
        />
        <SurfaceOutlet
          v-else-if="telegramMobileCurrentRoute.name === 'chat'"
          contract-id="chat.main"
          :mode="'large'"
          :isMobile="true"
          :onTelegramBack="onPopTelegramMobileRoute"
          :onTelegramOpenRoleProfile="onOpenTelegramMobileRoleProfile"
        />
        <SurfaceOutlet
          v-else-if="telegramMobileCurrentRoute.name === 'settings'"
          contract-id="settings.root"
          :mode="'small'"
          :isMobile="true"
        />
        <TelegramUserProfilePage
          v-else-if="telegramMobileCurrentRoute.name === 'profile'"
          :desktopModes="desktopModeOptions"
          :activeDesktopModeId="activeDesktopModeId"
          :widgetGroups="widgetGroups"
          @setDesktopMode="onUpdateDesktopMode"
          @openSettings="onSelectTelegramBottomNav('settings')"
          @openPanel="onOpenTelegramMobilePanel"
          @close="onClose"
        />
        <SurfaceOutlet
          v-else-if="telegramMobileCurrentRoute.name === 'tool'"
          :contract-id="telegramMobileToolContractId"
          :mode="'large'"
          :isMobile="true"
          :auxSidebarMode="telegramMobileToolAuxSidebarMode"
        />
      </div>
    </template>

    <template v-else>
      <template v-for="plugin in mainPlugins" :key="plugin.id">
        <div
          v-show="activeMainTab === plugin.id"
          class="lw-main-wrapper"
          :class="{
            'lw-main-timeline-wrapper': plugin.id === 'lumina-timeline',
            'has-discord-mobile-shell': isDiscordMobileMode,
            'has-telegram-mobile-nav': isTelegramMobileMode
          }"
          :data-surface-variant="shellMainSurfaceVariant"
          :style="[shellMainSurfaceStyle, discordMobileMainStyle]"
        >
          <TelegramCharacterOverview
            v-if="isTelegramCharacterOverviewVisible(plugin.id)"
            :state="characterChannelState"
            :selectedCharacterKey="telegramSelectedCharacterKey"
            :isMobile="isMobile"
            @openSession="onOpenDiscordChatSession"
            @createSession="onCreateDiscordChatSession"
            @openTool="onSwitchRightPanel"
          />
          <template v-else>
            <SurfaceOutlet
              v-if="plugin.id !== 'lumina-timeline' || activeMainTab === 'lumina-timeline' || isTimelineLoadedOnce"
              :contract-id="getPrimarySurfaceContractIdForPlugin(plugin.id)"
              :mode="'large'"
              :isMobile="isMobile"
              :auxSidebarMode="effectiveForgeAuxSidebarMode"
              :activeRightPanelId="isForgeActiveInTraditional ? activeRightPanel : undefined"
            />
          </template>
        </div>
      </template>
    </template>

    <template v-if="!isTelegramMobileMode" v-for="tab in dynamicTabs" :key="tab.id">
      <div
        v-show="activeMainTab === tab.id"
        class="lw-main-wrapper"
        :class="{ 'has-discord-mobile-shell': isDiscordMobileMode, 'has-telegram-mobile-nav': isTelegramMobileMode }"
        :data-surface-variant="shellMainSurfaceVariant"
        :style="[shellMainSurfaceStyle, discordMobileMainStyle]"
      >
        <DynamicTabOutlet
          :tab="tab"
          :auxSidebarMode="effectiveForgeAuxSidebarMode"
          :activeRightPanelId="isForgeActiveInTraditional ? activeRightPanel : undefined"
        />
      </div>
    </template>

    <WidgetPanelHost
      :activeRightPanel="activeRightPanel"
      :isMobile="isMobile"
      :characterChannelState="characterChannelState"
      :surfaceVariant="shellWidgetSurfaceVariant"
      :widgetStyle="shellWidgetStyle"
      :widgetWidth="widgetWidth"
      :isResizing="isResizing"
      :currentDetailedView="currentDetailedView"
      :saveStatus="saveStatus"
      :activeForgeAuxKind="activeForgeAuxKind"
      :isForgeActiveInTraditional="isForgeActiveInTraditional"
      :rawSidebarMode="rawSidebarMode"
      :activeWidgetPlugin="activeWidgetPlugin"
      :activeRegisteredPanel="activeRegisteredPanel"
      :widgetGroups="widgetGroups"
      :showWidgetDropdown="showWidgetDropdown"
      :getPluginName="getPluginName"
      :onCreateChatSession="onCreateDiscordChatSession"
      :onOpenSession="onOpenDiscordChatSession"
      @resizeStart="onResizeStart"
      @backFromDetailedSettings="onBackFromDetailedSettings"
      @toggleWidgetDropdown="onToggleWidgetDropdown"
      @switchRightPanel="onSwitchRightPanel"
      @restoreSidebarLeft="onRestoreSidebarLeft"
      @closePanel="onClosePanel"
    />

    <TelegramBottomNav
      v-if="shouldShowTelegramMobileBottomNav"
      :activeMainTab="activeMainTab"
      :characterSheetOpen="telegramMobileActiveTab === 'roles'"
      :settingsPanelOpen="telegramMobileActiveTab === 'settings'"
      :profilePanelOpen="telegramMobileActiveTab === 'profile'"
      @select="onSelectTelegramBottomNav"
    />
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import { computed } from 'vue';
import { useComponentSkin } from '../../theme/useComponentSkin.js';
import DiscordCharacterRail from '../../components/DiscordCharacterRail.vue';
import DiscordGuildRail from '../../components/DiscordGuildRail.vue';
import ForgeSidebar from '../../components/ForgeSidebar.vue';
import type { ShellRuntimeActions, ShellRuntimeContext, ShellRuntimeSurfaces, TelegramRailToolEntry } from '../types.js';
import DiscordMobileShell from './DiscordMobileShell.vue';
import TelegramBottomNav from './TelegramBottomNav.vue';
import TelegramCharacterOverview from './TelegramCharacterOverview.vue';
import TelegramRoleListPage from './TelegramRoleListPage.vue';
import TelegramUserProfilePage from './TelegramUserProfilePage.vue';
import WidgetPanelHost from './WidgetPanelHost.vue';
import SurfaceOutlet from '../../platform/surface/SurfaceOutlet.vue';
import { getPrimarySurfaceContractIdForPlugin } from '../../platform/plugin/officialPluginSurfaces.js';
import { getSurfaceContractIdForRegisteredPanel } from '../../platform/plugin/officialPanelSurfaces.js';
import DynamicTabOutlet from '../DynamicTabOutlet.vue';

const props = defineProps<{
  runtimeContext: ShellRuntimeContext;
  runtimeSurfaces: ShellRuntimeSurfaces;
  runtimeActions: ShellRuntimeActions;
}>();

const activeDesktopModeId = computed(() => props.runtimeContext.activeDesktopModeId);
const desktopModeOptions = computed(() => props.runtimeContext.desktopModeOptions);
const activeMainTab = computed(() => props.runtimeContext.activeMainTab);
const dynamicTabs = computed(() => props.runtimeSurfaces.dynamicTabs);
const isMobile = computed(() => props.runtimeContext.isMobile);
const currentDetailedView = computed(() => props.runtimeContext.currentDetailedView);
const saveStatus = computed(() => props.runtimeContext.saveStatus);
const widgetGroups = computed(() => props.runtimeContext.widgetGroups);
const characterChannelState = computed(() => props.runtimeContext.characterChannelState);
const shouldShowDiscordGuildRail = computed(() => props.runtimeContext.traditional.shouldShowDiscordGuildRail);
const discordGuildEntries = computed(() => props.runtimeContext.traditional.discordGuildEntries);
const shouldShowForgeSidebar = computed(() => props.runtimeContext.traditional.shouldShowForgeSidebar);
const isForgeSidebarCollapsed = computed(() => props.runtimeContext.traditional.isForgeSidebarCollapsed);
const shouldShowDiscordCharacterRail = computed(() => props.runtimeContext.traditional.shouldShowDiscordCharacterRail);
const isDiscordMobileMode = computed(() => props.runtimeContext.traditional.isDiscordMobileMode);
const isTelegramMobileMode = computed(() => props.runtimeContext.traditional.isTelegramMobileMode);
const shouldShowDiscordMobileShell = computed(() => props.runtimeContext.traditional.shouldShowDiscordMobileShell);
const discordMobileGuildRailPosition = computed(() => props.runtimeContext.traditional.discordMobileGuildRailPosition);
const discordMobileCharacterEntryPosition = computed(() => props.runtimeContext.traditional.discordMobileCharacterEntryPosition);
const showDiscordMobileCharacterRail = computed(() => props.runtimeContext.traditional.showDiscordMobileCharacterRail);
const discordMobileCharacterEntryStyle = computed(() => props.runtimeContext.traditional.discordMobileCharacterEntryStyle);
const telegramSelectedCharacterKey = computed(() => props.runtimeContext.traditional.telegramSelectedCharacterKey);
const telegramToolEntries = computed(() => props.runtimeContext.traditional.telegramToolEntries);
const activeTelegramToolId = computed(() => props.runtimeContext.traditional.activeTelegramToolId);
const telegramConversationListMode = computed(() => props.runtimeContext.traditional.telegramConversationListMode);
const telegramDesktopLeftRoute = computed(() => props.runtimeContext.traditional.telegramDesktopLeftRoute);
const telegramMobileActiveTab = computed(() => props.runtimeContext.traditional.telegramMobileActiveTab);
const telegramMobileCurrentRoute = computed(() => props.runtimeContext.traditional.telegramMobileCurrentRoute);
const mainPlugins = computed(() => props.runtimeSurfaces.traditional.mainPlugins);
const shellMainSurfaceVariant = computed(() => props.runtimeSurfaces.traditional.mainSurfaceVariant);
const shellMainSurfaceStyle = computed(() => props.runtimeSurfaces.traditional.mainSurfaceStyle);
const discordMobileMainStyle = computed(() => props.runtimeSurfaces.traditional.mobileMainStyle);
const isTimelineLoadedOnce = computed(() => props.runtimeContext.traditional.isTimelineLoadedOnce);
const isForgeActiveInTraditional = computed(() => props.runtimeContext.traditional.isForgeActiveInTraditional);
const sidebarMode = computed(() => props.runtimeContext.traditional.sidebarMode);
const activeRightPanel = computed(() => props.runtimeContext.traditional.activeRightPanel);
const shellWidgetSurfaceVariant = computed(() => props.runtimeSurfaces.traditional.widgetSurfaceVariant);
const shellWidgetStyle = computed(() => props.runtimeSurfaces.traditional.widgetStyle);
const widgetWidth = computed(() => props.runtimeContext.traditional.widgetWidth);
const isResizing = computed(() => props.runtimeContext.traditional.isResizing);
const telegramLeftRailWidth = computed(() => props.runtimeContext.traditional.telegramLeftRailWidth);
const isTelegramLeftRailResizing = computed(() => props.runtimeContext.traditional.isTelegramLeftRailResizing);
const activeForgeAuxKind = computed(() => props.runtimeContext.traditional.activeForgeAuxKind);
const rawSidebarMode = computed(() => props.runtimeContext.traditional.rawSidebarMode);
const activeWidgetPlugin = computed(() => props.runtimeContext.traditional.activeWidgetPlugin);
const activeRegisteredPanel = computed(() => props.runtimeContext.traditional.activeRegisteredPanel);
const showWidgetDropdown = computed(() => props.runtimeContext.traditional.showWidgetDropdown);
const showNexus = computed(() => props.runtimeContext.traditional.showNexus);
const effectiveForgeAuxSidebarMode = computed(() => {
  if (!isForgeActiveInTraditional.value) return undefined;
  return isMobile.value ? 'hidden' : sidebarMode.value;
});

const getPluginName = (pluginId: string | null) => props.runtimeActions.getPluginName(pluginId);
const onSwitchMainView = (tabId: string) => props.runtimeActions.navigation.switchMainView(tabId);
const onToggleSettings = () => props.runtimeActions.navigation.openSettingsPanel();
const onClose = () => props.runtimeActions.navigation.close();
const onToggleForgeSidebarCollapse = () => props.runtimeActions.traditional.toggleForgeSidebarCollapse();
const onSetSidebarMode = (mode: 'left' | 'right' | 'widget') => props.runtimeActions.traditional.setSidebarMode(mode);
const onOpenDiscordChatSession = (sessionId: string) => props.runtimeActions.traditional.openDiscordChatSession(sessionId);
const onOpenDiscordMobileChatSession = (sessionId: string) =>
  props.runtimeActions.traditional.openDiscordMobileChatSession(sessionId);
const onCreateDiscordChatSession: ShellRuntimeActions['traditional']['createDiscordChatSession'] = (payload) =>
  props.runtimeActions.traditional.createDiscordChatSession(payload);
const onCreateDiscordMobileChatSession: ShellRuntimeActions['traditional']['createDiscordMobileChatSession'] = (payload) =>
  props.runtimeActions.traditional.createDiscordMobileChatSession(payload);
const onRenameDiscordChatSession: ShellRuntimeActions['traditional']['renameDiscordChatSession'] = (payload) =>
  props.runtimeActions.traditional.renameDiscordChatSession(payload);
const onDeleteDiscordChatSession: ShellRuntimeActions['traditional']['deleteDiscordChatSession'] = (payload) =>
  props.runtimeActions.traditional.deleteDiscordChatSession(payload);
const onToggleDiscordCharacterGroup = (groupKey: string) =>
  props.runtimeActions.traditional.toggleDiscordCharacterGroup(groupKey);
const onToggleDiscordCharacterSessionExpansion = (groupKey: string) =>
  props.runtimeActions.traditional.toggleDiscordCharacterSessionExpansion(groupKey);
const onHandleDiscordMobileMainViewSwitch = (tabId: string) =>
  props.runtimeActions.traditional.handleDiscordMobileMainViewSwitch(tabId);
const onUpdateShowDiscordMobileCharacterRail = (value: boolean) =>
  props.runtimeActions.traditional.updateShowDiscordMobileCharacterRail(value);
const onSelectTelegramCharacterOverview = (groupKey: string | null) =>
  props.runtimeActions.traditional.selectTelegramCharacterOverview(groupKey);
const onOpenTelegramToolEntry = (toolId: TelegramRailToolEntry['id']) =>
  props.runtimeActions.traditional.openTelegramToolEntry(toolId);
const onSetTelegramConversationListMode: ShellRuntimeActions['traditional']['setTelegramConversationListMode'] = (mode) =>
  props.runtimeActions.traditional.setTelegramConversationListMode(mode);
const onSetTelegramDesktopLeftRoute: ShellRuntimeActions['traditional']['setTelegramDesktopLeftRoute'] = (route) =>
  props.runtimeActions.traditional.setTelegramDesktopLeftRoute(route);
const onPushTelegramMobileRoute: ShellRuntimeActions['traditional']['pushTelegramMobileRoute'] = (route) =>
  props.runtimeActions.traditional.pushTelegramMobileRoute(route);
const onPopTelegramMobileRoute = () => props.runtimeActions.traditional.popTelegramMobileRoute();
const onResizeStart = (event?: MouseEvent) => props.runtimeActions.traditional.resizeStart(event);
const onTelegramLeftRailResizeStart = (event?: MouseEvent) => props.runtimeActions.traditional.telegramLeftRailResizeStart(event);
const onBackFromDetailedSettings = () => props.runtimeActions.traditional.backFromDetailedSettings();
const onToggleWidgetDropdown = () => props.runtimeActions.traditional.toggleWidgetDropdown();
const onSwitchRightPanel = (panelId: string) => props.runtimeActions.traditional.switchRightPanel(panelId);
const onRestoreSidebarLeft = () => props.runtimeActions.traditional.restoreSidebarLeft();
const onClosePanel = () => props.runtimeActions.traditional.closePanel();
const onUpdateShowNexus = (value: boolean) => props.runtimeActions.traditional.updateShowNexus(value);
const onSelectTelegramBottomNav: ShellRuntimeActions['traditional']['selectTelegramBottomNav'] = (itemId) =>
  props.runtimeActions.traditional.selectTelegramBottomNav(itemId);
const onUpdateDesktopMode = (desktopModeId: string) => props.runtimeActions.navigation.updateDesktopMode(desktopModeId);

const isTelegramMode = computed(() => props.runtimeContext.activeDesktopModeId === 'telegram');
const isTelegramDesktopMode = computed(() => (
  isTelegramMode.value && !props.runtimeContext.isMobile
));
const isTelegramCharacterOverviewVisible = (pluginId: string) => (
  props.runtimeContext.activeDesktopModeId === 'telegram'
  && pluginId === 'lumina-chat'
  && Boolean(telegramSelectedCharacterKey.value)
);
const isTelegramMobileRootRoute = computed(() => (
  ['conversationList', 'roleList', 'settings', 'profile'].includes(telegramMobileCurrentRoute.value.name)
));
const canPopTelegramMobileRoute = computed(() => (
  !isTelegramMobileRootRoute.value
));
const shouldShowTelegramMobileBottomNav = computed(() => (
  isTelegramMobileMode.value && isTelegramMobileRootRoute.value
));
const shouldShowTelegramMobileStackBar = computed(() => (
  canPopTelegramMobileRoute.value
  && !['chat', 'roleProfile'].includes(telegramMobileCurrentRoute.value.name)
));
const telegramMobileRouteTitle = computed(() => {
  if (telegramMobileCurrentRoute.value.name === 'characterOverview') return '角色概览';
  if (telegramMobileCurrentRoute.value.name === 'roleProfile') return '角色资料';
  if (telegramMobileCurrentRoute.value.name === 'chat') return '聊天';
  if (telegramMobileCurrentRoute.value.name === 'tool') return '工具';
  return '';
});
const telegramMobileToolContractId = computed(() => {
  const panelId = telegramMobileCurrentRoute.value.panelId || telegramMobileCurrentRoute.value.toolId || 'lumina-settings';
  return getSurfaceContractIdForRegisteredPanel(panelId)
    || getPrimarySurfaceContractIdForPlugin(panelId);
});
const telegramMobileToolAuxSidebarMode = computed(() => (
  telegramMobileToolContractId.value === 'forge.workspace' ? 'hidden' : undefined
));
const onOpenTelegramMobileCharacterOverview = (groupKey: string | null) => {
  if (!groupKey) return;
  onSelectTelegramCharacterOverview(groupKey);
  onPushTelegramMobileRoute({ name: 'characterOverview', groupKey });
};
const onOpenTelegramMobileSession = (sessionId: string) => {
  onOpenDiscordMobileChatSession(sessionId);
  onPushTelegramMobileRoute({ name: 'chat', sessionId });
};
const onOpenTelegramMobileRoleProfile = () => {
  onPushTelegramMobileRoute({ name: 'roleProfile' });
};
const onCreateTelegramMobileSession: ShellRuntimeActions['traditional']['createDiscordMobileChatSession'] = (payload) => {
  onCreateDiscordMobileChatSession(payload);
  onPushTelegramMobileRoute({ name: 'chat' });
};
const onOpenTelegramMobilePanel = (panelId: string) => {
  onPushTelegramMobileRoute({ name: 'tool', panelId });
};
const onHandleTelegramMobileRoleProfileTool = (panelId: string) => {
  if (panelId === 'none') {
    onPopTelegramMobileRoute();
    return;
  }
  onOpenTelegramMobilePanel(panelId);
};
const onOpenTelegramMobileToolEntry = (toolId: TelegramRailToolEntry['id']) => {
  onOpenTelegramToolEntry(toolId);
  onPushTelegramMobileRoute({ name: 'tool', toolId });
};
const { cssVars: telegramFrameVars } = useComponentSkin('telegram.frame');
const telegramFrameStyle = computed<CSSProperties>(() => telegramFrameVars.value as CSSProperties);
const telegramLeftRailStyle = computed<CSSProperties>(() => ({
  width: `${telegramLeftRailWidth.value}px`,
  minWidth: `${telegramLeftRailWidth.value}px`,
  maxWidth: `${telegramLeftRailWidth.value}px`
}));
</script>

<style>
.lw-traditional-shell {
  display: contents;
}

.lw-traditional-shell.is-telegram-desktop {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-wrap: nowrap;
  gap: var(--lw-telegram-frame-gap, 0px);
  padding: var(--lw-telegram-frame-padding, 0px);
  padding-top: var(--lw-telegram-frame-padding-top, var(--lw-telegram-frame-padding, 0px));
  align-content: stretch;
  overflow: hidden;
  border: 1px solid var(--lw-telegram-frame-border, rgba(255, 255, 255, 0.54));
  border-radius: var(--lw-telegram-frame-radius);
  background: var(--lw-telegram-frame-bg, rgba(226, 241, 252, 0.58));
  box-shadow: var(--lw-telegram-frame-shadow, 0 26px 70px rgba(44, 92, 130, 0.18));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(24px) saturate(1.2));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(24px) saturate(1.2));
}

.lw-main-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  border: 1px solid var(--lw-shell-main-border, color-mix(in srgb, var(--lw-border-base) 88%, white));
  border-radius: var(--lw-shell-main-radius, 24px);
  background: var(--lw-shell-main-bg,
      linear-gradient(180deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--lw-bg-elevated) 96%, white)));
  box-shadow: var(--lw-shell-main-shadow, 0 20px 44px rgba(15, 23, 42, 0.08));
  backdrop-filter: blur(10px);
}

.lw-traditional-shell.is-telegram-desktop .lw-main-wrapper {
  height: auto;
  flex: 1 1 0;
  min-width: 520px;
  border-radius: var(--lw-telegram-pane-radius, 0);
  border: 1px solid var(--lw-telegram-pane-border, transparent);
  box-shadow: var(--lw-telegram-pane-shadow, none);
}

.lw-traditional-shell.is-telegram-desktop .lw-main-wrapper[data-surface-variant='telegram'] {
  background: var(--lw-telegram-conversation-bg, var(--lw-shell-main-bg));
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.lw-traditional-shell.is-telegram-desktop .lw-widget-container[data-surface-variant='telegram'] {
  height: auto;
  border-radius: var(--lw-telegram-pane-radius, 0);
  border: 1px solid var(--lw-telegram-pane-border, transparent);
  box-shadow: var(--lw-telegram-pane-shadow, none);
}

.lw-telegram-left-pane {
  position: relative;
  flex: 0 0 auto;
  min-width: 260px;
  display: flex;
  align-self: stretch;
  min-height: 0;
}

.lw-telegram-left-stack {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.lw-telegram-left-stack__tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 10px 10px 0;
  background: var(--lw-telegram-chat-list-bg, var(--lw-character-rail-bg));
}

.lw-telegram-left-stack__tabs button {
  min-height: 34px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 52%, transparent);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
}

.lw-telegram-left-stack__tabs button.active,
.lw-telegram-left-stack__tabs button:hover {
  background: color-mix(in srgb, var(--lw-primary) 14%, transparent);
  color: var(--lw-primary);
}

.lw-telegram-left-pane .lw-discord-rail[data-skin-variant='telegram'] {
  width: 100%;
  min-width: 0;
  max-width: none;
  flex: 1 1 auto;
}

.lw-traditional-shell.is-telegram-desktop .lw-discord-rail[data-skin-variant='telegram'] {
  height: auto;
  border-radius: var(--lw-telegram-pane-radius, 0);
  border: 1px solid var(--lw-telegram-pane-border, transparent);
  box-shadow: var(--lw-telegram-pane-shadow, none);
}

.lw-telegram-left-resizer {
  position: absolute;
  top: 0;
  right: -7px;
  bottom: 0;
  width: 14px;
  cursor: col-resize;
  z-index: 12;
}

.lw-telegram-left-resizer::after {
  content: '';
  position: absolute;
  inset: 12px 2px;
  border-radius: 999px;
  background: transparent;
  transition: background 0.16s ease;
}

.lw-telegram-left-resizer:hover::after,
.lw-telegram-left-resizer.is-resizing::after {
  background: color-mix(in srgb, var(--lw-primary) 28%, transparent);
}

.lw-main-wrapper[data-surface-variant='discord'] {
  backdrop-filter: none;
}

.lw-panel-body:not(.is-freeform) .lw-main-wrapper {
  border-radius: 0;
  box-shadow: none;
  border-top: none;
  border-bottom: none;
}

.lw-panel-body:not(.is-freeform) .lw-traditional-shell.is-telegram-desktop .lw-main-wrapper[data-surface-variant='telegram'] {
  border: 1px solid var(--lw-telegram-pane-border, transparent);
  border-radius: var(--lw-telegram-pane-radius, 0);
  box-shadow: var(--lw-telegram-pane-shadow, none);
}

.lw-panel-body:not(.is-freeform) .lw-main-wrapper[data-surface-variant='discord'] {
  border-left: none;
  background: var(--lw-shell-main-mobile-bg, var(--lw-shell-main-bg, var(--lw-bg-app)));
}

.lw-main-wrapper.has-discord-mobile-shell {
  min-height: 0;
  padding-top: var(--lw-discord-mobile-safe-top, 0px);
  padding-right: var(--lw-discord-mobile-safe-right, 0px);
  padding-bottom: var(--lw-discord-mobile-safe-bottom, 0px);
  padding-left: var(--lw-discord-mobile-safe-left, 0px);
}

.lw-main-wrapper.has-telegram-mobile-nav {
  padding-bottom: calc(78px + var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px)));
}

.lw-telegram-mobile-stack {
  position: relative;
}

.lw-telegram-mobile-stack__bar {
  min-height: 52px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: calc(6px + var(--lw-content-safe-top, var(--lw-safe-top, 0px))) 14px 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--lw-border-base) 72%, transparent);
  background: color-mix(in srgb, var(--lw-surface-container-high) 76%, transparent);
}

.lw-telegram-mobile-stack__bar button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 72%, transparent);
  color: var(--lw-text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lw-telegram-mobile-stack__bar strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
}

.lw-main-timeline-wrapper {
  flex: 1;
  overflow: hidden;
  background: transparent;
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .lw-main-wrapper {
    height: auto;
    min-height: 0;
  }
}
</style>
