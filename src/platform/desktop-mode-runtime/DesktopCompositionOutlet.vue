<template>
  <DesktopCompositionNodeOutlet
    v-if="composition"
    :key="compositionRenderKey"
    :node="composition"
    :desktop-mode-id="desktopModeId"
  >
    <template #activity="slotProps">
      <slot name="activity" v-bind="slotProps" />
    </template>
  </DesktopCompositionNodeOutlet>
  <slot v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { desktopModeRuntimeRegistry } from './DesktopModeRuntimeRegistry.js';
import DesktopCompositionNodeOutlet from './DesktopCompositionNodeOutlet.vue';

const props = defineProps<{
  desktopModeId: string;
  isMobile: boolean;
}>();

const viewport = computed(() => props.isMobile ? 'mobile' : 'desktop');
const composition = computed(() => desktopModeRuntimeRegistry.resolveComposition(
  props.desktopModeId,
  viewport.value
));
const compositionRenderKey = computed(() => [
  props.desktopModeId,
  viewport.value,
  composition.value?.id || 'empty'
].join(':'));
</script>
