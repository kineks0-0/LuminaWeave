<template>
  <SurfaceFailure v-if="failed" :contract-id="contractId" />
  <slot v-else />
</template>

<script setup lang="ts">
import { onErrorCaptured, ref, watch } from 'vue';
import SurfaceFailure from './SurfaceFailure.vue';
import type { SurfaceContractId } from './types.js';

const props = defineProps<{
  contractId: SurfaceContractId;
  ownerId: string;
}>();
const emit = defineEmits<{
  'renderer-failed': [];
}>();

const failed = ref(false);

watch(
  () => [props.contractId, props.ownerId],
  () => {
    failed.value = false;
  }
);

onErrorCaptured((error) => {
  failed.value = true;
  emit('renderer-failed');
  console.error('[SurfaceRuntime] Renderer failed', {
    contractId: props.contractId,
    ownerId: props.ownerId,
    error
  });
  return false;
});
</script>
