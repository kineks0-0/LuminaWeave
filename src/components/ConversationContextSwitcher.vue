<template>
  <div class="context-switcher">
    <select
      class="session-select"
      :value="contextStore.selectedViewSessionId || ''"
      @change="handleChange"
    >
      <option value="">当前聊天（自动）</option>
      <optgroup label="聊天会话" v-if="sessionIndexStore.chatSessions.length">
        <option
          v-for="session in sessionIndexStore.chatSessions"
          :key="session.id"
          :value="session.id"
        >
          {{ session.title }}{{ session.id === contextStore.currentChatSessionId ? '（当前）' : '' }}
        </option>
      </optgroup>
      <optgroup label="制卡会话" v-if="sessionIndexStore.forgeSessions.length">
        <option
          v-for="session in sessionIndexStore.forgeSessions"
          :key="session.id"
          :value="session.id"
        >
          {{ session.title }}
        </option>
      </optgroup>
    </select>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useConversationContextStore } from '../stores/useConversationContextStore';
import { useSessionIndexStore } from '../stores/useSessionIndexStore';

const contextStore = useConversationContextStore();
const sessionIndexStore = useSessionIndexStore();

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  contextStore.selectViewSession(target.value || null);
};

onMounted(async () => {
  await contextStore.refreshSessionOptions();
  contextStore.syncCurrentChatSelection();
});
</script>

<style scoped>
.context-switcher {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.session-select {
  min-width: 220px;
  max-width: 320px;
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 88%, white);
  color: var(--lw-text-main);
  padding: 9px 14px;
  font-size: 12px;
  cursor: pointer;
}

@media (max-width: 960px) {
  .session-select {
    min-width: 0;
    width: 100%;
    max-width: none;
  }
}
</style>
