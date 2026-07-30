<template>
  <SurfaceOutlet
    :contract-id="props.contractId"
    :input="props.input"
    :desktop-mode-id="props.desktopModeId"
    :variant="skin.variant.value"
    :tokens="skin.tokens.value"
    :css-vars="skin.cssVars.value"
  />
</template>

<script setup lang="ts" generic="K extends SurfaceContractId">
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import SurfaceOutlet from './SurfaceOutlet.vue';
import type { SurfaceContractId, SurfaceInput } from './types.js';

defineOptions({
  inheritAttrs: false
});

const props = defineProps<{
  contractId: K;
  input: SurfaceInput<K>;
  desktopModeId: string;
}>();

const skin = useSurfaceSkin(props.contractId);
</script>
