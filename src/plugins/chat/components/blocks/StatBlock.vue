<template>
  <div class="lv-stat-block">
    <div class="stat-icon-area">
      <div class="stat-icon-circle" :style="{ background: iconBg }">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </div>
    </div>
    <div class="stat-body">
      <div class="stat-header">
        <span class="stat-label">{{ label }}</span>
        <span class="stat-value" :style="{ color: accentColor }">{{ value }}<span v-if="max" class="stat-max">/ {{ max
            }}</span></span>
      </div>
      <div class="stat-bar-track" v-if="max">
        <div class="stat-bar-fill" :style="{ width: percentage + '%', background: barGradient }"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  label: string;
  value: number;
  max?: number;
}>(), {
  max: undefined
});

const percentage = computed(() => {
  if (!props.max || props.max <= 0) return 100;
  return Math.min(100, Math.max(0, (props.value / props.max) * 100));
});

/** 根据百分比动态计算色相，形成从红到绿的渐变 */
const accentColor = computed(() => {
  if (!props.max) return 'var(--lw-primary)';
  const hue = percentage.value * 1.2; // 0% → 红色(0°)，100% → 绿色(120°)
  return `hsl(${hue}, 70%, 45%)`;
});

const iconBg = computed(() => {
  if (!props.max) return 'var(--lw-primary-bg)';
  const hue = percentage.value * 1.2;
  return `hsl(${hue}, 70%, 95%)`;
});

const barGradient = computed(() => {
  if (!props.max) return 'var(--lw-primary)';
  const hue = percentage.value * 1.2;
  return `linear-gradient(90deg, hsl(${hue}, 75%, 50%), hsl(${hue + 15}, 65%, 55%))`;
});
</script>

<style scoped>
.lv-stat-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--lw-bubble, #ffffff);
  border: 1px solid var(--lw-border, #e2e8f0);
  border-radius: 10px;
  transition: box-shadow 0.2s, transform 0.15s;
}

.lv-stat-block:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.stat-icon-area {
  flex-shrink: 0;
}

.stat-icon-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s;
}

.stat-body {
  flex: 1;
  min-width: 0;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--lw-color, #334155);
  opacity: 0.75;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.stat-value {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stat-max {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.5;
  margin-left: 2px;
}

.stat-bar-track {
  width: 100%;
  height: 5px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
