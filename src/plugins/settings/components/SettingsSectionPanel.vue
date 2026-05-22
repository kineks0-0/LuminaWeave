<template>
  <LuminaPanel as="section" variant="elevated" padding="md" :class="panelClass">
    <slot />
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../../../ui/cn.js';
import { LuminaPanel } from '../../../ui/primitives';

const props = withDefaults(defineProps<{
  core?: boolean;
}>(), {
  core: false
});

const panelClass = computed(() => cn(
  'plugin-settings-block lw-card tw:flex tw:min-w-0 tw:flex-col tw:hover:border-lw-border tw:hover:shadow-none',
  props.core && 'core-block tw:col-span-full'
));
</script>
