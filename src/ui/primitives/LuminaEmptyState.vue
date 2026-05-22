<template>
  <div :class="rootClass">
    <div v-if="$slots.icon" class="tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-lw-sm tw:bg-lw-subtle tw:text-lw-text-secondary">
      <slot name="icon" />
    </div>
    <div class="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
      <p class="tw:m-0 tw:text-sm tw:font-bold tw:leading-5 tw:text-lw-text-secondary tw:text-balance">{{ title }}</p>
      <p v-if="description" class="tw:m-0 tw:font-lw-mono tw:text-xs tw:leading-4 tw:text-lw-text-muted tw:text-pretty">{{ description }}</p>
    </div>
    <div v-if="$slots.action" class="tw:mt-2">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  title: string;
  description?: string;
  compact?: boolean;
}>(), {
  compact: false
});

const rootClass = computed(() => cn(
  'tw:flex tw:min-h-24 tw:min-w-0 tw:flex-col tw:gap-3 tw:rounded-lw-sm tw:border tw:border-dashed tw:border-lw-border tw:bg-lw-subtle tw:text-lw-text-muted',
  props.compact ? 'tw:p-3' : 'tw:p-4'
));
</script>
