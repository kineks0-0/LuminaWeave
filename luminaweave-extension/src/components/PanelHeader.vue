<template>
  <div
    class="lw-panel-header"
    :class="{ 'is-bottom': headerPlacement === 'bottom' }"
    :data-skin-variant="variant"
  >
    <div class="header-left">
      <template v-if="variant !== 'discord'">
      <div class="lw-brand" v-if="!isMobile">
        <span class="lw-title-main">LuminaWeave</span>
      </div>

      <div class="header-launcher">
        <button
          class="launcher-btn"
          :class="{ active: activeMainTab === 'lumina-launcher' }"
          @click="$emit('switchMainView', 'lumina-launcher')"
          title="启动台"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        </button>
      </div>

      <div class="lw-tabs" ref="tabsContainerRef">
        <template v-for="(plugin, index) in tabOrder" :key="plugin.type === 'plugin' ? plugin.id : 'dyn-' + plugin.id">
          <template v-if="plugin.type === 'plugin'">
            <button
              v-if="plugin.id !== 'lumina-launcher'"
              class="lw-tab"
              :class="{ active: activeMainTab === plugin.id }"
              @click="$emit('switchMainView', plugin.id)"
            >
              <span v-html="plugin.icon" class="tab-icon-wrapper"></span>
              {{ plugin.name }}
            </button>
          </template>
          <template v-else>
            <button
              class="lw-tab dynamic"
              :class="{ active: activeMainTab === plugin.id }"
              @click="$emit('switchMainView', plugin.id)"
            >
              <span v-html="plugin.icon" class="tab-icon-wrapper"></span>
              {{ plugin.name }}
              <div class="tab-close" @click.stop="$emit('closeTab', plugin.id)">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </div>
            </button>
          </template>
        </template>

      </div>
      </template>

      <div v-else class="discord-channel-bar">
        <button
          class="discord-channel-mark"
          :class="{ active: guildRailVisible !== false }"
          type="button"
          title="切换 Guild Rail"
          @click="$emit('toggleGuildRail')"
        >
          #
        </button>
        <div class="discord-channel-copy">
          <strong>{{ activeTabEntry?.name || '频道' }}</strong>
          <span>当前桌面模式中的主工作区视图</span>
        </div>
      </div>
    </div>

    <div class="header-center">
      <component v-for="plugin in headerCenterPlugins" :key="plugin.id" :is="plugin.headerCenterComponent" />
    </div>

    <div class="header-right">
      <component v-for="plugin in headerRightPlugins" :key="plugin.id" :is="plugin.headerRightComponent" />

      <div class="header-floating-controls">
        <div v-if="isMobile" class="header-floating-control-wrapper" :class="{ 'is-bottom': headerPlacement === 'bottom' }" ref="widgetBtnWrapperRef">
          <button class="header-floating-control" :class="{ active: showWidgetMenu }" @click="showWidgetMenu = !showWidgetMenu" title="小窗面板">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
          <div class="widget-dropdown" v-if="showWidgetMenu" ref="widgetMenuRef">
            <template v-if="widgetGroups.length > 0 && widgetMenuGroup === null">
              <div class="widget-dropdown-label widget-dropdown-title">小窗面板</div>
              <button
                v-for="(group, gi) in widgetGroups"
                :key="gi"
                class="widget-dropdown-item widget-dropdown-group-btn"
                @click="widgetMenuGroup = gi"
              >
                <span v-html="group.items[0]?.icon" class="tab-icon-wrapper"></span>
                <span class="widget-group-label">{{ group.label || '其他' }}</span>
                <svg class="widget-group-chevron" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                  <polyline points="9 6 15 12 9 18"></polyline>
                </svg>
              </button>
            </template>
            <template v-else-if="widgetGroups.length > 0 && widgetMenuGroup !== null">
              <button class="widget-dropdown-back" @click="widgetMenuGroup = null">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                {{ widgetGroups[widgetMenuGroup]?.label || '返回' }}
              </button>
              <button
                v-for="wp in widgetGroups[widgetMenuGroup]?.items"
                :key="wp.id"
                class="widget-dropdown-item"
                :class="{ active: activeWidgetId === wp.id }"
                @click="pickWidget(wp.id)"
              >
                <span v-html="wp.icon" class="tab-icon-wrapper"></span>
                {{ wp.name }}
              </button>
            </template>
            <template v-else>
              <button
                v-for="wp in widgetPanels"
                :key="wp.id"
                class="widget-dropdown-item"
                :class="{ active: activeWidgetId === wp.id }"
                @click="pickWidget(wp.id)"
              >
                <span v-html="wp.icon" class="tab-icon-wrapper"></span>
                {{ wp.name }}
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="profile-menu-wrap" :class="{ 'is-bottom': headerPlacement === 'bottom' }" ref="profileMenuWrapperRef">
        <button class="profile-trigger" :class="{ active: showProfileMenu }" @click="toggleProfileMenu" :title="`${activeUserName} 菜单`">
          <span class="profile-trigger-avatar">
            <img
              v-if="activeUserAvatar"
              :src="activeUserAvatar || defaultAvatar"
              class="avatar-sm"
              :alt="activeUserName"
              @error="(e) => (e.target as HTMLImageElement).src = defaultAvatar"
            >
            <span v-else class="avatar-sm placeholder"></span>
          </span>
          <span v-if="!isMobile" class="profile-trigger-copy">
            <strong>{{ activeUserName }}</strong>
            <small>工作区菜单</small>
          </span>
          <svg v-if="!isMobile" class="profile-trigger-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <div v-if="showProfileMenu" class="profile-menu" ref="profileMenuRef">
          <template v-if="profileMenuView === 'root'">
            <div class="profile-menu-copy">
              <span class="profile-menu-kicker">Desktop Menu</span>
              <strong>{{ activeUserName }}</strong>
              <span>把关闭、桌面模式和设置收进头像菜单里，保持主导航更专注。</span>
            </div>

            <button
              v-if="showLayoutEntry"
              class="profile-menu-item"
              type="button"
              @click="openLayoutMenu"
            >
              <span class="profile-menu-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                  <rect x="3" y="4" width="6" height="16" rx="2"></rect>
                  <rect x="12" y="6" width="9" height="5" rx="2"></rect>
                  <rect x="12" y="14" width="9" height="6" rx="2"></rect>
                </svg>
              </span>
              <span class="profile-menu-label">桌面模式</span>
              <span class="profile-menu-value">{{ layoutModeValue }}</span>
              <svg class="profile-menu-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="9 6 15 12 9 18"></polyline>
              </svg>
            </button>

            <button class="profile-menu-item" type="button" @click="openSettings">
              <span class="profile-menu-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </span>
              <span class="profile-menu-label">设置</span>
              <span class="profile-menu-value">打开设置面板</span>
            </button>

            <button class="profile-menu-item danger" type="button" @click="closeWorkspace">
              <span class="profile-menu-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </span>
              <span class="profile-menu-label">关闭</span>
              <span class="profile-menu-value">返回经典模式</span>
            </button>
          </template>

          <template v-else>
            <button class="profile-menu-back" type="button" @click="profileMenuView = 'root'">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              返回
            </button>

            <div class="profile-menu-copy">
              <span class="profile-menu-kicker">Desktop Mode</span>
              <strong>切换桌面模式</strong>
              <span>直接切换整套桌面模式。每个模式会自行决定采用传统桌面还是自由工作台壳层。</span>
            </div>

            <button
              v-for="desktopMode in desktopModes"
              :key="desktopMode.value"
              class="profile-menu-choice"
              :class="{ active: activeDesktopModeId === desktopMode.value }"
              type="button"
              @click="pickDesktopMode(desktopMode.value)"
            >
              <span class="profile-menu-choice-title">{{ desktopMode.label }}</span>
              <span class="profile-menu-choice-copy">{{ desktopMode.description || '切换到该桌面模式。' }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { pluginManager } from '@/core/PluginManager';

const props = withDefaults(defineProps<{
  activeMainTab?: string;
  dynamicTabs?: any[];
  isMobile?: boolean;
  activeDesktopModeId?: string;
  desktopModes?: { value: string; label: string; description?: string }[];
  variant?: 'default' | 'discord';
  headerPlacement?: 'top' | 'bottom';
  widgetPanels?: { id: string; name: string; icon: string }[];
  widgetGroups?: { label?: string; items: { id: string; name: string; icon: string }[] }[];
  activeWidgetId?: string;
  guildRailVisible?: boolean;
}>(), {
  activeMainTab: 'lumina-chat',
  dynamicTabs: () => [],
  isMobile: false,
  activeDesktopModeId: 'classic',
  desktopModes: () => [],
  variant: 'default',
  headerPlacement: 'top',
  widgetPanels: () => [],
  widgetGroups: () => [],
  activeWidgetId: '',
  guildRailVisible: true
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggleSettings'): void;
  (e: 'toggleGuildRail'): void;
  (e: 'setDesktopMode', modeId: string): void;
  (e: 'switchMainView', tabId: string): void;
  (e: 'closeTab', tabId: string): void;
  (e: 'openWidget', panelId: string): void;
}>();

const mainPlugins = computed(() => pluginManager.getPluginsInSlot('mainView'));
const headerCenterPlugins = computed(() => pluginManager.getPluginsInSlot('headerCenter'));
const headerRightPlugins = computed(() => pluginManager.getPluginsInSlot('headerRight'));

const activeUserName = computed(() => (window as any).LuminaWeave?.getUserName() || 'User');
const activeUserAvatar = computed(() => (window as any).LuminaWeave?.getUserAvatar());
const defaultAvatar = computed(() => (window as any).LuminaWeave?.DEFAULT_AVATAR);
const activeDesktopModeOption = computed(
  () => props.desktopModes.find((mode) => mode.value === props.activeDesktopModeId) || props.desktopModes[0] || null
);
const layoutModeValue = computed(() => activeDesktopModeOption.value?.label || '桌面模式');
const showLayoutEntry = computed(() => props.desktopModes.length > 0);

type TabEntry = { type: 'plugin' | 'dynamic'; id: string; name: string; icon: string };

const tabOrder = computed<TabEntry[]>(() => {
  const plugins: TabEntry[] = mainPlugins.value
    .filter(p => p.id !== 'lumina-launcher')
    .map(p => ({ type: 'plugin' as const, id: p.id, name: p.name, icon: p.icon }));
  const dynamics: TabEntry[] = (props.dynamicTabs || []).map(t => ({
    type: 'dynamic' as const,
    id: t.id,
    name: t.name,
    icon: t.icon || ''
  }));
  return [...plugins, ...dynamics];
});

const activeTabEntry = computed<TabEntry | null>(() => {
  if (props.activeMainTab === 'lumina-launcher') {
    return {
      type: 'plugin',
      id: 'lumina-launcher',
      name: '启动台',
      icon: ''
    };
  }
  return tabOrder.value.find((entry) => entry.id === props.activeMainTab) || null;
});

const widgetMenuRef = ref<HTMLElement | null>(null);
const widgetBtnWrapperRef = ref<HTMLElement | null>(null);
const profileMenuWrapperRef = ref<HTMLElement | null>(null);
const showWidgetMenu = ref(false);
const widgetMenuGroup = ref<number | null>(null);
const showProfileMenu = ref(false);
const profileMenuView = ref<'root' | 'layout'>('root');

function pickWidget(panelId: string) {
  showWidgetMenu.value = false;
  widgetMenuGroup.value = null;
  emit('openWidget', panelId);
}

function toggleProfileMenu() {
  showProfileMenu.value = !showProfileMenu.value;
  if (!showProfileMenu.value) {
    profileMenuView.value = 'root';
  }
}

function openLayoutMenu() {
  profileMenuView.value = 'layout';
}

function openSettings() {
  showProfileMenu.value = false;
  profileMenuView.value = 'root';
  emit('toggleSettings');
}

function pickDesktopMode(modeId: string) {
  showProfileMenu.value = false;
  profileMenuView.value = 'root';
  emit('setDesktopMode', modeId);
}

function closeWorkspace() {
  showProfileMenu.value = false;
  profileMenuView.value = 'root';
  emit('close');
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown);
});

function onDocPointerDown(e: PointerEvent) {
  if (!showWidgetMenu.value && !showProfileMenu.value) return;
  const path = e.composedPath();
  if (widgetBtnWrapperRef.value && path.includes(widgetBtnWrapperRef.value)) return;
  if (profileMenuWrapperRef.value && path.includes(profileMenuWrapperRef.value)) return;
  if (showWidgetMenu.value) {
    showWidgetMenu.value = false;
    widgetMenuGroup.value = null;
  }
  //showProfileMenu.value = false;
  profileMenuView.value = 'root';
}

</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@100..900&family=ZCOOL+QingKe+HuangYou&display=swap');

:deep(.tab-icon-wrapper) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.lw-panel-header {
  height: 60px;
  min-height: 60px;
  padding: 0 var(--lw-panel-padding, 24px);
  border-bottom: 1px solid var(--lw-border-base, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--lw-bg-elevated, #ffffff);
  z-index: 10;
  color: var(--lw-text-main);
}

.lw-panel-header.is-bottom {
  border-top: 1px solid #e2e8f0;
  border-bottom: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.header-launcher {
  display: flex;
  align-items: center;
  margin-right: 4px;
  flex-shrink: 0;
}

.launcher-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #64748b;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.launcher-btn:hover {
  background: #ffffff;
  color: var(--lw-primary);
  border-color: var(--lw-primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12);
}

.launcher-btn.active {
  background: var(--lw-primary);
  color: #ffffff;
  border-color: var(--lw-primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.lw-brand {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.lw-title-main {
  font-family: 'Abhaya Libre', var(--lw-font-display);
  font-weight: 800;
  font-size: 18px;
  color: #111827;
  line-height: 1;
  letter-spacing: -0.01em;
}

.discord-channel-bar {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.discord-channel-mark {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #2b2d31;
  color: #8e9297;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.discord-channel-mark:hover,
.discord-channel-mark.active {
  background: #383a40;
  color: #f2f3f5;
  border-color: rgba(88, 101, 242, 0.3);
}

.discord-channel-mark:active {
  transform: translateY(1px);
}

.discord-channel-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.discord-channel-copy strong {
  font-size: 15px;
  font-weight: 800;
  color: var(--lw-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discord-channel-copy span {
  font-size: 11px;
  color: var(--lw-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-center {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.lw-tabs {
  display: flex;
  gap: 4px;
  background: #f8fafc;
  padding: 4px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  position: relative;
}

.lw-tabs::-webkit-scrollbar {
  display: none;
}

.lw-tab {
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  padding: 6px 12px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.lw-tab--hidden {
  display: none;
}

.lw-tab:hover {
  color: var(--lw-primary);
  background: #e2e8f0;
}

.lw-tab.active {
  background: #ffffff;
  color: var(--lw-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.lw-tab.dynamic {
  padding-right: 8px;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  margin-left: 4px;
  opacity: 0.5;
  transition: 0.2s;
}

.tab-close:hover {
  background: #fee2e2;
  color: #ef4444;
  opacity: 1;
}

.lw-tab.active .tab-close {
  opacity: 0.8;
}

.lw-tab-more {
  position: relative;
  flex-shrink: 0;
}

.lw-tab--more {
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.lw-tab-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 160px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  padding: 4px;
  z-index: 200;
}

.lw-tab-dropdown-item {
  width: 100%;
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: 0.15s;
  text-align: left;
}

.lw-tab-dropdown-item:hover {
  background: #f1f5f9;
  color: var(--lw-primary);
}

.lw-tab-dropdown-item.active {
  background: color-mix(in srgb, var(--lw-primary) 10%, white);
  color: var(--lw-primary);
}

.widget-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  bottom: auto;
  right: 0;
  min-width: 180px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  padding: 4px;
  z-index: 200;
}

.widget-dropdown-item {
  width: 100%;
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: 0.15s;
  text-align: left;
}

.widget-dropdown-item:hover {
  background: #f1f5f9;
  color: var(--lw-primary);
}

.widget-dropdown-item.active {
  background: color-mix(in srgb, var(--lw-primary) 10%, white);
  color: var(--lw-primary);
}

.widget-dropdown-divider {
  height: 1px;
  margin: 4px 8px;
  background: #e2e8f0;
}

.widget-dropdown-label {
  padding: 6px 10px 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #94a3b8;
}

.widget-dropdown-title {
  padding-top: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 4px;
}

.widget-dropdown-group-btn {
  justify-content: flex-start;
}

.widget-group-label {
  flex: 1;
  text-align: left;
}

.widget-group-chevron {
  color: #94a3b8;
  flex-shrink: 0;
}

.widget-dropdown-back {
  border: none;
  background: transparent;
  color: var(--lw-text-secondary, #64748b);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 6px 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
  width: 100%;
  margin-bottom: 4px;
}

.widget-dropdown-back:hover {
  color: var(--lw-text-main, #1e293b);
}

.header-floating-control-wrapper.is-bottom .widget-dropdown {
  top: auto;
  bottom: calc(100% + 8px);
}

.header-floating-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 86%, white);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(248, 250, 254, 0.78));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.header-floating-control-wrapper {
  position: relative;
  display: inline-flex;
}

.header-floating-control {
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
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background 180ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.header-floating-controls:hover {
  transform: translateY(-1px);
}

.header-floating-control:hover,
.header-floating-control.active {
  background: color-mix(in srgb, var(--lw-primary) 10%, white);
  border-color: rgba(var(--lw-primary-rgb), 0.18);
  color: var(--lw-text-main);
}

.profile-menu-wrap {
  position: relative;
  display: inline-flex;
}

.profile-trigger {
  min-height: 40px;
  padding: 4px 6px 4px 4px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 86%, white);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 254, 0.84));
  color: var(--lw-text-main);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.profile-trigger:hover,
.profile-trigger.active {
  transform: translateY(-1px);
  border-color: rgba(var(--lw-primary-rgb), 0.22);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.11);
}

.profile-trigger-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.profile-trigger-copy {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}

.profile-trigger-copy strong {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--lw-text-main);
}

.profile-trigger-copy small {
  font-size: 10px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--lw-text-muted);
}

.profile-trigger-chevron {
  color: var(--lw-text-muted);
}

.profile-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 220;
  width: min(320px, calc(100vw - 28px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(244, 248, 254, 0.4));
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(24px) saturate(135%);
}

.profile-menu-wrap.is-bottom .profile-menu {
  top: auto;
  bottom: calc(100% + 10px);
}

.profile-menu-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 4px 8px;
}

.profile-menu-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.profile-menu-copy strong {
  font-family: 'Abhaya Libre', var(--lw-font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.profile-menu-copy span:last-child {
  font-size: 12px;
  color: var(--lw-text-secondary);
  line-height: 1.6;
}

.profile-menu-item {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  column-gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  background: rgba(255, 255, 255, 0.24);
  color: var(--lw-text-main);
  text-align: left;
  cursor: pointer;
  transition: 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.profile-menu-item:hover {
  background: rgba(255, 255, 255, 0.5);
  border-color: rgba(var(--lw-primary-rgb), 0.18);
  transform: translateY(-1px);
}

.profile-menu-item.danger:hover {
  border-color: rgba(239, 68, 68, 0.2);
}

.profile-menu-icon {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.48);
  color: var(--lw-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.profile-menu-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.profile-menu-value {
  font-size: 11px;
  color: var(--lw-text-secondary);
  justify-self: start;
}

.profile-menu-chevron {
  color: var(--lw-text-muted);
}

.profile-menu-back {
  width: fit-content;
  border: none;
  background: transparent;
  color: var(--lw-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px 0;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.profile-menu-back:hover {
  color: var(--lw-text-main);
}

.profile-menu-choice {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  background: rgba(255, 255, 255, 0.24);
  text-align: left;
  cursor: pointer;
  transition: 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.profile-menu-choice:hover,
.profile-menu-choice.active {
  background: rgba(255, 255, 255, 0.5);
  border-color: rgba(var(--lw-primary-rgb), 0.2);
  transform: translateY(-1px);
}

.profile-menu-choice.locked {
  cursor: default;
}

.profile-menu-choice-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.profile-menu-choice-copy {
  font-size: 11px;
  color: var(--lw-text-secondary);
  line-height: 1.5;
}

.avatar-sm {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e2e8f0;
  object-fit: cover;
  border: 1px solid #e2e8f0;
  display: block;
}

.avatar-sm.placeholder {
  display: block;
  background: #e2e8f0;
}

.lw-panel-header[data-skin-variant='discord'] {
  background: var(--lw-bg-elevated);
  border-bottom-color: var(--lw-border-strong);
  box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--lw-text-inverse) 4%, transparent);
}

.lw-panel-header[data-skin-variant='discord'] .lw-brand {
  display: none;
}

.lw-panel-header[data-skin-variant='discord'] .launcher-btn {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: var(--lw-surface-container);
  border-color: var(--lw-border-strong);
  color: var(--lw-text-secondary);
  box-shadow: none;
}

.lw-panel-header[data-skin-variant='discord'] .launcher-btn:hover,
.lw-panel-header[data-skin-variant='discord'] .launcher-btn.active {
  background: color-mix(in srgb, var(--lw-primary) 18%, var(--lw-surface-container));
  border-color: var(--lw-border-active);
  color: var(--lw-text-main);
  box-shadow: none;
}

.lw-panel-header[data-skin-variant='discord'] .lw-tabs {
  background: var(--lw-surface-container);
  border-color: var(--lw-border-strong);
  border-radius: 14px;
}

.lw-panel-header[data-skin-variant='discord'] .lw-tab {
  color: var(--lw-text-secondary);
  border-radius: 10px;
}

.lw-panel-header[data-skin-variant='discord'] .lw-tab:hover {
  color: var(--lw-text-main);
  background: var(--lw-surface-container-high);
}

.lw-panel-header[data-skin-variant='discord'] .lw-tab.active {
  background: color-mix(in srgb, var(--lw-primary) 16%, var(--lw-surface-container-high));
  color: var(--lw-text-main);
  box-shadow: none;
}

.lw-panel-header[data-skin-variant='discord'] .header-floating-controls,
.lw-panel-header[data-skin-variant='discord'] .profile-trigger,
.lw-panel-header[data-skin-variant='discord'] .profile-menu,
.lw-panel-header[data-skin-variant='discord'] .widget-dropdown,
.lw-panel-header[data-skin-variant='discord'] .lw-tab-dropdown {
  background: var(--lw-surface-container);
  border-color: var(--lw-border-strong);
  box-shadow: var(--lw-shadow-card);
}

.lw-panel-header[data-skin-variant='discord'] .profile-trigger,
.lw-panel-header[data-skin-variant='discord'] .header-floating-controls {
  color: var(--lw-text-main);
}

.lw-panel-header[data-skin-variant='discord'] .profile-trigger-copy strong,
.lw-panel-header[data-skin-variant='discord'] .profile-menu-copy strong,
.lw-panel-header[data-skin-variant='discord'] .profile-menu-label,
.lw-panel-header[data-skin-variant='discord'] .widget-dropdown-item,
.lw-panel-header[data-skin-variant='discord'] .lw-tab-dropdown-item {
  color: var(--lw-text-main);
}

.lw-panel-header[data-skin-variant='discord'] .profile-trigger-copy small,
.lw-panel-header[data-skin-variant='discord'] .profile-menu-copy span:last-child,
.lw-panel-header[data-skin-variant='discord'] .profile-menu-value,
.lw-panel-header[data-skin-variant='discord'] .widget-dropdown-label,
.lw-panel-header[data-skin-variant='discord'] .widget-group-chevron,
.lw-panel-header[data-skin-variant='discord'] .profile-menu-kicker {
  color: var(--lw-text-muted);
}

.lw-panel-header[data-skin-variant='discord'] .profile-menu-item,
.lw-panel-header[data-skin-variant='discord'] .profile-menu-choice {
  background: var(--lw-surface-container-low);
  border-color: var(--lw-border-strong);
}

.lw-panel-header[data-skin-variant='discord'] .profile-menu-item:hover,
.lw-panel-header[data-skin-variant='discord'] .profile-menu-choice:hover,
.lw-panel-header[data-skin-variant='discord'] .profile-menu-choice.active,
.lw-panel-header[data-skin-variant='discord'] .widget-dropdown-item:hover,
.lw-panel-header[data-skin-variant='discord'] .lw-tab-dropdown-item:hover {
  background: var(--lw-surface-container-high);
  border-color: color-mix(in srgb, var(--lw-primary) 34%, var(--lw-border-strong));
  color: var(--lw-text-main);
}

.lw-panel-header[data-skin-variant='discord'] .profile-menu-icon {
  background: var(--lw-surface-container);
  color: var(--lw-text-secondary);
}

.lw-panel-header[data-skin-variant='discord'] .avatar-sm,
.lw-panel-header[data-skin-variant='discord'] .avatar-sm.placeholder {
  background: var(--lw-surface-container-high);
  border-color: var(--lw-border-strong);
}

@media (max-width: 768px) {
  .header-right {
    gap: 6px;
  }

  .lw-tabs {
    flex: 1;
    min-width: 0;
    margin-left: 0 !important;
    margin-right: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .lw-tabs::-webkit-scrollbar {
    display: none;
  }

  .header-center {
    display: none;
  }

  .lw-tab {
    padding: 6px 8px !important;
    font-size: 12px !important;
    flex-direction: row !important;
    gap: 4px !important;
  }

  .widget-dropdown {
    min-width: 200px;
    max-height: 60vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .widget-dropdown-item {
    padding: 10px 12px;
    font-size: 14px;
    border-radius: 10px;
  }

  .widget-dropdown-label {
    font-size: 11px;
    padding: 8px 12px 4px;
  }

  .widget-dropdown-divider {
    margin: 6px 10px;
  }

  .header-floating-controls {
    gap: 6px;
    padding: 7px;
  }

  .profile-trigger {
    padding-right: 4px;
  }

  .profile-menu {
    width: min(280px, calc(100vw - 24px));
  }
}
</style>
