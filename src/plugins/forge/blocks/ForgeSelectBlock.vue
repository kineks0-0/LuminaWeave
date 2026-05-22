<template>
  <LuminaPanel as="label" variant="elevated" padding="sm" class="tw:flex tw:flex-col tw:gap-2">
    <span class="tw:text-xs tw:font-bold tw:text-lw-text tw:text-balance">{{ label }}</span>
    <LuminaSelect :modelValue="value" :disabled="store.isBusy" @update:modelValue="updateValue">
      <option value="">请选择</option>
      <option v-for="option in parsedOptions" :key="option.raw" :value="option.body">
        {{ option.actionLabel }}{{ assistRecommendedSet.has(option.body) ? ' ⭐' : '' }}
      </option>
    </LuminaSelect>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed, watchEffect, onMounted } from 'vue';
import { LuminaPanel, LuminaSelect } from '../../../ui/primitives';
import { useCardMakerStore } from '../CardMakerStore.js';
import { parseForgeRichOptions, parseCompositePath } from '../../../api/core/utils/forgeDslUtils.js';

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
