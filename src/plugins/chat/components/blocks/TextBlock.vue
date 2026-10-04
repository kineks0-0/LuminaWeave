<template>
  <!-- 文本渲染块：按空行增量分块渲染 Markdown，已完成的块不再重建 -->
  <div
    ref="rootRef"
    class="lv-text-block"
    :class="{
      'is-streaming': streaming,
      'is-trail': presentation?.revealMode === 'trail',
      'is-caret-blinking': presentation?.caretBlink
    }"
    :style="revealStyle"
  >
    <div v-for="block in blocks" :key="block.key" class="lv-text-block__chunk" v-html="block.html"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  advanceTextBlocks,
  type TextBlocksState,
  type TextRenderBlock
} from '../../presentation/incrementalTextBlocks.js';
import type { ChatStreamingPresentation } from '../../presentation/ChatStreamingPresentation.js';
import { buildHtmlBlockDocument, parseHtmlBlockMessage } from '../../presentation/chatHtmlBlocks.js';
import {
  createRevealTracker,
  recordRevealProgress,
  resolveActiveRevealRanges,
  type RevealTracker
} from '../../presentation/streamReveal.js';
import { applyRevealRanges, clearRevealSpans, markCaretHost } from '../streaming/revealDom.js';

const props = withDefaults(defineProps<{
  /** 原始文本内容 */
  text: string;
  /** 外部传入的 Markdown 渲染函数 */
  renderFn: (text: string) => string;
  /** 是否为正在流式输出的末段文本 */
  streaming?: boolean;
  /** 流式显现效果；仅在 streaming 时生效 */
  presentation?: ChatStreamingPresentation;
  /** 是否把 ```html 代码块渲染为沙箱交互组件 */
  renderHtmlBlocks?: boolean;
  /** HTML 交互块请求填入输入框 / 直接发送 */
  onHtmlAction?: (text: string, mode: 'fill' | 'send') => void;
}>(), {
  streaming: false,
  presentation: undefined,
  renderHtmlBlocks: false,
  onHtmlAction: undefined
});

const rootRef = ref<HTMLElement | null>(null);
let blocksState: TextBlocksState | null = null;
let revealTracker: RevealTracker | null = null;
const htmlFrames = new Set<HTMLIFrameElement>();

const blocks = computed<readonly TextRenderBlock[]>(() => {
  blocksState = advanceTextBlocks(blocksState, props.text || '', props.renderFn);
  return blocksState.blocks;
});

const revealStyle = computed(() => (
  props.presentation && props.presentation.durationMs > 0
    ? { '--lw-reveal-duration': `${props.presentation.durationMs}ms` }
    : undefined
));

const decorate = (): void => {
  const root = rootRef.value;
  if (!root) return;
  clearRevealSpans(root);

  const length = root.textContent?.length ?? 0;
  const presentation = props.presentation;
  const revealing = Boolean(props.streaming && presentation && presentation.revealMode !== 'none');

  if (!revealing || !presentation) {
    revealTracker = null;
  } else {
    const now = performance.now();
    revealTracker = revealTracker
      ? recordRevealProgress(revealTracker, length, now, presentation.durationMs)
      : createRevealTracker(length);
    applyRevealRanges(root, resolveActiveRevealRanges(revealTracker, now, presentation.durationMs));
  }

  markCaretHost(root, Boolean(props.streaming && presentation?.caret));
  mountHtmlBlocks();
};

const isTrailingChunk = (element: HTMLElement): boolean => {
  const root = rootRef.value;
  const chunk = element.closest('.lv-text-block__chunk');
  if (!root || !chunk) return false;
  const chunks = Array.from(root.children).filter(child => child.classList.contains('lv-text-block__chunk'));
  return chunks[chunks.length - 1] === chunk;
};

/** 把 ```html 代码块替换为沙箱 iframe；流式末段保持代码展示，避免半截 HTML 反复重建。 */
const mountHtmlBlocks = (): void => {
  const root = rootRef.value;
  if (!root || !props.renderHtmlBlocks) return;
  const codes = Array.from(root.querySelectorAll<HTMLElement>('pre > code.language-html'));
  for (const code of codes) {
    const pre = code.parentElement;
    if (!pre) continue;
    if (props.streaming && isTrailingChunk(pre)) continue;
    const raw = code.textContent ?? '';
    if (!raw.trim()) continue;
    const frame = root.ownerDocument.createElement('iframe');
    frame.className = 'lv-html-block-frame';
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('title', '交互组件');
    frame.setAttribute('srcdoc', buildHtmlBlockDocument(raw));
    frame.style.width = '100%';
    frame.style.height = '220px';
    frame.style.border = '0';
    frame.style.display = 'block';
    pre.replaceWith(frame);
    htmlFrames.add(frame);
  }
};

const handleHtmlBlockMessage = (event: MessageEvent): void => {
  if (htmlFrames.size === 0) return;
  let frame: HTMLIFrameElement | null = null;
  for (const candidate of htmlFrames) {
    if (candidate.contentWindow === event.source) {
      frame = candidate;
      break;
    }
  }
  if (!frame) return;
  const action = parseHtmlBlockMessage(event.data);
  if (!action) return;
  if (action.type === 'resize') {
    frame.style.height = `${Math.max(120, Math.ceil(action.height))}px`;
    return;
  }
  props.onHtmlAction?.(action.text, action.type === 'send' ? 'send' : 'fill');
};

watch([blocks, () => props.streaming, () => props.presentation], decorate, { flush: 'post' });
onMounted(() => {
  decorate();
  window.addEventListener('message', handleHtmlBlockMessage);
});
onBeforeUnmount(() => {
  window.removeEventListener('message', handleHtmlBlockMessage);
  htmlFrames.clear();
});
</script>

<style scoped>
.lv-text-block {
  overflow-wrap: break-word;
  letter-spacing: var(--lw-chat-letter-spacing, normal);
}

.lv-text-block :deep(.lv-html-block-frame) {
  display: block;
  width: 100%;
  margin: 8px 0;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-subtle);
}

.lv-text-block :deep(.lw-reveal) {
  animation: lw-text-reveal var(--lw-reveal-duration, 220ms) cubic-bezier(0.25, 1, 0.5, 1) both;
}

.lv-text-block.is-trail :deep(.lw-reveal) {
  animation-timing-function: cubic-bezier(0.33, 0, 0.2, 1);
}

.lv-text-block :deep(.lw-caret-host)::after {
  content: '';
  display: inline-block;
  width: 0.5em;
  height: 1.05em;
  margin-left: 0.12em;
  vertical-align: text-bottom;
  border-radius: 1px;
  background: currentColor;
  opacity: 0.55;
}

.lv-text-block.is-caret-blinking :deep(.lw-caret-host)::after {
  animation: lw-caret-blink 1s steps(1, end) infinite;
}

@keyframes lw-text-reveal {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes lw-caret-blink {
  50% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .lv-text-block :deep(.lw-reveal),
  .lv-text-block :deep(.lw-caret-host)::after {
    animation: none;
  }
}
</style>
