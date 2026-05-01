<template>
  <div class="lw-empty-surface" :data-surface-contract="contractId">
    <span class="lw-empty-surface-title">Surface unavailable</span>
    <span class="lw-empty-surface-id">{{ contractId }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  contractId: string;
}>();
</script>

<style scoped>
.lw-empty-surface {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 96px;
  padding: 16px;
  border: 1px dashed var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  color: var(--lw-text-muted);
  background: var(--lw-bg-subtle);
}

.lw-empty-surface-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-secondary);
}

.lw-empty-surface-id {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
