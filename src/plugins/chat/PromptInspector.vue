<template>
  <section class="prompt-inspector" :class="{ 'is-probing': inspection.isProbing }">
    <header class="prompt-inspector__header">
      <div class="prompt-inspector__modes">
        <button
          type="button"
          class="lw-btn"
          :class="mode === 'preview' ? 'lw-btn-primary' : 'lw-btn-ghost'"
          @click="mode = 'preview'"
        >
          <Eye :size="15" />
          <span>预览</span>
        </button>
        <button
          type="button"
          class="lw-btn"
          :class="mode === 'edit' ? 'lw-btn-primary' : 'lw-btn-ghost'"
          @click="openEditor"
        >
          <Pencil :size="15" />
          <span>自由编辑</span>
        </button>
      </div>

      <div class="prompt-inspector__status">
        <LoaderCircle v-if="inspection.isProbing" :size="15" class="is-spinning" />
        <span v-if="inspection.errorMessage" class="is-error">{{ inspection.errorMessage }}</span>
        <span v-else-if="inspection.isProbing">正在探测 Prompt</span>
        <template v-else-if="inspection.source || hasPayload">
          <span
            v-if="inspection.source"
            class="payload-badge"
            :class="inspection.source === 'st' ? 'is-st' : 'is-lumina'"
          >
            {{ sourceLabel }}
          </span>
          <span v-if="hasPayload" class="payload-badge">{{ payloadCountLabel }}</span>
        </template>
        <span v-else>尚无 Prompt 数据</span>
      </div>

      <button
        type="button"
        class="lw-btn lw-btn-secondary lw-btn-icon prompt-inspector__probe"
        title="重新探测 Prompt"
        aria-label="重新探测 Prompt"
        :disabled="inspection.isProbing"
        @click="runProbe"
      >
        <RefreshCw :size="15" />
      </button>
    </header>

    <template v-if="mode === 'preview'">
      <nav class="prompt-inspector__views" aria-label="Prompt 视图">
        <button type="button" :class="{ 'is-active': view === 'messages' }" @click="view = 'messages'">Messages</button>
        <button type="button" :class="{ 'is-active': view === 'raw' }" @click="view = 'raw'">Raw</button>
        <button type="button" :class="{ 'is-active': view === 'sources' }" @click="view = 'sources'">Sources</button>
      </nav>

      <div class="prompt-inspector__body">
        <div
          v-if="(inspection.isProbing || autoProbePending) && !hasPayload"
          class="prompt-inspector__loading"
        >
          <div class="probe-skeleton" aria-hidden="true">
            <div v-for="index in 3" :key="index" class="probe-skeleton__card">
              <span class="probe-skeleton__label"></span>
              <span class="probe-skeleton__line"></span>
              <span class="probe-skeleton__line is-short"></span>
            </div>
          </div>
          <span>{{ probingLabel }}</span>
        </div>

        <div v-else-if="!hasPayload && inspection.errorMessage" class="prompt-inspector__empty">
          <TriangleAlert :size="28" />
          <strong>探测失败</strong>
          <span class="prompt-inspector__empty-message">{{ inspection.errorMessage }}</span>
          <button type="button" class="prompt-inspector__cta" @click="runProbe">重试</button>
        </div>

        <div v-else-if="!hasPayload" class="prompt-inspector__empty">
          <SearchCode :size="28" />
          <strong>还没有 Prompt 快照</strong>
          <span class="prompt-inspector__empty-message">探测只让宿主组装一次请求，不会产生或发送消息。</span>
          <button type="button" class="prompt-inspector__cta" @click="runProbe">开始探测</button>
        </div>

        <div v-else-if="view === 'messages'" class="prompt-inspector__messages">
          <article v-for="(message, index) in messages" :key="index" :data-role="message.role">
            <strong>
              <span class="prompt-inspector__index">#{{ index + 1 }}</span>
              {{ roleLabel(message.role) }}
            </strong>
            <pre>{{ message.content }}</pre>
          </article>
          <pre v-if="messages.length === 0" class="prompt-inspector__raw">{{ rawPayload }}</pre>
        </div>

        <pre v-else-if="view === 'raw'" class="prompt-inspector__raw">{{ rawPayload }}</pre>

        <div v-else class="prompt-inspector__sources">
          <article v-for="source in sources" :key="source.id">
            <div class="prompt-inspector__source-head">
              <strong>{{ source.label }}</strong>
              <span>{{ source.kind }}</span>
              <span>{{ source.inclusion }}</span>
              <small v-if="source.range">输出范围 {{ source.range }}</small>
            </div>
            <code>{{ source.path }}</code>
          </article>
          <div v-if="sources.length === 0" class="prompt-inspector__empty compact">
            <span>本次组装没有来源 trace</span>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="prompt-inspector__editor">
      <div class="prompt-inspector__edit-hint">
        <TriangleAlert :size="13" />
        <span>手动修改后点击运行，将直接使用编辑内容，跳过 ST 重新组装</span>
      </div>
      <textarea v-model="editContent" aria-label="编辑 Prompt" />
      <button
        type="button"
        class="lw-btn lw-btn-primary"
        :disabled="!editContent.trim()"
        @click="runEditedPrompt"
      >
        <Play :size="15" />
        <span>运行编辑后的 Prompt</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Eye, LoaderCircle, Pencil, Play, RefreshCw, SearchCode, TriangleAlert } from 'lucide-vue-next';
import type { ChatPromptInspectionState } from './application/ChatApplicationController.js';
import { isRecord } from '@shared/CommonUtils.js';

interface PromptMessagePresentation {
  role: string;
  content: string;
}

interface PromptSourcePresentation {
  id: string;
  label: string;
  kind: string;
  inclusion: string;
  path: string;
  range: string;
}

const props = defineProps<{
  inspection: ChatPromptInspectionState;
  autoProbe?: boolean;
  onProbe: () => Promise<boolean>;
  onRunEditedPrompt: (text: string) => Promise<boolean>;
}>();

const mode = ref<'preview' | 'edit'>('preview');
const view = ref<'messages' | 'raw' | 'sources'>('messages');
const editContent = ref('');
const autoProbePending = ref(false);
let probeTimer: ReturnType<typeof setTimeout> | null = null;


const readString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  return typeof value === 'string' ? value : '';
};

const payloadBody = computed<unknown>(() => {
  if (!isRecord(props.inspection.payload)) return props.inspection.payload;
  return Array.isArray(props.inspection.payload.messages)
    ? props.inspection.payload.messages
    : props.inspection.payload;
});

const messages = computed<PromptMessagePresentation[]>(() => {
  if (!Array.isArray(payloadBody.value)) return [];
  return payloadBody.value.map((entry) => {
    if (!isRecord(entry)) {
      return { role: 'unknown', content: String(entry ?? '') };
    }

    const contentValue = entry.content ?? entry.mes ?? '';
    const content = typeof contentValue === 'string'
      ? contentValue
      : JSON.stringify(contentValue, null, 2);
    const role = readString(entry, 'role')
      || (entry.is_user === true ? 'user' : entry.is_system === true ? 'system' : 'assistant');
    return { role, content };
  });
});

const assemblyRecord = computed<Record<string, unknown> | null>(() => {
  if (!isRecord(props.inspection.payload)) return null;
  return isRecord(props.inspection.payload.assembly) ? props.inspection.payload.assembly : null;
});

const sources = computed<PromptSourcePresentation[]>(() => {
  const trace = assemblyRecord.value?.trace;
  if (!Array.isArray(trace)) return [];
  return trace.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const start = typeof entry.outputStart === 'number' ? entry.outputStart : null;
    const end = typeof entry.outputEnd === 'number' ? entry.outputEnd : null;
    return [{
      id: readString(entry, 'traceId') || `trace-${index}`,
      label: readString(entry, 'label') || `来源 ${index + 1}`,
      kind: readString(entry, 'sourceKind') || 'unknown',
      inclusion: readString(entry, 'inclusion') || 'unknown',
      path: readString(entry, 'sourcePath') || '-',
      range: start !== null && end !== null ? `${start}-${end}` : ''
    }];
  });
});

const rawPayload = computed(() => {
  if (typeof props.inspection.payload === 'string') return props.inspection.payload;
  if (props.inspection.payload === null || props.inspection.payload === undefined) return '';
  return JSON.stringify(props.inspection.payload, null, 2);
});
const hasPayload = computed(() => Boolean(rawPayload.value));
const sourceLabel = computed(() => props.inspection.source === 'st' ? 'ST 原始' : '幻光组装完成');
const payloadCountLabel = computed(() =>
  Array.isArray(payloadBody.value) ? `${payloadBody.value.length} 条 Messages` : '字符串'
);

const probingLabel = computed(() => {
  if (props.inspection.source === 'st') return '正在向 SillyTavern 请求 Prompt 组装…';
  if (props.inspection.source === 'lumina') return '正在调用 Lumina 合成管线…';
  return '正在组装 Prompt…';
});

const roleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    system: 'System',
    user: 'User',
    assistant: 'Assistant'
  };
  return labels[role] || role;
};

const openEditor = (): void => {
  editContent.value = rawPayload.value;
  mode.value = 'edit';
};

const runProbe = async (): Promise<void> => {
  autoProbePending.value = false;
  await props.onProbe();
};

const runEditedPrompt = async (): Promise<void> => {
  const text = editContent.value.trim();
  if (!text) return;
  await props.onRunEditedPrompt(text);
};

watch(
  () => props.inspection.revision,
  () => {
    if (mode.value !== 'edit') editContent.value = rawPayload.value;
  },
  { immediate: true }
);

onMounted(() => {
  if (props.autoProbe === false || hasPayload.value) return;
  autoProbePending.value = true;
  probeTimer = setTimeout(() => {
    probeTimer = null;
    void runProbe();
  }, 300);
});

onUnmounted(() => {
  if (probeTimer === null) return;
  clearTimeout(probeTimer);
  probeTimer = null;
});
</script>

<style scoped>
.prompt-inspector {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.prompt-inspector__header {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--lw-border-base);
  background: var(--lw-bg-surface);
  padding: 8px 12px;
}

.prompt-inspector__modes {
  display: flex;
  gap: 6px;
}

.prompt-inspector__modes .lw-btn {
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--lw-radius-xs);
  font-size: var(--lw-type-label-small-size);
}

.payload-badge {
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  padding: 2px 8px;
  font-size: var(--lw-type-label-small-size);
  white-space: nowrap;
}

.payload-badge.is-st {
  background: color-mix(in srgb, var(--lw-danger) 12%, transparent);
  color: var(--lw-danger);
}

.payload-badge.is-lumina {
  background: color-mix(in srgb, var(--lw-success) 14%, transparent);
  color: var(--lw-success);
}

.prompt-inspector__status {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
}

.prompt-inspector__status .is-error {
  color: var(--lw-danger);
}

.prompt-inspector__probe {
  flex-shrink: 0;
}

.prompt-inspector__views {
  display: inline-flex;
  align-self: flex-start;
  gap: 4px;
  margin: 10px 12px 0;
  padding: 3px;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-surface);
}

.prompt-inspector__views button {
  border: 0;
  border-radius: var(--lw-radius-xs);
  background: transparent;
  color: var(--lw-text-muted);
  padding: 4px 10px;
  cursor: pointer;
  font: inherit;
  font-size: var(--lw-type-label-small-size);
}

.prompt-inspector__views button.is-active {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
}

.prompt-inspector__body,
.prompt-inspector__editor {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 12px;
  overscroll-behavior: contain;
}

.prompt-inspector__body {
  display: flex;
  flex-direction: column;
}

.prompt-inspector__empty {
  display: flex;
  min-height: 180px;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: var(--lw-text-muted);
}

.prompt-inspector__empty strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
}

.prompt-inspector__empty-message {
  max-width: 36ch;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
}

.prompt-inspector__empty.compact {
  min-height: 100px;
}

.prompt-inspector__loading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  text-align: center;
}

.probe-skeleton {
  display: flex;
  width: min(100%, 560px);
  align-self: center;
  flex-direction: column;
  gap: 10px;
}

.probe-skeleton__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-surface);
  padding: 10px 12px;
}

.probe-skeleton__label {
  width: 72px;
  height: 10px;
  border-radius: 999px;
  background: var(--lw-bg-muted);
}

.probe-skeleton__line {
  height: 10px;
  border-radius: 999px;
  background: var(--lw-bg-muted);
  animation: probe-skeleton-pulse 1.2s ease-in-out infinite;
}

.probe-skeleton__line.is-short {
  width: 62%;
}

@keyframes probe-skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

@media (prefers-reduced-motion: reduce) {
  .probe-skeleton__line {
    animation: none;
  }
}

[data-motion='none'] .probe-skeleton__line {
  animation: none;
}

.prompt-inspector__cta {
  border: 1px solid color-mix(in srgb, var(--lw-primary) 32%, var(--lw-border-base));
  border-radius: var(--lw-radius-xs);
  background: color-mix(in srgb, var(--lw-primary) 10%, transparent);
  color: var(--lw-primary);
  padding: 6px 14px;
  cursor: pointer;
  font: inherit;
  font-size: var(--lw-type-label-medium-size);
  transition: var(--lw-transition);
}

.prompt-inspector__cta:hover {
  background: color-mix(in srgb, var(--lw-primary) 16%, transparent);
}

.prompt-inspector__messages,
.prompt-inspector__sources {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prompt-inspector__messages article,
.prompt-inspector__sources article {
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-surface);
  overflow: hidden;
}

.prompt-inspector__messages strong {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--lw-border-subtle);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  padding: 7px 12px;
  font-size: var(--lw-type-label-small-size);
  letter-spacing: var(--lw-type-label-small-tracking);
}

.prompt-inspector__index {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 14%, transparent);
  padding: 1px 7px;
  font-family: var(--lw-font-mono);
  font-size: var(--lw-type-label-small-size);
  font-weight: 500;
  opacity: 0.9;
}

/* 角色色块保留识别度：与 surface 混合为不透明底色。 */
.prompt-inspector__messages article[data-role='system'] strong {
  background: color-mix(in srgb, var(--lw-success) 14%, var(--lw-bg-surface));
  color: var(--lw-success);
}

.prompt-inspector__messages article[data-role='user'] strong {
  background: color-mix(in srgb, var(--lw-primary) 14%, var(--lw-bg-surface));
  color: var(--lw-primary);
}

.prompt-inspector__messages article[data-role='assistant'] strong {
  background: color-mix(in srgb, var(--lw-warning) 16%, var(--lw-bg-surface));
  color: color-mix(in srgb, var(--lw-warning) 72%, var(--lw-text-main));
}

.prompt-inspector__messages pre,
.prompt-inspector__raw {
  margin: 0;
  color: var(--lw-text-main);
  padding: 12px 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--lw-font-mono);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.65;
}

.prompt-inspector__sources article {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
}

.prompt-inspector__source-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.prompt-inspector__source-head strong {
  min-width: 0;
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-medium-size);
  font-weight: var(--lw-type-label-medium-weight);
}

.prompt-inspector__source-head span {
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-muted);
  padding: 2px 8px;
  font-size: var(--lw-type-label-small-size);
}

.prompt-inspector__source-head small {
  margin-left: auto;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.prompt-inspector__sources code {
  color: var(--lw-text-muted);
  overflow-wrap: anywhere;
  font-family: var(--lw-font-mono);
  font-size: var(--lw-type-label-small-size);
}

.prompt-inspector__editor {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.prompt-inspector__edit-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--lw-warning) 36%, var(--lw-border-base));
  border-radius: var(--lw-radius-xs);
  background: color-mix(in srgb, var(--lw-warning) 10%, transparent);
  color: var(--lw-text-secondary);
  padding: 7px 10px;
  font-size: var(--lw-type-body-small-size);
}

.prompt-inspector__editor textarea {
  min-height: 240px;
  flex: 1;
  resize: none;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
  padding: 10px;
  font-family: var(--lw-font-mono);
}

.prompt-inspector__editor > button {
  align-self: flex-end;
}

.is-spinning {
  animation: prompt-inspector-spin 0.9s linear infinite;
}

@keyframes prompt-inspector-spin {
  to { transform: rotate(360deg); }
}
</style>
