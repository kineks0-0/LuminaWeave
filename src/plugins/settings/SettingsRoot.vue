<template>
  <div
    class="lw-settings-root"
    :class="{ 'is-large': mode === 'large' }"
    :data-skin-variant="settingsVariant || 'default'"
    :style="settingsSkinStyle"
  >
    <!-- 大窗口模式下的侧边栏导航 -->
    <div v-if="mode === 'large'" class="settings-sidebar">
      <div class="sidebar-header">
        <h3>设置中心</h3>
      </div>
      <div class="sidebar-nav">
        <div class="nav-item" :class="{ active: !currentDetailedView }" @click="currentDetailedView = null">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          常规概览
        </div>
        <div v-if="activeThemeEntry" class="nav-divider">当前桌面模式</div>
        <div v-if="activeThemeEntry" class="nav-item"
          :class="{ active: currentDetailedView === activeThemeEntry.pluginId }" @click="currentDetailedView = activeThemeEntry.pluginId">
          <span class="nav-icon" v-html="activeThemeEntry.pluginIcon"></span>
          {{ activeThemeEntry.pluginName }}
        </div>
        <div class="nav-divider">插件专属设置</div>
        <div v-for="sb in settingsBlocks" :key="sb.pluginId" class="nav-item"
          :class="{ active: currentDetailedView === sb.pluginId }" @click="currentDetailedView = sb.pluginId">
          <span class="nav-icon" v-html="sb.pluginIcon"></span>
          {{ sb.pluginName }}
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="settings-main-container">
      <div v-if="mode === 'large' && currentDetailedView" class="main-content-header">
        <div class="header-breadcrumb">
            <span @click="currentDetailedView = null" class="breadcrumb-link">设置</span>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">{{ getPluginName(currentDetailedView) }}</span>
        </div>
        <button class="lw-btn lw-btn-ghost lw-btn-small" @click="currentDetailedView = null">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="margin-right: 4px;">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            返回概览
        </button>
      </div>
      <div v-if="mode === 'small' && currentDetailedView" class="small-back-bar">
        <button class="small-back-btn" @click="currentDetailedView = null">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>返回</span>
        </button>
        <span class="small-back-title">{{ getPluginName(currentDetailedView) }}</span>
      </div>
      <div class="settings-scroll-area" @wheel.stop>
        <component :is="currentDetailedView ? SettingsDetailed : SettingsUnified" :pluginId="currentDetailedView"
          @open-detail="openDetailedView" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SettingsUnified from './SettingsUnified.vue';
import SettingsDetailed from './SettingsDetailed.vue';
import { activeSettings, currentDetailedView } from './useSettings.js';
import { getSettingsEntry, getVisibleSettingsEntries } from './settingsRegistry';
import { getActiveDesktopModeIdFromSettings } from '../../theme/themeRegistry';
import { useComponentSkin } from '../../theme/useComponentSkin';

const props = defineProps({
  mode: {
    type: String,
    default: 'small' // 'small' | 'large'
  }
});

const { cssVars, variant: settingsVariant } = useComponentSkin('settings.root');
const settingsSkinStyle = computed(() => cssVars.value);
const activeThemeId = computed(() => getActiveDesktopModeIdFromSettings(activeSettings));

const openDetailedView = (pluginId: string) => {
  currentDetailedView.value = pluginId;
};

const getPluginName = (pluginId: string | null) => {
  if (!pluginId) return '';
  const entry = getSettingsEntry(pluginId);
  return entry ? entry.pluginName : pluginId;
};

const visibleEntries = computed(() => getVisibleSettingsEntries(activeThemeId.value));
const activeThemeEntry = computed(() => visibleEntries.value.find(entry => entry.kind === 'desktop-mode') || null);
const settingsBlocks = computed(() => visibleEntries.value.filter(entry => entry.kind === 'plugin'));
</script>

<style scoped>
.lw-settings-root {
  display: flex;
  flex-direction: row;
  height: 100%;
  background: var(--lw-settings-shell-bg,
    linear-gradient(180deg, rgba(var(--lw-bg-elevated-rgb), 0.48), rgba(var(--lw-bg-elevated-rgb), 0)));
  font-family: inherit;
  overflow: hidden;
}

.is-large {
  background: var(--lw-bg-app);
}

.settings-sidebar {
  width: 240px;
  border-right: 1px solid var(--lw-border-base);
  display: flex;
  flex-direction: column;
  background: var(--lw-settings-sidebar-bg, color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent));
  flex-shrink: 0;
}

.sidebar-header {
  padding: 22px 20px 18px;
  border-bottom: 1px solid var(--lw-border-subtle);
}

.sidebar-header h3 {
  font-family: var(--lw-font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--lw-text-main);
  letter-spacing: -0.02em;
}

.sidebar-nav {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 2px;
}

.nav-item:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.nav-item.active {
  background: var(--lw-bg-selection);
  color: var(--lw-text-main);
  box-shadow: var(--lw-shadow);
}

.nav-divider {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 16px 12px 8px;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.settings-main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-content-header {
  padding: 16px 28px;
  border-bottom: 1px solid var(--lw-border-base);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--lw-settings-header-bg, color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent));
}

.header-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}

.breadcrumb-link {
    color: var(--lw-text-secondary);
    cursor: pointer;
    transition: color 0.2s;
}

.breadcrumb-link:hover {
    color: var(--lw-primary);
}

.breadcrumb-sep {
    color: var(--lw-text-muted);
}

.breadcrumb-current {
    color: var(--lw-text-main);
    font-weight: 600;
}

.settings-scroll-area {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.small-back-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--lw-border-base);
  background: var(--lw-settings-header-bg, color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent));
}

.small-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--lw-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.small-back-btn:hover {
  background: var(--lw-primary-soft);
}

.small-back-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-main);
}

/* 隐藏滚动条但保留功能 */
.settings-scroll-area::-webkit-scrollbar {
  width: 4px;
}

.settings-scroll-area::-webkit-scrollbar-thumb {
  background: var(--lw-border-base);
  border-radius: 2px;
}

.settings-scroll-area::-webkit-scrollbar-thumb:hover {
  background: var(--lw-text-muted);
}

.lw-settings-root[data-skin-variant='discord'] {
  background: #313338;
}

.lw-settings-root[data-skin-variant='discord'] .settings-sidebar {
  background: #232428;
  border-right-color: #1e1f22;
}

.lw-settings-root[data-skin-variant='discord'] .sidebar-header,
.lw-settings-root[data-skin-variant='discord'] .main-content-header,
.lw-settings-root[data-skin-variant='discord'] .small-back-bar {
  background: #2b2d31;
  border-bottom-color: #1e1f22;
}

.lw-settings-root[data-skin-variant='discord'] .nav-item {
  color: #b5bac1;
}

.lw-settings-root[data-skin-variant='discord'] .nav-item:hover {
  background: #35373c;
  color: #f2f3f5;
}

.lw-settings-root[data-skin-variant='discord'] .nav-item.active {
  background: #404249;
  color: #ffffff;
  box-shadow: none;
}

.lw-settings-root[data-skin-variant='discord'] .nav-divider,
.lw-settings-root[data-skin-variant='discord'] .breadcrumb-link,
.lw-settings-root[data-skin-variant='discord'] .breadcrumb-sep {
  color: #949ba4;
}

.lw-settings-root[data-skin-variant='discord'] .breadcrumb-link:hover {
  color: #f2f3f5;
}
</style>
