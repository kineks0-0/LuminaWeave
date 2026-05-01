<template>
  <label class="forge-field-card">
    <span class="forge-field-label">{{ label }}</span>
    <select :value="value" class="forge-field-select" :disabled="store.isBusy" @change="handleChange">
      <option value="">请选择</option>
      <option v-for="option in parsedOptions" :key="option.raw" :value="option.body">
        {{ option.actionLabel }}{{ assistRecommendedSet.has(option.body) ? ' ⭐' : '' }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { computed, watchEffect, onMounted } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { parseForgeRichOptions, parseCompositePath } from '../../../api/core/utils/forgeDslUtils';

const props = defineProps<{
    fieldKey: string;
    messageId?: string;
    label: string;
    options: string | string[];
}>();

const store = useCardMakerStore();

const parsedOptions = computed(() => parseForgeRichOptions(props.options));
/** 核心路径解析：从单一 fieldKey 中拆分出 formId 与真实键名 */
const resolvedPath = computed(() => parseCompositePath(props.fieldKey));
const resolvedFormId = computed(() => resolvedPath.value[0]);
const resolvedFieldKey = computed(() => resolvedPath.value[1]);

const isBound = computed(() => {
    if (!resolvedFormId.value) return false;
    return store.hasStructuredFieldBinding(resolvedFormId.value, resolvedFieldKey.value);
});

/** 构造复合定位键：直接使用原始传入的路径字符串 */
const compositeKey = computed(() => props.fieldKey);

const value = computed(() => {
    if (isBound.value) {
        return store.getStructuredFieldText(resolvedFormId.value!, resolvedFieldKey.value);
    }
    return store.getTransientFieldText(props.messageId, props.fieldKey);
});

watchEffect(() => {
    if (!isBound.value) {
        console.log(`[Forge-Select] 组件 "${props.label}" 运行在临时收集模式 (Temporary Mode)`);
    }
});

const handleChange = (event: Event) => {
    const nextValue = (event.target as HTMLSelectElement).value;
    updateValue(nextValue);
};

const updateValue = (nextValue: string) => {
    if (isBound.value) {
        store.setStructuredFieldValue(resolvedFormId.value!, resolvedFieldKey.value, nextValue);
        return;
    }
    // 临时表单统一使用复合键作为 key，确保与 assistPool 一致性并防止冲突
    store.upsertTransientSelection(compositeKey.value, nextValue, props.messageId);
}

/** 从 assistPool 读取候选值推荐 */
const assistCandidates = computed(() =>
    store.getAssistCandidates(compositeKey.value)
);

/** suggestion / prefill 模式：候选值的值集合 */
const assistRecommendedSet = computed((): Set<string> => {
    if (store.formAssistanceMode === 'off') return new Set();
    return new Set(assistCandidates.value.map(c => c.value));
});

/** prefill 模式：挂载时自动选中首个推荐项 */
onMounted(() => {
    if (store.formAssistanceMode !== 'prefill') return;
    const candidates = assistCandidates.value;
    if (candidates.length === 0) return;

    // 只在当前无选值时才自动选中
    if (value.value) return;

    const firstVal = candidates[0].value;
    if (parsedOptions.value.some(o => o.body === firstVal)) {
        updateValue(firstVal);
    }
});
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
  appearance: none;
  border: 1px solid var(--lw-border-base) !important;
  border-radius: 12px;
  background: var(--lw-bg-surface) !important;
  color: var(--lw-text-main) !important;
  -webkit-text-fill-color: var(--lw-text-main);
  padding: 10px 12px;
  font-size: 13px;
  font: inherit;
  outline: none;
  box-shadow: none;
}

.forge-field-select:focus {
  border-color: var(--lw-border-active) !important;
  box-shadow: 0 0 0 4px rgba(var(--lw-primary-rgb), 0.08);
}

.forge-field-select:disabled {
  background: color-mix(in srgb, var(--lw-bg-muted) 94%, white) !important;
  color: var(--lw-text-muted) !important;
  -webkit-text-fill-color: var(--lw-text-muted);
  border-color: var(--lw-border-subtle) !important;
  opacity: 1;
  cursor: not-allowed;
}

.forge-field-warning {
  font-size: 11px;
  line-height: 1.5;
  color: #b45309;
}
</style>
