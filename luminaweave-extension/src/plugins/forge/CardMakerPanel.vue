<template>
  <div class="card-maker-root">
    <div class="topbar">
      <div class="title">Lumina Forge</div>
      <div class="meta">
        <span class="pill">sessionChatId: {{ store.sessionChatId }}</span>
      </div>
    </div>

    <div class="controls">
      <div class="row">
        <label class="label">Preset</label>
        <select class="select" v-model="store.selectedPresetId" :disabled="store.isGenerating">
          <option v-for="p in store.presets" :key="p.id" :value="p.id">
            {{ p.name }}<span v-if="p.isDefault"> (default)</span>
          </option>
        </select>
        <button class="btn" @click="refresh" :disabled="store.isGenerating">刷新</button>
        <button class="btn" @click="restoreDefaults" :disabled="store.isGenerating">恢复默认</button>
      </div>

      <div class="row">
        <label class="label">Import</label>
        <input class="input" v-model="importName" placeholder="name (optional)" :disabled="store.isGenerating" />
        <button class="btn" @click="openImport" :disabled="store.isGenerating">导入 JSON</button>
        <button class="btn" @click="exportCurrent" :disabled="!store.selectedPresetId || store.isGenerating">导出</button>
      </div>

      <div class="row">
        <label class="label">Session</label>
        <button class="btn" @click="store.resetSession" :disabled="store.isGenerating">新会话</button>
        <button class="btn danger" @click="store.abort" :disabled="!store.isGenerating">停止生成</button>
      </div>
    </div>

    <div class="composer">
      <textarea
        class="textarea"
        v-model="store.input"
        :disabled="store.isGenerating"
        placeholder="输入制卡需求：人设、性格、背景、说话风格、禁忌、格式要求等"
        rows="4"
      />
      <button class="btn primary" @click="store.generate" :disabled="!store.canGenerate">
        生成
      </button>
    </div>

    <div class="error" v-if="store.lastError">{{ store.lastError }}</div>

    <div class="messages">
      <div v-for="(m, idx) in store.messages" :key="idx" class="msg" :class="`role-${m.role}`">
        <div class="msg-role">{{ m.role }}</div>
        <pre class="msg-content">{{ m.content }}</pre>
      </div>
    </div>

    <div v-if="store.isGenerating && store.streamText" class="stream-indicator">
      streaming…
    </div>

    <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="handleFileChange" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useCardMakerStore } from './CardMakerStore';

const store = useCardMakerStore();
const fileInput = ref<HTMLInputElement | null>(null);
const importName = ref('');

const refresh = async () => {
  await store.refreshPresets();
};

const restoreDefaults = async () => {
  await store.restoreDefaultPresets();
};

const openImport = () => {
  fileInput.value?.click();
};

const handleFileChange = async (e: Event) => {
  const inputEl = e.target as HTMLInputElement;
  const file = inputEl.files?.[0];
  if (!file) return;
  const text = await file.text();
  await store.importPreset(text, importName.value.trim() || undefined);
  inputEl.value = '';
  importName.value = '';
};

const exportCurrent = async () => {
  const id = store.selectedPresetId;
  if (!id) return;
  const text = await store.exportPreset(id);
  await navigator.clipboard.writeText(text);
};

onMounted(async () => {
  await store.refreshPresets();
});
</script>

<style scoped>
.card-maker-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  padding: 16px;
  background: var(--lw-bg-color);
  pointer-events: auto;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title {
  font-size: 16px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.pill {
  font-size: 12px;
  color: var(--lw-text-secondary);
  padding: 4px 8px;
  border: 1px solid var(--lw-border);
  border-radius: 999px;
  background: #fff;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--lw-border);
  border-radius: var(--lw-radius);
}

.row {
  display: grid;
  grid-template-columns: 68px 1fr auto auto;
  gap: 8px;
  align-items: center;
}

.row:nth-child(2) {
  grid-template-columns: 68px 1fr auto auto;
}

.row:nth-child(3) {
  grid-template-columns: 68px auto auto;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--lw-text-secondary);
}

.select,
.input,
.textarea {
  border: 1px solid var(--lw-border);
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  background: #fff;
}

.textarea {
  resize: vertical;
}

.btn {
  border: 1px solid var(--lw-border);
  border-radius: 8px;
  background: #fff;
  padding: 8px 10px;
  font-weight: 600;
  cursor: pointer;
}

.btn.primary {
  background: var(--lw-primary);
  color: #fff;
  border-color: var(--lw-primary);
}

.btn.danger {
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.3);
  background: rgba(185, 28, 28, 0.06);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.composer {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.composer .textarea {
  flex: 1;
}

.error {
  color: #b91c1c;
  background: rgba(185, 28, 28, 0.06);
  border: 1px solid rgba(185, 28, 28, 0.3);
  padding: 10px 12px;
  border-radius: var(--lw-radius);
}

.messages {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--lw-border);
  border-radius: var(--lw-radius);
}

.msg {
  border: 1px solid var(--lw-border-subtle);
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
}

.msg-role {
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-secondary);
  margin-bottom: 6px;
}

.msg-content {
  white-space: pre-wrap;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: var(--lw-text-main);
}

.stream-indicator {
  font-size: 12px;
  color: var(--lw-text-secondary);
  text-align: right;
}

.hidden {
  display: none;
}
</style>

