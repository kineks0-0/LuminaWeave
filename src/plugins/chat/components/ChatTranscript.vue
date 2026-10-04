<template>
  <div ref="scrollArea" class="chat-transcript" :class="{ 'is-compact': compact }">
    <div ref="contentArea" class="chat-transcript__content" :class="{ 'is-revealing': contentRevealing }">
      <div v-if="showEmptyState" class="chat-transcript__empty">
        <div class="chat-transcript__empty-card">
          <span class="chat-transcript__empty-mark" aria-hidden="true">
            <MessageCircle :size="22" />
          </span>
          <strong>{{ viewState.isNoActiveChatView ? '没有打开的聊天' : '开始新的对话' }}</strong>
          <p>{{ viewState.isNoActiveChatView ? viewState.emptyStateMessage : '在下方输入第一条消息。' }}</p>
        </div>
      </div>
      <div v-if="viewState.readOnlyReason" class="chat-transcript__notice">
        {{ viewState.readOnlyReason }}
      </div>

      <template v-for="(message, index) in messages" :key="message.id || index">
        <div v-if="messageGroups[index]?.dayLabel" class="chat-transcript__day" role="separator">
          <span>{{ messageGroups[index].dayLabel }}</span>
        </div>
        <ChatMessage
          :message="message"
          :index="index"
          :avatar-url="resolveMessageAvatar(message)"
          :default-avatar="defaultAvatar"
          :disabled="interactionLocked"
          :render-preferences="renderPreferences"
          :on-select-choice="onSelectChoice"
          :on-html-action="onHtmlAction"
          :group-start="messageGroups[index]?.groupStart ?? true"
          :group-end="messageGroups[index]?.groupEnd ?? true"
          :time-label="messageGroups[index]?.timeLabel ?? ''"
          :is-group-conversation="groupConversation"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
          @regenerate="emit('regenerate')"
          @branch="emit('branch', $event)"
        />
      </template>

      <ChatStreamingMessage
        :generation="generation"
        :visible="showStreaming"
        :render-preferences="renderPreferences"
        :assistant-name="assistantName"
        :assistant-avatar-url="assistantAvatarUrl"
        :default-avatar="defaultAvatar"
        :group-start="streamingGroup?.groupStart ?? true"
        :time-label="streamingGroup?.timeLabel ?? ''"
        :is-group-conversation="groupConversation"
        @retry="emit('regenerate')"
      />
    </div>
    <LuminaJumpToLatest :visible="showJumpToLatest" @jump="jumpToLatest" />
  </div>
</template>

<script setup lang="ts">
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { computed, ref, watch } from 'vue';
import { MessageCircle } from 'lucide-vue-next';
import type { CharacterChannelState, ConversationViewContext } from '../../../types/ConversationContextTypes.js';
import type {
  ChatApplicationSnapshot,
  ChatGenerationState,
  ChatMessageEditIntentInput,
  ChatMessageIntentInput
} from '../application/ChatApplicationController.js';
import type { ChatMessageRenderPreferences } from '../presentation/ChatMessageRenderPreferences.js';
import { resolveChatViewState } from '../chatViewState.js';
import { buildChatMessageGroups, isGroupConversation } from '../presentation/chatMessageGrouping.js';
import { useStickToBottom } from '../../../composables/useStickToBottom.js';
import LuminaJumpToLatest from '../../../ui/primitives/LuminaJumpToLatest.vue';
import ChatMessage from './ChatMessage.vue';
import ChatStreamingMessage from './ChatStreamingMessage.vue';

const props = defineProps<{
  messages: LuminaChatMessage[];
  /** 消息暂缓挂载（会话切换中或宿主页面过渡中）：不显示空状态占位 */
  messagesPending?: boolean;
  context: ConversationViewContext;
  generation: ChatGenerationState;
  presentation: ChatApplicationSnapshot['presentation'];
  characterState: CharacterChannelState;
  compact: boolean;
  defaultAvatar: string;
  resolveMessageAvatar: (message: LuminaChatMessage) => string;
  renderPreferences: ChatMessageRenderPreferences;
  onSelectChoice: (text: string) => void;
  /** HTML 交互块请求填入输入框 / 直接发送 */
  onHtmlAction?: (text: string, mode: 'fill' | 'send') => void;
}>();

const emit = defineEmits<{
  edit: [input: ChatMessageEditIntentInput];
  delete: [input: ChatMessageIntentInput];
  regenerate: [];
  branch: [input: ChatMessageIntentInput];
}>();

const scrollArea = ref<HTMLElement | null>(null);
const contentArea = ref<HTMLElement | null>(null);
const { showJumpToLatest, forceFollow, followIfNeeded, jumpToLatest } = useStickToBottom(scrollArea, contentArea);
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
const showEmptyState = computed(() => props.messages.length === 0 && !showStreaming.value && !sessionSwitching.value && !props.messagesPending);

// 消息从暂缓（会话切换 / 宿主页面过渡）恢复时做一次 150ms 淡入，避免整段消息硬弹出。
const contentRevealing = ref(false);
watch(() => props.messagesPending, (pending) => {
  if (pending) {
    contentRevealing.value = false;
    return;
  }
  requestAnimationFrame(() => {
    contentRevealing.value = true;
  });
});

// 流式回复作为虚拟末条参与分组，结束后替换为正式消息时分组结果不变，不产生头像/名称跳动
const streamingStartedAt = ref(Date.now());
watch(() => props.generation.phase, (phase, previousPhase) => {
  if (phase === 'running' && previousPhase !== 'running') streamingStartedAt.value = Date.now();
});
const hasStreamingRow = computed(() => showStreaming.value && Boolean(props.generation.stream?.processed));
const allGroups = computed(() => buildChatMessageGroups(hasStreamingRow.value
  ? [...props.messages, {
    id: '__lumina_streaming__',
    parentId: null,
    name: assistantName.value,
    role: 'assistant',
    is_user: false,
    mesRaw: '',
    mes: '',
    fingerprint: '',
    extra: {},
    createdAt: streamingStartedAt.value
  }]
  : props.messages));
const groupConversation = computed(() => isGroupConversation(props.messages));
const messageGroups = computed(() => allGroups.value.slice(0, props.messages.length));
const streamingGroup = computed(() => (hasStreamingRow.value ? allGroups.value[props.messages.length] : undefined));

const latestAssistantMessage = computed(() => {
  for (let index = props.messages.length - 1; index >= 0; index -= 1) {
    if (!props.messages[index].is_user) return props.messages[index];
  }
  return null;
});
const assistantName = computed(() => (
  latestAssistantMessage.value?.name?.trim()
  || props.characterState.status.characterName.trim()
  || 'Assistant'
));
const assistantAvatarUrl = computed(() => (
  latestAssistantMessage.value ? props.resolveMessageAvatar(latestAssistantMessage.value) : props.defaultAvatar
));

// 用户发送新消息时回到底部并恢复跟随；其余增高由 useStickToBottom 的尺寸观察处理。
watch(
  () => props.messages[props.messages.length - 1],
  (lastMessage, previousLastMessage) => {
    if (lastMessage?.is_user && lastMessage.id !== previousLastMessage?.id) forceFollow();
  }
);

// 切换会话后从最新处开始阅读
watch(() => props.context.sessionId, () => forceFollow());

watch(
  () => props.presentation.scrollRequest?.revision,
  () => {
    const request = props.presentation.scrollRequest;
    if (!request) return;
    if (request.force) {
      forceFollow();
    } else {
      followIfNeeded();
    }
  }
);
</script>

<style scoped>
.chat-transcript {
  min-height: 0;
  flex: 1;
  overflow: auto;
  /* 浮动顶栏（Telegram）覆盖的高度：内容从其下方开始，向上滚动时从顶栏后方经过 */
  padding-top: var(--chat-header-overlap, 0px);
  overscroll-behavior: contain;
  background: var(--lw-chat-scroll-bg, none);
  background-size: var(--lw-chat-scroll-bg-size, auto);
  background-attachment: local;
}

.chat-transcript__content {
  display: flex;
  width: min(100%, var(--lw-chat-page-width, 920px));
  min-height: 100%;
  margin: 0 auto;
  padding: var(--lw-chat-scroll-padding, 24px 32px);
  flex-direction: column;
  /* 消息间距由 ChatMessage 按发言组控制；未跟随时浏览器锚定保持阅读位置 */
  overflow-anchor: auto;
}

.chat-transcript__content > :first-child {
  margin-top: 0;
}

.chat-transcript.is-compact .chat-transcript__content {
  padding: 14px 12px;
}

.chat-transcript__empty {
  display: flex;
  flex: 1;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--lw-text-muted);
  text-align: center;
}

/* 仅在皮肤声明了提示卡背景时成卡（Telegram：壁纸之上承托文字） */
.chat-transcript__empty-card {
  display: flex;
  max-width: min(100%, 320px);
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: var(--lw-chat-empty-card-padding, 0);
  border-radius: var(--lw-chat-empty-card-radius, 0);
  background: var(--lw-chat-empty-card-bg, transparent);
  box-shadow: var(--lw-chat-empty-card-shadow, none);
  backdrop-filter: var(--lw-chat-floating-blur, none);
  -webkit-backdrop-filter: var(--lw-chat-floating-blur, none);
}

.chat-transcript__empty-mark {
  display: grid;
  width: 48px;
  height: 48px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 999px;
  background: var(--lw-chat-empty-mark-bg, var(--lw-bg-subtle));
  box-shadow: var(--lw-chat-empty-mark-shadow, none);
  color: var(--lw-primary);
}

.chat-transcript__empty strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
}

.chat-transcript__empty p {
  max-width: 36ch;
  margin: 0;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
}

.chat-transcript__day {
  display: flex;
  justify-content: center;
  margin: var(--lw-chat-content-gap, 20px) 0 0;
}

.chat-transcript__day span {
  padding: var(--lw-chat-day-padding, 2px 10px);
  border-radius: 999px;
  background: var(--lw-chat-day-bg, color-mix(in srgb, var(--lw-bg-elevated) 82%, transparent));
  color: var(--lw-chat-day-color, var(--lw-text-muted));
  font-size: var(--lw-chat-day-font-size, var(--lw-type-label-small-size));
  font-weight: var(--lw-chat-day-font-weight, 400);
  line-height: var(--lw-type-label-small-line-height);
  backdrop-filter: var(--lw-chat-floating-blur, none);
  -webkit-backdrop-filter: var(--lw-chat-floating-blur, none);
}

.chat-transcript__notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: var(--lw-chat-content-gap, 20px);
  border: 1px solid var(--lw-border-base);
  border-radius: 8px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  padding: 9px 11px;
  font-size: var(--lw-type-body-small-size);
}

/* 壁纸在滚动容器上、本体不参与淡入，只让消息内容淡入 */
.chat-transcript__content.is-revealing {
  animation: chat-transcript-reveal 150ms cubic-bezier(0.33, 1, 0.68, 1) both;
}

@keyframes chat-transcript-reveal {
  from { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .chat-transcript__content.is-revealing {
    animation: none;
  }
}

[data-motion='none'] .chat-transcript__content.is-revealing {
  animation: none;
}
</style>
