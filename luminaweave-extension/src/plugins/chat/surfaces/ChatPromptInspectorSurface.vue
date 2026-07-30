<template>
  <div class="chat-prompt-inspector-surface" :style="surfaceStyle">
    <PromptInspector
      :inspection="snapshot.promptInspection"
      :auto-probe="input.autoProbe"
      :on-probe="surface.intents.probePrompt"
      :on-run-edited-prompt="surface.intents.runEditedPrompt"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  useSurfaceInput,
  useSurfaceRuntimeContext
} from '../../../platform/surface/useSurfaceRuntimeContext.js';
import PromptInspector from '../PromptInspector.vue';

const input = useSurfaceInput('chat.promptInspector');
const context = useSurfaceRuntimeContext('chat.promptInspector');
const surface = computed(() => context.value);
const snapshot = computed(() => context.value.state.snapshot.value);
const surfaceStyle = computed<Record<string, string | number>>(() => ({
  ...(context.value.theme.tokens || {}),
  ...(context.value.theme.cssVars || {})
}));
</script>

<style scoped>
.chat-prompt-inspector-surface {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--lw-bg-app);
  padding: 10px;
}
</style>
