<template>
  <div
    ref="stageElement"
    class="lw-freeform-stage"
    :data-skin-variant="shellWorkspaceStageVariant || 'default'"
    :style="shellWorkspaceStageStyle"
  >
    <WorkspaceMenu
      :show="showWorkspaceMenu"
      :variant="shellWorkspaceMenuVariant || 'default'"
      :menuStyle="shellWorkspaceMenuStyle"
      :activeDesktopModeId="activeDesktopModeId"
      :desktopModes="desktopModeOptions"
      @setDesktopMode="onSetDesktopMode"
      @createStage="onCreateWorkspaceStage"
    />

    <Transition name="workspace-nav-motion" appear>
      <WorkspaceStageStrip
        v-if="isWorkspaceStageStripVisible"
        :stages="workspaceStageStripItems"
        :is-mobile="isMobile"
        @activate="onActivateWorkspaceStageWithNavigation"
        @create="onCreateWorkspaceStageFromStrip"
        @pointerenter="onHoldWorkspaceNavigation"
        @pointerleave="onScheduleWorkspaceNavigationHide()"
      />
    </Transition>

    <div class="lw-freeform-controls">
      <button class="lw-freeform-control" :class="{ active: isWorkspaceNavigationVisible }" @click="onToggleWorkspaceNavigation" title="台前调度">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
          <rect x="3" y="4" width="6" height="16" rx="2"></rect>
          <rect x="12" y="6" width="9" height="5" rx="2"></rect>
          <rect x="12" y="14" width="9" height="6" rx="2"></rect>
        </svg>
      </button>
      <button class="lw-freeform-control" :class="{ active: showWorkspaceMenu }" @click="onToggleWorkspaceMenu" title="工作台菜单">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
          <line x1="4" y1="7" x2="20" y2="7"></line>
          <line x1="4" y1="12" x2="20" y2="12"></line>
          <line x1="4" y1="17" x2="20" y2="17"></line>
        </svg>
      </button>
      <button class="lw-freeform-control" @click="onClose" title="退出工作台">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <slot
      name="composition"
      :activity-component="FreeformWorkspaceActivityOutlet"
      :activity-component-props="{
        runtimeContext: props.runtimeContext,
        runtimeSurfaces: props.runtimeSurfaces,
        runtimeActions: props.runtimeActions
      }"
    >
      <FreeformWorkspaceActivityOutlet
        :runtime-context="props.runtimeContext"
        :runtime-surfaces="props.runtimeSurfaces"
        :runtime-actions="props.runtimeActions"
      />
    </slot>

    <Transition name="workspace-nav-motion" appear>
      <WorkspaceDock
        v-if="isWorkspaceDockVisible"
        :items="workspaceDockDisplayItems"
        @open="onHandleWorkspaceDockOpenWithNavigation"
        @pointerenter="onHoldWorkspaceNavigation"
        @pointerleave="onScheduleWorkspaceNavigationHide()"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import WorkspaceDock from '../../components/WorkspaceDock.vue';
import WorkspaceStageStrip from '../../components/WorkspaceStageStrip.vue';
import type { ShellRuntimeActions, ShellRuntimeContext, ShellRuntimeSurfaces } from '../types.js';
import FreeformWorkspaceActivityOutlet from './FreeformWorkspaceActivityOutlet.vue';
import WorkspaceMenu from './WorkspaceMenu.vue';

const props = defineProps<{
  runtimeContext: ShellRuntimeContext;
  runtimeSurfaces: ShellRuntimeSurfaces;
  runtimeActions: ShellRuntimeActions;
}>();

const activeDesktopModeId = computed(() => props.runtimeContext.activeDesktopModeId);
const desktopModeOptions = computed(() => props.runtimeContext.desktopModeOptions);
const showWorkspaceMenu = computed(() => props.runtimeContext.freeform.showWorkspaceMenu);
const shellWorkspaceMenuVariant = computed(() => props.runtimeSurfaces.freeform.workspaceMenuVariant);
const shellWorkspaceMenuStyle = computed(() => props.runtimeSurfaces.freeform.workspaceMenuStyle);
const shellWorkspaceStageVariant = computed(() => props.runtimeSurfaces.freeform.workspaceStageVariant);
const shellWorkspaceStageStyle = computed(() => props.runtimeSurfaces.freeform.workspaceStageStyle);
const isWorkspaceStageStripVisible = computed(() => props.runtimeContext.freeform.isWorkspaceStageStripVisible);
const workspaceStageStripItems = computed(() => props.runtimeSurfaces.freeform.stageStripItems);
const isMobile = computed(() => props.runtimeContext.isMobile);
const isWorkspaceNavigationVisible = computed(() => props.runtimeContext.freeform.isWorkspaceNavigationVisible);
const isWorkspaceDockVisible = computed(() => props.runtimeContext.freeform.isWorkspaceDockVisible);
const workspaceDockDisplayItems = computed(() => props.runtimeSurfaces.freeform.dockDisplayItems);

const onSetDesktopMode = (desktopModeId: string) => props.runtimeActions.navigation.updateDesktopMode(desktopModeId);
const onCreateWorkspaceStage = () => props.runtimeActions.freeform.createWorkspaceStage();
const onActivateWorkspaceStageWithNavigation = (stageId: string) =>
  props.runtimeActions.freeform.activateWorkspaceStageWithNavigation(stageId);
const onCreateWorkspaceStageFromStrip = () => props.runtimeActions.freeform.createWorkspaceStageFromStrip();
const onHoldWorkspaceNavigation = () => props.runtimeActions.freeform.holdWorkspaceNavigation();
const onScheduleWorkspaceNavigationHide = () => props.runtimeActions.freeform.scheduleWorkspaceNavigationHide();
const onToggleWorkspaceNavigation = () => props.runtimeActions.freeform.toggleWorkspaceNavigation();
const onToggleWorkspaceMenu = () => props.runtimeActions.freeform.toggleWorkspaceMenu();
const onClose = () => props.runtimeActions.navigation.close();
const onHandleWorkspaceDockOpenWithNavigation = (appId: string) =>
  props.runtimeActions.freeform.handleWorkspaceDockOpenWithNavigation(appId);

const stageElement = ref<HTMLElement | null>(null);

watch(stageElement, (element) => {
  props.runtimeActions.freeform.stageElementChange(element);
});
</script>

<style>
.lw-freeform-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--lw-shell-stage-radius, 30px);
  border: 1px solid var(--lw-shell-stage-border, color-mix(in srgb, var(--lw-border-base) 88%, white));
  box-shadow: var(--lw-shell-stage-shadow, 0 22px 52px rgba(15, 23, 42, 0.08));
  background: var(--lw-shell-stage-bg,
      radial-gradient(circle at 18% 20%, rgba(var(--lw-primary-rgb), 0.24), transparent 26%),
      radial-gradient(circle at 82% 14%, rgba(255, 255, 255, 0.64), transparent 24%),
      linear-gradient(180deg, rgba(154, 184, 232, 0.96) 0%, rgba(182, 204, 241, 0.88) 24%, rgba(216, 228, 247, 0.94) 70%, rgba(236, 242, 251, 0.98) 100%));
}

.lw-freeform-stage::before {
  content: '';
  position: absolute;
  inset: 0 0 44% 0;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.48), transparent 44%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.24), transparent);
  pointer-events: none;
}

.lw-freeform-stage::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 34%;
  background: linear-gradient(180deg, transparent, var(--lw-glass-bg));
  opacity: 0.6;
  pointer-events: none;
}

.lw-freeform-scene {
  position: absolute;
  inset: 0;
}

.lw-freeform-scene::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, var(--lw-glass-border), transparent 18%),
    radial-gradient(circle at 50% 102%, var(--lw-glass-bg), transparent 28%);
  opacity: 0.5;
  pointer-events: none;
}

.lw-freeform-empty-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  width: min(360px, calc(100% - 192px));
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  box-shadow: var(--lw-shadow-card);
  backdrop-filter: blur(14px);
}

.lw-freeform-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 12;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 72%, var(--lw-bg-elevated));
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent),
      color-mix(in srgb, var(--lw-bg-surface) 82%, transparent)
    );
  box-shadow:
    0 18px 42px rgba(48, 73, 114, 0.14),
    inset 0 1px 0 color-mix(in srgb, var(--lw-bg-elevated) 80%, transparent);
  backdrop-filter: blur(22px) saturate(128%);
}

.lw-freeform-control {
  position: relative;
  width: 36px;
  height: 36px;
  border: 1px solid transparent;
  border-radius: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--lw-text-secondary);
  cursor: pointer;
  transition: var(--lw-transition);
}

.lw-freeform-control:hover,
.lw-freeform-control.active {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--lw-bg-elevated) 86%, transparent),
      color-mix(in srgb, var(--lw-primary) 9%, var(--lw-bg-surface))
    );
  border-color: rgba(var(--lw-primary-rgb), 0.16);
  color: var(--lw-text-main);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--lw-bg-elevated) 78%, transparent),
    0 8px 18px rgba(53, 80, 125, 0.1);
}

@media (max-width: 768px) {
  .lw-freeform-controls {
    top: 16px;
    right: 16px;
    gap: 6px;
  }
}

.lw-freeform-empty-stage strong {
  font-family: var(--lw-font-display);
  font-size: var(--lw-type-title-large-size);
  line-height: var(--lw-type-title-large-line-height);
  font-weight: var(--lw-type-title-large-weight);
  letter-spacing: var(--lw-type-title-large-tracking);
  color: var(--lw-text-main);
}

.lw-freeform-empty-stage span:last-child {
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  font-weight: var(--lw-type-body-medium-weight);
  letter-spacing: var(--lw-type-body-medium-tracking);
  color: var(--lw-text-secondary);
}

.luminaweave-app-root[data-motion='full'] {
  --lw-glass-blur: 20px;
  --lw-glass-saturate: 125%;
}

.lw-freeform-stage[data-skin-variant='discord']::before {
  opacity: 0.12;
}

.lw-freeform-stage[data-skin-variant='discord']::after {
  opacity: 0.22;
}
</style>
