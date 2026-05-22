<template>
  <LuminaPanel variant="elevated" padding="sm" class="tw:flex tw:flex-col tw:gap-2.5 tw:border-dashed">
    <div class="tw:text-xs tw:font-bold tw:text-lw-text tw:text-balance">{{ title }}</div>
    <div v-if="parsedFields.length > 0" class="tw:flex tw:flex-wrap tw:gap-2">
      <span v-for="field in parsedFields" :key="field" class="tw:inline-flex tw:rounded-lw-pill tw:bg-lw-subtle tw:px-2.5 tw:py-1.5 tw:text-xs tw:font-bold tw:text-lw-primary">{{ field }}</span>
    </div>
    <div v-else class="tw:text-xs tw:leading-5 tw:text-lw-text-secondary tw:text-pretty">当前层没有待补字段，后续也可以随时回来修改。</div>
    <LuminaButton class="tw:self-start" tone="primary" @click="submitCurrentForm">保存当前层并继续</LuminaButton>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { luminaWeaveApi } from '../../../api';
import { LuminaButton, LuminaPanel } from '../../../ui/primitives';

const props = defineProps<{
    formId: string;
    fields: string;
}>();

const parsedFields = computed(() => props.fields.split(',').map(item => item.trim()).filter(Boolean));
const title = computed(() => parsedFields.value.length > 0 ? '可继续补充这些字段' : '当前层可直接继续推进');
const submitCurrentForm = () => {
    luminaWeaveApi.forgeAgent.submitFormResult(props.formId, parsedFields.value.join('、'));
};
</script>
