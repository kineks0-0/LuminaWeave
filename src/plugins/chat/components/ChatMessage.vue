<template>
  <article
    class="chat-message"
    :class="{ 'is-user': message.is_user, 'is-streaming': streaming }"
    :aria-busy="streaming || undefined"
    :data-message-shape="messageShape"
    :data-avatar-placement="avatarPlacement"
  >
    <img
      v-if="showInlineAvatar"
      class="chat-message__avatar"
      :src="avatarUrl"
      :alt="message.name"
      @error="handleAvatarError"
    >
    <div class="chat-message__body">
      <header v-if="showMessageMeta" class="chat-message__meta">
        <strong>{{ message.name }}</strong>
      </header>

      <div v-if="editing" class="chat-message__editor">
        <textarea
          ref="editor"
          v-model="editingText"
          rows="4"
          @keydown="handleEditorKeydown"
          @compositionstart="imeGuard.handleCompositionStart"
          @compositionend="imeGuard.handleCompositionEnd"
        />
        <div class="chat-message__editor-actions">
          <button type="button" title="取消编辑" aria-label="取消编辑" @click="cancelEditing">
            <X :size="16" />
          </button>
          <button type="button" title="保存修改" aria-label="保存修改" @click="confirmEditing">
            <Check :size="16" />
          </button>
        </div>
      </div>

      <div v-else class="chat-message__bubble">
        <TextBlock
          v-if="message.is_user"
          :text="message.mesRaw || message.mes"
          :render-fn="renderChatMarkdown"
        />
        <MessageRenderer
          v-else
          :mes="message.mes"
          :mes-raw="message.mesRaw || message.mes"
          :plugin-raw="message.pluginRaw"
          :thinking-text="message.thinkingText"
          :render-markdown="renderChatMarkdown"
          :render-preferences="renderPreferences"
          :on-select-choice="onSelectChoice"
          :is-streaming="streaming"
          :streaming-presentation="streamingPresentation"
        />
        <slot name="status" />
        <!-- 流式中保留操作栏占位（不可见），结束后切换为最终消息时高度不变 -->
        <div class="chat-message__actions" :aria-hidden="streaming || undefined">
          <button type="button" title="编辑消息" aria-label="编辑消息" :disabled="disabled" @click="startEditing">
            <Pencil :size="15" />
          </button>
          <button
            v-if="!message.is_user"
            type="button"
            title="重新生成"
            aria-label="重新生成"
            :disabled="disabled"
            @click="emit('regenerate')"
          >
            <RefreshCw :size="15" />
          </button>
          <button
            v-if="!message.is_user"
            type="button"
            title="从此消息创建分支"
            aria-label="从此消息创建分支"
            :disabled="disabled"
            @click="emit('branch', { message, index })"
          >
            <GitBranch :size="15" />
          </button>
          <button
            type="button"
            title="删除消息"
            aria-label="删除消息"
            :disabled="disabled"
            @click="emit('delete', { message, index })"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { computed, nextTick, ref } from 'vue';
import { Check, GitBranch, Pencil, RefreshCw, Trash2, X } from 'lucide-vue-next';
import { useImeSubmitGuard } from '../../../composables/useImeSubmitGuard.js';
import type {
  ChatMessageEditIntentInput,
  ChatMessageIntentInput
} from '../application/ChatApplicationController.js';
import type { ChatMessageRenderPreferences } from '../presentation/ChatMessageRenderPreferences.js';
import type { ChatStreamingPresentation } from '../presentation/ChatStreamingPresentation.js';
import MessageRenderer from './MessageRenderer.vue';
import TextBlock from './blocks/TextBlock.vue';
import { renderChatMarkdown } from './chatMarkdown.js';

const props = defineProps<{
  message: LuminaChatMessage;
  index: number;
  avatarUrl: string;
  defaultAvatar: string;
  disabled: boolean;
  renderPreferences: ChatMessageRenderPreferences;
  onSelectChoice: (text: string) => void;
  /** 正在流式输出的回复：复用同一行布局，保证结束时无缝替换为最终消息 */
  streaming?: boolean;
  streamingPresentation?: ChatStreamingPresentation;
}>();

const emit = defineEmits<{
  edit: [input: ChatMessageEditIntentInput];
  delete: [input: ChatMessageIntentInput];
  regenerate: [];
  branch: [input: ChatMessageIntentInput];
}>();

const editing = ref(false);
const editingText = ref('');
const editor = ref<HTMLTextAreaElement | null>(null);
const imeGuard = useImeSubmitGuard({ debugLabel: 'ChatMessageEditor' });
const messageShape = computed(() => (
  props.message.is_user
    ? props.renderPreferences.userMessageShape
    : props.renderPreferences.assistantMessageShape
));
const avatarPlacement = computed(() => (
  props.message.is_user
    ? props.renderPreferences.userAvatarPlacement
    : props.renderPreferences.assistantAvatarPlacement
));
const showInlineAvatar = computed(() => avatarPlacement.value === 'inline');
const showMessageMeta = computed(() => (
  props.renderPreferences.showUsernames && avatarPlacement.value !== 'topbar'
));

const startEditing = (): void => {
  editingText.value = props.message.mesRaw || props.message.mes;
  editing.value = true;
  void nextTick(() => editor.value?.focus());
};

const cancelEditing = (): void => {
  editing.value = false;
  editingText.value = '';
};

const confirmEditing = (): void => {
  const text = editingText.value.trim();
  if (!text) return;
  emit('edit', { message: props.message, index: props.index, text });
  cancelEditing();
};

const handleEditorKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelEditing();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !imeGuard.shouldIgnoreSubmit(event)) {
    event.preventDefault();
    confirmEditing();
  }
};

const handleAvatarError = (event: Event): void => {
  if (event.currentTarget instanceof HTMLImageElement) {
    event.currentTarget.src = props.defaultAvatar;
  }
};
</script>

<style scoped>
.chat-message {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.chat-message.is-user {
  grid-template-columns: minmax(0, 1fr) 36px;
}

.chat-message:not([data-avatar-placement='inline']) {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}

.chat-message.is-user:not([data-avatar-placement='inline']) .chat-message__body {
  grid-column: 1;
}

.chat-message.is-user .chat-message__avatar {
  grid-column: 2;
}

.chat-message.is-user .chat-message__body {
  grid-column: 1;
  grid-row: 1;
  align-items: flex-end;
}

.chat-message__avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--lw-chat-avatar-radius, 8px);
  object-fit: cover;
  background: var(--lw-bg-subtle);
}

.chat-message__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.chat-message__meta {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
}

.chat-message__bubble,
.chat-message__editor {
  width: min(100%, var(--lw-chat-message-width, 760px));
  border: 1px solid var(--lw-chat-bubble-border, var(--lw-border-base));
  border-radius: var(--lw-chat-bubble-radius, 8px);
  background: var(--lw-chat-bubble, var(--lw-bg-surface));
  color: var(--lw-text-primary);
  padding: 12px 14px 8px;
}

.is-user .chat-message__bubble {
  background: var(--lw-chat-user-bubble, color-mix(in srgb, var(--lw-primary) 12%, var(--lw-bg-surface)));
}

.chat-message__actions,
.chat-message__editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  min-height: 28px;
  margin-top: 6px;
}

.chat-message__actions button,
.chat-message__editor-actions button {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
}

.chat-message__actions button:hover:not(:disabled),
.chat-message__editor-actions button:hover:not(:disabled) {
  background: var(--lw-bg-hover);
  color: var(--lw-text-primary);
}

.chat-message.is-streaming .chat-message__actions {
  visibility: hidden;
}

.chat-message__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.chat-message__editor textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  background: var(--lw-bg-app);
  color: var(--lw-text-primary);
  padding: 9px 10px;
  font: inherit;
}

.chat-message[data-message-shape='document'] .chat-message__body {
  align-items: flex-start;
}

.chat-message[data-message-shape='document'] .chat-message__bubble,
.chat-message[data-message-shape='document'] .chat-message__editor {
  width: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
}
</style>
