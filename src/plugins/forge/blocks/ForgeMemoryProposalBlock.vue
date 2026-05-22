<template>
  <LuminaPanel variant="elevated" padding="sm" class="tw:my-1.5 tw:flex tw:max-w-[420px] tw:flex-col tw:gap-2.5">
    <!-- Kicker -->
    <div class="tw:flex tw:items-center tw:gap-1.5">
      <span class="tw:size-1.5 tw:shrink-0 tw:rounded-lw-pill tw:bg-lw-primary"></span>
      <span class="tw:text-xs tw:font-bold tw:uppercase tw:text-lw-primary">记忆整理</span>
      <span class="tw:ml-auto tw:max-w-40 tw:truncate tw:font-lw-mono tw:text-xs tw:text-lw-text-muted">{{ path }}</span>
    </div>

    <!-- Title -->
    <div class="tw:text-[length:var(--lw-type-title-small-size)] tw:font-bold tw:leading-snug tw:text-lw-text tw:text-balance">{{ title }}</div>

    <!-- Content preview -->
    <div class="tw:whitespace-pre-wrap tw:break-words tw:rounded-lw-sm tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:px-3 tw:py-2.5 tw:text-xs tw:italic tw:leading-5 tw:text-lw-text-secondary tw:text-pretty">{{ previewText }}</div>

    <!-- Footer -->
    <div class="tw:flex tw:items-center">
      <span class="tw:text-xs tw:font-bold tw:text-lw-primary tw:opacity-80">已更新 Forge 记忆</span>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { LuminaPanel } from '../../../ui/primitives';

const props = defineProps<{
    path: string;
    title: string;
    content: string;
}>();

const previewText = computed(() =>
    props.content.slice(0, 140) + (props.content.length > 140 ? '…' : '')
);
</script>
