<template>
  <div
    class="lw-main-wrapper lw-telegram-mobile-stack"
    :class="{ 'has-telegram-mobile-nav': showBottomNavPadding }"
    :data-surface-variant="mainSurfaceVariant"
    :style="[mainSurfaceStyle, mobileMainStyle]"
  >
    <header v-if="showStackBar" class="lw-telegram-mobile-stack__bar">
      <button type="button" title="返回" @click="onPopRoute">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.4" fill="none">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <strong>{{ routeTitle }}</strong>
    </header>

    <ThemedSurfaceOutlet
      v-if="route.name === 'conversationList'"
      contract-id="conversation.sessionList"
      :input="{ compact: true }"
      :desktop-mode-id="activeDesktopModeId"
    />
    <ThemedSurfaceOutlet
      v-else-if="route.name === 'roleList'"
      contract-id="character.roster"
      :input="{ compact: true }"
      :desktop-mode-id="activeDesktopModeId"
    />
    <ThemedSurfaceOutlet
      v-else-if="route.name === 'roleProfile'"
      contract-id="telegram.infoPanel"
      :input="{
        state,
        isMobile: true,
        onOpenSession,
        onCreateSession,
        onOpenTool: onHandleRoleProfileTool
      }"
      :desktop-mode-id="activeDesktopModeId"
    />
    <ThemedSurfaceOutlet
      v-else-if="route.name === 'chat'"
      contract-id="chat.main"
      :input="{
        isMobile: true,
        onBack: onPopRoute,
        onOpenRoleProfile: onOpenRoleProfile,
        onOpenPanel: onOpenPanel
      }"
      :desktop-mode-id="activeDesktopModeId"
    />
    <ThemedSurfaceOutlet
      v-else-if="route.name === 'settings'"
      contract-id="settings.root"
      :input="{ activity: { size: 'small', pageType: 'standalone' } }"
      :desktop-mode-id="activeDesktopModeId"
    />
    <TelegramUserProfilePage
      v-else-if="route.name === 'profile'"
      :desktopModes="desktopModes"
      :activeDesktopModeId="activeDesktopModeId"
      :widgetGroups="widgetGroups"
      @setDesktopMode="onUpdateDesktopMode"
      @openSettings="onSelectBottomNav('settings')"
      @openPanel="onOpenPanel"
      @close="onClose"
    />
    <ThemedSurfaceOutlet
      v-else-if="route.name === 'tool' && toolContractId"
      :contract-id="toolContractId"
      :input="projectSurfaceInput(toolContractId, toolProps, {
        activity: toolActivity,
        isMobile: true,
        auxSidebarMode: toolAuxSidebarMode
      })"
      :desktop-mode-id="activeDesktopModeId"
    />
    <SurfaceFailure
      v-else-if="route.name === 'tool'"
      contract-id="tool-surface-unavailable"
    />
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import type { ActivityDescriptor } from '../../../platform/activity/types.js';
import type { SurfaceContractId } from '../../../platform/surface/types.js';
import ThemedSurfaceOutlet from '../../../platform/surface/ThemedSurfaceOutlet.vue';
import SurfaceFailure from '../../../platform/surface/SurfaceFailure.vue';
import { projectSurfaceInput } from '../../../platform/surface/surfaceInputProjection.js';
import type { CharacterChannelState } from '../../../types/ConversationContextTypes.js';
import type {
  ShellRuntimeActions,
  TelegramStackRoute,
  WidgetPanelGroup
} from '../../types.js';
import TelegramUserProfilePage from './TelegramUserProfilePage.vue';

defineProps<{
  route: TelegramStackRoute;
  routeTitle: string;
  showStackBar: boolean;
  showBottomNavPadding: boolean;
  mainSurfaceVariant: string;
  mainSurfaceStyle: CSSProperties;
  mobileMainStyle: CSSProperties;
  state: CharacterChannelState;
  desktopModes: Array<{ value: string; label: string; description?: string }>;
  activeDesktopModeId: string;
  widgetGroups: WidgetPanelGroup[];
  toolContractId: SurfaceContractId | null;
  toolProps: Record<string, unknown>;
  toolActivity: ActivityDescriptor;
  toolAuxSidebarMode?: 'hidden';
  onPopRoute: ShellRuntimeActions['traditional']['popTelegramMobileRoute'];
  onOpenSession: ShellRuntimeActions['traditional']['openDiscordMobileChatSession'];
  onCreateSession: ShellRuntimeActions['traditional']['createDiscordMobileChatSession'];
  onOpenPanel: (panelId: string) => void;
  onHandleRoleProfileTool: (panelId: string) => void;
  onOpenRoleProfile: () => void;
  onUpdateDesktopMode: ShellRuntimeActions['navigation']['updateDesktopMode'];
  onSelectBottomNav: ShellRuntimeActions['traditional']['selectTelegramBottomNav'];
  onClose: ShellRuntimeActions['navigation']['close'];
}>();
</script>

<style>
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
</style>
