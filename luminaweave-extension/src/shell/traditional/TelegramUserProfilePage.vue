<template>
  <section class="lw-telegram-user-profile" aria-label="Telegram user profile">
    <header class="lw-telegram-user-profile__hero">
      <div class="lw-telegram-user-profile__avatar-wrap">
        <span class="lw-telegram-user-profile__avatar" :style="userAvatarStyle">
          <img
            v-if="userAvatar"
            :src="userAvatar"
            :alt="userName"
            @error="hideBrokenTelegramAvatar"
          >
          <span v-else>{{ userInitial }}</span>
        </span>
        <button
          class="lw-telegram-user-profile__menu-trigger"
          type="button"
          title="桌面菜单"
          :aria-expanded="isMenuOpen"
          @click="isMenuOpen = !isMenuOpen"
        >
          <component
            :is="getTelegramIconComponent('more')"
            :size="18"
            :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
            aria-hidden="true"
          />
        </button>

        <div v-if="isMenuOpen" class="lw-telegram-user-profile__menu">
          <button type="button" @click="menuView = menuView === 'desktopModes' ? 'root' : 'desktopModes'">
            <span>桌面模式</span>
            <strong>{{ activeDesktopModeLabel }}</strong>
          </button>
          <template v-if="menuView === 'desktopModes'">
            <button
              v-for="mode in desktopModes"
              :key="mode.value"
              type="button"
              :class="{ active: activeDesktopModeId === mode.value }"
              @click="selectDesktopMode(mode.value)"
            >
              <span>{{ mode.label }}</span>
              <strong>{{ mode.description || '切换到该模式' }}</strong>
            </button>
          </template>
          <button type="button" @click="emit('openSettings')">
            <span>设置</span>
            <strong>打开设置页</strong>
          </button>
          <button type="button" class="is-danger" @click="emit('close')">
            <span>关闭</span>
            <strong>返回宿主界面</strong>
          </button>
        </div>
      </div>

      <div class="lw-telegram-user-profile__identity">
        <h2>{{ userName }}</h2>
        <span>在线</span>
      </div>
    </header>

    <div class="lw-telegram-user-profile__actions" aria-label="个人资料操作">
      <button type="button" @click="emit('openSettings')">
        <component :is="getTelegramIconComponent('settings')" :size="26" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
        <span>设置</span>
      </button>
      <button type="button" @click="activeTab = 'panels'">
        <component :is="getTelegramIconComponent('panels')" :size="26" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
        <span>小窗面板</span>
      </button>
      <button type="button" @click="isMenuOpen = true">
        <component :is="getTelegramIconComponent('desktop')" :size="26" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
        <span>桌面模式</span>
      </button>
    </div>

    <nav class="lw-telegram-user-profile__tabs" aria-label="个人资料分区">
      <button type="button" :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">个人设定</button>
      <button type="button" :class="{ active: activeTab === 'panels' }" @click="activeTab = 'panels'">小窗面板</button>
      <button type="button" :class="{ active: activeTab === 'desktop' }" @click="activeTab = 'desktop'">桌面模式</button>
    </nav>

    <section v-if="activeTab === 'profile'" class="lw-telegram-user-profile__section">
      <h3>当前设定</h3>
      <div class="lw-telegram-user-profile__setting-row">
        <span>用户名</span>
        <strong>{{ userName }}</strong>
      </div>
      <div class="lw-telegram-user-profile__setting-row">
        <span>头像来源</span>
        <strong>{{ userAvatar ? 'SillyTavern Persona' : '默认头像' }}</strong>
      </div>
      <p>后续多用户设定切换会在这里接入；当前版本只展示当前用户设定。</p>
    </section>

    <section v-else-if="activeTab === 'panels'" class="lw-telegram-user-profile__section">
      <h3>小窗面板</h3>
      <button
        v-for="item in panelItems"
        :key="item.id"
        class="lw-telegram-user-profile__panel-row"
        type="button"
        @click="emit('openPanel', item.id)"
      >
        <span>
          <component
            :is="getTelegramIconComponent(getTelegramToolIconName(item.id))"
            :size="20"
            :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
            aria-hidden="true"
          />
        </span>
        <strong>{{ item.name }}</strong>
        <small>打开</small>
      </button>
      <p v-if="panelItems.length === 0">当前没有可打开的小窗面板。</p>
    </section>

    <section v-else class="lw-telegram-user-profile__section">
      <h3>桌面模式</h3>
      <button
        v-for="mode in desktopModes"
        :key="mode.value"
        class="lw-telegram-user-profile__panel-row"
        type="button"
        :class="{ active: activeDesktopModeId === mode.value }"
        @click="selectDesktopMode(mode.value)"
      >
        <span>
          <component
            :is="getTelegramIconComponent('desktop')"
            :size="20"
            :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
            aria-hidden="true"
          />
        </span>
        <strong>{{ mode.label }}</strong>
        <small>{{ activeDesktopModeId === mode.value ? '当前' : '切换' }}</small>
      </button>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { WidgetPanelGroup } from '../types.js';
import {
  TELEGRAM_ICON_STROKE_WIDTH,
  getTelegramAvatarStyle,
  getTelegramIconComponent,
  getTelegramInitial,
  getTelegramToolIconName,
  hideBrokenTelegramAvatar
} from './telegramVisual.js';

const props = defineProps<{
  desktopModes: Array<{ value: string; label: string; description?: string }>;
  activeDesktopModeId: string;
  widgetGroups: WidgetPanelGroup[];
}>();

const emit = defineEmits<{
  (e: 'setDesktopMode', modeId: string): void;
  (e: 'openSettings'): void;
  (e: 'openPanel', panelId: string): void;
  (e: 'close'): void;
}>();

const activeTab = ref<'profile' | 'panels' | 'desktop'>('profile');
const isMenuOpen = ref(false);
const menuView = ref<'root' | 'desktopModes'>('root');

const userName = computed(() => (window as any).LuminaWeave?.getUserName?.() || 'User');
const rawUserAvatar = computed(() => (window as any).LuminaWeave?.getUserAvatar?.() || '');
const userAvatar = computed(() => rawUserAvatar.value);
const userInitial = computed(() => getTelegramInitial(userName.value));
const userAvatarStyle = computed(() => getTelegramAvatarStyle(userName.value));
const panelItems = computed(() => props.widgetGroups.flatMap((group) => group.items));
const activeDesktopModeLabel = computed(() => (
  props.desktopModes.find((mode) => mode.value === props.activeDesktopModeId)?.label || '桌面模式'
));

const selectDesktopMode = (modeId: string) => {
  isMenuOpen.value = false;
  menuView.value = 'root';
  emit('setDesktopMode', modeId);
};

</script>

<style scoped>
.lw-telegram-user-profile {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: auto;
  padding: calc(34px + var(--lw-safe-top, 0px)) 20px calc(98px + var(--lw-safe-bottom, 0px));
  color: var(--lw-text-main);
  background: var(--lw-telegram-conversation-bg, transparent);
}

.lw-telegram-user-profile__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.lw-telegram-user-profile__avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.lw-telegram-user-profile__avatar {
  width: 104px;
  height: 104px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 3px solid color-mix(in srgb, var(--lw-surface-container-highest) 92%, transparent);
  background: var(--lw-telegram-avatar-bg, color-mix(in srgb, var(--lw-primary) 18%, var(--lw-surface-container-high)));
  color: var(--lw-text-main);
  font-size: var(--lw-type-headline-large-size);
  line-height: var(--lw-type-headline-large-line-height);
  font-weight: var(--lw-type-headline-large-weight);
  letter-spacing: var(--lw-type-headline-large-tracking);
  box-shadow: 0 18px 34px rgba(44, 92, 130, 0.16);
}

.lw-telegram-user-profile__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lw-telegram-user-profile__menu-trigger {
  position: absolute;
  right: -2px;
  top: 2px;
  width: 32px;
  height: 32px;
  border: 2px solid color-mix(in srgb, var(--lw-bg-app) 86%, transparent);
  border-radius: 999px;
  background: var(--lw-primary);
  color: #f7fbff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lw-telegram-user-profile__menu {
  position: absolute;
  top: 40px;
  left: 52px;
  z-index: 15;
  width: min(280px, calc(100vw - 40px));
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 0;
  border-radius: 22px;
  background: var(--lw-telegram-glass-bg-strong, color-mix(in srgb, var(--lw-surface-container-highest) 92%, transparent));
  box-shadow: var(--lw-telegram-panel-shadow, 0 20px 42px rgba(44, 92, 130, 0.16));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
}

.lw-telegram-user-profile__menu button {
  min-height: 46px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: var(--lw-text-main);
  padding: 8px 10px;
  text-align: left;
}

.lw-telegram-user-profile__menu button:hover,
.lw-telegram-user-profile__menu button.active {
  background: color-mix(in srgb, var(--lw-primary) 10%, transparent);
}

.lw-telegram-user-profile__menu button.is-danger {
  color: #d64242;
}

.lw-telegram-user-profile__menu span,
.lw-telegram-user-profile__identity span {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
}

.lw-telegram-user-profile__menu strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-telegram-user-profile__identity {
  min-width: 0;
}

.lw-telegram-user-profile__identity h2 {
  margin: 4px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 24px;
  line-height: 30px;
  font-weight: 700;
  letter-spacing: 0;
}

.lw-telegram-user-profile__identity span {
  font-size: 14px;
  line-height: 20px;
  font-weight: 450;
  letter-spacing: 0;
}

.lw-telegram-user-profile__actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.lw-telegram-user-profile__actions button {
  min-height: 62px;
  border: 0;
  border-radius: 18px;
  background: var(--lw-telegram-glass-bg, color-mix(in srgb, var(--lw-surface-container-highest) 58%, transparent));
  color: var(--lw-text-main);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: none;
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  font-size: 13px;
  line-height: 18px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-telegram-user-profile__tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: max-content;
  max-width: 100%;
  align-self: center;
  gap: 0;
  padding: 5px;
  border: 0.5px solid var(--lw-telegram-tab-rim, color-mix(in srgb, var(--lw-border-base) 42%, transparent));
  border-radius: 999px;
  background: var(--lw-telegram-tab-bg, color-mix(in srgb, var(--lw-surface-container-highest) 52%, transparent));
  box-shadow: none;
}

.lw-telegram-user-profile__tabs button {
  min-height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-secondary);
  font-size: 13px;
  line-height: 18px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-telegram-user-profile__tabs button.active {
  color: var(--lw-primary);
  background: var(--lw-telegram-active-pill, color-mix(in srgb, var(--lw-primary) 16%, transparent));
  box-shadow: none;
}

.lw-telegram-user-profile__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lw-telegram-user-profile__section h3 {
  margin: 0;
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
  letter-spacing: 0;
}

.lw-telegram-user-profile__section p {
  margin: 0;
  color: var(--lw-text-secondary);
  font-size: 13px;
  line-height: 19px;
  font-weight: var(--lw-type-body-medium-weight);
  letter-spacing: var(--lw-type-body-medium-tracking);
}

.lw-telegram-user-profile__setting-row,
.lw-telegram-user-profile__panel-row {
  min-height: 46px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border: 0;
  border-radius: 18px;
  background: var(--lw-telegram-glass-bg, color-mix(in srgb, var(--lw-surface-container-highest) 58%, transparent));
  color: var(--lw-text-main);
  box-shadow: none;
}

.lw-telegram-user-profile__setting-row span,
.lw-telegram-user-profile__panel-row small {
  color: var(--lw-text-secondary);
  font-size: 12px;
  line-height: 17px;
  font-weight: 450;
  letter-spacing: 0;
}

.lw-telegram-user-profile__setting-row strong,
.lw-telegram-user-profile__panel-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-telegram-user-profile__panel-row {
  grid-template-columns: auto minmax(0, 1fr) auto;
  border: none;
  text-align: left;
}

.lw-telegram-user-profile__panel-row.active {
  color: var(--lw-primary);
}

.lw-telegram-user-profile__panel-row > span {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--lw-primary);
  background: color-mix(in srgb, var(--lw-primary) 12%, transparent);
}
</style>
