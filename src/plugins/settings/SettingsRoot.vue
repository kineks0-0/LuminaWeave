<template>
  <div
    class="lw-settings-root"
    :class="rootClass"
    :data-skin-variant="settingsVariant || 'default'"
    :style="settingsSkinStyle"
  >
    <!-- 大窗口模式下的侧边栏导航 -->
    <aside v-if="mode === 'large'" class="settings-sidebar tw:flex tw:w-60 tw:shrink-0 tw:flex-col tw:border-r tw:border-lw-border tw:bg-lw-elevated/90">
      <div class="sidebar-header tw:border-b tw:border-lw-border-subtle tw:px-5 tw:pb-[18px] tw:pt-[22px]">
        <h3 class="tw:font-lw-display tw:text-[length:var(--lw-type-title-large-size)] tw:font-[var(--lw-type-title-large-weight)] tw:leading-[var(--lw-type-title-large-line-height)] tw:tracking-[var(--lw-type-title-large-tracking)] tw:text-lw-text">设置中心</h3>
      </div>
      <nav class="sidebar-nav tw:flex-1 tw:overflow-y-auto tw:p-3" aria-label="设置导航">
        <button
          type="button"
          :class="navItemClass(!currentDetailedView)"
          :aria-current="!currentDetailedView ? 'page' : undefined"
          @click="currentDetailedView = null"
        >
          <LayoutGrid :size="16" :stroke-width="2" aria-hidden="true" />
          <span class="tw:truncate">常规概览</span>
        </button>
        <div v-if="activeThemeEntry" class="nav-divider tw:px-3 tw:pb-2 tw:pt-4 tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">当前桌面模式</div>
        <button
          v-if="activeThemeEntry"
          type="button"
          :class="navItemClass(currentDetailedView === activeThemeEntry.pluginId)"
          :aria-current="currentDetailedView === activeThemeEntry.pluginId ? 'page' : undefined"
          @click="currentDetailedView = activeThemeEntry.pluginId"
        >
          <span class="nav-icon tw:flex tw:items-center tw:justify-center" aria-hidden="true" v-html="activeThemeEntry.pluginIcon"></span>
          <span class="tw:truncate">{{ activeThemeEntry.pluginName }}</span>
        </button>
        <div class="nav-divider tw:px-3 tw:pb-2 tw:pt-4 tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">插件专属设置</div>
        <button
          v-for="sb in settingsBlocks"
          :key="sb.pluginId"
          type="button"
          :class="navItemClass(currentDetailedView === sb.pluginId)"
          :aria-current="currentDetailedView === sb.pluginId ? 'page' : undefined"
          @click="currentDetailedView = sb.pluginId"
        >
          <span class="nav-icon tw:flex tw:items-center tw:justify-center" aria-hidden="true" v-html="sb.pluginIcon"></span>
          <span class="tw:truncate">{{ sb.pluginName }}</span>
        </button>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <div class="settings-main-container tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
      <div v-if="mode === 'large' && currentDetailedView" class="main-content-header tw:flex tw:items-center tw:justify-between tw:border-b tw:border-lw-border tw:bg-lw-elevated/90 tw:px-7 tw:py-4">
        <div class="header-breadcrumb tw:flex tw:items-center tw:gap-2 tw:text-[length:var(--lw-type-body-medium-size)] tw:font-[var(--lw-type-body-medium-weight)] tw:leading-[var(--lw-type-body-medium-line-height)] tw:tracking-[var(--lw-type-body-medium-tracking)]">
            <button type="button" class="tw:rounded-lw-sm tw:border-0 tw:bg-transparent tw:p-0 tw:text-lw-text-secondary tw:transition-colors tw:duration-150 tw:hover:text-lw-primary" @click="currentDetailedView = null">设置</button>
            <span class="tw:text-lw-text-muted">/</span>
            <span class="tw:font-[var(--lw-type-title-small-weight)] tw:text-lw-text">{{ getPluginName(currentDetailedView) }}</span>
        </div>
        <LuminaButton variant="ghost" size="sm" @click="currentDetailedView = null">
            <ChevronLeft :size="14" :stroke-width="2" aria-hidden="true" />
            返回概览
        </LuminaButton>
      </div>
      <div v-if="mode === 'small' && currentDetailedView" class="small-back-bar tw:sticky tw:top-0 tw:z-20 tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-lw-border tw:bg-lw-elevated/90 tw:px-3.5 tw:py-2.5">
        <LuminaButton variant="ghost" size="sm" tone="primary" @click="currentDetailedView = null">
          <ChevronLeft :size="16" :stroke-width="2.5" aria-hidden="true" />
          <span>返回</span>
        </LuminaButton>
        <span class="small-back-title tw:min-w-0 tw:truncate tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:tracking-[var(--lw-type-title-small-tracking)] tw:text-lw-text">{{ getPluginName(currentDetailedView) }}</span>
      </div>
      <div class="settings-scroll-area tw:relative tw:flex-1 tw:overflow-y-auto" :class="mode !== 'large' && 'tw:box-border tw:px-3 tw:pb-3.5'" @wheel.stop>
        <TelegramSettingsHome
          v-if="mode === 'small' && settingsVariant === 'telegram' && !currentDetailedView"
          @open-detail="openDetailedView"
        />
        <component
          v-else
          :is="currentDetailedView ? SettingsDetailed : SettingsUnified"
          :pluginId="currentDetailedView"
          @open-detail="openDetailedView"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue';
import { ChevronLeft, LayoutGrid } from 'lucide-vue-next';
import SettingsUnified from './SettingsUnified.vue';
import SettingsDetailed from './SettingsDetailed.vue';
import TelegramSettingsHome from './TelegramSettingsHome.vue';
import { activeSettings, currentDetailedView } from './useSettings.js';
import { getSettingsEntry, getVisibleSettingsEntries } from './settingsRegistry.js';
import { getActiveDesktopModeIdFromSettings } from '../../desktop-modes/core/registry.js';
import { activityFromLegacyMode, normalizeActivityDescriptor } from '../../platform/activity/activityLaunchResolver.js';
import type { ActivityDescriptor } from '../../platform/activity/types.js';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import { cn } from '../../ui/cn.js';
import { LuminaButton } from '../../ui/primitives';

const props = defineProps({
  mode: {
    type: String,
    default: 'small'
  },
  activity: {
    type: Object as PropType<ActivityDescriptor>,
    default: undefined
  }
});

const { cssVars, variant: settingsVariant } = useSurfaceSkin('settings.root');
const settingsSkinStyle = computed(() => cssVars.value);
const activeThemeId = computed(() => getActiveDesktopModeIdFromSettings(activeSettings));
const normalizedActivity = computed(() => normalizeActivityDescriptor(
  props.activity,
  activityFromLegacyMode(props.mode === 'large' || props.mode === 'small' ? props.mode : undefined)
));
const mode = computed(() => normalizedActivity.value.size === 'default' ? 'large' : 'small');
const rootClass = computed(() => cn(
  'tw:flex tw:h-full tw:flex-row tw:overflow-hidden tw:font-lw-main',
  mode.value === 'large' ? 'is-large' : 'is-small'
));

const openDetailedView = (pluginId: string) => {
  currentDetailedView.value = pluginId;
};

const navItemClass = (isActive: boolean) => cn(
  'nav-item tw:mb-0.5 tw:flex tw:w-full tw:items-center tw:gap-2.5 tw:rounded-lw-md tw:border-0 tw:px-3 tw:py-2.5 tw:text-left tw:text-[length:var(--lw-type-label-large-size)] tw:font-[var(--lw-type-label-large-weight)] tw:leading-[var(--lw-type-label-large-line-height)] tw:tracking-[var(--lw-type-label-large-tracking)] tw:transition-[background-color,color,box-shadow] tw:duration-150 tw:ease-out',
  isActive
    ? 'active tw:bg-lw-selection tw:text-lw-text tw:shadow-lw'
    : 'tw:bg-transparent tw:text-lw-text-secondary tw:hover:bg-lw-hover tw:hover:text-lw-text'
);

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
.is-large {
  background: var(--lw-settings-large-bg, var(--lw-bg-app));
}

.is-small {
  background: var(--lw-settings-small-bg, color-mix(in srgb, var(--lw-bg-app) 96%, var(--lw-bg-elevated)));
}

.sidebar-header {
  background: var(--lw-settings-header-bg, transparent);
}

.nav-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.main-content-header {
  background: var(--lw-settings-header-bg, color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent));
}

.small-back-bar {
  background: var(--lw-settings-header-bg, color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent));
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

.lw-settings-root[data-skin-variant='telegram'] {
  --lw-settings-unified-padding: clamp(18px, 3vw, 32px);
  --lw-settings-detail-outer-padding: var(--lw-panel-padding);
  --lw-settings-detail-content-padding: 24px;
  background:
    var(--lw-settings-shell-overlay, radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--lw-primary) 12%, transparent), transparent 30%)),
    var(--lw-settings-shell-bg, var(--lw-bg-app));
}

.lw-settings-root[data-skin-variant='telegram']:not(.is-large) {
  --lw-settings-unified-padding: 12px;
  --lw-settings-detail-outer-padding: 12px;
  --lw-settings-detail-content-padding: 16px;
}

.lw-settings-root[data-skin-variant='telegram']:not(.is-large) .settings-scroll-area {
  padding: 0 12px 14px;
  box-sizing: border-box;
}

.lw-settings-root.is-small :deep(.settings-unified) {
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 12px 0;
}

.lw-settings-root.is-small :deep(.settings-detailed) {
  gap: 12px;
  padding: 12px 0;
}

.lw-settings-root.is-small :deep(.plugin-settings-block.lw-card),
.lw-settings-root.is-small :deep(.settings-detailed .block-content) {
  border-radius: 16px;
  box-shadow: none;
}

.lw-settings-root.is-small :deep(.block-header) {
  align-items: flex-start;
  gap: 10px;
  padding-bottom: 10px;
}

.lw-settings-root.is-small :deep(.sync-meta),
.lw-settings-root.is-small :deep(.scope-selector),
.lw-settings-root.is-small :deep(.dcc-paired-settings) {
  grid-template-columns: 1fr;
}

.lw-settings-root.is-small :deep(.setting-item) {
  padding: 12px 0;
}

.lw-settings-root.is-small :deep(.label-text) {
  min-width: 0;
}

.lw-settings-root.is-small :deep(.sync-actions),
.lw-settings-root.is-small :deep(.migration-actions) {
  flex-direction: column;
}

.lw-settings-root.is-small :deep(.sync-actions .lw-btn),
.lw-settings-root.is-small :deep(.migration-actions .lw-btn) {
  width: 100%;
}

.lw-settings-root[data-skin-variant='telegram']:not(.is-large) :deep(.settings-unified),
.lw-settings-root[data-skin-variant='telegram']:not(.is-large) :deep(.settings-detailed) {
  padding-left: 0;
  padding-right: 0;
}

.lw-settings-root[data-skin-variant='telegram'] .settings-sidebar {
  width: 256px;
  background: var(--lw-settings-sidebar-bg, color-mix(in srgb, var(--lw-surface-container-high) 72%, transparent));
  border-right-color: var(--lw-settings-sidebar-border, var(--lw-border-subtle));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
}

.lw-settings-root[data-skin-variant='telegram'] .sidebar-header,
.lw-settings-root[data-skin-variant='telegram'] .main-content-header,
.lw-settings-root[data-skin-variant='telegram'] .small-back-bar {
  background: var(--lw-settings-header-bg, color-mix(in srgb, var(--lw-surface-container-high) 70%, transparent));
  border-bottom-color: var(--lw-settings-header-border, var(--lw-border-subtle));
}

.lw-settings-root[data-skin-variant='telegram'] .nav-item {
  border: 1px solid transparent;
  border-radius: 16px;
}

.lw-settings-root[data-skin-variant='telegram'] .nav-item:hover {
  background: var(--lw-settings-nav-hover-bg, color-mix(in srgb, var(--lw-primary) 9%, transparent));
}

.lw-settings-root[data-skin-variant='telegram'] .nav-item.active {
  border-color: color-mix(in srgb, var(--lw-primary) 20%, var(--lw-border-subtle));
  background: var(--lw-settings-nav-active-bg, color-mix(in srgb, var(--lw-surface-container-high) 84%, transparent));
  box-shadow: var(--lw-settings-nav-active-shadow, 0 10px 24px rgba(44, 92, 130, 0.1));
}
</style>
