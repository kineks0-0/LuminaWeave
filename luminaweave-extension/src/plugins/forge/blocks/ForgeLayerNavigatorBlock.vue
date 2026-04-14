<template>
  <div class="forge-layer-nav">
    <div
      v-for="(layerName, index) in layers"
      :key="layerName"
      class="forge-layer-step"
      :class="{ 'is-active': layerName === currentLayer, 'is-complete': completedSet.has(layerName) }"
    >
      <div v-if="index < layers.length - 1" class="forge-layer-line"></div>
      <button class="forge-layer-trigger" @click="luminaWeaveApi.forgeAgent.requestLayerAdvance(layerName)">
        <span class="forge-layer-node">{{ index + 1 }}</span>
        <span class="forge-layer-copy">
          <span class="forge-layer-name">{{ displayLabel(layerName) }}</span>
          <span class="forge-layer-status">
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
</script>

<style scoped>
.forge-layer-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.forge-layer-step {
  position: relative;
  padding-left: 8px;
}

.forge-layer-line {
  position: absolute;
  left: 22px;
  top: 34px;
  bottom: -10px;
  width: 1px;
  background: color-mix(in srgb, var(--lw-border-base) 90%, transparent);
}

.forge-layer-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.forge-layer-node {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
  font-size: 11px;
  font-weight: 800;
}

.forge-layer-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.forge-layer-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.forge-layer-status {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.forge-layer-step.is-active .forge-layer-node {
  background: #111111;
  border-color: #111111;
  color: var(--lw-text-inverse);
}

.forge-layer-step.is-active .forge-layer-status {
  color: var(--lw-primary);
}

.forge-layer-step.is-complete .forge-layer-node {
  border-color: rgba(var(--lw-primary-rgb), 0.18);
  color: var(--lw-primary);
  background: rgba(var(--lw-primary-rgb), 0.08);
}

.forge-layer-step.is-complete .forge-layer-line {
  background: rgba(var(--lw-primary-rgb), 0.22);
}
</style>
