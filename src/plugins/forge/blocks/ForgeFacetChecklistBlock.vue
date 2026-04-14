<template>
  <div class="forge-facet-card">
    <div class="forge-facet-label">{{ label }}</div>
    <div class="forge-facet-options">
      <button
        v-for="option in parsedOptions"
        :key="option"
        class="forge-facet-option"
        :class="{ 'is-active': selectedSet.has(option) }"
        @click="toggleOption(option)"
      >
        {{ option }}
      </button>
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
.forge-facet-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.forge-facet-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.forge-facet-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.forge-facet-option {
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-surface);
  color: var(--lw-text-secondary);
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.forge-facet-option.is-active {
  border-color: rgba(var(--lw-primary-rgb), 0.28);
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-text-main);
}
</style>
