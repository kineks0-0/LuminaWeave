<template>
  <ForgeAuxPanelShell title="Agent 检视器" kicker="Agent Inspector" subtitle="查看 Agent 运行时状态、提示词与独立测试各模型">
    <template #actions>
      <button
        v-if="tab === 'status'"
        type="button"
        class="ai-action-btn"
        @click="refreshStatus"
      >
        刷新状态
      </button>
      <button
        v-if="tab === 'prompts'"
        type="button"
        class="ai-action-btn"
        :disabled="promptLoading"
        @click="refreshPrompts"
      >
        {{ promptLoading ? '加载中...' : '刷新' }}
      </button>
    </template>

    <div class="ai-root">
      <!-- 标签栏 -->
      <nav class="ai-tabs" role="tablist" aria-label="Agent 检视器">
        <button
          type="button"
          role="tab"
          class="ai-tab"
          :class="{ active: tab === 'status' }"
          :aria-selected="tab === 'status'"
          @click="tab = 'status'"
        >
          状态
        </button>
        <button
          type="button"
          role="tab"
          class="ai-tab"
          :class="{ active: tab === 'prompts' }"
          :aria-selected="tab === 'prompts'"
          @click="tab = 'prompts'"
        >
          提示词
        </button>
        <button
          type="button"
          role="tab"
          class="ai-tab"
          :class="{ active: tab === 'test' }"
          :aria-selected="tab === 'test'"
          @click="tab = 'test'"
        >
          测试
        </button>
      </nav>

      <!-- Tab 1: 状态总览 -->
      <div v-if="tab === 'status'" class="ai-body" role="tabpanel" aria-label="状态总览">
        <!-- 当前模式：非卡片常驻状态条 -->
        <div class="ai-mode-bar">
          <div class="ai-mode-bar-left">
            <span class="ai-badge" :class="`mode-${currentMode}`">{{ currentModeLabel }}</span>
            <span class="ai-mode-meta">{{ currentModeDetail }}</span>
          </div>
          <span class="ai-mode-meta">Layer {{ store.activeLayer }} · {{ store.collectionMode || 'conversation' }}</span>
        </div>

        <!-- 已注册技能 -->
        <section class="ai-card">
          <h3 class="ai-card-title">
            已注册技能
            <span class="ai-count">{{ builtInSkills.length }}</span>
          </h3>
          <div v-if="builtInSkills.length === 0" class="ai-empty-inline">尚无已注册技能 — 技能由 Agent 在运行时按意图加载</div>
          <ul v-else class="ai-card-list">
            <li v-for="skill in builtInSkills" :key="skill.name" class="ai-card-list-item">
              <div class="ai-card-list-head">
                <span class="ai-card-list-title">{{ skill.title }}</span>
                <code class="ai-item-id">{{ skill.name }}</code>
              </div>
              <p class="ai-card-list-desc">{{ skill.description }}</p>
            </li>
          </ul>
        </section>

        <!-- 已注册能力 -->
        <section class="ai-card">
          <h3 class="ai-card-title">
            已注册能力
            <span class="ai-count">{{ capabilities.length }}</span>
          </h3>
          <div v-if="capabilities.length === 0" class="ai-empty-inline">尚无已注册能力 — 能力按需触发加载</div>
          <ul v-else class="ai-card-list">
            <li v-for="cap in capabilities" :key="cap.id" class="ai-card-list-item">
              <div class="ai-card-list-head">
                <span class="ai-card-list-title">{{ cap.title }}</span>
                <span class="ai-risk" :class="`risk-${cap.risk}`">{{ cap.risk }}</span>
                <code class="ai-item-id">{{ cap.loadAs }}</code>
              </div>
              <p class="ai-card-list-desc">{{ cap.summary }}</p>
            </li>
          </ul>
        </section>

        <!-- Agent 图谱追踪 -->
        <section class="ai-card">
          <h3 class="ai-card-title">
            Agent 图谱追踪
            <span v-if="lastGraphResult" class="ai-meta">意图: {{ lastGraphResult.intent }}</span>
          </h3>
          <div v-if="!lastGraphResult" class="ai-empty-inline">尚未运行 Agent 图谱 — 发送一条消息后将自动捕获</div>
          <div v-else class="ai-trace-summary">
            <div class="ai-trace-kv">
              <span class="ai-trace-kv-label">选中技能</span>
              <span>{{ lastGraphResult.selectedSkills.join(', ') || '无' }}</span>
            </div>
            <div class="ai-trace-kv">
              <span class="ai-trace-kv-label">已载入能力</span>
              <span>{{ lastGraphResult.loadedCapabilities.map((c: { capability: { id: string } }) => c.capability.id).join(', ') || '无' }}</span>
            </div>
            <div class="ai-trace-kv">
              <span class="ai-trace-kv-label">工作声明</span>
              <span class="ai-ws">{{ lastGraphResult.workingStatement.summary }}</span>
            </div>
            <div class="ai-trace-kv">
              <span class="ai-trace-kv-label">项目资源</span>
              <span class="ai-resource-line">
                <span>世界书 {{ lastGraphResult.projectResources.lorebookEntryCount }}</span>
                <span>记忆 {{ lastGraphResult.projectResources.memoryEntryCount }}</span>
                <span>草稿 {{ lastGraphResult.projectResources.draftNodeCount }}</span>
                <span>Staging {{ lastGraphResult.projectResources.stagingCount }}</span>
                <span>Ready {{ lastGraphResult.projectResources.commitReadyCount }}</span>
              </span>
            </div>
            <details class="ai-trace-details">
              <summary>图谱追踪链路 ({{ lastGraphResult.trace.length }} 节点)</summary>
              <div v-for="(t, i) in lastGraphResult.trace" :key="i" class="ai-trace-node">
                <span class="ai-trace-idx">{{ i + 1 }}</span>
                <code class="ai-trace-node-name">{{ t.node }}</code>
                <span class="ai-trace-summary">{{ t.summary }}</span>
              </div>
            </details>
          </div>
        </section>

        <!-- 内部状态：默认折叠 -->
        <details class="ai-snapshot-details">
          <summary>内部状态</summary>
          <div v-if="store.workflowSnapshot" class="ai-snapshot-body">
            <dl class="ai-dl">
              <div class="ai-dl-row">
                <dt>Prompt 模式</dt>
                <dd>{{ store.workflowSnapshot.promptMode }}</dd>
              </div>
              <div class="ai-dl-row">
                <dt>推荐动作</dt>
                <dd>{{ store.workflowSnapshot.recommendedAction || '无' }}</dd>
              </div>
              <div class="ai-dl-row">
                <dt>已完成层</dt>
                <dd>{{ store.completedLayers.join(', ') || '无' }}</dd>
              </div>
              <div class="ai-dl-row">
                <dt>发布状态</dt>
                <dd>{{ store.publishState }}</dd>
              </div>
              <div class="ai-dl-row">
                <dt>消息数</dt>
                <dd>{{ store.messageCount }}</dd>
              </div>
            </dl>
          </div>
          <div v-else class="ai-empty-inline">尚未生成工作流快照</div>
        </details>
      </div>

      <!-- Tab 2: 提示词检视 -->
      <div v-if="tab === 'prompts'" class="ai-body" role="tabpanel" aria-label="提示词检视">
        <div class="ai-prompt-toolbar">
          <div>
            <button type="button" class="ai-model-btn" :class="{ active: promptModel === 'primary' }" @click="promptModel = 'primary'">
              主模型
            </button>
            <button type="button" class="ai-model-btn" :class="{ active: promptModel === 'executor' }" @click="promptModel = 'executor'">
              执行模型
            </button>
          </div>
        </div>

        <div v-if="promptError" class="ai-error">{{ promptError }}</div>

        <div v-if="activePromptTab" class="ai-prompt-info">
          <span class="ai-meta">{{ activePromptTab.title }}</span>
          <span class="ai-meta">{{ activePromptTab.payload.length }} 条消息</span>
          <span v-if="activePromptTab.pi" class="ai-meta">pi agent 实际输出</span>
          <span v-if="activePromptTab.pi" class="ai-meta">{{ activePromptTab.pi.contextBundleSummary.files.length }} 个 context file</span>
          <span v-if="activePromptTab.pi" class="ai-meta">{{ activePromptTab.pi.activeTools.length }} 个 tool</span>
        </div>

        <div v-if="activePromptTab" class="ai-messages">
          <article v-for="(msg, idx) in activePromptTab.payload" :key="idx" class="ai-msg">
            <div class="ai-msg-head">
              <span class="ai-msg-role">{{ msg.role }}</span>
              <span v-if="msg.name && msg.name !== 'anonymous'" class="ai-msg-name">{{ msg.name }}</span>
            </div>
            <pre class="ai-msg-content">{{ typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2) }}</pre>
          </article>
        </div>
        <div v-else-if="!promptLoading" class="ai-empty-inline">点击右上角「刷新」加载提示词</div>
      </div>

      <!-- Tab 3: Agent 测试 -->
      <div v-if="tab === 'test'" class="ai-body" role="tabpanel" aria-label="Agent 测试">
        <div class="ai-test-config">
          <label class="ai-label">
            目标 Agent
            <select v-model="testAgent" class="ai-select" :disabled="testRunning">
              <option value="planner">Planner (主模型)</option>
              <option value="executor">Executor (执行模型)</option>
              <option value="analyst">Analyst (分析模型)</option>
              <option value="conversation">Conversation (对话模式)</option>
            </select>
          </label>
        </div>

        <div class="ai-test-input-area">
          <textarea
            v-model="testInput"
            class="ai-test-input"
            :placeholder="testPlaceholder"
            rows="3"
            :disabled="testRunning"
            @keydown.ctrl.enter="runTest"
          />
          <div class="ai-test-actions">
            <button
              type="button"
              class="ai-test-run"
              :disabled="testRunning || !testInput.trim()"
              @click="runTest"
            >
              {{ testRunning ? '执行中...' : '运行测试' }}
            </button>
            <button
              v-if="testRunning"
              type="button"
              class="ai-test-cancel"
              @click="abortTest"
            >
              取消
            </button>
          </div>
        </div>

        <div v-if="testError" class="ai-error">
          <span>{{ testError }}</span>
          <button type="button" class="ai-error-dismiss" @click="testError = null" title="关闭">×</button>
        </div>

        <!-- 测试输出 -->
        <div v-if="testOutput || testRunning" class="ai-test-output-area">
          <div class="ai-test-output-head">
            <span>{{ testRunning ? '流式输出中...' : '输出' }}</span>
            <span v-if="testDuration !== null" class="ai-meta">{{ testDuration }}ms</span>
          </div>
          <pre class="ai-test-output">{{ testOutput || '等待首包...' }}</pre>
        </div>

        <!-- 测试历史 -->
        <div v-if="testHistory.length > 0" class="ai-test-history">
          <div class="ai-history-header">
            <h3 class="ai-card-title">测试历史 ({{ testHistory.length }})</h3>
            <button type="button" class="ai-action-btn" @click="testHistory = []">清空</button>
          </div>
          <div v-for="(entry, idx) in testHistory" :key="idx" class="ai-history-item">
            <div class="ai-history-head">
              <span class="ai-badge" :class="`mode-${entry.agent}`">{{ entry.agent }}</span>
              <span class="ai-meta">{{ entry.duration }}ms</span>
            </div>
            <div class="ai-history-input">{{ entry.input }}</div>
            <details>
              <summary>查看输出</summary>
              <pre class="ai-history-output">{{ entry.output }}</pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  </ForgeAuxPanelShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCardMakerStore } from '../../CardMakerStore.js';
import { forgeSkillRegistry } from '../../../../api/core/forge/skills/ForgeSkillRegistry.js';
import { forgeCapabilityRegistry } from '../../../../api/core/forge/skills/ForgeCapabilityRegistry.js';
import ForgeAuxPanelShell from '../../app/ForgeAuxPanelShell.vue';
import type { ForgePromptPreviewTab } from '../../../../types/ForgePromptTypes.js';

const store = useCardMakerStore();

// ── 标签页状态 ──
const tab = ref<'status' | 'prompts' | 'test'>('status');

// ── Tab 1: 状态总览 ──
const builtInSkills = computed(() => forgeSkillRegistry.listBuiltInSkills());
const capabilities = computed(() => forgeCapabilityRegistry.listCapabilities());
const lastGraphResult = computed(() => store.lastAgentGraphResult);

const currentMode = computed(() => {
  const mode = store.workflowSnapshot?.promptMode;
  return mode || 'planner';
});

const currentModeLabel = computed(() => {
  switch (currentMode.value) {
    case 'planner': return 'Planner';
    case 'analyst': return 'Analyst';
    case 'conversation': return 'Conversation';
    case 'executor': return 'Executor';
    default: return currentMode.value;
  }
});

const currentModeDetail = computed(() => {
  const detail = store.detailMode;
  if (!detail) return '';
  return detail === 'detailed' ? '详细模式' : '快速模式';
});

function refreshStatus() {
  store.captureAgentGraphSnapshot();
}

// ── Tab 2: 提示词检视 ──
const promptModel = ref<'primary' | 'executor'>('primary');
const promptLoading = ref(false);
const promptError = ref<string | null>(null);
const promptBundle = ref<any>(null);

const activePromptTab = computed<ForgePromptPreviewTab | null>(() => {
  if (!promptBundle.value) return null;
  return promptModel.value === 'primary'
    ? promptBundle.value.primary
    : promptBundle.value.executor;
});

async function refreshPrompts() {
  promptLoading.value = true;
  promptError.value = null;
  try {
    promptBundle.value = await store.buildPromptPreviewPayload();
  } catch (e: any) {
    promptError.value = e?.message || '加载提示词失败';
  } finally {
    promptLoading.value = false;
  }
}

// ── Tab 3: Agent 测试 ──
const testAgent = ref<'planner' | 'executor' | 'analyst' | 'conversation'>('planner');
const testInput = ref('');
const testRunning = ref(false);
const testOutput = ref('');
const testError = ref<string | null>(null);
const testDuration = ref<number | null>(null);
const testHistory = ref<Array<{ agent: string; input: string; output: string; duration: number }>>([]);

const testPlaceholder = computed(() => {
  switch (testAgent.value) {
    case 'planner': return '输入规划指令，例如：为角色设计一个战斗系统...';
    case 'executor': return '输入重写指令，例如：把这个条目的内容改成古风风格...';
    case 'analyst': return '输入分析指令，例如：分析当前角色设定中的矛盾点...';
    case 'conversation': return '输入对话内容，例如：你好，请帮我完善角色的背景故事...';
  }
});

function abortTest() {
  store.abortAgentTest();
  testRunning.value = false;
  testOutput.value = '';
}

async function runTest() {
  const input = testInput.value.trim();
  if (!input || testRunning.value) return;

  testRunning.value = true;
  testOutput.value = '';
  testError.value = null;
  const start = Date.now();

  try {
    const result = await store.runAgentTest(testAgent.value, input, (_chunk, fullText) => {
      testOutput.value = fullText;
    });
    testOutput.value = result.rawText;
    testDuration.value = Date.now() - start;

    testHistory.value.unshift({
      agent: testAgent.value,
      input,
      output: result.rawText,
      duration: testDuration.value
    });
    if (testHistory.value.length > 20) {
      testHistory.value = testHistory.value.slice(0, 20);
    }
  } catch (e: any) {
    testError.value = e?.message || '测试执行失败';
  } finally {
    testRunning.value = false;
  }
}
</script>

<style scoped>
/* ── 根布局 ── */
.ai-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

/* ── 标签栏 ── */
.ai-tabs {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ai-tab {
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-large-size);
  font-weight: var(--lw-type-title-small-weight);
  padding: 6px 16px;
  cursor: pointer;
  transition: var(--lw-transition);
}

.ai-tab.active {
  border-color: rgba(var(--lw-primary-rgb), 0.24);
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-text-main);
}

/* ── 操作按钮（外壳 actions 插槽）── */
.ai-action-btn {
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  padding: 6px 14px;
  cursor: pointer;
  transition: var(--lw-transition);
}

.ai-action-btn:hover { background: var(--lw-bg-surface); }
.ai-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── 主体 ── */
.ai-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* ── 当前模式状态条（非卡片）── */
.ai-mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 18px;
  background: rgba(var(--lw-primary-rgb), 0.04);
  border: 1px solid rgba(var(--lw-primary-rgb), 0.1);
}

.ai-mode-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-mode-meta {
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-muted);
}

/* ── 卡片 ── */
.ai-card {
  border-radius: 22px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  padding: 16px;
}

.ai-card-title {
  margin: 0 0 8px 0;
  font-size: var(--lw-type-title-medium-size);
  font-weight: var(--lw-type-title-medium-weight);
  line-height: var(--lw-type-title-medium-line-height);
  color: var(--lw-text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-count {
  font-size: var(--lw-type-label-small-size);
  background: rgba(var(--lw-primary-rgb), 0.14);
  color: var(--lw-primary);
  padding: 1px 7px;
  border-radius: 999px;
}

/* ── 卡片列表（技能 / 能力）── */
.ai-card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ai-card-list-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--lw-border-base);
}

.ai-card-list-item:last-child { border-bottom: none; }

.ai-card-list-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.ai-card-list-title {
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-medium-size);
}

.ai-card-list-desc {
  margin: 2px 0 0;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.5;
}

.ai-item-id {
  font-size: var(--lw-type-label-small-size);
  font-family: var(--lw-font-mono);
  background: var(--lw-bg-subtle);
  padding: 1px 6px;
  border-radius: 6px;
  color: var(--lw-text-muted);
  flex-shrink: 0;
}

/* ── 空状态 ── */
.ai-empty-inline {
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-muted);
  line-height: 1.5;
  font-style: italic;
}

/* ── 徽章 ── */
.ai-badge {
  display: inline-block;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  flex-shrink: 0;
}

.ai-badge.mode-planner       { background: rgba(var(--lw-primary-rgb), 0.12); color: var(--lw-primary); }
.ai-badge.mode-analyst       { background: color-mix(in srgb, var(--lw-primary) 14%, transparent); color: var(--lw-primary); }
.ai-badge.mode-conversation  { background: color-mix(in srgb, var(--lw-success) 14%, transparent); color: var(--lw-success); }
.ai-badge.mode-executor      { background: color-mix(in srgb, var(--lw-warning) 14%, transparent); color: var(--lw-warning); }
.ai-badge.mode-test_chat     { background: color-mix(in srgb, var(--lw-success) 14%, transparent); color: var(--lw-success); }
.ai-badge.mode-batch_creative{ background: color-mix(in srgb, var(--lw-warning) 14%, transparent); color: var(--lw-warning); }

/* ── 元数据文本 ── */
.ai-meta {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

/* ── 风险标志 ── */
.ai-risk {
  font-size: var(--lw-type-label-small-size);
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  flex-shrink: 0;
}

.ai-risk.risk-low    { background: color-mix(in srgb, var(--lw-success) 12%, transparent); color: var(--lw-success); }
.ai-risk.risk-medium { background: color-mix(in srgb, var(--lw-warning) 12%, transparent); color: var(--lw-warning); }
.ai-risk.risk-high   { background: color-mix(in srgb, var(--lw-danger) 12%, transparent); color: var(--lw-danger); }

/* ── 图谱追踪摘要 ── */
.ai-trace-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-trace-kv {
  display: flex;
  gap: 8px;
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-main);
}

.ai-trace-kv-label {
  color: var(--lw-text-muted);
  min-width: 70px;
  flex-shrink: 0;
}

.ai-resource-line {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.ai-ws {
  font-style: italic;
  color: var(--lw-text-secondary);
}

.ai-trace-details {
  margin-top: 8px;
}

.ai-trace-details summary {
  cursor: pointer;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.ai-trace-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: var(--lw-type-label-small-size);
}

.ai-trace-idx {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  min-width: 18px;
}

.ai-trace-node-name {
  font-size: var(--lw-type-label-small-size);
  font-family: var(--lw-font-mono);
  background: var(--lw-bg-subtle);
  padding: 2px 7px;
  border-radius: 6px;
  color: var(--lw-primary);
  min-width: 150px;
}

.ai-trace-summary {
  color: var(--lw-text-muted);
}

/* ── 内部状态可折叠区 ── */
.ai-snapshot-details {
  margin-top: 4px;
}

.ai-snapshot-details summary {
  cursor: pointer;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.ai-snapshot-body {
  margin-top: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-base);
}

.ai-dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 20px;
  margin: 0;
}

.ai-dl-row {
  display: contents;
}

.ai-dl-row dt {
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-muted);
  white-space: nowrap;
  line-height: 1.6;
}

.ai-dl-row dd {
  margin: 0;
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-main);
  line-height: 1.6;
  word-break: break-word;
}

/* ── Prompts 标签页 ── */
.ai-prompt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ai-model-btn {
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  padding: 6px 14px;
  cursor: pointer;
  transition: var(--lw-transition);
}

.ai-model-btn.active {
  border-color: rgba(var(--lw-primary-rgb), 0.24);
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-text-main);
}

/* ── 错误横幅 ── */
.ai-error {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--lw-danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--lw-danger) 24%, transparent);
  color: var(--lw-danger);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.5;
}

.ai-error-dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--lw-danger);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

/* ── 提示词信息 ── */
.ai-prompt-info {
  display: flex;
  gap: 14px;
  padding: 4px 0;
  flex-wrap: wrap;
}

/* ── 消息列表（参照 ForgeModelRequestDebugPanel）── */
.ai-messages {
  display: grid;
  gap: 12px;
}

.ai-msg {
  border-radius: 16px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  padding: 12px;
}

.ai-msg-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ai-msg-role {
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  color: var(--lw-text-main);
}

.ai-msg-name {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.ai-msg-content {
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(11, 18, 32, 0.06);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--lw-text-main);
  font-family: var(--lw-font-mono);
}

/* ── Test 标签页 ── */
.ai-test-config {
  display: flex;
  gap: 14px;
}

.ai-label {
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-muted);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ai-select {
  padding: 7px 12px;
  border: 1px solid var(--lw-border-base);
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.ai-test-input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-test-input {
  padding: 12px;
  border: 1px solid var(--lw-border-base);
  border-radius: 18px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  resize: vertical;
  font-family: inherit;
}

.ai-test-input::placeholder { color: var(--lw-text-muted); }
.ai-test-input:disabled { opacity: 0.55; }

.ai-test-actions {
  display: flex;
  gap: 8px;
}

.ai-test-run {
  padding: 8px 18px;
  border: none;
  border-radius: 999px;
  background: rgba(var(--lw-primary-rgb), 0.14);
  color: var(--lw-primary);
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
  transition: var(--lw-transition);
}

.ai-test-run:hover { background: rgba(var(--lw-primary-rgb), 0.22); }
.ai-test-run:disabled { opacity: 0.4; cursor: not-allowed; }

.ai-test-cancel {
  padding: 8px 18px;
  border: 1px solid var(--lw-border-base);
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-danger) 10%, transparent);
  color: var(--lw-danger);
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
  transition: var(--lw-transition);
}

.ai-test-cancel:hover { background: color-mix(in srgb, var(--lw-danger) 18%, transparent); }

/* ── 测试输出 ── */
.ai-test-output-area {
  border-radius: 18px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  overflow: hidden;
}

.ai-test-output-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  background: var(--lw-bg-subtle);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-secondary);
  border-bottom: 1px solid var(--lw-border-base);
}

.ai-test-output {
  margin: 0;
  padding: 14px;
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--lw-text-main);
  font-family: var(--lw-font-mono);
  max-height: 400px;
  overflow-y: auto;
}

/* ── 测试历史 ── */
.ai-test-history {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ai-history-header .ai-card-title {
  margin: 0;
}

.ai-history-item {
  border-radius: 18px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  padding: 12px;
}

.ai-history-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.ai-history-input {
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-history-item details { margin-top: 6px; }

.ai-history-item summary {
  cursor: pointer;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.ai-history-output {
  margin: 6px 0 0 0;
  padding: 10px;
  background: var(--lw-bg-subtle);
  border-radius: 14px;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--lw-text-main);
  font-family: var(--lw-font-mono);
}

/* ── 响应式 ── */
@media (max-width: 700px) {
  .ai-mode-bar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
