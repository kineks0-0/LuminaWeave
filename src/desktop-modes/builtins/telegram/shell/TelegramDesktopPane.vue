<template>
  <div
    class="lw-telegram-left-pane"
    :class="{ 'is-collapsed': collapsed, 'is-resizing': isLeftRailResizing }"
    :style="leftRailStyle"
    :inert="collapsed || undefined"
    :aria-hidden="collapsed ? 'true' : undefined"
  >
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
      <Transition name="lw-telegram-pane-swap" mode="out-in">
        <ThemedSurfaceOutlet
          v-if="leftRoute === 'conversationList'"
          key="conversationList"
          contract-id="conversation.sessionList"
          :input="{}"
          :desktop-mode-id="activeDesktopModeId"
        />
        <ThemedSurfaceOutlet
          v-else
          key="roleList"
          contract-id="character.roster"
          :input="{}"
          :desktop-mode-id="activeDesktopModeId"
        />
      </Transition>
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
import { computed } from 'vue';
import ThemedSurfaceOutlet from '../../../../platform/surface/ThemedSurfaceOutlet.vue';
import type { TelegramDesktopLeftRoute } from './types.js';
import { useTelegramLeftRailWidth } from './useTelegramLeftRailWidth.js';

const props = defineProps<{
  activeDesktopModeId: string;
  leftRoute: TelegramDesktopLeftRoute;
  collapsed: boolean;
  widgetWidth: number;
  onSetLeftRoute: (route: TelegramDesktopLeftRoute) => void;
}>();

const {
  leftRailStyle,
  isResizing: isLeftRailResizing,
  startResize: onLeftRailResizeStart
} = useTelegramLeftRailWidth(
  computed(() => props.widgetWidth),
  computed(() => props.collapsed)
);
</script>

<style>
.lw-telegram-left-pane {
  position: relative;
  flex: 0 0 auto;
  min-width: 260px;
  display: flex;
  align-self: stretch;
  min-height: 0;
  transition:
    width 260ms cubic-bezier(0.16, 1, 0.3, 1),
    min-width 260ms cubic-bezier(0.16, 1, 0.3, 1),
    max-width 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.lw-telegram-left-pane.is-resizing {
  transition: none;
}

.lw-telegram-left-pane.is-collapsed {
  pointer-events: none;
}

.lw-telegram-left-pane.is-collapsed .lw-telegram-left-stack {
  opacity: 0;
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
  transition: opacity 160ms cubic-bezier(0.16, 1, 0.3, 1);
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
  transition: background-color var(--lw-transition), color var(--lw-transition);
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

/* 会话 / 角色 切换：短交叉淡入，不做整页滑动 */
.lw-telegram-pane-swap-enter-active {
  transition: opacity 120ms cubic-bezier(0.16, 1, 0.3, 1);
}

.lw-telegram-pane-swap-leave-active {
  transition: opacity 100ms cubic-bezier(0.16, 1, 0.3, 1);
}

.lw-telegram-pane-swap-enter-from,
.lw-telegram-pane-swap-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lw-telegram-left-pane,
  .lw-telegram-left-stack,
  .lw-telegram-pane-swap-enter-active,
  .lw-telegram-pane-swap-leave-active {
    transition: none !important;
  }
}

[data-motion='none'] .lw-telegram-left-pane,
[data-motion='none'] .lw-telegram-left-stack,
[data-motion='none'] .lw-telegram-pane-swap-enter-active,
[data-motion='none'] .lw-telegram-pane-swap-leave-active {
  transition: none !important;
}
</style>
