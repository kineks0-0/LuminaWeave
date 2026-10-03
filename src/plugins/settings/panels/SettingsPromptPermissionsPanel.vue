<template>
  <SettingsSectionPanel>
    <SettingsBlockHeader title="插件提示词注入">
      <template #icon>
        <ShieldCheck :size="18" :stroke-width="2" aria-hidden="true" />
      </template>
    </SettingsBlockHeader>
    <div class="tw:flex tw:flex-col tw:gap-2 tw:pt-3">
      <SettingsDescription>关闭后，该插件不再向提示词注入内容。</SettingsDescription>
      <SettingsInsetPanel
        v-for="permission in permissions"
        :key="permission.id"
        interactive
        class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:px-3.5 tw:py-2.5"
      >
        <span class="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
          <span class="prompt-permission__icon tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:text-lw-text-muted" aria-hidden="true" v-html="permission.icon"></span>
          <span class="tw:min-w-0 tw:truncate tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:text-lw-text">{{ permission.name }}</span>
        </span>
        <LuminaToggle
          :modelValue="permission.enabled"
          :aria-label="`${permission.name} 提示词注入`"
          @update:modelValue="value => updatePermission(permission.id, value)"
        />
      </SettingsInsetPanel>
    </div>
  </SettingsSectionPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ShieldCheck } from 'lucide-vue-next';
import { pluginManager } from '../../../core/PluginManager.js';
import { LuminaToggle } from '../../../ui/primitives';
import { SettingsBlockHeader, SettingsDescription, SettingsInsetPanel, SettingsSectionPanel } from '../components';
import { activeSettings, useSettings } from '../useSettings.js';

const { updateSetting } = useSettings();

const permissionKey = (pluginId: string): string => `lumina-settings.plugins.${pluginId}.promptEnabled`;

const permissions = computed(() => {
  void pluginManager.registrationVersion.value;
  return Object.values(pluginManager.plugins)
    .filter(plugin => plugin.id !== 'lumina-settings')
    .map(plugin => {
      const stored = activeSettings[permissionKey(plugin.id)];
      return {
        id: plugin.id,
        name: plugin.name,
        icon: plugin.icon,
        enabled: typeof stored === 'boolean' ? stored : pluginManager.isPluginPromptEnabled(plugin.id)
      };
    });
});

const updatePermission = (pluginId: string, enabled: boolean): void => {
  void updateSetting(permissionKey(pluginId), enabled);
};
</script>

<style scoped>
.prompt-permission__icon :deep(svg) {
  width: 14px;
  height: 14px;
}
</style>
