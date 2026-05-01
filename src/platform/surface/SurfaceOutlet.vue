<template>
  <component
    :is="resolved.renderer.component"
    v-bind="componentProps"
  />
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { activeSettings } from '../../plugins/settings/useSettings';
import { getActiveDesktopModeIdFromSettings } from '../../theme/themeRegistry';
import { surfaceRegistry } from './SurfaceRegistry';
import type { SurfaceContractId, SurfaceRuntimeContext, SurfaceThemeContext } from './types';

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

const runtimeContext = computed<SurfaceRuntimeContext>(() => ({
  state: props.state,
  intents: props.intents,
  theme: themeContext.value
}));

const componentProps = computed(() => ({
  ...attrs,
  contractId: props.contractId,
  state: props.state,
  intents: props.intents,
  theme: themeContext.value,
  runtimeContext: runtimeContext.value,
  rendererSource: resolved.value.source,
  ...(props.containerProps || {})
}));
</script>
