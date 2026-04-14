<template>
  <label class="forge-field-card">
    <span class="forge-field-label">{{ label }}</span>
    <select :value="value" class="forge-field-select" :disabled="store.isBusy" @change="handleChange">
      <option value="">请选择</option>
      <option v-for="option in parsedOptions" :key="option" :value="option">{{ option }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { splitForgeOptions } from '../../../api/core/utils/forgeDslUtils';

const props = defineProps<{
    formId?: string;
    fieldKey?: string;
    label: string;
    options: string | string[];
}>();

const store = useCardMakerStore();

const parsedOptions = computed(() => splitForgeOptions(props.options));
const value = computed(() => store.getStructuredFieldText(props.formId, props.fieldKey || props.label));
const isBound = computed(() => {
    if (!props.formId || !props.fieldKey) return false;
    return store.hasStructuredFieldBinding(props.formId, props.fieldKey);
});

watchEffect(() => {
    if (!isBound.value) {
        console.log(`[Forge-Select] 组件 "${props.label}" 运行在临时收集模式 (Temporary Mode)`);
    }
});

const handleChange = (event: Event) => {
    const nextValue = (event.target as HTMLSelectElement).value;
    store.setStructuredFieldValue(props.formId, props.fieldKey || props.label, nextValue);
};
</script>

<style scoped>
.forge-field-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
}

.forge-field-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.forge-field-select {
  border: 1px solid var(--lw-border-base);
  border-radius: 12px;
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
  padding: 10px 12px;
  font-size: 13px;
}

.forge-field-warning {
  font-size: 11px;
  line-height: 1.5;
  color: #b45309;
}
</style>
