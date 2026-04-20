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
      @mousedown.stop.prevent="emit('resizeStart')"
    ></div>
    <div class="widget-container-header">
      <div v-if="activeRightPanel === 'lumina-settings' && currentDetailedView" class="widget-back-nav">
        <button class="icon-action-btn" @click="emit('backFromDetailedSettings')" title="返回概览">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="current-widget-info">
          <span class="widget-sub-title">{{ getPluginName(currentDetailedView) }} 专属设置</span>
        </div>
      </div>

      <div v-else-if="activeWidgetPlugin" class="widget-dropdown" @click="emit('toggleWidgetDropdown')">
        <div class="current-widget-info">
          <span v-html="activeWidgetPlugin.icon" class="tab-icon-wrapper"></span>
          <span v-if="activeRightPanel === 'lumina-settings'">所有插件概览</span>
          <span v-else>{{ activeWidgetPlugin.name }}</span>
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

        <button
          v-if="activeForgeAuxKind && isForgeActiveInTraditional && rawSidebarMode === 'widget'"
          @click="emit('restoreSidebarLeft')"
          title="切换回左侧栏"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="7" height="18" rx="1"></rect>
            <rect x="14" y="3" width="7" height="18" rx="1"></rect>
          </svg>
        </button>

        <button @click="emit('closePanel')" title="Close Panel">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <div class="widget-container-body" :class="{ 'has-nexus': showNexus }">
      <div v-if="showNexus" class="widget-nexus-sidebar">
        <LuminaNexus @close="emit('updateShowNexus', false)" />
      </div>
      <div class="widget-main-content">
        <component :is="activeWidgetPlugin?.component" v-if="activeWidgetPlugin" :mode="'small'" :isMobile="isMobile" />
        <component
          v-else-if="activeRegisteredPanel"
          :is="activeRegisteredPanel.component"
          :kind="activeForgeAuxKind || undefined"
          :mode="'small'"
          :isMobile="isMobile"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import LuminaNexus from '../../components/LuminaNexus.vue';
import type { LuminaPlugin } from '../../types/plugin';
import type { RegisteredPanelEntry, WidgetPanelGroup } from '../types';

defineProps<{
  activeRightPanel: string;
  isMobile: boolean;
  surfaceVariant: string;
  widgetStyle: CSSProperties;
  widgetWidth: number;
  isResizing: boolean;
  currentDetailedView: string | null;
  saveStatus: string;
  activeForgeAuxKind: string | null;
  isForgeActiveInTraditional: boolean;
  rawSidebarMode: 'left' | 'right' | 'widget' | 'hidden';
  activeWidgetPlugin: LuminaPlugin | null;
  activeRegisteredPanel: RegisteredPanelEntry | null;
  widgetGroups: WidgetPanelGroup[];
  showWidgetDropdown: boolean;
  showNexus: boolean;
  getPluginName: (pluginId: string | null) => string;
}>();

const emit = defineEmits<{
  (e: 'resizeStart'): void;
  (e: 'backFromDetailedSettings'): void;
  (e: 'toggleWidgetDropdown'): void;
  (e: 'switchRightPanel', panelId: string): void;
  (e: 'restoreSidebarLeft'): void;
  (e: 'closePanel'): void;
  (e: 'updateShowNexus', value: boolean): void;
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
      linear-gradient(180deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--lw-bg-elevated) 96%, white)));
  backdrop-filter: var(--lw-glass-blur);
  border: 1px solid var(--lw-shell-widget-border, color-mix(in srgb, var(--lw-border, var(--lw-border-base)) 88%, white));
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
}

.luminaweave-app-root[data-desktop-mode='discord'][data-layout-mode='traditional'] .lw-panel-body:not(.is-freeform) .lw-widget-container[data-surface-variant='discord'] {
  background: #2b2d31;
  border-left: 1px solid #232428;
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
  font-size: 12px;
  font-weight: 700;
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
  font-size: 12px;
  font-weight: 600;
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
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
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

.widget-container-body.has-nexus {
  flex-direction: row;
}

.widget-nexus-sidebar {
  width: 280px;
  min-width: 280px;
  height: 100%;
  border-right: 1px solid var(--lw-glass-border);
  background: color-mix(in srgb, var(--lw-bg-surface) 40%, transparent);
}

.widget-main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.widget-back-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.widget-sub-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.header-sync-status {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
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
