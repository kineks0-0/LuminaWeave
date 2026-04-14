<template>
  <div class="memory-proposal">
    <!-- Kicker -->
    <div class="kicker">
      <span class="kicker-dot"></span>
      <span class="kicker-label">记忆整理</span>
      <span class="kicker-path">{{ path }}</span>
    </div>

    <!-- Title -->
    <div class="proposal-title">{{ title }}</div>

    <!-- Content preview -->
    <div class="proposal-body">{{ previewText }}</div>

    <!-- Footer -->
    <div class="proposal-footer">
      <span class="state-badge">已更新 Forge 记忆</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    path: string;
    title: string;
    content: string;
}>();

const previewText = computed(() =>
    props.content.slice(0, 140) + (props.content.length > 140 ? '…' : '')
);
</script>

<style scoped>
.memory-proposal {
  --accent: var(--lw-blue, #3b82f6);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  margin: 6px 0;
  max-width: 420px;
}

.kicker {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kicker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.kicker-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.kicker-path {
  font-size: 10px;
  color: var(--lw-text-muted);
  font-family: var(--lw-font-mono, monospace);
  margin-left: auto;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proposal-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--lw-text-main);
  line-height: 1.3;
}

.proposal-body {
  font-size: 12px;
  line-height: 1.55;
  color: var(--lw-text-secondary);
  background: color-mix(in srgb, var(--lw-bg-base) 60%, transparent);
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 40%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
  font-style: italic;
}

.proposal-footer {
  display: flex;
  align-items: center;
}

.state-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  opacity: 0.8;
}
</style>
