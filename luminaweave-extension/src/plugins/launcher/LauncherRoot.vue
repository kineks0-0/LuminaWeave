<template>
  <div class="launcher-root lw-dot-grid" :class="{ 'is-launchpad': presentation === 'launchpad' }">
    <div class="launcher-header">
      <div class="header-copy">
        <span class="launcher-kicker">Workspace Index</span>
        <h1 class="launcher-title">Lumina Launcher</h1>
        <p class="launcher-subtitle">把常用界面、工具面板和工作流入口收束到同一张静音工作台。点击条目会打开或聚焦对应窗口。</p>
      </div>
      <div class="header-meta">
        <span class="meta-chip">{{ mainViewPlugins.length }} main views</span>
        <span class="meta-chip">{{ widgetPlugins.length + 1 }} tools</span>
      </div>
    </div>

    <div class="launcher-content">
      <div class="launcher-section">
        <div class="section-heading">
          <h2 class="section-title">Core Views</h2>
          <p class="section-copy">主工作区入口，优先承载当前创作任务。</p>
        </div>
        <div class="launcher-grid">
          <div v-for="plugin in mainViewPlugins" :key="plugin.id" 
               class="launcher-item" 
               :class="{ 'is-active': activeMainTab === plugin.id }"
               @click="openMainPlugin(plugin)">
            <div class="launcher-icon-box" v-html="plugin.icon"></div>
            <div class="launcher-info">
              <span class="launcher-name">{{ plugin.name }}</span>
              <span class="launcher-desc">打开或聚焦主窗口</span>
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
        <div class="section-heading">
          <h2 class="section-title">System Tools</h2>
          <p class="section-copy">辅助轨、设置轨和制卡流程，按需展开，不挤占主线。</p>
        </div>
        <div class="launcher-grid small-grid">
          <div class="launcher-item tool-item" @click="openCardMaker">
            <div class="launcher-icon-box">🧩</div>
            <div class="launcher-info">
              <span class="launcher-name">制卡工坊</span>
              <span class="launcher-desc">打开制卡工坊窗口</span>
            </div>
            <div class="launcher-action-hint">
              <span class="tab-badge">Tab</span>
            </div>
          </div>
          <div class="launcher-item tool-item" @click="openContextSwitcher">
            <div class="launcher-icon-box">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
            </div>
            <div class="launcher-info">
              <span class="launcher-name">会话切换</span>
              <span class="launcher-desc">切换查看的聊天或制卡会话</span>
            </div>
          </div>
          <div v-for="plugin in widgetPlugins" :key="plugin.id" 
               class="launcher-item tool-item"
               @click="openToolPlugin(plugin)">
            <div class="launcher-icon-box" v-html="plugin.icon"></div>
            <div class="launcher-info">
              <span class="launcher-name">{{ plugin.name }}</span>
              <span class="launcher-desc">打开或聚焦辅助窗口</span>
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
  activeMainTab?: string;
  presentation?: 'window' | 'launchpad';
  dismissOnSelect?: boolean;
}>();

const emit = defineEmits<{
  (e: 'dismiss'): void;
}>();

const mainViewPlugins = computed(() => {
  return pluginManager.getPluginsInSlot('mainView').filter(p => p.id !== 'lumina-launcher' && p.id !== 'lumina-forge');
});

const widgetPlugins = computed(() => {
  return pluginManager.getPluginsInSlot('widget');
});

const openMainPlugin = (plugin: any) => {
  lwApi.emit('SWITCH_MAIN_VIEW', plugin.id);
  if (props.dismissOnSelect) {
    emit('dismiss');
  }
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
  if (props.dismissOnSelect) {
    emit('dismiss');
  }
};

const openCardMaker = () => {
  lwApi.openPanel('card_maker', {}, { mode: 'tab' });
  if (props.dismissOnSelect) {
    emit('dismiss');
  }
};

const openContextSwitcher = () => {
  lwApi.emit('SWITCH_WIDGET_PANEL', 'context-switcher');
  if (props.dismissOnSelect) {
    emit('dismiss');
  }
};
</script>

<style scoped>
.launcher-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    linear-gradient(180deg, rgba(var(--lw-bg-elevated-rgb), 0.58), rgba(var(--lw-bg-elevated-rgb), 0));
  padding: 40px 44px;
  overflow-y: auto;
  position: relative;
}

.launcher-root.is-launchpad {
  height: min(78vh, 760px);
  min-height: 420px;
  border-radius: 34px;
  border: 1px solid rgba(255, 255, 255, 0.44);
  background:
    radial-gradient(circle at 18% 12%, rgba(var(--lw-primary-rgb), 0.2), transparent 28%),
    radial-gradient(circle at 82% 10%, rgba(255, 255, 255, 0.74), transparent 22%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(238, 244, 252, 0.68));
  box-shadow:
    0 30px 70px rgba(15, 23, 42, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.58);
  backdrop-filter: blur(30px) saturate(138%);
}

@media (max-width: 768px) {
  .launcher-root {
    padding: 22px 18px;
  }

  .launcher-root.is-launchpad {
    height: min(100%, 100dvh - 108px);
    min-height: 0;
    border-radius: 28px;
  }
}

.launcher-header {
  margin-bottom: 34px;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-end;
  position: relative;
  z-index: 1;
}

.header-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 700px;
}

.launcher-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  color: var(--lw-text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.launcher-title {
  font-family: var(--lw-font-display);
  font-size: 34px;
  font-weight: 700;
  color: var(--lw-text-main);
  letter-spacing: -0.04em;
  margin-bottom: 0;
}

.launcher-subtitle {
  font-size: 14px;
  color: var(--lw-text-secondary);
  max-width: 58ch;
  line-height: 1.7;
}

.launcher-section {
  margin-bottom: 28px;
  position: relative;
  z-index: 1;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--lw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.section-copy {
  font-size: 12px;
  color: var(--lw-text-secondary);
}

.launcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.small-grid {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.launcher-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  border: 1px solid var(--lw-border-base);
  border-radius: 22px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
  box-shadow: var(--lw-shadow);
}

.launcher-item:hover {
  transform: translateY(-2px);
  border-color: var(--lw-border-hover);
  box-shadow: var(--lw-shadow-card);
}

.launcher-item.is-active {
  border-color: var(--lw-border-active);
  background: var(--lw-bg-selection);
}

.launcher-icon-box {
  width: 46px;
  height: 46px;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-subtle);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-text-main);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.launcher-item:hover .launcher-icon-box {
  background: var(--lw-black);
  color: var(--lw-text-inverse);
}

.launcher-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.launcher-name {
  font-family: var(--lw-font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.launcher-desc {
  font-size: 12px;
  color: var(--lw-text-secondary);
}

.launcher-action-hint {
  margin-left: auto;
  color: var(--lw-text-muted);
  transition: all 0.3s ease;
}

.launcher-item:hover .launcher-action-hint {
  color: var(--lw-text-main);
  transform: translateX(4px);
}

.tool-item {
  padding: 16px;
  border-radius: 18px;
}

.tool-item .launcher-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
}

.tab-badge {
  font-size: 10px;
  font-weight: 700;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--lw-border-subtle);
}

/* 隐藏滚动条 */
.launcher-root::-webkit-scrollbar {
  width: 6px;
}
.launcher-root::-webkit-scrollbar-thumb {
  background: var(--lw-border-base);
  border-radius: 3px;
}

@media (max-width: 900px) {
  .launcher-header,
  .section-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-meta {
    width: 100%;
  }
}
</style>
