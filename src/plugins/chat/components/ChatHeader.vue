<template>
  <div class="chat-header-shell">
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
        <img
          class="chat-header__avatar"
          :src="avatarUrl"
          :alt="title"
          @error="handleAvatarError"
        >
        <div class="chat-header__identity">
          <strong>{{ title }}</strong>
          <small>{{ subtitle }}</small>
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
        <div v-if="onOpenPanel" class="chat-header__menu-wrap">
          <button
            type="button"
            class="chat-header__icon-button"
            title="更多操作"
            aria-label="更多操作"
            :aria-expanded="menuVisible"
            @click="menuVisible = !menuVisible"
          >
            <Ellipsis :size="18" />
          </button>
          <div v-if="menuVisible" class="chat-header__menu">
            <button
              v-for="tool in contextTools"
              :key="tool.panelId"
              type="button"
              @click="openPanel(tool.panelId)"
            >
              {{ tool.label }}
            </button>
            <button type="button" @click="togglePromptInspector">
              Prompt 预览
            </button>
          </div>
        </div>
      </div>
    </header>

    <div v-if="searchVisible" class="chat-header__search">
      <input v-model="searchQuery" type="search" placeholder="搜索当前消息">
      <span>{{ searchMatchCount }} 条匹配</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { computed, ref } from 'vue';
import { ArrowLeft, ContactRound, Ellipsis, Search } from 'lucide-vue-next';

const props = defineProps<{
  title: string;
  subtitle: string;
  avatarUrl: string;
  defaultAvatar: string;
  messages: LuminaChatMessage[];
  onBack?: () => void;
  onOpenRoleProfile?: () => void;
  onOpenPanel?: (panelId: string) => void;
  onTogglePromptInspector: () => void;
}>();

const contextTools = [
  { panelId: 'lumina-timeline', label: '打开时间线' },
  { panelId: 'lumina-lorebook', label: '打开世界书' },
  { panelId: 'lumina-director', label: '打开导演面板' },
  { panelId: 'lumina-stats', label: '查看状态' }
] as const;

const searchVisible = ref(false);
const searchQuery = ref('');
const menuVisible = ref(false);
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

const openPanel = (panelId: string): void => {
  props.onOpenPanel?.(panelId);
  menuVisible.value = false;
};

const togglePromptInspector = (): void => {
  props.onTogglePromptInspector();
  menuVisible.value = false;
};
</script>

<style scoped>
.chat-header-shell {
  position: relative;
  z-index: 2;
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

.chat-header__menu-wrap {
  position: relative;
}

.chat-header__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  display: grid;
  width: 172px;
  padding: 5px;
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  background: var(--lw-bg-surface);
  box-shadow: var(--lw-chat-menu-shadow, var(--lw-shadow-card));
}

.chat-header__menu button {
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--lw-text-main);
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}

.chat-header__menu button:hover {
  background: var(--lw-bg-hover);
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
</style>
