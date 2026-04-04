<template>
  <div class="lv-badge-wrap">
    <span class="lv-badge" :class="variantClass">
      <span class="badge-label">{{ label }}</span>
      <span v-if="value" class="badge-separator"></span>
      <span v-if="value" class="badge-value">{{ value }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  label: string;
  value?: string;
  variant?: string;
}>(), {
  value: undefined,
  variant: undefined
});

const variantClass = computed(() => {
  // 查找顺序：显式 variant > 如果 value 是颜色名则用 value > default
  const supported = ['default', 'success', 'warning', 'danger', 'info', 'primary'];
  
  let v = props.variant?.toLowerCase();
  
  // 智能兼容逻辑：如果提供两个参数且第二个参数(value)是颜色关键词，则自动应用该主题
  if (!v && props.value) {
    const lowerVal = props.value.toLowerCase();
    if (supported.includes(lowerVal)) {
      v = lowerVal;
    }
  }
  
  v = v || 'default';
  return supported.includes(v) ? `variant-${v}` : 'variant-default';
});
</script>

<style scoped>
.lv-badge-wrap {
  display: inline-flex;
  margin: 2px 4px 2px 0;
  vertical-align: middle;
}

.lv-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.3px;
  border: 1px solid transparent;
  overflow: hidden;
  height: 20px;
}

.badge-label {
  padding: 0 8px;
  height: 100%;
  display: flex;
  align-items: center;
}

.badge-separator {
  width: 1px;
  height: 100%;
  background: currentColor;
  opacity: 0.15;
}

.badge-value {
  padding: 0 8px;
  opacity: 0.85;
  height: 100%;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.03);
}

/* 变体颜色 */
.variant-default {
  background: rgba(148, 163, 184, 0.1);
  color: #64748b;
  border-color: #e2e8f0;
}

.variant-primary {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border-color: rgba(139, 92, 246, 0.2);
}

.variant-success {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  border-color: rgba(34, 197, 94, 0.2);
}

.variant-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  border-color: rgba(245, 158, 11, 0.2);
}

.variant-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.2);
}

.variant-info {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  border-color: rgba(59, 130, 246, 0.2);
}

/** 暗色模式适配 */
:deep(.lw-chat-stream.theme-dark) .lv-badge {
  opacity: 0.8;
}
</style>
