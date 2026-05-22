<template>
  <transition name="preview-panel">
    <div v-if="open" class="forge-prompt-preview" :class="`placement-${placement}`">
      <div class="preview-panel">
        <div class="preview-head">
          <div class="preview-copy">
            <span class="preview-title">{{ activePreview?.title || 'Forge Prompt 预览' }}</span>
            <span class="preview-subtitle">{{ activePreview?.subtitle || '展示当前预设、世界书和会话链拼接后的消息载荷' }}</span>
          </div>
          <div class="preview-actions">
            <span class="payload-badge">{{ activePreview?.payload.length || 0 }} 条</span>
            <button class="refresh-btn" @click="refresh" :disabled="isLoading">
              刷新
            </button>
            <button class="close-btn" type="button" @click="$emit('close')" title="关闭预览">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="error" class="error-banner">{{ error }}</div>

        <div class="preview-body">
          <div v-if="previewBundle" class="tab-switcher">
            <button
              class="tab-btn"
              :class="{ active: modelTab === 'primary' }"
              @click="modelTab = 'primary'"
            >
              主模型
            </button>
            <button
              class="tab-btn"
              :class="{ active: modelTab === 'executor' }"
              @click="modelTab = 'executor'"
            >
              子 / 执行模型
            </button>
          </div>

          <div v-if="activePreview" class="view-switcher">
            <button class="view-btn" :class="{ active: viewTab === 'messages' }" @click="viewTab = 'messages'">
              Messages
            </button>
            <button class="view-btn" :class="{ active: viewTab === 'sources' }" @click="viewTab = 'sources'">
              来源
            </button>
            <button
              class="view-btn"
              :class="{ active: viewTab === 'agent' }"
              @click="viewTab = 'agent'"
            >
              Agent
            </button>
          </div>

          <div v-if="memorySnapshot" class="snapshot-card">
            <div class="snapshot-line">
              <span class="snapshot-label">会话</span>
              <strong>{{ memorySnapshot.sourceId }}</strong>
              <span>{{ memorySnapshot.sessionId || 'unknown' }}</span>
            </div>
            <div class="snapshot-line">
              <span class="snapshot-label">节点</span>
              <strong>{{ memorySnapshot.activeLeafId ? memorySnapshot.activeLeafId.slice(-6) : 'root' }}</strong>
              <span>{{ memorySnapshot.messageCount }} 条消息</span>
            </div>
            <div class="snapshot-line">
              <span class="snapshot-label">世界书</span>
              <strong>{{ memorySnapshot.lorebook.versionLabel }}</strong>
              <span>{{ memorySnapshot.lorebook.entryCount }} 条条目</span>
            </div>
          </div>

          <div v-if="activePreview?.sourceLabel || activePreview?.targetEntryId" class="snapshot-card preview-context-card">
            <div class="snapshot-line" v-if="activePreview?.sourceLabel">
              <span class="snapshot-label">来源</span>
              <strong>{{ activePreview.sourceLabel }}</strong>
            </div>
            <div class="snapshot-line" v-if="activePreview?.targetEntryId">
              <span class="snapshot-label">条目</span>
              <strong>{{ activePreview.targetEntryId }}</strong>
            </div>
          </div>

          <div v-if="viewTab === 'messages' && !(activePreview?.payload.length) && !isLoading" class="empty-state">
            当前没有可预览的 Prompt 内容
          </div>

          <template v-else-if="viewTab === 'messages'">
            <div v-for="(msg, index) in activePreview?.payload || []" :key="index" class="prompt-msg" :class="msg.role">
              <div class="prompt-meta">
                <span class="role">{{ roleLabel(msg.role) }}</span>
                <span class="name" v-if="msg.name">{{ msg.name }}</span>
              </div>
              <pre class="prompt-text">{{ formatPromptText(msg.content) }}</pre>
            </div>
          </template>

          <div v-else-if="viewTab === 'sources'" class="source-list">
            <div v-if="!(activePreview?.assembly?.trace.length)" class="empty-state">
              当前预览没有来源追踪数据
            </div>
            <div
              v-for="trace in activePreview?.assembly?.trace || []"
              :key="trace.traceId"
              class="source-card"
              :class="[trace.kind, trace.inclusion]"
            >
              <div class="source-head">
                <div class="source-title-row">
                  <span class="source-kind">{{ sourceKindLabel(trace.sourceKind) }}</span>
                  <strong>{{ trace.label }}</strong>
                </div>
                <span class="inclusion-pill">{{ inclusionLabel(trace.inclusion) }}</span>
              </div>
              <div class="source-meta">
                <span>{{ trace.kind }}</span>
                <span v-if="trace.forgeSlot">{{ trace.forgeSlot }} · {{ trace.forgeRegion }}</span>
                <span v-if="trace.resourceRef">{{ trace.resourceRef.path }}</span>
                <span v-else-if="trace.sourcePath">{{ trace.sourcePath }}</span>
                <span v-if="trace.outputMessageIndex !== null">
                  message {{ trace.outputMessageIndex }} · {{ trace.outputStart }}-{{ trace.outputEnd }}
                </span>
                <span v-else>未进入最终 payload</span>
              </div>
              <div v-if="trace.transforms.length" class="transform-row">
                <span
                  v-for="(transform, idx) in trace.transforms"
                  :key="`${trace.traceId}-${idx}`"
                  class="transform-chip"
                  :class="{ lossy: transform.lossy }"
                >
                  {{ transform.type }}{{ transform.lossy ? ' lossy' : '' }}
                </span>
              </div>
            </div>
          </div>

          <div v-else class="agent-preview">
            <div v-if="!activePreview?.agent" class="empty-state">
              当前预览没有 Agent 图谱数据
            </div>
            <template v-else>
              <div class="agent-summary">
                <div class="snapshot-line">
                  <span class="snapshot-label">Intent</span>
                  <strong>{{ activePreview.agent.intent }}</strong>
                  <span>{{ activePreview.agent.workingStatement.visiblePhase }} / {{ activePreview.agent.workingStatement.activeLayer }}</span>
                </div>
                <div class="snapshot-line">
                  <span class="snapshot-label">Skill</span>
                  <strong>{{ activePreview.agent.selectedSkills.join(', ') || 'none' }}</strong>
                </div>
                <div class="snapshot-line">
                  <span class="snapshot-label">VFS</span>
                  <strong>{{ activePreview.agent.workingStatement.writeScope }}</strong>
                </div>
              </div>

              <div class="agent-section">
                <span class="agent-section-title">Graph</span>
                <div class="agent-node" v-for="node in activePreview.agent.graphTrace" :key="node.node">
                  <strong>{{ node.node }}</strong>
                  <span>{{ node.summary }}</span>
                </div>
              </div>

              <div class="agent-section">
                <span class="agent-section-title">Capabilities</span>
                <div v-if="!activePreview.agent.loadedCapabilities.length" class="agent-muted">
                  本轮没有加载低频能力
                </div>
                <div
                  v-for="capability in activePreview.agent.loadedCapabilities"
                  :key="capability.id"
                  class="agent-capability"
                >
                  <div>
                    <strong>{{ capability.title }}</strong>
                    <span>{{ capability.id }} · {{ capability.loadAs }} · {{ capability.risk }}</span>
                  </div>
                  <span v-if="capability.shellProfile" class="inclusion-pill">{{ capability.shellProfile }}</span>
                </div>
              </div>

              <div class="agent-section">
                <span class="agent-section-title">Working Statement</span>
                <pre class="agent-statement">{{ activePreview.agent.workingStatement.lines.join('\n') }}</pre>
              </div>

              <div class="agent-section">
                <span class="agent-section-title">pi-core 实际加载</span>
                <div v-if="!piRuntimePresentation.hasState" class="agent-muted">
                  当前还没有 pi-core context bundle 或 session tree。
                </div>
                <template v-else>
                  <div class="snapshot-line">
                    <span class="snapshot-label">Active</span>
                    <strong>{{ piRuntimePresentation.activeNode?.kind || 'none' }}</strong>
                    <span>{{ piRuntimePresentation.treeRows.length }} nodes · {{ piRuntimePresentation.contextFiles.length }} files</span>
                  </div>
                  <div class="pi-skill-compare">
                    <div>
                      <span>共同技能</span>
                      <strong>{{ skillComparison.shared.join(', ') || 'none' }}</strong>
                    </div>
                    <div>
                      <span>Graph 建议未加载</span>
                      <strong>{{ skillComparison.graphOnly.join(', ') || 'none' }}</strong>
                    </div>
                    <div>
                      <span>pi 实际新增</span>
                      <strong>{{ skillComparison.piOnly.join(', ') || 'none' }}</strong>
                    </div>
                  </div>
                  <div class="pi-context-list">
                    <div v-for="file in piRuntimePresentation.contextFiles" :key="file.path" class="pi-context-row">
                      <strong>{{ file.title }}</strong>
                      <span>{{ file.path }}</span>
                    </div>
                  </div>
                </template>
              </div>

              <div class="agent-section">
                <span class="agent-section-title">Attention</span>
                <div
                  v-for="source in activePreview.agent.attentionSources"
                  :key="source.id"
                  class="source-card"
                  :class="source.inclusion"
                >
                  <div class="source-head">
                    <div class="source-title-row">
                      <span class="source-kind">{{ sourceKindLabel(source.sourceKind) }}</span>
                      <strong>{{ source.label }}</strong>
                    </div>
                    <span class="inclusion-pill">{{ source.inclusion }}</span>
                  </div>
                  <div class="source-meta">
                    <span>{{ source.kind }}</span>
                    <span v-if="source.forgeSlot">{{ source.forgeSlot }} · {{ source.forgeRegion }}</span>
                    <span v-if="source.sourcePath">{{ source.sourcePath }}</span>
                    <span v-if="source.outputMessageIndex !== null">message {{ source.outputMessageIndex }}</span>
                    <span v-else>仅作为候选源</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CleanedMessage } from '../../../types/nexus.js';
import type { MemorySnapshot } from '../../../types/MemorySnapshotTypes.js';
import type { ForgePromptPreviewBundle } from '../../../types/ForgePromptTypes.js';
import type { PromptSourceKind, PromptUnitInclusion } from '../../../types/PromptAssemblyTypes.js';
import { useCardMakerStore } from '../CardMakerStore.js';
import { useForgeStore } from '../../../stores/useForgeStore.js';
import {
    buildForgePiRuntimePresentation,
    buildForgePiSkillComparison
} from './forgePiRuntimePresentation.js';

const props = withDefaults(defineProps<{
    open?: boolean;
    placement?: 'above' | 'below';
}>(), {
    open: false,
    placement: 'above'
});

defineEmits<{
    (e: 'close'): void;
}>();

const store = useCardMakerStore();
const forgeStore = useForgeStore();
const isLoading = ref(false);
const error = ref('');
const previewBundle = ref<ForgePromptPreviewBundle | null>(null);
const memorySnapshot = ref<MemorySnapshot | null>(null);
const modelTab = ref<'primary' | 'executor'>('primary');
const viewTab = ref<'messages' | 'sources' | 'agent'>('messages');
const activePreview = computed(() => previewBundle.value?.[modelTab.value] || null);
const piRuntimePresentation = computed(() => buildForgePiRuntimePresentation({
    contextBundleSummary: forgeStore.piContextBundleSummary,
    tree: forgeStore.piSessionTree,
    activeNodeId: forgeStore.activePiNodeId,
    loadedSkills: forgeStore.piLoadedSkills,
    loadedExtensions: forgeStore.piLoadedExtensions
}));
const skillComparison = computed(() => buildForgePiSkillComparison(
    activePreview.value?.agent?.selectedSkills ?? [],
    piRuntimePresentation.value.skills
));

const roleLabel = (role: CleanedMessage['role']) => {
    if (role === 'system') return 'System';
    if (role === 'user') return 'User';
    return 'Assistant';
};

const formatPromptText = (content: string) => {
    if (!content) return '';
    return content
        .replace(/^\s*\n+/, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n\s*$/, '');
};

const sourceKindLabel = (kind: PromptSourceKind) => {
    const labels: Record<PromptSourceKind, string> = {
        preset: '预设',
        character: '角色',
        worldbook: '世界书',
        history: '历史',
        memory: '记忆',
        forge: 'Forge',
        skill: 'Skill',
        shell: 'Shell',
        tool: '工具',
        user_input: '用户输入',
        system_protocol: '协议',
        macro: '宏',
        unknown: '未知'
    };
    return labels[kind] || kind;
};

const inclusionLabel = (inclusion: PromptUnitInclusion) => {
    const labels: Record<PromptUnitInclusion, string> = {
        full: '全文',
        summary: '摘要',
        hidden: '隐藏',
        pinned: '钉固',
        compressed: '压缩'
    };
    return labels[inclusion] || inclusion;
};

const refresh = async () => {
    if (isLoading.value) return;

    isLoading.value = true;
    error.value = '';

    try {
        memorySnapshot.value = store.buildMemorySnapshot();
        previewBundle.value = await store.buildPromptPreviewPayload();
    } catch (err: any) {
        error.value = err?.message || 'Prompt 预览加载失败';
    } finally {
        isLoading.value = false;
    }
};

watch(
    () => props.open,
    async (isOpen) => {
        if (isOpen) {
            await refresh();
        }
    }
);

watch(
    () => store.selectedPresetId,
    async () => {
        if (props.open) {
            await refresh();
        }
    }
);
</script>

<style scoped>
.forge-prompt-preview {
  position: absolute;
  z-index: 30;
}

.forge-prompt-preview.placement-above {
  left: 0;
  right: 0;
  bottom: calc(100% + 12px);
  width: min(100%, clamp(320px, 72vw, 720px));
  max-width: min(100%, calc(100vw - 40px));
  margin-inline: auto;
}

.forge-prompt-preview.placement-below {
  top: calc(100% + 12px);
  right: 0;
  width: min(720px, calc(100vw - 40px));
  max-width: calc(100vw - 40px);
}

.preview-panel {
  width: 100%;
  background: color-mix(in srgb, var(--lw-bg-surface) 97%, transparent);
  border: 1px solid var(--lw-border-base);
  border-radius: 24px;
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  backdrop-filter: blur(20px);
}

.preview-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 84%, transparent);
}

.preview-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.preview-title {
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
}

.preview-subtitle {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
  line-height: 1.5;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.payload-badge {
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-primary);
  background: rgba(var(--lw-primary-rgb), 0.1);
  border-radius: 999px;
  padding: 5px 8px;
}

.refresh-btn,
.close-btn {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
  border-radius: 999px;
  padding: 6px 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn {
  width: 30px;
  height: 30px;
  padding: 0;
}

.refresh-btn:hover,
.close-btn:hover {
  background: var(--lw-bg-hover);
  border-color: var(--lw-border-hover);
  color: var(--lw-text-main);
}

.refresh-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.error-banner {
  margin: 12px 16px 0;
  padding: 9px 11px;
  border-radius: 12px;
  background: rgba(255, 115, 115, 0.1);
  border: 1px solid rgba(255, 115, 115, 0.18);
  color: #ffc0c0;
  font-size: var(--lw-type-label-small-size);
}

.preview-body {
  max-height: clamp(260px, 44dvh, 460px);
  overflow-y: auto;
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent);
  width: fit-content;
}

.view-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
}

.view-btn {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-muted);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
}

.view-btn.active {
  border-color: rgba(var(--lw-primary-rgb), 0.34);
  background: rgba(var(--lw-primary-rgb), 0.12);
  color: var(--lw-primary);
}

.tab-btn {
  border: none;
  background: transparent;
  color: var(--lw-text-muted);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
  transition: all 0.18s ease;
}

.tab-btn.active {
  background: rgba(var(--lw-primary-rgb), 0.12);
  color: var(--lw-primary);
}

.snapshot-card {
  padding: 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent);
  border: 1px solid var(--lw-border-base);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-context-card {
  gap: 10px;
}

.snapshot-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-secondary);
}

.snapshot-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-primary);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.snapshot-line strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-small-size);
}

.empty-state {
  padding: 32px 12px;
  text-align: center;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
}

.prompt-msg {
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  overflow: clip;
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
}

.prompt-msg.system .prompt-meta {
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-primary);
}

.prompt-msg.user .prompt-meta {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
}

.prompt-msg.assistant .prompt-meta {
  background: rgba(var(--lw-primary-rgb), 0.08);
  color: var(--lw-primary);
}

.prompt-meta {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.name {
  opacity: 0.72;
}

.prompt-text {
  margin: 0;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.65;
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
  font-family: ui-monospace, Consolas, monospace;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.agent-preview,
.agent-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.agent-summary,
.agent-section {
  padding: 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent);
  border: 1px solid var(--lw-border-base);
}

.agent-section-title {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.agent-node,
.agent-capability {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 10px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
}

.agent-node strong,
.agent-capability strong {
  color: var(--lw-text-main);
}

.agent-capability > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.agent-muted {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
}

.agent-statement {
  margin: 0;
  padding: 11px;
  border-radius: 10px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-label-small-size);
  line-height: 1.55;
}

.pi-skill-compare {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.pi-skill-compare > div,
.pi-context-row {
  border-radius: 10px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  padding: 9px 10px;
}

.pi-skill-compare span,
.pi-context-row span {
  display: block;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  line-height: 1.45;
}

.pi-skill-compare strong,
.pi-context-row strong {
  display: block;
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-small-size);
  line-height: 1.5;
  margin-top: 3px;
}

.pi-context-list {
  display: grid;
  gap: 7px;
}

.source-card {
  border: 1px solid var(--lw-border-base);
  border-radius: 12px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  padding: 11px 12px;
}

.source-card.hidden {
  opacity: 0.68;
}

.source-card.control {
  border-color: rgba(var(--lw-primary-rgb), 0.28);
}

.source-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.source-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.source-title-row strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.35;
}

.source-kind,
.inclusion-pill,
.transform-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  white-space: nowrap;
}

.source-kind {
  color: var(--lw-primary);
  background: rgba(var(--lw-primary-rgb), 0.1);
}

.inclusion-pill {
  color: var(--lw-text-secondary);
  background: var(--lw-bg-subtle);
}

.source-card.summary .inclusion-pill,
.source-card.compressed .inclusion-pill {
  color: #b7791f;
  background: rgba(245, 158, 11, 0.12);
}

.source-card.hidden .inclusion-pill {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.source-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 8px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  line-height: 1.45;
}

.transform-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
}

.transform-chip {
  color: var(--lw-text-secondary);
  background: var(--lw-bg-subtle);
}

.transform-chip.lossy {
  color: #b7791f;
  background: rgba(245, 158, 11, 0.12);
}

.preview-panel-enter-active,
.preview-panel-leave-active {
  transition: all 0.22s ease;
}

.preview-panel-enter-from,
.preview-panel-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 960px) {
  .forge-prompt-preview {
    left: 0;
    right: 0;
    width: 100%;
    max-width: none;
  }

  .preview-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
