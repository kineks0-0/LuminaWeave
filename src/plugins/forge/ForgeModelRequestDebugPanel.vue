<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCardMakerStore } from './CardMakerStore';
import { useForgeStore } from '../../stores/useForgeStore';
import type { ForgeModelRequestTrace } from '../../types/ForgeRuntimeTypes.js';

const cardStore = useCardMakerStore();
const forgeStore = useForgeStore();

const scope = ref<'workspace' | 'session'>('workspace');
const detailTab = ref<'prompt' | 'context' | 'response'>('prompt');
const responseTab = ref<'display' | 'thinking' | 'raw'>('display');

const currentWorkspaceSessionId = computed(() => cardStore.workspaceSessionId || cardStore.sessionChatId);

const traces = computed<ForgeModelRequestTrace[]>(() => {
    const source = scope.value === 'workspace'
        ? forgeStore.modelRequestTraces.filter((trace) => trace.workspaceSessionId === currentWorkspaceSessionId.value)
        : forgeStore.modelRequestTraces;

    const reversed = [...source].reverse();
    return reversed.sort((left, right) => {
        const leftStreaming = left.status === 'streaming';
        const rightStreaming = right.status === 'streaming';
        if (leftStreaming !== rightStreaming) {
            return leftStreaming ? -1 : 1;
        }
        return 0;
    });
});

const selectedTrace = computed<ForgeModelRequestTrace | null>(() => {
    const preferred = traces.value.find((trace) => trace.id === forgeStore.activeModelRequestTraceId);
    return preferred || traces.value[0] || null;
});

const selectTrace = (traceId: string) => {
    forgeStore.setActiveModelRequestTrace(traceId);
};

const clearTraces = () => {
    forgeStore.clearModelRequestTraces();
};

const formatTime = (value: number | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const formatDuration = (trace: ForgeModelRequestTrace) => {
    const end = trace.completedAt || trace.firstResponseAt || Date.now();
    const diff = Math.max(0, end - trace.requestedAt);
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(diff < 10000 ? 1 : 0)}s`;
};

const statusLabel = (status: ForgeModelRequestTrace['status']) => {
    switch (status) {
        case 'queued': return 'Queued';
        case 'streaming': return 'Streaming';
        case 'completed': return 'Completed';
        case 'failed': return 'Failed';
        case 'aborted': return 'Aborted';
        default: return status;
    }
};

const promptJson = computed(() => selectedTrace.value ? JSON.stringify(selectedTrace.value.requestPrompt, null, 2) : '');
const contextJson = computed(() => selectedTrace.value ? JSON.stringify(selectedTrace.value.contextSnapshot, null, 2) : '');
const responseJson = computed(() => {
    if (!selectedTrace.value) return '';
    return JSON.stringify({
        display: selectedTrace.value.responseDisplay,
        thinking: selectedTrace.value.responseThinking,
        raw: selectedTrace.value.responseRaw
    }, null, 2);
});
const requestParametersJson = computed(() => selectedTrace.value ? JSON.stringify(selectedTrace.value.requestParameters, null, 2) : '');
const formatParameterPreview = (parameters: ForgeModelRequestTrace['requestParameters']) => {
    const entries = Object.entries(parameters);
    if (entries.length === 0) return '默认参数';
    return entries
        .slice(0, 3)
        .map(([key, value]) => `${key}=${value}`)
        .join(' · ');
};

const currentResponseText = computed(() => {
    if (!selectedTrace.value) return '';
    if (responseTab.value === 'thinking') return selectedTrace.value.responseThinking || '暂无 thinking 内容';
    if (responseTab.value === 'raw') return selectedTrace.value.responseRaw || '暂无 raw 内容';
    return selectedTrace.value.responseDisplay || '暂无回复内容';
});
</script>

<template>
  <div class="forge-request-debug-root">
    <header class="debug-header">
      <div class="debug-header-copy">
        <span class="debug-eyebrow">Forge Dev</span>
        <h2>模型请求调试</h2>
        <p>查看 Forge 当前前端会话内的模型请求、上下文和流式回复。</p>
      </div>
      <div class="debug-header-actions">
        <div class="scope-toggle" role="tablist" aria-label="请求范围">
          <button
            class="scope-btn"
            :class="{ active: scope === 'workspace' }"
            type="button"
            @click="scope = 'workspace'"
          >
            当前工作区
          </button>
          <button
            class="scope-btn"
            :class="{ active: scope === 'session' }"
            type="button"
            @click="scope = 'session'"
          >
            本次前端会话
          </button>
        </div>
        <button class="clear-btn" type="button" :disabled="forgeStore.modelRequestTraces.length === 0" @click="clearTraces">
          清空列表
        </button>
      </div>
    </header>

    <div class="debug-layout">
      <aside class="trace-list-panel">
        <div v-if="traces.length === 0" class="empty-state">
          <strong>还没有模型请求</strong>
          <p>发送一条 Forge 消息，或在测试聊天里跑一次请求后，这里会实时出现。</p>
        </div>

        <template v-else>
          <button
            v-for="trace in traces"
            :key="trace.id"
            class="trace-card"
            :class="{ active: selectedTrace?.id === trace.id, streaming: trace.status === 'streaming' }"
            type="button"
            @click="selectTrace(trace.id)"
          >
            <div class="trace-card-top">
              <span class="trace-source">{{ trace.source }}</span>
              <span class="trace-status" :class="`status-${trace.status}`">{{ statusLabel(trace.status) }}</span>
            </div>
            <div class="trace-card-meta">
              <span>{{ formatTime(trace.requestedAt) }}</span>
              <span>{{ formatDuration(trace) }}</span>
            </div>
            <div class="trace-card-summary">
              <strong>{{ trace.contextSnapshot.activeLayer || 'no-layer' }}</strong>
              <span>{{ trace.presetId || 'no-preset' }}</span>
            </div>
            <div class="trace-card-params">{{ formatParameterPreview(trace.requestParameters) }}</div>
            <p class="trace-card-preview">
              {{
                trace.responseDisplay
                  || trace.responseRaw
                  || trace.contextSnapshot.sourceCommand?.type
                  || '请求已创建，等待模型返回'
              }}
            </p>
            <div class="trace-card-times">
              <span>首包 {{ formatTime(trace.firstResponseAt) }}</span>
              <span>完成 {{ formatTime(trace.completedAt) }}</span>
            </div>
          </button>
        </template>
      </aside>

      <section class="trace-detail-panel">
        <template v-if="selectedTrace">
          <div class="detail-hero">
            <div>
              <div class="detail-title-row">
                <h3>{{ selectedTrace.source }}</h3>
                <span class="trace-status" :class="`status-${selectedTrace.status}`">{{ statusLabel(selectedTrace.status) }}</span>
              </div>
              <p class="detail-subtitle">
                工作区 {{ selectedTrace.workspaceSessionId }} · preset {{ selectedTrace.presetId || '—' }}
              </p>
            </div>
            <div class="detail-times">
              <span>请求 {{ formatTime(selectedTrace.requestedAt) }}</span>
              <span>首包 {{ formatTime(selectedTrace.firstResponseAt) }}</span>
              <span>完成 {{ formatTime(selectedTrace.completedAt) }}</span>
            </div>
          </div>

          <div class="detail-tabs" role="tablist" aria-label="调试详情">
            <button class="detail-tab" :class="{ active: detailTab === 'prompt' }" type="button" @click="detailTab = 'prompt'">提示词</button>
            <button class="detail-tab" :class="{ active: detailTab === 'context' }" type="button" @click="detailTab = 'context'">上下文</button>
            <button class="detail-tab" :class="{ active: detailTab === 'response' }" type="button" @click="detailTab = 'response'">回复</button>
          </div>

          <div v-if="detailTab === 'prompt'" class="detail-section">
            <div class="message-list">
              <article v-for="(message, index) in selectedTrace.requestPrompt" :key="`${selectedTrace.id}_${index}`" class="message-card">
                <div class="message-head">
                  <span class="message-role">{{ message.role }}</span>
                  <span class="message-name">{{ message.name || 'anonymous' }}</span>
                </div>
                <pre class="code-block">{{ message.content }}</pre>
              </article>
            </div>
            <details class="json-details">
              <summary>查看原始 JSON</summary>
              <pre class="code-block">{{ promptJson }}</pre>
            </details>
          </div>

          <div v-else-if="detailTab === 'context'" class="detail-section">
            <div class="context-grid">
              <article class="context-card">
                <span class="context-label">requestParameters</span>
                <pre class="code-block">{{ requestParametersJson }}</pre>
              </article>
              <article class="context-card">
                <span class="context-label">sourceCommand</span>
                <pre class="code-block">{{ JSON.stringify(selectedTrace.contextSnapshot.sourceCommand, null, 2) }}</pre>
              </article>
              <article class="context-card">
                <span class="context-label">nodeSummary</span>
                <pre class="code-block">{{ JSON.stringify(selectedTrace.nodeSummary, null, 2) }}</pre>
              </article>
            </div>
            <details class="json-details" open>
              <summary>上下文快照 JSON</summary>
              <pre class="code-block">{{ contextJson }}</pre>
            </details>
          </div>

          <div v-else class="detail-section">
            <div class="detail-tabs nested" role="tablist" aria-label="回复视图">
              <button class="detail-tab" :class="{ active: responseTab === 'display' }" type="button" @click="responseTab = 'display'">显示文本</button>
              <button class="detail-tab" :class="{ active: responseTab === 'thinking' }" type="button" @click="responseTab = 'thinking'">thinking</button>
              <button class="detail-tab" :class="{ active: responseTab === 'raw' }" type="button" @click="responseTab = 'raw'">raw</button>
            </div>
            <pre class="code-block large">{{ currentResponseText }}</pre>
            <details class="json-details">
              <summary>查看回复 JSON</summary>
              <pre class="code-block">{{ responseJson }}</pre>
            </details>
            <p v-if="selectedTrace.errorMessage" class="error-text">{{ selectedTrace.errorMessage }}</p>
          </div>
        </template>

        <div v-else class="empty-detail">
          <strong>请选择一条请求</strong>
          <p>左侧会按最新更新时间展示 Forge 模型请求，点击即可查看详细提示词、上下文和回复。</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.forge-request-debug-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--lw-text-main);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.debug-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--lw-border-base);
}

.debug-header-copy h2 {
  margin: 2px 0 6px;
  font-size: 18px;
  font-weight: 700;
}

.debug-header-copy p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.debug-eyebrow {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--lw-primary);
}

.debug-header-actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.scope-toggle,
.detail-tabs {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}

.scope-btn,
.detail-tab,
.clear-btn {
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  font-size: 12px;
  font-weight: 700;
  padding: 7px 12px;
  cursor: pointer;
  transition: var(--lw-transition);
}

.scope-btn.active,
.detail-tab.active {
  border-color: rgba(var(--lw-primary-rgb), 0.24);
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-text-main);
}

.clear-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.debug-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 0;
  min-height: 0;
  flex: 1;
}

.trace-list-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  border-right: 1px solid var(--lw-border-base);
}

.trace-card {
  border-radius: 18px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  color: var(--lw-text-main);
}

.trace-card.active {
  border-color: rgba(var(--lw-primary-rgb), 0.34);
  background: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.1) 28%, var(--lw-bg-elevated));
}

.trace-card.streaming {
  box-shadow: inset 0 0 0 1px rgba(var(--lw-primary-rgb), 0.08);
}

.trace-card-top,
.trace-card-meta,
.trace-card-times,
.detail-title-row,
.detail-times,
.message-head {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.trace-source,
.message-role,
.context-label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--lw-text-main);
}

.trace-status {
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  background: var(--lw-bg-subtle);
}

.status-streaming {
  color: rgb(var(--lw-primary-rgb));
}

.status-completed {
  color: #178a5a;
}

.status-failed,
.status-aborted {
  color: #b94b4b;
}

.trace-card-meta,
.trace-card-times,
.detail-subtitle,
.detail-times,
.message-name {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.trace-card-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.trace-card-params {
  font-size: 11px;
  color: var(--lw-text-muted);
  line-height: 1.5;
}

.trace-card-preview {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.trace-detail-panel {
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 18px;
}

.detail-hero,
.detail-section,
.empty-detail,
.empty-state {
  border-radius: 20px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent);
}

.detail-hero {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.detail-hero h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.detail-section,
.empty-detail,
.empty-state {
  padding: 14px;
}

.message-list,
.context-grid {
  display: grid;
  gap: 12px;
}

.context-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.message-card,
.context-card {
  border-radius: 16px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  padding: 12px;
}

.json-details {
  margin-top: 12px;
}

.json-details summary {
  cursor: pointer;
  color: var(--lw-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.code-block {
  margin: 8px 0 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(11, 18, 32, 0.06);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--lw-text-main);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}

.code-block.large {
  min-height: 220px;
}

.error-text {
  margin: 12px 0 0;
  color: #b94b4b;
  font-size: 12px;
  line-height: 1.6;
}

.empty-detail,
.empty-state {
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: center;
}

.empty-detail strong,
.empty-state strong {
  font-size: 14px;
}

.empty-detail p,
.empty-state p {
  margin: 0;
  font-size: 12px;
  color: var(--lw-text-secondary);
  line-height: 1.6;
}

@media (max-width: 900px) {
  .debug-header,
  .detail-hero {
    flex-direction: column;
  }

  .debug-layout {
    grid-template-columns: 1fr;
  }

  .trace-list-panel {
    border-right: none;
    border-bottom: 1px solid var(--lw-border-base);
    max-height: 42vh;
  }
}
</style>
