<template>
  <div class="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
    <span class="tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted">{{ label }}</span>
    <span class="tw:text-[length:var(--lw-type-label-medium-size)] tw:font-[var(--lw-type-label-medium-weight)] tw:leading-[var(--lw-type-label-medium-line-height)] tw:text-lw-text">
      <slot />
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>
