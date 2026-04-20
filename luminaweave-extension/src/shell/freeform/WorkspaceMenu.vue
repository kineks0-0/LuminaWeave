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
  z-index: 20;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 22px;
  border: 1px solid var(--lw-shell-workspace-menu-border, rgba(255, 255, 255, 0.42));
  background: var(--lw-shell-workspace-menu-bg,
      linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(244, 248, 254, 0.34)));
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(24px) saturate(135%);
}

.lw-workspace-menu-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 4px 8px;
}

.lw-workspace-menu-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.lw-workspace-menu-copy strong {
  font-family: var(--lw-font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.lw-workspace-menu-copy span:last-child {
  font-size: 12px;
  color: var(--lw-text-secondary);
  line-height: 1.6;
}

.lw-workspace-menu-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
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
  border-color: rgba(var(--lw-primary-rgb), 0.2);
  background: var(--lw-shell-workspace-menu-item-active-bg, rgba(255, 255, 255, 0.4));
}

.lw-workspace-menu-item span {
  font-size: 13px;
  font-weight: 700;
}

.lw-workspace-menu-item small {
  font-size: 11px;
  color: var(--lw-text-secondary);
  line-height: 1.5;
}
</style>
