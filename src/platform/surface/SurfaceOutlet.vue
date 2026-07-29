<template>
  <SurfaceFailure
    v-if="nodeError"
    :contract-id="props.contractId"
  />
  <SurfaceRendererBoundary
    v-else-if="resolution"
    :key="surfaceRevision"
    :contract-id="props.contractId"
    :owner-id="resolution.renderer.ownerId"
    @renderer-failed="handleRendererFailure"
  >
    <component
      :is="resolution.renderer.component"
      v-if="activeSurface && resolution.source !== 'empty'"
    />
    <component
      :is="resolution.renderer.component"
      v-else-if="activeSurface"
      :contract-id="props.contractId"
    />
  </SurfaceRendererBoundary>
</template>

<script setup lang="ts" generic="K extends SurfaceContractId">
import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  ref,
  shallowRef,
  watch
} from 'vue';
import { desktopExperienceRuntimeKey } from '../../composables/useDesktopExperienceRuntime.js';
import { createSurfaceRuntimeContext, type CreatedSurfaceRuntimeContext } from './createSurfaceRuntimeContext.js';
import SurfaceFailure from './SurfaceFailure.vue';
import SurfaceRendererBoundary from './SurfaceRendererBoundary.vue';
import { SurfaceRegistryError, surfaceRegistry } from './SurfaceRegistry.js';
import { surfaceRuntimeContextKey } from './useSurfaceRuntimeContext.js';
import { isSurfaceValueEquivalent } from './surfaceValueEquality.js';
import type {
  SurfaceContractId,
  SurfaceInput,
  SurfaceResolutionResult,
  SurfaceRuntimeContext,
  SurfaceThemeContext
} from './types.js';

defineOptions({
  inheritAttrs: false
});

const props = defineProps<{
  contractId: K;
  input: SurfaceInput<K>;
  desktopModeId: string;
  variant?: string;
  tokens?: Record<string, string | number>;
  cssVars?: Record<string, string | number>;
}>();

const runtime = inject(desktopExperienceRuntimeKey, null);
const activeSurface = shallowRef<CreatedSurfaceRuntimeContext<K> | null>(null);
const resolution = shallowRef<SurfaceResolutionResult<K> | null>(null);
const activeInput = shallowRef<SurfaceInput<K> | null>(null);
const activeTheme = shallowRef<SurfaceThemeContext | null>(null);
const surfaceRevision = ref(0);
const nodeError = shallowRef<'runtime-unavailable' | 'registry' | 'context'>();

const providedContext = computed<SurfaceRuntimeContext<SurfaceContractId> | null>(() =>
  activeSurface.value?.context as SurfaceRuntimeContext<SurfaceContractId> | null
);
provide(surfaceRuntimeContextKey, providedContext);

const disposeActiveSurface = (): void => {
  activeSurface.value?.dispose();
  activeSurface.value = null;
  activeInput.value = null;
  activeTheme.value = null;
};

const handleRendererFailure = (): void => {
  disposeActiveSurface();
};

const rebuildSurface = (): void => {
  nodeError.value = undefined;

  if (!runtime) {
    disposeActiveSurface();
    resolution.value = null;
    nodeError.value = 'runtime-unavailable';
    console.error('[SurfaceRuntime] Surface unavailable', {
      code: nodeError.value,
      contractId: props.contractId
    });
    return;
  }

  try {
    const parsedInput = surfaceRegistry.parseInput(props.contractId, props.input);
    const resolved = surfaceRegistry.resolve({
      contractId: props.contractId,
      desktopModeId: props.desktopModeId,
      preferredVariant: props.variant
    });
    const theme: SurfaceThemeContext = {
      desktopModeId: props.desktopModeId,
      variant: props.variant || resolved.renderer.variant,
      tokens: props.tokens,
      cssVars: props.cssVars
    };
    const currentRenderer = resolution.value?.renderer;
    if (
      activeSurface.value
      && currentRenderer === resolved.renderer
      && isSurfaceValueEquivalent(activeInput.value, parsedInput)
      && isSurfaceValueEquivalent(activeTheme.value, theme)
    ) {
      return;
    }

    disposeActiveSurface();
    resolution.value = resolved;
    const contract = surfaceRegistry.getContract(props.contractId);
    const nextSurface = createSurfaceRuntimeContext({
      contractId: props.contractId,
      input: parsedInput,
      renderer: resolved.renderer,
      runtime,
      theme,
      requiredIntents: contract?.requiredIntents
    });
    activeSurface.value = nextSurface;
    activeInput.value = parsedInput;
    activeTheme.value = theme;
    surfaceRevision.value += 1;
  } catch (error) {
    disposeActiveSurface();
    resolution.value = null;
    nodeError.value = error instanceof SurfaceRegistryError ? 'registry' : 'context';
    console.error('[SurfaceRuntime] Surface unavailable', {
      code: error instanceof SurfaceRegistryError ? error.code : 'context-creation-failed',
      contractId: props.contractId,
      error
    });
  }
};

watch(
  () => [props.contractId, props.input, props.desktopModeId, props.variant, props.tokens, props.cssVars],
  rebuildSurface,
  { immediate: true, deep: true }
);

onBeforeUnmount(disposeActiveSurface);
</script>
