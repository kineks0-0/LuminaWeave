<template>
  <input
    :class="inputClass"
    :value="modelValue"
    :disabled="disabled"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  modelValue?: string | number;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  disabled?: boolean;
}>(), {
  modelValue: '',
  size: 'md',
  invalid: false,
  disabled: false
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

const inputClass = computed(() => cn(
  'tw:w-full tw:border tw:bg-lw-elevated tw:font-lw-main tw:text-lw-text tw:outline-none tw:transition-[background-color,border-color,box-shadow,opacity] tw:duration-150 tw:ease-out placeholder:tw:text-lw-text-muted tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
  props.size === 'sm' && 'tw:min-h-8 tw:rounded-lw-sm tw:px-3 tw:text-xs',
  props.size === 'md' && 'tw:min-h-10 tw:rounded-lw-sm tw:px-3 tw:text-sm',
  props.size === 'lg' && 'tw:min-h-11 tw:rounded-lw-md tw:px-4 tw:text-base',
  props.invalid ? 'tw:border-red-400 tw:focus:border-red-500 tw:focus:shadow-[0_0_0_4px_rgba(239,68,68,0.1)]' : 'tw:border-lw-border tw:focus:border-lw-primary tw:focus:shadow-[0_0_0_4px_rgba(var(--lw-primary-rgb),0.08)]'
));
</script>
