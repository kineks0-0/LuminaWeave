<template>
  <div class="scv-root">
    <!-- 消息列表 -->
    <div ref="scrollRef" class="scv-messages">
      <template v-if="messages.length > 0">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="scv-msg"
          :class="`scv-msg--${msg.role}`"
        >
          <div class="scv-msg-avatar">
            <span v-if="msg.role === 'user'">U</span>
            <span v-else>A</span>
          </div>
          <div class="scv-msg-body">
            <MessageRenderer
              v-if="msg.role === 'assistant'"
              :mes-raw="msg.content"
              :render-markdown="renderMarkdown"
              :is-streaming="msg.isStreaming"
            />
            <div v-else class="scv-user-text">{{ msg.content }}</div>
            <div v-if="msg.isStreaming" class="scv-streaming-indicator">
              <span class="scv-dot"></span>
              <span class="scv-dot"></span>
              <span class="scv-dot"></span>
            </div>
          </div>
        </div>
      </template>

      <!-- 空状态插槽 -->
      <div v-else class="scv-empty">
        <slot name="empty">
          <div class="scv-empty-icon">💬</div>
          <p>开始对话</p>
        </slot>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="scv-input-area">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="scv-textarea"
        :disabled="isStreaming"
        :placeholder="placeholder ?? '输入消息，Enter 发送，Shift+Enter 换行...'"
        rows="3"
        @keydown.enter.exact.prevent="handleSend"
      />
      <div class="scv-input-actions">
        <button
          v-if="isStreaming"
          class="scv-stop-btn"
          type="button"
          @click="emit('abort')"
        >
          停止
        </button>
        <button
          v-else
          class="scv-send-btn"
          type="button"
          :disabled="!inputText.trim()"
          @click="handleSend"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import MessageRenderer from './MessageRenderer.vue';

export interface SimpleChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const props = withDefaults(defineProps<{
  messages: SimpleChatMessage[];
  isStreaming: boolean;
  placeholder?: string;
  renderMarkdown: (text: string) => string;
}>(), {
  placeholder: undefined
});

const emit = defineEmits<{
  send: [text: string];
  abort: [];
}>();

const scrollRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const inputText = ref('');

const handleSend = () => {
  const text = inputText.value.trim();
  if (!text || props.isStreaming) return;
  inputText.value = '';
  emit('send', text);
};

const scrollToBottom = () => {
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
  }
};

watch(() => props.messages, () => void nextTick(scrollToBottom), { deep: true });
watch(() => props.isStreaming, () => void nextTick(scrollToBottom));
</script>

<style scoped>
.scv-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.scv-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.scv-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--lw-text-muted);
  text-align: center;
  padding: 24px;
}

.scv-empty-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.scv-empty p {
  margin: 0;
  font-size: 13px;
  color: var(--lw-text-secondary);
}

.scv-msg {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.scv-msg--user {
  flex-direction: row-reverse;
}

.scv-msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--lw-primary) 12%, var(--lw-bg-elevated));
  color: var(--lw-primary);
}

.scv-msg--user .scv-msg-avatar {
  background: color-mix(in srgb, var(--lw-text-muted) 18%, var(--lw-bg-elevated));
  color: var(--lw-text-secondary);
}

.scv-msg-body {
  flex: 1;
  min-width: 0;
}

.scv-user-text {
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-base);
  border-radius: 8px 0 8px 8px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--lw-text-main);
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 90%;
  margin-left: auto;
}

.scv-streaming-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 2px;
}

.scv-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--lw-primary);
  animation: scv-pulse 1.4s ease-in-out infinite;
}

.scv-dot:nth-child(2) { animation-delay: 0.2s; }
.scv-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes scv-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

.scv-input-area {
  padding: 10px 14px 12px;
  border-top: 1px solid var(--lw-border-base);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scv-textarea {
  width: 100%;
  resize: none;
  border: 1px solid var(--lw-border-base);
  border-radius: 8px;
  background: var(--lw-bg-input, var(--lw-bg-subtle));
  color: var(--lw-text-main);
  font-size: 13px;
  line-height: 1.5;
  padding: 8px 10px;
  outline: none;
  font-family: inherit;
  transition: border-color 150ms;
  box-sizing: border-box;
}

.scv-textarea:focus {
  border-color: var(--lw-primary);
}

.scv-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.scv-input-actions {
  display: flex;
  justify-content: flex-end;
}

.scv-send-btn,
.scv-stop-btn {
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  transition: background 120ms, opacity 120ms;
}

.scv-send-btn {
  background: var(--lw-primary);
  color: var(--lw-on-primary, #fff);
}

.scv-send-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.scv-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.scv-stop-btn {
  background: color-mix(in srgb, var(--lw-danger, #ef4444) 12%, var(--lw-bg-elevated));
  color: var(--lw-danger, #ef4444);
  border: 1px solid color-mix(in srgb, var(--lw-danger, #ef4444) 30%, transparent);
}

.scv-stop-btn:hover {
  background: color-mix(in srgb, var(--lw-danger, #ef4444) 20%, var(--lw-bg-elevated));
}
</style>
