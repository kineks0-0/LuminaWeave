<template>
  <div class="block-header tw:mb-1 tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-lw-border-subtle tw:pb-3.5 tw:max-[720px]:items-start">
    <div class="block-title tw:flex tw:min-w-0 tw:items-center tw:gap-2.5 tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text tw:text-balance">
      <slot name="icon" />
      <span class="tw:min-w-0 tw:truncate">{{ title }}</span>
    </div>
    <div v-if="$slots.actions" class="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>
