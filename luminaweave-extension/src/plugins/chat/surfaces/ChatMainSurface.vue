<template>
  <main
    class="chat-main-surface"
    :data-surface-variant="surfaceContext.theme.variant || 'default'"
    :style="surfaceStyle"
  >
    <ChatHeader
      v-if="showHeader"
      :title="headerTitle"
      :subtitle="headerSubtitle"
      :avatar-url="headerAvatarUrl"
      :default-avatar="surfaceContext.state.defaultAvatar"
      :messages="snapshot.messages"
      :on-back="input.onTelegramBack"
      :on-open-role-profile="input.onTelegramOpenRoleProfile"
      :on-open-panel="input.onOpenPanel"
      :on-toggle-prompt-inspector="surfaceContext.intents.togglePromptInspector"
    />

    <ChatTranscript
      :messages="snapshot.messages"
      :context="snapshot.context"
      :generation="snapshot.generation"
      :presentation="snapshot.presentation"
      :character-state="characterState"
      :compact="compact"
      :default-avatar="surfaceContext.state.defaultAvatar"
      :resolve-message-avatar="surfaceContext.state.resolveMessageAvatar"
      :render-preferences="messageRenderPreferences"
      :on-select-choice="selectChoice"
      @edit="editMessage"
      @delete="deleteMessage"
      @regenerate="regenerate"
      @branch="branchMessage"
    />

    <div v-if="snapshot.promptInspectorVisible" class="chat-main-surface__inspector">
      <PromptInspector
        :inspection="snapshot.promptInspection"
        :on-probe="surfaceContext.intents.probePrompt"
        :on-run-edited-prompt="surfaceContext.intents.runEditedPrompt"
      />
    </div>

    <footer class="chat-main-surface__composer">
      <ChatToolbar
        :collapsed="composerCollapsed"
        :prompt-inspector-visible="snapshot.promptInspectorVisible"
        @toggle-collapsed="composerCollapsed = !composerCollapsed"
        @toggle-prompt-inspector="surfaceContext.intents.togglePromptInspector"
      />
      <ChatComposer
        v-show="!composerCollapsed"
        :context="snapshot.context"
        :generation="snapshot.generation"
        :presentation="snapshot.presentation"
        :compact="compact"
        :collapsed="composerCollapsed"
        :session-switching="sessionSwitching"
        :draft="snapshot.composerDraft"
        :on-send-message="surfaceContext.intents.sendMessage"
        :on-stop-generation="surfaceContext.intents.stopGeneration"
        :on-update-draft="surfaceContext.intents.setComposerDraft"
      />
    </footer>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
  ChatMessageEditIntentInput,
  ChatMessageIntentInput
} from '../application/ChatApplicationController.js';
import {
  useSurfaceInput,
  useSurfaceRuntimeContext
} from '../../../platform/surface/useSurfaceRuntimeContext.js';
import ChatComposer from '../components/ChatComposer.vue';
import ChatHeader from '../components/ChatHeader.vue';
import ChatToolbar from '../components/ChatToolbar.vue';
import ChatTranscript from '../components/ChatTranscript.vue';
import PromptInspector from '../PromptInspector.vue';
import { resolveChatThemeRenderPreferences } from '../presentation/ChatMessageRenderPreferences.js';

const input = useSurfaceInput('chat.main');
const context = useSurfaceRuntimeContext('chat.main');
const composerCollapsed = ref(false);
const surfaceContext = computed(() => context.value);
const snapshot = computed(() => context.value.state.snapshot.value);
const characterState = computed(() => context.value.state.character.value);
const messageRenderPreferences = computed(() => ({
  ...context.value.state.messageRenderPreferences.value,
  ...resolveChatThemeRenderPreferences(context.value.theme.cssVars)
}));
const compact = computed(() => Boolean(input.isMobile || input.workspaceCompact));
const sessionSwitching = computed(() => characterState.value.status.kind === 'switching');
const showHeader = computed(() => Boolean(
  input.onTelegramBack
  || input.onTelegramOpenRoleProfile
  || input.onOpenPanel
));
const latestAssistantMessage = computed(() => {
  for (let index = snapshot.value.messages.length - 1; index >= 0; index -= 1) {
    const message = snapshot.value.messages[index];
    if (!message.is_user) return message;
  }
  return null;
});
const headerTitle = computed(() => (
  latestAssistantMessage.value?.name?.trim()
  || characterState.value.status.characterName.trim()
  || '聊天'
));
const headerSubtitle = computed(() => (
  sessionSwitching.value
    ? characterState.value.status.text || '正在切换聊天'
    : 'online'
));
const headerAvatarUrl = computed(() => (
  latestAssistantMessage.value
    ? surfaceContext.value.state.resolveMessageAvatar(latestAssistantMessage.value)
    : surfaceContext.value.state.defaultAvatar
));
const surfaceStyle = computed<Record<string, string | number>>(() => ({
  ...(context.value.theme.tokens || {}),
  ...(context.value.theme.cssVars || {})
}));

const editMessage = (payload: ChatMessageEditIntentInput): void => {
  void context.value.intents.editMessage(payload);
};

const deleteMessage = (payload: ChatMessageIntentInput): void => {
  void context.value.intents.deleteMessage(payload);
};

const regenerate = (): void => {
  void context.value.intents.regenerate();
};

const branchMessage = (payload: ChatMessageIntentInput): void => {
  void context.value.intents.branchMessage(payload);
};

const selectChoice = (text: string): void => {
  if (context.value.state.choiceInteractionMode.value === 'fill') {
    context.value.intents.setComposerDraft(text);
    return;
  }
  void context.value.intents.sendMessage(text);
};

watch(
  () => snapshot.value.presentation.composerFocusRequest?.revision,
  () => {
    if (snapshot.value.presentation.composerFocusRequest) {
      composerCollapsed.value = false;
    }
  }
);
</script>

<style scoped>
.chat-main-surface {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--lw-chat-background, var(--lw-bg-app));
  color: var(--lw-text-primary);
  overflow: hidden;
}

.chat-main-surface__inspector {
  display: flex;
  min-height: 220px;
  max-height: 48%;
  padding: 0 12px 10px;
}

.chat-main-surface__composer {
  display: flex;
  flex-direction: column;
  gap: 7px;
  border-top: 1px solid var(--lw-border-base);
  background: var(--lw-chat-composer-background, var(--lw-bg-surface));
  padding: 8px 12px 12px;
}
</style>
