<template>
  <section class="conversation-session-list" :class="{ 'is-compact': input.compact }">
    <template v-for="group in visibleGroups" :key="group.key">
      <header>
        <strong>{{ group.characterName }}</strong>
        <button
          type="button"
          :title="expanded(group.key) ? '收起会话' : '展开会话'"
          @click="surface.intents.toggleGroupSessionExpansion(group.key)"
        >
          <ChevronDown v-if="expanded(group.key)" :size="16" />
          <ChevronRight v-else :size="16" />
        </button>
      </header>

      <div v-if="expanded(group.key)" class="conversation-session-list__items">
        <article
          v-for="session in group.sessions"
          :key="session.id"
          :class="{ 'is-active': session.id === channel.activeSessionId }"
        >
          <template v-if="editingSessionId === session.id">
            <input v-model="editingTitle" :aria-label="`重命名 ${session.title}`" @keydown.enter="saveRename(session.id)">
            <button type="button" title="保存名称" aria-label="保存名称" @click="saveRename(session.id)">
              <Check :size="15" />
            </button>
            <button type="button" title="取消重命名" aria-label="取消重命名" @click="cancelRename">
              <X :size="15" />
            </button>
          </template>
          <template v-else>
            <button type="button" class="conversation-session-list__main" @click="openSession(session.id)">
              <strong>{{ session.title }}</strong>
              <small>{{ session.recentHistoryPreview }}</small>
            </button>
            <button type="button" title="重命名会话" aria-label="重命名会话" @click="startRename(session.id, session.title)">
              <Pencil :size="15" />
            </button>
            <button type="button" title="删除会话" aria-label="删除会话" @click="deleteSession(session.id)">
              <Trash2 :size="15" />
            </button>
          </template>
        </article>
      </div>
    </template>

    <div v-if="visibleGroups.length === 0" class="conversation-session-list__empty">
      暂无会话
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, ChevronDown, ChevronRight, Pencil, Trash2, X } from 'lucide-vue-next';
import {
  useSurfaceInput,
  useSurfaceRuntimeContext
} from '../../../platform/surface/useSurfaceRuntimeContext.js';

const input = useSurfaceInput('conversation.sessionList');
const context = useSurfaceRuntimeContext('conversation.sessionList');
const surface = computed(() => context.value);
const channel = computed(() => context.value.state.channel.value);
const editingSessionId = ref<string | null>(null);
const editingTitle = ref('');
const visibleGroups = computed(() => input.characterKey
  ? channel.value.characterGroups.filter((group) => group.key === input.characterKey)
  : channel.value.characterGroups
);

const expanded = (groupKey: string): boolean => {
  return channel.value.expandedSessionGroups[groupKey] === true;
};
const openSession = (sessionId: string): void => {
  void context.value.intents.openSession(sessionId);
};
const startRename = (sessionId: string, title: string): void => {
  editingSessionId.value = sessionId;
  editingTitle.value = title;
};
const cancelRename = (): void => {
  editingSessionId.value = null;
  editingTitle.value = '';
};
const saveRename = (sessionId: string): void => {
  const nextTitle = editingTitle.value.trim();
  if (!nextTitle) return;
  void context.value.intents.renameSession(sessionId, nextTitle);
  cancelRename();
};
const deleteSession = (sessionId: string): void => {
  void context.value.intents.deleteSession(sessionId);
};
</script>

<style scoped>
.conversation-session-list {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: var(--lw-bg-app);
  padding: 6px;
}

.conversation-session-list > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  color: var(--lw-text-secondary);
}

.conversation-session-list button {
  color: inherit;
  font: inherit;
}

.conversation-session-list > header button,
.conversation-session-list__items article > button:not(.conversation-session-list__main) {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
}

.conversation-session-list__items article {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px 28px;
  gap: 4px;
  align-items: center;
  border-radius: 6px;
  padding: 4px;
}

.conversation-session-list__items article:hover,
.conversation-session-list__items article.is-active {
  background: var(--lw-bg-hover);
}

.conversation-session-list__main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  border: 0;
  background: transparent;
  padding: 6px;
  text-align: left;
  cursor: pointer;
}

.conversation-session-list__main small {
  overflow: hidden;
  color: var(--lw-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-session-list__items input {
  min-width: 0;
  border: 1px solid var(--lw-border-base);
  border-radius: 5px;
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
  padding: 7px 8px;
}

.conversation-session-list__empty {
  display: grid;
  min-height: 120px;
  place-items: center;
  color: var(--lw-text-muted);
}
</style>
