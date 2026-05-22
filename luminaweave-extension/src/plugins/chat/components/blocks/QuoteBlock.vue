<template>
  <div class="lv-quote-block">
    <div class="quote-symbol">“</div>
    <div class="quote-content">
      <div class="quote-text">{{ text }}</div>
      <div v-if="attribution" class="quote-attribution">—— {{ attribution }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text: string;
  attribution?: string;
}>();
</script>

<style scoped>
.lv-quote-block {
  position: relative;
  padding: 12px 16px 12px 32px;
  background: var(--lw-bg-sub, #f8fafc);
  border-left: 3px solid var(--lw-primary, #8b5cf6);
  border-radius: 4px 8px 8px 4px;
  margin: 8px 0;
  font-style: italic;
  overflow: hidden;
}

.quote-symbol {
  position: absolute;
  top: -10px;
  left: 6px;
  font-size: var(--lw-type-display-large-size);
  line-height: var(--lw-type-display-large-line-height);
  font-weight: var(--lw-type-display-large-weight);
  letter-spacing: var(--lw-type-display-large-tracking);
  font-family: serif;
  color: var(--lw-primary, #8b5cf6);
  opacity: 0.15;
  user-select: none;
}

.quote-text {
  color: var(--lw-text-main, #334155);
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  font-weight: var(--lw-type-body-medium-weight);
  letter-spacing: var(--lw-type-body-medium-tracking);
}

.quote-attribution {
  margin-top: 8px;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-light, #94a3b8);
  text-align: right;
  text-transform: uppercase;
}

/* 暗色模式适配 */
:deep(.lw-chat-stream.theme-dark) .lv-quote-block {
  background: rgba(255, 255, 255, 0.05);
}
</style>
