<template>
  <LuminaPanel variant="elevated" padding="sm" class="tw:flex tw:flex-col tw:gap-3">
    <div class="tw:text-sm tw:font-bold tw:text-lw-text tw:text-balance">{{ resolvedTitle }}</div>
    <div class="tw:flex tw:flex-wrap tw:gap-2.5">
      <LuminaButton tone="primary" @click="store.chooseDetailMode('detailed')">
        {{ detailedText }}
      </LuminaButton>
      <LuminaButton variant="soft" @click="store.chooseDetailMode('quick')">
        {{ quickText }}
      </LuminaButton>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardMakerStore } from '../CardMakerStore.js';
import { LuminaButton, LuminaPanel } from '../../../ui/primitives';

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
