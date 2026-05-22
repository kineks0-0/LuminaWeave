<template>
  <component :is="as" :class="panelClass">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../../../ui/cn.js';

const props = withDefaults(defineProps<{
  as?: string;
  interactive?: boolean;
}>(), {
  as: 'div',
  interactive: false
});

const panelClass = computed(() => cn(
  'settings-inset-panel tw:min-w-0 tw:rounded-lw-md tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:p-3',
  props.interactive && 'tw:transition-[background-color,border-color] tw:duration-150 tw:ease-out tw:hover:border-lw-border tw:hover:bg-lw-hover'
));
</script>
