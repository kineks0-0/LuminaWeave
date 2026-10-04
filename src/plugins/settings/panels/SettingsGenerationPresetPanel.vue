<template>
  <SettingsSectionPanel>
    <SettingsBlockHeader title="生成引擎">
      <template #icon>
        <Cpu :size="18" :stroke-width="2" aria-hidden="true" />
      </template>
    </SettingsBlockHeader>
    <div class="tw:flex tw:flex-col tw:gap-2.5 tw:pt-3">
      <SettingsDescription>选择聊天生成时使用的提示词引擎。自动模式在无 ST 宿主时使用 Lumina 合成。</SettingsDescription>
      <LuminaSelect v-model="engine" aria-label="生成引擎" @update:modelValue="saveEngine">
        <option value="auto">自动（有 ST 用原生，无 ST 用 Lumina 合成）</option>
        <option value="lumina-assembly">Lumina 合成（预设库 / 正则 / 世界书）</option>
      </LuminaSelect>
      <p class="tw:m-0 tw:text-[length:var(--lw-type-body-small-size)] tw:text-lw-text-muted">
        提示词预设、正则脚本可在“提示词预设库”和“正则脚本”面板管理。
      </p>
    </div>
  </SettingsSectionPanel>

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
import { Cpu, RefreshCw, SlidersHorizontal } from 'lucide-vue-next';
import { LuminaIconButton, LuminaSelect } from '../../../ui/primitives';
import { SettingsBlockHeader, SettingsDescription, SettingsSectionPanel } from '../components';
import { getSettingsHostApi } from '../settingsHost.js';
import { lwStorage } from '../../../api/storage.js';
import { CHAT_PROMPT_ENGINE_STORAGE_KEY } from '../../../api/core/hal/prompt/ChatPromptCompositionService.js';

const currentApi = ref('unknown');
const presets = ref<string[]>([]);
const activePreset = ref('');
const engine = ref('auto');

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

const saveEngine = (value: string): void => {
  void lwStorage.set(CHAT_PROMPT_ENGINE_STORAGE_KEY, value, 'Global');
};

onMounted(() => {
  const stored = lwStorage.get(CHAT_PROMPT_ENGINE_STORAGE_KEY, 'auto', 'Global');
  engine.value = typeof stored === 'string' && stored ? stored : 'auto';
  refresh();
});
</script>
