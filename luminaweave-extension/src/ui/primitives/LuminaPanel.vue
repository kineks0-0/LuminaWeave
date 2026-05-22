<template>
  <component :is="as" :class="panelClass">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  as?: string;
  variant?: 'plain' | 'surface' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}>(), {
  as: 'section',
  variant: 'surface',
  padding: 'md'
});

const panelClass = computed(() => cn(
  'tw:min-w-0 tw:border tw:border-lw-border',
  props.variant === 'plain' && 'tw:border-transparent tw:bg-transparent tw:shadow-none',
  props.variant === 'surface' && 'tw:rounded-lw-md tw:bg-lw-surface tw:shadow-lw',
  props.variant === 'elevated' && 'tw:rounded-lw-md tw:bg-lw-elevated tw:shadow-lw-card',
  props.padding === 'sm' && 'tw:p-3',
  props.padding === 'md' && 'tw:p-4',
  props.padding === 'lg' && 'tw:p-6',
  props.padding === 'none' && 'tw:p-0'
));
</script>
