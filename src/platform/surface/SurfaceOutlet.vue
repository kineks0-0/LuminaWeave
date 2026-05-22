<template>
  <component
    :is="resolved.renderer.component"
    v-bind="componentProps"
  />
</template>

<script setup lang="ts">
import { computed, provide, useAttrs } from 'vue';
import { lwStorage } from '../../api/storage.js';
import { settingsDomainService } from '../../api/services/SettingsDomainService.js';
import { activeSettings } from '../../plugins/settings/useSettings.js';
import { getActiveDesktopModeIdFromSettings } from '../../theme/themeRegistry.js';
import { surfaceRegistry } from './SurfaceRegistry.js';
import type { SurfaceContractId, SurfaceRendererRuntimeBridge, SurfaceRuntimeContext, SurfaceThemeContext } from './types.js';

const props = withDefaults(defineProps<{
  contractId: SurfaceContractId;
  desktopModeId?: string;
  state?: unknown;
  intents?: Record<string, unknown>;
  variant?: string;
  tokens?: Record<string, string | number>;
  cssVars?: Record<string, string | number>;
  containerProps?: Record<string, unknown>;
}>(), {
  state: undefined,
  intents: () => ({})
});
const attrs = useAttrs();

const effectiveDesktopModeId = computed(() =>
  props.desktopModeId || getActiveDesktopModeIdFromSettings(activeSettings)
);

const resolved = computed(() => surfaceRegistry.resolve({
  contractId: props.contractId,
  desktopModeId: effectiveDesktopModeId.value,
  preferredVariant: props.variant
}));

const themeContext = computed<SurfaceThemeContext>(() => ({
  desktopModeId: effectiveDesktopModeId.value,
  variant: props.variant || resolved.value.renderer.variant,
  tokens: props.tokens,
  cssVars: props.cssVars,
  containerProps: props.containerProps
}));

const rendererRuntime: SurfaceRendererRuntimeBridge = {
  getSetting: (key, fallback) => {
    const trackedValue = activeSettings[key];
    return trackedValue !== undefined && trackedValue !== null
      ? trackedValue
      : lwStorage.get(key, fallback);
  },
  updateSetting: (key, value) => {
    activeSettings[key] = value;
    return settingsDomainService.setSetting(key, value, 'Global');
  },
  openSurface: (contractId, surfaceProps = {}) => {
    const lw = typeof window !== 'undefined' ? (window as any).LuminaWeave : null;
    const desktopSurface = lw?.services?.desktopSurface || lw?.desktopSurface;
    if (desktopSurface && typeof desktopSurface.openTab === 'function') {
      desktopSurface.openTab({
        id: contractId,
        name: String(contractId),
        icon: '',
        surfaceContractId: contractId,
        props: surfaceProps
      });
    }
  }
};

const runtimeContext = computed<SurfaceRuntimeContext>(() => ({
  ...(resolved.value.renderer.createContext?.(rendererRuntime) || {
    state: props.state,
    intents: props.intents,
    theme: themeContext.value
  }),
  theme: themeContext.value
}));

provide('lwSurfaceRuntimeContext', runtimeContext);

const componentProps = computed(() => ({
  ...attrs,
  ...(resolved.value.source === 'empty' ? { contractId: props.contractId } : {}),
  ...(props.containerProps || {})
}));
</script>
