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
      :is-group-conversation="isGroupConversation"
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

    <div
      v-else-if="generation.errorMessage"
      class="chat-streaming-message__pending is-error"
      :data-layout="renderPreferences.messageLayout"
      role="alert"
    >
      <span>{{ generation.errorMessage }}</span>
      <button type="button" @click="emit('retry')">重试</button>
    </div>
    <div
      v-else
      class="chat-streaming-message__pending"
      :class="{ 'is-motion-off': motionOff }"
      :data-layout="renderPreferences.messageLayout"
    >
      <template v-if="isTelegram">
        <span class="chat-streaming-message__typing-bubble">
          <span class="chat-streaming-message__typing" aria-hidden="true">
            <i /><i /><i />
          </span>
        </span>
        <span class="chat-streaming-message__caption">{{ generation.stream?.statusText || '正在生成' }}</span>
      </template>
      <template v-else>
        <LoaderCircle :size="15" class="is-spinning" aria-hidden="true" />
        <span>{{ generation.stream?.statusText || '正在生成' }}</span>
      </template>
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
  isGroupConversation: boolean;
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
const isTelegram = computed(() => props.renderPreferences.messageLayout === 'telegram');
const motionOff = computed(() => (
  motionPreference.value.motion === 'none' || motionPreference.value.reducedMotion
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
  border: 1px solid color-mix(in srgb, var(--lw-danger) 26%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--lw-danger) 7%, var(--lw-chat-floating-bg, var(--lw-bg-elevated)));
  backdrop-filter: var(--lw-chat-floating-blur, none);
  -webkit-backdrop-filter: var(--lw-chat-floating-blur, none);
  padding: 9px 10px 9px 12px;
  color: var(--lw-danger, var(--lw-text-main));
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
}

.chat-streaming-message__error > span,
.chat-streaming-message__pending.is-error > span {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.chat-streaming-message__error button,
.chat-streaming-message__pending.is-error button {
  display: inline-flex;
  flex: 0 0 auto;
  height: 30px;
  align-items: center;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--lw-danger) 30%, transparent);
  border-radius: 999px;
  background: var(--lw-bg-elevated);
  color: var(--lw-danger, var(--lw-text-main));
  font: inherit;
  font-size: var(--lw-type-label-medium-size);
  font-weight: var(--lw-type-label-medium-weight);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--lw-transition), border-color var(--lw-transition);
}

.chat-streaming-message__error button:hover,
.chat-streaming-message__pending.is-error button:hover {
  background: color-mix(in srgb, var(--lw-danger) 10%, var(--lw-bg-elevated));
}

.is-spinning {
  animation: chat-spin 0.9s linear infinite;
}

@keyframes chat-spin {
  to { transform: rotate(360deg); }
}

/* Telegram：等待态为纯圆点气泡，阶段文案移到气泡下方的浮动注解 */
.chat-streaming-message__pending[data-layout='telegram']:not(.is-error) {
  width: fit-content;
  max-width: 100%;
  min-height: 0;
  align-self: flex-start;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
}

.chat-streaming-message__pending[data-layout='telegram'] .chat-streaming-message__typing-bubble,
.chat-streaming-message__pending[data-layout='telegram'].is-error {
  position: relative;
  box-sizing: border-box;
  width: fit-content;
  max-width: min(100%, var(--lw-chat-message-max-width, 560px));
  min-height: 36px;
  border: 1px solid var(--lw-chat-border, transparent);
  border-radius: var(--lw-chat-bubble-radius, 18px);
  border-bottom-left-radius: 4px;
  background: var(--lw-chat-bubble, var(--lw-bg-surface));
  box-shadow: var(--lw-chat-bubble-shadow, none);
  color: var(--lw-chat-meta-color, var(--lw-text-muted));
  text-align: left;
}

.chat-streaming-message__pending[data-layout='telegram'] .chat-streaming-message__typing-bubble {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px 8px;
}

.chat-streaming-message__pending[data-layout='telegram'] .chat-streaming-message__typing-bubble::before,
.chat-streaming-message__pending[data-layout='telegram'].is-error::before {
  content: '';
  position: absolute;
  bottom: -1px;
  left: -8px;
  width: 9px;
  height: 14px;
  background: var(--lw-chat-bubble, var(--lw-bg-surface));
  -webkit-mask: radial-gradient(10px 14px at 0 0, transparent 98%, #000 100%);
  mask: radial-gradient(10px 14px at 0 0, transparent 98%, #000 100%);
}

.chat-streaming-message__pending[data-layout='telegram'].is-error {
  align-self: flex-start;
  border-color: color-mix(in srgb, var(--lw-danger) 26%, transparent);
  background: color-mix(in srgb, var(--lw-danger) 8%, var(--lw-chat-bubble, var(--lw-bg-elevated)));
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.chat-streaming-message__pending[data-layout='telegram'] .chat-streaming-message__caption {
  max-width: 100%;
  padding: 2px 10px;
  border: 1px solid var(--lw-chat-floating-border, var(--lw-border-subtle));
  border-radius: 999px;
  background: var(--lw-chat-floating-bg, var(--lw-bg-elevated));
  box-shadow: var(--lw-chat-floating-shadow, none);
  backdrop-filter: var(--lw-chat-floating-blur, none);
  -webkit-backdrop-filter: var(--lw-chat-floating-blur, none);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
}

.chat-streaming-message__typing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chat-streaming-message__typing i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  animation: chat-typing-dot 1.1s ease-in-out infinite;
}

.chat-streaming-message__typing i:nth-child(2) { animation-delay: 0.15s; }
.chat-streaming-message__typing i:nth-child(3) { animation-delay: 0.3s; }

@keyframes chat-typing-dot {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-3px); opacity: 1; }
}

.chat-streaming-message__pending.is-motion-off .chat-streaming-message__typing i {
  animation: none;
  opacity: 0.75;
}

@media (prefers-reduced-motion: reduce) {
  .chat-streaming-message__typing i {
    animation: none;
    opacity: 0.75;
  }
}
</style>
