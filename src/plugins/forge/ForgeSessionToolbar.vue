<template>
  <div class="session-toolbar" :class="{ compact }">
    <div v-if="!compact" class="toolbar-context">
      <div class="toolbar-heading">
        <strong>{{ title }}</strong>
        <span v-if="subtitle" class="toolbar-subtitle">{{ subtitle }}</span>
      </div>
      <span v-if="isProcessing" class="toolbar-workflow">
        <span class="workflow-pill pulsing">处理中 / Processing</span>
      </span>
      <span v-else-if="workflowPhase" class="toolbar-workflow">
        <span class="workflow-pill">{{ workflowPhaseLabel }}</span>
        <span v-if="(workflowStagingCount || 0) > 0" class="workflow-meta">{{ workflowStagingCount }} 个待审修改</span>
        <span v-if="(workflowCommitReadyCount || 0) > 0" class="workflow-meta emphasis">{{ workflowCommitReadyCount }} 个待写回</span>
      </span>
      <span class="toolbar-meta">
        <span class="toolbar-meta-primary">{{ relativeUpdatedLabel }}</span>
      </span>
    </div>
    <div class="toolbar-actions">
      <span v-if="compact && isProcessing" class="workflow-pill pulsing" style="margin-right:8px;">处理中</span>
      <button class="toolbar-btn" @click="$emit('open-browser')">会话列表</button>
      <button v-if="hasReference" class="toolbar-btn warn" @click="$emit('clear-reference')">解绑参考</button>
      <button class="toolbar-btn subtle" @click="$emit('new-session')">新建会话</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ForgeVisiblePhase } from '../../types/ForgeWorkflowTypes.js';

const props = defineProps<{
    title: string;
    subtitle: string;
    updatedAt: number;
    hasReference?: boolean;
    workflowPhase?: ForgeVisiblePhase | null;
    workflowStagingCount?: number;
    workflowCommitReadyCount?: number;
    isProcessing?: boolean;
    compact?: boolean;
}>();

defineEmits<{
    (e: 'open-browser'): void;
    (e: 'new-session'): void;
    (e: 'clear-reference'): void;
}>();

const relativeUpdatedLabel = computed(() => {
    const delta = Date.now() - props.updatedAt;
    if (delta < 60_000) return '刚刚保存';
    if (delta < 10 * 60_000) return '最近活跃';
    if (delta < 60 * 60_000) return `${Math.max(1, Math.floor(delta / 60_000))} 分钟前`;
    return `${Math.max(1, Math.floor(delta / (60 * 60_000)))} 小时前`;
});

const workflowPhaseLabel = computed(() => {
    switch (props.workflowPhase) {
    case 'alignment':
        return '启动校准';
    case 'entity_world':
        return '角色与世界实体';
    case 'state_topology':
        return '状态与拓扑';
    case 'narrative_style':
        return '叙事与描写';
    case 'variables_index':
        return '变量与根目录';
    case 'output_delivery':
        return '输出交付';
    case 'kickoff':
        return '启动';
    case 'build':
        return '成型';
    case 'finalize':
        return '审阅导出';
    default:
        return '规划';
    }
});
</script>

<style scoped>
.session-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px 14px;
  min-width: 0;
}

.session-toolbar.compact {
  grid-template-columns: auto;
  justify-content: end;
}

.toolbar-context {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 6px;
}

.toolbar-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.toolbar-context strong {
  font-size: 13px;
  color: var(--lw-text-main);
  white-space: nowrap;
}

.toolbar-context span {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.toolbar-subtitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-workflow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  min-width: 0;
}

.workflow-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-primary-soft) 90%, white);
  color: var(--lw-primary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.workflow-meta {
  color: var(--lw-text-secondary);
}

.workflow-meta.emphasis {
  color: var(--lw-primary);
}

.toolbar-meta {
  opacity: 0.8;
}

.toolbar-meta-primary {
  color: var(--lw-text-secondary);
}

.toolbar-actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-btn {
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  color: var(--lw-text-main);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: var(--lw-transition);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.toolbar-btn:hover {
  border-color: var(--lw-border-hover);
  background: var(--lw-bg-subtle);
}

.toolbar-btn.subtle {
  color: var(--lw-primary);
}

.toolbar-btn.warn {
  color: #f1c48b;
}

@media (max-width: 960px) {
  .session-toolbar {
    grid-template-columns: 1fr;
  }

  .toolbar-actions {
    justify-content: flex-start;
  }
}
</style>

.workflow-pill.pulsing {
  background: rgba(var(--lw-primary-rgb), 0.15);
  color: var(--lw-primary);
  border-color: rgba(var(--lw-primary-rgb), 0.3);
  animation: lw-forge-pulse 1.5s infinite;
}

@keyframes lw-forge-pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
