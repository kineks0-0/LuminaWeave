<template>
  <div
    class="lw-traditional-shell"
    :class="{ 'is-mobile': runtimeContext.isMobile }"
    :data-desktop-mode="runtimeContext.activeDesktopModeId"
    :style="rootStyle"
  >
    <slot name="lead" />

    <slot name="composition" :activity-component="resolvedActivityComponent" :activity-component-props="resolvedActivityComponentProps">
      <template v-for="entry in mainSurfaceEntries" :key="entry.plugin.id">
        <div
          v-show="runtimeContext.activeMainTab === entry.plugin.id"
          class="lw-main-wrapper"
          :class="[{ 'lw-main-timeline-wrapper': entry.plugin.id === 'lumina-timeline' }, mainSurfaceExtraClass]"
          :data-surface-variant="runtimeSurfaces.traditional.mainSurfaceVariant"
          :style="[runtimeSurfaces.traditional.mainSurfaceStyle, mainSurfaceExtraStyle]"
        >
          <ThemedSurfaceOutlet
            v-if="entry.plugin.id !== 'lumina-timeline'
              || runtimeContext.activeMainTab === 'lumina-timeline'
              || runtimeContext.traditional.isTimelineLoadedOnce"
            :contract-id="entry.contractId"
            :input="getMainSurfaceInput(entry.contractId)"
            :desktop-mode-id="runtimeContext.activeDesktopModeId"
          />
        </div>
      </template>

      <template v-for="tab in runtimeSurfaces.dynamicTabs" :key="tab.id">
        <div
          v-show="runtimeContext.activeMainTab === tab.id"
          class="lw-main-wrapper"
          :class="mainSurfaceExtraClass"
          :data-surface-variant="runtimeSurfaces.traditional.mainSurfaceVariant"
          :style="[runtimeSurfaces.traditional.mainSurfaceStyle, mainSurfaceExtraStyle]"
        >
          <DynamicTabOutlet
            :tab="tab"
            :desktop-mode-id="runtimeContext.activeDesktopModeId"
            :is-mobile="runtimeContext.isMobile"
            :aux-sidebar-mode="runtimeContext.traditional.sidebarMode"
            :active-right-panel-id="runtimeContext.traditional.activeRightPanel"
          />
        </div>
      </template>
    </slot>

    <slot name="widget">
      <WidgetPanelHost
        :activeRightPanel="runtimeContext.traditional.activeRightPanel"
        :desktopModeId="runtimeContext.activeDesktopModeId"
        :isMobile="runtimeContext.isMobile"
        :surfaceVariant="runtimeSurfaces.traditional.widgetSurfaceVariant"
        :widgetStyle="runtimeSurfaces.traditional.widgetStyle"
        :widgetWidth="runtimeContext.traditional.widgetWidth"
        :isResizing="runtimeContext.traditional.isResizing"
        :saveStatus="runtimeContext.saveStatus"
        :auxSidebarMode="runtimeContext.traditional.sidebarMode"
        :activeWidgetPlugin="runtimeContext.traditional.activeWidgetPlugin"
        :activeRegisteredPanel="runtimeContext.traditional.activeRegisteredPanel"
        :activeRightPanelActivity="runtimeContext.traditional.activeRightPanelActivity"
        :widgetGroups="runtimeContext.widgetGroups"
        :showWidgetDropdown="runtimeContext.traditional.showWidgetDropdown"
        @resizeStart="runtimeActions.traditional.resizeStart"
        @toggleWidgetDropdown="runtimeActions.traditional.toggleWidgetDropdown"
        @switchRightPanel="runtimeActions.traditional.switchRightPanel"
        @closePanel="runtimeActions.traditional.closePanel"
      />
    </slot>

    <slot name="trailing" />
  </div>
</template>

<script setup lang="ts">
import { computed, type Component, type CSSProperties } from 'vue';
import WidgetPanelHost from './WidgetPanelHost.vue';
import ThemedSurfaceOutlet from '../../platform/surface/ThemedSurfaceOutlet.vue';
import { projectSurfaceInput } from '../../platform/surface/surfaceInputProjection.js';
import { getPrimarySurfaceContractIdForPlugin } from '../../platform/plugin/officialPluginSurfaces.js';
import DynamicTabOutlet from '../DynamicTabOutlet.vue';
import ShellPrimaryActivityOutlet from '../ShellPrimaryActivityOutlet.vue';
import type { SurfaceContractId } from '../../platform/surface/types.js';
import type {
  ShellRuntimeActions,
  ShellRuntimeContext,
  ShellRuntimeFrame,
  ShellRuntimeSurfaces
} from '../types.js';

export type TraditionalSurfaceInputResolver = (
  contractId: SurfaceContractId
) => Record<string, unknown>;

export type TraditionalMainSurfaceClass =
  | string
  | Record<string, boolean>
  | Array<string | Record<string, boolean>>;

const props = withDefaults(defineProps<{
  runtimeContext: ShellRuntimeContext;
  runtimeSurfaces: ShellRuntimeSurfaces;
  runtimeActions: ShellRuntimeActions;
  runtimeFrame: ShellRuntimeFrame;
  rootStyle?: CSSProperties;
  mainSurfaceExtraStyle?: CSSProperties;
  mainSurfaceExtraClass?: TraditionalMainSurfaceClass;
  surfaceInputResolver?: TraditionalSurfaceInputResolver;
  activityComponent?: Component;
  activityComponentProps?: Record<string, unknown>;
}>(), {
  rootStyle: undefined,
  mainSurfaceExtraStyle: undefined,
  mainSurfaceExtraClass: undefined,
  surfaceInputResolver: undefined,
  activityComponent: undefined,
  activityComponentProps: undefined
});

const mainSurfaceEntries = computed(() => props.runtimeSurfaces.traditional.mainPlugins.flatMap(plugin => {
  const contractId = getPrimarySurfaceContractIdForPlugin(plugin);
  if (!contractId) {
    console.error('[SurfaceRuntime] Plugin primary surface unavailable', { pluginId: plugin.id });
    return [];
  }
  return [{ plugin, contractId }];
}));

const getMainSurfaceInput = (contractId: SurfaceContractId) => {
  const override = props.surfaceInputResolver?.(contractId) ?? {};
  return projectSurfaceInput(contractId, override, {
    activity: { size: 'default', pageType: 'nested' },
    isMobile: props.runtimeContext.isMobile,
    auxSidebarMode: props.runtimeContext.isMobile ? 'hidden' : props.runtimeContext.traditional.sidebarMode,
    activeRightPanelId: props.runtimeContext.traditional.activeRightPanel
  });
};

const resolvedActivityComponent = computed(() => props.activityComponent ?? ShellPrimaryActivityOutlet);
const resolvedActivityComponentProps = computed(() => props.activityComponentProps ?? {
  runtimeContext: props.runtimeContext,
  runtimeSurfaces: props.runtimeSurfaces
});
</script>

<style>
.lw-traditional-shell {
  display: contents;
}

.lw-main-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  border: 1px solid var(--lw-shell-main-border, color-mix(in srgb, var(--lw-border-base) 88%, var(--lw-bg-elevated)));
  border-radius: var(--lw-shell-main-radius, 24px);
  background: var(--lw-shell-main-bg,
      linear-gradient(180deg,
        color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent),
        color-mix(in srgb, var(--lw-bg-surface) 88%, transparent)));
  box-shadow: var(--lw-shell-main-shadow, 0 20px 44px rgba(15, 23, 42, 0.08));
}

.lw-panel-body:not(.is-freeform) .lw-main-wrapper {
  border-radius: 0;
  box-shadow: none;
  border-top: none;
  border-bottom: none;
}

/* 移动壳层可以用这组通用变量为自己的悬浮导航留出安全区。 */
.lw-main-wrapper.has-mobile-shell-padding {
  min-height: 0;
  padding-top: var(--lw-shell-mobile-safe-top, 0px);
  padding-right: var(--lw-shell-mobile-safe-right, 0px);
  padding-bottom: var(--lw-shell-mobile-safe-bottom, 0px);
  padding-left: var(--lw-shell-mobile-safe-left, 0px);
}

.lw-main-timeline-wrapper {
  flex: 1;
  overflow: hidden;
  background: transparent;
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .lw-main-wrapper {
    height: auto;
    min-height: 0;
  }
}
</style>
