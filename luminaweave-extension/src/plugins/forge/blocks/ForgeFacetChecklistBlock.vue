<template>
  <div class="forge-facet-card">
    <div class="forge-facet-label">{{ label }}</div>
    <div class="forge-facet-options">
      <button
        v-for="option in parsedOptions"
        :key="option.raw"
        class="forge-facet-option"
        :class="{
          'is-active': selectedSet.has(option.body),
          'is-recommended': assistRecommendedSet.has(option.body)
        }"
        @click="toggleOption(option)"
      >
        <span class="forge-facet-body">{{ option.body }}</span>
        <span class="forge-facet-action">
          {{ option.actionLabel }}
          <span v-if="assistRecommendedSet.has(option.body)" class="forge-facet-assist-badge">⭐</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { parseForgeRichOptions, type ForgeRichOptionItem, parseCompositePath } from '../../../api/core/utils/forgeDslUtils';

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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: min(260px, 100%);
  border-radius: 18px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-surface);
  color: var(--lw-text-secondary);
  padding: 12px 14px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.forge-facet-option.is-active {
  border-color: rgba(var(--lw-primary-rgb), 0.28);
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-text-main);
}

.forge-facet-body {
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-main);
}

.forge-facet-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--lw-primary-rgb), 0.16);
  background: rgba(var(--lw-primary-rgb), 0.08);
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-secondary);
}

/* suggestion 模式：推荐项的光晕边框 */
.forge-facet-option.is-recommended {
  border-color: rgba(var(--lw-primary-rgb), 0.22);
  box-shadow: 0 0 0 2px rgba(var(--lw-primary-rgb), 0.06);
}

.forge-facet-assist-badge {
  font-size: 10px;
  margin-left: 4px;
  opacity: 0.7;
}
</style>
