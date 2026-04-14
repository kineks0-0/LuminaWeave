<template>
  <div class="lw-workspace-dock">
    <button
      v-for="item in items"
      :key="item.id"
      class="dock-item"
      :class="{
        'is-active': item.isActive,
        'is-running': item.isRunning
      }"
      type="button"
      :aria-label="`打开 ${item.title}`"
      :title="item.title"
      @click="$emit('open', item.id)"
    >
      <span class="dock-icon" v-if="item.icon" v-html="item.icon" aria-hidden="true"></span>
      <span v-else class="dock-fallback" aria-hidden="true">{{ item.title.slice(0, 1) }}</span>
      <span class="dock-running-indicator" aria-hidden="true"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{
    id: string;
    title: string;
    icon: string;
    isRunning: boolean;
    isActive: boolean;
  }>;
}>();

defineEmits<{
  (e: 'open', id: string): void;
}>();
</script>

<style scoped>
.lw-workspace-dock {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 12;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 28px;
  border: 1px solid var(--lw-glass-border);
  background: var(--lw-glass-bg);
  box-shadow: 0 24px 48px var(--lw-glass-shadow);
  backdrop-filter: blur(26px) saturate(135%);
}

.dock-item {
  position: relative;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 18px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    background 160ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.dock-item:hover {
  transform: translateY(-3px);
  background: var(--lw-glass-bg-hover);
  box-shadow: 0 16px 24px var(--lw-glass-shadow);
}

.dock-item.is-active {
  background: var(--lw-glass-bg-hover);
  box-shadow: 0 14px 22px rgba(var(--lw-primary-rgb), 0.18);
}

.dock-icon,
.dock-fallback {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dock-fallback {
  font-family: var(--lw-font-display);
  font-size: 16px;
  font-weight: 700;
}

.dock-running-indicator {
  position: absolute;
  left: 50%;
  bottom: -8px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: transparent;
  transform: translateX(-50%);
  transition:
    width 160ms cubic-bezier(0.22, 1, 0.36, 1),
    background 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.dock-item.is-running .dock-running-indicator {
  width: 18px;
  background: color-mix(in srgb, var(--lw-text-main) 76%, white);
}

@media (max-width: 768px) {
  .lw-workspace-dock {
    left: 14px;
    right: 14px;
    bottom: 14px;
    transform: none;
    justify-content: center;
    gap: 8px;
    padding: 10px 12px;
  }

  .dock-item {
    width: 46px;
    height: 46px;
    border-radius: 16px;
  }
}
</style>
