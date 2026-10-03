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
      <ThemedSurfaceOutlet
        v-if="leftRoute === 'conversationList'"
        contract-id="conversation.sessionList"
        :input="{}"
        :desktop-mode-id="activeDesktopModeId"
      />
      <ThemedSurfaceOutlet
        v-else
        contract-id="character.roster"
        :input="{}"
        :desktop-mode-id="activeDesktopModeId"
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
import ThemedSurfaceOutlet from '../../../platform/surface/ThemedSurfaceOutlet.vue';
import type {
  ShellRuntimeActions,
  TelegramDesktopLeftRoute
} from '../../types.js';

defineProps<{
  activeDesktopModeId: string;
  leftRoute: TelegramDesktopLeftRoute;
  leftRailStyle: CSSProperties;
  isLeftRailResizing: boolean;
  onSetLeftRoute: ShellRuntimeActions['traditional']['setTelegramDesktopLeftRoute'];
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
  /* 标签条与列表共用一块圆角玻璃面板；列表本身透明，不再是嵌在里面的不透明方块 */
  --lw-telegram-pane-list-bg: transparent;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--lw-telegram-pane-border, transparent);
  border-radius: var(--lw-telegram-pane-radius, 0);
  background: var(--lw-telegram-pane-bg, var(--lw-telegram-chat-list-bg, var(--lw-character-rail-bg)));
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
}

.lw-telegram-left-stack__tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 10px 10px 0;
}

.lw-telegram-left-stack__tabs button {
  min-height: 34px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-text-main) 6%, transparent);
  color: var(--lw-text-secondary);
  cursor: pointer;
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

.lw-telegram-left-stack > .character-roster-surface,
.lw-telegram-left-stack > .conversation-session-list {
  width: 100%;
  min-width: 0;
  height: auto;
  min-height: 0;
  flex: 1 1 0;
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
