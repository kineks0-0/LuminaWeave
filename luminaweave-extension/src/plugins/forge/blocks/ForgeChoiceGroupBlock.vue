<template>
  <LuminaPanel variant="elevated" padding="sm" class="tw:flex tw:flex-col tw:gap-2.5">
    <div class="tw:text-xs tw:font-bold tw:text-lw-text tw:text-balance">{{ label }}</div>
    <div class="tw:flex tw:flex-wrap tw:gap-2">
      <button
        v-for="option in parsedOptions"
        :key="option.raw"
        type="button"
        :class="choiceOptionClass(option.body)"
        :disabled="disabledDueToClick"
        @click.stop="selectOption(option)"
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
import { computed, ref, watch, watchEffect, onMounted } from 'vue';
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

const choiceOptionClass = (body: string) => cn(
    'tw:flex tw:min-w-[min(260px,100%)] tw:flex-col tw:items-start tw:gap-1.5 tw:rounded-lw-md tw:border tw:border-lw-border tw:bg-lw-surface tw:p-3 tw:text-left tw:text-lw-text-secondary tw:outline-none tw:transition-[background-color,border-color,box-shadow,opacity] tw:duration-150 tw:ease-out tw:hover:bg-lw-hover tw:focus-visible:border-lw-primary tw:focus-visible:shadow-[0_0_0_3px_rgba(var(--lw-primary-rgb),0.12)] tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
    localValue.value === body && 'tw:border-lw-primary tw:bg-lw-subtle tw:text-lw-text',
    assistRecommendedSet.value.has(body) && 'tw:border-lw-primary tw:shadow-[0_0_0_2px_rgba(var(--lw-primary-rgb),0.06)]'
);

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
