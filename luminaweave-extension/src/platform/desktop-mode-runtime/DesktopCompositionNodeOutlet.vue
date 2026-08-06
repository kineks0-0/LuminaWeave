<template>
  <div
    v-if="node.visibility === 'visible'"
    class="lw-composition-node"
    :class="[
      `is-${node.kind}`,
      `is-${node.size}`,
      node.kind === 'group' ? `is-${node.direction}` : ''
    ]"
    :data-composition-node-id="node.id"
  >
    <template v-if="node.kind === 'group'">
      <DesktopCompositionNodeOutlet
        v-for="child in node.children"
        :key="getNodeRenderKey(child)"
        :node="child"
        :desktop-mode-id="desktopModeId"
      >
        <template #activity="slotProps">
          <slot name="activity" v-bind="slotProps" />
        </template>
      </DesktopCompositionNodeOutlet>
    </template>

    <ThemedSurfaceOutlet
      v-else-if="node.kind === 'surface'"
      :contract-id="node.contractId"
      :input="node.input"
      :desktop-mode-id="desktopModeId"
    />

    <slot v-else name="activity" :node="node" />
  </div>
</template>

<script setup lang="ts">
import type {
  DesktopCompositionActivitySlotNode,
  DesktopCompositionNode
} from '../../desktop-modes/core/types.js';
import ThemedSurfaceOutlet from '../surface/ThemedSurfaceOutlet.vue';

const props = defineProps<{
  node: DesktopCompositionNode;
  desktopModeId: string;
}>();

const getNodeRenderKey = (node: DesktopCompositionNode): string => [
  props.desktopModeId,
  node.id,
  node.kind,
  node.kind === 'surface' ? node.contractId : ''
].join(':');

defineSlots<{
  activity(props: { node: DesktopCompositionActivitySlotNode }): unknown;
}>();
</script>

<style scoped>
.lw-composition-node {
  min-width: 0;
  min-height: 0;
}

.lw-composition-node.is-group {
  display: flex;
  overflow: hidden;
}

.lw-composition-node.is-row {
  flex-direction: row;
}

.lw-composition-node.is-column {
  flex-direction: column;
}

.lw-composition-node.is-fill {
  flex: 1 1 0;
}

.lw-composition-node.is-content {
  flex: 0 0 auto;
}

.lw-composition-node.is-surface,
.lw-composition-node.is-activity-slot {
  display: flex;
  overflow: hidden;
}
</style>
