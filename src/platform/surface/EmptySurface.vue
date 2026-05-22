<template>
  <LuminaEmptyState
    title="Surface unavailable"
    :description="contractId"
    :data-surface-contract="contractId"
  />
</template>

<script setup lang="ts">
import { LuminaEmptyState } from '../../ui/primitives';

defineProps<{
  contractId: string;
}>();
</script>
