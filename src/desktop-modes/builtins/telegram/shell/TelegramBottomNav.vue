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
          :is="item.active ? item.filledIcon : item.icon"
          v-else
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
import { getTelegramAvatarStyle, hideBrokenTelegramAvatar } from './telegramVisual.js';
import { getTelegramMaterialIconComponent } from './telegramMaterialIcons.js';
import { isPlaceholderTelegramAvatar } from '../../../../plugins/chat/presentation/telegramChatList.js';

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
const userAvatar = computed(() => (
  isPlaceholderTelegramAvatar(rawUserAvatar.value, lwApi?.DEFAULT_AVATAR) ? '' : rawUserAvatar.value
));
const avatarStyle = computed(() => getTelegramAvatarStyle(userName.value));

const items = computed(() => [
  {
    id: 'chat' as const,
    label: '聊天',
    active: props.activeMainTab === 'lumina-chat' && !props.characterSheetOpen && !props.settingsPanelOpen && !props.profilePanelOpen,
    icon: getTelegramMaterialIconComponent('chat', 'outlined'),
    filledIcon: getTelegramMaterialIconComponent('chat', 'filled')
  },
  {
    id: 'characters' as const,
    label: '联系人',
    active: props.characterSheetOpen,
    icon: getTelegramMaterialIconComponent('contacts', 'outlined'),
    filledIcon: getTelegramMaterialIconComponent('contacts', 'filled')
  },
  {
    id: 'settings' as const,
    label: '设置',
    active: props.settingsPanelOpen || props.activeMainTab === 'lumina-settings' || props.activeMainTab === 'mobile-widget:lumina-settings',
    icon: getTelegramMaterialIconComponent('settings', 'outlined'),
    filledIcon: getTelegramMaterialIconComponent('settings', 'filled')
  },
  {
    id: 'profile' as const,
    label: '个人资料',
    active: props.profilePanelOpen,
    icon: getTelegramMaterialIconComponent('user', 'outlined'),
    filledIcon: getTelegramMaterialIconComponent('user', 'filled')
  }
]);
</script>

<style scoped>
.lw-telegram-bottom-nav {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: calc(10px + var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px)));
  z-index: 28;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px;
  padding: 6px;
  border: 0.5px solid var(--lw-telegram-tab-rim, color-mix(in srgb, var(--lw-border-base) 42%, transparent));
  border-radius: 999px;
  background: var(--lw-telegram-tab-bg, color-mix(in srgb, var(--lw-surface-container-high) 78%, transparent));
  box-shadow: inset 0 1px 0 var(--lw-telegram-glass-highlight, transparent);
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
}

.lw-telegram-bottom-nav__item {
  min-width: 0;
  border: none;
  border-radius: 999px;
  padding: 6px 2px;
  background: transparent;
  color: var(--lw-text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: background-color var(--lw-transition), color var(--lw-transition);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: 500;
  letter-spacing: var(--lw-type-label-medium-tracking);
}

.lw-telegram-bottom-nav__item.active,
.lw-telegram-bottom-nav__item:hover {
  background: var(--lw-telegram-active-pill, color-mix(in srgb, var(--lw-primary) 17%, transparent));
  color: var(--lw-primary);
  font-weight: 600;
  box-shadow: none;
}

.lw-telegram-bottom-nav__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
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
