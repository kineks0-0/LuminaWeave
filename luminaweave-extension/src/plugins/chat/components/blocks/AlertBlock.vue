<template>
  <div class="lv-alert-block" :class="`type-${alertType}`">
    <div class="alert-icon">
      <!-- 根据类型显示不同的小图标 -->
      <svg v-if="alertType === 'warning'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
      </svg>
      <svg v-else-if="alertType === 'error' || alertType === 'danger'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <svg v-else-if="alertType === 'success'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </div>
    <div class="alert-content">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  type?: string;
  message: string;
}>();

const alertType = computed(() => {
  const t = props.type?.toLowerCase() || 'info';
  const mapping: Record<string, string> = {
    'warn': 'warning',
    'wrong': 'error',
    'danger': 'error',
    'ok': 'success',
  };
  return mapping[t] || t;
});
</script>

<style scoped>
.lv-alert-block {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid transparent;
  margin: 4px 0;
  transition: transform 0.2s;
}

.lv-alert-block:hover {
  transform: scale(1.01);
}

.alert-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-content {
  flex: 1;
  font-weight: 500;
}

/* 颜色方案 */
.type-info {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e40af;
}

.type-success {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}

.type-warning {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.type-error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}
</style>
