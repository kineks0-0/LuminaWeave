<template>
  <div
    class="lw-settings-root"
    :class="rootClass"
    :data-skin-variant="settingsVariant || 'default'"
    :style="settingsSkinStyle"
  >
    <!-- 大窗口：左侧搜索 + 分类导航 -->
    <aside v-if="mode === 'large'" class="settings-sidebar tw:flex tw:w-60 tw:shrink-0 tw:flex-col tw:border-r tw:border-lw-border tw:bg-lw-elevated/90">
      <div class="sidebar-header tw:px-5 tw:pb-3 tw:pt-[22px]">
        <h3 class="tw:m-0 tw:font-lw-display tw:text-[length:var(--lw-type-title-large-size)] tw:font-[var(--lw-type-title-large-weight)] tw:leading-[var(--lw-type-title-large-line-height)] tw:tracking-[var(--lw-type-title-large-tracking)] tw:text-lw-text">设置</h3>
      </div>
      <SettingsNavigation
        class="sidebar-nav tw:flex-1 tw:overflow-y-auto tw:px-3 tw:pb-3"
        layout="sidebar"
        :active-route="activeRoute"
        @navigate="navigate"
        @open-result="openSearchResult"
      />
    </aside>

    <div class="settings-main-container tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
      <div v-if="mode === 'small' && view.kind !== 'home'" class="small-back-bar tw:sticky tw:top-0 tw:z-20 tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-lw-border tw:px-3.5 tw:py-2.5">
        <LuminaButton variant="ghost" size="sm" tone="primary" @click="navigate(null)">
          <ChevronLeft :size="16" :stroke-width="2.5" aria-hidden="true" />
          <span>设置</span>
        </LuminaButton>
        <span class="small-back-title tw:min-w-0 tw:truncate tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">{{ viewTitle }}</span>
      </div>
      <div
        ref="scrollArea"
        class="settings-scroll-area tw:relative tw:flex-1 tw:overflow-y-auto"
        :class="mode !== 'large' && 'tw:box-border tw:px-3 tw:pb-3.5'"
        @wheel.stop
      >
        <div v-if="mode === 'small' && view.kind === 'home'" class="settings-home tw:flex tw:flex-col tw:gap-4 tw:pb-6 tw:pt-[calc(16px+var(--lw-content-safe-top,0px))]">
          <h2 class="settings-home__title">设置</h2>
          <SettingsNavigation
            layout="page"
            :active-route="null"
            @navigate="navigate"
            @open-result="openSearchResult"
          />
        </div>
        <SettingsCategoryView
          v-else-if="view.kind === 'category'"
          :category-id="view.categoryId"
          :desktop-mode-id="surfaceContext.theme.desktopModeId"
        />
        <SettingsOverview v-else :desktop-mode-id="surfaceContext.theme.desktopModeId" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ChevronLeft } from 'lucide-vue-next';
import SettingsCategoryView from './SettingsCategoryView.vue';
import SettingsNavigation from './SettingsNavigation.vue';
import SettingsOverview from './SettingsOverview.vue';
import { currentDetailedView, useSettings } from './useSettings.js';
import { useSettingsCatalog } from './useSettingsCatalog.js';
import { SETTINGS_OVERVIEW_ROUTE, getSettingsCategory } from './settingsTaxonomy.js';
import { openSettingsCategory, pendingSettingsAnchor } from './settingsViewState.js';
import type { SettingsSearchResult } from './settingsSearch.js';
import { activityFromLegacyMode, normalizeActivityDescriptor } from '../../platform/activity/activityLaunchResolver.js';
import { useSurfaceInput, useSurfaceRuntimeContext } from '../../platform/surface/useSurfaceRuntimeContext.js';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import { cn } from '../../ui/cn.js';
import { LuminaButton } from '../../ui/primitives';

const props = useSurfaceInput('settings.root');
const surfaceContext = useSurfaceRuntimeContext('settings.root');

const { initSettings } = useSettings();
const { view } = useSettingsCatalog();
const { cssVars, variant: settingsVariant } = useSurfaceSkin('settings.root');
const settingsSkinStyle = computed(() => cssVars.value);
const normalizedActivity = computed(() => normalizeActivityDescriptor(
  props.activity,
  activityFromLegacyMode(props.mode === 'large' || props.mode === 'small' ? props.mode : undefined)
));
const mode = computed(() => normalizedActivity.value.size === 'default' ? 'large' : 'small');
const rootClass = computed(() => cn(
  'tw:flex tw:h-full tw:flex-row tw:overflow-hidden tw:font-lw-main',
  mode.value === 'large' ? 'is-large' : 'is-small'
));

const scrollArea = ref<HTMLElement | null>(null);

/** 侧栏高亮：首页在大窗等同于概览 */
const activeRoute = computed(() => (view.value.kind === 'category' ? view.value.categoryId : SETTINGS_OVERVIEW_ROUTE));

const viewTitle = computed(() => (view.value.kind === 'category' ? getSettingsCategory(view.value.categoryId).label : '常用设置'));

const navigate = (route: string | null): void => {
  currentDetailedView.value = route;
};

const openSearchResult = (result: SettingsSearchResult): void => {
  openSettingsCategory(result.categoryId, result.anchor);
};

// 切换页面时回到顶部；搜索跳转由分类页自行滚动到目标行
watch(currentDetailedView, () => {
  // 页面切换的内容已替换，回顶必须瞬时，避免全局平滑滚动把新页面从中间滚上来。
  if (!pendingSettingsAnchor.value && scrollArea.value) {
    scrollArea.value.scrollTo({ top: 0, behavior: 'instant' });
  }
});

onMounted(initSettings);
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

.settings-home__title {
  margin: 0 4px;
  color: var(--lw-text-main);
  font-family: var(--lw-font-display);
  font-size: var(--lw-type-headline-small-size, var(--lw-type-title-large-size));
  font-weight: var(--lw-type-headline-small-weight, var(--lw-type-title-large-weight));
  line-height: var(--lw-type-headline-small-line-height, var(--lw-type-title-large-line-height));
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







.lw-settings-root.is-small :deep(.settings-overview),
.lw-settings-root.is-small :deep(.settings-category) {
  gap: 12px;
  padding: 12px 0;
}

.lw-settings-root.is-small :deep(.plugin-settings-block.lw-card) {
  border-radius: 16px;
  box-shadow: none;
}

.lw-settings-root.is-small :deep(.block-header) {
  align-items: flex-start;
  gap: 10px;
  padding-bottom: 10px;
}








</style>
