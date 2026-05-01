<template>
  <label class="forge-field-card">
    <span class="forge-field-label">{{ label }}</span>
    <textarea
      :value="value"
      class="forge-field-textarea"
      rows="4"
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
import { computed, watch } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { parseCompositePath } from '../../../api/core/utils/forgeDslUtils';

const props = defineProps<{
    fieldKey: string;
    messageId?: string;
    label: string;
    placeholder?: string;
}>();
const store = useCardMakerStore();

/** 核心路径解析：从单一 fieldKey 中拆分出 formId 与真实键名 */
const resolvedPath = computed(() => parseCompositePath(props.fieldKey));
const resolvedFormId = computed(() => resolvedPath.value[0]);
const resolvedFieldKey = computed(() => resolvedPath.value[1]);

const isBound = computed(() => {
    if (!resolvedFormId.value) return false;
    return store.hasStructuredFieldBinding(resolvedFormId.value, resolvedFieldKey.value);
});

const value = computed(() => {
    if (isBound.value) {
        return store.getStructuredFieldText(resolvedFormId.value!, resolvedFieldKey.value);
    }
    return store.getTransientFieldText(props.messageId, props.fieldKey);
});

/** 辅助池定位键：直接使用原始传入的路径字符串 */
const compositeKey = computed(() => props.fieldKey);

/** 从 assistPool 获取候选值（suggestion 模式显示为气泡） */
const assistCandidates = computed(() =>
    store.getAssistCandidates(compositeKey.value)
);

const splitSuggestions = computed(() =>
    assistCandidates.value.map(c => c.value)
);

/** prefill 模式：监听候选值，当字段为空时自动填入首个候选值 */
watch(assistCandidates, (candidates) => {
    if (store.formAssistanceMode !== 'prefill') return;
    if (candidates.length === 0) return;
    const firstVal = candidates[0].value;
    if (!firstVal) return;
    const currentVal = value.value;
    if (currentVal) return;
    applySuggestion(firstVal);
}, { immediate: true });

const handleInput = (event: Event) => {
    const nextValue = (event.target as HTMLTextAreaElement).value;
    if (isBound.value) {
        store.setStructuredFieldValue(resolvedFormId.value!, resolvedFieldKey.value, nextValue);
        return;
    }
    store.upsertTransientSelection(compositeKey.value, nextValue, props.messageId);
};

const applySuggestion = (sug: string) => {
    if (isBound.value) {
        store.setStructuredFieldValue(resolvedFormId.value!, resolvedFieldKey.value, sug);
        return;
    }
    // 临时表单统一使用复合键作为 key，确保与 assistPool 一致性并防止冲突
    store.upsertTransientSelection(compositeKey.value, sug, props.messageId);
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

.forge-field-textarea {
  appearance: none;
  border: 1px solid var(--lw-border-base) !important;
  border-radius: 12px;
  background: var(--lw-bg-surface) !important;
  color: var(--lw-text-main) !important;
  -webkit-text-fill-color: var(--lw-text-main);
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  font: inherit;
  outline: none;
  box-shadow: none;
}

.forge-field-textarea::placeholder {
  color: var(--lw-text-muted);
  -webkit-text-fill-color: var(--lw-text-muted);
}

.forge-field-textarea:focus {
  border-color: var(--lw-border-active) !important;
  box-shadow: 0 0 0 4px rgba(var(--lw-primary-rgb), 0.08);
}

.forge-field-textarea:disabled {
  background: color-mix(in srgb, var(--lw-bg-muted) 94%, white) !important;
  color: var(--lw-text-muted) !important;
  -webkit-text-fill-color: var(--lw-text-muted);
  border-color: var(--lw-border-subtle) !important;
  opacity: 1;
  cursor: not-allowed;
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
  background: var(--lw-primary);
  color: white;
  border-color: var(--lw-primary);
}
</style>
