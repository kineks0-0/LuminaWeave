<template>
  <div class="lw-freeform-scene" @pointerdown.self="onHandleFreeformScenePointerDown">
    <TransitionGroup name="workspace-window-motion" appear>
      <WorkspaceWindow
        v-for="entry in activeStageWindowEntries"
        :key="entry.id"
        :x="entry.layout.x"
        :y="entry.layout.y"
        :width="entry.layout.width"
        :height="entry.layout.height"
        :zIndex="entry.zIndex"
        :isActive="activeWorkspaceWindowId === entry.id"
        :title="entry.title"
        :icon="entry.icon"
        :eyebrow="entry.eyebrow"
        :kind="entry.kind === 'widget' ? 'widget' : 'main'"
        :minWidth="entry.minWidth"
        :maxWidth="entry.maxWidth"
        :minHeight="entry.minHeight"
        :maxHeight="entry.maxHeight"
        :isCompact="entry.isCompact"
        :sceneLeft="workspaceSceneInsets.left"
        :sceneTop="workspaceSceneInsets.top"
        :sceneRight="workspaceSceneInsets.right"
        :sceneBottom="workspaceSceneInsets.bottom"
        @updateLayout="onUpdateWorkspaceLayout(entry.id, $event)"
        @requestClose="onCloseWorkspaceWindow(entry.id)"
        @focus="onFocusWorkspaceWindow(entry.id)"
        @switchAdjacent="onFocusAdjacentWorkspaceWindow(entry.id, $event)"
      >
        <component
          :is="entry.component"
          v-bind="entry.props"
        />
      </WorkspaceWindow>
    </TransitionGroup>

    <div v-if="activeStageWindowEntries.length === 0" class="lw-freeform-empty-stage">
      <span class="lw-freeform-empty-kicker">Stage Ready</span>
      <strong>当前舞台为空</strong>
      <span>从底部 Dock 打开工作区，或在左侧创建一个新的舞台组。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import WorkspaceWindow from '../../components/WorkspaceWindow.vue';
import type { ShellRuntimeActions, ShellRuntimeContext, ShellRuntimeSurfaces } from '../types.js';

const props = defineProps<{
  runtimeContext: ShellRuntimeContext;
  runtimeSurfaces: ShellRuntimeSurfaces;
  runtimeActions: ShellRuntimeActions;
}>();

const activeStageWindowEntries = computed(() => props.runtimeSurfaces.freeform.stageWindowEntries);
const activeWorkspaceWindowId = computed(() => props.runtimeContext.freeform.activeWorkspaceWindowId);
const workspaceSceneInsets = computed(() => props.runtimeContext.freeform.workspaceSceneInsets);

const onHandleFreeformScenePointerDown = (event: PointerEvent) =>
  props.runtimeActions.freeform.handleFreeformScenePointerDown(event);
const onUpdateWorkspaceLayout = (
  entryId: string,
  patch: { x?: number; y?: number; width?: number; height?: number; interaction?: 'move' | 'resize'; isFinal?: boolean }
) => props.runtimeActions.freeform.updateWorkspaceLayout(entryId, patch);
const onCloseWorkspaceWindow = (entryId: string) => props.runtimeActions.freeform.closeWorkspaceWindow(entryId);
const onFocusWorkspaceWindow = (entryId: string) => props.runtimeActions.freeform.focusWorkspaceWindow(entryId);
const onFocusAdjacentWorkspaceWindow = (entryId: string, direction: 'prev' | 'next') =>
  props.runtimeActions.freeform.focusAdjacentWorkspaceWindow(entryId, direction);
</script>
