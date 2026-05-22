<template>
  <label :class="checkboxClass">
    <input
      type="checkbox"
      :class="inputClass"
      :checked="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span v-if="$slots.default" class="tw:min-w-0 tw:text-pretty">
      <slot />
    </span>
  </label>
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

const checkboxClass = computed(() => cn(
  'tw:inline-flex tw:min-w-0 tw:items-center tw:gap-2 tw:font-lw-main tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text',
  props.disabled ? 'tw:cursor-not-allowed tw:opacity-50' : 'tw:cursor-pointer'
));

const inputClass = computed(() => cn(
  'tw:size-3.5 tw:shrink-0 tw:accent-[var(--lw-primary)] tw:outline-none tw:transition-opacity tw:duration-150 tw:ease-out tw:disabled:cursor-not-allowed'
));
</script>
