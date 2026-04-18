<template>
  <div class="settings-detailed" :style="detailSkinStyle">
    <div class="preview-container" v-if="plugin?.settingsPreviewComponent">
      <component :is="plugin.settingsPreviewComponent" :pluginId="pluginId" />
    </div>
    <div class="block-content" v-if="manifest && pluginId">
      <SettingControl v-for="key in Object.keys(manifest)" :key="key" :pluginId="pluginId" :settingKey="key"
        :config="manifest[key]" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import SettingControl from './SettingControl.vue';
import { useSettings } from './useSettings.js';
import { getSettingsEntry } from './settingsRegistry';
import { useComponentSkin } from '../../theme/useComponentSkin';

const props = defineProps({
  pluginId: String
});

const { initSettings } = useSettings();
const { cssVars } = useComponentSkin('settings.detailed');
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
  padding: var(--lw-panel-padding);
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
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-settings-detail-radius, 24px);
  padding: 24px;
  box-shadow: var(--lw-shadow-card);
}
</style>
