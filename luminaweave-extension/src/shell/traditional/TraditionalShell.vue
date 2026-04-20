<template>
  <div class="lw-traditional-shell">
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

    <DiscordCharacterRail
      v-if="shouldShowDiscordCharacterRail"
      :state="characterChannelState"
      :onRenameSession="onRenameDiscordChatSession"
      :onDeleteSession="onDeleteDiscordChatSession"
      :onOpenSession="onOpenDiscordChatSession"
      :onCreateSession="onCreateDiscordChatSession"
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

    <template v-for="plugin in mainPlugins" :key="plugin.id">
      <div
        v-show="activeMainTab === plugin.id"
        class="lw-main-wrapper"
        :class="{
          'lw-main-timeline-wrapper': plugin.id === 'lumina-timeline',
          'has-discord-mobile-shell': isDiscordMobileMode
        }"
        :data-surface-variant="shellMainSurfaceVariant"
        :style="[shellMainSurfaceStyle, discordMobileMainStyle]"
      >
        <component
          :is="plugin.component"
          v-if="plugin.id !== 'lumina-timeline' || activeMainTab === 'lumina-timeline' || isTimelineLoadedOnce"
          :mode="'large'"
          :isMobile="isMobile"
          :auxSidebarMode="isForgeActiveInTraditional ? sidebarMode : undefined"
          :activeRightPanelId="isForgeActiveInTraditional ? activeRightPanel : undefined"
        />
      </div>
    </template>

    <template v-for="tab in dynamicTabs" :key="tab.id">
      <div
        v-show="activeMainTab === tab.id"
        class="lw-main-wrapper"
        :class="{ 'has-discord-mobile-shell': isDiscordMobileMode }"
        :data-surface-variant="shellMainSurfaceVariant"
        :style="[shellMainSurfaceStyle, discordMobileMainStyle]"
      >
        <component
          :is="tabComponentRegistry[tab.component as string] || tab.component"
          v-bind="tab.props"
          :auxSidebarMode="isForgeActiveInTraditional ? sidebarMode : undefined"
          :activeRightPanelId="isForgeActiveInTraditional ? activeRightPanel : undefined"
        />
      </div>
    </template>

    <WidgetPanelHost
      :activeRightPanel="activeRightPanel"
      :isMobile="isMobile"
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
      :showNexus="showNexus"
      :getPluginName="getPluginName"
      @resizeStart="onResizeStart"
      @backFromDetailedSettings="onBackFromDetailedSettings"
      @toggleWidgetDropdown="onToggleWidgetDropdown"
      @switchRightPanel="onSwitchRightPanel"
      @restoreSidebarLeft="onRestoreSidebarLeft"
      @closePanel="onClosePanel"
      @updateShowNexus="onUpdateShowNexus"
    />
  </div>
</template>

<script setup lang="ts">
import type { Component, CSSProperties } from 'vue';
import DiscordCharacterRail from '../../components/DiscordCharacterRail.vue';
import DiscordGuildRail from '../../components/DiscordGuildRail.vue';
import ForgeSidebar from '../../components/ForgeSidebar.vue';
import type { LuminaPlugin } from '../../types/plugin';
import type { DynamicTabConfig, RegisteredPanelEntry, WidgetPanelGroup } from '../types';
import type {
  CharacterChannelState,
  CreateChatConversationInput,
  DeleteChatConversationInput,
  RenameChatConversationInput
} from '../../types/ConversationContextTypes';
import DiscordMobileShell from './DiscordMobileShell.vue';
import WidgetPanelHost from './WidgetPanelHost.vue';

defineProps<{
  shouldShowDiscordGuildRail: boolean;
  discordGuildEntries: Array<{ id: string; name: string; icon: string }>;
  activeMainTab: string;
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
  dynamicTabs: DynamicTabConfig[];
  tabComponentRegistry: Record<string, Component>;
  shellMainSurfaceVariant: string;
  shellMainSurfaceStyle: CSSProperties;
  discordMobileMainStyle: CSSProperties;
  isTimelineLoadedOnce: boolean;
  isForgeActiveInTraditional: boolean;
  sidebarMode: 'left' | 'right' | 'widget' | 'hidden';
  activeRightPanel: string;
  isMobile: boolean;
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
  widgetGroups: WidgetPanelGroup[];
  showWidgetDropdown: boolean;
  showNexus: boolean;
  getPluginName: (pluginId: string | null) => string;
  onSwitchMainView: (tabId: string) => void;
  onToggleSettings: () => void;
  onClose: () => void;
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
}>();
</script>

<style>
.lw-traditional-shell {
  display: contents;
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

.lw-main-wrapper[data-surface-variant='discord'] {
  backdrop-filter: none;
}

.lw-panel-body:not(.is-freeform) .lw-main-wrapper {
  border-radius: 0;
  box-shadow: none;
  border-top: none;
  border-bottom: none;
}

.luminaweave-app-root[data-desktop-mode='discord'][data-layout-mode='traditional'] .lw-panel-body:not(.is-freeform) .lw-main-wrapper[data-surface-variant='discord'] {
  border-left: none;
  background: #313338;
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
