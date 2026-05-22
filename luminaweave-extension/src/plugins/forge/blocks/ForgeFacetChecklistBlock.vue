<template>
  <LuminaPanel variant="elevated" padding="sm" class="tw:flex tw:flex-col tw:gap-2.5">
    <div class="tw:text-xs tw:font-bold tw:text-lw-text tw:text-balance">{{ label }}</div>
    <div class="tw:flex tw:flex-wrap tw:gap-2">
      <button
        v-for="option in parsedOptions"
        :key="option.raw"
        type="button"
        :class="facetOptionClass(option.body)"
        @click="toggleOption(option)"
      >
        <span class="tw:text-xs tw:leading-5 tw:text-lw-text tw:text-pretty">{{ option.body }}</span>
        <span class="tw:inline-flex tw:min-h-7 tw:items-center tw:justify-center tw:rounded-lw-pill tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:px-2.5 tw:text-xs tw:font-bold tw:text-lw-text-secondary">
          {{ option.actionLabel }}
          <span v-if="assistRecommendedSet.has(option.body)" class="tw:ml-1 tw:text-xs tw:opacity-70">⭐</span>
        </span>
      </button>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useCardMakerStore } from '../CardMakerStore.js';
import { parseForgeRichOptions, type ForgeRichOptionItem, parseCompositePath } from '../../../api/core/utils/forgeDslUtils.js';
import { cn } from '../../../ui/cn.js';
import { LuminaPanel } from '../../../ui/primitives';

const props = defineProps<{
    fieldKey: string;
    messageId?: string;
    label: string;
    options: string | string[];
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

/** 构造复合定位键：直接使用原始传入的路径字符串 */
const compositeKey = computed(() => props.fieldKey);

const parsedOptions = computed(() => parseForgeRichOptions(props.options));
const selected = computed(() => {
    if (isBound.value) {
        return store.getStructuredFieldList(resolvedFormId.value!, resolvedFieldKey.value);
    }
    return store.getTransientFieldList(props.messageId, props.fieldKey);
});
const selectedSet = computed(() => new Set(selected.value));

const toggleOption = (option: ForgeRichOptionItem) => {
    const next = new Set(selectedSet.value);
    if (next.has(option.body)) {
        next.delete(option.body);
    } else {
        next.add(option.body);
    }

    const nextValues = Array.from(next);
    if (isBound.value) {
        store.setStructuredFieldValue(resolvedFormId.value!, resolvedFieldKey.value, nextValues);
        return;
    }
    // 临时表单统一使用复合键作为 key，确保与 assistPool 一致性并防止冲突
    store.upsertTransientSelection(compositeKey.value, nextValues, props.messageId);
};

/** 从 assistPool 读取候选值推荐 */
const assistCandidates = computed(() =>
    store.getAssistCandidates(compositeKey.value)
);

/** suggestion / prefill 模式：候选值的值集合 */
const assistRecommendedSet = computed((): Set<string> => {
    if (store.formAssistanceMode === 'off') return new Set();
    return new Set(assistCandidates.value.map(c => c.value));
});

const facetOptionClass = (body: string) => cn(
    'tw:flex tw:min-w-[min(260px,100%)] tw:flex-col tw:items-start tw:gap-1.5 tw:rounded-lw-md tw:border tw:border-lw-border tw:bg-lw-surface tw:p-3 tw:text-left tw:text-lw-text-secondary tw:outline-none tw:transition-[background-color,border-color,box-shadow] tw:duration-150 tw:ease-out tw:hover:bg-lw-hover tw:focus-visible:border-lw-primary tw:focus-visible:shadow-[0_0_0_3px_rgba(var(--lw-primary-rgb),0.12)]',
    selectedSet.value.has(body) && 'tw:border-lw-primary tw:bg-lw-subtle tw:text-lw-text',
    assistRecommendedSet.value.has(body) && 'tw:border-lw-primary tw:shadow-[0_0_0_2px_rgba(var(--lw-primary-rgb),0.06)]'
);

/** prefill 模式：挂载时自动勾选所有推荐项 */
onMounted(() => {
    if (store.formAssistanceMode !== 'prefill') return;
    const candidates = assistCandidates.value;
    if (candidates.length === 0) return;
    // 只在当前无选项时才自动勾选
    if (selected.value.length > 0) return;
    const next = candidates.map(c => c.value).filter(Boolean);
    if (isBound.value) {
        store.setStructuredFieldValue(resolvedFormId.value!, resolvedFieldKey.value, next);
        return;
    }
    // 临时表单统一使用复合键
    store.upsertTransientSelection(compositeKey.value, next, props.messageId);
});
</script>
