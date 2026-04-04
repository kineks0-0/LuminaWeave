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
  font-size: 53px;
  font-family: serif;
  color: var(--lw-primary, #8b5cf6);
  opacity: 0.15;
  user-select: none;
}

.quote-text {
  color: var(--lw-text-main, #334155);
  font-size: 14px;
  line-height: 1.6;
}

.quote-attribution {
  margin-top: 8px;
  font-size: 11px;
  color: var(--lw-text-light, #94a3b8);
  font-weight: 600;
  text-align: right;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

/* 暗色模式适配 */
:deep(.lw-chat-stream.theme-dark) .lv-quote-block {
  background: rgba(255, 255, 255, 0.05);
}
</style>
