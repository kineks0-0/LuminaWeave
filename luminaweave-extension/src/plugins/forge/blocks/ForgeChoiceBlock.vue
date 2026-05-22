<template>
  <LuminaPanel variant="elevated" padding="sm" class="tw:flex tw:flex-col tw:gap-2.5">
    <div class="tw:text-xs tw:font-bold tw:text-lw-text tw:text-balance">Forge 选择动作</div>
    <div class="tw:flex tw:flex-col tw:gap-2">
      <LuminaButton
        v-for="(opt, idx) in normalizedOptions"
        :key="`${idx}-${opt.label}`"
        variant="outline"
        size="lg"
        block
        class="tw:justify-start tw:whitespace-normal tw:text-left"
        @click="handleChoice(opt)"
      >
        <span class="tw:inline-flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lw-pill tw:bg-lw-subtle tw:text-xs tw:font-bold tw:text-lw-primary">{{ idx + 1 }}</span>
        <span class="tw:min-w-0 tw:text-sm tw:font-bold tw:text-lw-text tw:text-pretty">{{ opt.label }}</span>
      </LuminaButton>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { luminaWeaveApi } from '../../../api';
import { useCardMakerStore } from '../CardMakerStore.js';
import { LuminaButton, LuminaPanel } from '../../../ui/primitives';
import type { ForgeLayer } from '../../../types/ForgeStructuredTypes.js';
import { splitForgeOptions } from '../../../api/core/utils/forgeDslUtils.js';

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
