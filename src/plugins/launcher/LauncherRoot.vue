<template>
  <div class="launcher-root">
    <div class="launcher-header">
      <h1 class="launcher-title">Lumina Launcher</h1>
      <p class="launcher-subtitle">探索 LuminaWeave 的所有功能与插件</p>
    </div>

    <div class="launcher-content">
      <div class="launcher-section">
        <h2 class="section-title">核心功能</h2>
        <div class="launcher-grid">
          <div v-for="plugin in mainViewPlugins" :key="plugin.id" 
               class="launcher-item" 
               :class="{ 'is-active': activeMainTab === plugin.id }"
               @click="openMainPlugin(plugin)">
            <div class="launcher-icon-box" v-html="plugin.icon"></div>
            <div class="launcher-info">
              <span class="launcher-name">{{ plugin.name }}</span>
              <span class="launcher-desc">主视图应用</span>
            </div>
            <div class="launcher-action-hint">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div class="launcher-section">
        <h2 class="section-title">系统工具</h2>
        <div class="launcher-grid small-grid">
          <div class="launcher-item tool-item" @click="openCardMaker">
            <div class="launcher-icon-box">🧩</div>
            <div class="launcher-info">
              <span class="launcher-name">制卡工坊</span>
              <span class="launcher-desc">Card Maker</span>
            </div>
            <div class="launcher-action-hint">
              <span class="tab-badge">Tab</span>
            </div>
          </div>
          <div v-for="plugin in widgetPlugins" :key="plugin.id" 
               class="launcher-item tool-item"
               @click="openToolPlugin(plugin)">
            <div class="launcher-icon-box" v-html="plugin.icon"></div>
            <div class="launcher-info">
              <span class="launcher-name">{{ plugin.name }}</span>
              <span class="launcher-desc">辅助工具</span>
            </div>
            <div class="launcher-action-hint" v-if="plugin.id === 'lumina-settings'">
              <span class="tab-badge">大窗口</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { pluginManager } from '../../core/PluginManager';
import { LuminaWeaveAPI } from '../../api';

const lwApi = inject('lwApi') as LuminaWeaveAPI;

const props = defineProps<{
  activeMainTab?: string
}>();

const mainViewPlugins = computed(() => {
  return pluginManager.getPluginsInSlot('mainView').filter(p => p.id !== 'lumina-launcher');
});

const widgetPlugins = computed(() => {
  return pluginManager.getPluginsInSlot('widget');
});

const openMainPlugin = (plugin: any) => {
  lwApi.emit('SWITCH_MAIN_VIEW', plugin.id);
};

const openToolPlugin = (plugin: any) => {
  if (plugin.id === 'lumina-settings') {
    // 特别处理：设置可以打开为标签页
    lwApi.openTab({
      id: 'lumina-settings-large',
      name: '系统设置',
      icon: plugin.icon,
      component: 'SettingsRoot', // 字符串形式，App.vue 需在 componentMap 中注册
      props: { mode: 'large' }
    });
  } else {
    lwApi.emit('SWITCH_WIDGET_PANEL', plugin.id);
  }
};

const openCardMaker = () => {
  lwApi.openPanel('card_maker', {}, { mode: 'tab' });
};
</script>

<style scoped>
.launcher-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
  padding: 48px 64px;
  overflow-y: auto;
  font-family: var(--lw-font, 'Inter', sans-serif);
}

@media (max-width: 768px) {
  .launcher-root {
    padding: 24px;
  }
}

.launcher-header {
  margin-bottom: 48px;
}

.launcher-title {
  font-size: 32px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}

.launcher-subtitle {
  font-size: 16px;
  color: #64748b;
}

.launcher-section {
  margin-bottom: 48px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 16px;
  padding-left: 4px;
}

.launcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.small-grid {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.launcher-item {
  display: flex;
  align-items: center;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

.launcher-item:hover {
  transform: translateY(-2px);
  border-color: var(--lw-primary);
  box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.1), 0 8px 10px -6px rgba(99, 102, 241, 0.1);
}

.launcher-item.is-active {
  border-color: var(--lw-primary);
  background: rgba(99, 102, 241, 0.02);
}

.launcher-icon-box {
  width: 48px;
  height: 48px;
  background: #f1f5f9;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-primary);
  margin-right: 16px;
  transition: all 0.3s ease;
}

.launcher-item:hover .launcher-icon-box {
  background: var(--lw-primary);
  color: #ffffff;
}

.launcher-info {
  display: flex;
  flex-direction: column;
}

.launcher-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.launcher-desc {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.launcher-action-hint {
  margin-left: auto;
  color: #cbd5e1;
  transition: all 0.3s ease;
}

.launcher-item:hover .launcher-action-hint {
  color: var(--lw-primary);
  transform: translateX(4px);
}

.tool-item {
  padding: 16px;
  border-radius: 12px;
}

.tool-item .launcher-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.tab-badge {
  font-size: 10px;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.1);
  color: var(--lw-primary);
  padding: 2px 6px;
  border-radius: 4px;
}

/* 隐藏滚动条 */
.launcher-root::-webkit-scrollbar {
  width: 6px;
}
.launcher-root::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 3px;
}
</style>
