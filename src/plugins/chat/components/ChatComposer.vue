<template>
  <div class="chat-composer" :class="{ 'is-compact': compact }" :data-layout="layout">
    <div v-if="viewState.readOnlyReason" class="chat-composer__notice">
      {{ viewState.readOnlyReason }}
    </div>
    <div class="chat-composer__input" :class="{ 'has-leading': Boolean($slots.leading) }">
      <slot name="leading" :has-draft="Boolean(draft.trim())" />
      <textarea
        ref="textarea"
        :value="draft"
        rows="1"
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
      <!-- Telegram 空输入时不显示发送键（原版此处为语音键，本项目无语音功能） -->
      <button
        v-else-if="layout !== 'telegram' || draft.trim()"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Send, Square } from 'lucide-vue-next';
import { useImeSubmitGuard } from '../../../composables/useImeSubmitGuard.js';
import type { ConversationViewContext } from '../../../types/ConversationContextTypes.js';
import type {
  ChatApplicationSnapshot,
  ChatGenerationState
} from '../application/ChatApplicationController.js';
import type { ChatMessageLayout } from '../presentation/ChatMessageRenderPreferences.js';
import { focusChatComposerInput } from '../presentation/ChatPresentationInteractions.js';
import { resolveChatViewState } from '../chatViewState.js';

const props = withDefaults(defineProps<{
  layout?: ChatMessageLayout;
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
}>(), {
  layout: 'classic',
  placeholder: undefined
});

/** Telegram 输入框随内容增高（单行起步，最多约 8 行），其余布局保留手动拖拽 */
const TELEGRAM_COMPOSER_MAX_HEIGHT_PX = 200;

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
const effectivePlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder;
  // Telegram 只在可正常输入时使用原版的简短提示，只读与切换中的说明保持不变
  if (props.layout === 'telegram' && !disabled.value) return '输入消息';
  return viewState.value.inputPlaceholder;
});

const autosize = (): void => {
  const element = textarea.value;
  if (!element || props.layout !== 'telegram') return;
  element.style.height = 'auto';
  // 空草稿回到 CSS 的单行最小高度：挂载时宿主可能尚未完成布局（宽度极窄），
  // 此时测得的 scrollHeight 会把 placeholder 折成多行，导致输入栏凭空变高
  if (!element.value) {
    element.style.height = '';
    return;
  }
  // 内容仍能放进单行最小高度时不写死内联高度：避免挂载竞态或宽度抖动残留出多行高度
  const singleLineHeight = Number.parseFloat(getComputedStyle(element).minHeight) || 0;
  const contentHeight = Math.min(element.scrollHeight, TELEGRAM_COMPOSER_MAX_HEIGHT_PX);
  element.style.height = contentHeight <= singleLineHeight ? '' : `${contentHeight}px`;
};

watch(() => props.draft, () => void nextTick(autosize));
watch(() => props.layout, () => {
  if (textarea.value && props.layout !== 'telegram') textarea.value.style.height = '';
  void nextTick(autosize);
});

// 宽度变化（侧栏拖拽、窗口缩放、首次布局完成）会改变折行，需要重新测量
let resizeObserver: ResizeObserver | null = null;
let observedWidth = 0;
onMounted(() => {
  autosize();
  const element = textarea.value;
  if (!element || typeof ResizeObserver === 'undefined') return;
  observedWidth = element.clientWidth;
  resizeObserver = new ResizeObserver(() => {
    if (element.clientWidth === observedWidth) return;
    observedWidth = element.clientWidth;
    autosize();
  });
  resizeObserver.observe(element);
});
onBeforeUnmount(() => resizeObserver?.disconnect());

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
  min-height: 40px;
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

.chat-composer__input.has-leading {
  grid-template-columns: auto minmax(0, 1fr) 40px;
}

/* ---------- Telegram：浮动胶囊，左侧菜单键、右侧圆形发送键 ---------- */
.chat-composer[data-layout='telegram'] .chat-composer__input {
  position: relative;
  z-index: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: end;
  border: 1px solid var(--lw-chat-floating-border, var(--lw-chat-input-border, var(--lw-border-base)));
  border-radius: var(--lw-chat-input-radius, 26px);
  background: var(--lw-chat-floating-bg, var(--lw-chat-input-surface, var(--lw-bg-surface)));
  box-shadow: var(--lw-chat-floating-shadow, none);
  padding: 4px;
}

/* 模糊由伪元素承担：容器自身带 backdrop-filter 会成为 backdrop root，
   使菜单等子元素无法采样壁纸、失去磨砂效果 */
.chat-composer[data-layout='telegram'] .chat-composer__input::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  backdrop-filter: var(--lw-chat-floating-blur, none);
  -webkit-backdrop-filter: var(--lw-chat-floating-blur, none);
}

.chat-composer[data-layout='telegram'] .chat-composer__input.has-leading {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.chat-composer[data-layout='telegram'] .chat-composer__input:focus-within {
  border-color: var(--lw-chat-floating-border, var(--lw-border-base));
  box-shadow: var(--lw-chat-floating-shadow, none);
}

.chat-composer[data-layout='telegram'] textarea {
  min-height: 40px;
  max-height: 200px;
  resize: none;
  padding: 9px 6px 9px 12px;
  font-size: var(--lw-chat-font-size, var(--lw-type-body-large-size));
  line-height: 22px;
}

.chat-composer[data-layout='telegram'] .chat-composer__input.has-leading textarea {
  padding-left: 4px;
}

.chat-composer[data-layout='telegram'] textarea::placeholder {
  color: var(--lw-text-muted);
}

.chat-composer[data-layout='telegram'] .chat-composer__action {
  width: 40px;
  height: 40px;
  align-self: center;
  border-radius: 999px;
  animation: chat-composer-action-in 160ms cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes chat-composer-action-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

.chat-composer[data-layout='telegram'] .chat-composer__notice {
  margin: 0 12px 6px;
}

@media (prefers-reduced-motion: reduce) {
  .chat-composer[data-layout='telegram'] .chat-composer__action {
    animation: none;
  }
}
</style>
