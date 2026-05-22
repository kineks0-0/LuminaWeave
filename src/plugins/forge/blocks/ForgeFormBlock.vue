<template>
  <LuminaPanel variant="elevated" padding="sm" class="tw:flex tw:flex-col tw:gap-2">
    <div class="tw:flex tw:flex-wrap tw:gap-2">
      <span class="tw:rounded-lw-pill tw:bg-lw-subtle tw:px-2 tw:py-1 tw:text-xs tw:font-bold tw:uppercase tw:text-lw-primary">{{ layer || 'forge' }}</span>
      <span class="tw:rounded-lw-pill tw:bg-lw-subtle tw:px-2 tw:py-1 tw:font-lw-mono tw:text-xs tw:text-lw-primary">{{ formId }}</span>
    </div>
    <div class="tw:text-[length:var(--lw-type-title-small-size)] tw:font-bold tw:text-lw-text tw:text-balance">{{ title }}</div>
    <div v-if="description" class="tw:text-xs tw:leading-5 tw:text-lw-text-secondary tw:text-pretty">{{ description }}</div>
    <div class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:pt-1">
      <div class="tw:text-xs tw:leading-5 tw:text-lw-text-muted tw:text-pretty">
        <template v-if="isSubmitted">这部分内容已提交给 Forge。</template>
        <template v-else>填写完成后，点击继续把当前表单结果提交给 Forge。</template>
      </div>
      <LuminaButton tone="primary" :disabled="isProcessing || isSubmitted" @click="submitForm">
        <template v-if="isSubmitted">已提交</template>
        <template v-else>保存当前层并继续</template>
      </LuminaButton>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardMakerStore } from '../CardMakerStore.js';
import { LuminaButton, LuminaPanel } from '../../../ui/primitives';

const props = defineProps<{
    formId: string;
    title: string;
    description?: string;
    layer?: string;
}>();

const store = useCardMakerStore();

const isSubmitted = computed(() => {
    return Boolean(store.structuredState.forms[props.formId]?.lastSubmittedAt);
});

const isProcessing = computed(() => store.isBusy);

const submitForm = () => {
    if (isSubmitted.value || isProcessing.value) return;
    void store.submitStructuredForm(props.formId);
};
</script>
