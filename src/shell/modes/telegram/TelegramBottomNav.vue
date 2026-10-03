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
      <span class="lw-telegram-bottom-nav__icon">
        <span
          v-if="item.id === 'profile' && userAvatar"
          class="lw-telegram-bottom-nav__avatar"
          :style="avatarStyle"
        >
          <img :src="userAvatar" :alt="userName" @error="hideBrokenTelegramAvatar">
        </span>
        <component
          :is="item.icon"
          v-else
          :size="24"
          :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
          aria-hidden="true"
        />
      </span>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { LuminaWeaveAPI } from '@/api';
import {
  TELEGRAM_ICON_STROKE_WIDTH,
  getTelegramAvatarStyle,
  getTelegramIconComponent,
  hideBrokenTelegramAvatar
} from './telegramVisual.js';

const props = defineProps<{
  activeMainTab: string;
  characterSheetOpen: boolean;
  settingsPanelOpen: boolean;
  profilePanelOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', itemId: 'chat' | 'characters' | 'settings' | 'profile'): void;
}>();

const lwApi = inject<LuminaWeaveAPI>('lwApi');
const userName = computed(() => lwApi?.getUserName?.() || 'User');
const rawUserAvatar = computed(() => lwApi?.getUserAvatar?.() || '');
const userAvatar = computed(() => rawUserAvatar.value);
const avatarStyle = computed(() => getTelegramAvatarStyle(userName.value));

const items = computed(() => [
  {
    id: 'chat' as const,
    label: '聊天',
    active: props.activeMainTab === 'lumina-chat' && !props.characterSheetOpen && !props.settingsPanelOpen && !props.profilePanelOpen,
    icon: getTelegramIconComponent('chat')
  },
  {
    id: 'characters' as const,
    label: '联系人',
    active: props.characterSheetOpen,
    icon: getTelegramIconComponent('contacts')
  },
  {
    id: 'settings' as const,
    label: '设置',
    active: props.settingsPanelOpen || props.activeMainTab === 'lumina-settings' || props.activeMainTab === 'mobile-widget:lumina-settings',
    icon: getTelegramIconComponent('settings')
  },
  {
    id: 'profile' as const,
    label: '个人资料',
    active: props.profilePanelOpen,
    icon: getTelegramIconComponent('user')
  }
]);
</script>

<style scoped>
.lw-telegram-bottom-nav {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(10px + var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px)));
  z-index: 28;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 8px;
  border: 0.5px solid var(--lw-telegram-tab-rim, color-mix(in srgb, var(--lw-border-base) 42%, transparent));
  border-radius: 24px;
  background: var(--lw-telegram-tab-bg, color-mix(in srgb, var(--lw-surface-container-high) 78%, transparent));
  box-shadow: none;
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
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
}

.lw-telegram-bottom-nav__item.active,
.lw-telegram-bottom-nav__item:hover {
  background: var(--lw-telegram-active-pill, color-mix(in srgb, var(--lw-primary) 17%, transparent));
  color: var(--lw-primary);
  box-shadow: none;
}

.lw-telegram-bottom-nav__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 25px;
}

.lw-telegram-bottom-nav__avatar {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--lw-telegram-avatar-bg);
  box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 18%, transparent);
}

.lw-telegram-bottom-nav__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
