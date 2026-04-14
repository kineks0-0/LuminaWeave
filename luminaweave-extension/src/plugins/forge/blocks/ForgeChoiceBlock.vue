<template>
  <div class="forge-choice-block">
    <div class="forge-choice-header">Forge 选择动作</div>
    <div class="forge-choice-list">
      <button
        v-for="(opt, idx) in normalizedOptions"
        :key="`${idx}-${opt.label}`"
        class="forge-choice-item"
        @click="handleChoice(opt)"
      >
        <span class="forge-choice-index">{{ idx + 1 }}</span>
        <span class="forge-choice-label">{{ opt.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { luminaWeaveApi } from '../../../api';
import { useCardMakerStore } from '../CardMakerStore';
import type { ForgeLayer } from '../../../types/ForgeStructuredTypes.js';
import { splitForgeOptions } from '../../../api/core/utils/forgeDslUtils';

interface ChoiceOption {
    label: string;
    cmd?: string;
}

const props = defineProps<{
    options: string | Array<string | ChoiceOption>;
}>();

const store = useCardMakerStore();

const normalizedOptions = computed(() => {
    const opts = typeof props.options === 'string' 
        ? splitForgeOptions(props.options) 
        : props.options;

    return opts.map((item) => {
        if (typeof item === 'string') {
            return { label: item };
        }
        return item;
    });
});

const handleChoice = (option: ChoiceOption) => {
    const command = option.cmd || option.label;
    if (command.startsWith('layer:')) {
        luminaWeaveApi.forgeAgent.requestLayerAdvance(command.slice('layer:'.length) as ForgeLayer);
        return;
    }
    store.input = command;
};
</script>

<style scoped>
.forge-choice-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.forge-choice-header {
  font-size: 12px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.forge-choice-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.forge-choice-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
  cursor: pointer;
  text-align: left;
}

.forge-choice-index {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-primary);
  font-size: 11px;
  font-weight: 800;
}

.forge-choice-label {
  font-size: 13px;
  font-weight: 600;
}
</style>
