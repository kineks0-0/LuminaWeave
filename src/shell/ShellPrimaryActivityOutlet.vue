<template>
  <DynamicTabOutlet
    v-if="activeDynamicTab"
    :tab="activeDynamicTab"
    :desktop-mode-id="runtimeContext.activeDesktopModeId"
    :is-mobile="runtimeContext.isMobile"
  />
  <ThemedSurfaceOutlet
    v-else-if="activeSurfaceContractId"
    :contract-id="activeSurfaceContractId"
    :input="activeSurfaceInput"
    :desktop-mode-id="runtimeContext.activeDesktopModeId"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getPrimarySurfaceContractIdForPlugin } from '../platform/plugin/officialPluginSurfaces.js';
import { projectSurfaceInput } from '../platform/surface/surfaceInputProjection.js';
import DynamicTabOutlet from './DynamicTabOutlet.vue';
import ThemedSurfaceOutlet from '../platform/surface/ThemedSurfaceOutlet.vue';
import type { ShellRuntimeContext, ShellRuntimeSurfaces } from './types.js';

const props = defineProps<{
  runtimeContext: ShellRuntimeContext;
  runtimeSurfaces: ShellRuntimeSurfaces;
}>();

const activeDynamicTab = computed(() => props.runtimeSurfaces.dynamicTabs.find(
  tab => tab.id === props.runtimeContext.activeMainTab
) || null);

const activePlugin = computed(() => props.runtimeSurfaces.traditional.mainPlugins.find(
  plugin => plugin.id === props.runtimeContext.activeMainTab
) || null);

const activeSurfaceContractId = computed(() => activePlugin.value
  ? getPrimarySurfaceContractIdForPlugin(activePlugin.value)
  : null
);

const activeSurfaceInput = computed(() => activeSurfaceContractId.value
  ? projectSurfaceInput(activeSurfaceContractId.value, {}, {
      activity: { size: 'default', pageType: 'nested' },
      isMobile: props.runtimeContext.isMobile
    })
  : {}
);
</script>
