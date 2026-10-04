<template>
  <main
    class="chat-main-surface"
    :data-surface-variant="surfaceContext.theme.variant || 'default'"
    :data-layout="messageLayout"
    :class="{ 'has-floating-header': messageLayout === 'telegram' && showHeader }"
    :style="surfaceStyle"
  >
    <ChatHeader
      v-if="showHeader"
      :title="headerTitle"
      :subtitle="headerSubtitle"
      :avatar-url="headerAvatarUrl"
      :default-avatar="surfaceContext.state.defaultAvatar"
      :messages="snapshot.messages"
      :layout="messageLayout"
      :typing="snapshot.generation.isGenerating"
      :on-back="input.onBack"
      :on-toggle-sidebar="input.onToggleSidebar"
      :on-open-role-profile="input.onOpenRoleProfile"
      :on-open-panel="input.onOpenPanel"
      :on-toggle-prompt-inspector="surfaceContext.intents.togglePromptInspector"
      :prompt-presets="promptPresetOptions"
      :active-prompt-preset-id="activePromptPresetId"
      :on-select-prompt-preset="selectPromptPreset"
      :on-manage-prompt-assets="managePromptAssets"
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
        v-if="messageLayout !== 'telegram'"
        :collapsed="composerCollapsed"
        :prompt-inspector-visible="snapshot.promptInspectorVisible"
        :prompt-presets="promptPresetOptions"
        :active-prompt-preset-id="activePromptPresetId"
        @toggle-collapsed="composerCollapsed = !composerCollapsed"
        @toggle-prompt-inspector="surfaceContext.intents.togglePromptInspector"
        @select-prompt-preset="selectPromptPreset"
        @refresh-prompt-presets="loadPromptPresets"
        @manage-prompt-presets="managePromptPresets"
      />
      <ChatComposer
        v-show="!composerCollapsed"
        :layout="messageLayout"
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
      >
        <template v-if="messageLayout === 'telegram' && input.onOpenPanel" #leading="{ hasDraft }">
          <ChatComposerMenu :compact="hasDraft" :on-open-panel="input.onOpenPanel" />
        </template>
      </ChatComposer>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type {
  ChatMessageEditIntentInput,
  ChatMessageIntentInput
} from '../application/ChatApplicationController.js';
import {
  useSurfaceInput,
  useSurfaceRuntimeContext
} from '../../../platform/surface/useSurfaceRuntimeContext.js';
import ChatComposer from '../components/ChatComposer.vue';
import ChatComposerMenu from '../components/ChatComposerMenu.vue';
import ChatHeader from '../components/ChatHeader.vue';
import ChatToolbar from '../components/ChatToolbar.vue';
import type { ChatPromptPresetOption } from '../presentation/chatMenus.js';
import ChatTranscript from '../components/ChatTranscript.vue';
import PromptInspector from '../PromptInspector.vue';
import { resolveChatThemeRenderPreferences } from '../presentation/ChatMessageRenderPreferences.js';
import { chatPromptPresetLibraryService } from '../../../api/core/hal/prompt/chat/ChatPromptPresetLibraryService.js';
import { openSettingsCategory } from '../../settings/settingsViewState.js';

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
const messageLayout = computed(() => messageRenderPreferences.value.messageLayout);
const compact = computed(() => Boolean(input.isMobile || input.workspaceCompact));
const sessionSwitching = computed(() => characterState.value.status.kind === 'switching');
const showHeader = computed(() => Boolean(
  input.onBack
  || input.onOpenRoleProfile
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
    : '在线'
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

const promptPresetOptions = ref<ChatPromptPresetOption[]>([]);
const activePromptPresetId = ref('');

const loadPromptPresets = async (): Promise<void> => {
  try {
    const presets = await chatPromptPresetLibraryService.list();
    promptPresetOptions.value = presets.map(preset => ({
      id: preset.id,
      name: preset.name,
      promptCount: preset.promptCount
    }));
    activePromptPresetId.value = presets.find(preset => preset.isActive)?.id ?? '';
  } catch (error) {
    console.warn('[ChatMainSurface] 读取提示词预设失败', error);
  }
};

const selectPromptPreset = (id: string): void => {
  chatPromptPresetLibraryService.setActive(id);
  activePromptPresetId.value = id;
};

const managePromptAssets = (target: 'prompt-presets' | 'regex-scripts'): void => {
  openSettingsCategory('generation', `panel:chat-${target}`);
  input.onOpenPanel?.('lumina-settings');
};

const managePromptPresets = (): void => {
  managePromptAssets('prompt-presets');
};

onMounted(() => {
  void loadPromptPresets();
});

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
  background: var(--lw-chat-stream-bg, var(--lw-bg-app));
  color: var(--lw-chat-color, var(--lw-text-main));
  font-family: var(--lw-chat-font, var(--lw-font-main));
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
  background: var(--lw-chat-input-area-bg, var(--lw-bg-surface));
  padding: 8px 12px 12px;
}

/* Telegram：顶栏与输入框浮在壁纸上，消息区从顶栏下方开始滚动 */
.chat-main-surface.has-floating-header {
  --chat-header-control-size: 48px;
  /* 浮动顶栏占位 = 控件高度 + 上下各 8px 内边距（与 ChatHeader 的 --floating padding 一致） */
  --chat-header-overlap: calc(var(--chat-header-control-size) + 16px + var(--lw-content-safe-top, 0px));
}

.chat-main-surface[data-layout='telegram'] .chat-main-surface__composer {
  border-top: 0;
  padding: 6px 10px calc(10px + var(--lw-content-safe-bottom, 0px));
}
</style>
