<template>
  <div class="forge-choice-card">
    <div class="forge-choice-label">{{ label }}</div>
    <div class="forge-choice-options">
      <button
        v-for="option in parsedOptions"
        :key="option.raw"
        type="button"
        class="forge-choice-option"
        :class="{
          'is-active': localValue === option.body,
          'is-disabled': disabledDueToClick,
          'is-recommended': assistRecommendedSet.has(option.body)
        }"
        :disabled="disabledDueToClick"
        @click.stop="selectOption(option)"
      >
        <span class="forge-choice-body">{{ option.body }}</span>
        <span class="forge-choice-action">
          {{ option.actionLabel }}
          <span v-if="assistRecommendedSet.has(option.body)" class="forge-choice-assist-badge">⭐</span>
        </span>
      </button>
    </div>
  </div>
</template>


<script setup lang="ts">
import { computed, ref, watch, watchEffect, onMounted } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { parseForgeRichOptions, type ForgeRichOptionItem, parseCompositePath } from '../../../api/core/utils/forgeDslUtils';

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

// 埋点：记录渲染时的绑定判定
watchEffect(() => {
    console.log(`[Forge-Render] 组件 "${props.label}" 渲染。绑定状态: ${isBound.value ? '已绑定 (Form)' : '未绑定 (Message)'}`, {
        formId: resolvedFormId.value,
        fieldKey: resolvedFieldKey.value,
        options: props.options
    });
});


const value = computed(() => {
    if (isBound.value) {
        return store.getStructuredFieldText(resolvedFormId.value!, resolvedFieldKey.value);
    }
    return store.getTransientFieldText(props.messageId, props.fieldKey);
});

const isUnboundedClicked = ref(false);
const unboundedValue = ref<string | null>(null);

const localValue = computed(() => {
    if (isBound.value) return value.value;
    return unboundedValue.value;
});

const disabledDueToClick = computed(() => {
    if (store.isBusy) return true;
    return false;
});

// 解决组件复用问题：当选项或标签改变时，视为新组件，重置点击状态
watch(() => [props.options, props.label], () => {
    console.log(`[Forge-Choice] 检测到 Props 变更，重置组件 "${props.label}" 的本地点击状态。`);
    isUnboundedClicked.value = false;
    unboundedValue.value = null;
}, { deep: true });

/** 从 assistPool 读取候选值推荐 */
const assistCandidates = computed(() =>
    store.getAssistCandidates(compositeKey.value)
);

/** suggestion 模式：候选值的值集合，用于在选项卡片上标记推荐 ⭐ */
const assistRecommendedSet = computed((): Set<string> => {
    if (store.formAssistanceMode === 'off') return new Set();
    return new Set(assistCandidates.value.map(c => c.value));
});

/** prefill 模式：assistPool 注入后自动触发首个推荐选项的点击 */
onMounted(() => {
    if (store.formAssistanceMode !== 'prefill') return;
    const candidates = assistCandidates.value;
    if (candidates.length === 0) return;
    // 찾기：在 parsedOptions 里找到与第一个候选值匹配的项
    const firstVal = candidates[0].value;
    const matched = parsedOptions.value.find(o => o.body === firstVal || o.raw === firstVal);
    if (!matched) return;
    // 只在当前无选值时才自动选中
    if (localValue.value) return;
    selectOption(matched);
});



const selectOption = (option: ForgeRichOptionItem) => {
    const busy = store.isBusy;
    console.log(`[Forge-Click] 用户选中选项 "${option.body}" (组件: "${props.label}")。`, {
        isBusy: busy,
        isBound: isBound.value
    });

    if (disabledDueToClick.value) {
        console.warn(`[Forge-Click] 操作被拦截。原因: 系统繁忙 (Busy)`);
        return;
    }

    if (!isBound.value) {
        console.log(`[Forge-Click] 记入瞬态选值 (Message Mode): "${option.body}"`);
        unboundedValue.value = option.body;
        // 存入 Store 的瞬态存储，确保全局提交按钮能捞取到
        // 临时表单统一使用复合键作为 key，确保与 assistPool 一致性并防止冲突
        store.upsertTransientSelection(compositeKey.value, option.body, props.messageId);
        return;
    }
    
    console.log(`[Forge-Click] 写入表单字段 (Form Mode)："${resolvedFieldKey.value}" -> "${resolvedFormId.value}"`);
    store.setStructuredFieldValue(resolvedFormId.value!, resolvedFieldKey.value, option.body);
};
</script>

<style scoped>
.forge-choice-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(var(--lw-primary-rgb), 0.14);
  background: linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.07), rgba(var(--lw-primary-rgb), 0.02));
}

.forge-choice-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.forge-choice-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.forge-choice-option {
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

.forge-choice-option.is-disabled {
  opacity: 0.52;
  cursor: not-allowed;
}

.forge-choice-option.is-active {
  border-color: rgba(var(--lw-primary-rgb), 0.35);
  background: rgba(var(--lw-primary-rgb), 0.14);
  color: var(--lw-text-main);
}

.forge-choice-body {
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-main);
}

.forge-choice-action {
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

.forge-choice-warning {
  font-size: 11px;
  line-height: 1.5;
  color: #b45309;
}

/* suggestion 模式：推荐选项的微弱光晕边框 */
.forge-choice-option.is-recommended {
  border-color: rgba(var(--lw-primary-rgb), 0.22);
  box-shadow: 0 0 0 2px rgba(var(--lw-primary-rgb), 0.06);
}

.forge-choice-assist-badge {
  font-size: 10px;
  margin-left: 4px;
  opacity: 0.7;
}
</style>
