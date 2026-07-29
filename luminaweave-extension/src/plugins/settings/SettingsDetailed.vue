<template>
  <div
    class="settings-detailed tw:flex tw:flex-col tw:gap-[var(--lw-item-gap)] tw:bg-transparent tw:p-[var(--lw-settings-detail-outer-padding,var(--lw-panel-padding))]"
    :data-skin-variant="detailVariant || 'default'"
    :style="detailSkinStyle"
  >
    <div
      v-if="plugin?.settingsPreviewComponent"
      class="preview-container tw:sticky tw:top-0 tw:z-20 tw:mb-2 tw:flex tw:flex-col tw:border-b tw:border-lw-border tw:bg-lw-surface tw:px-0 tw:py-2.5"
    >
      <component :is="plugin.settingsPreviewComponent" :pluginId="pluginId" />
    </div>
    <div
      v-if="manifest && pluginId"
      class="block-content tw:flex tw:flex-col tw:rounded-[var(--lw-settings-detail-radius,24px)] tw:border tw:border-lw-border tw:bg-lw-elevated tw:p-[var(--lw-settings-detail-content-padding,24px)] tw:shadow-lw-card"
    >
      <SurfaceOutlet
        v-for="key in Object.keys(manifest)"
        :key="key"
        contract-id="settings.control"
        :input="createControlInput(pluginId, key, manifest[key])"
        :desktop-mode-id="props.desktopModeId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import SurfaceOutlet from '../../platform/surface/SurfaceOutlet.vue';
import type { SettingsControlSurfaceInput } from '../../platform/surface/officialContracts.js';
import { useSettings } from './useSettings.js';
import { getSettingsEntry } from './settingsRegistry.js';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import type { SettingDefinition } from '../../types/plugin.js';

const props = defineProps<{
  pluginId?: string;
  desktopModeId: string;
}>();

const createControlInput = (
  pluginId: string,
  settingKey: string,
  config: SettingDefinition
): SettingsControlSurfaceInput => ({ pluginId, settingKey, config });

const { initSettings } = useSettings();
const { cssVars, variant: detailVariant } = useSurfaceSkin('settings.detailed');
const detailSkinStyle = computed(() => cssVars.value);

onMounted(() => {
  initSettings();
});

const plugin = computed(() => {
  if (!props.pluginId) return null;
  return getSettingsEntry(props.pluginId);
});

const manifest = computed(() => {
  return plugin.value?.manifest;
});
</script>

<style scoped>
.settings-detailed[data-skin-variant='telegram'] .preview-container,
.settings-detailed[data-skin-variant='telegram'] .block-content {
  border-color: var(--lw-settings-detail-border, var(--lw-border-subtle));
  background: var(--lw-settings-detail-bg, color-mix(in srgb, var(--lw-surface-container-high) 78%, transparent));
  box-shadow: var(--lw-settings-detail-shadow, var(--lw-telegram-panel-shadow, var(--lw-shadow-card)));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
}
</style>
