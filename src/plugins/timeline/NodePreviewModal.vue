<template>
  <transition name="modal-scale">
    <div v-if="node" class="l-modal-overlay" @click="$emit('close')">
      <div class="l-modal-container" @click.stop>
        <!-- Header -->
        <div class="l-modal-header">
          <div class="title-area">
            <div class="brand-badge">{{ node.role === 'user' ? 'User Input' : 'AI Response' }}</div>
            <div class="l-modal-id">NODE #{{ node.id.substring(0, 8).toUpperCase() }}</div>
          </div>
          <div class="header-actions">
            <div class="tabs-group">
              <button class="tab-btn" :class="{ active: currentView === 'mes' }"
                @click="currentView = 'mes'">对话内容</button>
              <button class="tab-btn" :class="{ active: currentView === 'raw' }"
                @click="currentView = 'raw'">原始数据</button>
            </div>
            <button class="l-modal-close" @click="$emit('close')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="l-modal-body scrollbar-thin">
          <div class="l-modal-content-wrapper">
            <div v-if="currentView === 'mes'" class="prose" v-html="renderedContent"></div>
            <div v-else class="raw-code">
              <pre><code>{{ node.pluginRaw || node.mesRaw || node.text }}</code></pre>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="l-modal-footer">
          <div class="l-footer-meta">
            <span>深度: {{ (node.depth || 0) + 1 }}</span>
            <span class="divider">|</span>
            <span>发送者: {{ node.name || (node.role === 'user' ? 'User' : 'Assistant') }}</span>
          </div>
          <div class="footer-actions">
            <button class="l-modal-action-btn secondary" @click="$emit('branch', node)">从此处分支</button>
            <button class="l-modal-action-btn primary" @click="$emit('close')">确定</button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { TimelineViewNode } from './useTimelineGraphViewModel.js';

const props = defineProps<{
  node: TimelineViewNode;
}>();

const emit = defineEmits(['close', 'branch']);

const currentView = ref<'mes' | 'raw'>('mes');

const renderedContent = computed(() => {
  const text = props.node.mes || props.node.text || '';
  if (!text) return '';

  const lines = text.split('\n');
  const htmlLines = lines.map((line: string) => {
    if (!line.trim()) return '<div class="empty-line" style="height: 1em;"></div>';
    let parsed = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^\*]+)\*/g, '<em class="highlight-purple">$1</em>')
      .replace(/"([^"]+)"/g, '<span class="highlight-blue">"$1"</span>')
      .replace(/“([^“]+)”/g, '<span class="highlight-blue">"$1"</span>');
    return `<p class="prose-p">${parsed}</p>`;
  });
  return htmlLines.join('');
});
</script>

<style scoped>
.l-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--lw-bg-mask);
  backdrop-filter: var(--lw-glass-blur);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  container-type: inline-size;
}

.l-modal-container {
  width: 1000px;
  max-width: calc(100% - 48px);
  max-height: calc(100% - 48px);
  background: var(--lw-bg-surface);
  border-radius: var(--lw-radius-lg, 20px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--lw-shadow-hover);
  border: 1px solid var(--lw-border-base);
}

.l-modal-header {
  padding: 24px 32px;
  background: var(--lw-bg-surface);
  border-bottom: 1px solid var(--lw-border-base);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.title-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.brand-badge {
  display: inline-block;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--lw-primary) 10%, transparent);
  color: var(--lw-primary);
  border-radius: 8px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: fit-content;
  white-space: nowrap;
  flex-shrink: 0;
}

.l-modal-id {
  font-family: monospace;
  font-size: var(--lw-type-title-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.tabs-group {
  display: flex;
  background: var(--lw-bg-app);
  padding: 4px;
  border-radius: 10px;
  gap: 4px;
  flex-shrink: 0;
}

.tab-btn {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: var(--lw-type-body-medium-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-dim);
  cursor: pointer;
  transition: var(--lw-transition);
  white-space: nowrap;
}

.tab-btn.active {
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.l-modal-close {
  background: var(--lw-bg-app);
  border: 1px solid var(--lw-border-base);
  color: var(--lw-text-dim);
  cursor: pointer;
  padding: 8px;
  border-radius: 10px;
  transition: var(--lw-transition);
  display: flex;
  flex-shrink: 0;
}

.l-modal-close:hover {
  background: color-mix(in srgb, var(--lw-danger) 12%, transparent);
  color: var(--lw-danger);
  border-color: color-mix(in srgb, var(--lw-danger) 30%, transparent);
}

.l-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
  background: var(--lw-bg-app);
}

.l-modal-content-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.prose {
  font-size: var(--lw-type-title-medium-size);
  line-height: 1.8;
  color: var(--lw-text-main);
}

.prose-p {
  margin-bottom: 1em;
  line-height: 1.6;
}

:deep(.highlight-purple) {
  color: var(--lw-primary);
  font-style: italic;
}

:deep(.highlight-blue) {
  color: var(--lw-primary);
}

.raw-code {
  background: var(--lw-black, #0f172a);
  /* color: var(--lw-text-main); */
  color: #fff;
  padding: 24px;
  border-radius: 12px;
  font-family: var(--lw-font-mono, monospace);
  font-size: var(--lw-type-body-medium-size);
  overflow-x: auto;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.l-modal-footer {
  padding: 20px 32px;
  border-top: 1px solid var(--lw-border-base);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  background: var(--lw-bg-surface);
}

.l-footer-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  min-width: 0;
  font-size: var(--lw-type-body-medium-size);
  color: var(--lw-text-dim);
  font-weight: var(--lw-type-label-medium-weight);
}

.l-footer-meta > span {
  white-space: nowrap;
}

.l-footer-meta .divider {
  opacity: 0.3;
}

.footer-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.l-modal-action-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: var(--lw-type-title-small-weight);
  font-size: var(--lw-type-title-small-size);
  cursor: pointer;
  transition: var(--lw-transition);
  border: none;
  white-space: nowrap;
}

.l-modal-action-btn.primary {
  background: var(--lw-primary);
  color: var(--lw-text-inverse);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--lw-primary) 20%, transparent);
}

.l-modal-action-btn.primary:hover {
  background: var(--lw-primary-strong);
  transform: translateY(-1px);
}

.l-modal-action-btn.secondary {
  background: var(--lw-bg-app);
  color: var(--lw-text-main);
}

.l-modal-action-btn.secondary:hover {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
}

/* 弹窗可能落在窄侧栏或小窗里，viewport 媒体查询覆盖不到，按容器宽度重排。 */
@container (max-width: 640px) {
  .l-modal-container {
    max-width: calc(100% - 16px);
    max-height: calc(100% - 16px);
    border-radius: 16px;
  }

  .l-modal-header {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    padding: 18px 18px 14px;
  }

  .title-area {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
    gap: 10px;
  }

  .tabs-group {
    flex: 1;
  }

  .tab-btn {
    flex: 1;
    text-align: center;
    min-height: 36px;
  }

  .l-modal-body {
    padding: 18px 16px;
  }

  .l-modal-content-wrapper {
    max-width: 100%;
  }

  .l-modal-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    padding: 14px 18px calc(14px + var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px)));
  }

  .footer-actions {
    gap: 10px;
  }

  .l-modal-action-btn {
    flex: 1;
    min-height: 44px;
    padding: 12px 14px;
    font-size: var(--lw-type-body-medium-size);
  }
}

/* Scrollbar */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--lw-border-base);
  border-radius: 10px;
}

/* Animations */
.modal-scale-enter-active,
.modal-scale-leave-active {
  transition:
    opacity 200ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(12px);
}

@media (prefers-reduced-motion: reduce) {

  .modal-scale-enter-active,
  .modal-scale-leave-active {
    transition: none;
  }
}
</style>
