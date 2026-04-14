<template>
  <label class="forge-field-card">
    <span class="forge-field-label">{{ label }}</span>
    <input
      :value="value"
      class="forge-field-input"
      type="text"
      :placeholder="placeholder || ''"
      :disabled="store.isBusy"
      @input="handleInput"
    />
    <div v-if="splitSuggestions.length > 0" class="forge-suggestions">
      <button
        v-for="sug in splitSuggestions"
        :key="sug"
        class="forge-suggestion-chip"
        type="button"
        @click="applySuggestion(sug)"
      >
        {{ sug }}
      </button>
    </div>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { splitForgeOptions } from '../../../api/core/utils/forgeDslUtils';

const props = defineProps<{
    formId?: string;
    fieldKey?: string;
    label: string;
    placeholder?: string;
    suggestions?: string | string[];
}>();

const store = useCardMakerStore();

const value = computed(() => store.getStructuredFieldText(props.formId, props.fieldKey || props.label));

const splitSuggestions = computed(() => splitForgeOptions(props.suggestions));

const handleInput = (event: Event) => {
    const nextValue = (event.target as HTMLInputElement).value;
    store.setStructuredFieldValue(props.formId, props.fieldKey || props.label, nextValue);
};

const applySuggestion = (sug: string) => {
    store.setStructuredFieldValue(props.formId, props.fieldKey || props.label, sug);
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

.forge-field-input {
  border: 1px solid var(--lw-border-base);
  border-radius: 12px;
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
  padding: 10px 12px;
  font-size: 13px;
}

.forge-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.forge-suggestion-chip {
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-base);
  color: var(--lw-text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.forge-suggestion-chip:hover {
  background: var(--lw-color-primary);
  color: white;
  border-color: var(--lw-color-primary);
}
</style>
