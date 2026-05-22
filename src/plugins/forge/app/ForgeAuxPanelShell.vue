<template>
  <section class="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:gap-3.5 tw:p-4">
    <header class="tw:flex tw:items-start tw:justify-between tw:gap-3">
      <div class="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
        <span v-if="kicker" class="tw:text-xs tw:font-bold tw:uppercase tw:text-lw-primary">{{ kicker }}</span>
        <h2 class="tw:m-0 tw:text-base tw:font-bold tw:leading-tight tw:text-lw-text tw:text-balance">{{ title }}</h2>
        <p v-if="subtitle" class="tw:m-0 tw:text-xs tw:leading-5 tw:text-lw-text-muted tw:text-pretty">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="tw:inline-flex tw:flex-wrap tw:items-center tw:gap-2">
        <slot name="actions" />
      </div>
    </header>

    <div class="tw:min-h-0 tw:flex-1 tw:overflow-auto">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  kicker?: string;
  subtitle?: string;
}>();
</script>
