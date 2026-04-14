<template>
  <div class="forge-summary-card" :class="toneClass">
    <div class="forge-summary-title">{{ title }}</div>
    <div class="forge-summary-text">{{ summary }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    title: string;
    summary: string;
    tone?: string;
}>();

const toneClass = computed(() => props.tone ? `tone-${props.tone}` : '');
</script>

<style scoped>
.forge-summary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.forge-summary-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.forge-summary-text {
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  color: var(--lw-text-secondary);
}
</style>
