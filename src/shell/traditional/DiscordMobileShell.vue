<template>
  <template v-if="isDiscordMobileMode">
    <div v-if="shouldShowDiscordMobileShell" class="lw-discord-mobile-shell" :class="`is-${guildRailPosition}`">
      <DiscordGuildRail
        :items="discordGuildEntries"
        :activeMainTab="activeMainTab"
        :isMobile="true"
        :placement="guildRailPosition"
        @switchMainView="emit('switchMainView', $event)"
        @toggleSettings="emit('toggleSettings')"
        @close="emit('close')"
      />
    </div>

    <button
      class="lw-discord-mobile-rail-toggle"
      :class="[`is-${characterEntryPosition}`, { active: showDiscordMobileCharacterRail }]"
      :style="characterEntryStyle"
      type="button"
      @click="emit('updateShowDiscordMobileCharacterRail', !showDiscordMobileCharacterRail)"
    >
      <span class="lw-discord-mobile-rail-toggle-mark">@</span>
      <span class="lw-discord-mobile-rail-toggle-copy">
        <strong>角色频道</strong>
        <small>打开 DM / 角色历史</small>
      </span>
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.4" fill="none">
        <polyline :points="showDiscordMobileCharacterRail ? '6 15 12 9 18 15' : '6 9 12 15 18 9'"></polyline>
      </svg>
    </button>

    <transition name="fade">
      <div
        v-if="showDiscordMobileCharacterRail"
        class="lw-discord-mobile-sheet"
        :class="`is-${characterEntryPosition}`"
        @click.self="emit('updateShowDiscordMobileCharacterRail', false)"
      >
        <DiscordCharacterRail
          :state="characterChannelState"
          :isMobile="true"
          :mobilePlacement="characterEntryPosition"
          :onRenameSession="onRenameMobileSession"
          :onDeleteSession="onDeleteMobileSession"
          :onOpenSession="emitOpenMobileSession"
          :onCreateSession="emitCreateMobileSession"
          :onToggleGroup="onToggleMobileGroup"
          :onToggleSessionExpansion="onToggleMobileSessionExpansion"
        />
      </div>
    </transition>
  </template>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import DiscordCharacterRail from '../../components/DiscordCharacterRail.vue';
import DiscordGuildRail from '../../components/DiscordGuildRail.vue';
import type {
  CharacterChannelState,
  CreateChatConversationInput,
  DeleteChatConversationInput,
  RenameChatConversationInput
} from '../../types/ConversationContextTypes';

defineProps<{
  isDiscordMobileMode: boolean;
  shouldShowDiscordMobileShell: boolean;
  discordGuildEntries: Array<{ id: string; name: string; icon: string }>;
  activeMainTab: string;
  guildRailPosition: 'top' | 'bottom' | 'left' | 'right';
  characterEntryPosition: 'top' | 'bottom' | 'left' | 'right';
  showDiscordMobileCharacterRail: boolean;
  characterEntryStyle: CSSProperties;
  characterChannelState: CharacterChannelState;
  onRenameMobileSession: (payload: RenameChatConversationInput) => Promise<void> | void;
  onDeleteMobileSession: (payload: DeleteChatConversationInput) => Promise<void> | void;
  onToggleMobileGroup: (groupKey: string) => void;
  onToggleMobileSessionExpansion: (groupKey: string) => void;
}>();

const emit = defineEmits<{
  (e: 'switchMainView', tabId: string): void;
  (e: 'toggleSettings'): void;
  (e: 'close'): void;
  (e: 'openMobileSession', sessionId: string): void;
  (e: 'createMobileSession', payload: CreateChatConversationInput): void;
  (e: 'updateShowDiscordMobileCharacterRail', value: boolean): void;
}>();

const emitOpenMobileSession = (sessionId: string) => {
  emit('openMobileSession', sessionId);
};

const emitCreateMobileSession = (payload: CreateChatConversationInput) => {
  emit('createMobileSession', payload);
};
</script>

<style>
.lw-discord-mobile-shell {
  position: absolute;
  z-index: 22;
  background: #1f2125;
  border: 1px solid #121317;
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

.lw-discord-mobile-shell.is-top,
.lw-discord-mobile-shell.is-bottom {
  left: 0;
  right: 0;
}

.lw-discord-mobile-shell.is-top {
  top: 0;
  border-top: none;
  border-left: none;
  border-right: none;
}

.lw-discord-mobile-shell.is-bottom {
  bottom: 0;
  border-bottom: none;
  border-left: none;
  border-right: none;
}

.lw-discord-mobile-shell.is-left,
.lw-discord-mobile-shell.is-right {
  top: 0;
  bottom: 0;
}

.lw-discord-mobile-shell.is-left {
  left: 0;
  border-top: none;
  border-bottom: none;
  border-left: none;
}

.lw-discord-mobile-shell.is-right {
  right: 0;
  border-top: none;
  border-bottom: none;
  border-right: none;
}

.lw-discord-mobile-rail-toggle {
  position: absolute;
  z-index: 23;
  padding: 12px 14px;
  border: 1px solid #3f4147;
  border-radius: 18px;
  background: #2b2d31;
  color: var(--lw-text-main);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.22);
}

.lw-discord-mobile-rail-toggle.is-top,
.lw-discord-mobile-rail-toggle.is-bottom {
  left: 12px;
  right: 12px;
}

.lw-discord-mobile-rail-toggle.is-top {
  top: var(--lw-discord-mobile-entry-offset-top, 12px);
}

.lw-discord-mobile-rail-toggle.is-bottom {
  bottom: var(--lw-discord-mobile-entry-offset-bottom, 12px);
}

.lw-discord-mobile-rail-toggle.is-left,
.lw-discord-mobile-rail-toggle.is-right {
  top: 50%;
  width: 54px;
  padding: 12px 10px;
  flex-direction: column;
  transform: translateY(-50%);
}

.lw-discord-mobile-rail-toggle.is-left {
  left: var(--lw-discord-mobile-entry-offset-left, 12px);
}

.lw-discord-mobile-rail-toggle.is-right {
  right: var(--lw-discord-mobile-entry-offset-right, 12px);
}

.lw-discord-mobile-rail-toggle-mark {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #232428;
  color: #8e9297;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 800;
}

.lw-discord-mobile-rail-toggle-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.lw-discord-mobile-rail-toggle.is-left .lw-discord-mobile-rail-toggle-copy,
.lw-discord-mobile-rail-toggle.is-right .lw-discord-mobile-rail-toggle-copy {
  display: none;
}

.lw-discord-mobile-rail-toggle-copy strong {
  font-size: 13px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.lw-discord-mobile-rail-toggle-copy small {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.lw-discord-mobile-rail-toggle.active {
  border-color: rgba(88, 101, 242, 0.45);
  background: #313338;
}

.lw-discord-mobile-sheet {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(6px);
}

.lw-discord-mobile-sheet.is-top {
  align-items: flex-start;
  justify-content: stretch;
}

.lw-discord-mobile-sheet.is-bottom {
  align-items: flex-end;
  justify-content: stretch;
}

.lw-discord-mobile-sheet.is-left {
  align-items: stretch;
  justify-content: flex-start;
}

.lw-discord-mobile-sheet.is-right {
  align-items: stretch;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .lw-discord-mobile-rail-toggle {
    padding: 11px 12px;
    border-radius: 16px;
  }

  .lw-discord-mobile-rail-toggle.is-top,
  .lw-discord-mobile-rail-toggle.is-bottom {
    left: 10px;
    right: 10px;
  }
}
</style>
