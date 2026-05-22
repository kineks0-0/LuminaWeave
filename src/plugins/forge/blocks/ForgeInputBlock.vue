<template>
  <LuminaPanel as="label" variant="elevated" padding="sm" class="tw:flex tw:flex-col tw:gap-2">
    <span class="tw:text-xs tw:font-bold tw:text-lw-text tw:text-balance">{{ label }}</span>
    <LuminaInput
      :modelValue="value"
      type="text"
      :placeholder="placeholder || ''"
      :disabled="store.isBusy"
      @update:modelValue="handleInput"
    />
    <div v-if="splitSuggestions.length > 0" class="tw:mt-1 tw:flex tw:flex-wrap tw:gap-1.5">
      <LuminaButton
        v-for="sug in splitSuggestions"
        :key="sug"
        variant="soft"
        size="sm"
        @click="applySuggestion(sug)"
      >
        {{ sug }}
      </LuminaButton>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { LuminaButton, LuminaInput, LuminaPanel } from '../../../ui/primitives';
import { useCardMakerStore } from '../CardMakerStore.js';
import { parseCompositePath } from '../../../api/core/utils/forgeDslUtils.js';

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
    // 只有当前字段为空时才自动填入
    const currentVal = value.value;
    if (currentVal) return;
    applySuggestion(firstVal);
}, { immediate: true });

const handleInput = (nextValue: string) => {
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
