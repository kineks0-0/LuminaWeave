<template>
  <aside
    class="lw-discord-guild-rail"
    :class="[
      { 'is-mobile': isMobile },
      isMobile ? `mobile-${placement || 'top'}` : ''
    ]"
    :data-skin-variant="guildVariant || 'default'"
    :style="guildStyle"
  >
    <div class="lw-discord-guild-rail__cluster">
      <button
        class="lw-discord-guild-rail__item lw-discord-guild-rail__item--home"
        :class="{ 'is-active': activeMainTab === 'lumina-launcher' }"
        type="button"
        title="启动台"
        @click="emit('switchMainView', 'lumina-launcher')"
      >
        <span class="lw-discord-guild-rail__glyph">LW</span>
      </button>
    </div>

    <div v-if="!isMobile" class="lw-discord-guild-rail__divider"></div>

    <div class="lw-discord-guild-rail__stack">
      <button
        v-for="item in items"
        :key="item.id"
        class="lw-discord-guild-rail__item"
        :class="{ 'is-active': activeMainTab === item.id }"
        type="button"
        :title="item.name"
        @click="emit('switchMainView', item.id)"
      >
        <span v-if="item.icon" class="lw-discord-guild-rail__icon" v-html="item.icon"></span>
        <span v-else class="lw-discord-guild-rail__glyph">{{ item.name.slice(0, 2).toUpperCase() }}</span>
      </button>
    </div>

    <div v-if="!isMobile" class="lw-discord-guild-rail__footer">
      <button class="lw-discord-guild-rail__item lw-discord-guild-rail__item--utility" type="button" title="设置" @click="emit('toggleSettings')">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
      <button class="lw-discord-guild-rail__item lw-discord-guild-rail__item--utility" type="button" title="关闭桌面" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import { useComponentSkin } from '../theme/useComponentSkin';

defineProps<{
  items: { id: string; name: string; icon?: string }[];
  activeMainTab: string;
  isMobile?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}>();

const emit = defineEmits<{
  (e: 'switchMainView', tabId: string): void;
  (e: 'toggleSettings'): void;
  (e: 'close'): void;
}>();

const { cssVars: guildSkinVars, variant: guildVariant } = useComponentSkin('shell.guildRail');
const guildStyle = computed<CSSProperties>(() => guildSkinVars.value as CSSProperties);
</script>

<style scoped>
.lw-discord-guild-rail {
  width: var(--lw-guild-rail-width, 74px);
  min-width: var(--lw-guild-rail-width, 74px);
  max-width: var(--lw-guild-rail-width, 74px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 12px 10px;
  border-right: 1px solid var(--lw-guild-rail-border, #121317);
  background: var(--lw-guild-rail-bg, #1b1d21);
}

.lw-discord-guild-rail__cluster,
.lw-discord-guild-rail__stack,
.lw-discord-guild-rail__footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.lw-discord-guild-rail__stack {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
}

.lw-discord-guild-rail__stack::-webkit-scrollbar {
  display: none;
}

.lw-discord-guild-rail__divider {
  width: 38px;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-guild-rail-border, #121317) 80%, white 10%);
}

.lw-discord-guild-rail__item {
  position: relative;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 18px;
  background: var(--lw-guild-rail-item-bg, #2b2d31);
  color: var(--lw-guild-rail-item-color, #b5bac1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background 180ms cubic-bezier(0.22, 1, 0.36, 1),
    color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lw-discord-guild-rail__item::before {
  content: '';
  position: absolute;
  left: -10px;
  width: 4px;
  height: 10px;
  border-radius: 999px;
  background: var(--lw-primary);
  opacity: 0;
  transform: scaleY(0.4);
  transition:
    opacity 160ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    height 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lw-discord-guild-rail__item:hover,
.lw-discord-guild-rail__item.is-active {
  transform: translateY(-1px);
  border-radius: 15px;
  background: var(--lw-guild-rail-item-active-bg, #5865f2);
  color: var(--lw-text-main);
}

.lw-discord-guild-rail__item:hover::before,
.lw-discord-guild-rail__item.is-active::before {
  opacity: 1;
  transform: scaleY(1);
  height: 24px;
}

.lw-discord-guild-rail__item--home {
  background: color-mix(in srgb, var(--lw-primary) 34%, var(--lw-guild-rail-bg, var(--lw-bg-app)));
  color: var(--lw-text-main);
}

.lw-discord-guild-rail__item--utility {
  width: 44px;
  height: 44px;
  border-radius: 14px;
}

.lw-discord-guild-rail__icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.lw-discord-guild-rail__glyph {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.lw-discord-guild-rail.is-mobile {
  width: 100%;
  min-width: 0;
  max-width: none;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-right: none;
  overflow: hidden;
}

.lw-discord-guild-rail.is-mobile .lw-discord-guild-rail__cluster,
.lw-discord-guild-rail.is-mobile .lw-discord-guild-rail__stack {
  width: auto;
  flex-direction: row;
  align-items: center;
}

.lw-discord-guild-rail.is-mobile .lw-discord-guild-rail__stack {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  justify-content: flex-start;
  padding-bottom: 2px;
}

.lw-discord-guild-rail.is-mobile .lw-discord-guild-rail__item {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 16px;
}

.lw-discord-guild-rail.is-mobile .lw-discord-guild-rail__item::before {
  left: 50%;
  bottom: -7px;
  top: auto;
  width: 18px;
  height: 4px;
  transform: translateX(-50%) scaleX(0.4);
}

.lw-discord-guild-rail.is-mobile .lw-discord-guild-rail__item:hover,
.lw-discord-guild-rail.is-mobile .lw-discord-guild-rail__item.is-active {
  transform: translateY(-1px);
}

.lw-discord-guild-rail.is-mobile .lw-discord-guild-rail__item:hover::before,
.lw-discord-guild-rail.is-mobile .lw-discord-guild-rail__item.is-active::before {
  height: 4px;
  transform: translateX(-50%) scaleX(1);
}

.lw-discord-guild-rail.is-mobile.mobile-left,
.lw-discord-guild-rail.is-mobile.mobile-right {
  width: 64px;
  min-width: 64px;
  height: 100%;
  flex-direction: column;
  justify-content: flex-start;
  padding: 12px 8px;
}

.lw-discord-guild-rail.is-mobile.mobile-left .lw-discord-guild-rail__cluster,
.lw-discord-guild-rail.is-mobile.mobile-left .lw-discord-guild-rail__stack,
.lw-discord-guild-rail.is-mobile.mobile-right .lw-discord-guild-rail__cluster,
.lw-discord-guild-rail.is-mobile.mobile-right .lw-discord-guild-rail__stack {
  width: 100%;
  flex-direction: column;
}

.lw-discord-guild-rail.is-mobile.mobile-left .lw-discord-guild-rail__stack,
.lw-discord-guild-rail.is-mobile.mobile-right .lw-discord-guild-rail__stack {
  overflow-x: hidden;
  overflow-y: auto;
  padding-bottom: 0;
}

.lw-discord-guild-rail.is-mobile.mobile-left .lw-discord-guild-rail__item,
.lw-discord-guild-rail.is-mobile.mobile-right .lw-discord-guild-rail__item {
  width: 44px;
  height: 44px;
}

.lw-discord-guild-rail.is-mobile.mobile-left .lw-discord-guild-rail__item::before,
.lw-discord-guild-rail.is-mobile.mobile-right .lw-discord-guild-rail__item::before {
  left: -8px;
  top: 50%;
  bottom: auto;
  width: 4px;
  height: 16px;
  transform: translateY(-50%) scaleY(0.4);
}

.lw-discord-guild-rail.is-mobile.mobile-left .lw-discord-guild-rail__item:hover::before,
.lw-discord-guild-rail.is-mobile.mobile-left .lw-discord-guild-rail__item.is-active::before,
.lw-discord-guild-rail.is-mobile.mobile-right .lw-discord-guild-rail__item:hover::before,
.lw-discord-guild-rail.is-mobile.mobile-right .lw-discord-guild-rail__item.is-active::before {
  height: 22px;
  transform: translateY(-50%) scaleY(1);
}
</style>
