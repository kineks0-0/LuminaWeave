<template>
  <LuminaPanel variant="elevated" padding="md" class="tw:my-2 tw:flex tw:max-w-[400px] tw:flex-col tw:gap-3">
    <div class="tw:flex tw:flex-col tw:gap-1">
      <div class="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-bold tw:uppercase tw:text-lw-primary">
        <span aria-hidden="true">📋</span>
        A.U.T.O 制卡进度全景
      </div>
      <div class="tw:text-[length:var(--lw-type-title-medium-size)] tw:font-bold tw:text-lw-text tw:text-balance">当前任务清单</div>
    </div>
    
    <div class="tw:rounded-lw-sm tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:p-2">
      <div class="tw:flex tw:flex-col tw:gap-0.5">
        <div v-for="item in parsedItems" :key="item.id" :class="checklistItemClass(item.status)" :style="{ marginLeft: `${item.indent * 8}px` }">
          <div class="tw:flex tw:w-5 tw:justify-center tw:text-sm">
            <span v-if="item.status === 'completed'" class="tw:text-emerald-500">✅</span>
            <span v-else-if="item.status === 'partial'" class="tw:text-amber-500">✔️</span>
            <span v-else-if="item.status === 'pending'" class="tw:text-lw-text-dim tw:opacity-50">❎</span>
            <span v-else-if="item.status === 'blocked'" class="tw:text-red-500">🚫</span>
            <span v-else class="tw:text-lw-text-dim tw:opacity-50">❎</span>
          </div>
          <div class="tw:flex tw:min-w-0 tw:flex-col">
            <span :class="itemLabelClass(item.status)">{{ item.label }}</span>
            <span class="tw:font-lw-mono tw:text-xs tw:text-lw-text-dim tw:opacity-70 tw:truncate">{{ item.id }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="tw:mt-1 tw:flex tw:flex-col tw:gap-1.5">
      <div class="tw:h-1 tw:overflow-hidden tw:rounded-lw-pill tw:bg-lw-border">
        <div class="tw:h-full tw:bg-lw-primary" :style="{ width: `${progressPercent}%` }"></div>
      </div>
      <div class="tw:text-right tw:text-xs tw:font-bold tw:text-lw-text-dim tw:tabular-nums">{{ completedCount }} / {{ totalCount }} 已填毕</div>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../../../ui/cn.js';
import { LuminaPanel } from '../../../ui/primitives';

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

const checklistItemClass = (status: ListItem['status']) => cn(
    'tw:flex tw:items-center tw:gap-2.5 tw:rounded-lw-sm tw:px-2 tw:py-1.5 tw:hover:bg-lw-hover',
    status === 'completed' && 'tw:opacity-80'
);

const itemLabelClass = (status: ListItem['status']) => cn(
    'tw:text-sm tw:font-bold tw:text-lw-text tw:truncate',
    status === 'completed' && 'tw:text-lw-text-secondary tw:line-through'
);
</script>
