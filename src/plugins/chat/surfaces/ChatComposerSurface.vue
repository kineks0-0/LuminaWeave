<template>
  <section class="chat-composer-surface" :style="surfaceStyle">
    <ChatToolbar
      :collapsed="collapsed"
      :prompt-inspector-visible="snapshot.promptInspectorVisible"
      @toggle-collapsed="collapsed = !collapsed"
      @toggle-prompt-inspector="surface.intents.togglePromptInspector"
    />
    <ChatComposer
      v-show="!collapsed"
      :context="snapshot.context"
      :generation="snapshot.generation"
      :presentation="snapshot.presentation"
      :compact="Boolean(input.compact)"
      :collapsed="collapsed"
      :session-switching="sessionSwitching"
      :draft="snapshot.composerDraft"
      :placeholder="input.placeholder"
      :on-send-message="surface.intents.sendMessage"
      :on-stop-generation="surface.intents.stopGeneration"
      :on-update-draft="surface.intents.setComposerDraft"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  useSurfaceInput,
  useSurfaceRuntimeContext
} from '../../../platform/surface/useSurfaceRuntimeContext.js';
import ChatComposer from '../components/ChatComposer.vue';
import ChatToolbar from '../components/ChatToolbar.vue';

const input = useSurfaceInput('chat.composer');
const context = useSurfaceRuntimeContext('chat.composer');
const collapsed = ref(false);
const surface = computed(() => context.value);
const snapshot = computed(() => context.value.state.snapshot.value);
const sessionSwitching = computed(() => context.value.state.character.value.status.kind === 'switching');
const surfaceStyle = computed<Record<string, string | number>>(() => ({
  ...(context.value.theme.tokens || {}),
  ...(context.value.theme.cssVars || {})
}));

watch(
  () => snapshot.value.presentation.composerFocusRequest?.revision,
  () => {
    if (snapshot.value.presentation.composerFocusRequest) {
      collapsed.value = false;
    }
  }
);
</script>

<style scoped>
.chat-composer-surface {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 7px;
  background: var(--lw-chat-input-area-bg, var(--lw-bg-surface));
  padding: 8px 12px 12px;
}
</style>
