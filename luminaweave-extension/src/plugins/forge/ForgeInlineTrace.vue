<template>
  <div class="inline-trace" :class="[operation.operationKind, operation.status, { expanded }]">
    <button class="trace-row" type="button" @click="toggleExpanded" :disabled="!canExpand">
      <span class="trace-lead">
        <span class="trace-label">{{ compactLabel }}</span>
        <span v-if="durationText" class="trace-duration">{{ durationText }}</span>
      </span>
      <span v-if="showSummary" class="trace-summary">{{ summaryText }}</span>
      <span class="trace-state">{{ stateGlyph }}</span>
    </button>

    <article v-if="expanded" class="trace-detail-panel">
      <div class="trace-detail-head">
        <div class="trace-detail-title">{{ operation.title }}</div>
        <div class="trace-detail-time">{{ timeText }}</div>
      </div>

      <p class="trace-detail-summary">{{ operation.summary }}</p>

      <div class="trace-meta">
        <span class="trace-pill">{{ statusLabel }}</span>
        <span class="trace-pill subtle">{{ kindLabel }}</span>
        <span v-if="operation.layer" class="trace-pill subtle">{{ operation.layer }}</span>
        <span v-if="operation.targetEntryId" class="trace-pill subtle">{{ compactTargetId }}</span>
        <span v-if="operation.sourceTag" class="trace-pill subtle">{{ operation.sourceTag }}</span>
      </div>

      <div v-if="previewEntry" class="inline-preview-container">
        <ForgeLorebookPreview :entry="previewEntry" minimal />
      </div>
      <pre v-else-if="operation.detail" class="trace-detail-content">{{ operation.detail }}</pre>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import type { ForgeTimelineOperationItem } from '../../types/ForgeTimelineTypes.js';
import { parseEntryUpdateXml } from '../../api/core/utils/forgeVirtualLorebook.js';
import ForgeLorebookPreview from './ForgeLorebookPreview.vue';

const props = defineProps<{
  operation: ForgeTimelineOperationItem;
}>();

const expanded = ref(false);
const now = ref(Date.now());
let timer: any = null;

const startTimer = () => {
  if (timer) return;
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
};

const stopTimer = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

watch(() => props.operation.status, (status) => {
  if (status === 'running') {
    startTimer();
  } else {
    stopTimer();
  }
}, { immediate: true });

onUnmounted(() => {
  stopTimer();
});

const previewEntry = computed(() => {
  if (props.operation.operationKind !== 'workspace_write') return null;
  if (!props.operation.detail || !props.operation.detail.includes('<entry_update')) return null;
  return parseEntryUpdateXml(props.operation.detail);
});

const kindLabel = computed(() => {
  if (props.operation.operationKind === 'analysis') return 'Thought';
  if (props.operation.operationKind === 'execution') return 'Execution';
  if (props.operation.operationKind === 'plan') return 'Planning';
  if (props.operation.operationKind === 'workspace_write') return 'Workspace';
  if (props.operation.operationKind === 'user_action') return 'Decision';
  if (props.operation.operationKind === 'gate') return 'Gate';
  return 'System';
});

const statusLabel = computed(() => {
  if (props.operation.status === 'running') return 'Running';
  if (props.operation.status === 'completed') return 'Completed';
  if (props.operation.status === 'blocked') return 'Blocked';
  if (props.operation.status === 'failed') return 'Failed';
  if (props.operation.status === 'cancelled') return 'Cancelled';
  return props.operation.status;
});

const compactLabel = computed(() => {
  if (props.operation.operationKind === 'analysis') return 'Thought';
  if (props.operation.operationKind === 'plan') return props.operation.status === 'running' ? 'Planning' : 'Planned';
  if (props.operation.operationKind === 'execution') return props.operation.status === 'running' ? 'Working' : 'Executed';
  if (props.operation.operationKind === 'workspace_write') return props.operation.status === 'running' ? 'Updating' : 'Updated';
  if (props.operation.operationKind === 'user_action') return 'Decision';
  if (props.operation.operationKind === 'gate') return 'Pending';
  return 'Action';
});

const timeText = computed(() => new Date(props.operation.updatedAt || props.operation.createdAt).toLocaleTimeString([], {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}));

const durationText = computed(() => {
  const start = props.operation.createdAt || props.operation.updatedAt;
  const isRunning = props.operation.status === 'running';
  const end = isRunning ? now.value : (props.operation.completedAt || props.operation.updatedAt);
  const seconds = Math.max(1, Math.round((end - start) / 1000));
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return `${seconds}s`;
});

const stateGlyph = computed(() => {
  if (props.operation.status === 'completed') return '✓';
  if (props.operation.status === 'running') return '…';
  if (props.operation.status === 'failed') return '!';
  if (props.operation.status === 'blocked') return '•';
  if (props.operation.status === 'cancelled') return '×';
  return '•';
});

const summaryText = computed(() => {
  if (props.operation.operationKind === 'analysis' || props.operation.operationKind === 'plan') {
    return props.operation.title;
  }
  return props.operation.summary || props.operation.title;
});

const showSummary = computed(() => Boolean(summaryText.value));

const compactTargetId = computed(() => {
  const value = props.operation.targetEntryId || '';
  if (!value) return '';
  return value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-4)}` : value;
});

const canExpand = computed(() => Boolean(
  props.operation.detail ||
  props.operation.layer ||
  props.operation.targetEntryId ||
  props.operation.sourceTag
));

const toggleExpanded = () => {
  if (!canExpand.value) return;
  expanded.value = !expanded.value;
};
</script>

<style scoped>
.inline-trace {
  width: min(760px, 100%);
  margin: 0 auto;
}

.trace-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 86%, transparent);
  background: color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent);
  color: var(--lw-text-main);
  text-align: left;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.trace-row:disabled {
  cursor: default;
}

.trace-row:not(:disabled):hover {
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, white);
  border-color: color-mix(in srgb, var(--lw-border-strong) 82%, transparent);
}

.inline-trace.running .trace-row {
  border-color: rgba(var(--lw-primary-rgb), 0.22);
  background: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.06) 72%, var(--lw-bg-elevated));
}

.trace-lead {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: fit-content;
}

.trace-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.trace-duration {
  font-size: 12px;
  color: var(--lw-text-muted);
}

.trace-summary {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--lw-text-secondary);
}

.trace-state {
  width: 18px;
  text-align: right;
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-muted);
}

.trace-detail-panel {
  margin-top: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 82%, transparent);
  background: color-mix(in srgb, var(--lw-bg-elevated) 98%, transparent);
}

.trace-detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
}

.trace-detail-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.trace-detail-time {
  font-size: 11px;
  color: var(--lw-text-muted);
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
}

.trace-detail-summary {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.trace-meta {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.trace-pill {
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 80%, transparent);
  background: color-mix(in srgb, var(--lw-bg-subtle) 82%, white);
  color: var(--lw-text-main);
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}

.trace-pill.subtle {
  color: var(--lw-text-secondary);
}

.trace-detail-content {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 78%, white);
  color: var(--lw-text-secondary);
  font-size: 11px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
}

.inline-preview-container {
  margin-top: 12px;
}

@media (max-width: 640px) {
  .trace-row {
    grid-template-columns: 1fr auto;
  }

  .trace-summary {
    grid-column: 1 / -1;
    white-space: normal;
  }

  .trace-detail-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
