<template>
  <button
    type="button"
    :class="toggleClass"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span :class="thumbClass" aria-hidden="true"></span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  disabled?: boolean;
}>(), {
  disabled: false
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();

const toggleClass = computed(() => cn(
  'tw:inline-flex tw:h-5 tw:w-9 tw:items-center tw:rounded-lw-pill tw:border tw:p-0.5 tw:transition-[background-color,border-color,opacity] tw:duration-150 tw:ease-out tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
  props.modelValue ? 'tw:border-lw-primary tw:bg-lw-primary' : 'tw:border-transparent tw:bg-lw-active'
));

const thumbClass = computed(() => cn(
  'tw:block tw:size-3.5 tw:rounded-lw-pill tw:bg-lw-elevated tw:shadow-lw tw:transition-transform tw:duration-150 tw:ease-out',
  props.modelValue && 'tw:translate-x-4'
));
</script>
