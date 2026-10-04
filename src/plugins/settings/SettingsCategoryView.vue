<template>
  <div
    ref="rootElement"
    class="settings-category tw:flex tw:flex-col tw:gap-[var(--lw-item-gap)] tw:p-[var(--lw-settings-detail-outer-padding,var(--lw-panel-padding))]"
    :data-skin-variant="categoryVariant || 'default'"
    :style="categorySkinStyle"
  >
    <header class="settings-category__header">
      <div class="tw:min-w-0">
        <h2 class="settings-category__title">{{ category.label }}</h2>
        <p class="settings-category__summary">{{ category.description }}</p>
      </div>
      <div class="settings-category__actions">
        <label v-if="hasAdvanced" class="settings-category__advanced">
          <span>显示高级选项</span>
          <LuminaToggle v-model="showAdvanced" aria-label="显示高级选项" />
        </label>
        <LuminaButton variant="ghost" size="sm" :disabled="modifiedSettings.length === 0" @click="resetCategory">
          <RotateCcw :size="14" :stroke-width="2" aria-hidden="true" />
          恢复本页默认
        </LuminaButton>
      </div>
    </header>

    <div
      v-for="panel in categoryPanels"
      :key="panel.id"
      class="settings-category__anchor"
      :class="{ 'is-highlighted': highlightedAnchor === `panel:${panel.id}` }"
      :data-setting-anchor="`panel:${panel.id}`"
    >
      <component :is="SETTINGS_PANEL_COMPONENTS[panel.id]" />
    </div>

    <SettingsSectionPanel v-for="group in visibleGroups" :key="group.label">
      <SettingsBlockHeader :title="group.label" />
      <div class="tw:flex tw:flex-col">
        <div
          v-for="item in group.settings"
          :key="item.storageKey"
          class="settings-category__row"
          :class="{ 'is-highlighted': highlightedAnchor === item.storageKey }"
          :data-setting-anchor="item.storageKey"
        >
          <SurfaceOutlet
            contract-id="settings.control"
            :input="createControlInput(item)"
            :desktop-mode-id="props.desktopModeId"
          />
        </div>
      </div>
    </SettingsSectionPanel>

    <SettingsSectionPanel
      v-for="plugin in categoryPluginEntries"
      :key="plugin.pluginId"
      class="settings-category__anchor"
      :data-setting-anchor="`plugin:${plugin.pluginId}`"
    >
      <SettingsBlockHeader :title="plugin.pluginName" />
      <div class="tw:flex tw:flex-col tw:gap-4 tw:pt-3">
        <ThemedSurfaceOutlet
          v-if="plugin?.settingsPreviewSurface"
          :contract-id="plugin.settingsPreviewSurface.contractId"
          :input="plugin.settingsPreviewSurface.input"
          :desktop-mode-id="props.desktopModeId"
        />
        <component
          :is="plugin.settingsPreviewComponent"
          v-else-if="plugin?.settingsPreviewComponent"
          :pluginId="plugin.pluginId"
        />
        <!-- 内嵌摘要只在插件没有完整设置组件时显示 -->
        <component :is="plugin.settingsInlineComponent" v-else-if="plugin.settingsInlineComponent" />
      </div>
    </SettingsSectionPanel>

    <p v-if="isEmpty" class="settings-category__empty">
      {{ hasAdvanced ? '这一页只有高级选项，打开右上角的“显示高级选项”查看。' : '这一页暂时没有设置项。' }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { RotateCcw } from 'lucide-vue-next';
import SurfaceOutlet from '../../platform/surface/SurfaceOutlet.vue';
import ThemedSurfaceOutlet from '../../platform/surface/ThemedSurfaceOutlet.vue';
import type { SettingsControlSurfaceInput } from '../../platform/surface/officialContracts.js';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import { useModalStore } from '../../stores/useModalStore.js';
import type { SettingsCategoryId } from '../../types/plugin.js';
import { LuminaButton, LuminaToggle } from '../../ui/primitives';
import { SettingsBlockHeader, SettingsSectionPanel } from './components';
import { isSettingAtDefault, isSettingVisible } from './settingControlModel.js';
import { SETTINGS_PANEL_COMPONENTS } from './settingsPanels.js';
import {
  SETTINGS_PANELS,
  getSettingsCategory,
  groupCategorySettings,
  type CategorizedSetting
} from './settingsTaxonomy.js';
import { pendingSettingsAnchor, showAdvancedByCategory } from './settingsViewState.js';
import { activeSettings, useSettings } from './useSettings.js';
import { useSettingsCatalog } from './useSettingsCatalog.js';

const props = defineProps<{
  categoryId: SettingsCategoryId;
  desktopModeId: string;
}>();

const HIGHLIGHT_MS = 1800;

const { resetSetting } = useSettings();
const { categoryIndex, pluginComponentEntries } = useSettingsCatalog();
const { cssVars, variant: categoryVariant } = useSurfaceSkin('settings.detailed');
const categorySkinStyle = computed(() => cssVars.value);

const rootElement = ref<HTMLElement | null>(null);
const highlightedAnchor = ref<string | null>(null);
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

const category = computed(() => getSettingsCategory(props.categoryId));
const categorySettings = computed(() => categoryIndex.value[props.categoryId]);
const hasAdvanced = computed(() => categorySettings.value.some(item => item.advanced));

const showAdvanced = computed({
  get: () => showAdvancedByCategory[props.categoryId] === true,
  set: (value: boolean) => { showAdvancedByCategory[props.categoryId] = value; }
});

const visibleGroups = computed(() => groupCategorySettings(
  categorySettings.value.filter(item =>
    (showAdvanced.value || !item.advanced) && isSettingVisible(item.definition, activeSettings))
));

const categoryPanels = computed(() => SETTINGS_PANELS.filter(panel => panel.category === props.categoryId));

const categoryPluginEntries = computed(() => {
  // isEnabled() 读取的是存储值，先读一遍响应式设置以便开关变化后重新计算
  Object.keys(activeSettings).forEach(key => void activeSettings[key]);
  return pluginComponentEntries.value
    .filter(item => item.categoryId === props.categoryId && item.entry.isEnabled())
    .map(item => item.entry);
});

const isEmpty = computed(() =>
  visibleGroups.value.length === 0 && categoryPanels.value.length === 0 && categoryPluginEntries.value.length === 0);

const modifiedSettings = computed(() => categorySettings.value.filter(item =>
  !isSettingAtDefault(activeSettings[item.storageKey], item.definition.default)));

const createControlInput = (item: CategorizedSetting): SettingsControlSurfaceInput => ({
  pluginId: item.pluginId,
  settingKey: item.settingKey,
  config: item.definition
});

const resetCategory = async (): Promise<void> => {
  const targets = modifiedSettings.value;
  if (targets.length === 0) return;
  const confirmed = await useModalStore().confirm({
    title: `恢复「${category.value.label}」默认值`,
    message: `${targets.length} 项设置会改回默认值（包括未展开的高级选项），按各自当前的作用域写入。`,
    confirmText: '恢复默认',
    danger: true
  });
  if (!confirmed) return;
  await Promise.all(targets.map(item => resetSetting(item.storageKey, item.definition)));
};

const revealAnchor = async (anchor: string): Promise<void> => {
  const target = categorySettings.value.find(item => item.storageKey === anchor);
  if (target?.advanced) showAdvanced.value = true;
  await nextTick();
  const element = rootElement.value?.querySelector<HTMLElement>(`[data-setting-anchor="${CSS.escape(anchor)}"]`);
  element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  highlightedAnchor.value = anchor;
  if (highlightTimer) clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => { highlightedAnchor.value = null; }, HIGHLIGHT_MS);
};

watch(
  () => [pendingSettingsAnchor.value, props.categoryId] as const,
  ([anchor]) => {
    if (!anchor) return;
    pendingSettingsAnchor.value = null;
    void revealAnchor(anchor);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (highlightTimer) clearTimeout(highlightTimer);
});
</script>

<style scoped>
.settings-category__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 24px;
  padding: 4px 4px 8px;
}

.settings-category__title {
  margin: 0;
  color: var(--lw-text-main);
  font-family: var(--lw-font-display);
  font-size: var(--lw-type-headline-small-size, var(--lw-type-title-large-size));
  font-weight: var(--lw-type-headline-small-weight, var(--lw-type-title-large-weight));
  line-height: var(--lw-type-headline-small-line-height, var(--lw-type-title-large-line-height));
  letter-spacing: var(--lw-type-headline-small-tracking, var(--lw-type-title-large-tracking));
}

.settings-category__summary {
  margin: 4px 0 0;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
}

.settings-category__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.settings-category__advanced {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  cursor: pointer;
}

.settings-category__row {
  transition: background-color 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.settings-category__row + .settings-category__row {
  border-top: 1px solid var(--lw-border-base);
}

.settings-category__row.is-highlighted,
.settings-category__anchor.is-highlighted {
  background: color-mix(in srgb, var(--lw-primary) 10%, transparent);
}

.settings-category__anchor {
  border-radius: 24px;
  transition: background-color 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.settings-category__empty {
  margin: 0;
  padding: 32px 16px;
  color: var(--lw-text-muted);
  text-align: center;
}


</style>
