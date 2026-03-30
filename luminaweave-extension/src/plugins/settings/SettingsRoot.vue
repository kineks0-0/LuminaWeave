<template>
  <div class="lw-settings-root" :class="{ 'is-large': mode === 'large' }">
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
      <div class="settings-scroll-area" @wheel.stop>
        <component :is="currentDetailedView ? SettingsDetailed : SettingsUnified" :pluginId="currentDetailedView"
          @open-detail="openDetailedView" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { pluginManager } from '../../core/PluginManager.js';
import SettingsUnified from './SettingsUnified.vue';
import SettingsDetailed from './SettingsDetailed.vue';
import { currentDetailedView } from './useSettings.js';

const props = defineProps({
  mode: {
    type: String,
    default: 'small' // 'small' | 'large'
  }
});

const openDetailedView = (pluginId) => {
  currentDetailedView.value = pluginId;
};

const getPluginName = (pluginId) => {
  if (!pluginId) return '';
  const p = pluginManager.getPlugin(pluginId);
  return p ? p.name : pluginId;
};

const settingsBlocks = computed(() => {
  const blocks = [];
  const registered = (pluginManager).registeredSettings;
  Object.keys(registered).forEach(pid => {
    const p = pluginManager.getPlugin(pid);
    if (p) {
      blocks.push({
        pluginId: pid,
        pluginName: p.name,
        pluginIcon: p.icon
      });
    }
  });
  return blocks;
});
</script>

<style scoped>
.lw-settings-root {
  display: flex;
  flex-direction: row;
  height: 100%;
  background: #ffffff;
  font-family: inherit;
  overflow: hidden;
}

.is-large {
  background: #f8fafc;
}

.settings-sidebar {
  width: 240px;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid #f1f5f9;
}

.sidebar-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
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
  border-radius: 8px;
  font-size: 14px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 2px;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.nav-item.active {
  background: rgba(99, 102, 241, 0.08);
  color: var(--lw-primary);
  font-weight: 600;
}

.nav-divider {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
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
  padding: 16px 32px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
}

.header-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}

.breadcrumb-link {
    color: #64748b;
    cursor: pointer;
    transition: color 0.2s;
}

.breadcrumb-link:hover {
    color: var(--lw-primary);
}

.breadcrumb-sep {
    color: #cbd5e1;
}

.breadcrumb-current {
    color: #0f172a;
    font-weight: 600;
}

.settings-scroll-area {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

/* 隐藏滚动条但保留功能 */
.settings-scroll-area::-webkit-scrollbar {
  width: 4px;
}

.settings-scroll-area::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 2px;
}

.settings-scroll-area::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
