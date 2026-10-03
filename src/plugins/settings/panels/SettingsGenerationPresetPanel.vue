<template>
  <SettingsSectionPanel v-if="presets.length > 0">
    <SettingsBlockHeader title="全局生成参数">
      <template #icon>
        <SlidersHorizontal :size="18" :stroke-width="2" aria-hidden="true" />
      </template>
      <template #actions>
        <LuminaIconButton ariaLabel="重新读取生成参数预设" title="重新读取" size="sm" @click="refresh">
          <RefreshCw :size="14" :stroke-width="2" aria-hidden="true" />
        </LuminaIconButton>
      </template>
    </SettingsBlockHeader>
    <div class="tw:flex tw:flex-col tw:gap-2.5 tw:pt-3">
      <SettingsDescription>SillyTavern 当前 API（{{ currentApi }}）使用的生成参数预设。</SettingsDescription>
      <LuminaSelect v-model="activePreset" aria-label="全局生成参数预设" @update:modelValue="selectPreset">
        <option v-for="preset in presets" :key="preset" :value="preset">{{ preset }}</option>
      </LuminaSelect>
    </div>
  </SettingsSectionPanel>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RefreshCw, SlidersHorizontal } from 'lucide-vue-next';
import { LuminaIconButton, LuminaSelect } from '../../../ui/primitives';
import { SettingsBlockHeader, SettingsDescription, SettingsSectionPanel } from '../components';
import { getSettingsHostApi } from '../settingsHost.js';

const currentApi = ref('unknown');
const presets = ref<string[]>([]);
const activePreset = ref('');

const detectCurrentApi = (): string => {
  if (typeof window.main_api === 'string' && window.main_api) return window.main_api;
  const selected = typeof window.$ === 'function' ? window.$('#main_api').val() : undefined;
  return typeof selected === 'string' && selected ? selected : 'unknown';
};

const refresh = (): void => {
  const host = getSettingsHostApi();
  if (!host) return;
  currentApi.value = detectCurrentApi();
  presets.value = host.getPresets(currentApi.value) ?? [];
  activePreset.value = host.getActivePresetName(currentApi.value) ?? '';
};

const selectPreset = (name: string): void => {
  getSettingsHostApi()?.selectPreset(currentApi.value, name);
};

onMounted(refresh);
</script>
