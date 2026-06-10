<template>
  <div class="lw-telegram-left-pane" :style="leftRailStyle">
    <div class="lw-telegram-left-stack">
      <nav class="lw-telegram-left-stack__tabs" aria-label="Telegram left pane pages">
        <button
          type="button"
          :class="{ active: leftRoute === 'conversationList' }"
          @click="onSetLeftRoute('conversationList')"
        >
          会话
        </button>
        <button
          type="button"
          :class="{ active: leftRoute === 'roleList' }"
          @click="onSetLeftRoute('roleList')"
        >
          角色
        </button>
      </nav>
      <DiscordCharacterRail
        v-if="leftRoute === 'conversationList'"
        :state="state"
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
        v-else
        :state="state"
        @selectRole="onSelectCharacterOverview"
      />
    </div>
    <div
      class="lw-telegram-left-resizer"
      :class="{ 'is-resizing': isLeftRailResizing }"
      role="separator"
      aria-orientation="vertical"
      title="调整左侧列表宽度"
      @mousedown.stop.prevent="onLeftRailResizeStart"
    ></div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import DiscordCharacterRail from '../../../components/DiscordCharacterRail.vue';
import type {
  CharacterChannelState
} from '../../../types/ConversationContextTypes.js';
import type {
  ShellRuntimeActions,
  TelegramConversationListMode,
  TelegramDesktopLeftRoute,
  TelegramRailToolEntry
} from '../../types.js';
import TelegramRoleListPage from './TelegramRoleListPage.vue';

defineProps<{
  state: CharacterChannelState;
  leftRoute: TelegramDesktopLeftRoute;
  leftRailStyle: CSSProperties;
  isLeftRailResizing: boolean;
  selectedCharacterKey: string | null;
  telegramToolEntries: TelegramRailToolEntry[];
  activeTelegramToolId: string | null;
  telegramListMode: TelegramConversationListMode;
  onSetLeftRoute: ShellRuntimeActions['traditional']['setTelegramDesktopLeftRoute'];
  onRenameSession: ShellRuntimeActions['traditional']['renameDiscordChatSession'];
  onDeleteSession: ShellRuntimeActions['traditional']['deleteDiscordChatSession'];
  onOpenSession: ShellRuntimeActions['traditional']['openDiscordChatSession'];
  onCreateSession: ShellRuntimeActions['traditional']['createDiscordChatSession'];
  onTelegramListModeChange: ShellRuntimeActions['traditional']['setTelegramConversationListMode'];
  onOpenTelegramToolEntry: ShellRuntimeActions['traditional']['openTelegramToolEntry'];
  onSelectCharacterOverview: ShellRuntimeActions['traditional']['selectTelegramCharacterOverview'];
  onToggleGroup: ShellRuntimeActions['traditional']['toggleDiscordCharacterGroup'];
  onToggleSessionExpansion: ShellRuntimeActions['traditional']['toggleDiscordCharacterSessionExpansion'];
  onLeftRailResizeStart: ShellRuntimeActions['traditional']['telegramLeftRailResizeStart'];
}>();
</script>

<style>
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
</style>
