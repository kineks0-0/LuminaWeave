<template>
  <textarea
    :class="textareaClass"
    :value="modelValue"
    :rows="rows"
    :disabled="disabled"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  modelValue?: string | number;
  rows?: number;
  invalid?: boolean;
  disabled?: boolean;
}>(), {
  modelValue: '',
  rows: 4,
  invalid: false,
  disabled: false
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

const textareaClass = computed(() => cn(
  'tw:w-full tw:resize-y tw:rounded-lw-sm tw:border tw:bg-lw-elevated tw:px-3 tw:py-2 tw:font-lw-main tw:text-sm tw:leading-6 tw:text-lw-text tw:outline-none tw:transition-[background-color,border-color,box-shadow,opacity] tw:duration-150 tw:ease-out placeholder:tw:text-lw-text-muted tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
  props.invalid ? 'tw:border-red-400 tw:focus:border-red-500 tw:focus:shadow-[0_0_0_4px_rgba(239,68,68,0.1)]' : 'tw:border-lw-border tw:focus:border-lw-primary tw:focus:shadow-[0_0_0_4px_rgba(var(--lw-primary-rgb),0.08)]'
));
</script>
