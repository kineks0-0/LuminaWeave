<template>
  <transition name="fade">
    <div
      v-if="show"
      class="lw-workspace-menu is-freeform"
      :data-skin-variant="variant || 'default'"
      :style="menuStyle"
    >
      <div class="lw-workspace-menu-copy">
        <span class="lw-workspace-menu-kicker">Desktop Mode</span>
        <strong>切换桌面模式</strong>
        <span>默认使用传统桌面。自由工作台采用 iPadOS 式窗口交互。</span>
      </div>

      <button
        v-for="desktopMode in desktopModes"
        :key="desktopMode.value"
        class="lw-workspace-menu-item"
        :class="{ active: activeDesktopModeId === desktopMode.value }"
        @click="emit('setDesktopMode', desktopMode.value)"
      >
        <span>{{ desktopMode.label }}</span>
        <small>{{ desktopMode.description }}</small>
      </button>

      <button class="lw-workspace-menu-item" @click="emit('createStageWithLauncher')">
        <span>新建舞台</span>
        <small>创建一个空舞台，并将启动台调度到前台。</small>
      </button>

      <button class="lw-workspace-menu-item" @click="emit('openWorkspaceSettings')">
        <span>打开设置窗口</span>
        <small>把设置窗口调到当前舞台的前台位置。</small>
      </button>
    </div>
  </transition>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';

defineProps<{
  show: boolean;
  variant: string;
  menuStyle: CSSProperties;
  activeDesktopModeId: string;
  desktopModes: Array<{ value: string; label: string; description?: string }>;
}>();

const emit = defineEmits<{
  (e: 'setDesktopMode', desktopModeId: string): void;
  (e: 'createStageWithLauncher'): void;
  (e: 'openWorkspaceSettings'): void;
}>();
</script>

<style>
.lw-workspace-menu {
  position: absolute;
  top: 22px;
  right: 20px;
  z-index: 6000;
  width: min(408px, calc(100% - 32px));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 24px;
  border: 1px solid var(--lw-shell-workspace-menu-border, color-mix(in srgb, var(--lw-border-base) 72%, white));
  background: var(--lw-shell-workspace-menu-bg,
      linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(245, 249, 255, 0.76)));
  box-shadow:
    0 18px 42px rgba(48, 73, 114, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(22px) saturate(128%);
}

.lw-workspace-menu-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 4px 8px;
}

.lw-workspace-menu-kicker {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.lw-workspace-menu-copy strong {
  font-family: var(--lw-font-display);
  font-size: var(--lw-type-title-medium-size);
  line-height: var(--lw-type-title-medium-line-height);
  font-weight: var(--lw-type-title-medium-weight);
  letter-spacing: var(--lw-type-title-medium-tracking);
  color: var(--lw-text-main);
}

.lw-workspace-menu-copy span:last-child {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-secondary);
}

.lw-workspace-menu-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  background: var(--lw-shell-workspace-menu-item-bg, rgba(255, 255, 255, 0.24));
  color: var(--lw-text-main);
  text-align: left;
  cursor: pointer;
  transition: var(--lw-transition);
}

.lw-workspace-menu-item:hover,
.lw-workspace-menu-item.active {
  border-color: rgba(var(--lw-primary-rgb), 0.16);
  background: var(--lw-shell-workspace-menu-item-active-bg,
      linear-gradient(180deg, rgba(255, 255, 255, 0.86), color-mix(in srgb, var(--lw-primary) 9%, white)));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 8px 18px rgba(53, 80, 125, 0.1);
}

.lw-workspace-menu-item span {
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  font-weight: var(--lw-type-label-large-weight);
  letter-spacing: var(--lw-type-label-large-tracking);
}

.lw-workspace-menu-item small {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-secondary);
}

@media (max-width: 768px) {
  .lw-workspace-menu {
    left: 16px;
    right: 16px;
    width: auto;
    max-height: calc(100% - 44px);
    overflow: auto;
    padding: 12px;
  }
}
</style>
