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
          <TelegramAvatar :src="row.avatarUrl" :name="row.name" :initial="row.initial" :size="avatarSize" :default-avatar="luminaWeaveApi.DEFAULT_AVATAR" />
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
            @contextmenu.prevent="openMenu(row.sessionId, $event)"
            @pointerdown="onRowPointerdown(row.sessionId, $event)"
            @pointermove="longPress.handlePointermove"
            @pointerup="longPress.handlePointerup"
            @pointercancel="longPress.handlePointercancel"
          >
            <TelegramAvatar :src="row.avatarUrl" :name="row.name" :initial="row.initial" :size="avatarSize" :default-avatar="luminaWeaveApi.DEFAULT_AVATAR" />
            <span class="telegram-chat-list__copy">
              <span class="telegram-chat-list__line">
                <strong>{{ row.name }}<small v-if="row.sessionTitle"> · {{ row.sessionTitle }}</small></strong>
                <time>{{ row.dateLabel }}</time>
              </span>
              <span class="telegram-chat-list__preview">{{ row.preview || '暂无消息' }}</span>
            </span>
          </button>
          <button
            type="button"
            class="telegram-chat-list__more"
            :title="`管理 ${row.sessionTitle || row.name}`"
            :aria-label="`管理 ${row.sessionTitle || row.name}`"
            @click.stop="openMenu(row.sessionId, $event)"
          >
            <MoreHorizontal :size="18" aria-hidden="true" />
          </button>
          <ChatPopoverMenu
            v-if="menuSessionId === row.sessionId"
            :items="rowMenu"
            label="会话操作"
            :placement="menuPlacement"
            align="end"
            @select="handleRowMenu(row, $event)"
            @close="menuSessionId = null"
          />
        </template>
      </li>
    </ul>
    <div v-else class="telegram-chat-list__empty">
      <span class="telegram-chat-list__empty-mark" aria-hidden="true">
        <MessageCircle :size="30" />
      </span>
      <strong>{{ query.trim() ? '没有匹配的聊天' : '还没有聊天' }}</strong>
      <p v-if="!query.trim()">去联系人里选一个角色，开始第一段对话</p>
      <button
        v-if="page && canCompose && !query.trim()"
        type="button"
        class="telegram-chat-list__empty-action"
        @click="emit('compose')"
      >
        选择联系人
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { Check, MessageCircle, MoreHorizontal, Search, X } from 'lucide-vue-next';
import { luminaWeaveApi } from '@/api';
import type { CharacterChannelGroup } from '../../../../types/ConversationContextTypes.js';
import { buildConversationSessionMenu, resolveSessionMenuPlacement, type ChatMenuPlacement } from '../../presentation/chatMenus.js';
import { buildTelegramChatListRows, type TelegramChatListRow } from '../../presentation/telegramChatList.js';
import { useLongPressMenu } from '../../../../composables/useLongPressMenu.js';
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
  duplicate: [sessionId: string];
  delete: [sessionId: string];
  compose: [];
}>();

const query = ref('');
const menuSessionId = ref<string | null>(null);
const menuPlacement = ref<ChatMenuPlacement>('below');
const renamingSessionId = ref<string | null>(null);
const renameTitle = ref('');
const renameInput = ref<HTMLInputElement[] | null>(null);
let menuSourceElement: HTMLElement | null = null;

const avatarSize = computed(() => (props.page ? 54 : 48));
const rows = computed(() => buildTelegramChatListRows(props.groups, {
  query: query.value,
  activeSessionId: props.activeSessionId
}));
const rowMenu = buildConversationSessionMenu();
const longPress = useLongPressMenu<string>({
  onTrigger: (sessionId) => openMenu(sessionId)
});

const openMenu = (sessionId: string, event?: Event): void => {
  if (event?.currentTarget instanceof HTMLElement) {
    menuSourceElement = event.currentTarget;
  }
  const rowRect = menuSourceElement?.getBoundingClientRect();
  const scrollerRect = menuSourceElement?.closest('.telegram-chat-list__rows')?.getBoundingClientRect();
  if (rowRect && scrollerRect) {
    menuPlacement.value = resolveSessionMenuPlacement(rowRect, scrollerRect);
  }
  menuSessionId.value = sessionId;
};

const onRowPointerdown = (sessionId: string, event: PointerEvent): void => {
  menuSourceElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  longPress.handlePointerdown(sessionId, event);
};

const handleRowClick = (sessionId: string): void => {
  if (longPress.consumeClick()) return;
  emit('open', sessionId);
};

const handleRowMenu = (row: TelegramChatListRow, action: string): void => {
  menuSessionId.value = null;
  if (action === 'delete') {
    emit('delete', row.sessionId);
    return;
  }
  if (action === 'duplicate') {
    emit('duplicate', row.sessionId);
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
</script>

<style scoped>
.telegram-chat-list {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--lw-telegram-pane-list-bg, var(--lw-bg-surface));
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
  font-size: var(--lw-type-headline-small-size);
  font-weight: var(--lw-type-headline-small-weight);
  letter-spacing: var(--lw-type-headline-small-tracking);
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
  border: 1px solid var(--lw-telegram-glass-highlight, transparent);
  border-radius: 999px;
  background: var(--lw-telegram-search-bg, var(--lw-telegram-glass-bg, var(--lw-bg-subtle)));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  color: var(--lw-text-muted);
}

.telegram-chat-list__search.is-page {
  height: 48px;
  gap: 14px;
  margin: 6px 12px 8px;
  padding: 0 18px;
  font-size: var(--lw-type-body-large-size);
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
  padding: 4px 0 calc(var(--lw-telegram-bottom-nav-clearance, 96px) + var(--lw-content-safe-bottom, 0px));
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

/* 仅桌面左栏高亮当前会话（原版桌面行为）；移动整页不高亮任何行 */
.telegram-chat-list:not(.is-page) .telegram-chat-list__row.is-active {
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
  font-size: var(--lw-type-title-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.telegram-chat-list__line strong small {
  font-size: var(--lw-type-body-medium-size);
  font-weight: 400;
  opacity: 0.7;
}

.telegram-chat-list__line time,
.telegram-chat-list__preview {
  color: var(--lw-text-muted);
}

.telegram-chat-list__line time {
  flex: 0 0 auto;
  font-size: var(--lw-type-body-small-size);
  font-variant-numeric: tabular-nums;
}

.telegram-chat-list__preview {
  overflow: hidden;
  font-size: var(--lw-type-body-medium-size);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.telegram-chat-list:not(.is-page) .telegram-chat-list__row.is-active time,
.telegram-chat-list:not(.is-page) .telegram-chat-list__row.is-active .telegram-chat-list__preview {
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
  right: 8px;
}

.telegram-chat-list {
  position: relative;
}

.telegram-chat-list__empty {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 24px 32px;
  color: var(--lw-text-muted);
  text-align: center;
}

.telegram-chat-list__empty-mark {
  display: grid;
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-primary) 12%, transparent);
  color: var(--lw-primary);
}

.telegram-chat-list__empty strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-title-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.telegram-chat-list__empty p {
  max-width: 24ch;
  margin: 0;
  font-size: var(--lw-type-body-medium-size);
  line-height: 1.5;
}

.telegram-chat-list__empty-action {
  margin-top: 8px;
  padding: 10px 22px;
  border: 0;
  border-radius: 999px;
  background: var(--lw-primary);
  color: var(--lw-text-inverse);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: filter var(--lw-transition);
}

.telegram-chat-list__empty-action:hover {
  filter: brightness(1.06);
}

/* 桌面悬停「…」：替换行内时间显示，鼠标左键也能打开会话菜单 */
.telegram-chat-list__more {
  position: absolute;
  top: 50%;
  right: 10px;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-muted);
  transform: translateY(-50%);
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition: opacity var(--lw-transition), background-color var(--lw-transition), color var(--lw-transition);
}

@media (hover: hover) {
  .telegram-chat-list__item:hover .telegram-chat-list__more,
  .telegram-chat-list__more:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .telegram-chat-list__item:hover .telegram-chat-list__line time {
    visibility: hidden;
  }
}

.telegram-chat-list__more:hover {
  background: color-mix(in srgb, var(--lw-text-main) 8%, transparent);
  color: var(--lw-text-main);
}

.telegram-chat-list__row.is-active + .telegram-chat-list__more {
  color: var(--lw-text-inverse);
}
</style>
