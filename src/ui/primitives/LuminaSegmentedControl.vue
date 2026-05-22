<template>
  <div class="tw:flex tw:min-h-9 tw:flex-wrap tw:items-stretch tw:gap-0.5 tw:rounded-lw-pill tw:border tw:border-lw-border tw:bg-lw-subtle tw:p-0.5">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :class="optionClass(option.value)"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '../cn.js';

const props = defineProps<{
  modelValue: string;
  options: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

const optionClass = (value: string) => cn(
  'tw:min-h-8 tw:flex-1 tw:whitespace-nowrap tw:rounded-lw-pill tw:border-0 tw:bg-transparent tw:px-3 tw:text-xs tw:font-bold tw:text-lw-text-secondary tw:transition-[background-color,color,box-shadow] tw:duration-150 tw:ease-out tw:hover:text-lw-text',
  value === props.modelValue && 'tw:bg-lw-elevated tw:text-lw-text tw:shadow-lw'
);
</script>
