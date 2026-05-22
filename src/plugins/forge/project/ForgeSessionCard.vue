<template>
  <div class="session-card" :class="{ active }">
    <div class="card-head">
      <span class="card-type">{{ badge }}</span>
      <span class="card-time">
        <span class="card-time-primary">{{ relativeTimeText }}</span>
        <span class="card-time-sep">·</span>
        <span>{{ timeText }}</span>
      </span>
    </div>
    <button class="card-main" @click="$emit('select')">
      <strong class="card-title">{{ title }}</strong>
      <p class="card-summary">{{ summary }}</p>
      <div class="card-meta">
        <span>{{ countLabel }}</span>
        <span v-if="subtitle">{{ subtitle }}</span>
      </div>
    </button>
    <div v-if="actionLabel || dangerActionLabel" class="card-actions">
      <button v-if="actionLabel" class="card-action-btn" @click="$emit('action')">{{ actionLabel }}</button>
      <button v-if="dangerActionLabel" class="card-action-btn danger" @click="$emit('danger-action')">{{ dangerActionLabel }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    title: string;
    summary: string;
    updatedAt: number;
    countLabel: string;
    badge: string;
    subtitle?: string;
    active?: boolean;
    actionLabel?: string;
    dangerActionLabel?: string;
}>();

defineEmits<{
    (e: 'select'): void;
    (e: 'action'): void;
    (e: 'danger-action'): void;
}>();

const timeText = computed(() => new Date(props.updatedAt).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
}));

const relativeTimeText = computed(() => {
    const delta = Date.now() - props.updatedAt;
    if (delta < 60_000) return '刚更新';
    if (delta < 10 * 60_000) return '最近活跃';
    if (delta < 60 * 60_000) return `${Math.max(1, Math.floor(delta / 60_000))} 分钟前`;
    return `${Math.max(1, Math.floor(delta / (60 * 60_000)))} 小时前`;
});
</script>

<style scoped>
.session-card {
  width: 100%;
  text-align: left;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 95%, transparent), color-mix(in srgb, var(--lw-bg-surface) 88%, transparent));
  border: 1px solid var(--lw-border-base);
  border-radius: 20px;
  padding: 14px;
  color: var(--lw-text-main);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.card-main {
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
}

.session-card:hover {
  background: color-mix(in srgb, var(--lw-bg-elevated) 98%, rgba(var(--lw-primary-rgb), 0.05));
  border-color: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.2) 72%, var(--lw-border-hover));
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06);
}

.session-card.active {
  border-color: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.34) 72%, var(--lw-border-active));
  box-shadow:
    0 16px 34px rgba(15, 23, 42, 0.08),
    0 0 0 3px rgba(var(--lw-primary-rgb), 0.08);
}

.card-head,
.card-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.card-type {
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-primary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.card-time-primary {
  color: var(--lw-text-secondary);
}

.card-time-sep {
  margin: 0 5px;
  opacity: 0.45;
}

.card-title {
  display: block;
  margin: 8px 0 7px;
  font-size: var(--lw-type-title-small-size);
  color: var(--lw-text-main);
}

.card-summary {
  margin: 0 0 12px;
  line-height: 1.6;
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-secondary);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.card-action-btn {
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  color: var(--lw-text-secondary);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
}

.card-action-btn.danger {
  color: var(--lw-danger, #b42318);
  border-color: color-mix(in srgb, var(--lw-danger, #b42318) 34%, var(--lw-border-base));
  background: color-mix(in srgb, var(--lw-danger, #b42318) 8%, var(--lw-bg-elevated));
}
</style>
