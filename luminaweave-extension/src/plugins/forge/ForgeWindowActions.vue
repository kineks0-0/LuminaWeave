<template>
  <div class="forge-window-actions" :class="[`presentation-${presentation}`]" @pointerdown.stop>
    <button class="action-btn subtle" type="button" title="重置会话" @pointerdown.stop @click="store.resetSession">
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      <span>重置会话</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useCardMakerStore } from './CardMakerStore';

withDefaults(defineProps<{
  presentation?: 'hero' | 'window';
}>(), {
  presentation: 'window'
});

const store = useCardMakerStore();
</script>

<style scoped>
.forge-window-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.action-btn {
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 86%, white);
  background: color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent);
  color: var(--lw-text-main);
  padding: 9px 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--lw-transition);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.action-btn:hover {
  border-color: var(--lw-border-hover);
  background: var(--lw-bg-hover);
}

.action-btn.subtle {
  color: var(--lw-text-secondary);
}

.presentation-window .action-btn {
  padding: 7px 12px;
  font-size: 11px;
}
</style>
