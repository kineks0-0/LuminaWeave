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

    <TelegramDesktopPane
      v-if="isTelegramDesktopMode && shouldShowCharacterNavigationPane"
      :activeDesktopModeId="activeDesktopModeId"
      :leftRoute="telegramDesktopLeftRoute"
      :leftRailStyle="telegramLeftRailStyle"
      :isLeftRailResizing="isTelegramLeftRailResizing"
      :onSetLeftRoute="onSetTelegramDesktopLeftRoute"
      :onLeftRailResizeStart="onTelegramLeftRailResizeStart"
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
      :activeDesktopModeId="activeDesktopModeId"
      @switchMainView="onHandleDiscordMobileMainViewSwitch"
      @toggleSettings="onToggleSettings"
      @close="onClose"
      @updateShowDiscordMobileCharacterRail="onUpdateShowDiscordMobileCharacterRail"
    />

    <slot
      name="composition"
      :activity-component="compositionActivityComponent"
      :activity-component-props="compositionActivityComponentProps"
    >
      <TelegramMobileStack
        v-if="isTelegramMobileMode"
        :route="telegramMobileCurrentRoute"
        :routeTitle="telegramMobileStackTitle"
        :showStackBar="telegramMobileStackShowsBar"
        :showBottomNavPadding="shouldShowTelegramMobileBottomNav"
        :mainSurfaceVariant="shellMainSurfaceVariant"
        :mainSurfaceStyle="shellMainSurfaceStyle"
        :mobileMainStyle="discordMobileMainStyle"
        :state="characterChannelState"
        :desktopModes="desktopModeOptions"
        :activeDesktopModeId="activeDesktopModeId"
        :widgetGroups="widgetGroups"
        :toolContractId="telegramMobileToolContractId"
        :toolProps="telegramMobileToolProps"
        :toolActivity="telegramMobileToolActivity"
        :toolAuxSidebarMode="telegramMobileToolAuxSidebarMode"
        :onPopRoute="onPopTelegramMobileRoute"
        :onOpenSession="onOpenTelegramMobileSession"
        :onCreateSession="onCreateTelegramMobileSession"
        :onOpenPanel="onOpenTelegramMobilePanel"
        :onHandleRoleProfileTool="onHandleTelegramMobileRoleProfileTool"
        :onOpenRoleProfile="onOpenTelegramMobileRoleProfile"
        :onUpdateDesktopMode="onUpdateDesktopMode"
        :onSelectBottomNav="onSelectTelegramBottomNav"
        :onClose="onClose"
      />

      <template v-else>
        <template v-for="entry in mainSurfaceEntries" :key="entry.plugin.id">
          <div
            v-show="activeMainTab === entry.plugin.id"
            class="lw-main-wrapper"
            :class="{
              'lw-main-timeline-wrapper': entry.plugin.id === 'lumina-timeline',
              'has-discord-mobile-shell': isDiscordMobileMode,
              'has-telegram-mobile-nav': isTelegramMobileMode
            }"
            :data-surface-variant="shellMainSurfaceVariant"
            :style="[shellMainSurfaceStyle, discordMobileMainStyle]"
          >
            <ThemedSurfaceOutlet
              v-if="entry.plugin.id !== 'lumina-timeline' || activeMainTab === 'lumina-timeline' || isTimelineLoadedOnce"
              :contract-id="entry.contractId"
              :input="getMainSurfaceInput(entry.contractId)"
              :desktop-mode-id="activeDesktopModeId"
            />
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
            :desktop-mode-id="activeDesktopModeId"
            :is-mobile="isMobile"
            :aux-sidebar-mode="surfaceAuxSidebarMode"
            :active-right-panel-id="activeRightPanel"
          />
        </div>
      </template>
    </slot>

    <WidgetPanelHost
      :activeRightPanel="activeRightPanel"
      :desktopModeId="activeDesktopModeId"
      :isMobile="isMobile"
      :characterChannelState="characterChannelState"
      :surfaceVariant="shellWidgetSurfaceVariant"
      :widgetStyle="shellWidgetStyle"
      :widgetWidth="widgetWidth"
      :isResizing="isResizing"
      :currentDetailedView="currentDetailedView"
      :saveStatus="saveStatus"
      :auxSidebarMode="surfaceAuxSidebarMode"
      :activeWidgetPlugin="activeWidgetPlugin"
      :activeRegisteredPanel="activeRegisteredPanel"
      :activeRightPanelActivity="activeRightPanelActivity"
      :widgetGroups="widgetGroups"
      :showWidgetDropdown="showWidgetDropdown"
      :getPluginName="getPluginName"
      :onCreateChatSession="onCreateDiscordChatSession"
      :onOpenSession="onOpenDiscordChatSession"
      @resizeStart="onResizeStart"
      @backFromDetailedSettings="onBackFromDetailedSettings"
      @toggleWidgetDropdown="onToggleWidgetDropdown"
      @switchRightPanel="onSwitchRightPanel"
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
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import DiscordGuildRail from '../../components/DiscordGuildRail.vue';
import type { ShellRuntimeActions, ShellRuntimeContext, ShellRuntimeSurfaces } from '../types.js';
import DiscordMobileShell from '../modes/discord/DiscordMobileShell.vue';
import TelegramBottomNav from '../modes/telegram/TelegramBottomNav.vue';
import TelegramDesktopPane from '../modes/telegram/TelegramDesktopPane.vue';
import TelegramMobileStack from '../modes/telegram/TelegramMobileStack.vue';
import {
  resolveTelegramMobileRouteTitle,
  resolveTelegramMobileToolActivity,
  resolveTelegramMobileToolAuxSidebarMode,
  resolveTelegramMobileToolContractId,
  resolveTelegramMobileToolProps,
  shouldShowTelegramMobileBottomNav as resolveShouldShowTelegramMobileBottomNav,
  shouldShowTelegramMobileStackBar as resolveShouldShowTelegramMobileStackBar
} from '../modes/telegram/telegramRouteViewModel.js';
import WidgetPanelHost from './WidgetPanelHost.vue';
import ThemedSurfaceOutlet from '../../platform/surface/ThemedSurfaceOutlet.vue';
import { projectSurfaceInput } from '../../platform/surface/surfaceInputProjection.js';
import { getPrimarySurfaceContractIdForPlugin } from '../../platform/plugin/officialPluginSurfaces.js';
import DynamicTabOutlet from '../DynamicTabOutlet.vue';
import type { SurfaceContractId } from '../../platform/surface/types.js';
import ShellPrimaryActivityOutlet from '../ShellPrimaryActivityOutlet.vue';

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
const shouldShowCharacterNavigationPane = computed(() => props.runtimeContext.traditional.shouldShowCharacterNavigationPane);
const isDiscordMobileMode = computed(() => props.runtimeContext.traditional.isDiscordMobileMode);
const isTelegramMobileMode = computed(() => props.runtimeContext.traditional.isTelegramMobileMode);
const shouldShowDiscordMobileShell = computed(() => props.runtimeContext.traditional.shouldShowDiscordMobileShell);
const discordMobileGuildRailPosition = computed(() => props.runtimeContext.traditional.discordMobileGuildRailPosition);
const discordMobileCharacterEntryPosition = computed(() => props.runtimeContext.traditional.discordMobileCharacterEntryPosition);
const showDiscordMobileCharacterRail = computed(() => props.runtimeContext.traditional.showDiscordMobileCharacterRail);
const discordMobileCharacterEntryStyle = computed(() => props.runtimeContext.traditional.discordMobileCharacterEntryStyle);
const telegramDesktopLeftRoute = computed(() => props.runtimeContext.traditional.telegramDesktopLeftRoute);
const telegramMobileActiveTab = computed(() => props.runtimeContext.traditional.telegramMobileActiveTab);
const telegramMobileCurrentRoute = computed(() => props.runtimeContext.traditional.telegramMobileCurrentRoute);
const mainPlugins = computed(() => props.runtimeSurfaces.traditional.mainPlugins);
const mainSurfaceEntries = computed(() => mainPlugins.value.flatMap(plugin => {
  const contractId = getPrimarySurfaceContractIdForPlugin(plugin);
  if (!contractId) {
    console.error('[SurfaceRuntime] Plugin primary surface unavailable', { pluginId: plugin.id });
    return [];
  }
  return [{ plugin, contractId }];
}));
const shellMainSurfaceVariant = computed(() => props.runtimeSurfaces.traditional.mainSurfaceVariant);
const shellMainSurfaceStyle = computed(() => props.runtimeSurfaces.traditional.mainSurfaceStyle);
const discordMobileMainStyle = computed(() => props.runtimeSurfaces.traditional.mobileMainStyle);
const isTimelineLoadedOnce = computed(() => props.runtimeContext.traditional.isTimelineLoadedOnce);
const sidebarMode = computed(() => props.runtimeContext.traditional.sidebarMode);
const activeRightPanel = computed(() => props.runtimeContext.traditional.activeRightPanel);
const shellWidgetSurfaceVariant = computed(() => props.runtimeSurfaces.traditional.widgetSurfaceVariant);
const shellWidgetStyle = computed(() => props.runtimeSurfaces.traditional.widgetStyle);
const widgetWidth = computed(() => props.runtimeContext.traditional.widgetWidth);
const isResizing = computed(() => props.runtimeContext.traditional.isResizing);
const telegramLeftRailWidth = computed(() => props.runtimeContext.traditional.telegramLeftRailWidth);
const isTelegramLeftRailResizing = computed(() => props.runtimeContext.traditional.isTelegramLeftRailResizing);
const activeWidgetPlugin = computed(() => props.runtimeContext.traditional.activeWidgetPlugin);
const activeRegisteredPanel = computed(() => props.runtimeContext.traditional.activeRegisteredPanel);
const activeRightPanelActivity = computed(() => props.runtimeContext.traditional.activeRightPanelActivity);
const showWidgetDropdown = computed(() => props.runtimeContext.traditional.showWidgetDropdown);
const showNexus = computed(() => props.runtimeContext.traditional.showNexus);
const surfaceAuxSidebarMode = computed(() => isMobile.value ? 'hidden' : sidebarMode.value);

const getMainSurfaceInput = (contractId: SurfaceContractId) => {
  const input = contractId === 'chat.main' && isTelegramDesktopMode.value
    ? {
        onOpenRoleProfile: onOpenTelegramDesktopRoleProfile,
        onOpenPanel: onSwitchRightPanel
      }
    : {};

  return projectSurfaceInput(contractId, input, {
    activity: { size: 'default', pageType: 'nested' },
    isMobile: isMobile.value,
    auxSidebarMode: surfaceAuxSidebarMode.value,
    activeRightPanelId: activeRightPanel.value
  });
};

const getPluginName = (pluginId: string | null) => props.runtimeActions.getPluginName(pluginId);
const onSwitchMainView = (tabId: string) => props.runtimeActions.navigation.switchMainView(tabId);
const onToggleSettings = () => props.runtimeActions.navigation.openSettingsPanel();
const onClose = () => props.runtimeActions.navigation.close();
const onOpenDiscordChatSession = (sessionId: string) => props.runtimeActions.traditional.openDiscordChatSession(sessionId);
const onOpenDiscordMobileChatSession = (sessionId: string) =>
  props.runtimeActions.traditional.openDiscordMobileChatSession(sessionId);
const onCreateDiscordChatSession: ShellRuntimeActions['traditional']['createDiscordChatSession'] = (payload) =>
  props.runtimeActions.traditional.createDiscordChatSession(payload);
const onCreateDiscordMobileChatSession: ShellRuntimeActions['traditional']['createDiscordMobileChatSession'] = (payload) =>
  props.runtimeActions.traditional.createDiscordMobileChatSession(payload);
const onHandleDiscordMobileMainViewSwitch = (tabId: string) =>
  props.runtimeActions.traditional.handleDiscordMobileMainViewSwitch(tabId);
const onUpdateShowDiscordMobileCharacterRail = (value: boolean) =>
  props.runtimeActions.traditional.updateShowDiscordMobileCharacterRail(value);
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
const onOpenTelegramDesktopRoleProfile = () => onSwitchRightPanel('telegram-profile');
const onClosePanel = () => props.runtimeActions.traditional.closePanel();
const onUpdateShowNexus = (value: boolean) => props.runtimeActions.traditional.updateShowNexus(value);
const onSelectTelegramBottomNav: ShellRuntimeActions['traditional']['selectTelegramBottomNav'] = (itemId) =>
  props.runtimeActions.traditional.selectTelegramBottomNav(itemId);
const onUpdateDesktopMode = (desktopModeId: string) => props.runtimeActions.navigation.updateDesktopMode(desktopModeId);

const isTelegramMode = computed(() => props.runtimeContext.activeDesktopModeId === 'telegram');
const isTelegramDesktopMode = computed(() => (
  isTelegramMode.value && !props.runtimeContext.isMobile
));
const shouldShowTelegramMobileBottomNav = computed(() => (
  resolveShouldShowTelegramMobileBottomNav(isTelegramMobileMode.value, telegramMobileCurrentRoute.value)
));
const telegramMobileStackShowsBar = computed(() =>
  resolveShouldShowTelegramMobileStackBar(telegramMobileCurrentRoute.value)
);
const telegramMobileStackTitle = computed(() =>
  resolveTelegramMobileRouteTitle(telegramMobileCurrentRoute.value)
);
const telegramMobileToolContractId = computed(() =>
  resolveTelegramMobileToolContractId(telegramMobileCurrentRoute.value, {
    resolveRegisteredPanelContractId: props.runtimeActions.resolveRegisteredPanelSurface,
    resolvePluginContractId: props.runtimeActions.resolvePluginPrimarySurface
  })
);
const telegramMobileToolActivity = computed(() =>
  resolveTelegramMobileToolActivity(telegramMobileCurrentRoute.value)
);
const telegramMobileToolProps = computed(() =>
  resolveTelegramMobileToolProps(telegramMobileCurrentRoute.value)
);
const telegramMobileToolAuxSidebarMode = computed(() =>
  telegramMobileToolContractId.value
    ? resolveTelegramMobileToolAuxSidebarMode(telegramMobileToolContractId.value)
    : undefined
);
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
const compositionActivityComponent = computed(() => (
  isTelegramMobileMode.value ? TelegramMobileStack : ShellPrimaryActivityOutlet
));
const compositionActivityComponentProps = computed(() => {
  if (!isTelegramMobileMode.value) {
    return {
      runtimeContext: props.runtimeContext,
      runtimeSurfaces: props.runtimeSurfaces
    };
  }

  return {
    route: telegramMobileCurrentRoute.value,
    routeTitle: telegramMobileStackTitle.value,
    showStackBar: telegramMobileStackShowsBar.value,
    showBottomNavPadding: shouldShowTelegramMobileBottomNav.value,
    mainSurfaceVariant: shellMainSurfaceVariant.value,
    mainSurfaceStyle: shellMainSurfaceStyle.value,
    mobileMainStyle: discordMobileMainStyle.value,
    state: characterChannelState.value,
    desktopModes: desktopModeOptions.value,
    activeDesktopModeId: activeDesktopModeId.value,
    widgetGroups: widgetGroups.value,
    toolContractId: telegramMobileToolContractId.value,
    toolProps: telegramMobileToolProps.value,
    toolActivity: telegramMobileToolActivity.value,
    toolAuxSidebarMode: telegramMobileToolAuxSidebarMode.value,
    onPopRoute: onPopTelegramMobileRoute,
    onOpenSession: onOpenTelegramMobileSession,
    onCreateSession: onCreateTelegramMobileSession,
    onOpenPanel: onOpenTelegramMobilePanel,
    onHandleRoleProfileTool: onHandleTelegramMobileRoleProfileTool,
    onOpenRoleProfile: onOpenTelegramMobileRoleProfile,
    onUpdateDesktopMode,
    onSelectBottomNav: onSelectTelegramBottomNav,
    onClose
  };
});
const { cssVars: telegramFrameVars } = useSurfaceSkin('telegram.frame');
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

/* 省电 / 禁用动效时移除高开销的背景模糊（与 motionPerformance 设置的说明一致） */
.luminaweave-app-root:not([data-motion='full']) .lw-traditional-shell.is-telegram-desktop {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.lw-main-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  border: 1px solid var(--lw-shell-main-border, color-mix(in srgb, var(--lw-border-base) 88%, var(--lw-bg-elevated)));
  border-radius: var(--lw-shell-main-radius, 24px);
  background: var(--lw-shell-main-bg,
      linear-gradient(180deg,
        color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent),
        color-mix(in srgb, var(--lw-bg-surface) 88%, transparent)));
  box-shadow: var(--lw-shell-main-shadow, 0 20px 44px rgba(15, 23, 42, 0.08));
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
