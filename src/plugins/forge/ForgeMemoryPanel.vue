<template>
  <ForgeAuxPanelShell
    title="记忆管理"
    kicker="Forge Memory"
    :subtitle="`共 ${sortedEntries.length} 条 Forge 独立记忆，直接服务当前制卡工作区。`"
  >
    <div v-if="sortedEntries.length === 0" class="memory-empty">
      <strong>还没有独立记忆</strong>
      <p>当你确认偏好、禁忌、设定决议或参考内容后，Forge 会把它们整理到这里。</p>
    </div>

    <div v-else class="memory-list">
      <article v-for="entry in sortedEntries" :key="entry.path" class="memory-card">
        <div class="memory-card__header">
          <div class="memory-card__title-group">
            <span class="memory-card__path">{{ entry.path }}</span>
            <strong>{{ entry.title }}</strong>
          </div>
          <button class="ghost-btn" type="button" @click="store.removeForgeMemory(entry.path)">移除</button>
        </div>

        <div class="memory-card__meta">
          <span>{{ sourceLabel(entry.source) }}</span>
          <span>{{ formatTime(entry.updatedAt) }}</span>
        </div>

        <p v-if="entry.summary" class="memory-card__summary">{{ entry.summary }}</p>
        <pre class="memory-card__content">{{ entry.content }}</pre>
      </article>
    </div>
  </ForgeAuxPanelShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardMakerStore } from './CardMakerStore';
import ForgeAuxPanelShell from './ForgeAuxPanelShell.vue';
import type { ForgeMemorySource } from '../../types/ForgeMemoryTypes.js';

const store = useCardMakerStore();

const sortedEntries = computed(() =>
  [...store.forgeMemoryTree.entries].sort((left, right) => right.updatedAt - left.updatedAt)
);

const formatTime = (value: number) => new Date(value).toLocaleString([], {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const sourceLabel = (source: ForgeMemorySource) => {
  switch (source) {
    case 'user':
      return '用户确认';
    case 'planner':
      return 'Planner';
    case 'analyst':
      return 'Analyst';
    default:
      return '系统';
  }
};
</script>

<style scoped>
.memory-empty,
.memory-card {
  border-radius: 22px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
}

.memory-empty {
  padding: 18px;
  color: var(--lw-text-secondary);
}

.memory-empty strong {
  display: block;
  margin-bottom: 6px;
  color: var(--lw-text-main);
}

.memory-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.memory-card {
  padding: 14px;
}

.memory-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.memory-card__title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.memory-card__title-group strong {
  font-size: 14px;
  line-height: 1.35;
  color: var(--lw-text-main);
}

.memory-card__path {
  font-size: 11px;
  color: var(--lw-primary);
  word-break: break-all;
}

.memory-card__meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
  font-size: 11px;
  color: var(--lw-text-muted);
}

.memory-card__summary {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.memory-card__content {
  margin: 10px 0 0;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.7;
  color: var(--lw-text-main);
}

.ghost-btn {
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-surface);
  color: var(--lw-text-secondary);
  padding: 7px 11px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
</style>
