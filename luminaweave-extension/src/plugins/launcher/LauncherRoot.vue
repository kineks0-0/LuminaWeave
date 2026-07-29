<template>
  <div :class="rootClass">
    <div class="tw:relative tw:z-10 tw:mb-8 tw:flex tw:items-end tw:justify-between tw:gap-6 tw:max-[900px]:flex-col tw:max-[900px]:items-start">
      <div class="tw:flex tw:max-w-[700px] tw:flex-col tw:gap-2">
        <span class="tw:text-[length:var(--lw-type-label-small-size)] tw:font-bold tw:uppercase tw:text-lw-text-muted">Workspace Index</span>
        <h1 class="tw:m-0 tw:font-lw-display tw:text-[length:var(--lw-type-headline-large-size)] tw:font-bold tw:text-lw-text tw:text-balance">Lumina Launcher</h1>
        <p class="tw:m-0 tw:max-w-[58ch] tw:text-[length:var(--lw-type-title-small-size)] tw:leading-7 tw:text-lw-text-secondary tw:text-pretty">把常用界面、工具面板和工作流入口收束到同一张静音工作台。点击条目会打开或聚焦对应窗口。</p>
      </div>
      <div class="tw:flex tw:flex-wrap tw:gap-2 tw:max-[900px]:w-full">
        <span class="tw:inline-flex tw:min-h-8 tw:items-center tw:rounded-lw-pill tw:border tw:border-lw-border tw:bg-lw-elevated tw:px-3 tw:text-xs tw:font-bold tw:text-lw-text-secondary">{{ mainViewPlugins.length }} main views</span>
        <span class="tw:inline-flex tw:min-h-8 tw:items-center tw:rounded-lw-pill tw:border tw:border-lw-border tw:bg-lw-elevated tw:px-3 tw:text-xs tw:font-bold tw:text-lw-text-secondary">{{ widgetPlugins.length + 1 }} tools</span>
      </div>
    </div>

    <div>
      <div class="tw:relative tw:z-10 tw:mb-7">
        <div class="tw:mb-4 tw:flex tw:items-end tw:justify-between tw:gap-4 tw:max-[900px]:flex-col tw:max-[900px]:items-start">
          <h2 class="tw:m-0 tw:text-xs tw:font-bold tw:uppercase tw:text-lw-text-muted">Core Views</h2>
          <p class="tw:m-0 tw:text-[length:var(--lw-type-body-small-size)] tw:text-lw-text-secondary">主工作区入口，优先承载当前创作任务。</p>
        </div>
        <div class="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] tw:gap-3.5">
          <button v-for="plugin in mainViewPlugins" :key="plugin.id"
               type="button"
               :class="launcherItemClass(props.activeMainTab === plugin.id)"
               @click="openMainPlugin(plugin)">
            <div :class="iconBoxClass(false)" v-html="plugin.icon"></div>
            <div class="tw:flex tw:min-w-0 tw:flex-col tw:gap-1 tw:text-left">
              <span class="tw:font-lw-display tw:text-[length:var(--lw-type-title-medium-size)] tw:font-bold tw:text-lw-text tw:truncate">{{ plugin.name }}</span>
              <span class="tw:text-[length:var(--lw-type-body-small-size)] tw:text-lw-text-secondary">打开或聚焦主窗口</span>
            </div>
            <div class="tw:ml-auto tw:text-lw-text-muted tw:transition-[color,transform] tw:duration-150 tw:ease-out tw:group-hover:translate-x-1 tw:group-hover:text-lw-text">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </button>
        </div>
      </div>

      <div class="tw:relative tw:z-10 tw:mb-7">
        <div class="tw:mb-4 tw:flex tw:items-end tw:justify-between tw:gap-4 tw:max-[900px]:flex-col tw:max-[900px]:items-start">
          <h2 class="tw:m-0 tw:text-xs tw:font-bold tw:uppercase tw:text-lw-text-muted">System Tools</h2>
          <p class="tw:m-0 tw:text-[length:var(--lw-type-body-small-size)] tw:text-lw-text-secondary">辅助轨、设置轨和制卡流程，按需展开，不挤占主线。</p>
        </div>
        <div class="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] tw:gap-3.5">
          <button type="button" :class="launcherItemClass(false, true)" @click="openCardMaker">
            <div :class="iconBoxClass(true)">🧩</div>
            <div class="tw:flex tw:min-w-0 tw:flex-col tw:gap-1 tw:text-left">
              <span class="tw:font-lw-display tw:text-[length:var(--lw-type-title-medium-size)] tw:font-bold tw:text-lw-text tw:truncate">制卡工坊</span>
              <span class="tw:text-[length:var(--lw-type-body-small-size)] tw:text-lw-text-secondary">打开制卡工坊</span>
            </div>
            <div class="tw:ml-auto">
              <span class="tw:inline-flex tw:rounded-lw-pill tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:px-2 tw:py-1 tw:text-xs tw:font-bold tw:text-lw-text-secondary">默认</span>
            </div>
          </button>
          <button type="button" :class="launcherItemClass(false, true)" @click="openContextSwitcher">
            <div :class="iconBoxClass(true)">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
            </div>
            <div class="tw:flex tw:min-w-0 tw:flex-col tw:gap-1 tw:text-left">
              <span class="tw:font-lw-display tw:text-[length:var(--lw-type-title-medium-size)] tw:font-bold tw:text-lw-text tw:truncate">会话切换</span>
              <span class="tw:text-[length:var(--lw-type-body-small-size)] tw:text-lw-text-secondary">切换查看的聊天或制卡会话</span>
            </div>
          </button>
          <button v-for="plugin in widgetPlugins" :key="plugin.id"
               type="button"
               :class="launcherItemClass(false, true)"
               @click="openToolPlugin(plugin)">
            <div :class="iconBoxClass(true)" v-html="plugin.icon"></div>
            <div class="tw:flex tw:min-w-0 tw:flex-col tw:gap-1 tw:text-left">
              <span class="tw:font-lw-display tw:text-[length:var(--lw-type-title-medium-size)] tw:font-bold tw:text-lw-text tw:truncate">{{ plugin.name }}</span>
              <span class="tw:text-[length:var(--lw-type-body-small-size)] tw:text-lw-text-secondary">打开或聚焦辅助窗口</span>
            </div>
            <div class="tw:ml-auto" v-if="plugin.id === 'lumina-settings'">
              <span class="tw:inline-flex tw:rounded-lw-pill tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:px-2 tw:py-1 tw:text-xs tw:font-bold tw:text-lw-text-secondary">默认</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { pluginManager } from '../../core/PluginManager.js';
import { LuminaWeaveAPI } from '../../api';
import { cn } from '../../ui/cn.js';
import { getPrimarySurfaceContractIdForPlugin } from '../../platform/plugin/officialPluginSurfaces.js';
import { useSurfaceInput } from '../../platform/surface/useSurfaceRuntimeContext.js';
import type { LuminaPlugin } from '../../types/plugin.js';

const lwApi = inject('lwApi') as LuminaWeaveAPI;

const props = useSurfaceInput('launcher.root');

const mainViewPlugins = computed(() => {
  return pluginManager.getPluginsInSlot('mainView').filter(p => p.id !== 'lumina-launcher' && p.id !== 'lumina-forge');
});

const widgetPlugins = computed(() => {
  return pluginManager.getPluginsInSlot('widget');
});

const rootClass = computed(() => cn(
  'launcher-root lw-dot-grid tw:relative tw:flex tw:h-full tw:flex-col tw:overflow-y-auto tw:px-11 tw:py-10 tw:max-[768px]:px-[18px] tw:max-[768px]:py-[22px]',
  props.presentation === 'launchpad' && 'is-launchpad tw:h-[min(78vh,760px)] tw:min-h-[420px] tw:rounded-[34px] tw:max-[768px]:h-[min(100%,calc(100dvh-108px))] tw:max-[768px]:min-h-0 tw:max-[768px]:rounded-[28px]'
));

const launcherItemClass = (isActive: boolean, compact = false) => cn(
  'tw:group tw:relative tw:flex tw:w-full tw:items-center tw:gap-3.5 tw:overflow-hidden tw:border tw:border-lw-border tw:bg-lw-elevated tw:text-left tw:shadow-lw tw:outline-none tw:transition-[background-color,border-color,box-shadow,transform] tw:duration-150 tw:ease-out tw:hover:-translate-y-0.5 tw:hover:border-lw-border-hover tw:hover:shadow-lw-card tw:focus-visible:border-lw-primary tw:focus-visible:shadow-[0_0_0_3px_rgba(var(--lw-primary-rgb),0.12)]',
  compact ? 'tw:rounded-lw-md tw:p-4' : 'tw:rounded-lw-md tw:p-[18px]',
  isActive && 'tw:border-lw-border-active tw:bg-lw-selection'
);

const iconBoxClass = (compact: boolean) => cn(
  'tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:text-lw-text tw:transition-[background-color,color,border-color] tw:duration-150 tw:ease-out tw:group-hover:bg-lw-text tw:group-hover:text-lw-text-inverse',
  compact ? 'tw:size-10 tw:rounded-lw-sm' : 'tw:size-[46px] tw:rounded-lw-sm'
);

const openMainPlugin = (plugin: LuminaPlugin): void => {
  const contractId = getPrimarySurfaceContractIdForPlugin(plugin);
  if (!contractId) {
    console.error('[SurfaceRuntime] Plugin primary surface unavailable', { pluginId: plugin.id });
    return;
  }
  lwApi.services.desktopSurface.launchActivity({
    id: plugin.id,
    title: plugin.name,
    icon: plugin.icon,
    role: 'primary',
    target: {
      kind: 'plugin',
      pluginId: plugin.id,
      contractId
    },
    activity: {
      size: 'default',
      pageType: 'nested'
    },
    dedupeKey: `plugin:${plugin.id}`
  });
  if (props.dismissOnSelect) {
    props.onDismiss?.();
  }
};

const openToolPlugin = (plugin: LuminaPlugin): void => {
  const contractId = getPrimarySurfaceContractIdForPlugin(plugin);
  if (!contractId) {
    console.error('[SurfaceRuntime] Plugin primary surface unavailable', { pluginId: plugin.id });
    return;
  }
  lwApi.services.desktopSurface.launchActivity({
    id: plugin.id,
    title: plugin.name,
    icon: plugin.icon,
    role: 'support',
    target: {
      kind: 'plugin',
      pluginId: plugin.id,
      contractId
    },
    activity: {
      size: 'small',
      pageType: plugin.id === 'lumina-settings' ? 'standalone' : 'nested'
    },
    dedupeKey: `plugin:${plugin.id}`
  });
  if (props.dismissOnSelect) {
    props.onDismiss?.();
  }
};

const openCardMaker = () => {
  lwApi.services.desktopSurface.launchActivity({
    id: 'card_maker',
    title: '制卡工坊',
    icon: '🧩',
    role: 'support',
    target: {
      kind: 'registered-panel',
      panelId: 'card_maker',
      contractId: 'forge.workspace'
    },
    activity: {
      size: 'small',
      pageType: 'standalone',
      statusBar: {
        iconColor: 'auto'
      },
      titleBar: {
        title: '制卡工坊',
        showBack: true
      }
    },
    props: { isTabMode: true },
    dedupeKey: 'panel:card_maker'
  });
  if (props.dismissOnSelect) {
    props.onDismiss?.();
  }
};

const openContextSwitcher = () => {
  lwApi.services.desktopSurface.launchActivity({
    id: 'context-switcher',
    title: '会话切换',
    icon: '🔄',
    role: 'support',
    target: {
      kind: 'registered-panel',
      panelId: 'context-switcher'
    },
    activity: {
      size: 'small',
      pageType: 'nested'
    },
    dedupeKey: 'panel:context-switcher'
  });
  if (props.dismissOnSelect) {
    props.onDismiss?.();
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

/* 隐藏滚动条 */
.launcher-root::-webkit-scrollbar {
  width: 6px;
}
.launcher-root::-webkit-scrollbar-thumb {
  background: var(--lw-border-base);
  border-radius: 3px;
}

</style>
