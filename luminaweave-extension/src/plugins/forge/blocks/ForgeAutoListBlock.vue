<template>
  <div class="forge-auto-list-card">
    <div class="card-header">
      <div class="card-kicker">
        <span class="icon">📋</span>
        A.U.T.O 制卡进度全景
      </div>
      <div class="card-title">当前任务清单</div>
    </div>
    
    <div class="card-body">
      <div class="checklist-tree">
        <div v-for="item in parsedItems" :key="item.id" class="checklist-item" :class="[item.status]" :style="{ marginLeft: (item.indent * 8) + 'px' }">
          <div class="item-status">
            <span v-if="item.status === 'completed'" class="status-icon completed">✅</span>
            <span v-else-if="item.status === 'partial'" class="status-icon partial">✔️</span>
            <span v-else-if="item.status === 'pending'" class="status-icon pending">❎</span>
            <span v-else-if="item.status === 'blocked'" class="status-icon blocked">🚫</span>
            <span v-else class="status-icon pending">❎</span>
          </div>
          <div class="item-content">
            <span class="item-label">{{ item.label }}</span>
            <span class="item-id">{{ item.id }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div class="progress-text">{{ completedCount }} / {{ totalCount }} 已填毕</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    content: string;
}>();

interface ListItem {
    id: string;
    label: string;
    status: 'completed' | 'partial' | 'pending' | 'blocked' | 'none';
    indent: number;
}

const parsedItems = computed(() => {
    const lines = props.content.split('\n');
    const items: ListItem[] = [];
    
    // 匹配格式: - [x] label (id)
    const regex = /^(\s*)-\s*\[(x| |\/|-)\]\s*([^(]+)\s*(?:\(([^)]+)\))?/i;
    
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const indent = match[1].length;
            const statusChar = match[2].toLowerCase();
            const label = match[3].trim();
            const id = match[4] || label;
            
            let status: ListItem['status'] = 'pending';
            if (statusChar === 'x') status = 'completed';
            else if (statusChar === '/') status = 'partial';
            else if (statusChar === '-') status = 'blocked';
            
            items.push({ 
                id, 
                label, 
                status,
                indent // 新增缩进支持
            } as any);
        }
    });
    
    return items;
});

const totalCount = computed(() => parsedItems.value.length);
const completedCount = computed(() => parsedItems.value.filter(i => i.status === 'completed').length);
const progressPercent = computed(() => totalCount.value > 0 ? (completedCount.value / totalCount.value) * 100 : 0);
</script>

<style scoped>
.forge-auto-list-card {
  --accent-color: var(--lw-primary);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 96%, black);
  box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.1);
  margin: 8px 0;
  max-width: 400px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-kicker {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent-color);
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.card-body {
  background: color-mix(in srgb, var(--lw-bg-base) 40%, transparent);
  border-radius: 10px;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 30%, transparent);
}

.checklist-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.2s ease;
}

.checklist-item:hover {
  background: color-mix(in srgb, var(--lw-bg-base) 80%, transparent);
}

.item-status {
  font-size: 14px;
  width: 20px;
  display: flex;
  justify-content: center;
}

.status-icon.completed { color: #10b981; }
.status-icon.partial { color: #f59e0b; }
.status-icon.pending { color: var(--lw-text-tertiary); opacity: 0.5; }
.status-icon.blocked { color: #ef4444; }

.item-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-text-main);
}

.item-id {
  font-size: 10px;
  color: var(--lw-text-tertiary);
  font-family: var(--lw-font-mono, monospace);
  opacity: 0.7;
}

.checklist-item.completed .item-label {
  color: var(--lw-text-secondary);
  text-decoration: line-through;
  opacity: 0.8;
}

.card-footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.progress-bar {
  height: 4px;
  background: var(--lw-border-base);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-text {
  font-size: 10px;
  color: var(--lw-text-tertiary);
  text-align: right;
  font-weight: 600;
}
</style>
