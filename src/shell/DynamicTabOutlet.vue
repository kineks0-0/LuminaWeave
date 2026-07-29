<template>
  <SurfaceOutlet
    v-if="resolved.surfaceContractId && surfaceInput"
    :contract-id="resolved.surfaceContractId"
    :input="surfaceInput"
    :desktop-mode-id="props.desktopModeId"
  />
  <component
    v-else-if="resolved.component"
    :is="resolved.component"
    v-bind="legacyComponentProps"
  />
  <SurfaceFailure
    v-else-if="resolved.error"
    :contract-id="resolved.unresolvedTargetId || props.tab.id"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SurfaceOutlet from '../platform/surface/SurfaceOutlet.vue';
import SurfaceFailure from '../platform/surface/SurfaceFailure.vue';
import { projectSurfaceInput } from '../platform/surface/surfaceInputProjection.js';
import type { DynamicTabConfig } from './types.js';
import { resolveDynamicTabTarget } from './dynamicTabResolver.js';
import { legacyTabComponentRegistry } from './legacyTabComponents.js';

defineOptions({
  inheritAttrs: false
});

const props = defineProps<{
  tab: DynamicTabConfig;
  desktopModeId: string;
  isMobile?: boolean;
  workspaceCompact?: boolean;
  auxSidebarMode?: 'left' | 'right' | 'widget' | 'hidden';
  activeRightPanelId?: string;
}>();

const resolved = computed(() =>
  resolveDynamicTabTarget(props.tab, legacyTabComponentRegistry)
);

const surfaceInput = computed(() => {
  const contractId = resolved.value.surfaceContractId;
  if (!contractId) return null;
  return projectSurfaceInput(contractId, resolved.value.props, {
    activity: props.tab.activity,
    isMobile: props.isMobile,
    workspaceCompact: props.workspaceCompact,
    auxSidebarMode: props.auxSidebarMode,
    activeRightPanelId: props.activeRightPanelId
  });
});

const legacyComponentProps = computed(() => ({
  ...resolved.value.props,
  isMobile: props.isMobile,
  workspaceCompact: props.workspaceCompact,
  auxSidebarMode: props.auxSidebarMode,
  activeRightPanelId: props.activeRightPanelId
}));
</script>
