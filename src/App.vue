<template>
  <div
    class="luminaweave-app-root"
    :data-theme="resolvedTheme"
    :data-desktop-mode="activeDesktopModeId"
    :data-motion="motionPerformanceSetting"
    :data-layout-mode="layoutMode"
    :style="appRootStyle"
  >
    <!-- 未展开态：悬浮小面板 -->
    <transition name="fade">
      <MiniSidebar v-if="!isExpanded" @expand="toggleExpand" />
    </transition>

    <!-- 展开态：全网页视图 -->
    <transition name="panel-slide">
      <div
        v-if="isExpanded"
        class="lw-fullscreen-panel"
        :data-shell-variant="shellAppVariant || 'default'"
        :style="shellPanelStyle"
      >

        <PanelHeader
          v-if="layoutMode === 'traditional' && traditionalHeaderPosition === 'top'"
          :activeMainTab="activeMainTab"
          :dynamicTabs="dynamicTabs"
          :isMobile="isMobile"
          :activeDesktopModeId="activeDesktopModeId"
          :desktopModes="desktopModeOptions"
          :variant="panelHeaderVariant"
          :headerPlacement="traditionalHeaderPosition"
          :widgetPanels="widgetPanelList"
          :widgetGroups="widgetGroups"
          :activeWidgetId="activeRightPanel !== 'none' ? activeRightPanel : ''"
          @switchMainView="handleSwitchMainView"
          @closeTab="closeTab"
          @close="toggleExpand"
          @toggleSettings="openSettingsPanel"
          @setDesktopMode="updateDesktopMode"
          @openWidget="handleOpenWidget"
        />

        <transition name="fade">
          <div
            v-if="showWorkspaceMenu && isFreeformLayout"
            class="lw-workspace-menu"
            :class="{ 'is-freeform': isFreeformLayout }"
            :data-skin-variant="shellWorkspaceMenuVariant || 'default'"
            :style="shellWorkspaceMenuStyle"
          >
            <div class="lw-workspace-menu-copy">
              <span class="lw-workspace-menu-kicker">Desktop Mode</span>
              <strong>切换桌面模式</strong>
              <span>默认使用传统桌面。自由工作台采用 iPadOS 式窗口交互。</span>
            </div>

            <button
              v-for="desktopMode in desktopModeOptions"
              :key="desktopMode.value"
              class="lw-workspace-menu-item"
              :class="{ active: activeDesktopModeId === desktopMode.value }"
              @click="updateDesktopMode(desktopMode.value)"
            >
              <span>{{ desktopMode.label }}</span>
              <small>{{ desktopMode.description }}</small>
            </button>

            <button class="lw-workspace-menu-item" @click="layoutMode === 'freeform' ? createStageWithLauncher() : toggleAuxWindow()">
              <span>{{ layoutMode === 'freeform' ? '新建舞台' : (activeRightPanel === 'none' ? '打开辅助窗口' : '隐藏辅助窗口') }}</span>
              <small>{{ layoutMode === 'freeform' ? '创建一个空舞台，并将启动台调度到前台。' : (activeRightPanel === 'none' ? `恢复 ${getPluginName(lastKnownRightPanel)}` : `当前为 ${getPluginName(activeRightPanel)}`) }}</small>
            </button>

            <button v-if="layoutMode === 'freeform'" class="lw-workspace-menu-item" @click="openWorkspaceSettings">
              <span>打开设置窗口</span>
              <small>把设置窗口调到当前舞台的前台位置。</small>
            </button>
          </div>
        </transition>

        <div class="lw-panel-body" :class="{ 'is-freeform': layoutMode === 'freeform' }" :style="shellPanelBodyStyle" ref="panelBodyRef">
          <div v-if="!isApiReady" class="lw-global-loading">
            <div class="spinner"></div>
            <span>环境加载中... 若长时间无响应请检查 ST 相关扩展(例如 JS-Slash-Runner)是否正常。</span>
            <span style="color: var(--lw-primary); font-weight: bold; margin-top: 8px;">当前进度: {{ initStatusText }}</span>
          </div>

          <template v-else-if="layoutMode === 'traditional'">
            <DiscordGuildRail
              v-if="shouldShowDiscordGuildRail"
              :items="discordGuildEntries"
              :activeMainTab="activeMainTab"
              @switchMainView="handleSwitchMainView"
              @toggleSettings="openSettingsPanel"
              @close="toggleExpand"
            />
            <ForgeSidebar
              v-if="shouldShowForgeSidebar"
              :isCollapsed="isForgeSidebarCollapsed"
              @toggleCollapse="isForgeSidebarCollapsed = !isForgeSidebarCollapsed"
              @switchMode="setSidebarMode"
            />
            <DiscordCharacterRail
              v-if="shouldShowDiscordCharacterRail"
              :fallbackCharacterName="discordFallbackCharacterName"
              :fallbackCharacterAvatarUrl="discordFallbackCharacterAvatarUrl"
              @openSession="openDiscordChatSession"
            />
            <template v-for="plugin in mainPlugins" :key="plugin.id">
              <div
                v-show="activeMainTab === plugin.id"
                class="lw-main-wrapper"
                :class="{ 'lw-main-timeline-wrapper': plugin.id === 'lumina-timeline' }"
                :data-surface-variant="shellMainSurfaceVariant"
                :style="shellMainSurfaceStyle"
              >
                <component
                  :is="plugin.component"
                  v-if="plugin.id !== 'lumina-timeline' || activeMainTab === 'lumina-timeline' || isTimelineLoadedOnce"
                  :mode="'large'"
                  :isMobile="isMobile"
                  :auxSidebarMode="isForgeActiveInTraditional ? sidebarMode : undefined"
                  :activeRightPanelId="isForgeActiveInTraditional ? activeRightPanel : undefined"
                />
              </div>
            </template>

            <template v-for="tab in dynamicTabs" :key="tab.id">
              <div
                v-show="activeMainTab === tab.id"
                class="lw-main-wrapper"
                :data-surface-variant="shellMainSurfaceVariant"
                :style="shellMainSurfaceStyle"
              >
                <component
                  :is="componentMap[tab.component] || tab.component"
                  v-bind="tab.props"
                  :auxSidebarMode="isForgeActiveInTraditional ? sidebarMode : undefined"
                  :activeRightPanelId="isForgeActiveInTraditional ? activeRightPanel : undefined"
                />
              </div>
            </template>

            <div class="lw-widget-container" v-if="activeRightPanel !== 'none' && !isMobile" :class="{ 'is-mobile': isMobile }"
              :data-surface-variant="shellWidgetSurfaceVariant"
              :style="{ ...shellWidgetStyle, width: isMobile ? '100%' : widgetWidth + 'px', minWidth: isMobile ? '100%' : widgetWidth + 'px' }"
            >

              <div v-if="!isMobile" class="lw-widget-resizer" :class="{ 'is-resizing': isResizing }" @mousedown.stop.prevent="initResize"></div>
              <div class="widget-container-header">
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

                <div v-else-if="activeWidgetPlugin" class="widget-dropdown" @click="showWidgetDropdown = !showWidgetDropdown">
                  <div class="current-widget-info">
                    <span v-html="activeWidgetPlugin.icon" class="tab-icon-wrapper"></span>
                    <span v-if="activeRightPanel === 'lumina-settings'">所有插件概览</span>
                    <span v-else>{{ activeWidgetPlugin.name }}</span>
                    <svg class="chevron-down" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>

                  <div class="dropdown-menu" v-if="showWidgetDropdown">
                    <template v-for="(group, gi) in widgetGroups" :key="gi">
                      <div v-if="gi > 0" class="dropdown-divider"></div>
                      <div v-if="group.label" class="dropdown-label">{{ group.label }}</div>
                      <div class="dropdown-item" v-for="item in group.items" :key="item.id" @click.stop="switchRightPanel(item.id)">
                        <span class="tab-icon-wrapper" v-html="item.icon"></span>
                        {{ item.name }}
                      </div>
                    </template>
                  </div>
                </div>

                <div v-else-if="activeRegisteredPanel" class="widget-dropdown" @click="showWidgetDropdown = !showWidgetDropdown">
                  <div class="current-widget-info">
                    <span>{{ activeRegisteredPanel.config.title }}</span>
                    <svg class="chevron-down" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>

                  <div class="dropdown-menu" v-if="showWidgetDropdown">
                    <template v-for="(group, gi) in widgetGroups" :key="gi">
                      <div v-if="gi > 0" class="dropdown-divider"></div>
                      <div v-if="group.label" class="dropdown-label">{{ group.label }}</div>
                      <div class="dropdown-item" v-for="item in group.items" :key="item.id" @click.stop="switchRightPanel(item.id)">
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

                  <button v-if="activeForgeAuxKind && isForgeActiveInTraditional && rawSidebarMode === 'widget'" @click="setSidebarMode('left')" title="切换回左侧栏">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                      <rect x="3" y="3" width="7" height="18" rx="1"></rect>
                      <rect x="14" y="3" width="7" height="18" rx="1"></rect>
                    </svg>
                  </button>

                  <button @click="activeRightPanel = 'none'" title="Close Panel">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="widget-container-body" :class="{ 'has-nexus': showNexus }">
                <div v-if="showNexus" class="widget-nexus-sidebar">
                  <LuminaNexus @close="showNexus = false" />
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

          <div
            v-else
            ref="freeformStageRef"
            class="lw-freeform-stage"
            :data-skin-variant="shellWorkspaceStageVariant || 'default'"
            :style="shellWorkspaceStageStyle"
          >
            <Transition name="workspace-nav-motion" appear>
              <WorkspaceStageStrip
                v-if="isWorkspaceStageStripVisible"
                :stages="workspaceStageStripItems"
                :is-mobile="isMobile"
                @activate="activateWorkspaceStageWithNavigation"
                @create="createWorkspaceStageFromStrip"
                @pointerenter="holdWorkspaceNavigation"
                @pointerleave="scheduleWorkspaceNavigationHide()"
              />
            </Transition>

            <div class="lw-freeform-controls">
              <button class="lw-freeform-control" :class="{ active: isWorkspaceNavigationVisible }" @click="toggleWorkspaceNavigation" title="台前调度">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                  <rect x="3" y="4" width="6" height="16" rx="2"></rect>
                  <rect x="12" y="6" width="9" height="5" rx="2"></rect>
                  <rect x="12" y="14" width="9" height="6" rx="2"></rect>
                </svg>
              </button>
              <button class="lw-freeform-control" :class="{ active: showWorkspaceMenu }" @click="showWorkspaceMenu = !showWorkspaceMenu" title="工作台菜单">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                  <line x1="4" y1="7" x2="20" y2="7"></line>
                  <line x1="4" y1="12" x2="20" y2="12"></line>
                  <line x1="4" y1="17" x2="20" y2="17"></line>
                </svg>
              </button>
              <button class="lw-freeform-control" @click="openWorkspaceSettings" title="设置窗口">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
              <button class="lw-freeform-control" @click="toggleExpand" title="退出工作台">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div class="lw-freeform-scene" @pointerdown.self="handleFreeformScenePointerDown">
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
                  @updateLayout="(patch) => updateWorkspaceLayout(entry.id, patch)"
                  @requestClose="closeWorkspaceWindow(entry.id)"
                  @focus="focusWorkspaceWindow(entry.id)"
                  @switchAdjacent="(direction) => focusAdjacentWorkspaceWindow(entry.id, direction)"
                >
                  <template #actions>
                    <ForgeWorkspaceWindowActions v-if="entry.appId === 'panel:card_maker'" />
                    <template v-if="entry.appId === 'plugin:lumina-settings' && currentDetailedView">
                      <button
                        class="icon-action-btn"
                        type="button"
                        title="返回概览"
                        @pointerdown.stop
                        @click.stop="currentDetailedView = null"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                          <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                      </button>
                    </template>
                  </template>
                  <component
                    :is="entry.component"
                    v-bind="{
                      ...entry.props,
                      isMobile: isMobile || entry.isCompact,
                      workspaceCompact: entry.isCompact
                    }"
                  />
                </WorkspaceWindow>
              </TransitionGroup>

              <div v-if="activeStageWindowEntries.length === 0" class="lw-freeform-empty-stage">
                <span class="lw-freeform-empty-kicker">Stage Ready</span>
                <strong>当前舞台为空</strong>
                <span>从底部 Dock 打开工作区，或在左侧创建一个新的舞台组。</span>
              </div>

              <Transition name="workspace-launchpad-motion">
                <div
                  v-if="showWorkspaceLaunchpad"
                  class="lw-workspace-launchpad-overlay"
                  @pointerdown.self="closeWorkspaceLaunchpad"
                >
                  <div class="lw-workspace-launchpad-shell" @pointerdown.stop>
                    <button class="lw-workspace-launchpad-close" type="button" @click="closeWorkspaceLaunchpad" title="关闭启动台">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                    <LauncherRoot
                      presentation="launchpad"
                      :activeMainTab="activeMainTab"
                      :dismissOnSelect="true"
                      @dismiss="closeWorkspaceLaunchpad"
                    />
                  </div>
                </div>
              </Transition>
            </div>

            <Transition name="workspace-nav-motion" appear>
              <WorkspaceDock
                v-if="isWorkspaceDockVisible"
                :items="workspaceDockDisplayItems"
                @open="handleWorkspaceDockOpenWithNavigation"
                @pointerenter="holdWorkspaceNavigation"
                @pointerleave="scheduleWorkspaceNavigationHide()"
              />
            </Transition>
          </div>
        </div>

        <PanelHeader
          v-if="layoutMode === 'traditional' && traditionalHeaderPosition === 'bottom'"
          :activeMainTab="activeMainTab"
          :dynamicTabs="dynamicTabs"
          :isMobile="isMobile"
          :activeDesktopModeId="activeDesktopModeId"
          :desktopModes="desktopModeOptions"
          :variant="panelHeaderVariant"
          :headerPlacement="traditionalHeaderPosition"
          :widgetPanels="widgetPanelList"
          :widgetGroups="widgetGroups"
          :activeWidgetId="activeRightPanel !== 'none' ? activeRightPanel : ''"
          @switchMainView="handleSwitchMainView"
          @closeTab="closeTab"
          @close="toggleExpand"
          @toggleSettings="openSettingsPanel"
          @setDesktopMode="updateDesktopMode"
          @openWidget="handleOpenWidget"
        />

        </div>
    </transition>

    <!-- Global Conflict Resolver Popup -->
    <ConflictDiffViewer ref="globalConflictViewer" />
    <SyncReportViewer ref="globalSyncReportViewer" />

    <!-- Global Toast Notifier for LuminaWeave -->
    <ToastNotification />

    <!-- 全局确认弹窗系统 -->
    <GlobalConfirmationModal />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, provide, nextTick, type CSSProperties } from 'vue';
import { luminaWeaveApi as lwApi } from './api/index';
import { pluginManager } from './core/PluginManager';
import { useConversationContextStore } from './stores/useConversationContextStore';
import { useSettings, currentDetailedView } from './plugins/settings/useSettings';
import { lwStorage } from './api/storage';
import { registerLuminaPlugins } from './bootstrap/registerPlugins';
import { useWorkspaceManager } from './composables/useWorkspaceManager';
import { useResponsiveLayout } from './composables/useResponsiveLayout';
import { getDesktopModeOptions, resolveThemeValues } from './theme/themeRegistry';
import { useComponentSkin } from './theme/useComponentSkin';
import { useThemePack } from './theme/useThemePack';
import type { ThemeTraditionalNavigationPreset } from './theme/types';

import MiniSidebar from './components/MiniSidebar.vue';
import PanelHeader from './components/PanelHeader.vue';
import LuminaNexus from './components/LuminaNexus.vue';
import WorkspaceWindow from './components/WorkspaceWindow.vue';
import WorkspaceDock from './components/WorkspaceDock.vue';
import WorkspaceStageStrip from './components/WorkspaceStageStrip.vue';
import ForgeSidebar from './components/ForgeSidebar.vue';
import DiscordCharacterRail from './components/DiscordCharacterRail.vue';
import DiscordGuildRail from './components/DiscordGuildRail.vue';
import GlobalConfirmationModal from './components/common/GlobalConfirmationModal.vue';

// Import dynamic components for tabs
import ConflictDiffViewer from './plugins/chat/ConflictDiffViewer.vue';
import SyncReportViewer from './plugins/chat/SyncReportViewer.vue';
import SettingsRoot from './plugins/settings/SettingsRoot.vue';
import LauncherRoot from './plugins/launcher/LauncherRoot.vue';
import CardMakerPanel from './plugins/forge/CardMakerPanel.vue';
import ForgeWorkspaceWindowActions from './plugins/forge/ForgeWorkspaceWindowActions.vue';
import ContextSwitcherPanel from './components/ContextSwitcherPanel.vue';

const componentMap: Record<string, any> = {
  'ConflictDiffViewer': ConflictDiffViewer,
  'SyncReportViewer': SyncReportViewer,
  'SettingsRoot': SettingsRoot,
  'LauncherRoot': LauncherRoot
};

registerLuminaPlugins();

type LayoutMode = 'traditional' | 'freeform';

const mainPlugins = computed(() => pluginManager.getPluginsInSlot('mainView'));
const settingsRevision = ref(0);
const widgetPlugins = computed(() => {
  // 依赖 settingsRevision 以确保设置变更时（如开发模式切换）实时刷新插件列表
  settingsRevision.value;
  return pluginManager.getPluginsInSlot('widget');
});

const { initSettings, saveStatus, activeSettings, updateSetting } = useSettings();
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');

const isExpanded = ref(false);
const isApiReady = ref(false);
const panelBodyRef = ref<HTMLElement | null>(null);
const viewportHeightPx = ref(window.innerHeight);
const viewportWidthPx = ref(window.innerWidth);
const viewportOffsetTopPx = ref(0);
const viewportOffsetLeftPx = ref(0);
const keyboardInsetPx = ref(0);
const {
    isMobile: responsiveIsMobile,
    canShowEmbeddedSidebar,
    sidebarMode,
    rawSidebarMode,
    setSidebarMode,
    containerWidth,
} = useResponsiveLayout(panelBodyRef);
const isMobile = responsiveIsMobile;
const showWorkspaceMenu = ref(false);
const initStatusText = ref('等待系统启动...');
const isForgeSidebarCollapsed = ref(false);
const systemPrefersDark = ref(themeMedia.matches);
const appearanceSetting = computed(() => activeSettings['lumina-settings.appearance'] || 'system');
const desktopModeOptions = computed(() => getDesktopModeOptions());
const {
  desktopModeId: activeDesktopModeId,
  desktopMode: activeDesktopMode,
  desktopShell,
  navigationPreset,
  surfacePreset
} = useThemePack();
const layoutMode = computed<LayoutMode>(() => desktopShell.value.kind as LayoutMode);
const traditionalNavigationPreset = computed<Required<ThemeTraditionalNavigationPreset>>(() => ({
  headerVariant: navigationPreset.value.traditional?.headerVariant || 'default',
  leftRail: navigationPreset.value.traditional?.leftRail || 'none',
  widgetVariant: navigationPreset.value.traditional?.widgetVariant || 'default',
  headerDesktopPosition: navigationPreset.value.traditional?.headerDesktopPosition || 'follow-setting',
  headerMobilePosition: navigationPreset.value.traditional?.headerMobilePosition || 'follow-setting'
}));
const panelHeaderVariant = computed(() => traditionalNavigationPreset.value.headerVariant || 'default');
const resolvedTheme = computed(() => {
  if (activeDesktopMode.value.preferredAppearance === 'light' || activeDesktopMode.value.preferredAppearance === 'dark') {
    return activeDesktopMode.value.preferredAppearance;
  }
  if (appearanceSetting.value === 'light' || appearanceSetting.value === 'dark') {
    return appearanceSetting.value;
  }
  return systemPrefersDark.value ? 'dark' : 'light';
});
const workspaceShowStageStripSetting = computed(() => activeSettings['lumina-settings.workspaceShowStageStrip'] !== false);
const workspaceShowDockSetting = computed(() => activeSettings['lumina-settings.workspaceShowDock'] !== false);
const motionPerformanceSetting = computed(() => activeSettings['lumina-settings.motionPerformance'] || 'full');
const traditionalHeaderDesktopPosition = computed(() => {
  if (traditionalNavigationPreset.value.headerDesktopPosition === 'top' || traditionalNavigationPreset.value.headerDesktopPosition === 'bottom') {
    return traditionalNavigationPreset.value.headerDesktopPosition;
  }
  return activeSettings['lumina-settings.traditionalHeaderDesktopPosition'] || 'top';
});
const traditionalHeaderMobilePosition = computed(() => {
  if (traditionalNavigationPreset.value.headerMobilePosition === 'top' || traditionalNavigationPreset.value.headerMobilePosition === 'bottom') {
    return traditionalNavigationPreset.value.headerMobilePosition;
  }
  return activeSettings['lumina-settings.traditionalHeaderMobilePosition'] || 'top';
});
const traditionalHeaderPosition = computed<'top' | 'bottom'>(() =>
  (isMobile.value ? traditionalHeaderMobilePosition.value : traditionalHeaderDesktopPosition.value) === 'bottom'
    ? 'bottom'
    : 'top'
);
const { cssVars: shellAppSkinVars, variant: shellAppVariant } = useComponentSkin('shell.app');
const { cssVars: shellPanelBodySkinVars } = useComponentSkin('shell.panelBody');
const { cssVars: shellMainSurfaceSkinVars } = useComponentSkin('shell.mainSurface');
const { cssVars: shellWidgetSkinVars } = useComponentSkin('shell.widget');
const { cssVars: shellWorkspaceStageSkinVars, variant: shellWorkspaceStageVariant } = useComponentSkin('shell.workspaceStage');
const { cssVars: shellWorkspaceMenuSkinVars, variant: shellWorkspaceMenuVariant } = useComponentSkin('shell.workspaceMenu');
const appRootStyle = computed<CSSProperties>(() => ({
  pointerEvents: isExpanded.value ? 'auto' : 'none',
  '--lw-app-height': `${viewportHeightPx.value}px`,
  '--lw-app-width': `${viewportWidthPx.value}px`,
  '--lw-viewport-offset-top': `${viewportOffsetTopPx.value}px`,
  '--lw-viewport-offset-left': `${viewportOffsetLeftPx.value}px`,
  '--lw-keyboard-inset': `${keyboardInsetPx.value}px`,
  ...resolveThemeValues(activeDesktopMode.value.designTokens, {
    activeSettings,
    resolvedAppearance: resolvedTheme.value,
    themePackId: activeDesktopModeId.value,
    desktopModeId: activeDesktopModeId.value
  })
}));
const shellPanelStyle = computed<CSSProperties>(() => shellAppSkinVars.value as CSSProperties);
const shellPanelBodyStyle = computed<CSSProperties>(() => shellPanelBodySkinVars.value as CSSProperties);
const shellMainSurfaceStyle = computed<CSSProperties>(() => shellMainSurfaceSkinVars.value as CSSProperties);
const shellWidgetStyle = computed<CSSProperties>(() => shellWidgetSkinVars.value as CSSProperties);
const shellWorkspaceStageStyle = computed<CSSProperties>(() => shellWorkspaceStageSkinVars.value as CSSProperties);
const shellWorkspaceMenuStyle = computed<CSSProperties>(() => shellWorkspaceMenuSkinVars.value as CSSProperties);
const shellMainSurfaceVariant = computed(() => surfacePreset.value.mainSurfaceVariant || 'default');
const shellWidgetSurfaceVariant = computed(() =>
  traditionalNavigationPreset.value.widgetVariant || surfacePreset.value.widgetSurfaceVariant || 'default'
);


// 从存储恢复上次打开的主面板 Tab
const activeMainTab = ref(lwStorage.get('luminaWeave.activeMainTab', 'lumina-chat', 'Global'));
const dynamicTabs = ref<any[]>([]);

const activeRightPanel = ref(lwStorage.get('luminaWeave.activeRightPanel', 'lumina-settings', 'Global'));
const lastKnownRightPanel = ref(lwStorage.get('luminaWeave.activeRightPanel', 'lumina-settings', 'Global'));
const showWidgetDropdown = ref(false);
const globalConflictViewer = ref<any>(null);
const globalSyncReportViewer = ref<any>(null);
const freeformStageRef = ref<HTMLElement | null>(null);

// 性能优化：记录是否加载过时空图谱，避免切回主 Tab 时重新挂载（保持 LogicFlow 物理内存持久）
const isTimelineLoadedOnce = ref(false);

const isForgeActiveInTraditional = computed(() =>
    layoutMode.value === 'traditional' && (activeMainTab.value === 'lumina-forge' || activeMainTab.value === 'card_maker')
);
const isFreeformLayout = computed(() => layoutMode.value === 'freeform');
const shouldShowForgeSidebar = computed(() =>
    isForgeActiveInTraditional.value && sidebarMode.value === 'left' && !isMobile.value
);
const shouldShowDiscordGuildRail = computed(() =>
    layoutMode.value === 'traditional'
    && activeDesktopModeId.value === 'discord'
    && !isMobile.value
);
const shouldShowDiscordCharacterRail = computed(() =>
    layoutMode.value === 'traditional'
    && traditionalNavigationPreset.value.leftRail === 'character-rail'
    && !isMobile.value
    && !shouldShowForgeSidebar.value
);
const shouldShowForgeAuxInWidget = computed(() =>
    isForgeActiveInTraditional.value && sidebarMode.value === 'widget' && !isMobile.value
);
const discordFallbackCharacterName = computed(() => lwApi.getAssistantName?.() || 'Assistant');
const discordFallbackCharacterAvatarUrl = computed(() => {
  const name = discordFallbackCharacterName.value;
  return lwApi.getCharAvatar(name) || lwApi.DEFAULT_AVATAR;
});
const discordGuildEntries = computed(() => {
  const pluginEntries = mainPlugins.value
    .filter((plugin) => plugin.id !== 'lumina-launcher')
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      icon: plugin.icon
    }));
  const dynamicEntries = dynamicTabs.value.map((tab) => ({
    id: tab.id,
    name: tab.name,
    icon: tab.icon || ''
  }));
  return [...pluginEntries, ...dynamicEntries];
});

function getPluginName(pluginId: string | null) {
  if (!pluginId) return '';
  const p = pluginManager.getPlugin(pluginId);
  return p ? p.name : pluginId;
}

const activeWidgetPlugin = computed(() => pluginManager.getPlugin(activeRightPanel.value));
const activeRegisteredPanel = computed(() => {
  if (activeWidgetPlugin.value) return null;
  return lwApi.registeredPanels.get(activeRightPanel.value) || null;
});
const activeForgeAuxKind = computed(() => {
  const match = activeRightPanel.value.match(/^forge_(lorebook|memory|export|post_tracks|test_chat)$/);
  return match ? match[1] : null;
});
const forgeAuxPanelItems = computed(() => {
  const items: { id: string; title: string; icon: string }[] = [];
  const forgeAuxKinds = ['lorebook', 'memory', 'export', 'post_tracks', 'test_chat'] as const;
  for (const kind of forgeAuxKinds) {
    const panelId = `forge_${kind}`;
    const registered = lwApi.registeredPanels.get(panelId);
    if (registered) {
      items.push({ id: panelId, title: registered.config.title, icon: registered.config.icon || '' });
    }
  }
  return items;
});
const registeredPanelItems = computed(() => {
  const items: { id: string; title: string; icon: string }[] = [];
  const excludeIds = new Set(['card_maker', 'conflict', 'sync_report', ...forgeAuxPanelItems.value.map(i => i.id)]);
  for (const [id, panel] of lwApi.registeredPanels) {
    if (!excludeIds.has(id)) {
      items.push({ id, title: panel.config.title, icon: panel.config.icon || '' });
    }
  }
  return items;
});
const widgetPanelList = computed(() => {
  const wp = widgetPlugins.value.map(p => ({ id: p.id, name: p.name, icon: p.icon }));
  const rp = registeredPanelItems.value.map(i => ({ id: i.id, name: i.title, icon: i.icon }));
  const fp = forgeAuxPanelItems.value.map(i => ({ id: i.id, name: i.title, icon: i.icon }));
  const cardMakerPanel = lwApi.registeredPanels.get('card_maker');
  const cm = cardMakerPanel ? [{ id: 'card_maker', name: cardMakerPanel.config.title, icon: cardMakerPanel.config.icon || '' }] : [];
  const seen = new Set(wp.map(w => w.id));
  const result = [...wp];
  for (const r of rp) {
    if (!seen.has(r.id)) {
      result.push(r);
      seen.add(r.id);
    }
  }
  for (const f of fp) {
    if (!seen.has(f.id)) {
      result.push(f);
      seen.add(f.id);
    }
  }
  for (const c of cm) {
    if (!seen.has(c.id)) {
      result.push(c);
      seen.add(c.id);
    }
  }
  return result;
});
const widgetGroups = computed(() => {
  const groups: { label?: string; items: { id: string; name: string; icon: string }[] }[] = [];
  const wp = widgetPlugins.value.map(p => ({ id: p.id, name: p.name, icon: p.icon }));
  if (wp.length > 0) groups.push({ label: '插件', items: wp });
  const fp = forgeAuxPanelItems.value.map(i => ({ id: i.id, name: i.title, icon: i.icon }));
  if (fp.length > 0) groups.push({ label: '制卡辅助', items: fp });
  const rp = registeredPanelItems.value.map(i => ({ id: i.id, name: i.title, icon: i.icon }));
  const cardMakerPanel = lwApi.registeredPanels.get('card_maker');
  const cm = cardMakerPanel ? [{ id: 'card_maker', name: cardMakerPanel.config.title, icon: cardMakerPanel.config.icon || '' }] : [];
  const rpAll = [...cm, ...rp];
  if (rpAll.length > 0) groups.push({ label: '面板', items: rpAll });
  return groups;
});
const showWorkspaceNavigation = ref(false);
const workspaceNavigationPeek = ref(false);
const workspaceNavigationVisibleRef = ref(false);
const showWorkspaceLaunchpad = ref(false);
const showNexus = ref(lwStorage.get('luminaWeave.showNexus', true, 'Global'));
let workspaceNavigationHideTimer: ReturnType<typeof setTimeout> | null = null;

const {
  activeWorkspaceWindowId,
  activeStageWindowEntries,
  workspaceStageStripItems,
  workspaceDockItems,
  workspaceSceneInsets,
  reconcileWorkspaceState,
  reflowWorkspaceWindows,
  updateWorkspaceLayout,
  focusWorkspaceWindow,
  focusAdjacentWorkspaceWindow,
  closeWorkspaceWindow,
  activateWorkspaceStage,
  createWorkspaceStage,
  createStageWithLauncher,
  openWorkspaceSettings,
  handleWorkspaceDockOpen,
  openWorkspaceApp,
  closeWorkspaceApps,
  closeTab: closeWorkspaceTab,
  getWorkspaceAppIdForMainTab,
  workspaceAppMap
} = useWorkspaceManager({
  mainPlugins,
  widgetPlugins,
  dynamicTabs,
  activeMainTab,
  activeRightPanel,
  isMobile,
  freeformStageRef,
  workspaceNavigationVisible: workspaceNavigationVisibleRef,
  componentMap,
  getPluginName
});

const isWorkspaceNavigationVisible = computed(() =>
  showWorkspaceNavigation.value || workspaceNavigationPeek.value || activeStageWindowEntries.value.length === 0
);
const isWorkspaceStageStripVisible = computed(() => isWorkspaceNavigationVisible.value && workspaceShowStageStripSetting.value);
const isWorkspaceDockVisible = computed(() => isWorkspaceNavigationVisible.value && workspaceShowDockSetting.value);
const workspaceDockDisplayItems = computed(() =>
  workspaceDockItems.value.map((item) => (
    item.id === 'plugin:lumina-launcher'
      ? { ...item, isActive: showWorkspaceLaunchpad.value || item.isActive }
      : item
  ))
);
const shouldShowWorkspaceNavigationOnEntry = () =>
  workspaceShowStageStripSetting.value || workspaceShowDockSetting.value;
watch(isWorkspaceNavigationVisible, (value) => {
  workspaceNavigationVisibleRef.value = value;
}, { immediate: true });

const clearWorkspaceNavigationHideTimer = () => {
  if (workspaceNavigationHideTimer) {
    clearTimeout(workspaceNavigationHideTimer);
    workspaceNavigationHideTimer = null;
  }
};

const scheduleWorkspaceNavigationHide = (delay = isMobile.value ? 1400 : 720) => {
  clearWorkspaceNavigationHideTimer();
  if (showWorkspaceNavigation.value || activeStageWindowEntries.value.length === 0) {
    return;
  }
  workspaceNavigationHideTimer = setTimeout(() => {
    workspaceNavigationPeek.value = false;
    workspaceNavigationHideTimer = null;
  }, delay);
};

const holdWorkspaceNavigation = () => {
  clearWorkspaceNavigationHideTimer();
  if (!showWorkspaceNavigation.value) {
    workspaceNavigationPeek.value = true;
  }
};

const revealWorkspaceNavigation = (delay = isMobile.value ? 1800 : 900) => {
  if (showWorkspaceNavigation.value) {
    clearWorkspaceNavigationHideTimer();
    return;
  }
  workspaceNavigationPeek.value = true;
  if (activeStageWindowEntries.value.length > 0) {
    scheduleWorkspaceNavigationHide(delay);
  }
};

const closeWorkspaceLaunchpad = () => {
  if (!showWorkspaceLaunchpad.value) return;
  showWorkspaceLaunchpad.value = false;
  if (!showWorkspaceNavigation.value && !showWorkspaceMenu.value && activeStageWindowEntries.value.length > 0) {
    scheduleWorkspaceNavigationHide(isMobile.value ? 1200 : 480);
  }
};

const openWorkspaceLaunchpad = () => {
  showWorkspaceLaunchpad.value = true;
  clearWorkspaceNavigationHideTimer();
  workspaceNavigationPeek.value = false;
};

const toggleWorkspaceLaunchpad = () => {
  if (showWorkspaceLaunchpad.value) {
    closeWorkspaceLaunchpad();
    return;
  }
  openWorkspaceLaunchpad();
};

const toggleWorkspaceNavigation = () => {
  showWorkspaceNavigation.value = !showWorkspaceNavigation.value;
  if (showWorkspaceNavigation.value) {
    clearWorkspaceNavigationHideTimer();
    workspaceNavigationPeek.value = false;
    return;
  }
  scheduleWorkspaceNavigationHide(0);
};

const handleFreeformScenePointerDown = (event: PointerEvent) => {
  if (!isMobile.value || event.pointerType === 'mouse') return;
  revealWorkspaceNavigation();
};

const activateWorkspaceStageWithNavigation = (stageId: string) => {
  activateWorkspaceStage(stageId);
  if (!showWorkspaceNavigation.value) {
    scheduleWorkspaceNavigationHide(isMobile.value ? 1100 : 420);
  }
};

const createWorkspaceStageFromStrip = () => {
  createWorkspaceStage(true);
  revealWorkspaceNavigation(isMobile.value ? 1800 : 960);
};

const handleWorkspaceDockOpenWithNavigation = (appId: string) => {
  if (appId === 'plugin:lumina-launcher') {
    toggleWorkspaceLaunchpad();
    return;
  }
  closeWorkspaceLaunchpad();
  handleWorkspaceDockOpen(appId);
  if (!showWorkspaceNavigation.value) {
    scheduleWorkspaceNavigationHide(isMobile.value ? 1100 : 420);
  }
};

const openTemporaryWidgetTab = (panelId: string) => {
  const plugin = widgetPlugins.value.find((item) => item.id === panelId);
  if (plugin) {
    activeRightPanel.value = panelId;
    lwApi.openTab({
      id: `mobile-widget:${panelId}`,
      name: plugin.name,
      icon: plugin.icon,
      component: plugin.component,
      props: { mode: 'small', isMobile: true, isTemporaryWidgetTab: true }
    });
    return;
  }
  const registered = lwApi.registeredPanels.get(panelId);
  if (registered) {
    const auxKindMatch = panelId.match(/^forge_(lorebook|memory|export|post_tracks|test_chat)$/);
    const extraProps = auxKindMatch ? { kind: auxKindMatch[1] } : {};
    lwApi.openTab({
      id: `mobile-widget:${panelId}`,
      name: registered.config.title,
      icon: registered.config.icon || '',
      component: registered.component,
      props: { mode: 'small', isMobile: true, isTemporaryWidgetTab: true, ...extraProps }
    });
    return;
  }
};

let resizeThrottleTimer: ReturnType<typeof setTimeout> | null = null;
const syncViewportMetrics = () => {
  const visualViewport = window.visualViewport;
  if (visualViewport) {
    viewportHeightPx.value = Math.round(visualViewport.height);
    viewportWidthPx.value = Math.round(visualViewport.width);
    viewportOffsetTopPx.value = Math.max(0, Math.round(visualViewport.offsetTop));
    viewportOffsetLeftPx.value = Math.max(0, Math.round(visualViewport.offsetLeft));
    keyboardInsetPx.value = Math.max(
      0,
      Math.round(window.innerHeight - visualViewport.height - visualViewport.offsetTop)
    );
    return;
  }

  viewportHeightPx.value = window.innerHeight;
  viewportWidthPx.value = window.innerWidth;
  viewportOffsetTopPx.value = 0;
  viewportOffsetLeftPx.value = 0;
  keyboardInsetPx.value = 0;
};

const handleResizeWindow = () => {
  syncViewportMetrics();
  if (resizeThrottleTimer) return;
  
  resizeThrottleTimer = setTimeout(() => {
    if (layoutMode.value === 'freeform') {
      requestAnimationFrame(reflowWorkspaceWindows);
    }
    resizeThrottleTimer = null;
  }, 60); // 约 16fps，确保缩放时工作台窗口重排不会阻塞主线程
};

const handleOpenTab = (tabConfig: any) => {
  const existingIndex = dynamicTabs.value.findIndex((t) => t.id === tabConfig.id);
  if (existingIndex === -1) {
    dynamicTabs.value.push(tabConfig);
  } else {
    dynamicTabs.value[existingIndex] = { ...dynamicTabs.value[existingIndex], ...tabConfig };
  }
  activeMainTab.value = tabConfig.id;
  if (layoutMode.value === 'freeform') {
    openWorkspaceApp(`tab:${tabConfig.id}`);
  }
};

const handleSwitchMainView = (tabId: string) => {
  activeMainTab.value = tabId;
  if (layoutMode.value === 'freeform') {
    openWorkspaceApp(getWorkspaceAppIdForMainTab(tabId));
  }
};

const pendingDiscordSessionId = ref<string | null>(null);

const openDiscordChatSession = async (sessionId: string) => {
  if (!sessionId) return;

  if (activeMainTab.value === 'lumina-chat') {
    await contextStore.selectViewSession(sessionId);
    return;
  }

  pendingDiscordSessionId.value = sessionId;
  handleSwitchMainView('lumina-chat');
  await nextTick();
};

const closeTab = (tabId: string) => {
  closeWorkspaceTab(tabId);
};

const switchRightPanel = (panelId: string) => {
  if (layoutMode.value === 'freeform') {
    const widgetId = `widget:${panelId}`;
    const pluginId = `plugin:${panelId}`;
    const targetId = workspaceAppMap.value.has(widgetId) ? widgetId : pluginId;
    openWorkspaceApp(targetId);
    return;
  }
  if (isMobile.value) {
    openTemporaryWidgetTab(panelId);
    return;
  }
  activeRightPanel.value = panelId;
  showWidgetDropdown.value = false;
};

const handleOpenWidget = (panelId: string) => {
  if (isMobile.value) {
    openTemporaryWidgetTab(panelId);
  } else {
    switchRightPanel(panelId);
  }
};

const toggleAuxWindow = () => {
  if (layoutMode.value === 'freeform') {
    createStageWithLauncher();
    showWorkspaceMenu.value = false;
    return;
  }
  if (isMobile.value) {
    openTemporaryWidgetTab(lastKnownRightPanel.value || activeRightPanel.value || 'lumina-settings');
    showWorkspaceMenu.value = false;
    return;
  }
  if (activeRightPanel.value === 'none') {
    activeRightPanel.value = lastKnownRightPanel.value || 'lumina-settings';
  } else {
    activeRightPanel.value = 'none';
  }
  showWorkspaceMenu.value = false;
};

const updateDesktopMode = async (desktopModeId: string) => {
  showWorkspaceMenu.value = false;
  closeWorkspaceLaunchpad();
  if (desktopModeId === activeDesktopModeId.value) {
    return;
  }
  await updateSetting('lumina-settings.activeDesktopMode', desktopModeId);
};

const contextStore = useConversationContextStore();

watch(activeMainTab, async (val) => {
  lwStorage.set('luminaWeave.activeMainTab', val, 'Global');
  if (val === 'lumina-timeline') isTimelineLoadedOnce.value = true;
  if (val === 'lumina-chat' && pendingDiscordSessionId.value) {
    const targetSessionId = pendingDiscordSessionId.value;
    pendingDiscordSessionId.value = null;
    await contextStore.selectViewSession(targetSessionId);
    return;
  }
  contextStore.syncFromTab(val);
});

watch(isMobile, (mobile, wasMobile) => {
  if (mobile && !wasMobile && layoutMode.value === 'traditional' && activeRightPanel.value !== 'none') {
    openTemporaryWidgetTab(activeRightPanel.value);
  }
});

watch(activeRightPanel, (val) => {
  if (val !== 'none') {
    lastKnownRightPanel.value = val;
    lwStorage.set('luminaWeave.activeRightPanel', val, 'Global');
  }
});

watch(showNexus, (val) => {
  lwStorage.set('luminaWeave.showNexus', val, 'Global');
});

watch(layoutMode, (val) => {
  if (val === 'freeform') {
    showWorkspaceNavigation.value = shouldShowWorkspaceNavigationOnEntry();
    workspaceNavigationPeek.value = false;
    clearWorkspaceNavigationHideTimer();
    requestAnimationFrame(() => reconcileWorkspaceState(true));
  } else {
    closeWorkspaceLaunchpad();
    showWorkspaceNavigation.value = false;
    workspaceNavigationPeek.value = false;
    clearWorkspaceNavigationHideTimer();
  }
});
watch(isWorkspaceNavigationVisible, () => {
  if (layoutMode.value === 'freeform') {
    requestAnimationFrame(reflowWorkspaceWindows);
  }
});
watch(showWorkspaceMenu, (isOpen) => {
  if (isOpen) {
    closeWorkspaceLaunchpad();
    holdWorkspaceNavigation();
    return;
  }
  scheduleWorkspaceNavigationHide(isMobile.value ? 1600 : 760);
});
watch(() => activeStageWindowEntries.value.length, (count) => {
  if (count === 0) {
    clearWorkspaceNavigationHideTimer();
    workspaceNavigationPeek.value = false;
    return;
  }
  if (!showWorkspaceNavigation.value && !showWorkspaceMenu.value && workspaceNavigationPeek.value) {
    scheduleWorkspaceNavigationHide(isMobile.value ? 1600 : 760);
  }
});

provide('lwApi', lwApi);
provide('lwWorkspaceActions', {
  openWorkspaceApp: (appId: string) => openWorkspaceApp(appId),
  closeWorkspaceApps: (appIds: string[]) => closeWorkspaceApps(appIds)
});

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

const handleThemeChange = (event: MediaQueryListEvent) => {
  systemPrefersDark.value = event.matches;
};

const handleWorkspaceKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !showWorkspaceLaunchpad.value) return;
  event.preventDefault();
  closeWorkspaceLaunchpad();
};

const openSettingsPanel = () => {
  if (layoutMode.value === 'freeform') {
    openWorkspaceSettings();
    return;
  }
  if (isMobile.value) {
    openTemporaryWidgetTab('lumina-settings');
    return;
  }
  activeRightPanel.value = 'lumina-settings';
};

const toggleExpand = async () => {
  isExpanded.value = !isExpanded.value;
  if (!isExpanded.value) {
    showWorkspaceMenu.value = false;
    closeWorkspaceLaunchpad();
    showWorkspaceNavigation.value = false;
    workspaceNavigationPeek.value = false;
    clearWorkspaceNavigationHideTimer();
    return;
  }
  if (isExpanded.value) {
    setTimeout(() => {
      lwApi.emit('SCROLL_TO_BOTTOM', { force: true });
    }, 400);

    setTimeout(() => {
      const state = lwApi.getSyncDiff?.();
      // 遵循 PDR: 仅在检测到不可合并的“分歧 (Divergence)”时才自动弹出
      if (state?.hasDivergence) {
        globalConflictViewer.value?.open();
      }
    }, 100);
  }
};

onMounted(async () => {
  syncViewportMetrics();
  window.visualViewport?.addEventListener('resize', syncViewportMetrics);
  window.visualViewport?.addEventListener('scroll', syncViewportMetrics);
  themeMedia.addEventListener('change', handleThemeChange);
  window.addEventListener('keydown', handleWorkspaceKeydown);

  lwApi.registerPanel('conflict', ConflictDiffViewer, {
    title: '版本分歧比对',
    icon: '⚡',
  });
  lwApi.registerPanel('sync_report', SyncReportViewer, {
    title: '同步对比报告',
    icon: '🧾',
  });
  lwApi.registerPanel('context-switcher', ContextSwitcherPanel, {
    title: '会话切换',
    icon: '🔄',
  });


  lwApi.on('OPEN_TAB', handleOpenTab);
  lwApi.on('SWITCH_MAIN_VIEW', handleSwitchMainView);
  lwApi.on('SWITCH_WIDGET_PANEL', (panelId: string) => {
    if (layoutMode.value === 'freeform') {
      const widgetId = `widget:${panelId}`;
      const pluginId = `plugin:${panelId}`;
      const targetId = workspaceAppMap.value.has(widgetId) ? widgetId : pluginId;
      openWorkspaceApp(targetId);
      return;
    }
    const widgetPlugin = widgetPlugins.value.find((p) => p.id === panelId);
    if (widgetPlugin && !isMobile.value) {
      activeRightPanel.value = panelId;
      return;
    }
    const registered = lwApi.registeredPanels.get(panelId);
    if (registered && !isMobile.value) {
      activeRightPanel.value = panelId;
      return;
    }
    if (registered) {
      const auxKindMatch = panelId.match(/^forge_(lorebook|memory|export|post_tracks|test_chat)$/);
      const extraProps = auxKindMatch ? { kind: auxKindMatch[1] } : {};
      lwApi.openTab({
        id: `mobile-widget:${panelId}`,
        name: registered.config.title,
        icon: registered.config.icon || '',
        component: registered.component,
        props: { mode: 'small', isMobile: true, isTemporaryWidgetTab: true, ...extraProps }
      });
      return;
    }
    if (isMobile.value) {
      openTemporaryWidgetTab(panelId);
    }
  });

  lwApi.on('TOGGLE_WIDGET_PANEL', (panelId: string) => {
    if (layoutMode.value === 'freeform') {
      const widgetId = `widget:${panelId}`;
      const pluginId = `plugin:${panelId}`;
      const targetId = workspaceAppMap.value.has(widgetId) ? widgetId : pluginId;
      openWorkspaceApp(targetId);
      return;
    }
    if (isMobile.value) {
      openTemporaryWidgetTab(panelId);
      return;
    }
    if (activeRightPanel.value === panelId) {
      activeRightPanel.value = 'none';
    } else {
      activeRightPanel.value = panelId;
    }
  });

  lwApi.on('INIT_PROGRESS', (text: string) => {
    initStatusText.value = text;
  });

  initSettings();

  lwApi.on('SETTINGS_CHANGED', () => {
    settingsRevision.value++;
  });

  lwApi.on('SWITCH_AUX_SIDEBAR_MODE', (mode: 'left' | 'right' | 'widget') => {
    setSidebarMode(mode);
  });

  // 核心优化：直接调用 lwApi.init()，内部已整合环境探测 (ST, Helper, EventSource)
  await lwApi.init();
  isApiReady.value = true;
  console.log('[LuminaWeave] Global API initialization complete. UI Render unblocked.');
  if (layoutMode.value === 'freeform') {
    showWorkspaceNavigation.value = shouldShowWorkspaceNavigationOnEntry();
    workspaceNavigationPeek.value = false;
    requestAnimationFrame(() => reconcileWorkspaceState(true));
  }

  lwApi.on('OPEN_PANEL_CONFLICT', () => {
    globalConflictViewer.value?.open();
  });
  lwApi.on('OPEN_PANEL_SYNC_REPORT', () => {
    globalSyncReportViewer.value?.open();
  });

  window.addEventListener('resize', handleResizeWindow);
});

onUnmounted(() => {
  clearWorkspaceNavigationHideTimer();
  window.visualViewport?.removeEventListener('resize', syncViewportMetrics);
  window.visualViewport?.removeEventListener('scroll', syncViewportMetrics);
  themeMedia.removeEventListener('change', handleThemeChange);
  window.removeEventListener('keydown', handleWorkspaceKeydown);
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
  --lw-surface: var(--lw-bg-elevated);
  --lw-border: var(--lw-border-base);
  --lw-bg-color: var(--lw-bg-app);
}

.luminaweave-app-root[data-theme='light'] {
  --lw-bg-app: oklch(0.955 0.008 240);
  --lw-bg-app-rgb: 242, 244, 247;
  --lw-bg-surface: oklch(0.982 0.004 240);
  --lw-bg-surface-rgb: 249, 250, 252;
  --lw-bg-elevated: oklch(0.995 0.002 250);
  --lw-bg-elevated-rgb: 252, 252, 251;
  --lw-bg-subtle: oklch(0.957 0.006 240);
  --lw-bg-muted: oklch(0.932 0.009 240);
  --lw-bg-hover: oklch(0.94 0.012 240);
  --lw-bg-active: oklch(0.91 0.016 240);
  --lw-bg-selection: color-mix(in srgb, var(--lw-primary) 14%, white);
  --lw-primary-soft: color-mix(in srgb, var(--lw-primary) 10%, transparent);
  --lw-primary-softer: color-mix(in srgb, var(--lw-primary) 18%, transparent);
  --lw-text-main: oklch(0.24 0.015 248);
  --lw-text-secondary: oklch(0.42 0.013 248);
  --lw-text-muted: oklch(0.56 0.012 248);
  --lw-text-dim: oklch(0.62 0.01 248);
  --lw-text-inverse: oklch(0.985 0.003 248);
  --lw-border-base: rgba(26, 32, 44, 0.1);
  --lw-border-subtle: rgba(26, 32, 44, 0.06);
  --lw-border-strong: rgba(26, 32, 44, 0.16);
  --lw-border-active: rgba(var(--lw-primary-rgb), 0.3);
  --lw-border-hover: rgba(26, 32, 44, 0.18);
  --lw-shadow: 0 1px 2px rgba(17, 18, 21, 0.03);
  --lw-shadow-card: 0 16px 34px rgba(17, 18, 21, 0.06);
  --lw-shadow-hover: 0 22px 46px rgba(17, 18, 21, 0.1);
  --lw-shadow-xl: 0 32px 72px rgba(17, 18, 21, 0.14);
  color-scheme: light;

  /* Glassmorphism Tokens */
  --lw-glass-bg: rgba(255, 255, 255, 0.48);
  --lw-glass-bg-hover: rgba(255, 255, 255, 0.62);
  --lw-glass-border: rgba(255, 255, 255, 0.42);
  --lw-glass-shadow: rgba(15, 23, 42, 0.08);
}

.luminaweave-app-root[data-theme='dark'] {
  --lw-bg-app: oklch(0.18 0.012 248);
  --lw-bg-app-rgb: 28, 31, 37;
  --lw-bg-surface: oklch(0.22 0.012 248);
  --lw-bg-surface-rgb: 36, 39, 45;
  --lw-bg-elevated: oklch(0.26 0.011 248);
  --lw-bg-elevated-rgb: 45, 48, 55;
  --lw-bg-subtle: oklch(0.28 0.012 248);
  --lw-bg-muted: oklch(0.32 0.012 248);
  --lw-bg-hover: oklch(0.3 0.013 248);
  --lw-bg-active: oklch(0.36 0.014 248);
  --lw-bg-selection: rgba(71, 138, 255, 0.18);
  --lw-primary-soft: rgba(71, 138, 255, 0.14);
  --lw-primary-softer: rgba(71, 138, 255, 0.22);
  --lw-text-main: oklch(0.95 0.008 248);
  --lw-text-secondary: oklch(0.82 0.01 248);
  --lw-text-muted: oklch(0.72 0.01 248);
  --lw-text-dim: oklch(0.66 0.01 248);
  --lw-text-inverse: oklch(0.98 0.004 248);
  --lw-border-base: rgba(226, 232, 240, 0.12);
  --lw-border-subtle: rgba(226, 232, 240, 0.08);
  --lw-border-strong: rgba(226, 232, 240, 0.18);
  --lw-border-active: rgba(71, 138, 255, 0.38);
  --lw-border-hover: rgba(226, 232, 240, 0.2);
  --lw-shadow: 0 1px 2px rgba(0, 0, 0, 0.24);
  --lw-shadow-card: 0 20px 40px rgba(0, 0, 0, 0.24);
  --lw-shadow-hover: 0 28px 54px rgba(0, 0, 0, 0.28);
  --lw-shadow-xl: 0 36px 78px rgba(0, 0, 0, 0.34);
  color-scheme: dark;

  /* Glassmorphism Tokens (Dark Mode) */
  --lw-glass-bg: rgba(30, 41, 59, 0.52);
  --lw-glass-bg-hover: rgba(45, 55, 75, 0.64);
  --lw-glass-border: rgba(255, 255, 255, 0.08);
  --lw-glass-shadow: rgba(0, 0, 0, 0.24);
}

/* ======= 外部样式隔离与全局重置 (CSS Isolation) ======= */
.luminaweave-app-root {
  /* 阻断大部分可继承的 ST 全局样式 */
  color: var(--lw-text-main);
  font-family: var(--lw-font-main);
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
  width: var(--lw-app-width, 100vw);
  height: var(--lw-app-height, 100vh);
  z-index: 9999;
  pointer-events: none;
  isolation: isolate;
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
  top: var(--lw-viewport-offset-top, 0px);
  left: var(--lw-viewport-offset-left, 0px);
  display: flex;
  flex-direction: column;
  z-index: 10000;
  overflow: hidden;
  width: var(--lw-app-width, 100vw);
  height: var(--lw-app-height, 100vh);
  background: var(--lw-shell-panel-bg,
    radial-gradient(circle at 18% 10%, rgba(var(--lw-primary-rgb), 0.12), transparent 24%),
    radial-gradient(circle at 80% 14%, rgba(255, 255, 255, 0.72), transparent 20%),
    linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 98%, white), color-mix(in srgb, var(--lw-bg-app) 96%, white)));
}

.lw-fullscreen-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--lw-shell-panel-overlay,
    linear-gradient(180deg, rgba(255, 255, 255, 0.42), transparent 24%),
    radial-gradient(rgba(38, 52, 76, 0.055) 0.8px, transparent 0.8px));
  background-size: auto, 18px 18px;
  opacity: 0.34;
  pointer-events: none;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.14));
}

.lw-workspace-menu {
  position: absolute;
  top: 68px;
  right: 16px;
  z-index: 20;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 22px;
  border: 1px solid var(--lw-shell-workspace-menu-border, rgba(255, 255, 255, 0.42));
  background: var(--lw-shell-workspace-menu-bg,
    linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(244, 248, 254, 0.34)));
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(24px) saturate(135%);
}

.lw-workspace-menu.is-freeform {
  top: 22px;
  right: 20px;
}

.lw-workspace-menu-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 4px 8px;
}

.lw-workspace-menu-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.lw-workspace-menu-copy strong {
  font-family: var(--lw-font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.lw-workspace-menu-copy span:last-child {
  font-size: 12px;
  color: var(--lw-text-secondary);
  line-height: 1.6;
}

.lw-workspace-menu-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  background: var(--lw-shell-workspace-menu-item-bg, rgba(255, 255, 255, 0.24));
  color: var(--lw-text-main);
  text-align: left;
  cursor: pointer;
  transition: var(--lw-transition);
}

.lw-workspace-menu-item:hover,
.lw-workspace-menu-item.active {
  border-color: rgba(var(--lw-primary-rgb), 0.2);
  background: var(--lw-shell-workspace-menu-item-active-bg, rgba(255, 255, 255, 0.4));
}

.lw-workspace-menu-item span {
  font-size: 13px;
  font-weight: 700;
}

.lw-workspace-menu-item small {
  font-size: 11px;
  color: var(--lw-text-secondary);
  line-height: 1.5;
}

/* 主体分为左右结构 */
.lw-panel-body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex !important;
  flex-direction: row !important;
  direction: ltr !important;
  overflow: hidden;
  min-height: 0;
  padding: 0;
  gap: 0;
}

.lw-panel-body:not(.is-freeform) {
  background: var(--lw-shell-body-bg,
    linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.16) 0%, rgba(var(--lw-primary-rgb), 0.08) 18%, transparent 44%),
    linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-surface) 98%, white), color-mix(in srgb, var(--lw-bg-subtle) 96%, white)));
}

.luminaweave-app-root[data-desktop-mode='discord'][data-layout-mode='traditional'] .lw-panel-body:not(.is-freeform) {
  background: linear-gradient(180deg, #313338 0%, #2b2d31 100%);
}

.lw-panel-body.is-freeform {
  padding: var(--lw-shell-freeform-gap, 14px);
  gap: var(--lw-shell-freeform-gap, 14px);
}

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

.workspace-launchpad-motion-enter-active,
.workspace-launchpad-motion-leave-active {
  transition:
    opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 280ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 260ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: 50% 100%;
}

.workspace-launchpad-motion-enter-from,
.workspace-launchpad-motion-leave-to {
  opacity: 0;
  filter: blur(16px);
  transform: translateY(24px) scale(0.97);
}

.workspace-nav-motion-enter-active,
.workspace-nav-motion-leave-active {
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.workspace-nav-motion-enter-from,
.workspace-nav-motion-appear-from {
  opacity: 0;
}

.workspace-nav-motion-leave-to {
  opacity: 0;
}

.lw-stage-strip.workspace-nav-motion-enter-from,
.lw-stage-strip.workspace-nav-motion-appear-from {
  transform: translateX(-10px);
}

.lw-stage-strip.workspace-nav-motion-leave-to {
  transform: translateX(-12px);
}

.lw-workspace-dock.workspace-nav-motion-enter-from,
.lw-workspace-dock.workspace-nav-motion-appear-from {
  transform: translateX(-50%) translateY(10px);
}

.lw-workspace-dock.workspace-nav-motion-leave-to {
  transform: translateX(-50%) translateY(12px);
}

.workspace-window-motion-enter-active,
.workspace-window-motion-leave-active {
  transition:
    opacity 340ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 380ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: 50% 60%;
}

.workspace-window-motion-move {
  transition:
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.workspace-window-motion-enter-from,
.workspace-window-motion-appear-from {
  opacity: 0;
  filter: blur(14px);
  transform: translateY(34px) scale(0.936);
}

.workspace-window-motion-leave-to {
  opacity: 0;
  filter: blur(20px);
  transform: translateY(36px) scale(0.928);
}

.workspace-window-motion-leave-active {
  transition:
    opacity 440ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 560ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 500ms cubic-bezier(0.22, 1, 0.36, 1);
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
  gap: 8px;
  padding: 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 86%, white);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(248, 250, 254, 0.78));
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(16px);
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
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

.lw-freeform-hint {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 2;
  width: min(340px, calc(100% - 120px));
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  border: 1px solid var(--lw-border-base);
  box-shadow: var(--lw-shadow-card);
  backdrop-filter: blur(12px);
}

.lw-freeform-empty-aux,
.lw-widget-restore {
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  border: 1px solid var(--lw-border-base);
  box-shadow: var(--lw-shadow);
}

.lw-freeform-hint-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.lw-freeform-hint strong {
  font-family: var(--lw-font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--lw-text-main);
  letter-spacing: -0.02em;
}

.lw-freeform-hint-list {
  display: grid;
  gap: 8px;
  margin-top: 2px;
}

.lw-freeform-hint-list span {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-radius: 14px;
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-subtle);
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-secondary);
}

.lw-freeform-hint-list em {
  min-width: 28px;
  height: 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-style: normal;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--lw-text-muted);
  background: var(--lw-bg-subtle);
}

.lw-freeform-empty-aux {
  position: absolute;
  right: 24px;
  bottom: 24px;
  z-index: 1;
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 18px;
}

.lw-freeform-empty-kicker,
.lw-widget-restore-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.lw-freeform-empty-aux strong,
.lw-widget-restore strong {
  font-size: 13px;
  color: var(--lw-text-main);
}

.lw-freeform-empty-aux span:last-child {
  font-size: 12px;
  color: var(--lw-text-secondary);
  line-height: 1.6;
}

.lw-widget-restore {
  align-self: stretch;
  width: 92px;
  border-radius: 18px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: var(--lw-transition);
  color: inherit;
}

.lw-widget-restore:hover {
  border-color: var(--lw-border-active);
  background: var(--lw-bg-selection);
}

@media (max-width: 768px) {
  .lw-panel-body {
    flex-direction: column !important;
    height: calc(var(--lw-app-height, 100vh) - 60px);
    min-height: calc(var(--lw-app-height, 100vh) - 60px);
    /* 减去 header 高度 */
  }

  .lw-workspace-menu {
    left: 12px;
    right: 12px;
    width: auto;
  }

  .lw-workspace-menu.is-freeform {
    top: 72px;
    right: 12px;
  }

  .lw-freeform-controls {
    top: 12px;
    right: 12px;
    padding: 7px;
    gap: 6px;
  }

  .lw-freeform-empty-stage {
    width: min(320px, calc(100% - 32px));
    left: 16px;
    right: 16px;
    top: auto;
    bottom: 88px;
    transform: none;
  }

  .lw-freeform-hint {
    left: 18px;
    right: 18px;
    top: 68px;
    width: auto;
  }

  .lw-freeform-empty-aux {
    left: 18px;
    right: 18px;
    width: auto;
    bottom: 18px;
  }

  .lw-workspace-launchpad-overlay {
    inset: 0;
    padding: 16px 12px 86px;
    align-items: stretch;
  }

  .lw-workspace-launchpad-overlay::before {
    -webkit-mask-image: linear-gradient(to bottom, black 0%, black 80%, transparent 100%);
    mask-image: linear-gradient(to bottom, black 0%, black 80%, transparent 100%);
  }

  .lw-workspace-launchpad-shell {
    max-width: 100%;
  }

  .lw-workspace-launchpad-close {
    top: 14px;
    right: 14px;
  }

  .lw-workspace-dock.workspace-nav-motion-enter-from,
  .lw-workspace-dock.workspace-nav-motion-appear-from,
  .lw-workspace-dock.workspace-nav-motion-leave-to {
    transform: translateY(10px);
  }
}

/* ======= Motion Performance Controls ======= */
.luminaweave-app-root[data-motion='none'] * {
  transition-duration: 0s !important;
  animation-duration: 0s !important;
}

.luminaweave-app-root[data-motion='light'] {
  --lw-glass-blur: 0px;
  --lw-glass-saturate: 100%;
}
.luminaweave-app-root[data-motion='full'] {
  --lw-glass-blur: 20px;
  --lw-glass-saturate: 125%;
}

.lw-main-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  border: 1px solid var(--lw-shell-main-border, color-mix(in srgb, var(--lw-border-base) 88%, white));
  border-radius: var(--lw-shell-main-radius, 24px);
  background: var(--lw-shell-main-bg,
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--lw-bg-elevated) 96%, white)));
  box-shadow: var(--lw-shell-main-shadow, 0 20px 44px rgba(15, 23, 42, 0.08));
  backdrop-filter: blur(10px);
}

.lw-main-wrapper[data-surface-variant='discord'] {
  backdrop-filter: none;
}

.lw-panel-body:not(.is-freeform) .lw-main-wrapper {
  border-radius: 0;
  box-shadow: none;
  border-top: none;
  border-bottom: none;
}

.luminaweave-app-root[data-desktop-mode='discord'][data-layout-mode='traditional'] .lw-panel-body:not(.is-freeform) .lw-main-wrapper[data-surface-variant='discord'] {
  border-left: none;
  background: #313338;
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
  background: transparent;
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

@media (max-width: 768px) {
  .lw-widget-container {
    height: 50%;
    /* 移动端显示时占一半高度，防止压缩主视图 */
    border-left: none;
    border-top: 1px solid var(--lw-border-base);
  }
}

.widget-container-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--lw-border-base);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--lw-shell-widget-header-bg, transparent);
}

.lw-fullscreen-panel[data-shell-variant='discord']::before {
  opacity: 0.18;
}

.lw-freeform-stage[data-skin-variant='discord']::before {
  opacity: 0.12;
}

.lw-freeform-stage[data-skin-variant='discord']::after {
  opacity: 0.22;
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
  display: flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 100px;
  font-size: 10px;
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
  background: rgba(34, 197, 94, 0.12);
  color: #1e8a52;
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
  border-radius: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--lw-text-secondary);
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.icon-action-btn:hover {
  background: var(--lw-bg-hover);
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
  color: var(--lw-text-muted);
  font-size: 14px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent);
  border-radius: 24px;
}

.lw-global-loading .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--lw-border-base);
  border-top-color: var(--lw-primary, #0061e0);
  border-radius: 50%;
  animation: lw-spin 1s linear infinite;
}

@keyframes lw-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
