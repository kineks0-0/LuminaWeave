<template>
  <input
    type="range"
    :class="sliderClass"
    :value="modelValue"
    :disabled="disabled"
    @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  modelValue?: number;
  disabled?: boolean;
}>(), {
  modelValue: 0,
  disabled: false
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: number): void;
}>();

const sliderClass = computed(() => cn(
  'tw:h-2 tw:w-full tw:cursor-pointer tw:appearance-none tw:rounded-lw-pill tw:bg-lw-active tw:outline-none tw:disabled:cursor-not-allowed tw:disabled:opacity-50'
));
</script>
