<template>
  <div
    v-if="activeRightPanel !== 'none' && !isMobile"
    class="lw-widget-container"
    :class="{ 'is-mobile': isMobile }"
    :data-surface-variant="surfaceVariant"
    :style="{ ...widgetStyle, width: `${widgetWidth}px`, minWidth: `${widgetWidth}px` }"
  >
    <div
      class="lw-widget-resizer"
      :class="{ 'is-resizing': isResizing }"
      @mousedown.stop.prevent="emit('resizeStart', $event)"
    ></div>
    <div class="widget-container-header">
      <div v-if="activeWidgetPlugin" class="widget-dropdown" @click="emit('toggleWidgetDropdown')">
        <div class="current-widget-info">
          <span v-html="activeWidgetPlugin.icon" class="tab-icon-wrapper"></span>
          <span>{{ activeWidgetPlugin.name }}</span>
          <svg class="chevron-down" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>

        <div class="dropdown-menu" v-if="showWidgetDropdown">
          <template v-for="(group, groupIndex) in widgetGroups" :key="groupIndex">
            <div v-if="groupIndex > 0" class="dropdown-divider"></div>
            <div v-if="group.label" class="dropdown-label">{{ group.label }}</div>
            <div
              class="dropdown-item"
              v-for="item in group.items"
              :key="item.id"
              @click.stop="emit('switchRightPanel', item.id)"
            >
              <span class="tab-icon-wrapper" v-html="item.icon"></span>
              {{ item.name }}
            </div>
          </template>
        </div>
      </div>

      <div v-else-if="activeRegisteredPanel" class="widget-dropdown" @click="emit('toggleWidgetDropdown')">
        <div class="current-widget-info">
          <span>{{ activeRegisteredPanel.config.title }}</span>
          <svg class="chevron-down" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>

        <div class="dropdown-menu" v-if="showWidgetDropdown">
          <template v-for="(group, groupIndex) in widgetGroups" :key="groupIndex">
            <div v-if="groupIndex > 0" class="dropdown-divider"></div>
            <div v-if="group.label" class="dropdown-label">{{ group.label }}</div>
            <div
              class="dropdown-item"
              v-for="item in group.items"
              :key="item.id"
              @click.stop="emit('switchRightPanel', item.id)"
            >
              <span class="tab-icon-wrapper" v-html="item.icon"></span>
              {{ item.name }}
            </div>
          </template>
        </div>
      </div>

      <div class="widget-actions">
        <div v-if="activeRightPanel === 'lumina-settings'" class="header-sync-status" :class="saveStatus">
          <span>{{ saveStatus === 'saving' ? '正在存入' : (saveStatus === 'saved' ? '已保存' : '') }}</span>
        </div>

        <button @click="emit('closePanel')" title="Close Panel">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <div class="widget-container-body">
      <div class="widget-main-content">
        <SurfaceOutlet
          v-if="activeWidgetPlugin && activeWidgetSurfaceContractId"
          :contract-id="activeWidgetSurfaceContractId"
          :input="getActivePanelSurfaceInput(activeWidgetSurfaceContractId)"
          :desktop-mode-id="desktopModeId"
        />
        <component
          v-else-if="activeRegisteredPanel && !activeRegisteredPanelSurfaceContractId"
          :is="activeRegisteredPanel.component"
          v-bind="{ ...registeredPanelDefaultInput, ...activePanelProps }"
          :activity="activePanelActivity"
          :isMobile="isMobile"
        />
        <SurfaceOutlet
          v-else-if="activeRegisteredPanel && activeRegisteredPanelSurfaceContractId"
          :contract-id="activeRegisteredPanelSurfaceContractId"
          :input="getActivePanelSurfaceInput(activeRegisteredPanelSurfaceContractId)"
          :desktop-mode-id="desktopModeId"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import type { LuminaPlugin } from '../../types/plugin.js';
import type { RegisteredPanelEntry, WidgetPanelGroup } from '../types.js';
import type { ActivityPanelPayload } from '../../platform/activity/types.js';
import SurfaceOutlet from '../../platform/surface/SurfaceOutlet.vue';
import { projectSurfaceInput } from '../../platform/surface/surfaceInputProjection.js';
import type { SurfaceContractId } from '../../platform/surface/types.js';
import { getPrimarySurfaceContractIdForPlugin } from '../../platform/plugin/officialPluginSurfaces.js';

const props = defineProps<{
  activeRightPanel: string;
  desktopModeId: string;
  isMobile: boolean;
  surfaceVariant: string;
  widgetStyle: CSSProperties;
  widgetWidth: number;
  isResizing: boolean;
  saveStatus: string;
  auxSidebarMode: 'left' | 'right' | 'widget' | 'hidden';
  activeWidgetPlugin: LuminaPlugin | null;
  activeRegisteredPanel: RegisteredPanelEntry | null;
  activeRightPanelActivity: ActivityPanelPayload | null;
  widgetGroups: WidgetPanelGroup[];
  showWidgetDropdown: boolean;
}>();

const defaultPanelActivity = { size: 'small', pageType: 'nested' } as const;
const activePanelPayload = computed(() => (
  props.activeRightPanelActivity?.panelId === props.activeRightPanel
    ? props.activeRightPanelActivity
    : null
));
const activePanelProps = computed(() => activePanelPayload.value?.props || {});
const registeredPanelDefaultInput = computed(() => props.activeRegisteredPanel?.config.defaultInput || {});
const activePanelActivity = computed(() => activePanelPayload.value?.activity || defaultPanelActivity);
const activeWidgetSurfaceContractId = computed<SurfaceContractId | null>(() => (
  activePanelPayload.value?.contractId
  || (props.activeWidgetPlugin ? getPrimarySurfaceContractIdForPlugin(props.activeWidgetPlugin) : null)
));
const activeRegisteredPanelSurfaceContractId = computed<SurfaceContractId | null>(() => (
  activePanelPayload.value?.contractId
  || props.activeRegisteredPanel?.config.surfaceContractId
  || null
));

const getActivePanelSurfaceInput = (contractId: SurfaceContractId) => projectSurfaceInput(
  contractId,
  { ...registeredPanelDefaultInput.value, ...activePanelProps.value },
  {
    activity: activePanelActivity.value,
    isMobile: props.isMobile,
    auxSidebarMode: props.auxSidebarMode,
    activeRightPanelId: props.activeRightPanel
  }
);

const emit = defineEmits<{
  (e: 'resizeStart', event: MouseEvent): void;
  (e: 'toggleWidgetDropdown'): void;
  (e: 'switchRightPanel', panelId: string): void;
  (e: 'closePanel'): void;
}>();
</script>

<style>
.lw-widget-resizer {
  width: 6px;
  background-color: transparent !important;
  background: transparent none !important;
  cursor: ew-resize;
  z-index: 100;
  transition: background-color 0.2s;
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
}

.lw-widget-resizer:hover,
.lw-widget-resizer.is-resizing {
  background-color: rgba(var(--lw-primary-rgb), 0.55) !important;
}

.lw-widget-container {
  background: var(--lw-shell-widget-bg,
      linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent), color-mix(in srgb, var(--lw-bg-surface) 88%, transparent)));
  backdrop-filter: var(--lw-glass-blur);
  border: 1px solid var(--lw-shell-widget-border, color-mix(in srgb, var(--lw-border, var(--lw-border-base)) 88%, var(--lw-bg-elevated)));
  border-radius: var(--lw-shell-widget-radius, 24px);
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  transition: var(--lw-transition);
  box-shadow: var(--lw-shadow-card);
}

.lw-widget-container[data-surface-variant='discord'] {
  backdrop-filter: none;
}

.lw-panel-body:not(.is-freeform) .lw-widget-container {
  border-radius: 0;
  box-shadow: none;
  border-top: none;
  border-right: none;
  border-bottom: none;
  border-left: var(--lw-shell-widget-divider-border, 1px solid var(--lw-shell-widget-border, var(--lw-border-base)));
}

.lw-widget-container[data-surface-variant='telegram'] {
  /* 内容（角色资料等）有自己的背景，必须按圆角裁剪 */
  overflow: hidden;
  background: var(--lw-telegram-pane-bg, var(--lw-telegram-info-panel-bg, var(--lw-shell-widget-bg, color-mix(in srgb, var(--lw-surface-container-high) 78%, transparent))));
  border-color: var(--lw-telegram-info-panel-border, var(--lw-shell-widget-border, var(--lw-border-subtle)));
  box-shadow: var(--lw-telegram-panel-shadow, var(--lw-shadow-card));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(22px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(22px));
}

.lw-panel-body:not(.is-freeform) .lw-widget-container[data-surface-variant='telegram'] {
  border: 1px solid var(--lw-telegram-pane-border, var(--lw-border-subtle));
  border-radius: var(--lw-telegram-pane-radius, 0);
  box-shadow: var(--lw-telegram-pane-shadow, none);
  background: var(--lw-telegram-pane-bg, var(--lw-shell-widget-pane-bg, linear-gradient(180deg, color-mix(in srgb, var(--lw-surface-container-high) 86%, transparent), color-mix(in srgb, var(--lw-surface-container) 70%, transparent))));
}

.lw-widget-container[data-surface-variant='telegram'] .widget-container-header {
  border-bottom-color: var(--lw-border-subtle);
  background: var(--lw-shell-widget-header-bg, color-mix(in srgb, var(--lw-surface-container-high) 68%, transparent));
}

.lw-widget-container[data-surface-variant='telegram'] .current-widget-info,
.lw-widget-container[data-surface-variant='telegram'] .widget-actions button {
  border-radius: 999px;
}

.lw-widget-container[data-surface-variant='telegram'] .dropdown-menu {
  background: var(--lw-shell-widget-dropdown-bg, color-mix(in srgb, var(--lw-surface-container-high) 88%, transparent));
  border-color: var(--lw-shell-widget-dropdown-border, var(--lw-border-subtle));
  box-shadow: var(--lw-telegram-panel-shadow, var(--lw-shadow-card));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
}

.lw-widget-container[data-surface-variant='telegram'] .widget-main-content {
  background: var(--lw-shell-widget-content-overlay, radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--lw-primary) 12%, transparent), transparent 34%), transparent);
}

.widget-container-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--lw-border-base);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--lw-shell-widget-header-bg, transparent);
}

.widget-dropdown {
  position: relative;
  cursor: pointer;
  user-select: none;
}

.current-widget-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
  color: var(--lw-text-main, #111827);
  padding: 6px 10px;
  border-radius: 999px;
  transition: var(--lw-transition);
}

.current-widget-info:hover {
  background: var(--lw-bg-hover);
}

.current-widget-info .chevron-down {
  margin-left: 4px;
  color: var(--lw-text-muted);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: var(--lw-bg-elevated);
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  box-shadow: var(--lw-shadow-card);
  min-width: 200px;
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
  color: var(--lw-text-secondary);
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-primary);
}

.dropdown-divider {
  height: 1px;
  background: var(--lw-border-base);
  margin: 4px 0;
}

.dropdown-label {
  padding: 6px 10px 4px;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.widget-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.widget-actions button {
  background: none;
  border: none;
  color: var(--lw-text-muted);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  border-radius: 10px;
  transition: 0.2s;
}

.widget-actions button:hover {
  background: var(--lw-bg-subtle);
  color: #ef4444;
}

.widget-container-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.widget-main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.header-sync-status {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
}

.header-sync-status.saving,
.header-sync-status.saved {
  animation: lw-pulse 2s infinite;
}

.header-sync-status.saving {
  background: rgba(var(--lw-primary-rgb), 0.12);
  color: var(--lw-primary);
}

.header-sync-status.saved {
  background: rgba(34, 197, 94, 0.12);
  color: #1e8a52;
}
</style>
