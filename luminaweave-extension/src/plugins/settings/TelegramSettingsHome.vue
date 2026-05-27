<template>
  <section
    class="lw-telegram-settings-home tw:flex tw:min-h-full tw:flex-col tw:gap-4 tw:px-3.5 tw:pb-[calc(98px+var(--lw-content-safe-bottom,var(--lw-safe-bottom,0px)))] tw:pt-[calc(24px+var(--lw-content-safe-top,var(--lw-safe-top,0px)))] tw:text-lw-text"
    aria-label="Telegram settings"
  >
    <header class="lw-telegram-settings-home__hero tw:flex tw:flex-col tw:items-center tw:gap-2.5 tw:px-0 tw:pb-3.5 tw:pt-2.5 tw:text-center">
      <span
        class="lw-telegram-settings-home__avatar tw:inline-flex tw:size-[88px] tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-full tw:text-[#f7fbff]"
        :style="userAvatarStyle"
      >
        <img v-if="userAvatar" :src="userAvatar" :alt="userName" @error="hideBrokenTelegramAvatar">
        <span v-else>{{ userInitial }}</span>
      </span>
      <div class="tw:min-w-0">
        <h2>{{ userName }}</h2>
        <p>插件设置与桌面模式</p>
      </div>
    </header>

    <section v-if="activeThemeEntry" class="lw-telegram-settings-home__group tw:flex tw:flex-col tw:gap-0.5 tw:rounded-[22px] tw:py-2">
      <button
        type="button"
        class="lw-telegram-settings-home__row tw:grid tw:min-h-[58px] tw:w-full tw:grid-cols-[auto_1fr_auto] tw:items-center tw:gap-3 tw:border-0 tw:bg-transparent tw:px-3.5 tw:py-2 tw:text-left tw:text-lw-text"
        @click="emit('openDetail', activeThemeEntry.pluginId)"
      >
        <span class="lw-telegram-settings-home__icon tw:inline-flex tw:size-[38px] tw:items-center tw:justify-center tw:rounded-[13px] tw:text-[#f7fbff]" :data-tone="getTelegramSettingsIconTone(activeThemeEntry.pluginId)">
          <component
            :is="getTelegramIconComponent(getTelegramSettingsIconName(activeThemeEntry.pluginId))"
            :size="24"
            :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
            aria-hidden="true"
          />
        </span>
        <span class="lw-telegram-settings-home__copy tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
          <strong>{{ activeThemeEntry.pluginName }}</strong>
          <small>当前桌面模式外观、导航与聊天呈现</small>
        </span>
        <component :is="getTelegramIconComponent('chevronRight')" :size="20" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
      </button>
    </section>

    <section class="lw-telegram-settings-home__group tw:flex tw:flex-col tw:gap-0.5 tw:rounded-[22px] tw:py-2">
      <button
        v-for="entry in pluginEntries"
        :key="entry.pluginId"
        type="button"
        class="lw-telegram-settings-home__row tw:grid tw:min-h-[58px] tw:w-full tw:grid-cols-[auto_1fr_auto] tw:items-center tw:gap-3 tw:border-0 tw:bg-transparent tw:px-3.5 tw:py-2 tw:text-left tw:text-lw-text"
        @click="emit('openDetail', entry.pluginId)"
      >
        <span class="lw-telegram-settings-home__icon tw:inline-flex tw:size-[38px] tw:items-center tw:justify-center tw:rounded-[13px] tw:text-[#f7fbff]" :data-tone="getTelegramSettingsIconTone(entry.pluginId)">
          <component
            :is="getTelegramIconComponent(getTelegramSettingsIconName(entry.pluginId))"
            :size="24"
            :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
            aria-hidden="true"
          />
        </span>
        <span class="lw-telegram-settings-home__copy tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
          <strong>{{ entry.pluginName }}</strong>
          <small>{{ getEntryDescription(entry) }}</small>
        </span>
        <component :is="getTelegramIconComponent('chevronRight')" :size="20" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
      </button>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getActiveDesktopModeIdFromSettings } from '../../theme/themeRegistry.js';
import {
  TELEGRAM_ICON_STROKE_WIDTH,
  getTelegramAvatarStyle,
  getTelegramIconComponent,
  getTelegramInitial,
  getTelegramSettingsIconName,
  getTelegramSettingsIconTone,
  hideBrokenTelegramAvatar
} from '../../shell/traditional/telegramVisual.js';
import { activeSettings } from './useSettings.js';
import { getVisibleSettingsEntries, type SettingsSourceEntry } from './settingsRegistry.js';

const emit = defineEmits<{
  (e: 'openDetail', pluginId: string): void;
}>();

const userName = computed(() => (window as any).LuminaWeave?.getUserName?.() || 'User');
const rawUserAvatar = computed(() => (window as any).LuminaWeave?.getUserAvatar?.() || '');
const userAvatar = computed(() => rawUserAvatar.value);
const userInitial = computed(() => getTelegramInitial(userName.value));
const userAvatarStyle = computed(() => getTelegramAvatarStyle(userName.value));
const activeThemeId = computed(() => getActiveDesktopModeIdFromSettings(activeSettings));
const entries = computed(() => getVisibleSettingsEntries(activeThemeId.value));
const activeThemeEntry = computed(() => entries.value.find((entry) => entry.kind === 'desktop-mode') || null);
const pluginEntries = computed(() => entries.value.filter((entry) => entry.kind === 'plugin'));

const getEntryDescription = (entry: SettingsSourceEntry) => {
  const settingCount = Object.keys(entry.manifest || {}).length;
  return `${settingCount} 项真实设置`;
};
</script>

<style scoped>
.lw-telegram-settings-home__avatar {
  background: var(--lw-telegram-avatar-bg);
  font-size: var(--lw-type-headline-large-size);
  line-height: var(--lw-type-headline-large-line-height);
  font-weight: var(--lw-type-headline-large-weight);
  letter-spacing: var(--lw-type-headline-large-tracking);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2);
}

.lw-telegram-settings-home__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lw-telegram-settings-home__hero h2,
.lw-telegram-settings-home__hero p {
  margin: 0;
}

.lw-telegram-settings-home__hero h2 {
  font-size: 24px;
  line-height: 30px;
  font-weight: 700;
  letter-spacing: 0;
}

.lw-telegram-settings-home__hero p {
  color: var(--lw-text-secondary);
  font-size: 13px;
  line-height: 19px;
  font-weight: 450;
  letter-spacing: 0;
}

.lw-telegram-settings-home__group {
  background: var(--lw-telegram-glass-bg, color-mix(in srgb, var(--lw-surface-container-highest) 60%, transparent));
  box-shadow: none;
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
}

.lw-telegram-settings-home__row:hover {
  background: color-mix(in srgb, var(--lw-primary) 9%, transparent);
}

.lw-telegram-settings-home__icon {
  background: linear-gradient(135deg, #4aa3ff, #257de0);
}

.lw-telegram-settings-home__icon[data-tone='green'] {
  background: linear-gradient(135deg, #67d15c, #30a942);
}

.lw-telegram-settings-home__icon[data-tone='orange'] {
  background: linear-gradient(135deg, #f3b65d, #df7835);
}

.lw-telegram-settings-home__icon[data-tone='violet'] {
  background: linear-gradient(135deg, #9a7cff, #6a54dd);
}

.lw-telegram-settings-home__icon[data-tone='cyan'] {
  background: linear-gradient(135deg, #54c7d5, #2588a7);
}

.lw-telegram-settings-home__icon[data-tone='red'] {
  background: linear-gradient(135deg, #ef6570, #c94157);
}

.lw-telegram-settings-home__copy strong,
.lw-telegram-settings-home__copy small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lw-telegram-settings-home__copy strong {
  font-size: 16px;
  line-height: 22px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-telegram-settings-home__copy small {
  color: var(--lw-text-secondary);
  font-size: 13px;
  line-height: 18px;
  font-weight: 450;
  letter-spacing: 0;
}
</style>
