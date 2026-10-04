<template>
  <div
    class="settings-overview tw:flex tw:flex-col tw:gap-[var(--lw-item-gap)] tw:p-[var(--lw-settings-unified-padding,var(--lw-panel-padding))]"
    :data-skin-variant="overviewVariant || 'default'"
    :style="overviewSkinStyle"
  >
    <header class="settings-overview__header">
      <h2 class="settings-overview__title">常用设置</h2>
      <p class="settings-overview__summary">其余设置按用途分在各个分类里，也可以直接搜索。</p>
    </header>

    <SettingsSectionPanel>
      <div class="settings-overview__rows">
        <div v-for="item in overviewSettings" :key="item.storageKey" class="settings-overview__row">
          <SurfaceOutlet
            contract-id="settings.control"
            :input="{ pluginId: item.pluginId, settingKey: item.settingKey, config: item.definition }"
            :desktop-mode-id="props.desktopModeId"
          />
        </div>
      </div>
    </SettingsSectionPanel>

    <button type="button" class="settings-overview__sync" @click="openSettingsCategory('storage', 'panel:sync-status')">
      <span class="settings-overview__sync-dot" :data-status="syncState.status" aria-hidden="true"></span>
      <span class="tw:min-w-0 tw:flex-1 tw:truncate">
        同步：{{ statusLabel }}<template v-if="diffCount > 0">，{{ diffCount }} 项差异待处理</template>
      </span>
      <ChevronRight :size="16" :stroke-width="2" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronRight } from 'lucide-vue-next';
import SurfaceOutlet from '../../platform/surface/SurfaceOutlet.vue';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import { SettingsSectionPanel } from './components';
import { SETTINGS_CATEGORIES, OVERVIEW_SETTING_KEYS, type CategorizedSetting } from './settingsTaxonomy.js';
import { openSettingsCategory } from './settingsViewState.js';
import { useSettingsCatalog } from './useSettingsCatalog.js';
import { useSettingsSyncStatus } from './panels/useSettingsSyncStatus.js';

const props = defineProps<{
  desktopModeId: string;
}>();

const { categoryIndex } = useSettingsCatalog();
const { syncState, diffCount, statusLabel } = useSettingsSyncStatus();
const { cssVars, variant: overviewVariant } = useSurfaceSkin('settings.unified');
const overviewSkinStyle = computed(() => cssVars.value);

const overviewSettings = computed(() => {
  const byKey = new Map<string, CategorizedSetting>();
  SETTINGS_CATEGORIES.forEach(category => {
    categoryIndex.value[category.id].forEach(item => byKey.set(item.storageKey, item));
  });
  return OVERVIEW_SETTING_KEYS
    .map(key => byKey.get(key))
    .filter((item): item is CategorizedSetting => item !== undefined);
});
</script>

<style scoped>
.settings-overview__header {
  padding: 4px 4px 8px;
}

.settings-overview__title {
  margin: 0;
  color: var(--lw-text-main);
  font-family: var(--lw-font-display);
  font-size: var(--lw-type-headline-small-size, var(--lw-type-title-large-size));
  font-weight: var(--lw-type-headline-small-weight, var(--lw-type-title-large-weight));
  line-height: var(--lw-type-headline-small-line-height, var(--lw-type-title-large-line-height));
}

.settings-overview__summary {
  margin: 4px 0 0;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
}

.settings-overview__rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-overview__sync {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--lw-radius-xs);
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
  color: var(--lw-text-secondary);
  font: inherit;
  font-size: var(--lw-type-body-medium-size);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--lw-transition), color var(--lw-transition);
}

.settings-overview__sync:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.settings-overview__sync-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--lw-text-muted);
}

.settings-overview__sync-dot[data-status='success'] {
  background: var(--lw-success, var(--lw-primary));
}

.settings-overview__sync-dot[data-status='syncing'] {
  background: var(--lw-primary);
}

.settings-overview__sync-dot[data-status='error'] {
  background: var(--lw-danger);
}
</style>
