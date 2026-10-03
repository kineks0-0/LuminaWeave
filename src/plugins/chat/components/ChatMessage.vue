<template>
  <article
    ref="rootRef"
    class="chat-message"
    :class="{ 'is-user': message.is_user, 'is-streaming': streaming, 'is-selected': selected }"
    :aria-busy="streaming || undefined"
    :data-layout="layout"
    :data-group-start="groupStart"
    :data-group-end="groupEnd"
    :data-message-shape="messageShape"
    :data-avatar-placement="effectiveAvatarPlacement"
    @click="handleRowClick"
    @contextmenu="handleContextMenu"
  >
    <div v-if="hasAvatarColumn" class="chat-message__gutter">
      <img
        v-if="showInlineAvatar"
        class="chat-message__avatar"
        :src="avatarUrl"
        :alt="message.name"
        @error="handleAvatarError"
      >
      <time v-else-if="showGutterTime" class="chat-message__gutter-time">{{ timeLabel }}</time>
    </div>

    <div class="chat-message__body">
      <header v-if="showMessageMeta" class="chat-message__meta">
        <strong>{{ message.name }}</strong>
        <time v-if="showMetaTime">{{ timeLabel }}</time>
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

      <div
        v-else
        ref="bubbleRef"
        class="chat-message__bubble"
        :data-has-time="showBubbleTime || undefined"
        :style="bubbleTimeStyle"
      >
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
        <span v-if="showBubbleTime" class="chat-message__stamp" aria-hidden="true">
          {{ timeLabel }}
          <CheckCheck v-if="message.is_user" :size="14" :stroke-width="2.2" />
        </span>
      </div>
      <ChatPopoverMenu
        v-if="menuOpen"
        :items="messageMenu"
        label="消息操作"
        :placement="menuPlacement"
        :align="message.is_user ? 'end' : 'start'"
        @select="handleMenuSelect"
        @close="menuOpen = false"
      />
    </div>

    <!-- 统一的悬浮操作栏：悬停、键盘聚焦或点选消息（触屏）时显示，不占布局空间 -->
    <div v-if="!editing && !streaming && !usesMessageMenu" class="chat-message__actions" role="toolbar" aria-label="消息操作">
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
  </article>
</template>

<script setup lang="ts">
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Check, CheckCheck, GitBranch, Pencil, RefreshCw, Trash2, X } from 'lucide-vue-next';
import { useImeSubmitGuard } from '../../../composables/useImeSubmitGuard.js';
import type {
  ChatMessageEditIntentInput,
  ChatMessageIntentInput
} from '../application/ChatApplicationController.js';
import type { ChatMessageRenderPreferences } from '../presentation/ChatMessageRenderPreferences.js';
import type { ChatStreamingPresentation } from '../presentation/ChatStreamingPresentation.js';
import {
  buildChatMessageMenu,
  resolveChatMenuPlacement,
  type ChatMenuPlacement,
  type ChatMessageMenuAction
} from '../presentation/chatMenus.js';
import ChatPopoverMenu from './ChatPopoverMenu.vue';
import MessageRenderer from './MessageRenderer.vue';
import TextBlock from './blocks/TextBlock.vue';
import { renderChatMarkdown } from './chatMarkdown.js';

const props = withDefaults(defineProps<{
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
  /** 同一作者连续发言组的首条 / 末条 */
  groupStart?: boolean;
  groupEnd?: boolean;
  /** HH:mm；为空时不显示时间 */
  timeLabel?: string;
  /** 多个 AI 发言者（群聊）。Telegram 单聊不显示对方头像与名字 */
  isGroupConversation?: boolean;
}>(), {
  isGroupConversation: true,
  streaming: false,
  streamingPresentation: undefined,
  groupStart: true,
  groupEnd: true,
  timeLabel: ''
});

const emit = defineEmits<{
  edit: [input: ChatMessageEditIntentInput];
  delete: [input: ChatMessageIntentInput];
  regenerate: [];
  branch: [input: ChatMessageIntentInput];
}>();

const rootRef = ref<HTMLElement | null>(null);
const editing = ref(false);
const editingText = ref('');
const editor = ref<HTMLTextAreaElement | null>(null);
const selected = ref(false);
const imeGuard = useImeSubmitGuard({ debugLabel: 'ChatMessageEditor' });

const layout = computed(() => props.renderPreferences.messageLayout);
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
const isTelegram = computed(() => layout.value === 'telegram');
// Telegram 单聊与原版一致：不显示头像与名字
const hidesPeerIdentity = computed(() => isTelegram.value && !props.isGroupConversation);
const hasAvatarColumn = computed(() => avatarPlacement.value === 'inline' && !hidesPeerIdentity.value);
const effectiveAvatarPlacement = computed(() => (
  avatarPlacement.value === 'inline' && !hasAvatarColumn.value ? 'hidden' : avatarPlacement.value
));
// Telegram 头像落在一组消息的最后一条，其余布局落在第一条
const isAvatarAnchor = computed(() => (layout.value === 'telegram' ? props.groupEnd : props.groupStart));
const showInlineAvatar = computed(() => hasAvatarColumn.value && isAvatarAnchor.value);
const showMessageMeta = computed(() => (
  props.groupStart
  && props.renderPreferences.showUsernames
  && avatarPlacement.value !== 'topbar'
  && !(isTelegram.value && (props.message.is_user || hidesPeerIdentity.value))
));
const showMetaTime = computed(() => Boolean(props.timeLabel) && layout.value !== 'telegram');
const showGutterTime = computed(() => layout.value === 'discord' && Boolean(props.timeLabel));
const showBubbleTime = computed(() => layout.value === 'telegram' && Boolean(props.timeLabel) && !props.streaming);
// 时间戳绝对定位在气泡右下角，正文末尾留出等宽的浮动占位，末行放不下时自动换行
const bubbleTimeStyle = computed(() => (
  showBubbleTime.value
    ? { '--lw-message-stamp-width': props.message.is_user ? '58px' : '40px' }
    : undefined
));

const startEditing = (): void => {
  editingText.value = props.message.mesRaw || props.message.mes;
  editing.value = true;
  selected.value = false;
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

const usesMessageMenu = computed(() => isTelegram.value);
const menuOpen = ref(false);
const menuPlacement = ref<ChatMenuPlacement>('below');
const bubbleRef = ref<HTMLElement | null>(null);
const messageMenu = computed(() => buildChatMessageMenu({ isUser: props.message.is_user === true, disabled: props.disabled }));
/** 菜单的大致高度：每项 46px + 上下内边距 */
const estimatedMenuHeight = computed(() => messageMenu.value.length * 46 + 14);

const openMenu = (): void => {
  const bubble = bubbleRef.value;
  const scroller = rootRef.value?.closest('.chat-transcript');
  if (bubble && scroller) {
    const bubbleRect = bubble.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    menuPlacement.value = resolveChatMenuPlacement({
      anchorTop: bubbleRect.top,
      anchorBottom: bubbleRect.bottom,
      viewport: { top: scrollerRect.top, bottom: scrollerRect.bottom },
      menuHeight: estimatedMenuHeight.value
    });
  }
  menuOpen.value = true;
};

const isInteractiveTarget = (event: Event): boolean => {
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(target?.closest('a, button, input, textarea, select, summary, [role="button"], [role="menu"]'));
};

const hasTextSelection = (): boolean => {
  const selection = rootRef.value?.ownerDocument.getSelection();
  return Boolean(selection && !selection.isCollapsed);
};

/** 点按消息：Telegram 弹出消息菜单，其余布局切换操作栏（触屏没有悬停）。 */
const handleRowClick = (event: MouseEvent): void => {
  if (props.streaming || editing.value || isInteractiveTarget(event) || hasTextSelection()) return;
  if (usesMessageMenu.value) {
    if (menuOpen.value) menuOpen.value = false;
    else openMenu();
    return;
  }
  selected.value = !selected.value;
};

/** 桌面右键同样弹出 Telegram 消息菜单；选中文字时保留浏览器原生菜单以便复制。 */
const handleContextMenu = (event: MouseEvent): void => {
  if (!usesMessageMenu.value || props.streaming || editing.value || isInteractiveTarget(event) || hasTextSelection()) return;
  event.preventDefault();
  openMenu();
};

const copyMessage = async (): Promise<void> => {
  const text = props.message.mesRaw || props.message.mes;
  try {
    await navigator.clipboard.writeText(text);
  } catch (error: unknown) {
    console.warn('[ChatMessage] 复制消息失败', error);
  }
};

const handleMenuSelect = (id: string): void => {
  menuOpen.value = false;
  const action = id as ChatMessageMenuAction;
  if (action === 'copy') void copyMessage();
  else if (action === 'edit') startEditing();
  else if (action === 'regenerate') emit('regenerate');
  else if (action === 'branch') emit('branch', { message: props.message, index: props.index });
  else if (action === 'delete') emit('delete', { message: props.message, index: props.index });
};

const handleOutsidePointer = (event: PointerEvent): void => {
  const path = event.composedPath();
  if (rootRef.value && !path.includes(rootRef.value)) selected.value = false;
};

watch(selected, (isSelected) => {
  const doc = rootRef.value?.ownerDocument;
  if (!doc) return;
  if (isSelected) doc.addEventListener('pointerdown', handleOutsidePointer, true);
  else doc.removeEventListener('pointerdown', handleOutsidePointer, true);
});

onBeforeUnmount(() => {
  rootRef.value?.ownerDocument.removeEventListener('pointerdown', handleOutsidePointer, true);
});
</script>

<style scoped>
/* ---------- 行布局 ---------- */
.chat-message {
  position: relative;
  display: grid;
  grid-template-columns: var(--lw-chat-avatar-size, 36px) minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  margin-top: var(--lw-chat-group-gap, 8px);
  border-radius: 8px;
  transition: background-color var(--lw-transition);
}

.chat-message[data-group-start='true'] {
  margin-top: var(--lw-chat-content-gap, 20px);
}

.chat-message:hover,
.chat-message.is-selected {
  background: var(--lw-chat-message-hover-bg, transparent);
}

.chat-message:not([data-avatar-placement='inline']) {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}

.chat-message.is-user[data-avatar-placement='inline'] {
  grid-template-columns: minmax(0, 1fr) var(--lw-chat-avatar-size, 36px);
}

.chat-message.is-user .chat-message__gutter {
  grid-column: 2;
  grid-row: 1;
}

.chat-message.is-user .chat-message__body {
  grid-column: 1;
  grid-row: 1;
  align-items: flex-end;
}

.chat-message__gutter {
  display: flex;
  justify-content: center;
  min-height: 1px;
}

.chat-message__avatar {
  width: var(--lw-chat-avatar-size, 36px);
  height: var(--lw-chat-avatar-size, 36px);
  border-radius: var(--lw-chat-avatar-radius, 8px);
  box-shadow: var(--lw-chat-avatar-shadow, none);
  object-fit: cover;
  background: var(--lw-bg-subtle);
}

.chat-message__gutter-time {
  padding-top: 0.25em;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-variant-numeric: tabular-nums;
  opacity: 0;
  transition: opacity var(--lw-transition);
}

.chat-message:hover .chat-message__gutter-time,
.chat-message:focus-within .chat-message__gutter-time,
.chat-message.is-selected .chat-message__gutter-time {
  opacity: 1;
}

.chat-message__body {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.chat-message__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
}

.chat-message__meta strong {
  font-weight: var(--lw-type-label-medium-weight);
}

.chat-message__meta time {
  color: var(--lw-text-muted);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

/* ---------- 气泡与正文 ---------- */
.chat-message__bubble,
.chat-message__editor {
  position: relative;
  width: fit-content;
  min-width: 0;
  max-width: min(100%, var(--lw-chat-message-max-width, 760px));
  border: 1px solid var(--lw-chat-border, var(--lw-border-base));
  border-radius: var(--lw-chat-bubble-radius, 12px);
  background: var(--lw-chat-bubble, var(--lw-bg-surface));
  box-shadow: var(--lw-chat-bubble-shadow, none);
  color: var(--lw-chat-color, var(--lw-text-main));
  padding: 10px 14px;
  font-weight: var(--lw-chat-font-weight, 400);
  font-size: var(--lw-chat-assistant-font-size, var(--lw-chat-font-size, 1rem));
  line-height: var(--lw-chat-assistant-line-height, var(--lw-chat-line-height, 1.6));
  letter-spacing: var(--lw-chat-assistant-letter-spacing, var(--lw-chat-letter-spacing, normal));
  overflow-wrap: anywhere;
}

.chat-message__editor {
  width: 100%;
}

.is-user .chat-message__bubble {
  border-color: var(--lw-chat-user-bubble-border, var(--lw-border-subtle));
  background: var(--lw-chat-user-bubble, color-mix(in srgb, var(--lw-primary) 12%, var(--lw-bg-surface)));
  /* fixed 时渐变按视口分布（Telegram 气泡随位置由紫过渡到蓝） */
  background-attachment: var(--lw-chat-user-bubble-attachment, scroll);
  color: var(--lw-chat-user-color, var(--lw-chat-color, var(--lw-text-main)));
  font-size: var(--lw-chat-user-font-size, var(--lw-chat-font-size, 1rem));
  line-height: var(--lw-chat-user-line-height, var(--lw-chat-line-height, 1.6));
  letter-spacing: var(--lw-chat-user-letter-spacing, var(--lw-chat-letter-spacing, normal));
}

.chat-message[data-message-shape='document'] .chat-message__body {
  align-items: stretch;
}

.chat-message[data-message-shape='document'] .chat-message__bubble,
.chat-message[data-message-shape='document'] .chat-message__editor {
  width: 100%;
  max-width: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

/* Markdown 内容 */
.chat-message__bubble :deep(.lv-text-block__chunk > :first-child) {
  margin-top: 0;
}

.chat-message__bubble :deep(.lv-text-block p),
.chat-message__bubble :deep(.lv-text-block ul),
.chat-message__bubble :deep(.lv-text-block ol),
.chat-message__bubble :deep(.lv-text-block pre),
.chat-message__bubble :deep(.lv-text-block blockquote),
.chat-message__bubble :deep(.lv-text-block table) {
  margin: 0 0 var(--lw-chat-paragraph-spacing, 0.75em);
}

.chat-message__bubble :deep(.lv-text-block__chunk:last-child > :last-child) {
  margin-bottom: 0;
}

.chat-message__bubble :deep(.lv-text-block h1),
.chat-message__bubble :deep(.lv-text-block h2),
.chat-message__bubble :deep(.lv-text-block h3),
.chat-message__bubble :deep(.lv-text-block h4) {
  margin: 0.6em 0 0.4em;
  font-family: var(--lw-font-display, inherit);
  line-height: 1.3;
}

.chat-message__bubble :deep(.lv-text-block h1) { font-size: 1.4em; }
.chat-message__bubble :deep(.lv-text-block h2) { font-size: 1.25em; }
.chat-message__bubble :deep(.lv-text-block h3) { font-size: 1.1em; }
.chat-message__bubble :deep(.lv-text-block h4) { font-size: 1em; }

.chat-message__bubble :deep(.lv-text-block ul),
.chat-message__bubble :deep(.lv-text-block ol) {
  padding-left: 1.4em;
}

.chat-message__bubble :deep(.lv-text-block li + li) {
  margin-top: 0.25em;
}

.chat-message__bubble :deep(.lv-text-block a) {
  color: var(--lw-primary);
  text-underline-offset: 2px;
}

.chat-message__bubble :deep(.lv-text-block code) {
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: color-mix(in srgb, var(--lw-text-main) 7%, transparent);
  font-family: var(--lw-font-mono);
  font-size: 0.88em;
}

.chat-message__bubble :deep(.lv-text-block pre) {
  max-width: 100%;
  overflow-x: auto;
  padding: 10px 12px;
  border: 1px solid var(--lw-border-subtle);
  border-radius: 8px;
  background: color-mix(in srgb, var(--lw-text-main) 5%, transparent);
  line-height: 1.5;
}

.chat-message__bubble :deep(.lv-text-block pre code) {
  padding: 0;
  background: transparent;
  font-size: 0.86em;
}

.chat-message__bubble :deep(.lv-text-block blockquote) {
  padding: 6px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--lw-primary) 7%, transparent);
  color: var(--lw-text-secondary);
}

.chat-message__bubble :deep(.lv-text-block table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 0.94em;
}

.chat-message__bubble :deep(.lv-text-block th),
.chat-message__bubble :deep(.lv-text-block td) {
  padding: 5px 10px;
  border: 1px solid var(--lw-border-base);
  text-align: left;
}

.chat-message__bubble :deep(.lv-text-block th) {
  background: color-mix(in srgb, var(--lw-text-main) 4%, transparent);
  font-weight: 600;
}

.chat-message__bubble :deep(.lv-text-block img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.chat-message__bubble :deep(.lv-text-block hr) {
  margin: 1em 0;
  border: 0;
  border-top: 1px solid var(--lw-border-base);
}

/* ---------- 操作栏 ---------- */
.chat-message__actions {
  position: absolute;
  top: -14px;
  right: 8px;
  z-index: 1;
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--lw-border-base);
  border-radius: 8px;
  background: var(--lw-bg-elevated);
  box-shadow: var(--lw-chat-menu-shadow, var(--lw-shadow-card));
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms cubic-bezier(0.25, 1, 0.5, 1);
}

.chat-message.is-user .chat-message__actions {
  right: auto;
  left: 8px;
}

.chat-message:hover .chat-message__actions,
.chat-message:focus-within .chat-message__actions,
.chat-message.is-selected .chat-message__actions {
  opacity: 1;
  pointer-events: auto;
}

.chat-message__actions button,
.chat-message__editor-actions button {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
}

.chat-message__actions button:hover:not(:disabled),
.chat-message__editor-actions button:hover:not(:disabled) {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.chat-message__actions button:focus-visible,
.chat-message__editor-actions button:focus-visible {
  outline: 2px solid var(--lw-primary);
  outline-offset: 1px;
}

.chat-message__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.chat-message__editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  margin-top: 6px;
}

.chat-message__editor textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--lw-border-base);
  border-radius: 8px;
  background: var(--lw-bg-app);
  color: var(--lw-text-main);
  padding: 9px 10px;
  font: inherit;
}

/* ---------- Discord：所有发言左对齐，续行缩进对齐正文 ---------- */
.chat-message[data-layout='discord'] {
  margin-inline: -12px;
  padding: 2px 12px;
  gap: 16px;
}

.chat-message[data-layout='discord'][data-group-start='true'] {
  padding-top: 4px;
}

.chat-message[data-layout='discord'].is-user {
  grid-template-columns: var(--lw-chat-avatar-size, 40px) minmax(0, 1fr);
}

.chat-message[data-layout='discord'].is-user .chat-message__gutter {
  grid-column: 1;
}

.chat-message[data-layout='discord'].is-user .chat-message__body {
  grid-column: 2;
  align-items: stretch;
}

.chat-message[data-layout='discord'].is-user .chat-message__actions {
  right: 8px;
  left: auto;
}

.chat-message[data-layout='discord'] .chat-message__meta strong {
  color: var(--lw-text-main);
  font-size: 1rem;
  font-weight: 600;
}

/* ---------- Telegram：贴合内容的气泡、末条带尾巴、时间在气泡内 ---------- */
.chat-message[data-layout='telegram'] {
  align-items: end;
}

.chat-message[data-layout='telegram'] .chat-message__bubble {
  /* 留出对侧空白与尾巴，窄屏上气泡不撑满整行 */
  max-width: min(100%, var(--lw-chat-message-max-width, 560px));
  padding: 7px 12px 8px;
}

@media (max-width: 767px) {
  .chat-message[data-layout='telegram'] .chat-message__bubble {
    max-width: min(86%, var(--lw-chat-message-max-width, 560px));
  }
}

/* 同一发言组内相接的两侧收小圆角，视觉上连成一串（与原版一致） */
.chat-message[data-layout='telegram'][data-message-shape='bubble'][data-group-start='false'] .chat-message__bubble {
  border-top-left-radius: var(--lw-chat-bubble-join-radius, 5px);
}

.chat-message[data-layout='telegram'][data-message-shape='bubble'][data-group-end='false'] .chat-message__bubble {
  border-bottom-left-radius: var(--lw-chat-bubble-join-radius, 5px);
}

.chat-message[data-layout='telegram'][data-message-shape='bubble'].is-user[data-group-start='false'] .chat-message__bubble {
  border-top-left-radius: var(--lw-chat-bubble-radius, 16px);
  border-top-right-radius: var(--lw-chat-bubble-join-radius, 5px);
}

.chat-message[data-layout='telegram'][data-message-shape='bubble'].is-user[data-group-end='false'] .chat-message__bubble {
  border-bottom-left-radius: var(--lw-chat-bubble-radius, 16px);
  border-bottom-right-radius: var(--lw-chat-bubble-join-radius, 5px);
}

.chat-message[data-layout='telegram'][data-message-shape='bubble'][data-group-end='true'] .chat-message__bubble {
  border-bottom-left-radius: 4px;
}

.chat-message[data-layout='telegram'][data-message-shape='bubble'].is-user[data-group-end='true'] .chat-message__bubble {
  border-bottom-left-radius: var(--lw-chat-bubble-radius, 16px);
  border-bottom-right-radius: 4px;
}

.chat-message[data-layout='telegram'][data-message-shape='bubble'][data-group-end='true'] .chat-message__bubble::before {
  content: '';
  position: absolute;
  /* 气泡有 1px 透明边框，相对 padding box 下移 1px 才与气泡底边齐平 */
  bottom: -1px;
  left: -8px;
  width: 9px;
  height: 14px;
  background: var(--lw-chat-bubble, var(--lw-bg-surface));
  -webkit-mask: radial-gradient(10px 14px at 0 0, transparent 98%, #000 100%);
  mask: radial-gradient(10px 14px at 0 0, transparent 98%, #000 100%);
}

.chat-message[data-layout='telegram'][data-message-shape='bubble'].is-user[data-group-end='true'] .chat-message__bubble::before {
  right: -8px;
  left: auto;
  background: var(--lw-chat-user-bubble, var(--lw-bg-subtle));
  background-attachment: var(--lw-chat-user-bubble-attachment, scroll);
  -webkit-mask: radial-gradient(10px 14px at 100% 0, transparent 98%, #000 100%);
  mask: radial-gradient(10px 14px at 100% 0, transparent 98%, #000 100%);
}

/* 正文末尾的浮动占位与时间戳等宽：末行有空位时时间与末行同行，否则换到下一行右侧 */
.chat-message__bubble[data-has-time] :deep(.lv-text-block__chunk:last-child > :last-child)::after {
  content: '';
  float: right;
  width: var(--lw-message-stamp-width, 40px);
  height: 1em;
  margin: 0.5em -4px -0.4em 8px;
}

.chat-message__stamp {
  position: absolute;
  right: 10px;
  bottom: 5px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--lw-chat-meta-color, var(--lw-text-muted));
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  pointer-events: none;
  user-select: none;
}

.is-user .chat-message__stamp {
  color: var(--lw-chat-user-meta-color, var(--lw-chat-meta-color, var(--lw-text-muted)));
}

.chat-message[data-layout='telegram'].is-user .chat-message__bubble :deep(a) {
  color: inherit;
  text-decoration: underline;
}

.chat-message[data-layout='telegram'] {
  /* Telegram 不做整行悬停高亮，点按弹出菜单 */
  cursor: default;
}

.chat-message[data-layout='telegram']:hover {
  background: transparent;
}

@media (prefers-reduced-motion: reduce) {
  .chat-message,
  .chat-message__actions,
  .chat-message__gutter-time {
    transition: none;
  }
}
</style>
