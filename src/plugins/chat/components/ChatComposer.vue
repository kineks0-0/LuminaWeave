<template>
  <div class="chat-composer" :class="{ 'is-compact': compact }">
    <div v-if="viewState.isReadOnlyView" class="chat-composer__notice">
      {{ viewState.readOnlyReason }}
    </div>
    <div class="chat-composer__input">
      <textarea
        ref="textarea"
        :value="draft"
        rows="2"
        :placeholder="effectivePlaceholder"
        :disabled="disabled"
        @keydown="handleKeydown"
        @input="handleInput"
        @compositionstart="imeGuard.handleCompositionStart"
        @compositionend="imeGuard.handleCompositionEnd"
      />
      <button
        v-if="generation.isGenerating"
        type="button"
        class="chat-composer__action is-danger"
        title="停止生成"
        aria-label="停止生成"
        :disabled="viewState.isReadOnlyView"
        @click="stopGeneration"
      >
        <Square :size="16" fill="currentColor" />
      </button>
      <button
        v-else
        type="button"
        class="chat-composer__action is-primary"
        title="发送消息"
        aria-label="发送消息"
        :disabled="disabled || !draft.trim()"
        @click="sendMessage"
      >
        <Send :size="17" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Send, Square } from 'lucide-vue-next';
import { useImeSubmitGuard } from '../../../composables/useImeSubmitGuard.js';
import type { ConversationViewContext } from '../../../types/ConversationContextTypes.js';
import type {
  ChatApplicationSnapshot,
  ChatGenerationState
} from '../application/ChatApplicationController.js';
import { focusChatComposerInput } from '../presentation/ChatPresentationInteractions.js';
import { resolveChatViewState } from '../chatViewState.js';

const props = defineProps<{
  context: ConversationViewContext;
  generation: ChatGenerationState;
  presentation: ChatApplicationSnapshot['presentation'];
  compact: boolean;
  collapsed: boolean;
  sessionSwitching: boolean;
  draft: string;
  placeholder?: string;
  onSendMessage: (text: string) => Promise<boolean>;
  onStopGeneration: () => Promise<boolean>;
  onUpdateDraft: (text: string) => void;
}>();

const imeGuard = useImeSubmitGuard({ debugLabel: 'ChatComposer' });
const textarea = ref<HTMLTextAreaElement | null>(null);
const viewState = computed(() => resolveChatViewState({
  sourceId: props.context.source,
  sessionId: props.context.sessionId,
  currentChatSessionId: props.context.meta?.currentChatSessionId || null,
  isLive: props.context.meta?.isLive === true,
  isSessionSwitching: props.sessionSwitching
}));
const disabled = computed(() => (
  props.collapsed
  || props.generation.isGenerating
  || props.sessionSwitching
  || viewState.value.isReadOnlyView
));
const effectivePlaceholder = computed(() => props.placeholder || viewState.value.inputPlaceholder);

const sendMessage = async (): Promise<void> => {
  const text = props.draft.trim();
  if (!text || disabled.value) return;
  const sent = await props.onSendMessage(text);
  if (sent) props.onUpdateDraft('');
};

const stopGeneration = async (): Promise<void> => {
  await props.onStopGeneration();
};

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key !== 'Enter' || event.shiftKey || imeGuard.shouldIgnoreSubmit(event)) return;
  event.preventDefault();
  void sendMessage();
};

const handleInput = (event: Event): void => {
  if (!(event.currentTarget instanceof HTMLTextAreaElement)) return;
  props.onUpdateDraft(event.currentTarget.value);
};

watch(
  () => props.presentation.composerFocusRequest?.revision,
  () => {
    if (!props.presentation.composerFocusRequest) return;
    void nextTick(() => {
      if (textarea.value) focusChatComposerInput(textarea.value);
    });
  }
);
</script>

<style scoped>
.chat-composer {
  width: min(100%, var(--lw-chat-page-width, 920px));
  margin: 0 auto;
}

.chat-composer__notice {
  margin-bottom: 6px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
}

.chat-composer__input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  gap: 8px;
  align-items: end;
  border: 1px solid var(--lw-chat-input-border, var(--lw-border-base));
  border-radius: var(--lw-chat-input-radius, 8px);
  background: var(--lw-chat-input-surface, var(--lw-bg-surface));
  box-shadow: var(--lw-chat-input-shadow, none);
  padding: 6px;
  transition: border-color var(--lw-transition), box-shadow var(--lw-transition);
}

.chat-composer__input:focus-within {
  border-color: var(--lw-chat-input-focus-border, var(--lw-primary));
  box-shadow: var(--lw-chat-input-focus-shadow, 0 0 0 2px color-mix(in srgb, var(--lw-primary) 14%, transparent));
}

.chat-composer textarea {
  width: 100%;
  min-height: 42px;
  max-height: 180px;
  resize: vertical;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--lw-text-main);
  padding: 8px 9px;
  font: inherit;
}

.chat-composer__action {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 0;
  /* 跟随输入框圆角，避免圆角输入框里出现方形按钮 */
  border-radius: max(6px, calc(var(--lw-chat-input-radius, 8px) - 6px));
  cursor: pointer;
}

.chat-composer__action.is-primary {
  background: var(--lw-primary);
  color: var(--lw-text-inverse);
}

.chat-composer__action.is-danger {
  background: var(--lw-danger);
  color: var(--lw-text-inverse);
}

.chat-composer__action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
