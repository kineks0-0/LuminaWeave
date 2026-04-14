<template>
  <div class="forge-field-card">
    <span class="forge-field-label">{{ label }}</span>
    <div class="forge-check-list">
      <label v-for="option in parsedOptions" :key="option" class="forge-check-item">
        <input :checked="selectedSet.has(option)" type="checkbox" @change="toggleOption(option)" />
        <span>{{ option }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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
const selected = computed(() => store.getStructuredFieldList(props.formId, props.fieldKey || props.label));
const selectedSet = computed(() => new Set(selected.value));

const toggleOption = (option: string) => {
    const next = new Set(selectedSet.value);
    if (next.has(option)) {
        next.delete(option);
    } else {
        next.add(option);
    }
    store.setStructuredFieldValue(props.formId, props.fieldKey || props.label, Array.from(next));
};
</script>

<style scoped>
.forge-field-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.forge-check-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.forge-check-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 999px;
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  font-size: 12px;
  color: var(--lw-text-secondary);
}
</style>
