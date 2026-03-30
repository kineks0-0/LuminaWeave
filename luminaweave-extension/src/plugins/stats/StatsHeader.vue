<template>
  <div class="status-bar-wrapper">
    <div class="status-bar">
      <span>当前状态</span>
      <span class="status-icon"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2"
          fill="none" class="icon-red">
          <path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z">
          </path>
        </svg></span>
      <div class="status-progress">
        <div class="progress-fill hp" :style="{ width: getStatValue('hp', 85) + '%' }"></div>
      </div>
      <span class="status-val hp-val">{{ getStatValue('hp', 85) }}%</span>
      <span class="divider"></span>
      <span class="status-icon"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2"
          fill="none" class="icon-blue">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 17 22 12"></polyline>
        </svg></span>
      <div class="status-progress">
        <div class="progress-fill mp" :style="{ width: getStatValue('sanity', 62) + '%' }"></div>
      </div>
      <span class="status-val mp-val">{{ getStatValue('sanity', 62) }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { LuminaWeaveAPI } from '../../api/index';

const lwApi = inject<LuminaWeaveAPI>('lwApi');

const getStatValue = (key: string, fallback: number): number => {
  if (!lwApi) return fallback;
  const val = lwApi.getState(key);
  return val !== undefined ? val : fallback;
};
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ffffff;
  padding: 6px 16px;
  border-radius: 16px;
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.status-progress {
  width: 60px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.progress-fill.hp {
  background: #fb7185;
}

.progress-fill.mp {
  background: var(--lw-primary);
}

.status-val {
  width: 30px;
}

.divider {
  width: 1px;
  height: 12px;
  background: #cbd5e1;
  margin: 0 4px;
}

.icon-red {
  color: #fb7185;
}

.icon-blue {
  color: var(--lw-primary);
}
@media (max-width: 768px) {
  .status-bar-wrapper {
    display: none;
  }
}
</style>
