<template>
  <div class="lw-panel-header">
    <div class="header-left">
      <div class="lw-logo-icon" v-if="!isMobile">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"
          stroke-linecap="round" stroke-linejoin="round">
          <path
            d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z">
          </path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </div>
      <div class="lw-brand" v-if="!isMobile">
        <span class="lw-title-main">LuminaWeave</span>
        <span class="lw-title-sub">Project: Ethereal Echoes</span>
      </div>

      <!-- 插入到原有的 header-left 收尾前，也就是品牌标识旁边 -->
      <div class="header-launcher">
        <button class="launcher-btn" :class="{ active: activeMainTab === 'lumina-launcher' }"
          @click="$emit('switchMainView', 'lumina-launcher')" title="启动台">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        </button>
      </div>

      <div class="lw-tabs">
        <!-- 固定标签页 -->
        <button class="lw-tab" v-for="plugin in mainPlugins" :key="plugin.id"
          v-show="plugin.id !== 'lumina-launcher'"
          :class="{ active: activeMainTab === plugin.id }" @click="$emit('switchMainView', plugin.id)">
          <span v-html="plugin.icon" class="tab-icon-wrapper"></span>
          {{ plugin.name }}
        </button>

        <!-- 动态标签页 -->
        <div class="lw-tab-group" v-for="tab in dynamicTabs" :key="tab.id">
          <button class="lw-tab dynamic" :class="{ active: activeMainTab === tab.id }"
            @click="$emit('switchMainView', tab.id)">
            <span v-html="tab.icon" class="tab-icon-wrapper"></span>
            {{ tab.name }}
            <div class="tab-close" @click.stop="$emit('closeTab', tab.id)">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </button>
        </div>
      </div>

    </div>

    <div class="header-center">
      <component v-for="plugin in headerCenterPlugins" :key="plugin.id" :is="plugin.headerCenterComponent" />
    </div>

    <div class="header-right">
      <component v-for="plugin in headerRightPlugins" :key="plugin.id" :is="plugin.headerRightComponent" />
      <button class="icon-btn" @click="$emit('toggleSettings')" title="设置">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="12" cy="12" r="3"></circle>
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
          </path>
        </svg>
      </button>
      <div class="avatar-group" v-if="activeUserAvatar">
        <img :src="activeUserAvatar || defaultAvatar" class="avatar-sm" :title="activeUserName" @error="(e) => (e.target as any).src = defaultAvatar">
      </div>
      <div class="avatar-sm placeholder" v-else></div>
      <button class="lw-btn-close" @click="$emit('close')" title="返回经典模式">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { pluginManager } from '@/core/PluginManager';

withDefaults(defineProps<{
  activeMainTab?: string,
  dynamicTabs?: any[],
  isMobile?: boolean
}>(), {
  activeMainTab: 'lumina-chat',
  dynamicTabs: () => [],
  isMobile: false
});

defineEmits<{
  (e: 'close'): void;
  (e: 'toggleSettings'): void;
  (e: 'switchMainView', tabId: string): void;
  (e: 'closeTab', tabId: string): void;
}>();

const mainPlugins = computed(() => pluginManager.getPluginsInSlot('mainView'));
const headerCenterPlugins = computed(() => pluginManager.getPluginsInSlot('headerCenter'));
const headerRightPlugins = computed(() => pluginManager.getPluginsInSlot('headerRight'));

// 头像逻辑
const activeCharName = computed(() => (window as any).LuminaWeave?.getCharName() || 'Assistant');
const activeUserName = computed(() => (window as any).LuminaWeave?.getUserName() || 'User');
const activeCharAvatar = computed(() => (window as any).LuminaWeave?.getCharAvatar(activeCharName.value));
const activeUserAvatar = computed(() => (window as any).LuminaWeave?.getUserAvatar());
const defaultAvatar = computed(() => (window as any).LuminaWeave?.DEFAULT_AVATAR);
</script>

<style scoped>
/* modify tab icon wrapper slightly */
:deep(.tab-icon-wrapper) {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* --- 顶部操作栏 --- */
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
}

.header-launcher {
  display: flex;
  align-items: center;
  margin-right: 4px;
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

.lw-logo-icon {
  background: var(--lw-primary);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.lw-brand {
  display: flex;
  flex-direction: column;
}

.lw-title-main {
  font-weight: 600;
  font-size: 15px;
}

.lw-title-sub {
  font-size: 11px;
  color: #64748b;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0; /* 禁止收缩 */
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
  max-width: 40vw;
  overflow-x: auto;
  scrollbar-width: none;
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
  padding: 6px 12px; /* 减小内边距 */
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: 0.2s;
  white-space: nowrap; /* 禁止文字换行 */
  flex-shrink: 0;
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

.lw-tab-group {
  display: flex;
  align-items: center;
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

@media (max-width: 768px) {
  .lw-tabs {
    max-width: none; /* 移除移动端宽度限制 */
    flex: 1.5; /* 给标签页稍多一点空间 */
    margin-right: 8px;
  }
  .header-center {
    flex: 1;
    gap: 8px; /* 移动端减小插件间距 */
  }
  .lw-tab {
    padding: 6px 8px !important;
    font-size: 12px !important;
    flex-direction: row !important; /* 强制水平 */
    gap: 4px !important;
  }
  .lw-logo-icon {
    display: none;
  }
  .lw-tabs {
    margin-left: 0 !important;
  }
}


.icon-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #94a3b8;
  transition: 0.2s;
}

.icon-btn:hover {
  color: var(--lw-primary);
  transform: rotate(15deg);
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
</style>
