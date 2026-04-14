<template>
  <div class="forge-card">
    <div class="forge-card-title">{{ resolvedTitle }}</div>
    <div class="forge-mode-actions">
      <button class="forge-primary-btn" @click="store.chooseDetailMode('detailed')">
        {{ detailedText }}
      </button>
      <button class="forge-secondary-btn" @click="store.chooseDetailMode('quick')">
        {{ quickText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';

const props = defineProps<{
    title?: string;
    structuredLabel?: string;
    freeformLabel?: string;
}>();

const store = useCardMakerStore();

const resolvedTitle = computed(() => props.title || '选择 Forge 协作节奏');
const detailedText = computed(() => props.structuredLabel || '详细定制');
const quickText = computed(() => props.freeformLabel || '快速开始');
</script>

<style scoped>
.forge-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.forge-card-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.forge-mode-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.forge-primary-btn,
.forge-secondary-btn {
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--lw-transition);
}

.forge-primary-btn {
  border: 1px solid #111111;
  background: #111111;
  color: var(--lw-text-inverse);
}

.forge-secondary-btn {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
}
</style>
