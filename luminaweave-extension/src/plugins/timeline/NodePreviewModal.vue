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

const props = defineProps<{
  node: any;
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
  padding: 40px;
}

@media (max-width: 768px) {
  .l-modal-overlay {
    padding: 8px !important;
  }
}

.l-modal-container {
  width: 1000px;
  max-width: 95vw;
  max-height: 85vh;
  background: var(--lw-bg-surface);
  border-radius: var(--lw-radius-lg, 20px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--lw-shadow-hover);
  border: 1px solid var(--lw-border-base);
}

@media (max-width: 768px) {
  .l-modal-container {
    width: 100%;
    max-width: 100%;
    max-height: 100%;
    height: auto;
    border-radius: 16px;
  }
}

.l-modal-header {
  padding: 24px 32px;
  background: var(--lw-bg-surface);
  border-bottom: 1px solid var(--lw-border-base);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 768px) {
  .l-modal-header {
    padding: 20px 20px 16px;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
}

.title-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
}


@media (max-width: 768px) {
  .title-area {
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }
}

.brand-badge {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.1);
  color: var(--lw-purple);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: fit-content;
}

.l-modal-id {
  font-family: monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

@media (max-width: 768px) {
  .header-actions {
    width: 100%;
    justify-content: space-between;
    gap: 10px !important;
  }
}

.tabs-group {
  display: flex;
  background: var(--lw-bg-app);
  padding: 4px;
  border-radius: 10px;
  gap: 4px;
}

.tab-btn {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-dim);
  cursor: pointer;
  transition: var(--lw-transition);
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
  transition: 0.2s;
  display: flex;
}

.l-modal-close:hover {
  background: #fee2e2;
  color: #ef4444;
  border-color: #fecaca;
}

.l-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
  background: var(--lw-bg-app);
}

@media (max-width: 768px) {
  .l-modal-body {
    padding: 18px 16px;
  }
  .l-modal-content-wrapper {
    max-width: 100%;
  }
}

.l-modal-content-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.prose {
  font-size: 16px;
  line-height: 1.8;
  color: var(--lw-text-main);
}

.prose-p {
  margin-bottom: 1em;
  line-height: 1.6;
}

:deep(.highlight-purple) {
  color: var(--lw-purple);
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
  font-size: 13px;
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
  background: var(--lw-bg-surface);
}

@media (max-width: 768px) {
  .l-modal-footer {
    padding: 16px 20px;
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
}

.l-footer-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--lw-text-dim);
  font-weight: 600;
}

.l-footer-meta .divider {
  opacity: 0.3;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.l-modal-action-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: 0.2s;
  border: none;
}

@media (max-width: 768px) {
  .l-modal-action-btn {
    flex: 1;
    padding: 12px;
    font-size: 13px;
  }
}

.l-modal-action-btn.primary {
  background: var(--lw-primary);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.l-modal-action-btn.primary:hover {
  background: var(--lw-purple);
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
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}
</style>
