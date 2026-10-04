<template>
  <PanelHeader
    v-if="layoutMode === 'traditional' && runtimeFrame.traditionalHeaderPosition === 'top' && shouldRenderTraditionalHeader"
    :activeMainTab="runtimeContext.activeMainTab"
    :dynamicTabs="runtimeSurfaces.dynamicTabs"
    :isMobile="runtimeContext.isMobile"
    :activeDesktopModeId="runtimeContext.activeDesktopModeId"
    :desktopModes="runtimeContext.desktopModeOptions"
    :variant="runtimeFrame.panelHeaderVariant"
    :headerPlacement="runtimeFrame.traditionalHeaderPosition"
    :widgetPanels="runtimeSurfaces.widgetPanelList"
    :widgetGroups="runtimeContext.widgetGroups"
    :activeWidgetId="runtimeContext.traditional.activeRightPanel !== 'none' ? runtimeContext.traditional.activeRightPanel : ''"
    :guildRailVisible="runtimeFrame.headerRailVisible"
    :leftRenderer="headerLeftRenderer"
    @switchMainView="runtimeActions.navigation.switchMainView"
    @closeTab="runtimeActions.navigation.closeTab"
    @close="runtimeActions.navigation.close"
    @toggleSettings="runtimeActions.navigation.openSettingsPanel"
    @toggleGuildRail="runtimeActions.traditional.toggleHeaderRail"
    @setDesktopMode="runtimeActions.navigation.updateDesktopMode"
    @openWidget="runtimeActions.traditional.handleOpenWidget"
  />

  <div
    ref="panelBodyElement"
    class="lw-panel-body"
    :class="{ 'is-freeform': layoutMode === 'freeform' }"
    :style="runtimeFrame.panelBodyStyle"
  >
    <component
      v-show="!runtimeFrame.showSplash"
      :is="currentShellRenderer"
      v-bind="shellRendererProps"
    >
      <template #composition="{ activityComponent, activityComponentProps }">
        <DesktopCompositionOutlet
          :desktop-mode-id="runtimeContext.activeDesktopModeId"
          :is-mobile="runtimeContext.isMobile"
          :navigation-collapsed="!runtimeFrame.headerRailVisible"
        >
          <template #activity>
            <component
              :is="activityComponent"
              v-bind="activityComponentProps"
            />
          </template>
        </DesktopCompositionOutlet>
      </template>
    </component>
  </div>

  <PanelHeader
    v-if="layoutMode === 'traditional' && runtimeFrame.traditionalHeaderPosition === 'bottom' && shouldRenderTraditionalHeader"
    :activeMainTab="runtimeContext.activeMainTab"
    :dynamicTabs="runtimeSurfaces.dynamicTabs"
    :isMobile="runtimeContext.isMobile"
    :activeDesktopModeId="runtimeContext.activeDesktopModeId"
    :desktopModes="runtimeContext.desktopModeOptions"
    :variant="runtimeFrame.panelHeaderVariant"
    :headerPlacement="runtimeFrame.traditionalHeaderPosition"
    :widgetPanels="runtimeSurfaces.widgetPanelList"
    :widgetGroups="runtimeContext.widgetGroups"
    :activeWidgetId="runtimeContext.traditional.activeRightPanel !== 'none' ? runtimeContext.traditional.activeRightPanel : ''"
    :guildRailVisible="runtimeFrame.headerRailVisible"
    :leftRenderer="headerLeftRenderer"
    @switchMainView="runtimeActions.navigation.switchMainView"
    @closeTab="runtimeActions.navigation.closeTab"
    @close="runtimeActions.navigation.close"
    @toggleSettings="runtimeActions.navigation.openSettingsPanel"
    @toggleGuildRail="runtimeActions.traditional.toggleHeaderRail"
    @setDesktopMode="runtimeActions.navigation.updateDesktopMode"
    @openWidget="runtimeActions.traditional.handleOpenWidget"
  />

  <LegacyGlobalPanels ref="legacyGlobalPanels" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import PanelHeader from '../components/PanelHeader.vue';
import DesktopCompositionOutlet from '../platform/desktop-mode-runtime/DesktopCompositionOutlet.vue';
import { desktopModeRuntimeRegistry } from '../platform/desktop-mode-runtime/DesktopModeRuntimeRegistry.js';
import type {
  ShellRuntimeActions,
  ShellRuntimeContext,
  ShellRuntimeFrame,
  ShellRuntimeSurfaces
} from './types.js';
import LegacyGlobalPanels from './LegacyGlobalPanels.vue';

const legacyGlobalPanels = ref<InstanceType<typeof LegacyGlobalPanels> | null>(null);
const panelBodyElement = ref<HTMLElement | null>(null);

const props = defineProps<{
  runtimeContext: ShellRuntimeContext;
  runtimeSurfaces: ShellRuntimeSurfaces;
  runtimeActions: ShellRuntimeActions;
  runtimeFrame: ShellRuntimeFrame;
}>();

const layoutMode = computed(() => props.runtimeContext.shellKind);

// 全局 header 的显隐与左侧区域由模式包声明（shellChrome / headerLeftRenderer），平台不按模式 ID 特判。
const shouldRenderTraditionalHeader = computed(() =>
  desktopModeRuntimeRegistry.get(props.runtimeContext.activeDesktopModeId)?.shellChrome?.hideGlobalHeader !== true
);

const headerLeftRenderer = computed(() =>
  desktopModeRuntimeRegistry.get(props.runtimeContext.activeDesktopModeId)?.headerLeftRenderer
);

const currentShellRenderer = computed(() => {
  const renderer = desktopModeRuntimeRegistry.get(
    props.runtimeContext.activeDesktopModeId
  )?.shellRenderer;
  if (!renderer) {
    throw new Error('[LuminaShellRoot] Desktop mode shell renderer unavailable');
  }
  return renderer;
});

const shellRendererProps = computed(() => ({
  runtimeContext: props.runtimeContext,
  runtimeSurfaces: props.runtimeSurfaces,
  runtimeActions: props.runtimeActions,
  runtimeFrame: props.runtimeFrame
}));

const openConflictViewer = () => {
  legacyGlobalPanels.value?.openConflictViewer();
};

const openSyncReportViewer = () => {
  legacyGlobalPanels.value?.openSyncReportViewer();
};

defineExpose({
  openConflictViewer,
  openSyncReportViewer
});

watch(panelBodyElement, (element) => {
  props.runtimeActions.frame.panelBodyElementChange(element);
}, { immediate: true });
</script>
