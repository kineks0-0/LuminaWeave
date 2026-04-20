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
      @createStageWithLauncher="onCreateStageWithLauncher"
      @openWorkspaceSettings="onOpenWorkspaceSettings"
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
      <button class="lw-freeform-control" @click="onOpenWorkspaceSettings" title="设置窗口">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
      <button class="lw-freeform-control" @click="onClose" title="退出工作台">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

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
          <template #actions>
            <ForgeWorkspaceWindowActions v-if="entry.appId === 'panel:card_maker'" />
            <template v-if="entry.appId === 'plugin:lumina-settings' && currentDetailedView">
              <button class="icon-action-btn" type="button" title="返回概览" @pointerdown.stop @click.stop="onBackFromDetailedSettings">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
            </template>
          </template>

          <component
            :is="entry.component"
            v-bind="{ ...entry.props, isMobile: isMobile || entry.isCompact, workspaceCompact: entry.isCompact }"
          />
        </WorkspaceWindow>
      </TransitionGroup>

      <div v-if="activeStageWindowEntries.length === 0" class="lw-freeform-empty-stage">
        <span class="lw-freeform-empty-kicker">Stage Ready</span>
        <strong>当前舞台为空</strong>
        <span>从底部 Dock 打开工作区，或在左侧创建一个新的舞台组。</span>
      </div>

      <Transition name="workspace-launchpad-motion">
        <div v-if="showWorkspaceLaunchpad" class="lw-workspace-launchpad-overlay" @pointerdown.self="onCloseWorkspaceLaunchpad">
          <div class="lw-workspace-launchpad-shell" @pointerdown.stop>
            <button class="lw-workspace-launchpad-close" type="button" @click="onCloseWorkspaceLaunchpad" title="关闭启动台">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <LauncherRoot presentation="launchpad" :activeMainTab="activeMainTab" :dismissOnSelect="true" @dismiss="onCloseWorkspaceLaunchpad" />
          </div>
        </div>
      </Transition>
    </div>

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
import { ref, watch, type CSSProperties } from 'vue';
import WorkspaceDock from '../../components/WorkspaceDock.vue';
import WorkspaceStageStrip from '../../components/WorkspaceStageStrip.vue';
import WorkspaceWindow from '../../components/WorkspaceWindow.vue';
import LauncherRoot from '../../plugins/launcher/LauncherRoot.vue';
import ForgeWorkspaceWindowActions from '../../plugins/forge/ForgeWorkspaceWindowActions.vue';
import type { WorkspaceDockItem, WorkspaceSceneInsets, WorkspaceStageStripItem, WorkspaceWindowEntry } from '../types';
import WorkspaceMenu from './WorkspaceMenu.vue';

const props = defineProps<{
  activeDesktopModeId: string;
  desktopModeOptions: Array<{ value: string; label: string; description?: string }>;
  showWorkspaceMenu: boolean;
  shellWorkspaceMenuVariant: string;
  shellWorkspaceMenuStyle: CSSProperties;
  shellWorkspaceStageVariant: string;
  shellWorkspaceStageStyle: CSSProperties;
  isWorkspaceStageStripVisible: boolean;
  workspaceStageStripItems: WorkspaceStageStripItem[];
  isMobile: boolean;
  isWorkspaceNavigationVisible: boolean;
  activeStageWindowEntries: WorkspaceWindowEntry[];
  activeWorkspaceWindowId: string | null;
  workspaceSceneInsets: WorkspaceSceneInsets;
  currentDetailedView: string | null;
  showWorkspaceLaunchpad: boolean;
  activeMainTab: string;
  isWorkspaceDockVisible: boolean;
  workspaceDockDisplayItems: WorkspaceDockItem[];
  onSetDesktopMode: (desktopModeId: string) => void;
  onCreateStageWithLauncher: () => void;
  onOpenWorkspaceSettings: () => void;
  onActivateWorkspaceStageWithNavigation: (stageId: string) => void;
  onCreateWorkspaceStageFromStrip: () => void;
  onHoldWorkspaceNavigation: () => void;
  onScheduleWorkspaceNavigationHide: () => void;
  onToggleWorkspaceNavigation: () => void;
  onToggleWorkspaceMenu: () => void;
  onClose: () => void;
  onHandleFreeformScenePointerDown: (event: PointerEvent) => void;
  onUpdateWorkspaceLayout: (entryId: string, patch: { x?: number; y?: number; width?: number; height?: number; interaction?: 'move' | 'resize'; isFinal?: boolean }) => void;
  onCloseWorkspaceWindow: (entryId: string) => void;
  onFocusWorkspaceWindow: (entryId: string) => void;
  onFocusAdjacentWorkspaceWindow: (entryId: string, direction: 'prev' | 'next') => void;
  onBackFromDetailedSettings: () => void;
  onCloseWorkspaceLaunchpad: () => void;
  onHandleWorkspaceDockOpenWithNavigation: (appId: string) => void;
  onStageElementChange: (element: HTMLElement | null) => void;
}>();

const stageElement = ref<HTMLElement | null>(null);

watch(stageElement, (element) => {
  props.onStageElementChange(element);
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

.lw-workspace-launchpad-overlay {
  position: absolute;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 34px 34px 108px;
}

.lw-workspace-launchpad-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(circle at 50% 0%, var(--lw-glass-border), transparent 28%),
    linear-gradient(180deg, rgba(var(--lw-bg-app-rgb), 0.08), var(--lw-glass-bg));
  backdrop-filter: blur(16px) saturate(118%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 80%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 0%, black 80%, transparent 100%);
}

.lw-workspace-launchpad-shell {
  position: relative;
  width: min(1080px, 100%);
  max-width: calc(100% - 24px);
}

.lw-workspace-launchpad-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  width: 38px;
  height: 38px;
  border: 1px solid var(--lw-glass-border);
  border-radius: 999px;
  background: var(--lw-glass-bg);
  color: var(--lw-text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 14px 28px var(--lw-glass-shadow);
  backdrop-filter: blur(18px);
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lw-workspace-launchpad-close:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.7);
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
  gap: 8px;
  padding: 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 86%, white);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(248, 250, 254, 0.78));
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(16px);
}

.lw-freeform-control {
  width: 34px;
  height: 34px;
  border: 1px solid transparent;
  border-radius: 12px;
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
  background: color-mix(in srgb, var(--lw-primary) 10%, white);
  border-color: rgba(var(--lw-primary-rgb), 0.18);
  color: var(--lw-text-main);
}

.lw-freeform-empty-stage strong {
  font-family: var(--lw-font-display);
  font-size: 18px;
  color: var(--lw-text-main);
}

.lw-freeform-empty-stage span:last-child {
  font-size: 13px;
  color: var(--lw-text-secondary);
  line-height: 1.65;
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
