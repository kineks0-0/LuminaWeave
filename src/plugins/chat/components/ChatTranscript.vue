<template>
  <div ref="scrollArea" class="chat-transcript" :class="{ 'is-compact': compact }" @scroll="handleScroll">
    <div class="chat-transcript__content">
      <div v-if="showEmptyState" class="chat-transcript__empty">
        {{ viewState.emptyStateMessage }}
      </div>
      <div v-if="viewState.isReadOnlyView" class="chat-transcript__notice">
        {{ viewState.readOnlyReason }}
      </div>

      <ChatMessage
        v-for="(message, index) in messages"
        :key="message.id || index"
        :message="message"
        :index="index"
        :avatar-url="resolveMessageAvatar(message)"
        :default-avatar="defaultAvatar"
        :disabled="interactionLocked"
        :render-preferences="renderPreferences"
        :on-select-choice="onSelectChoice"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
        @regenerate="emit('regenerate')"
        @branch="emit('branch', $event)"
      />

      <div v-if="sessionSwitching" class="chat-transcript__switching">
        <LoaderCircle :size="16" />
        <span>{{ characterState.status.text || '正在切换聊天' }}</span>
      </div>

      <ChatStreamingMessage
        :generation="generation"
        :visible="showStreaming"
        :render-preferences="renderPreferences"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { computed, nextTick, ref, watch } from 'vue';
import { LoaderCircle } from 'lucide-vue-next';
import type { CharacterChannelState, ConversationViewContext } from '../../../types/ConversationContextTypes.js';
import type {
  ChatApplicationSnapshot,
  ChatGenerationState,
  ChatMessageEditIntentInput,
  ChatMessageIntentInput
} from '../application/ChatApplicationController.js';
import type { ChatMessageRenderPreferences } from '../presentation/ChatMessageRenderPreferences.js';
import { resolveChatViewState } from '../chatViewState.js';
import { scrollChatTranscriptToBottom } from '../presentation/ChatPresentationInteractions.js';
import ChatMessage from './ChatMessage.vue';
import ChatStreamingMessage from './ChatStreamingMessage.vue';

const props = defineProps<{
  messages: LuminaChatMessage[];
  context: ConversationViewContext;
  generation: ChatGenerationState;
  presentation: ChatApplicationSnapshot['presentation'];
  characterState: CharacterChannelState;
  compact: boolean;
  defaultAvatar: string;
  resolveMessageAvatar: (message: LuminaChatMessage) => string;
  renderPreferences: ChatMessageRenderPreferences;
  onSelectChoice: (text: string) => void;
}>();

const emit = defineEmits<{
  edit: [input: ChatMessageEditIntentInput];
  delete: [input: ChatMessageIntentInput];
  regenerate: [];
  branch: [input: ChatMessageIntentInput];
}>();

const scrollArea = ref<HTMLElement | null>(null);
const isAtBottom = ref(true);
const sessionSwitching = computed(() => props.characterState.status.kind === 'switching');
const viewState = computed(() => resolveChatViewState({
  sourceId: props.context.source,
  sessionId: props.context.sessionId,
  currentChatSessionId: props.context.meta?.currentChatSessionId || null,
  isLive: props.context.meta?.isLive === true,
  isSessionSwitching: sessionSwitching.value
}));
const interactionLocked = computed(() => viewState.value.isReadOnlyView || sessionSwitching.value);
const showStreaming = computed(() => props.context.meta?.isLive === true && (
  props.generation.isGenerating
  || props.generation.isSyncing
  || Boolean(props.generation.stream?.processed)
  || Boolean(props.generation.errorMessage)
));
const showEmptyState = computed(() => props.messages.length === 0 && !showStreaming.value && !sessionSwitching.value);

const handleScroll = (): void => {
  const area = scrollArea.value;
  if (!area) return;
  isAtBottom.value = area.scrollHeight - area.scrollTop - area.clientHeight < 48;
};

const scrollToBottom = (): void => {
  const area = scrollArea.value;
  if (!area) return;
  if (scrollChatTranscriptToBottom(area, false)) {
    isAtBottom.value = true;
  }
};

watch(
  () => [props.messages.length, props.generation.revision, sessionSwitching.value],
  () => {
    if (!isAtBottom.value) return;
    void nextTick(scrollToBottom);
  }
);

watch(
  () => props.presentation.scrollRequest?.revision,
  () => {
    const request = props.presentation.scrollRequest;
    if (!request) return;
    void nextTick(() => {
      const area = scrollArea.value;
      if (!area) return;
      if (scrollChatTranscriptToBottom(area, request.force)) {
        isAtBottom.value = true;
      }
    });
  }
);
</script>

<style scoped>
.chat-transcript {
  min-height: 0;
  flex: 1;
  overflow: auto;
  overscroll-behavior: contain;
}

.chat-transcript__content {
  display: flex;
  width: min(100%, var(--lw-chat-page-width, 920px));
  min-height: 100%;
  margin: 0 auto;
  padding: var(--lw-chat-scroll-padding, 24px 32px);
  flex-direction: column;
  gap: 16px;
}

.chat-transcript.is-compact .chat-transcript__content {
  padding: 14px 12px;
  gap: 12px;
}

.chat-transcript__empty {
  display: grid;
  min-height: 180px;
  place-items: center;
  color: var(--lw-text-muted);
  text-align: center;
}

.chat-transcript__notice,
.chat-transcript__switching {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  padding: 9px 11px;
  font-size: var(--lw-type-body-small-size);
}

.chat-transcript__switching svg {
  animation: chat-transcript-spin 0.9s linear infinite;
}

@keyframes chat-transcript-spin {
  to { transform: rotate(360deg); }
}
</style>
