<template>
  <LuminaPanel variant="elevated" padding="sm" :class="toneClass">
    <div class="tw:flex tw:flex-col tw:gap-2">
      <div class="tw:text-sm tw:font-bold tw:text-lw-text tw:text-balance">{{ title }}</div>
      <div class="tw:whitespace-pre-wrap tw:text-xs tw:leading-6 tw:text-lw-text-secondary tw:text-pretty">{{ summary }}</div>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { LuminaPanel } from '../../../ui/primitives';

const props = defineProps<{
    title: string;
    summary: string;
    tone?: string;
}>();

const toneClass = computed(() => {
  if (!props.tone) return '';
  if (props.tone === 'success') return 'tw:border-emerald-200';
  if (props.tone === 'warning') return 'tw:border-amber-200';
  if (props.tone === 'danger' || props.tone === 'error') return 'tw:border-red-200';
  return '';
});
</script>
