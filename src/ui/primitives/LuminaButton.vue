<template>
  <button
    :type="type"
    :class="buttonClass"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="tw:size-3 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent" aria-hidden="true"></span>
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset';
  variant?: 'solid' | 'soft' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  tone?: 'neutral' | 'primary' | 'danger';
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
}>(), {
  type: 'button',
  variant: 'solid',
  size: 'md',
  tone: 'neutral',
  block: false,
  disabled: false,
  loading: false
});

const buttonClass = computed(() => cn(
  'tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:whitespace-nowrap tw:border tw:border-transparent tw:font-lw-main tw:font-bold tw:leading-none tw:outline-none tw:transition-[background-color,border-color,color,box-shadow,transform,opacity] tw:duration-150 tw:ease-out tw:disabled:pointer-events-none tw:disabled:opacity-50',
  props.block && 'tw:w-full',
  props.size === 'sm' && 'tw:min-h-8 tw:rounded-lw-sm tw:px-3 tw:text-xs',
  props.size === 'md' && 'tw:min-h-9 tw:rounded-lw-sm tw:px-3.5 tw:text-xs',
  props.size === 'lg' && 'tw:min-h-11 tw:rounded-lw-md tw:px-5 tw:text-sm',
  props.variant === 'solid' && props.tone === 'neutral' && 'tw:bg-lw-text tw:text-lw-text-inverse tw:hover:bg-lw-text-secondary',
  props.variant === 'solid' && props.tone === 'primary' && 'tw:bg-lw-primary tw:text-lw-text-inverse tw:hover:bg-lw-primary-strong',
  props.variant === 'solid' && props.tone === 'danger' && 'tw:bg-red-500 tw:text-white tw:hover:bg-red-600',
  props.variant === 'soft' && props.tone === 'neutral' && 'tw:border-lw-border tw:bg-lw-elevated tw:text-lw-text tw:hover:bg-lw-hover',
  props.variant === 'soft' && props.tone === 'primary' && 'tw:border-lw-border tw:bg-lw-subtle tw:text-lw-primary-strong tw:hover:bg-lw-hover',
  props.variant === 'soft' && props.tone === 'danger' && 'tw:border-red-200 tw:bg-red-50 tw:text-red-700 tw:hover:bg-red-100',
  props.variant === 'outline' && 'tw:border-lw-border tw:bg-transparent tw:text-lw-text tw:hover:bg-lw-hover',
  props.variant === 'ghost' && 'tw:bg-transparent tw:text-lw-text-secondary tw:hover:bg-lw-hover tw:hover:text-lw-text'
));
</script>
