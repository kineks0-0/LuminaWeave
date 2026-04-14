<template>
  <div class="thinking-block" :class="{ 'is-open': isOpen }">
    <button
      class="thinking-summary"
      :class="`variant-${variant}`"
      type="button"
      :aria-expanded="isOpen"
      @click="toggleOpen"
    >
      <span class="thinking-summary-main">
        <span v-if="variant !== 'codex'" class="thinking-icon" :class="{ 'is-streaming': isStreaming }" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M12 2.75 14.3 7.7l4.95 2.3-4.95 2.3L12 17.25l-2.3-4.95-4.95-2.3 4.95-2.3zM18.4 13.8l.96 2.04 2.04.96-2.04.96-.96 2.04-.96-2.04-2.04-.96 2.04-.96zM6.3 14.8l1.1 2.36 2.36 1.1-2.36 1.1-1.1 2.36-1.1-2.36-2.36-1.1 2.36-1.1z"
            />
          </svg>
        </span>

        <span class="thinking-copy">
          <span class="thinking-title">
            {{ titleText }}
          </span>
          <span v-if="durationText && variant === 'codex'" class="thinking-duration">{{ durationText }}</span>
          <span v-else class="thinking-meta">
            {{ metaText }}
          </span>
        </span>
      </span>

      <span class="thinking-caret" aria-hidden="true">
        <svg viewBox="0 0 16 16" focusable="false">
          <path d="m4.25 6.5 3.75 3.75L11.75 6.5" />
        </svg>
      </span>
    </button>

    <div class="thinking-panel" :style="panelStyle">
      <div ref="panelInnerRef" class="thinking-flow" role="list" aria-label="thinking trace">
        <div
          v-for="(entry, index) in entries"
          :key="`${index}-${entry.slice(0, 24)}`"
          class="thinking-entry"
          role="listitem"
        >
          <span class="thinking-entry-node" aria-hidden="true"></span>
          <div class="thinking-entry-content" v-html="renderFn(entry)"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
  text: string;
  renderFn: (text: string) => string;
  isStreaming?: boolean;
  hasVisibleContent?: boolean;
  variant?: 'default' | 'codex';
  /**
   * 自动展开模式：无输出内容时展开思考，有输出内容时收起。
   * 对应设置项 lumina-settings.thinkingAutoExpand。
   */
  autoExpand?: boolean;
}>();

// 初始展开状态：流式中 或 (autoExpand 且无可见内容)
const isOpen = ref(Boolean(props.isStreaming) || (props.autoExpand && !props.hasVisibleContent));
const variant = computed(() => props.variant || 'default');
const elapsedSeconds = ref<number | null>(props.isStreaming ? 1 : null);
const panelInnerRef = ref<HTMLElement | null>(null);
const panelHeight = ref(0);
let durationTimer: ReturnType<typeof setInterval> | null = null;

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
};

const startDurationTimer = () => {
  stopDurationTimer();
  const startedAt = Date.now();
  elapsedSeconds.value = 1;
  durationTimer = setInterval(() => {
    elapsedSeconds.value = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  }, 1000);
};

watch(
  () => props.isStreaming,
  (nextStreaming, previousStreaming) => {
    if (nextStreaming && !previousStreaming) {
      if (!props.hasVisibleContent) {
        isOpen.value = true;
      }
      startDurationTimer();
      return;
    }

    if (!nextStreaming && previousStreaming) {
      stopDurationTimer();
      // autoExpand 模式：流式结束后，若无内容则保持展开；否则（默认）收起
      if (!props.hasVisibleContent) {
        if (!props.autoExpand) {
          isOpen.value = false;
        }
        // autoExpand=true 时保持展开，等待 hasVisibleContent 变化再收起
      }
    }
  },
  { immediate: true }
);

watch(
  () => props.hasVisibleContent,
  (nextHasVisibleContent, previousHasVisibleContent) => {
    if (nextHasVisibleContent && !previousHasVisibleContent) {
      isOpen.value = false;
    }
    // autoExpand 模式：内容消失时重新展开（例如切换消息）
    if (!nextHasVisibleContent && previousHasVisibleContent && props.autoExpand) {
      isOpen.value = true;
    }
  },
  { immediate: true }
);

const durationText = computed(() => {
  if (elapsedSeconds.value == null) return '';
  return `${elapsedSeconds.value}s`;
});

const titleText = computed(() => {
  if (variant.value === 'codex') {
    return 'Thought';
  }
  return props.isStreaming ? '思考中' : '已思考';
});

const metaText = computed(() => {
  if (variant.value === 'codex') {
    return props.isStreaming ? 'Working through the request' : 'Show reasoning trace';
  }
  return props.isStreaming ? '正在生成内部推演轨迹' : '展开查看内部推演过程';
});

const entries = computed(() => {
  const blocks = props.text
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  if (blocks.length !== 1) {
    return blocks;
  }

  const singleBlockLines = blocks[0]
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const looksLikeList = singleBlockLines.length > 1 && singleBlockLines.every(line => /^([-*•]|\d+\.)\s+/.test(line));
  if (!looksLikeList) {
    return blocks;
  }

  return singleBlockLines.map(line => line.replace(/^([-*•]|\d+\.)\s+/, '').trim()).filter(Boolean);
});

const measurePanel = () => {
  panelHeight.value = panelInnerRef.value?.scrollHeight || 0;
};

watch(entries, () => {
  void nextTick(measurePanel);
}, { deep: true });

watch(isOpen, () => {
  void nextTick(measurePanel);
});

const panelStyle = computed(() => ({
  maxHeight: isOpen.value ? `${Math.max(panelHeight.value, 1)}px` : '0px',
  opacity: isOpen.value ? '1' : '0'
}));

const toggleOpen = () => {
  isOpen.value = !isOpen.value;
};

onMounted(() => {
  void nextTick(measurePanel);
});

onUnmounted(() => {
  stopDurationTimer();
});
</script>

<style scoped>
.thinking-block {
  margin: 2px 0 4px;
}

.thinking-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lw-space-3);
  width: 100%;
  border: none;
  background: transparent;
  padding: 8px 0 10px;
  cursor: pointer;
  user-select: none;
  text-align: left;
}

.thinking-summary-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.thinking-icon {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 28%, rgba(var(--lw-primary-rgb), 0.18), transparent 52%),
    color-mix(in srgb, var(--lw-primary) 8%, var(--lw-bg-elevated));
  box-shadow:
    inset 0 0 0 1px rgba(var(--lw-primary-rgb), 0.18),
    0 4px 14px rgba(var(--lw-primary-rgb), 0.08);
  color: var(--lw-primary);
  flex: none;
}

.thinking-icon svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.35;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.thinking-icon.is-streaming {
  animation: thinking-pulse 1.8s ease-out infinite;
}

.thinking-copy {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.thinking-title {
  font-size: 13px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--lw-text-secondary);
  letter-spacing: -0.01em;
}

.thinking-meta {
  font-size: 12px;
  line-height: 1.5;
  color: var(--lw-text-muted);
}

.thinking-duration {
  font-size: 12px;
  line-height: 1.3;
  color: var(--lw-text-muted);
}

.thinking-summary.variant-codex {
  padding: 2px 0 8px;
}

.thinking-summary.variant-codex .thinking-copy {
  gap: 6px;
}

.thinking-summary.variant-codex .thinking-title {
  color: var(--lw-text-secondary);
}

.thinking-summary.variant-codex .thinking-caret {
  width: 16px;
  height: 16px;
}

.thinking-caret {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  color: var(--lw-text-dim);
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), color 180ms cubic-bezier(0.16, 1, 0.3, 1);
  flex: none;
}

.thinking-caret svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.thinking-block.is-open .thinking-caret {
  transform: rotate(180deg);
  color: var(--lw-text-secondary);
}

.thinking-panel {
  overflow: hidden;
  transition:
    max-height 200ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.thinking-flow {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0 0 6px 12px;
  padding: 2px 0 0 22px;
}

.thinking-flow::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 4px;
  bottom: 10px;
  width: 1px;
  background: color-mix(in srgb, var(--lw-border-base) 70%, rgba(var(--lw-primary-rgb), 0.16));
}

.thinking-entry {
  position: relative;
}

.thinking-entry-node {
  position: absolute;
  left: -22px;
  top: 8px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, white);
  box-shadow:
    0 0 0 1.5px rgba(var(--lw-primary-rgb), 0.24),
    0 0 0 4px color-mix(in srgb, var(--lw-primary) 8%, transparent);
}

.thinking-entry-content {
  max-width: 76ch;
  font-size: 12.5px;
  line-height: 1.78;
  color: var(--lw-text-secondary);
}

.thinking-entry-content :deep(p) {
  margin: 0;
}

.thinking-entry-content :deep(ul),
.thinking-entry-content :deep(ol) {
  margin: 0;
  padding-left: 18px;
}

.thinking-entry-content :deep(li + li) {
  margin-top: 6px;
}

.thinking-entry-content :deep(code) {
  font-family: var(--lw-font-mono);
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 86%, white);
  color: var(--lw-text-main);
}

@keyframes thinking-pulse {
  0% {
    transform: scale(0.96);
    box-shadow:
      inset 0 0 0 1px rgba(var(--lw-primary-rgb), 0.18),
      0 4px 14px rgba(var(--lw-primary-rgb), 0.08);
  }
  50% {
    transform: scale(1);
    box-shadow:
      inset 0 0 0 1px rgba(var(--lw-primary-rgb), 0.24),
      0 8px 20px rgba(var(--lw-primary-rgb), 0.16);
  }
  100% {
    transform: scale(0.96);
    box-shadow:
      inset 0 0 0 1px rgba(var(--lw-primary-rgb), 0.18),
      0 4px 14px rgba(var(--lw-primary-rgb), 0.08);
  }
}
</style>
