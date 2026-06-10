<template>
  <section class="lw-telegram-role-list" aria-label="Telegram contacts list">
    <header class="lw-telegram-role-list__header">
      <h2>联系人</h2>
      <button type="button" title="排序与筛选">
        <component
          :is="getTelegramIconComponent('filter')"
          :size="24"
          :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
          aria-hidden="true"
        />
      </button>
    </header>

    <div class="lw-telegram-role-list__controls">
      <label>
        <component
          :is="getTelegramIconComponent('search')"
          :size="24"
          :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
          aria-hidden="true"
        />
        <input v-model="searchQuery" type="search" placeholder="搜索联系人">
      </label>
      <div class="lw-telegram-role-list__sort" aria-label="角色排序">
        <button type="button" :class="{ active: sortMode === 'recent' }" @click="sortMode = 'recent'">最近</button>
        <button type="button" :class="{ active: sortMode === 'name' }" @click="sortMode = 'name'">名称</button>
        <button type="button" :class="{ active: sortMode === 'sessions' }" @click="sortMode = 'sessions'">会话</button>
      </div>
    </div>

    <div v-if="displayedGroups.length > 0" class="lw-telegram-role-list__items">
      <button
        v-for="group in displayedGroups"
        :key="group.key"
        type="button"
        class="lw-telegram-role-list__item"
        @click="emit('selectRole', group.key)"
      >
        <span class="lw-telegram-role-list__avatar">
          <img v-if="group.characterAvatarUrl" :src="group.characterAvatarUrl" :alt="group.characterName" @error="hideBrokenTelegramAvatar">
          <span v-else :style="getTelegramAvatarStyle(group.characterName)">{{ getTelegramInitial(group.characterName) }}</span>
        </span>
        <span class="lw-telegram-role-list__copy">
          <strong>{{ group.characterName }}</strong>
          <small>{{ group.recentPreview || '暂无最近摘要' }}</small>
        </span>
        <span class="lw-telegram-role-list__meta">
          <strong>{{ group.sessions.length }}</strong>
          <small>会话</small>
        </span>
      </button>
    </div>

    <p v-else class="lw-telegram-role-list__empty">没有匹配的联系人。</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CharacterChannelGroup, CharacterChannelState } from '../../../types/ConversationContextTypes.js';
import {
  TELEGRAM_ICON_STROKE_WIDTH,
  getTelegramAvatarStyle,
  getTelegramIconComponent,
  getTelegramInitial,
  hideBrokenTelegramAvatar
} from './telegramVisual.js';

const props = defineProps<{
  state: CharacterChannelState;
}>();

const emit = defineEmits<{
  (e: 'selectRole', groupKey: string): void;
}>();

const searchQuery = ref('');
const sortMode = ref<'recent' | 'name' | 'sessions'>('recent');

const filteredGroups = computed<CharacterChannelGroup[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return [...props.state.characterGroups];
  }
  return props.state.characterGroups.filter((group) => (
    `${group.characterName}\n${group.recentPreview}`.toLowerCase().includes(query)
  ));
});

const displayedGroups = computed<CharacterChannelGroup[]>(() => {
  const groups = [...filteredGroups.value];
  if (sortMode.value === 'name') {
    return groups.sort((left, right) => left.characterName.localeCompare(right.characterName));
  }
  if (sortMode.value === 'sessions') {
    return groups.sort((left, right) => right.sessions.length - left.sessions.length);
  }
  return groups.sort((left, right) => (right.recentSession?.updatedAt || 0) - (left.recentSession?.updatedAt || 0));
});
</script>

<style scoped>
.lw-telegram-role-list {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: calc(18px + var(--lw-content-safe-top, var(--lw-safe-top, 0px))) 14px 18px;
  color: var(--lw-text-main);
  overflow: hidden;
}

.lw-telegram-role-list__header {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.lw-telegram-role-list__header h2 {
  margin: 0;
  font-size: var(--lw-type-headline-small-size);
  line-height: var(--lw-type-headline-small-line-height);
  font-weight: 700;
  letter-spacing: var(--lw-type-headline-small-tracking);
}

.lw-telegram-role-list__header button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lw-telegram-role-list__controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lw-telegram-role-list__controls label {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: var(--lw-telegram-glass-bg, color-mix(in srgb, var(--lw-surface-container-highest) 58%, transparent));
  box-shadow: none;
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  color: var(--lw-text-muted);
}

.lw-telegram-role-list__controls input {
  min-width: 0;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--lw-text-main);
  font: inherit;
}

.lw-telegram-role-list__sort {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  padding: 5px;
  border: 0.5px solid var(--lw-telegram-tab-rim, color-mix(in srgb, var(--lw-border-base) 42%, transparent));
  border-radius: 999px;
  background: var(--lw-telegram-tab-bg, color-mix(in srgb, var(--lw-surface-container-highest) 48%, transparent));
  box-shadow: none;
}

.lw-telegram-role-list__sort button {
  min-height: 36px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 48%, transparent);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
}

.lw-telegram-role-list__sort button.active,
.lw-telegram-role-list__sort button:hover {
  background: var(--lw-telegram-active-pill, color-mix(in srgb, var(--lw-primary) 16%, transparent));
  color: var(--lw-primary);
}

.lw-telegram-role-list__items {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
}

.lw-telegram-role-list__item {
  width: 100%;
  min-height: 64px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 18px;
  background: transparent;
  color: var(--lw-text-main);
  text-align: left;
}

.lw-telegram-role-list__item:hover {
  background: color-mix(in srgb, var(--lw-primary) 10%, transparent);
}

.lw-telegram-role-list__avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid color-mix(in srgb, var(--lw-surface-container-highest) 92%, transparent);
  background: var(--lw-telegram-avatar-bg, color-mix(in srgb, var(--lw-primary) 18%, var(--lw-surface-container-high)));
  color: var(--lw-text-main);
  font-weight: var(--lw-type-title-medium-weight);
}

.lw-telegram-role-list__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lw-telegram-role-list__avatar > span {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--lw-telegram-avatar-bg);
}

.lw-telegram-role-list__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lw-telegram-role-list__copy strong,
.lw-telegram-role-list__copy small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lw-telegram-role-list__copy strong {
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
}

.lw-telegram-role-list__copy small,
.lw-telegram-role-list__meta small,
.lw-telegram-role-list__empty {
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-telegram-role-list__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.lw-telegram-role-list__meta strong {
  color: var(--lw-primary);
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  font-weight: var(--lw-type-label-large-weight);
  letter-spacing: var(--lw-type-label-large-tracking);
}

.lw-telegram-role-list__empty {
  margin: 0;
  padding: 18px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 58%, transparent);
}
</style>
