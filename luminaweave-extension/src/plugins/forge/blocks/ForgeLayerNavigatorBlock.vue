<template>
  <div class="tw:flex tw:flex-col tw:gap-0.5">
    <div
      v-for="(layerName, index) in layers"
      :key="layerName"
      class="tw:relative tw:pl-2"
    >
      <div v-if="index < layers.length - 1" :class="layerLineClass(layerName)"></div>
      <button type="button" class="tw:flex tw:w-full tw:items-center tw:gap-3 tw:border-0 tw:bg-transparent tw:px-0 tw:py-2 tw:text-left tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-lw-primary" @click="luminaWeaveApi.forgeAgent.requestLayerAdvance(layerName)">
        <span :class="layerNodeClass(layerName)">{{ index + 1 }}</span>
        <span class="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
          <span class="tw:text-xs tw:font-bold tw:text-lw-text tw:truncate">{{ displayLabel(layerName) }}</span>
          <span :class="layerStatusClass(layerName)">
            {{ layerName === currentLayer ? '当前阶段' : completedSet.has(layerName) ? '已完成' : '后续阶段' }}
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { luminaWeaveApi } from '../../../api';
import type { ForgeLayer } from '../../../types/ForgeStructuredTypes.js';
import { cn } from '../../../ui/cn.js';

const props = defineProps<{
    currentLayer: string;
    availableLayers: string;
    completedLayers?: string;
}>();

const layers = computed(() => props.availableLayers.split('|').map(item => item.trim()).filter(Boolean) as ForgeLayer[]);
const completedSet = computed(() => new Set((props.completedLayers || '').split('|').map(item => item.trim()).filter(Boolean)));

const displayLabel = (layerName: ForgeLayer): string => {
    switch (layerName) {
    case 'concept':
        return '概念';
    case 'entity':
        return '实体';
    case 'state_machine':
        return '状态机';
    case 'description':
        return '描写';
    case 'variables':
        return '变量';
    case 'summary':
        return '汇总';
    case 'output':
        return '输出';
    default:
        return layerName;
    }
};

const layerNodeClass = (layerName: ForgeLayer) => cn(
    'tw:inline-flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lw-pill tw:border tw:border-lw-border tw:bg-lw-elevated tw:text-xs tw:font-bold tw:text-lw-text-secondary',
    layerName === props.currentLayer && 'tw:border-lw-text tw:bg-lw-text tw:text-lw-text-inverse',
    completedSet.value.has(layerName) && layerName !== props.currentLayer && 'tw:border-lw-primary tw:bg-lw-subtle tw:text-lw-primary'
);

const layerStatusClass = (layerName: ForgeLayer) => cn(
    'tw:text-xs tw:text-lw-text-muted',
    layerName === props.currentLayer && 'tw:text-lw-primary'
);

const layerLineClass = (layerName: ForgeLayer) => cn(
    'tw:absolute tw:left-[22px] tw:top-[34px] tw:bottom-[-10px] tw:w-px tw:bg-lw-border',
    completedSet.value.has(layerName) && 'tw:bg-lw-primary'
);
</script>
