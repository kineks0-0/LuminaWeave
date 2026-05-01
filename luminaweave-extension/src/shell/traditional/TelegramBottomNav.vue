<template>
  <nav class="lw-telegram-bottom-nav" aria-label="Telegram desktop navigation">
    <button
      v-for="item in items"
      :key="item.id"
      class="lw-telegram-bottom-nav__item"
      :class="{ active: item.active }"
      type="button"
      @click="emit('select', item.id)"
    >
      <span class="lw-telegram-bottom-nav__icon" v-html="item.icon"></span>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  activeMainTab: string;
  characterSheetOpen: boolean;
  profilePanelOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', itemId: 'chat' | 'characters' | 'settings' | 'profile'): void;
}>();

const items = computed(() => [
  {
    id: 'chat' as const,
    label: '聊天',
    active: props.activeMainTab === 'lumina-chat' && !props.characterSheetOpen && !props.profilePanelOpen,
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path></svg>'
  },
  {
    id: 'characters' as const,
    label: '角色',
    active: props.characterSheetOpen,
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="8" r="4"></circle><path d="M4 22a8 8 0 0 1 16 0"></path></svg>'
  },
  {
    id: 'settings' as const,
    label: '设置',
    active: props.activeMainTab === 'lumina-settings' || props.activeMainTab === 'mobile-widget:lumina-settings',
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.22.65.22 1H21a2 2 0 1 1 0 4h-1.38c0 .35-.08.69-.22 1z"></path></svg>'
  },
  {
    id: 'profile' as const,
    label: '个人资料',
    active: props.profilePanelOpen,
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21a7.5 7.5 0 0 1 13 0"></path></svg>'
  }
]);
</script>

<style scoped>
.lw-telegram-bottom-nav {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(10px + var(--lw-safe-bottom, 0px));
  z-index: 28;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: 24px;
  background: var(--lw-surface-container-high);
  box-shadow: var(--lw-telegram-panel-shadow, 0 18px 38px rgba(44, 92, 130, 0.18));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
}

.lw-telegram-bottom-nav__item {
  min-width: 0;
  border: none;
  border-radius: 18px;
  padding: 8px 4px;
  background: transparent;
  color: var(--lw-text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 800;
}

.lw-telegram-bottom-nav__item.active,
.lw-telegram-bottom-nav__item:hover {
  background: color-mix(in srgb, var(--lw-primary) 14%, transparent);
  color: var(--lw-primary);
}

.lw-telegram-bottom-nav__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
