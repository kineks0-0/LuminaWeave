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
import { computed, onMounted, ref, watch } from 'vue';
import {
  advanceTextBlocks,
  type TextBlocksState,
  type TextRenderBlock
} from '../../presentation/incrementalTextBlocks.js';
import type { ChatStreamingPresentation } from '../../presentation/ChatStreamingPresentation.js';
import {
  createRevealTracker,
  recordRevealProgress,
  resolveActiveRevealRanges,
  type RevealTracker
} from '../../presentation/streamReveal.js';
import { applyRevealRanges, clearRevealSpans, markCaretHost } from '../streaming/revealDom.js';

const props = defineProps<{
  /** 原始文本内容 */
  text: string;
  /** 外部传入的 Markdown 渲染函数 */
  renderFn: (text: string) => string;
  /** 是否为正在流式输出的末段文本 */
  streaming?: boolean;
  /** 流式显现效果；仅在 streaming 时生效 */
  presentation?: ChatStreamingPresentation;
}>();

const rootRef = ref<HTMLElement | null>(null);
let blocksState: TextBlocksState | null = null;
let revealTracker: RevealTracker | null = null;

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
};

watch([blocks, () => props.streaming, () => props.presentation], decorate, { flush: 'post' });
onMounted(decorate);
</script>

<style scoped>
.lv-text-block {
  overflow-wrap: break-word;
  letter-spacing: var(--lw-chat-letter-spacing, normal);
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
