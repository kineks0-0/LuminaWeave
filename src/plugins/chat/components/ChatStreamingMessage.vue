<template>
  <div v-if="visible" ref="rootRef" class="chat-streaming-message" aria-live="polite">
    <ChatMessage
      v-if="streamText"
      :message="streamingMessage"
      :index="-1"
      :avatar-url="assistantAvatarUrl"
      :default-avatar="defaultAvatar"
      :disabled="true"
      :render-preferences="renderPreferences"
      :on-select-choice="ignoreChoice"
      :streaming="true"
      :streaming-presentation="streamPresentation"
      :group-start="groupStart"
      :group-end="true"
      :time-label="timeLabel"
    >
      <template #status>
        <footer v-if="showMeta" class="chat-streaming-message__meta">
          <span v-if="generation.stream?.statusText">{{ generation.stream.statusText }}</span>
          <span v-if="generation.stream?.filteredCount">已过滤 {{ generation.stream.filteredCount }} 字</span>
        </footer>
        <div v-if="generation.errorMessage" class="chat-streaming-message__error" role="alert">
          <span>{{ generation.errorMessage }}</span>
          <button type="button" @click="emit('retry')">重试</button>
        </div>
      </template>
    </ChatMessage>

    <div v-else-if="generation.errorMessage" class="chat-streaming-message__pending is-error" role="alert">
      <span>{{ generation.errorMessage }}</span>
      <button type="button" @click="emit('retry')">重试</button>
    </div>
    <div v-else class="chat-streaming-message__pending">
      <LoaderCircle :size="15" class="is-spinning" aria-hidden="true" />
      <span>{{ generation.stream?.statusText || '正在生成' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { computed, ref } from 'vue';
import { LoaderCircle } from 'lucide-vue-next';
import { useMotionPreference } from '../../../composables/useMotionPreference.js';
import type { ChatGenerationState } from '../application/ChatApplicationController.js';
import type { ChatMessageRenderPreferences } from '../presentation/ChatMessageRenderPreferences.js';
import { resolveChatStreamingPresentation } from '../presentation/ChatStreamingPresentation.js';
import ChatMessage from './ChatMessage.vue';

const props = defineProps<{
  generation: ChatGenerationState;
  visible: boolean;
  renderPreferences: ChatMessageRenderPreferences;
  assistantName: string;
  assistantAvatarUrl: string;
  defaultAvatar: string;
  groupStart: boolean;
  timeLabel: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const rootRef = ref<HTMLElement | null>(null);
const motionPreference = useMotionPreference(rootRef);

const streamText = computed(() => props.generation.stream?.processed || '');
const streamPresentation = computed(() => resolveChatStreamingPresentation(
  props.renderPreferences.streamingEffect,
  motionPreference.value
));
const showMeta = computed(() => Boolean(
  props.generation.stream?.statusText || props.generation.stream?.filteredCount
));

const streamingMessage = computed<LuminaChatMessage>(() => ({
  id: '__lumina_streaming__',
  parentId: null,
  name: props.assistantName,
  role: 'assistant',
  is_user: false,
  mesRaw: streamText.value,
  mes: streamText.value,
  thinkingText: props.generation.stream?.thinkingText || null,
  fingerprint: '',
  extra: {},
  syncStatus: 'streaming'
}));

const ignoreChoice = (): void => {};
</script>

<style scoped>
.chat-streaming-message__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
}

.chat-streaming-message__pending {
  margin-top: var(--lw-chat-content-gap, 20px);
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
}

.chat-streaming-message__error,
.chat-streaming-message__pending.is-error {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  color: var(--lw-danger, var(--lw-text-main));
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
}

.chat-streaming-message__error button,
.chat-streaming-message__pending.is-error button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--lw-border-base);
  border-radius: 999px;
  background: var(--lw-bg-elevated);
  color: var(--lw-text-main);
  font: inherit;
  cursor: pointer;
  transition: background var(--lw-transition);
}

.chat-streaming-message__error button:hover,
.chat-streaming-message__pending.is-error button:hover {
  background: var(--lw-bg-subtle);
}

.is-spinning {
  animation: chat-spin 0.9s linear infinite;
}

@keyframes chat-spin {
  to { transform: rotate(360deg); }
}
</style>
