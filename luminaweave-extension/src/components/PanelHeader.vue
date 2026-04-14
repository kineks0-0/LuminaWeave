<template>
  <div class="lw-panel-header">
    <div class="header-left">
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
        <!-- 可见 Tab：静态插件 -->
        <template v-for="(plugin, index) in tabOrder" :key="plugin.type === 'plugin' ? plugin.id : 'dyn-' + plugin.id">
          <template v-if="plugin.type === 'plugin'">
            <button
              v-if="plugin.id !== 'lumina-launcher'"
              :ref="(el) => setTabRef(el as HTMLElement | null, index)"
              class="lw-tab"
              :class="{ active: activeMainTab === plugin.id, 'lw-tab--hidden': index >= visibleCount }"
              @click="$emit('switchMainView', plugin.id)"
            >
              <span v-html="plugin.icon" class="tab-icon-wrapper"></span>
              {{ plugin.name }}
            </button>
          </template>
          <template v-else>
            <button
              :ref="(el) => setTabRef(el as HTMLElement | null, index)"
              class="lw-tab dynamic"
              :class="{ active: activeMainTab === plugin.id, 'lw-tab--hidden': index >= visibleCount }"
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

        <!-- 溢出按钮 -->
        <div class="lw-tab-more" v-if="overflowTabs.length > 0" ref="moreButtonRef">
          <button class="lw-tab lw-tab--more" @click="showOverflow = !showOverflow">
            ··· {{ overflowTabs.length }}
          </button>
          <div class="lw-tab-dropdown" v-if="showOverflow">
            <button
              v-for="tab in overflowTabs"
              :key="tab.id"
              class="lw-tab-dropdown-item"
              :class="{ active: activeMainTab === tab.id }"
              @click="pickOverflow(tab.id)"
            >
              <span v-html="tab.icon" class="tab-icon-wrapper"></span>
              {{ tab.name }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="header-center">
      <component v-for="plugin in headerCenterPlugins" :key="plugin.id" :is="plugin.headerCenterComponent" />
    </div>

    <div class="header-right">
      <component v-for="plugin in headerRightPlugins" :key="plugin.id" :is="plugin.headerRightComponent" />
      <div class="header-floating-controls">
        <button class="header-floating-control" :class="{ active: isWorkspaceMenuOpen }" @click="$emit('toggleWorkspaceMenu')" title="工作台菜单">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <line x1="4" y1="7" x2="20" y2="7"></line>
            <line x1="4" y1="12" x2="20" y2="12"></line>
            <line x1="4" y1="17" x2="20" y2="17"></line>
          </svg>
        </button>
        <button class="header-floating-control" @click="$emit('toggleSettings')" title="设置">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <circle cx="12" cy="12" r="3"></circle>
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
            </path>
          </svg>
        </button>
      </div>
      <div class="avatar-group" v-if="activeUserAvatar">
        <img :src="activeUserAvatar || defaultAvatar" class="avatar-sm" :title="activeUserName" @error="(e) => (e.target as HTMLImageElement).src = defaultAvatar">
      </div>
      <div class="avatar-sm placeholder" v-else></div>
      <button class="lw-btn-close" @click="$emit('close')" title="返回经典模式">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { pluginManager } from '@/core/PluginManager';

const props = withDefaults(defineProps<{
  activeMainTab?: string;
  dynamicTabs?: any[];
  isMobile?: boolean;
  isWorkspaceMenuOpen?: boolean;
}>(), {
  activeMainTab: 'lumina-chat',
  dynamicTabs: () => [],
  isMobile: false,
  isWorkspaceMenuOpen: false
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggleSettings'): void;
  (e: 'toggleWorkspaceMenu'): void;
  (e: 'switchMainView', tabId: string): void;
  (e: 'closeTab', tabId: string): void;
}>();

const mainPlugins = computed(() => pluginManager.getPluginsInSlot('mainView'));
const headerCenterPlugins = computed(() => pluginManager.getPluginsInSlot('headerCenter'));
const headerRightPlugins = computed(() => pluginManager.getPluginsInSlot('headerRight'));

const activeCharName = computed(() => (window as any).LuminaWeave?.getCharName() || 'Assistant');
const activeUserName = computed(() => (window as any).LuminaWeave?.getUserName() || 'User');
const activeCharAvatar = computed(() => (window as any).LuminaWeave?.getCharAvatar(activeCharName.value));
const activeUserAvatar = computed(() => (window as any).LuminaWeave?.getUserAvatar());
const defaultAvatar = computed(() => (window as any).LuminaWeave?.DEFAULT_AVATAR);

// ── Priority Navigation ──────────────────────────────────────────────────────

type TabEntry = { type: 'plugin' | 'dynamic'; id: string; name: string; icon: string };

/** 合并静态插件 + 动态 Tab，保持原始顺序 */
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

const tabsContainerRef = ref<HTMLElement | null>(null);
const moreButtonRef = ref<HTMLElement | null>(null);
const tabRefs = ref<(HTMLElement | null)[]>([]);
const visibleCount = ref(999); // 初始显示全部
const showOverflow = ref(false);

function setTabRef(el: HTMLElement | null, index: number) {
  tabRefs.value[index] = el;
}

const MORE_BTN_WIDTH = 56; // 预留溢出按钮宽度
const GAP = 4;

function recalc() {
  const container = tabsContainerRef.value;
  if (!container) return;
  const containerWidth = container.offsetWidth;
  if (containerWidth === 0) return;

  const tabs = tabRefs.value.filter(Boolean) as HTMLElement[];
  if (tabs.length === 0) return;

  let used = 0;
  let count = 0;
  for (const tab of tabs) {
    const w = tab.offsetWidth + GAP;
    if (used + w + (count < tabs.length - 1 ? MORE_BTN_WIDTH : 0) > containerWidth) break;
    used += w;
    count++;
  }

  visibleCount.value = count > 0 ? count : 1;
}

const overflowTabs = computed(() => tabOrder.value.slice(visibleCount.value));

function pickOverflow(tabId: string) {
  showOverflow.value = false;
  emit('switchMainView', tabId);
}

let ro: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    recalc();
    if (tabsContainerRef.value) {
      ro = new ResizeObserver(() => recalc());
      ro.observe(tabsContainerRef.value);
    }
  });

  document.addEventListener('pointerdown', onDocPointerDown);
});

onUnmounted(() => {
  ro?.disconnect();
  document.removeEventListener('pointerdown', onDocPointerDown);
});

function onDocPointerDown(e: PointerEvent) {
  if (!showOverflow.value) return;
  const target = e.target as Node;
  if (moreButtonRef.value && moreButtonRef.value.contains(target)) return;
  showOverflow.value = false;
}

// 当 tab 列表或激活 tab 变化时重新计算
watch([tabOrder, () => props.activeMainTab], () => {
  nextTick(() => recalc());
});
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
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  z-index: 10;
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

@media (max-width: 768px) {
  .header-right {
    gap: 6px;
  }
}

.lw-tabs {
  display: flex;
  gap: 4px;
  background: #f8fafc;
  padding: 4px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  min-width: 0;
  overflow: visible;
  position: relative;
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

/* 溢出按钮 */
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

@media (max-width: 768px) {
  .lw-tabs {
    flex: 1.5;
    margin-right: 8px;
  }

  .header-center {
    flex: 1;
    gap: 8px;
  }

  .lw-tab {
    padding: 6px 8px !important;
    font-size: 12px !important;
    flex-direction: row !important;
    gap: 4px !important;
  }

  .lw-tabs {
    margin-left: 0 !important;
  }
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
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1);
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
  box-shadow: 0 20px 38px rgba(15, 23, 42, 0.12);
}

.header-floating-control:hover,
.header-floating-control.active {
  background: color-mix(in srgb, var(--lw-primary) 10%, white);
  border-color: rgba(var(--lw-primary-rgb), 0.18);
  color: var(--lw-text-main);
}

.avatar-group {
  position: relative;
  width: 32px;
  height: 32px;
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
  background: #e2e8f0;
}

.user-avatar-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid #ffffff;
  background: #cbd5e1;
  overflow: hidden;
}

.user-avatar-badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lw-btn-close {
  background: #f1f5f9;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}

.lw-btn-close:hover {
  background: #fee2e2;
  color: #ef4444;
}

@media (max-width: 768px) {
  .header-floating-controls {
    gap: 6px;
    padding: 7px;
  }
}
</style>
