<template>
  <div class="lv-progress-block">
    <div class="progress-info">
      <span class="progress-label">{{ label }}</span>
      <span class="progress-percentage">{{ Math.round(clampedValue) }}%</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: clampedValue + '%', background: barColor }">
        <div class="glow-effect"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  value: number;
}>();

const clampedValue = computed(() => {
  return Math.min(100, Math.max(0, props.value));
});

/** 根据进度百分比动态变换颜色 */
const barColor = computed(() => {
  const v = clampedValue.value;
  if (v > 80) return 'linear-gradient(90deg, #ef4444, #f43f5e)'; // 红色 (高警告)
  if (v > 50) return 'linear-gradient(90deg, #f59e0b, #fbbf24)'; // 橙色/黄色 (中)
  return 'linear-gradient(90deg, #3b82f6, #60a5fa)'; // 蓝色 (正常)
});
</script>

<style scoped>
.lv-progress-block {
  padding: 12px 14px;
  background: var(--lw-bubble, #ffffff);
  border: 1px solid var(--lw-border, #e2e8f0);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.lv-progress-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-color, #334155);
}

.progress-percentage {
  font-size: 12px;
  font-weight: 700;
  font-family: tabular-nums, sans-serif;
  color: var(--lw-primary, #8b5cf6);
}

.progress-track {
  width: 100%;
  height: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.glow-effect {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.3) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: progress-glow 2s infinite linear;
  background-size: 200% 100%;
}

@keyframes progress-glow {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
</style>
