<template>
  <span :class="badgeClass">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../../../ui/cn.js';

const props = withDefaults(defineProps<{
  status?: 'idle' | 'syncing' | 'success' | 'error' | string;
}>(), {
  status: 'idle'
});

const badgeClass = computed(() => cn(
  'badge tw:rounded-lw-pill tw:px-2.5 tw:py-1 tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)]',
  props.status === 'idle' && 'idle tw:bg-lw-active tw:text-lw-text-secondary',
  props.status === 'syncing' && 'syncing tw:bg-lw-subtle tw:text-lw-primary',
  props.status === 'success' && 'success tw:bg-emerald-50 tw:text-emerald-700',
  props.status === 'error' && 'error tw:bg-red-50 tw:text-red-700'
));
</script>
