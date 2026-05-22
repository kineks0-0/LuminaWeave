<template>
  <div class="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:bg-[var(--lw-bg-mask,rgba(0,0,0,0.4))] tw:p-5">
    <div :class="contentClass" @click.stop>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  width?: 'sm' | 'md' | 'lg';
}>(), {
  width: 'sm'
});

const contentClass = computed(() => cn(
  'tw:w-full tw:rounded-lw-lg tw:border tw:border-lw-border tw:bg-lw-surface tw:p-6 tw:shadow-lw-xl',
  props.width === 'sm' && 'tw:max-w-[400px]',
  props.width === 'md' && 'tw:max-w-[560px]',
  props.width === 'lg' && 'tw:max-w-[720px]'
));
</script>
