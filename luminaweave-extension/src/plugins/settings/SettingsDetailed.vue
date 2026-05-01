<template>
  <div class="settings-detailed" :data-skin-variant="detailVariant || 'default'" :style="detailSkinStyle">
    <div class="preview-container" v-if="plugin?.settingsPreviewComponent">
      <component :is="plugin.settingsPreviewComponent" :pluginId="pluginId" />
    </div>
    <div class="block-content" v-if="manifest && pluginId">
      <SurfaceOutlet contract-id="settings.control" v-for="key in Object.keys(manifest)" :key="key" :pluginId="pluginId" :settingKey="key"
        :config="manifest[key]" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import SurfaceOutlet from '../../platform/surface/SurfaceOutlet.vue';
import { useSettings } from './useSettings.js';
import { getSettingsEntry } from './settingsRegistry';
import { useComponentSkin } from '../../theme/useComponentSkin';

const props = defineProps({
  pluginId: String
});

const { initSettings } = useSettings();
const { cssVars, variant: detailVariant } = useComponentSkin('settings.detailed');
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
.settings-detailed {
  padding: var(--lw-settings-detail-outer-padding, var(--lw-panel-padding));
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: var(--lw-item-gap);
}

.preview-container {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
  position: sticky;
  /* 对齐 top: -24px;padding */
  z-index: 100;
  background: var(--lw-bg-app);
  padding: 10px 0;
  border-bottom: 1px solid var(--lw-border-base);
}

.block-content {
  display: flex;
  flex-direction: column;
  background: var(--lw-settings-detail-bg, color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent));
  border: 1px solid var(--lw-settings-detail-border, var(--lw-border-base));
  border-radius: var(--lw-settings-detail-radius, 24px);
  padding: var(--lw-settings-detail-content-padding, 24px);
  box-shadow: var(--lw-settings-detail-shadow, var(--lw-shadow-card));
}

.settings-detailed[data-skin-variant='telegram'] .preview-container,
.settings-detailed[data-skin-variant='telegram'] .block-content {
  border-color: var(--lw-settings-detail-border, var(--lw-border-subtle));
  background: var(--lw-settings-detail-bg, color-mix(in srgb, var(--lw-surface-container-high) 78%, transparent));
  box-shadow: var(--lw-settings-detail-shadow, var(--lw-telegram-panel-shadow, var(--lw-shadow-card)));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
}
</style>
