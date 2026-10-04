<template>
  <ChatTranscript
    class="chat-transcript-surface"
    :style="surfaceStyle"
    :messages="snapshot.messages"
    :context="snapshot.context"
    :generation="snapshot.generation"
    :presentation="snapshot.presentation"
    :character-state="characterState"
    :compact="Boolean(input.compact)"
    :default-avatar="context.state.defaultAvatar"
    :resolve-message-avatar="context.state.resolveMessageAvatar"
    :render-preferences="messageRenderPreferences"
    :on-select-choice="selectChoice"
    :on-html-action="handleHtmlAction"
    @edit="editMessage"
    @delete="deleteMessage"
    @regenerate="regenerate"
    @branch="branchMessage"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type {
  ChatMessageEditIntentInput,
  ChatMessageIntentInput
} from '../application/ChatApplicationController.js';
import {
  useSurfaceInput,
  useSurfaceRuntimeContext
} from '../../../platform/surface/useSurfaceRuntimeContext.js';
import ChatTranscript from '../components/ChatTranscript.vue';
import { resolveChatThemeRenderPreferences } from '../presentation/ChatMessageRenderPreferences.js';

const input = useSurfaceInput('chat.transcript');
const surface = useSurfaceRuntimeContext('chat.transcript');
const context = computed(() => surface.value);
const snapshot = computed(() => surface.value.state.snapshot.value);
const characterState = computed(() => surface.value.state.character.value);
const messageRenderPreferences = computed(() => ({
  ...surface.value.state.messageRenderPreferences.value,
  ...resolveChatThemeRenderPreferences(surface.value.theme.cssVars)
}));
const surfaceStyle = computed<Record<string, string | number>>(() => ({
  ...(surface.value.theme.tokens || {}),
  ...(surface.value.theme.cssVars || {})
}));

const editMessage = (payload: ChatMessageEditIntentInput): void => {
  void surface.value.intents.editMessage(payload);
};
const deleteMessage = (payload: ChatMessageIntentInput): void => {
  void surface.value.intents.deleteMessage(payload);
};
const regenerate = (): void => {
  void surface.value.intents.regenerate();
};
const branchMessage = (payload: ChatMessageIntentInput): void => {
  void surface.value.intents.branchMessage(payload);
};
const selectChoice = (text: string): void => {
  if (surface.value.state.choiceInteractionMode.value === 'fill') {
    surface.value.intents.setComposerDraft(text);
    return;
  }
  void surface.value.intents.sendMessage(text);
};

/** 消息内 HTML 交互块的动作桥：填入草稿或直接发送。 */
const handleHtmlAction = (text: string, mode: 'fill' | 'send'): void => {
  if (mode === 'send') {
    void surface.value.intents.sendMessage(text);
    return;
  }
  surface.value.intents.setComposerDraft(text);
};
</script>

<style scoped>
.chat-transcript-surface {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--lw-chat-stream-bg, var(--lw-bg-app));
}
</style>
