<template>
  <div class="forge-choice-card">
    <div class="forge-choice-label">{{ label }}</div>
    <div class="forge-choice-options">
      <button
        v-for="option in parsedOptions"
        :key="option"
        type="button"
        class="forge-choice-option"
        :class="{ 'is-active': localValue === option, 'is-disabled': disabledDueToClick }"
        :disabled="disabledDueToClick"
        @click.stop="selectOption(option)"
      >
        {{ option }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { splitForgeOptions } from '../../../api/core/utils/forgeDslUtils';

const props = defineProps<{
    formId?: string;
    fieldKey?: string;
    label: string;
    options: string | string[];
}>();

const store = useCardMakerStore();

const parsedOptions = computed(() => splitForgeOptions(props.options));
const isBound = computed(() => {
    if (!props.formId || !props.fieldKey) return false;
    const valid = store.hasStructuredFieldBinding(props.formId, props.fieldKey);
    return valid;
});

// 埋点：记录渲染时的绑定判定
watchEffect(() => {
    console.log(`[Forge-Render] 组件 "${props.label}" 渲染。绑定状态: ${isBound.value ? '已绑定 (Form)' : '未绑定 (Message)'}`, {
        formId: props.formId,
        fieldKey: props.fieldKey,
        options: props.options
    });
});


const value = computed(() => store.getStructuredFieldText(props.formId, props.fieldKey || props.label));

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


const selectOption = (option: string) => {
    const busy = store.isBusy;
    console.log(`[Forge-Click] 用户选中选项 "${option}" (组件: "${props.label}")。`, {
        isBusy: busy,
        isBound: isBound.value
    });

    if (disabledDueToClick.value) {
        console.warn(`[Forge-Click] 操作被拦截。原因: 系统繁忙 (Busy)`);
        return;
    }

    if (!isBound.value) {
        console.log(`[Forge-Click] 记入瞬态选值 (Message Mode): "${option}"`);
        unboundedValue.value = option;
        // 存入 Store 的瞬态存储，确保全局提交按钮能捞取到
        store.upsertTransientSelection(props.fieldKey || props.label, option);
        return;
    }
    
    console.log(`[Forge-Click] 写入表单字段 (Form Mode)："${props.fieldKey}" -> "${props.formId}"`);
    store.setStructuredFieldValue(props.formId!, props.fieldKey!, option);
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
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-surface);
  color: var(--lw-text-secondary);
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
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

.forge-choice-warning {
  font-size: 11px;
  line-height: 1.5;
  color: #b45309;
}
</style>
