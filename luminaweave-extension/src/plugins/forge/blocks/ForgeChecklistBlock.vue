<template>
  <LuminaPanel variant="elevated" padding="sm">
    <span class="tw:text-xs tw:font-bold tw:text-lw-text tw:text-balance">{{ label }}</span>
    <div class="tw:mt-2 tw:flex tw:flex-wrap tw:gap-2">
      <label v-for="option in parsedOptions" :key="option" class="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-lw-pill tw:border tw:border-lw-border tw:bg-lw-surface tw:px-2.5 tw:py-2 tw:text-xs tw:text-lw-text-secondary">
        <input :checked="selectedSet.has(option)" type="checkbox" @change="toggleOption(option)" />
        <span>{{ option }}</span>
      </label>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { LuminaPanel } from '../../../ui/primitives';
import { useCardMakerStore } from '../CardMakerStore.js';
import { splitForgeOptions, parseCompositePath } from '../../../api/core/utils/forgeDslUtils.js';

const props = defineProps<{
    fieldKey: string;
    messageId?: string;
    label: string;
    options: string | string[];
}>();

const store = useCardMakerStore();

const parsedOptions = computed(() => splitForgeOptions(props.options));
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

const selected = computed(() => {
    if (isBound.value) {
        return store.getStructuredFieldList(resolvedFormId.value!, resolvedFieldKey.value);
    }
    return store.getTransientFieldList(props.messageId, props.fieldKey);
});
const selectedSet = computed(() => new Set(selected.value));

const toggleOption = (option: string) => {
    const next = new Set(selectedSet.value);
    if (next.has(option)) {
        next.delete(option);
    } else {
        next.add(option);
    }
    const nextValues = Array.from(next);
    if (isBound.value) {
        store.setStructuredFieldValue(resolvedFormId.value!, resolvedFieldKey.value, nextValues);
        return;
    }
    store.upsertTransientSelection(compositeKey.value, nextValues, props.messageId);
};
</script>
