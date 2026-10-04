<template>
  <section class="telegram-contacts" :class="{ 'is-page': page }" aria-label="联系人">
    <header v-if="page" class="telegram-contacts__header">
      <template v-if="searching">
        <button type="button" class="telegram-contacts__icon" title="退出搜索" aria-label="退出搜索" @click="closeSearch">
          <ArrowLeft :size="24" />
        </button>
        <input
          ref="searchInput"
          v-model="query"
          class="telegram-contacts__header-search"
          type="search"
          placeholder="搜索联系人"
          aria-label="搜索联系人"
          @keydown.esc="closeSearch"
        >
      </template>
      <template v-else>
        <h2>联系人</h2>
        <button
          v-if="canImport"
          type="button"
          class="telegram-contacts__icon"
          title="导入角色卡"
          aria-label="导入角色卡"
          @click="importInput?.click()"
        >
          <Upload :size="24" />
        </button>
        <button type="button" class="telegram-contacts__icon" title="搜索" aria-label="搜索联系人" @click="openSearch">
          <Search :size="24" />
        </button>
      </template>
    </header>
    <div v-else class="telegram-contacts__search-row">
      <label class="telegram-contacts__search">
        <Search :size="18" aria-hidden="true" />
        <input v-model="query" type="search" placeholder="搜索联系人" aria-label="搜索联系人">
      </label>
      <button
        v-if="canImport"
        type="button"
        class="telegram-contacts__icon telegram-contacts__import"
        title="导入角色卡"
        aria-label="导入角色卡"
        @click="importInput?.click()"
      >
        <Upload :size="20" />
      </button>
    </div>
    <input ref="importInput" class="tw:hidden" type="file" accept=".png,.json,image/png,application/json" @change="handleImportFile">

    <ul v-if="contacts.length > 0" class="telegram-contacts__rows">
      <li v-for="group in contacts" :key="group.key" class="telegram-contacts__item">
        <button
          type="button"
          class="telegram-contacts__row"
          @click="handleRowClick(group)"
          @contextmenu.prevent="menuKey = group.key"
          @pointerdown="startLongPress(group.key, $event)"
          @pointerup="cancelLongPress"
          @pointerleave="cancelLongPress"
        >
          <TelegramAvatar :src="group.characterAvatarUrl" :name="group.characterName" :initial="group.characterInitial" :size="page ? 50 : 44" />
          <span class="telegram-contacts__copy">
            <strong>{{ group.characterName }}</strong>
            <small>{{ group.sessions.length > 0 ? `${group.sessions.length} 个会话 · ${group.recentPreview || '暂无消息'}` : '还没有会话，点按开始' }}</small>
          </span>
        </button>
        <ChatPopoverMenu
          v-if="menuKey === group.key"
          :items="contactMenu(group)"
          label="联系人操作"
          placement="below"
          align="end"
          @select="handleMenu(group, $event)"
          @close="menuKey = null"
        />
      </li>
    </ul>
    <p v-else class="telegram-contacts__empty">{{ query.trim() ? '没有匹配的联系人' : '暂无角色' }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { ArrowLeft, Search, Upload } from 'lucide-vue-next';
import type { CharacterChannelGroup } from '../../../../types/ConversationContextTypes.js';
import type { ChatMenuItem } from '../../presentation/chatMenus.js';
import ChatPopoverMenu from '../ChatPopoverMenu.vue';
import TelegramAvatar from './TelegramAvatar.vue';

const props = withDefaults(defineProps<{
  groups: readonly CharacterChannelGroup[];
  page?: boolean;
  canImport?: boolean;
}>(), {
  page: false,
  canImport: false
});

const emit = defineEmits<{
  open: [sessionId: string];
  create: [group: CharacterChannelGroup];
  import: [file: File];
}>();

const importInput = ref<HTMLInputElement | null>(null);

const handleImportFile = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;
  emit('import', file);
};

const LONG_PRESS_MS = 480;
const query = ref('');
const searching = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const menuKey = ref<string | null>(null);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let suppressNextClick = false;

// 与原版一致：最近联系过的排在前面
const contacts = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return props.groups
    .filter(group => !needle || `${group.characterName}\n${group.recentPreview}`.toLowerCase().includes(needle))
    .slice()
    .sort((left, right) => (right.recentSession?.updatedAt || 0) - (left.recentSession?.updatedAt || 0));
});

const contactMenu = (group: CharacterChannelGroup): ChatMenuItem[] => [
  { id: 'new', label: '新建会话', icon: 'newChat' },
  { id: 'recent', label: '打开最近会话', icon: 'openChat', disabled: !group.recentSession }
];

const openSearch = (): void => {
  searching.value = true;
  void nextTick(() => searchInput.value?.focus());
};

const closeSearch = (): void => {
  searching.value = false;
  query.value = '';
};

/** 点按联系人：有会话则进入最近会话，否则新建（与原版点联系人即进入聊天一致） */
const openContact = (group: CharacterChannelGroup): void => {
  if (group.recentSession) emit('open', group.recentSession.id);
  else emit('create', group);
};

const handleRowClick = (group: CharacterChannelGroup): void => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  openContact(group);
};

const startLongPress = (key: string, event: PointerEvent): void => {
  if (event.pointerType === 'mouse') return;
  cancelLongPress();
  longPressTimer = setTimeout(() => {
    suppressNextClick = true;
    menuKey.value = key;
  }, LONG_PRESS_MS);
};

const cancelLongPress = (): void => {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
};

const handleMenu = (group: CharacterChannelGroup, action: string): void => {
  menuKey.value = null;
  if (action === 'new') emit('create', group);
  else if (group.recentSession) emit('open', group.recentSession.id);
};

onBeforeUnmount(cancelLongPress);
</script>

<style scoped>
.telegram-contacts {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--lw-telegram-pane-list-bg, var(--lw-bg-surface));
  color: var(--lw-text-main);
}

.telegram-contacts__header {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 8px;
  padding: calc(8px + var(--lw-content-safe-top, 0px)) 8px 4px 20px;
}

.telegram-contacts__header h2 {
  color: var(--lw-telegram-title-color, var(--lw-text-main));
  flex: 1;
  margin: 0;
  font-size: var(--lw-telegram-page-title-size, 1.5rem);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.telegram-contacts__header-search {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 1.125rem;
}

.telegram-contacts__icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-main);
  cursor: pointer;
}

.telegram-contacts__icon:hover {
  background: var(--lw-bg-hover);
}

.telegram-contacts__search-row {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  margin: 10px 12px 6px;
}

.telegram-contacts__search {
  display: flex;
  height: 40px;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-muted);
}

.telegram-contacts__import {
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  color: var(--lw-text-muted);
}

.telegram-contacts__search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--lw-text-main);
  font: inherit;
}

.telegram-contacts__rows {
  min-height: 0;
  flex: 1;
  margin: 0;
  padding: 4px 0 calc(96px + var(--lw-content-safe-bottom, 0px));
  overflow: auto;
  list-style: none;
}

.telegram-contacts:not(.is-page) .telegram-contacts__rows {
  padding: 2px 6px 8px;
}

.telegram-contacts__item {
  position: relative;
}

.telegram-contacts__row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 14px;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 8px 16px 8px 14px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-touch-callout: none;
  user-select: none;
  transition: background-color var(--lw-transition);
}

.telegram-contacts:not(.is-page) .telegram-contacts__row {
  gap: 12px;
  padding: 7px 10px;
  border-radius: 12px;
}

.telegram-contacts__row:hover {
  background: var(--lw-bg-hover);
}

.telegram-contacts__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.telegram-contacts__copy strong,
.telegram-contacts__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.telegram-contacts__copy strong {
  font-size: var(--lw-telegram-list-title-size, 1.0625rem);
  font-weight: var(--lw-telegram-list-title-weight, 600);
}

.telegram-contacts__copy small {
  color: var(--lw-text-muted);
  font-size: var(--lw-telegram-list-preview-size, 1rem);
}

.telegram-contacts__item :deep(.chat-popover-menu) {
  top: calc(100% - 6px);
  right: 16px;
}

.telegram-contacts__empty {
  margin: 0;
  padding: 48px 32px;
  color: var(--lw-text-muted);
  text-align: center;
}
</style>
