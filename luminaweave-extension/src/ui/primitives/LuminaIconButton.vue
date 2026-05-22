<template>
  <button
    type="button"
    :class="buttonClass"
    :aria-label="ariaLabel"
    :title="title || ariaLabel"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  ariaLabel: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'soft' | 'outline';
  tone?: 'neutral' | 'primary' | 'danger';
  disabled?: boolean;
}>(), {
  size: 'md',
  variant: 'ghost',
  tone: 'neutral',
  disabled: false
});

const buttonClass = computed(() => cn(
  'tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:border tw:border-transparent tw:outline-none tw:transition-[background-color,border-color,color,box-shadow,opacity] tw:duration-150 tw:ease-out tw:disabled:pointer-events-none tw:disabled:opacity-50',
  props.size === 'sm' && 'tw:size-8 tw:rounded-lw-sm',
  props.size === 'md' && 'tw:size-9 tw:rounded-lw-sm',
  props.size === 'lg' && 'tw:size-11 tw:rounded-lw-md',
  props.variant === 'ghost' && props.tone === 'neutral' && 'tw:bg-transparent tw:text-lw-text-secondary tw:hover:bg-lw-hover tw:hover:text-lw-text',
  props.variant === 'ghost' && props.tone === 'primary' && 'tw:bg-transparent tw:text-lw-primary tw:hover:bg-lw-subtle',
  props.variant === 'ghost' && props.tone === 'danger' && 'tw:bg-transparent tw:text-red-600 tw:hover:bg-red-50',
  props.variant === 'soft' && 'tw:border-lw-border tw:bg-lw-elevated tw:text-lw-text tw:hover:bg-lw-hover',
  props.variant === 'outline' && 'tw:border-lw-border tw:bg-transparent tw:text-lw-text tw:hover:bg-lw-hover'
));
</script>
