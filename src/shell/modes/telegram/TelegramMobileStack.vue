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

    <DiscordCharacterRail
      v-if="route.name === 'conversationList'"
      :state="state"
      :isMobile="true"
      :mobilePlacement="'bottom'"
      :onRenameSession="onRenameSession"
      :onDeleteSession="onDeleteSession"
      :onOpenSession="onOpenSession"
      :onCreateSession="onCreateSession"
      :selectedCharacterKey="selectedCharacterKey"
      :telegramToolEntries="telegramToolEntries"
      :activeTelegramToolId="activeTelegramToolId"
      :telegramListMode="telegramListMode"
      :onTelegramListModeChange="onTelegramListModeChange"
      :onOpenTelegramToolEntry="onOpenTelegramToolEntry"
      :onSelectCharacterOverview="onSelectCharacterOverview"
      :onToggleGroup="onToggleGroup"
      :onToggleSessionExpansion="onToggleSessionExpansion"
    />
    <TelegramRoleListPage
      v-else-if="route.name === 'roleList'"
      :state="state"
      @selectRole="onSelectCharacterOverview"
    />
    <TelegramCharacterOverview
      v-else-if="route.name === 'characterOverview'"
      :state="state"
      :selectedCharacterKey="route.groupKey || selectedCharacterKey"
      :isMobile="true"
      @openSession="onOpenSession"
      @createSession="onCreateSession"
      @openTool="onOpenPanel"
    />
    <SurfaceOutlet
      v-else-if="route.name === 'roleProfile'"
      contract-id="telegram.infoPanel"
      :state="state"
      :activity="{ size: 'default', pageType: 'standalone' }"
      :isMobile="true"
      @openSession="onOpenSession"
      @createSession="onCreateSession"
      @openTool="onHandleRoleProfileTool"
    />
    <SurfaceOutlet
      v-else-if="route.name === 'chat'"
      contract-id="chat.main"
      :activity="{ size: 'default', pageType: 'standalone' }"
      :isMobile="true"
      :onTelegramBack="onPopRoute"
      :onTelegramOpenRoleProfile="onOpenRoleProfile"
    />
    <SurfaceOutlet
      v-else-if="route.name === 'settings'"
      contract-id="settings.root"
      :activity="{ size: 'small', pageType: 'standalone' }"
      :isMobile="true"
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
    <SurfaceOutlet
      v-else-if="route.name === 'tool'"
      :contract-id="toolContractId"
      v-bind="toolProps"
      :activity="toolActivity"
      :isMobile="true"
      :auxSidebarMode="toolAuxSidebarMode"
    />
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import type { ActivityDescriptor } from '../../../platform/activity/types.js';
import type { SurfaceContractId } from '../../../platform/surface/types.js';
import SurfaceOutlet from '../../../platform/surface/SurfaceOutlet.vue';
import DiscordCharacterRail from '../../../components/DiscordCharacterRail.vue';
import type { CharacterChannelState } from '../../../types/ConversationContextTypes.js';
import type {
  ShellRuntimeActions,
  TelegramConversationListMode,
  TelegramRailToolEntry,
  TelegramStackRoute,
  WidgetPanelGroup
} from '../../types.js';
import TelegramCharacterOverview from './TelegramCharacterOverview.vue';
import TelegramRoleListPage from './TelegramRoleListPage.vue';
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
  selectedCharacterKey: string | null;
  telegramToolEntries: TelegramRailToolEntry[];
  activeTelegramToolId: string | null;
  telegramListMode: TelegramConversationListMode;
  desktopModes: Array<{ value: string; label: string; description?: string }>;
  activeDesktopModeId: string;
  widgetGroups: WidgetPanelGroup[];
  toolContractId: SurfaceContractId;
  toolProps: Record<string, unknown>;
  toolActivity: ActivityDescriptor;
  toolAuxSidebarMode?: 'hidden';
  onPopRoute: ShellRuntimeActions['traditional']['popTelegramMobileRoute'];
  onRenameSession: ShellRuntimeActions['traditional']['renameDiscordChatSession'];
  onDeleteSession: ShellRuntimeActions['traditional']['deleteDiscordChatSession'];
  onOpenSession: ShellRuntimeActions['traditional']['openDiscordMobileChatSession'];
  onCreateSession: ShellRuntimeActions['traditional']['createDiscordMobileChatSession'];
  onTelegramListModeChange: ShellRuntimeActions['traditional']['setTelegramConversationListMode'];
  onOpenTelegramToolEntry: ShellRuntimeActions['traditional']['openTelegramToolEntry'];
  onSelectCharacterOverview: ShellRuntimeActions['traditional']['selectTelegramCharacterOverview'];
  onToggleGroup: ShellRuntimeActions['traditional']['toggleDiscordCharacterGroup'];
  onToggleSessionExpansion: ShellRuntimeActions['traditional']['toggleDiscordCharacterSessionExpansion'];
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
