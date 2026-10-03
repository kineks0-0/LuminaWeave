<template>
  <DesktopCompositionNodeOutlet
    :key="compositionRenderKey"
    :node="composition"
    :desktop-mode-id="desktopModeId"
    :navigation-collapsed="navigationCollapsed"
  >
    <template #activity="slotProps">
      <slot name="activity" v-bind="slotProps" />
    </template>
  </DesktopCompositionNodeOutlet>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { desktopModeRuntimeRegistry } from './DesktopModeRuntimeRegistry.js';
import DesktopCompositionNodeOutlet from './DesktopCompositionNodeOutlet.vue';

const props = withDefaults(defineProps<{
  desktopModeId: string;
  isMobile: boolean;
  /** 桌面模式导航收起时，隐藏标记了 collapsesWithNavigation 的节点 */
  navigationCollapsed?: boolean;
}>(), {
  navigationCollapsed: false
});

const viewport = computed(() => props.isMobile ? 'mobile' : 'desktop');
const composition = computed(() => desktopModeRuntimeRegistry.resolveComposition(
  props.desktopModeId,
  viewport.value
));
const compositionRenderKey = computed(() => [
  props.desktopModeId,
  viewport.value,
  composition.value.id
].join(':'));
</script>
