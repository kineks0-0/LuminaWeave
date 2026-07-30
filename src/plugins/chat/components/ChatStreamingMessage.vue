<template>
  <article v-if="visible" class="chat-streaming-message" aria-live="polite">
    <div class="chat-streaming-message__indicator">
      <LoaderCircle v-if="generation.isSyncing" :size="17" class="is-spinning" />
      <MessageCircleMore v-else :size="17" />
    </div>
    <div class="chat-streaming-message__bubble">
      <div v-if="streamText" :class="streamPresentation.effectClass">
        <MessageRenderer
          :mes-raw="streamText"
          :thinking-text="generation.stream?.thinkingText"
          :render-markdown="renderChatMarkdown"
          :render-preferences="renderPreferences"
          :is-streaming="true"
        />
        <span v-if="streamPresentation.showCursor && !generation.isSyncing" class="typing-cursor">|</span>
      </div>
      <div v-else-if="generation.errorMessage" class="chat-streaming-message__error">
        {{ generation.errorMessage }}
      </div>
      <div v-else class="chat-streaming-message__status">
        <LoaderCircle :size="15" class="is-spinning" />
        <span>{{ generation.stream?.statusText || '正在生成' }}</span>
      </div>
      <footer v-if="streamText && (generation.stream?.statusText || generation.stream?.filteredCount)" class="chat-streaming-message__meta">
        <span v-if="generation.stream?.statusText">{{ generation.stream.statusText }}</span>
        <span v-if="generation.stream?.filteredCount">已过滤 {{ generation.stream.filteredCount }} 字</span>
      </footer>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { LoaderCircle, MessageCircleMore } from 'lucide-vue-next';
import type { ChatGenerationState } from '../application/ChatApplicationController.js';
import type { ChatMessageRenderPreferences } from '../presentation/ChatMessageRenderPreferences.js';
import { resolveChatStreamingPresentation } from '../presentation/ChatStreamingPresentation.js';
import MessageRenderer from './MessageRenderer.vue';
import { renderChatMarkdown } from './chatMarkdown.js';

const props = defineProps<{
  generation: ChatGenerationState;
  visible: boolean;
  renderPreferences: ChatMessageRenderPreferences;
}>();

const streamText = computed(() => props.generation.stream?.processed || '');
const streamPresentation = computed(() => resolveChatStreamingPresentation(
  props.renderPreferences.streamingEffect
));
</script>

<style scoped>
.chat-streaming-message {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.chat-streaming-message__indicator {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: var(--lw-chat-avatar-radius, 8px);
  background: color-mix(in srgb, var(--lw-primary) 12%, var(--lw-bg-surface));
  color: var(--lw-primary);
}

.chat-streaming-message__bubble {
  width: min(100%, var(--lw-chat-message-width, 760px));
  min-height: 46px;
  border: 1px solid var(--lw-chat-streaming-border, var(--lw-border-base));
  border-radius: var(--lw-chat-bubble-radius, 8px);
  background: var(--lw-chat-streaming-surface, var(--lw-bg-surface));
  color: var(--lw-text-primary);
  padding: 12px 14px;
}

.chat-streaming-message__status,
.chat-streaming-message__meta {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
}

.chat-streaming-message__meta {
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px solid var(--lw-border-base);
}

.chat-streaming-message__error {
  color: var(--lw-danger, #b91c1c);
}

.is-spinning {
  animation: chat-spin 0.9s linear infinite;
}

.lw-effect-fade-in {
  animation: lw-chat-fade-in 0.3s ease-out forwards;
}

.lw-effect-gpt-reveal {
  animation: lw-chat-gpt-reveal 0.6s ease-out forwards;
}

.typing-cursor {
  display: inline;
  color: var(--lw-text-primary);
  font-weight: var(--lw-type-body-medium-weight);
  user-select: none;
  animation: lw-chat-cursor-blink 0.8s step-end infinite;
}

@keyframes lw-chat-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes lw-chat-gpt-reveal {
  from {
    opacity: 0;
    color: var(--lw-text-muted);
  }
  to {
    opacity: 1;
    color: inherit;
  }
}

@keyframes lw-chat-cursor-blink {
  50% { opacity: 0; }
}

@keyframes chat-spin {
  to { transform: rotate(360deg); }
}
</style>
