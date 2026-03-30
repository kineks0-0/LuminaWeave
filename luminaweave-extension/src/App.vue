<template>
  <div class="luminaweave-app-root" :style="{ pointerEvents: isExpanded ? 'auto' : 'none' }">
    <!-- 未展开态：悬浮小面板 -->
    <transition name="fade">
      <MiniSidebar v-if="!isExpanded" @expand="toggleExpand" />
    </transition>

    <!-- 展开态：全网页视图 -->
    <transition name="panel-slide">
      <div v-if="isExpanded" class="lw-fullscreen-panel">

        <!-- 顶部操作栏 -->
        <PanelHeader :activeMainTab="activeMainTab" :dynamicTabs="dynamicTabs" :isMobile="isMobile"
          @switchMainView="(tab) => activeMainTab = tab" @closeTab="closeTab" @close="toggleExpand"
          @toggleSettings="activeRightPanel = activeRightPanel === 'lumina-settings' ? 'lumina-stats' : 'lumina-settings'" />

          <!-- 主体结构 -->
          <div class="lw-panel-body">
            <!-- Loading 遮罩层 -->
            <div v-if="!isApiReady" class="lw-global-loading">
              <div class="spinner"></div>
              <span>环境加载中... 若长时间无响应请检查 ST 相关扩展(例如 JS-Slash-Runner)是否正常。</span>
            </div>

            <template v-else>
              <template v-for="plugin in mainPlugins" :key="plugin.id">
                <div v-show="activeMainTab === plugin.id" class="lw-main-wrapper"
                  :class="{ 'lw-main-timeline-wrapper': plugin.id === 'lumina-timeline' }">
                  <component :is="plugin.component"
                    v-if="plugin.id !== 'lumina-timeline' || activeMainTab === 'lumina-timeline' || isTimelineLoadedOnce"
                    :mode="'large'" :isMobile="isMobile" />
                </div>
              </template>

              <!-- 动态标签页组件渲染 -->
              <template v-for="tab in dynamicTabs" :key="tab.id">
                <div v-show="activeMainTab === tab.id" class="lw-main-wrapper">
                  <component :is="componentMap[tab.component] || tab.component" v-bind="tab.props" />
                </div>
              </template>

              <!-- Unified Sub-Plugin Widget Container -->
              <div class="lw-widget-container" v-if="activeRightPanel !== 'none'" :class="{ 'is-mobile': isMobile }"
                :style="{ width: isMobile ? '100%' : widgetWidth + 'px', minWidth: isMobile ? '100%' : widgetWidth + 'px' }">

            <!-- Floating Resizer Handle -->
            <div v-if="!isMobile" class="lw-widget-resizer" :class="{ 'is-resizing': isResizing }"
              @mousedown.stop.prevent="initResize">
            </div>
            <div class="widget-container-header">
              <!-- Integrated Settings Navigation -->
              <div v-if="activeRightPanel === 'lumina-settings' && currentDetailedView" class="widget-back-nav">
                <button class="icon-action-btn" @click="currentDetailedView = null" title="返回概览">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <div class="current-widget-info">
                  <span class="widget-sub-title">{{ getPluginName(currentDetailedView) }} 专属设置</span>
                </div>
              </div>

              <!-- Default Widget Header with Dropdown -->
              <div v-else class="widget-dropdown" @click="showWidgetDropdown = !showWidgetDropdown"
                v-if="activeWidgetPlugin">
                <div class="current-widget-info">
                  <span v-html="activeWidgetPlugin.icon" class="tab-icon-wrapper"></span>
                  <span v-if="activeRightPanel === 'lumina-settings'">所有插件概览</span>
                  <span v-else>{{ activeWidgetPlugin.name }}</span>
                  <svg class="chevron-down" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor"
                    stroke-width="2" fill="none">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>

                <div class="dropdown-menu" v-if="showWidgetDropdown">
                  <div class="dropdown-item" v-for="plugin in widgetPlugins" :key="plugin.id"
                    @click.stop="switchRightPanel(plugin.id)">
                    <span v-html="plugin.icon" class="tab-icon-wrapper"></span>
                    {{ plugin.name }}
                  </div>
                </div>
              </div>

              <div class="widget-actions">
                <!-- Sync Status Indicator for Settings -->
                <div v-if="activeRightPanel === 'lumina-settings'" class="header-sync-status" :class="saveStatus">
                  <span>{{ saveStatus === 'saving' ? '正在存入' : (saveStatus === 'saved' ? '已保存' : '') }}</span>
                </div>

                <button @click="activeRightPanel = 'none'" title="Close Panel">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

                <div class="widget-container-body">
                  <component :is="activeWidgetPlugin?.component" v-if="activeWidgetPlugin" :mode="'small'"
                    :isMobile="isMobile" />
                </div>
              </div>
            </template>
          </div>

        </div>
    </transition>

    <!-- Global Conflict Resolver Popup -->
    <ConflictDiffViewer ref="globalConflictViewer" />

    <!-- Global Toast Notifier for LuminaWeave -->
    <ToastNotification />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, provide } from 'vue';
import { luminaWeaveApi as lwApi } from './api/index';
import { pluginManager } from './core/PluginManager';
import { useSettings, currentDetailedView } from './plugins/settings/useSettings';
import { lwStorage } from './api/storage';
import { registerLuminaPlugins } from './bootstrap/registerPlugins';

import MiniSidebar from './components/MiniSidebar.vue';
import PanelHeader from './components/PanelHeader.vue';
import ToastNotification from './components/ToastNotification.vue';

// Import dynamic components for tabs
import ConflictDiffViewer from './plugins/chat/ConflictDiffViewer.vue';
import SettingsRoot from './plugins/settings/SettingsRoot.vue';
import LauncherRoot from './plugins/launcher/LauncherRoot.vue';

const componentMap: Record<string, any> = {
  'ConflictDiffViewer': ConflictDiffViewer,
  'SettingsRoot': SettingsRoot,
  'LauncherRoot': LauncherRoot
};

registerLuminaPlugins();

const mainPlugins = computed(() => pluginManager.getPluginsInSlot('mainView'));
const widgetPlugins = computed(() => pluginManager.getPluginsInSlot('widget'));

const isExpanded = ref(false);
const isApiReady = ref(false);
const isMobile = ref(window.innerWidth < 768);

const handleResizeWindow = () => {
  isMobile.value = window.innerWidth < 768;
};
// 从存储恢复上次打开的主面板 Tab
const activeMainTab = ref('lumina-chat');
const dynamicTabs = ref<any[]>([]);

const activeRightPanel = ref('lumina-settings');
const showWidgetDropdown = ref(false);
const globalConflictViewer = ref<any>(null);

// 性能优化：记录是否加载过时空图谱，避免切回主 Tab 时重新挂载（保持 LogicFlow 物理内存持久）
const isTimelineLoadedOnce = ref(false);

const handleOpenTab = (tabConfig: any) => {
  const existingIndex = dynamicTabs.value.findIndex(t => t.id === tabConfig.id);
  if (existingIndex === -1) {
    dynamicTabs.value.push(tabConfig);
  } else {
    // 更新配置
    dynamicTabs.value[existingIndex] = { ...dynamicTabs.value[existingIndex], ...tabConfig };
  }
  activeMainTab.value = tabConfig.id;
};

const closeTab = (tabId: string) => {
  const index = dynamicTabs.value.findIndex(t => t.id === tabId);
  if (index !== -1) {
    dynamicTabs.value.splice(index, 1);
    // 如果关闭的是当前激活的 tab，切换回默认 tab
    if (activeMainTab.value === tabId) {
      activeMainTab.value = 'lumina-chat';
    }
  }
};

const activeWidgetPlugin = computed(() => pluginManager.getPlugin(activeRightPanel.value));

const switchRightPanel = (panelId: string) => {
  activeRightPanel.value = panelId;
  showWidgetDropdown.value = false;
};

// 监听切换，实时将状态写入缓存
watch(activeMainTab, (val) => {
  lwStorage.set('luminaWeave.activeMainTab', val, 'Global');
  if (val === 'lumina-timeline') isTimelineLoadedOnce.value = true;
});
watch(activeRightPanel, (val) => {
  // 关闭面板时不写入“none”，避免下次就希望小窗口自动展开却发现关
  if (val !== 'none') lwStorage.set('luminaWeave.activeRightPanel', val, 'Global');
});

provide('lwApi', lwApi);

// --- Widget Resizer Drag Logic ---
const widgetWidth = ref(lwStorage.get('luminaWeave.widgetWidth', 400, 'Global'));
const isResizing = ref(false);

const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return;
  // Calculate new width: window.innerWidth - right padding/margin (but panel takes flex space, so innerWidth - e.clientX)
  const newWidth = window.innerWidth - e.clientX;
  if (newWidth >= 300 && newWidth <= 800) {
    widgetWidth.value = newWidth;
  }
};

const stopResize = () => {
  if (!isResizing.value) return;
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  lwStorage.set('luminaWeave.widgetWidth', widgetWidth.value, 'Global');
};

const initResize = () => {
  isResizing.value = true;
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

// ---------------------------------

const { initSettings, saveStatus } = useSettings();

const getPluginName = (pluginId: string | null) => {
  if (!pluginId) return '';
  const p = pluginManager.getPlugin(pluginId);
  return p ? p.name : pluginId;
};

const toggleExpand = async () => {
  isExpanded.value = !isExpanded.value;
  if (isExpanded.value) {
    setTimeout(() => {
      lwApi.emit('SCROLL_TO_BOTTOM', { force: true });
    }, 400);

    setTimeout(() => {
      const state = lwApi.getConflictState?.();
      if (state?.hasConflict) {
        globalConflictViewer.value?.open();
      }
    }, 100);
  }
};

onMounted(async () => {
  lwApi.registerPanel('conflict', ConflictDiffViewer, {
    title: '版本分歧比对',
    icon: '⚡',
  });

  lwApi.on('OPEN_TAB', handleOpenTab);
  lwApi.on('SWITCH_WIDGET_PANEL', (panelId: string) => {
    activeRightPanel.value = panelId;
  });

  initSettings();

  // 核心优化：直接调用 lwApi.init()，内部已整合环境探测 (ST, Helper, EventSource)
  await lwApi.init();
  isApiReady.value = true;
  console.log('[LuminaWeave] Global API initialization complete. UI Render unblocked.');

  lwApi.on('OPEN_PANEL_CONFLICT', () => {
    globalConflictViewer.value?.open();
  });

  window.addEventListener('resize', handleResizeWindow);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResizeWindow);
});
</script>

<style>
/* @license LuminaWeave Style */
/* adjust tab icon wrapper */
.tab-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ======= 全局 CSS 变量与重置 ======= */
:root {
  --lw-surface: #ffffff;
  --lw-glass-blur: blur(12px);
  --lw-border: #e2e8f0;
  --lw-border-subtle: rgba(0, 0, 0, 0.04);
  --lw-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --lw-primary: #0061e0;
  --lw-text-main: #111827;
  --lw-text-secondary: #6b7280;
  --lw-transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  --lw-radius: 8px;
  --lw-radius-sm: 6px;
  --lw-panel-padding: 16px;
  --lw-bg-color: #f1f5f9;
}

/* ======= 外部样式隔离与全局重置 (CSS Isolation) ======= */
.luminaweave-app-root {
  /* 阻断大部分可继承的 ST 全局样式 */
  color: var(--lw-text-main);
  font-family: var(--lw-font, 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
  letter-spacing: normal;
  word-spacing: normal;
  text-transform: none;
  text-indent: 0;
  text-shadow: none;

  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  pointer-events: none;
  /* Let clicks pass through the invisible background */
}

/* input[type="text"],
input[type="number"],
input[type="switch"],
input:not([type]),
textarea:not([type="search"]) {
  background-color: transparent !important;
  border: 0px solid transparent !important;
}
 */
.luminaweave-app-root * {
  box-sizing: border-box;
  /* 适度隔离内外 margin，防止 ST 的 div/p 标签样式影响 */
  margin: 0;
  padding: 0;
}

.luminaweave-app-root p {
  margin-block-start: 1em;
  margin-block-end: 1em;
}

/* .luminaweave-app-root button,
.luminaweave-app-root input,
.luminaweave-app-root textarea {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
} */

.luminaweave-app-root>* {
  pointer-events: auto;
  /* Re-enable clicks for visible children */
}

.lw-fullscreen-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #f8fafc !important;
  /* 强制背景色 */
  display: flex;
  flex-direction: column;
  z-index: 10000;
  overflow: hidden;
  width: 100vw;
  height: 100vh;
}

/* 主体分为左右结构 */
.lw-panel-body {
  flex: 1;
  display: flex !important;
  flex-direction: row !important;
  direction: ltr !important;
  overflow: hidden;
  min-height: 0;
  /* 关键：允许子元素在 flex 容器中正常缩放 */
}

@media (max-width: 768px) {
  .lw-panel-body {
    flex-direction: column !important;
    height: calc(100vh - 60px);
    min-height: calc(100vh - 60px);
    /* 减去 header 高度 */
  }
}

.lw-main-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  /* 桌面端保持 100% */
}

@media (max-width: 768px) {
  .lw-main-wrapper {
    height: auto;
    /* 移动端在 column 布局下设为 auto 以正确应用 flex: 1 */
    min-height: 0;
  }
}

.lw-main-timeline-wrapper {
  flex: 1;
  overflow: hidden;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
}

/* --- 统一的小窗口 API 容器 Widgets Container --- */
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
  background-color: var(--lw-primary, rgba(0, 97, 224, 0.5)) !important;
}

.lw-widget-container {
  /* width and min-width provided by inline style */
  background: #ffffff;
  border-left: 1px solid var(--lw-border, #e2e8f0);
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  transition: var(--lw-transition);
}

@media (max-width: 768px) {
  .lw-widget-container {
    height: 50%;
    /* 移动端显示时占一半高度，防止压缩主视图 */
    border-left: none;
    border-top: 1px solid #e2e8f0;
  }
}

.widget-container-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--lw-text-main, #111827);
  padding: 6px 10px;
  border-radius: var(--lw-radius-sm, 6px);
  transition: var(--lw-transition);
}

.current-widget-info:hover {
  background: #f1f5f9;
}

.current-widget-info .chevron-down {
  margin-left: 4px;
  color: #94a3b8;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  min-width: 200px;
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  font-size: 14px;
  color: #475569;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: #f8fafc;
  color: var(--lw-primary);
}

.widget-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.widget-actions button {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: 0.2s;
}

.widget-actions button:hover {
  background: #f1f5f9;
  color: #ef4444;
}

.widget-container-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.widget-back-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.widget-sub-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-text-main);
}

.header-sync-status {
  display: flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 8px;
  opacity: 0;
  transition: all 0.3s;
  transform: scale(0.9);
}

.header-sync-status.saving,
.header-sync-status.saved {
  opacity: 1;
  transform: scale(1);
}

.header-sync-status.saving {
  background: rgba(0, 97, 224, 0.1);
  color: var(--lw-primary);
  animation: lw-pulse 2s infinite;
}

.header-sync-status.saved {
  background: #dcfce7;
  /* 浅绿背景 */
  color: #15803d;
  /* 深绿文字 */
}

@keyframes lw-pulse {
  0% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.7;
  }
}

.icon-action-btn {
  padding: 6px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--lw-text-secondary);
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.icon-action-btn:hover {
  background: #f1f5f9;
  color: var(--lw-text-main);
}

/* --- Vue 过渡动画 --- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: scale(0.98) translateY(10px);
}

/* --- Global Loading Overlay --- */
.lw-global-loading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 16px;
  width: 100%;
  height: 100%;
  color: #64748b;
  font-size: 14px;
}

.lw-global-loading .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: var(--lw-primary, #0061e0);
  border-radius: 50%;
  animation: lw-spin 1s linear infinite;
}

@keyframes lw-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
