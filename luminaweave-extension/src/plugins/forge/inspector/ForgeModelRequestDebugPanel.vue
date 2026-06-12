<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCardMakerStore } from '../CardMakerStore.js';
import { useForgeStore } from '../../../stores/useForgeStore.js';
import type { ForgeModelRequestTrace } from '../../../types/ForgeRuntimeTypes.js';
import { buildModelRequestToolTracePresentation } from './forgeModelRequestToolTracePresentation.js';
import { buildForgePiRuntimePresentation } from './forgePiRuntimePresentation.js';
import { resolveForgeModelRequestResponseText } from './forgeModelRequestResponsePresentation.js';

const cardStore = useCardMakerStore();
const forgeStore = useForgeStore();

const scope = ref<'workspace' | 'session'>('workspace');
const detailTab = ref<'prompt' | 'context' | 'tools' | 'pi' | 'response'>('prompt');
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
const piModelTraceJson = computed(() => selectedTrace.value?.piModelTrace
    ? JSON.stringify(selectedTrace.value.piModelTrace, null, 2)
    : ''
);
const piModelTraces = computed(() => {
    if (!selectedTrace.value) return [];
    if (selectedTrace.value.piModelTraces?.length) return selectedTrace.value.piModelTraces;
    return selectedTrace.value.piModelTrace ? [selectedTrace.value.piModelTrace] : [];
});
const piModelTracesJson = computed(() => piModelTraces.value.length > 0
    ? JSON.stringify(piModelTraces.value, null, 2)
    : ''
);
const requestParametersJson = computed(() => selectedTrace.value ? JSON.stringify(selectedTrace.value.requestParameters, null, 2) : '');
const toolTracePresentation = computed(() => buildModelRequestToolTracePresentation(selectedTrace.value));
const piRuntimePresentation = computed(() => buildForgePiRuntimePresentation({
    contextBundleSummary: forgeStore.piContextBundleSummary,
    tree: forgeStore.piSessionTree,
    activeNodeId: forgeStore.activePiNodeId,
    loadedSkills: forgeStore.piLoadedSkills,
    loadedExtensions: forgeStore.piLoadedExtensions,
    agentRuntimeSnapshot: selectedTrace.value?.agentRuntimeSnapshot ?? forgeStore.agentRuntimeSnapshot
}));
const formatParameterPreview = (parameters: ForgeModelRequestTrace['requestParameters']) => {
    const entries = Object.entries(parameters);
    if (entries.length === 0) return '默认参数';
    return entries
        .slice(0, 3)
        .map(([key, value]) => `${key}=${value}`)
        .join(' · ');
};

const currentResponseText = computed(() => {
    return resolveForgeModelRequestResponseText({
        trace: selectedTrace.value,
        sessionTree: forgeStore.piSessionTree,
        mode: responseTab.value
    });
});

const formatModelCallTitle = (index: number) => {
    return `模型调用 ${index + 1}`;
};
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
            <button class="detail-tab" :class="{ active: detailTab === 'tools' }" type="button" @click="detailTab = 'tools'">工具调用</button>
            <button class="detail-tab" :class="{ active: detailTab === 'pi' }" type="button" @click="detailTab = 'pi'">pi-core</button>
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
              <article class="context-card">
                <span class="context-label">agentContext</span>
                <pre class="code-block">{{ JSON.stringify(selectedTrace.agentContext || null, null, 2) }}</pre>
              </article>
            </div>
            <details class="json-details" open>
              <summary>上下文快照 JSON</summary>
              <pre class="code-block">{{ contextJson }}</pre>
            </details>
          </div>

          <div v-else-if="detailTab === 'tools'" class="detail-section">
            <div v-if="toolTracePresentation.toolSummary.length > 0" class="tool-summary-list">
              <article v-for="tool in toolTracePresentation.toolSummary" :key="tool.name" class="tool-summary-item">
                <div>
                  <strong>{{ tool.name }}</strong>
                  <p>{{ tool.description || '无描述' }}</p>
                </div>
                <span>{{ tool.approvalLabel }}</span>
              </article>
            </div>
            <div v-if="toolTracePresentation.empty" class="empty-detail inline-empty">
              <strong>{{ toolTracePresentation.emptyTitle }}</strong>
              <p>{{ toolTracePresentation.emptyDescription }}</p>
            </div>
            <div v-else class="message-list">
              <article v-for="event in toolTracePresentation.events" :key="event.id" class="message-card">
                <div class="message-head">
                  <span class="message-role">{{ event.badge }}</span>
                  <span class="message-name">{{ event.title }} · {{ event.subtitle }}</span>
                </div>
                <pre class="code-block">{{ event.payloadText }}</pre>
              </article>
            </div>
          </div>

          <div v-else-if="detailTab === 'pi'" class="detail-section">
            <div v-if="!piRuntimePresentation.hasState && piModelTraces.length === 0" class="empty-detail inline-empty">
              <strong>暂无 pi-core 运行时记录</strong>
              <p>开启前端 pi-agent-core Runtime 并完成一次请求后，这里会显示 context bundle、session tree 和实际加载的技能。</p>
            </div>
            <template v-else>
              <section v-if="piModelTraces.length > 0" class="pi-section">
                <span class="pi-section-title">pi-ai 模型请求链路</span>
                <div class="pi-summary-grid">
                  <article class="pi-summary-item">
                    <span>Model calls</span>
                    <strong>{{ piModelTraces.length }}</strong>
                  </article>
                  <article class="pi-summary-item">
                    <span>Latest provider</span>
                    <strong>{{ piModelTraces[piModelTraces.length - 1]?.providerId }}</strong>
                  </article>
                  <article class="pi-summary-item">
                    <span>Latest final text</span>
                    <strong>{{ piModelTraces[piModelTraces.length - 1]?.finalText.length || 0 }}</strong>
                  </article>
                </div>
                <details
                  v-for="(modelTrace, index) in piModelTraces"
                  :key="modelTrace.traceId"
                  class="pi-model-call-details"
                  :open="index === piModelTraces.length - 1"
                >
                  <summary>
                    <span>{{ formatModelCallTitle(index) }}</span>
                    <strong>{{ modelTrace.providerId }} / {{ modelTrace.modelId }}</strong>
                    <span>{{ modelTrace.finalText.length }} chars</span>
                  </summary>
                  <div v-if="modelTrace.errorMessage" class="error-text">
                    {{ modelTrace.errorMessage }}
                  </div>
                  <div class="context-grid">
                    <details class="context-card pi-system-prompt-details">
                      <summary>
                        <span class="context-label">systemPrompt</span>
                        <span>{{ modelTrace.systemPrompt.length }} chars</span>
                      </summary>
                      <pre class="code-block">{{ modelTrace.systemPrompt || '空' }}</pre>
                    </details>
                    <details class="context-card pi-system-prompt-details">
                      <summary>
                        <span class="context-label">pi messages</span>
                        <span>{{ modelTrace.piMessages.length }} items</span>
                      </summary>
                      <pre class="code-block">{{ JSON.stringify(modelTrace.piMessages, null, 2) }}</pre>
                    </details>
                    <details class="context-card pi-system-prompt-details">
                      <summary>
                        <span class="context-label">transformed pi messages</span>
                        <span>{{ modelTrace.transformedPiMessages.length }} items</span>
                      </summary>
                      <pre class="code-block">{{ JSON.stringify(modelTrace.transformedPiMessages, null, 2) }}</pre>
                    </details>
                    <details class="context-card pi-system-prompt-details">
                      <summary>
                        <span class="context-label">pi-ai provider payload</span>
                        <span>{{ modelTrace.providerPayload ? 'available' : 'empty' }}</span>
                      </summary>
                      <pre class="code-block">{{ JSON.stringify(modelTrace.providerPayload, null, 2) }}</pre>
                    </details>
                    <details class="context-card pi-system-prompt-details">
                      <summary>
                        <span class="context-label">pi-ai provider response</span>
                        <span>{{ modelTrace.providerResponse ? 'available' : 'empty' }}</span>
                      </summary>
                      <pre class="code-block">{{ JSON.stringify(modelTrace.providerResponse, null, 2) }}</pre>
                    </details>
                  </div>
                </details>
                <details class="json-details">
                  <summary>查看 pi-ai 请求链路 JSON</summary>
                  <pre class="code-block">{{ piModelTracesJson || piModelTraceJson }}</pre>
                </details>
              </section>

              <div class="pi-summary-grid">
                <article v-if="piRuntimePresentation.runtime" class="pi-summary-item">
                  <span>Runtime messages</span>
                  <strong>{{ piRuntimePresentation.runtime.messageCount }}</strong>
                </article>
                <article v-if="piRuntimePresentation.runtime" class="pi-summary-item">
                  <span>Pending tools</span>
                  <strong>{{ piRuntimePresentation.runtime.pendingToolCount }}</strong>
                </article>
                <article class="pi-summary-item">
                  <span>Context files</span>
                  <strong>{{ piRuntimePresentation.contextFiles.length }}</strong>
                </article>
                <article class="pi-summary-item">
                  <span>Tree nodes</span>
                  <strong>{{ piRuntimePresentation.treeRows.length }}</strong>
                </article>
                <article class="pi-summary-item">
                  <span>Active node</span>
                  <strong>{{ piRuntimePresentation.activeNode?.kind || 'none' }}</strong>
                </article>
              </div>

              <section v-if="piRuntimePresentation.runtime" class="pi-section">
                <span class="pi-section-title">Agent Runtime Snapshot</span>
                <div class="pi-summary-grid">
                  <article class="pi-summary-item">
                    <span>Streaming</span>
                    <strong>{{ piRuntimePresentation.runtime.isStreaming ? 'yes' : 'no' }}</strong>
                  </article>
                  <article class="pi-summary-item">
                    <span>Active tools</span>
                    <strong>{{ piRuntimePresentation.runtime.activeToolCount }}</strong>
                  </article>
                  <article class="pi-summary-item">
                    <span>Queue</span>
                    <strong>{{ piRuntimePresentation.runtime.queueLabel || 'empty' }}</strong>
                  </article>
                </div>
                <div v-if="piRuntimePresentation.runtime.pendingToolCalls.length > 0" class="message-list">
                  <article v-for="tool in piRuntimePresentation.runtime.pendingToolCalls" :key="tool.toolCallId" class="message-card">
                    <div class="message-head">
                      <span class="message-role">{{ tool.toolName }}</span>
                      <span class="message-name">{{ tool.updateCount }} updates</span>
                    </div>
                    <pre class="code-block">{{ tool.argsPreview }}</pre>
                  </article>
                </div>
                <div v-if="piRuntimePresentation.runtime.messages.length > 0" class="pi-tree-list">
                  <div v-for="message in piRuntimePresentation.runtime.messages" :key="message.id" class="pi-tree-row">
                    <span class="pi-tree-kind">{{ message.role }}</span>
                    <div class="pi-tree-copy">
                      <strong>{{ message.status || 'unknown' }} · {{ message.blockCount }} blocks</strong>
                      <span>{{ message.preview || message.id }}</span>
                    </div>
                  </div>
                </div>
                <p v-if="piRuntimePresentation.runtime.errorMessage" class="error-text">{{ piRuntimePresentation.runtime.errorMessage }}</p>
              </section>

              <section class="pi-section">
                <span class="pi-section-title">实际加载技能</span>
                <div v-if="piRuntimePresentation.skills.length === 0" class="pi-muted">暂无技能记录</div>
                <div v-else class="pi-chip-row">
                  <span v-for="skill in piRuntimePresentation.skills" :key="skill" class="pi-chip">{{ skill }}</span>
                </div>
              </section>

              <section class="pi-section">
                <span class="pi-section-title">Extensions</span>
                <div v-if="piRuntimePresentation.extensions.length === 0" class="pi-muted">暂无 extension 记录</div>
                <div v-else class="pi-chip-row">
                  <span v-for="extension in piRuntimePresentation.extensions" :key="extension" class="pi-chip">{{ extension }}</span>
                </div>
              </section>

              <section class="pi-section">
                <span class="pi-section-title">Context Bundle</span>
                <article v-for="file in piRuntimePresentation.contextFiles" :key="file.path" class="pi-context-file">
                  <div>
                    <strong>{{ file.title }}</strong>
                    <span>{{ file.path }} · {{ file.size }} chars</span>
                  </div>
                  <p>{{ file.preview || '空文件' }}</p>
                </article>
              </section>

              <section class="pi-section">
                <span class="pi-section-title">Session Tree</span>
                <div v-if="piRuntimePresentation.treeRows.length === 0" class="pi-muted">暂无节点</div>
                <div v-else class="pi-tree-list">
                  <div
                    v-for="node in piRuntimePresentation.treeRows"
                    :key="node.id"
                    class="pi-tree-row"
                    :class="{ active: node.active }"
                  >
                    <span class="pi-tree-kind">{{ node.kind }}</span>
                    <div class="pi-tree-copy">
                      <strong>{{ node.title }}</strong>
                      <span>{{ node.summary || node.id }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </template>
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
  font-size: var(--lw-type-title-large-size);
  font-weight: var(--lw-type-title-small-weight);
}

.debug-header-copy p {
  margin: 0;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.debug-eyebrow {
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
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
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
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
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  color: var(--lw-text-main);
}

.trace-status {
  border-radius: 999px;
  padding: 4px 8px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
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
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.trace-card-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--lw-type-body-small-size);
}

.trace-card-params {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
  line-height: 1.5;
}

.trace-card-preview {
  margin: 0;
  font-size: var(--lw-type-body-small-size);
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
  font-size: var(--lw-type-title-large-size);
  font-weight: var(--lw-type-title-small-weight);
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

.tool-summary-list {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.tool-summary-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-radius: 14px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  padding: 10px 12px;
}

.tool-summary-item strong {
  display: block;
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-main);
}

.tool-summary-item p {
  margin: 3px 0 0;
  font-size: var(--lw-type-label-small-size);
  line-height: 1.45;
  color: var(--lw-text-muted);
}

.tool-summary-item span {
  flex: 0 0 auto;
  align-self: flex-start;
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  padding: 3px 8px;
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-secondary);
  background: color-mix(in srgb, var(--lw-bg-elevated) 86%, transparent);
}

.pi-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.pi-summary-item,
.pi-section,
.pi-context-file,
.pi-tree-row {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
}

.pi-summary-item {
  border-radius: 14px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pi-summary-item span,
.pi-section-title,
.pi-muted,
.pi-context-file span,
.pi-tree-row span {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.pi-summary-item strong {
  font-size: var(--lw-type-title-small-size);
  color: var(--lw-text-main);
}

.pi-section {
  border-radius: 16px;
  padding: 12px;
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.pi-section-title {
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
}

.pi-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pi-chip {
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  padding: 4px 8px;
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-secondary);
  background: color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent);
}

.pi-context-file {
  border-radius: 14px;
  padding: 10px;
}

.pi-context-file div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pi-context-file strong,
.pi-tree-row strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
}

.pi-context-file p {
  margin: 8px 0 0;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.55;
}

.pi-system-prompt-details {
  display: block;
  min-width: 0;
}

.pi-model-call-details {
  border-radius: 14px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 82%, transparent);
  padding: 10px;
}

.pi-model-call-details + .pi-model-call-details {
  margin-top: 8px;
}

.pi-model-call-details > summary {
  cursor: pointer;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  list-style: none;
  font-size: var(--lw-type-body-small-size);
}

.pi-model-call-details > summary::-webkit-details-marker {
  display: none;
}

.pi-model-call-details > summary::before {
  content: '▸';
  color: var(--lw-text-muted);
  transition: transform 0.16s ease;
}

.pi-model-call-details[open] > summary::before {
  transform: rotate(90deg);
}

.pi-model-call-details > summary strong,
.pi-model-call-details > summary span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pi-model-call-details > summary strong {
  color: var(--lw-text-main);
}

.pi-model-call-details > summary span {
  color: var(--lw-text-muted);
}

.pi-system-prompt-details summary {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  list-style: none;
}

.pi-system-prompt-details summary::-webkit-details-marker {
  display: none;
}

.pi-system-prompt-details summary::before {
  content: '▸';
  flex: 0 0 auto;
  color: var(--lw-text-muted);
  transition: transform 0.16s ease;
}

.pi-system-prompt-details[open] summary::before {
  transform: rotate(90deg);
}

.pi-system-prompt-details summary > span:last-child {
  margin-left: auto;
  flex: 0 0 auto;
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.pi-tree-list {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.pi-tree-row {
  border-radius: 12px;
  min-height: 44px;
  display: grid;
  grid-template-columns: minmax(74px, max-content) minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  padding: 8px 10px;
  min-width: 0;
  overflow: hidden;
}

.pi-tree-row.active {
  border-color: rgba(var(--lw-primary-rgb), 0.34);
  background: rgba(var(--lw-primary-rgb), 0.1);
}

.pi-tree-kind {
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent);
  border: 1px solid var(--lw-border-base);
  padding: 3px 7px;
  max-width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pi-tree-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.pi-tree-copy strong,
.pi-tree-copy span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.code-block {
  margin: 8px 0 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(11, 18, 32, 0.06);
  font-size: var(--lw-type-body-small-size);
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
  font-size: var(--lw-type-body-small-size);
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
  font-size: var(--lw-type-title-small-size);
}

.empty-detail p,
.empty-state p {
  margin: 0;
  font-size: var(--lw-type-body-small-size);
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
