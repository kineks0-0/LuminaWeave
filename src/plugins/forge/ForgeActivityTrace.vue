<script setup lang="ts">
import { useForgeStore } from '../../stores/useForgeStore';
import { computed } from 'vue';
import type { ForgeTimelineOperationItem } from '../../types/ForgeTimelineTypes.js';

const forgeStore = useForgeStore();
const operationItems = computed<ForgeTimelineOperationItem[]>(() =>
    forgeStore.timelineItems.filter((item): item is ForgeTimelineOperationItem => item.kind === 'operation')
);

const getTagColor = (tag: string) => {
    const map: Record<string, string> = {
        'forge_skill': '#3b82f6', // blue
        'draft_plan': '#8b5cf6',  // purple
        'entry_update': '#10b981', // emerald
        'skill': '#3b82f6',
        'plan': '#8b5cf6',
        'update': '#10b981',
    };
    return map[tag.toLowerCase()] || '#6b7280';
};

const getIcon = (type: ForgeTimelineOperationItem['operationKind']) => {
    switch (type) {
        case 'execution': return '🛠️';
        case 'plan': return '📝';
        case 'workspace_write': return '✨';
        case 'user_action': return '👤';
        case 'gate': return '⏸️';
        default: return '🔍';
    }
};
</script>

<template>
    <div class="activity-trace-root">
        <div class="header">
            <div class="header-copy">
                <span class="eyebrow">Activity</span>
                <span class="title">运行轨</span>
            </div>
            <button class="clear-btn" @click="forgeStore.clearAll">清空</button>
        </div>

        <div class="trace-list" ref="listRef">
            <TransitionGroup name="list">
                <div 
                    v-for="log in operationItems" 
                    :key="log.id" 
                    class="log-item"
                    :class="{ 'is-new': Date.now() - log.updatedAt < 1000 }"
                >
                    <div class="log-top">
                        <span class="icon">{{ getIcon(log.operationKind) }}</span>
                        <span class="tag" :style="{ color: getTagColor(log.sourceTag || log.operationKind) }">{{ log.sourceTag || log.operationKind }}</span>
                        <span class="time">{{ new Date(log.updatedAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</span>
                    </div>
                    <div class="status">{{ log.title }} · {{ log.summary }}</div>
                    <div v-if="log.detail" class="content-preview">
                        {{ log.detail.substring(0, 100) }}{{ log.detail.length > 100 ? '...' : '' }}
                    </div>
                </div>
            </TransitionGroup>

            <div v-if="operationItems.length === 0" class="empty-state">
                尚无运行记录
            </div>
        </div>
    </div>
</template>

<style scoped>
.activity-trace-root {
    display: flex;
    flex-direction: column;
    background:
      linear-gradient(180deg, rgba(var(--lw-bg-elevated-rgb), 0.12), rgba(var(--lw-bg-elevated-rgb), 0));
    height: 100%;
    width: 100%;
    color: var(--lw-text-main);
}

.header {
    padding: 16px 18px 12px;
    border-bottom: 1px solid var(--lw-border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.header-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.eyebrow {
    font-size: 10px;
    font-weight: 800;
    color: var(--lw-primary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.title {
    font-size: 15px;
    font-weight: 700;
    color: var(--lw-text-main);
}

.clear-btn {
    background: color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent);
    border: 1px solid var(--lw-border-base);
    font-size: 11px;
    color: var(--lw-text-secondary);
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 999px;
}

.clear-btn:hover {
    background: var(--lw-bg-subtle);
}

.trace-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.log-item {
    background: color-mix(in srgb, var(--lw-bg-elevated) 84%, transparent);
    border: 1px solid var(--lw-border-base);
    border-radius: 16px;
    padding: 12px;
}

.log-item.is-new {
    border-color: rgba(var(--lw-primary-rgb), 0.2);
    box-shadow: inset 0 0 0 1px rgba(var(--lw-primary-rgb), 0.04);
}

.log-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}

.icon {
    font-size: 14px;
    width: 20px;
    text-align: center;
}

.tag {
    font-size: 10px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 999px;
    text-transform: uppercase;
    background: var(--lw-bg-subtle);
}

.time {
    font-size: 10px;
    color: var(--lw-text-muted);
    margin-left: auto;
    font-family: monospace;
}

.status {
    font-size: 13px;
    color: var(--lw-text-main);
    font-weight: 500;
    line-height: 1.55;
}

.content-preview {
    margin-top: 8px;
    font-size: 11px;
    color: var(--lw-text-secondary);
    background: var(--lw-bg-subtle);
    padding: 8px;
    border-radius: 12px;
    font-family: ui-monospace, Consolas, monospace;
    line-height: 1.55;
}

.empty-state {
    text-align: center;
    padding-top: 40px;
    color: var(--lw-text-muted);
    font-size: 12px;
}

/* Transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}
.list-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
