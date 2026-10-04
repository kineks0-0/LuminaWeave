<template>
  <section class="prompt-inspector" :class="{ 'is-probing': inspection.isProbing }">
    <header class="prompt-inspector__header">
      <div class="prompt-inspector__modes">
        <button type="button" :class="{ 'is-active': mode === 'preview' }" @click="mode = 'preview'">
          <Eye :size="15" />
          <span>预览</span>
        </button>
        <button type="button" :class="{ 'is-active': mode === 'edit' }" @click="openEditor">
          <Pencil :size="15" />
          <span>自由编辑</span>
        </button>
      </div>

      <div class="prompt-inspector__status">
        <LoaderCircle v-if="inspection.isProbing" :size="15" class="is-spinning" />
        <span v-if="inspection.errorMessage" class="is-error">{{ inspection.errorMessage }}</span>
        <span v-else-if="inspection.isProbing">正在探测 Prompt</span>
        <span v-else-if="inspection.source">{{ sourceLabel }}</span>
        <span v-else>尚无 Prompt 数据</span>
      </div>

      <button
        type="button"
        class="prompt-inspector__probe"
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
        <div v-if="!hasPayload" class="prompt-inspector__empty">
          <SearchCode :size="28" />
          <span>暂无 Prompt 数据</span>
          <button type="button" @click="runProbe">开始探测</button>
        </div>

        <div v-else-if="view === 'messages'" class="prompt-inspector__messages">
          <article v-for="(message, index) in messages" :key="index" :data-role="message.role">
            <strong>{{ roleLabel(message.role) }}</strong>
            <pre>{{ message.content }}</pre>
          </article>
          <pre v-if="messages.length === 0" class="prompt-inspector__raw">{{ rawPayload }}</pre>
        </div>

        <pre v-else-if="view === 'raw'" class="prompt-inspector__raw">{{ rawPayload }}</pre>

        <div v-else class="prompt-inspector__sources">
          <article v-for="source in sources" :key="source.id">
            <div>
              <strong>{{ source.label }}</strong>
              <span>{{ source.kind }}</span>
              <span>{{ source.inclusion }}</span>
            </div>
            <code>{{ source.path }}</code>
            <small v-if="source.range">输出范围 {{ source.range }}</small>
          </article>
          <div v-if="sources.length === 0" class="prompt-inspector__empty compact">暂无来源 trace</div>
        </div>
      </div>
    </template>

    <div v-else class="prompt-inspector__editor">
      <textarea v-model="editContent" aria-label="编辑 Prompt" />
      <button type="button" :disabled="!editContent.trim()" @click="runEditedPrompt">
        <Play :size="15" />
        <span>运行编辑后的 Prompt</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Eye, LoaderCircle, Pencil, Play, RefreshCw, SearchCode } from 'lucide-vue-next';
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
const sourceLabel = computed(() => props.inspection.source === 'st' ? 'SillyTavern Prompt' : 'Lumina Prompt');

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
  border: 1px solid var(--lw-border-base);
  border-radius: 8px;
  background: var(--lw-bg-app);
  overflow: hidden;
}

.prompt-inspector__header,
.prompt-inspector__views {
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--lw-border-base);
  background: var(--lw-bg-surface);
  padding: 7px 9px;
}

.prompt-inspector__modes {
  display: flex;
  gap: 4px;
}

.prompt-inspector button {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--lw-text-muted);
  padding: 0 8px;
  cursor: pointer;
  font: inherit;
  font-size: var(--lw-type-label-small-size);
}

.prompt-inspector button:hover:not(:disabled),
.prompt-inspector button.is-active {
  border-color: var(--lw-border-base);
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.prompt-inspector button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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
  color: var(--lw-danger, #b91c1c);
}

.prompt-inspector__probe {
  width: 32px;
  padding: 0 !important;
}

.prompt-inspector__views {
  border-bottom-color: var(--lw-border-base);
  padding-block: 5px;
}

.prompt-inspector__body,
.prompt-inspector__editor {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.prompt-inspector__empty {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: var(--lw-text-muted);
}

.prompt-inspector__empty.compact {
  min-height: 100px;
}

.prompt-inspector__messages,
.prompt-inspector__sources {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prompt-inspector__messages article,
.prompt-inspector__sources article {
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  background: var(--lw-bg-surface);
  overflow: hidden;
}

.prompt-inspector__messages strong {
  display: block;
  border-bottom: 1px solid var(--lw-border-base);
  color: var(--lw-text-secondary);
  padding: 6px 10px;
  font-size: var(--lw-type-label-small-size);
}

.prompt-inspector__messages pre,
.prompt-inspector__raw {
  margin: 0;
  color: var(--lw-text-main);
  padding: 10px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-body-small-size);
}

.prompt-inspector__sources article {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}

.prompt-inspector__sources article div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.prompt-inspector__sources article span {
  border-radius: 4px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-muted);
  padding: 2px 5px;
  font-size: var(--lw-type-label-small-size);
}

.prompt-inspector__sources code,
.prompt-inspector__sources small {
  color: var(--lw-text-muted);
  overflow-wrap: anywhere;
}

.prompt-inspector__editor {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.prompt-inspector__editor textarea {
  min-height: 240px;
  flex: 1;
  resize: none;
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
  padding: 10px;
  font-family: ui-monospace, Consolas, monospace;
}

.prompt-inspector__editor > button {
  align-self: flex-end;
  border-color: var(--lw-primary);
  background: var(--lw-primary);
  color: var(--lw-text-inverse);
}

.is-spinning {
  animation: prompt-inspector-spin 0.9s linear infinite;
}

@keyframes prompt-inspector-spin {
  to { transform: rotate(360deg); }
}
</style>
