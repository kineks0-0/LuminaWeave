<template>
  <section class="telegram-chat-list" :class="{ 'is-page': page }" aria-label="聊天列表">
    <header v-if="page" class="telegram-chat-list__header">
      <h2>{{ title }}</h2>
    </header>
    <label class="telegram-chat-list__search" :class="{ 'is-page': page }">
      <Search :size="page ? 22 : 18" aria-hidden="true" />
      <input v-model="query" type="search" placeholder="搜索聊天" aria-label="搜索聊天">
    </label>

    <ul v-if="rows.length > 0" class="telegram-chat-list__rows">
      <li v-for="row in rows" :key="row.sessionId" class="telegram-chat-list__item">
        <form v-if="renamingSessionId === row.sessionId" class="telegram-chat-list__rename" @submit.prevent="saveRename(row.sessionId)">
          <TelegramAvatar :src="row.avatarUrl" :name="row.name" :initial="row.initial" :size="avatarSize" />
          <input
            ref="renameInput"
            v-model="renameTitle"
            :aria-label="`重命名 ${row.sessionTitle || row.name}`"
            @keydown.esc="cancelRename"
          >
          <button type="submit" class="telegram-chat-list__icon" title="保存名称" aria-label="保存名称">
            <Check :size="20" />
          </button>
          <button type="button" class="telegram-chat-list__icon" title="取消重命名" aria-label="取消重命名" @click="cancelRename">
            <X :size="20" />
          </button>
        </form>
        <template v-else>
          <button
            type="button"
            class="telegram-chat-list__row"
            :class="{ 'is-active': row.isActive }"
            :aria-current="row.isActive ? 'true' : undefined"
            @click="handleRowClick(row.sessionId)"
            @contextmenu.prevent="openMenu(row.sessionId)"
            @pointerdown="startLongPress(row.sessionId, $event)"
            @pointerup="cancelLongPress"
            @pointerleave="cancelLongPress"
          >
            <TelegramAvatar :src="row.avatarUrl" :name="row.name" :initial="row.initial" :size="avatarSize" />
            <span class="telegram-chat-list__copy">
              <span class="telegram-chat-list__line">
                <strong>{{ row.name }}<small v-if="row.sessionTitle"> · {{ row.sessionTitle }}</small></strong>
                <time>{{ row.dateLabel }}</time>
              </span>
              <span class="telegram-chat-list__preview">{{ row.preview || '暂无消息' }}</span>
            </span>
          </button>
          <ChatPopoverMenu
            v-if="menuSessionId === row.sessionId"
            :items="rowMenu"
            label="会话操作"
            placement="below"
            align="end"
            @select="handleRowMenu(row, $event)"
            @close="menuSessionId = null"
          />
        </template>
      </li>
    </ul>
    <p v-else class="telegram-chat-list__empty">{{ query.trim() ? '没有匹配的聊天' : '还没有聊天，去联系人里选一个角色开始吧' }}</p>
    <button
      v-if="page && canCompose"
      type="button"
      class="telegram-chat-list__fab"
      title="新建聊天"
      aria-label="新建聊天"
      @click="emit('compose')"
    >
      <MessageCirclePlus :size="26" :stroke-width="2.2" />
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { Check, MessageCirclePlus, Search, X } from 'lucide-vue-next';
import type { CharacterChannelGroup } from '../../../../types/ConversationContextTypes.js';
import type { ChatMenuItem } from '../../presentation/chatMenus.js';
import { buildTelegramChatListRows, type TelegramChatListRow } from '../../presentation/telegramChatList.js';
import ChatPopoverMenu from '../ChatPopoverMenu.vue';
import TelegramAvatar from './TelegramAvatar.vue';

const props = withDefaults(defineProps<{
  groups: readonly CharacterChannelGroup[];
  activeSessionId: string | null;
  /** 移动端整页：大标题 + 搜索键；否则（桌面左栏）为常驻搜索框 */
  page?: boolean;
  title?: string;
  /** 是否显示右下角“新建聊天”悬浮键（需外壳能跳到联系人选择角色） */
  canCompose?: boolean;
}>(), {
  page: false,
  canCompose: false,
  title: 'LuminaWeave'
});

const emit = defineEmits<{
  open: [sessionId: string];
  rename: [sessionId: string, title: string];
  delete: [sessionId: string];
  compose: [];
}>();

const LONG_PRESS_MS = 480;
const query = ref('');
const menuSessionId = ref<string | null>(null);
const renamingSessionId = ref<string | null>(null);
const renameTitle = ref('');
const renameInput = ref<HTMLInputElement[] | null>(null);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
/** 长按已弹出菜单时，吞掉随后的 click，避免同时打开会话 */
let suppressNextClick = false;

const avatarSize = computed(() => (props.page ? 54 : 48));
const rows = computed(() => buildTelegramChatListRows(props.groups, {
  query: query.value,
  activeSessionId: props.activeSessionId
}));
const rowMenu: ChatMenuItem[] = [
  { id: 'rename', label: '重命名', icon: 'edit' },
  { id: 'delete', label: '删除聊天', icon: 'delete', danger: true }
];

const openMenu = (sessionId: string): void => {
  menuSessionId.value = sessionId;
};

// 触屏长按弹出会话菜单（与原版一致）；鼠标走右键
const startLongPress = (sessionId: string, event: PointerEvent): void => {
  if (event.pointerType === 'mouse') return;
  cancelLongPress();
  longPressTimer = setTimeout(() => {
    suppressNextClick = true;
    openMenu(sessionId);
  }, LONG_PRESS_MS);
};

const handleRowClick = (sessionId: string): void => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  emit('open', sessionId);
};

const cancelLongPress = (): void => {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
};

const handleRowMenu = (row: TelegramChatListRow, action: string): void => {
  menuSessionId.value = null;
  if (action === 'delete') {
    emit('delete', row.sessionId);
    return;
  }
  const session = props.groups.find(group => group.key === row.characterKey)?.sessions.find(item => item.id === row.sessionId);
  renamingSessionId.value = row.sessionId;
  renameTitle.value = session?.title || row.name;
  void nextTick(() => renameInput.value?.[0]?.select());
};

const saveRename = (sessionId: string): void => {
  const nextTitle = renameTitle.value.trim();
  if (!nextTitle) return;
  emit('rename', sessionId, nextTitle);
  cancelRename();
};

const cancelRename = (): void => {
  renamingSessionId.value = null;
  renameTitle.value = '';
};

onBeforeUnmount(cancelLongPress);
</script>

<style scoped>
.telegram-chat-list {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
}

.telegram-chat-list__header {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 8px;
  padding: calc(8px + var(--lw-content-safe-top, 0px)) 8px 4px 20px;
}

.telegram-chat-list__header h2 {
  color: var(--lw-telegram-title-color, var(--lw-text-main));
  flex: 1;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.telegram-chat-list__icon {
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

.telegram-chat-list__icon:hover {
  background: var(--lw-bg-hover);
}

.telegram-chat-list__search {
  display: flex;
  height: 40px;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  margin: 10px 12px 6px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-muted);
}

.telegram-chat-list__search.is-page {
  height: 48px;
  gap: 14px;
  margin: 6px 12px 8px;
  padding: 0 18px;
  font-size: 1.0625rem;
}

.telegram-chat-list__search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--lw-text-main);
  font: inherit;
}

.telegram-chat-list__rows {
  min-height: 0;
  flex: 1;
  margin: 0;
  padding: 4px 0 calc(96px + var(--lw-content-safe-bottom, 0px));
  overflow: auto;
  list-style: none;
}

.telegram-chat-list:not(.is-page) .telegram-chat-list__rows {
  padding: 2px 6px 8px;
}

.telegram-chat-list__item {
  position: relative;
}

.telegram-chat-list__row,
.telegram-chat-list__rename {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 14px;
  padding: 9px 16px 9px 12px;
}

.telegram-chat-list__row {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-touch-callout: none;
  user-select: none;
  transition: background-color var(--lw-transition);
}

.telegram-chat-list:not(.is-page) .telegram-chat-list__row {
  gap: 12px;
  padding: 7px 10px;
  border-radius: 12px;
}

.telegram-chat-list__row:hover {
  background: var(--lw-bg-hover);
}

.telegram-chat-list__row.is-active {
  background: var(--lw-primary);
  color: var(--lw-text-inverse);
}

.telegram-chat-list__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.telegram-chat-list__line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.telegram-chat-list__line strong {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 1.0625rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.telegram-chat-list__line strong small {
  font-size: 0.9375rem;
  font-weight: 400;
  opacity: 0.7;
}

.telegram-chat-list__line time,
.telegram-chat-list__preview {
  color: var(--lw-text-muted);
}

.telegram-chat-list__line time {
  flex: 0 0 auto;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.telegram-chat-list__preview {
  overflow: hidden;
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.telegram-chat-list__row.is-active time,
.telegram-chat-list__row.is-active .telegram-chat-list__preview {
  color: inherit;
  opacity: 0.8;
}

.telegram-chat-list__rename input {
  min-width: 0;
  flex: 1;
  height: 40px;
  border: 1px solid var(--lw-border-active, var(--lw-primary));
  border-radius: 10px;
  outline: 0;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  padding: 0 12px;
  font: inherit;
}

.telegram-chat-list__item :deep(.chat-popover-menu) {
  top: calc(100% - 6px);
  right: 16px;
}

.telegram-chat-list {
  position: relative;
}

.telegram-chat-list__fab {
  position: absolute;
  right: 18px;
  bottom: calc(100px + var(--lw-content-safe-bottom, 0px));
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: var(--lw-primary);
  color: var(--lw-text-inverse);
  box-shadow: var(--lw-shadow-card);
  cursor: pointer;
  transition: filter var(--lw-transition);
}

.telegram-chat-list__fab:hover {
  filter: brightness(1.06);
}

.telegram-chat-list__empty {
  margin: 0;
  padding: 48px 32px;
  color: var(--lw-text-muted);
  text-align: center;
}
</style>
