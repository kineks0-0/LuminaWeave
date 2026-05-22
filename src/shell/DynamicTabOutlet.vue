<template>
  <SurfaceOutlet
    v-if="resolved.surfaceContractId"
    :contract-id="resolved.surfaceContractId"
    v-bind="{ ...resolved.props, ...attrs }"
  />
  <component
    v-else-if="resolved.component"
    :is="resolved.component"
    v-bind="{ ...resolved.props, ...attrs }"
  />
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import SurfaceOutlet from '../platform/surface/SurfaceOutlet.vue';
import type { DynamicTabConfig } from './types.js';
import { resolveDynamicTabTarget } from './dynamicTabResolver.js';
import { legacyTabComponentRegistry } from './legacyTabComponents.js';

defineOptions({
  inheritAttrs: false
});

const props = defineProps<{
  tab: DynamicTabConfig;
}>();

const attrs = useAttrs();

const resolved = computed(() =>
  resolveDynamicTabTarget(props.tab, legacyTabComponentRegistry)
);
</script>
