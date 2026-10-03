<template>
  <div class="chat-header-shell" :data-layout="layout">
    <!-- Telegram：浮动圆钮 + 会话胶囊，搜索时整行换成搜索框 -->
    <header v-if="layout === 'telegram'" class="chat-header chat-header--floating">
      <template v-if="searchVisible">
        <button
          type="button"
          class="chat-header__round"
          title="退出搜索"
          aria-label="退出搜索"
          @click="closeSearch"
        >
          <ArrowLeft :size="22" />
        </button>
        <label class="chat-header__pill chat-header__search-pill">
          <Search :size="18" aria-hidden="true" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="search"
            placeholder="搜索"
            aria-label="搜索当前消息"
            @keydown.esc="closeSearch"
          >
          <span v-if="searchQuery.trim()">{{ searchMatchCount }} 条</span>
        </label>
      </template>
      <template v-else>
        <button
          v-if="onBack"
          type="button"
          class="chat-header__round"
          title="返回聊天列表"
          aria-label="返回聊天列表"
          @click="onBack"
        >
          <ArrowLeft :size="22" />
        </button>
        <component
          :is="onOpenRoleProfile ? 'button' : 'div'"
          :type="onOpenRoleProfile ? 'button' : undefined"
          class="chat-header__pill chat-header__peer"
          :title="onOpenRoleProfile ? '查看角色资料' : undefined"
          @click="onOpenRoleProfile?.()"
        >
          <img class="chat-header__avatar" :src="avatarUrl" :alt="title" @error="handleAvatarError">
          <span class="chat-header__identity">
            <strong>{{ title }}</strong>
            <small :class="{ 'is-typing': typing }">{{ statusText }}</small>
          </span>
        </component>
        <div class="chat-header__menu-anchor">
          <button
            type="button"
            class="chat-header__round"
            title="更多"
            aria-label="更多"
            aria-haspopup="menu"
            :aria-expanded="menuVisible"
            @click="menuVisible = !menuVisible"
          >
            <EllipsisVertical :size="22" />
          </button>
          <ChatPopoverMenu
            v-if="menuVisible"
            :items="headerMenu"
            label="会话操作"
            placement="below"
            align="end"
            @select="handleHeaderMenu"
            @close="menuVisible = false"
          />
        </div>
      </template>
    </header>

    <template v-else>
      <header class="chat-header">
        <button
          v-if="onBack"
          type="button"
          class="chat-header__icon-button"
          title="返回聊天列表"
          aria-label="返回聊天列表"
          @click="onBack"
        >
          <ArrowLeft :size="18" />
        </button>

        <div class="chat-header__peer">
          <img class="chat-header__avatar" :src="avatarUrl" :alt="title" @error="handleAvatarError">
          <div class="chat-header__identity">
            <strong>{{ title }}</strong>
            <small :class="{ 'is-typing': typing }">{{ statusText }}</small>
          </div>
        </div>

        <div class="chat-header__actions">
          <button
            type="button"
            class="chat-header__icon-button"
            :class="{ 'is-active': searchVisible }"
            title="搜索当前消息"
            aria-label="搜索当前消息"
            @click="searchVisible = !searchVisible"
          >
            <Search :size="17" />
          </button>
          <button
            v-if="onOpenRoleProfile"
            type="button"
            class="chat-header__icon-button"
            title="打开角色资料"
            aria-label="打开角色资料"
            @click="onOpenRoleProfile"
          >
            <ContactRound :size="18" />
          </button>
          <div v-if="onOpenPanel" class="chat-header__menu-anchor">
            <button
              type="button"
              class="chat-header__icon-button"
              title="更多操作"
              aria-label="更多操作"
              aria-haspopup="menu"
              :aria-expanded="menuVisible"
              @click="menuVisible = !menuVisible"
            >
              <Ellipsis :size="18" />
            </button>
            <ChatPopoverMenu
              v-if="menuVisible"
              :items="classicMenu"
              label="更多操作"
              @select="handleClassicMenu"
              @close="menuVisible = false"
            />
          </div>
        </div>
      </header>

      <div v-if="searchVisible" class="chat-header__search">
        <input v-model="searchQuery" type="search" placeholder="搜索当前消息">
        <span>{{ searchMatchCount }} 条匹配</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { computed, nextTick, ref } from 'vue';
import { ArrowLeft, ContactRound, Ellipsis, EllipsisVertical, Search } from 'lucide-vue-next';
import type { ChatMessageLayout } from '../presentation/ChatMessageRenderPreferences.js';
import {
  CHAT_CONTEXT_TOOLS,
  buildChatHeaderMenu,
  type ChatHeaderMenuAction,
  type ChatMenuItem
} from '../presentation/chatMenus.js';
import ChatPopoverMenu from './ChatPopoverMenu.vue';

const props = withDefaults(defineProps<{
  title: string;
  subtitle: string;
  avatarUrl: string;
  defaultAvatar: string;
  messages: LuminaChatMessage[];
  layout?: ChatMessageLayout;
  /** 正在生成回复：状态行显示“正在输入…” */
  typing?: boolean;
  onBack?: () => void;
  onOpenRoleProfile?: () => void;
  onOpenPanel?: (panelId: string) => void;
  onTogglePromptInspector: () => void;
}>(), {
  layout: 'classic',
  typing: false,
  onBack: undefined,
  onOpenRoleProfile: undefined,
  onOpenPanel: undefined
});

const searchVisible = ref(false);
const searchQuery = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const menuVisible = ref(false);

const statusText = computed(() => (props.typing ? '正在输入…' : props.subtitle));
const headerMenu = computed(() => buildChatHeaderMenu({ canOpenProfile: Boolean(props.onOpenRoleProfile) }));
const classicMenu = computed<ChatMenuItem[]>(() => [
  ...CHAT_CONTEXT_TOOLS,
  { id: 'prompt', label: 'Prompt 预览', icon: 'prompt' }
]);

const searchMatchCount = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return 0;
  return props.messages.filter((message) => [
    message.mes,
    message.mesRaw,
    message.pluginRaw,
    message.name
  ].some(value => (value || '').toLowerCase().includes(query))).length;
});

const handleAvatarError = (event: Event): void => {
  const image = event.currentTarget;
  if (image instanceof HTMLImageElement) {
    image.src = props.defaultAvatar;
  }
};

const openSearch = (): void => {
  searchVisible.value = true;
  void nextTick(() => searchInput.value?.focus());
};

const closeSearch = (): void => {
  searchVisible.value = false;
  searchQuery.value = '';
};

const handleHeaderMenu = (id: string): void => {
  menuVisible.value = false;
  const action = id as ChatHeaderMenuAction;
  if (action === 'search') openSearch();
  else if (action === 'profile') props.onOpenRoleProfile?.();
  else if (action === 'prompt') props.onTogglePromptInspector();
};

const handleClassicMenu = (id: string): void => {
  menuVisible.value = false;
  if (id === 'prompt') props.onTogglePromptInspector();
  else props.onOpenPanel?.(id);
};
</script>

<style scoped>
.chat-header-shell {
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--lw-border-base);
  background: var(--lw-chat-header-bg, var(--lw-bg-surface));
}

.chat-header {
  display: grid;
  min-height: 54px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
}

.chat-header__peer,
.chat-header__actions {
  display: flex;
  min-width: 0;
  align-items: center;
}

.chat-header__peer {
  gap: 9px;
}

.chat-header__actions {
  gap: 3px;
}

.chat-header__avatar {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 50%;
  object-fit: cover;
}

.chat-header__identity {
  display: flex;
  min-width: 0;
  flex-direction: column;
  text-align: left;
}

.chat-header__identity strong,
.chat-header__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header__identity strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-title-small-size);
}

.chat-header__identity small {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.chat-header__identity small.is-typing {
  color: var(--lw-primary);
}

.chat-header__icon-button {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
}

.chat-header__icon-button:hover,
.chat-header__icon-button.is-active {
  border-color: var(--lw-border-base);
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.chat-header__menu-anchor {
  position: relative;
}

.chat-header__search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 0 12px 8px;
}

.chat-header__search input {
  min-width: 0;
  border: 1px solid var(--lw-border-base);
  border-radius: 5px;
  outline: 0;
  background: var(--lw-bg-app);
  color: var(--lw-text-main);
  padding: 7px 9px;
}

.chat-header__search span {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

/* ---------- Telegram：浮在壁纸上的圆钮与胶囊 ---------- */
.chat-header-shell[data-layout='telegram'] {
  border-bottom: 0;
  background: var(--lw-chat-header-bg, transparent);
  /* 让消息区从顶栏下方开始滚动，滚动内容可从浮动控件之间透出 */
  margin-bottom: calc(-1 * var(--chat-header-overlap, 0px));
  pointer-events: none;
}

.chat-header--floating {
  min-height: 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  padding: calc(8px + var(--lw-content-safe-top, 0px)) 10px 8px;
}

.chat-header--floating > * {
  pointer-events: auto;
}

.chat-header__round,
.chat-header__pill {
  border: 1px solid var(--lw-chat-floating-border, var(--lw-border-base));
  background: var(--lw-chat-floating-bg, var(--lw-bg-elevated));
  box-shadow: var(--lw-chat-floating-shadow, none);
  backdrop-filter: var(--lw-chat-floating-blur, none);
  -webkit-backdrop-filter: var(--lw-chat-floating-blur, none);
  color: var(--lw-text-main);
}

.chat-header__round {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color var(--lw-transition);
}

.chat-header__round:hover {
  background: color-mix(in srgb, var(--lw-text-main) 6%, var(--lw-chat-floating-bg, var(--lw-bg-elevated)));
}

.chat-header__pill {
  display: flex;
  min-width: 0;
  height: 48px;
  align-items: center;
  border-radius: 999px;
  font: inherit;
}

.chat-header--floating .chat-header__peer {
  gap: 10px;
  padding: 0 18px 0 4px;
  cursor: default;
}

button.chat-header__peer {
  cursor: pointer;
}

.chat-header--floating .chat-header__avatar {
  width: 40px;
  height: 40px;
}

.chat-header--floating .chat-header__identity strong {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.25;
}

.chat-header--floating .chat-header__identity small {
  font-size: 0.875rem;
  line-height: 1.25;
}

/* 没有返回键（桌面）时，会话胶囊从第一列开始 */
.chat-header--floating > .chat-header__peer:first-child {
  grid-column: 1 / 3;
}

.chat-header__search-pill {
  grid-column: 2 / 4;
  gap: 10px;
  padding: 0 16px;
  color: var(--lw-text-muted);
}

.chat-header__search-pill input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--lw-text-main);
  font: inherit;
  font-size: 1rem;
}

.chat-header__search-pill span {
  flex: 0 0 auto;
  font-size: var(--lw-type-label-medium-size);
  font-variant-numeric: tabular-nums;
}
</style>
