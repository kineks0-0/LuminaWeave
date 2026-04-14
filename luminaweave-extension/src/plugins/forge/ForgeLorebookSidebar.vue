<template>
  <div class="forge-lorebook" :class="{ 'is-editing': editorOverlayOpen }">
    <template v-if="editorOverlayOpen && editorEntry">
      <div class="editor-stage">
        <ForgeLorebookEditor
          :key="selectedFileId || 'new'"
          :entry="editorEntry"
          :can-delete="Boolean(selectedFileId)"
          @close="closeEditorOverlay"
          @save="handleSave"
          @delete="handleDelete"
        />
      </div>
    </template>

    <template v-else>
      <div class="sidebar-top">
        <div class="sidebar-title">
          <span class="sidebar-kicker">Virtual Lorebook</span>
          <strong>虚拟世界书</strong>
          <span class="sidebar-meta">{{ files.length }} 个条目<span v-if="store.importedLorebookId"> · 已导入来源</span></span>
        </div>
        <div class="sidebar-actions">
          <button class="new-entry-btn" @click="createNewEntry">+ 新建条目</button>
          <button class="ghost-btn" @click="showImportPanel = !showImportPanel">{{ showImportPanel ? '收起导入' : '导入世界书' }}</button>
        </div>
      </div>

      <div v-if="showImportPanel" class="import-strip">
        <select v-model="importBookId" class="book-select">
          <option value="">选择要导入的世界书</option>
          <option v-for="book in books" :key="book.id" :value="book.id">
            {{ book.name }}
          </option>
        </select>
        <button class="ghost-btn" :disabled="!importBookId" @click="handleImportBook">手动导入</button>
        <button v-if="store.importedLorebookId" class="ghost-btn subtle" @click="store.clearImportedLorebookBinding()">解除来源</button>
      </div>

      <div class="search-row">
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="筛选虚拟条目、关键词或内容..."
        />
      </div>

      <div class="file-list-shell">
        <div class="file-list-header">
          <span>虚拟文件</span>
          <span>{{ filteredEntries.length }}</span>
        </div>

        <div v-if="filteredEntries.length === 0" class="file-empty">
          <strong>当前没有虚拟条目</strong>
          <p>新建条目，或者先从一个真实世界书手动导入。</p>
        </div>

        <div v-else class="file-list">
          <button
            v-for="file in filteredEntries"
            :key="file.id"
            class="file-item"
            :class="{ 'is-active': selectedFileId === file.id }"
            @click="selectFile(file.id)"
          >
            <div class="file-item-main">
              <span class="file-name">{{ file.entry.comment || '未命名条目' }}</span>
              <span class="file-id">{{ file.sourceBookId ? 'imported' : 'virtual' }}</span>
            </div>
            <div class="file-item-meta">
              <span>{{ (file.entry.key || []).slice(0, 2).join(' · ') || '无关键词' }}</span>
              <span>{{ truncate(file.entry.content, 36) }}</span>
              <span>更新于 {{ formatTime(file.updatedAt) }}</span>
            </div>
          </button>
        </div>
      </div>

      <div v-if="previewEntry" class="detail-shell">
        <div class="detail-header">
          <div class="detail-title-group">
            <div class="detail-kicker">{{ selectedFile?.sourceBookId ? '已导入条目' : '虚拟条目' }}</div>
            <h2 class="detail-title-text">{{ previewEntry.comment || '未命名条目' }}</h2>
            <div v-if="selectedFile" class="detail-timestamp-row">
              <div class="ts-group">
                <span class="ts-label">创建于</span>
                <span class="ts-value">{{ formatTime(selectedFile.createdAt) }}</span>
              </div>
              <span class="ts-separator">·</span>
              <div class="ts-group">
                <span class="ts-label">更新于</span>
                <span class="ts-value">{{ formatTime(selectedFile.updatedAt) }}</span>
              </div>
            </div>
          </div>
          <div class="detail-actions">
            <button class="ghost-btn" @click="openEditorOverlay">展开编辑</button>
            <button class="ghost-btn" @click="clearSelection">清空选择</button>
          </div>
        </div>

        <section class="preview-card-wrapper">
          <ForgeLorebookPreview :entry="previewEntry" minimal />
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { luminaWeaveApi } from '../../api';
import { useCardMakerStore } from './CardMakerStore';
import type { ForgeVirtualLorebookEntry } from '../../types/SessionTypes';
import ForgeLorebookEditor from './ForgeLorebookEditor.vue';
import ForgeLorebookPreview from './ForgeLorebookPreview.vue';

defineProps<{
  workspaceSessionId?: string;
}>();

const store = useCardMakerStore();
const lorebookManager = luminaWeaveApi.lorebookManager;
const importBookId = ref('');
const searchQuery = ref('');
const selectedFileId = ref<string | null>(null);
const previewEntry = ref<LuminaLorebookEntry | null>(null);
const editorEntry = ref<LuminaLorebookEntry | null>(null);
const editorOverlayOpen = ref(false);
const showImportPanel = ref(false);

const books = computed(() => lorebookManager.books || []);
const files = computed(() => store.virtualLorebookEntries);
const selectedFile = computed<ForgeVirtualLorebookEntry | null>(() => (
  files.value.find((item: ForgeVirtualLorebookEntry) => item.id === selectedFileId.value) || null
));

const filteredEntries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return files.value;
  return files.value.filter((file: ForgeVirtualLorebookEntry) =>
    file.entry.comment?.toLowerCase().includes(query) ||
    file.entry.content?.toLowerCase().includes(query) ||
    file.entry.key?.some((key: string) => (key as string).toLowerCase().includes(query))
  );
});

const truncate = (text: string | null | undefined, length: number) => {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

const formatTime = (value: number) => new Date(value).toLocaleString([], {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const previewKeywords = computed(() => (previewEntry.value?.key || []).slice(0, 6));

const clearSelection = () => {
  selectedFileId.value = null;
  previewEntry.value = null;
  editorEntry.value = null;
  editorOverlayOpen.value = false;
};

const selectFile = (id: string) => {
  selectedFileId.value = id;
  const target = files.value.find((item: ForgeVirtualLorebookEntry) => item.id === id) || null;
  previewEntry.value = target ? JSON.parse(JSON.stringify(target.entry)) : null;
  editorEntry.value = target ? JSON.parse(JSON.stringify(target.entry)) : null;
  editorOverlayOpen.value = false;
};

const createNewEntry = () => {
  selectedFileId.value = null;
  previewEntry.value = null;
  editorEntry.value = {
    uid: '',
    key: [],
    keysecondary: [],
    comment: '新条目',
    content: '',
    order: 100,
    disable: false,
    constant: false,
    selective: false,
    selectiveLogic: 0,
    position: 0,
    depth: 0,
    probability: 100,
    scan_depth: 0
  };
  editorOverlayOpen.value = true;
};

const openEditorOverlay = () => {
  editorEntry.value = previewEntry.value ? JSON.parse(JSON.stringify(previewEntry.value)) : editorEntry.value;
  editorOverlayOpen.value = true;
};

const closeEditorOverlay = () => {
  editorOverlayOpen.value = false;
  if (!selectedFileId.value) {
    editorEntry.value = null;
  }
};

const handleImportBook = async () => {
  if (!importBookId.value) return;
  const success = await store.importLorebookIntoVirtualWorkspace(importBookId.value);
  if (!success) return;
  showImportPanel.value = false;
  clearSelection();
};

const handleSave = async (entry: LuminaLorebookEntry) => {
  const nextFileId = store.upsertVirtualLorebookEntry({
    id: selectedFileId.value || undefined,
    entry
  });
  selectFile(nextFileId);
  editorOverlayOpen.value = false;
};

const handleDelete = async () => {
  if (!selectedFileId.value) {
    clearSelection();
    return;
  }

  const confirmed = window.confirm('确定要删除这个虚拟条目吗？这不会影响真实世界书。');
  if (!confirmed) return;
  store.removeVirtualLorebookEntry(selectedFileId.value);
  clearSelection();
};

watch(() => store.workspaceSessionId, () => {
  clearSelection();
});

onMounted(async () => {
  await lorebookManager.syncFromST();
});
</script>

<style scoped>
.forge-lorebook {
  --forge-side-line: color-mix(in srgb, var(--lw-border-base) 92%, transparent);
  --forge-side-line-strong: color-mix(in srgb, var(--lw-border-strong) 72%, transparent);
  --forge-side-surface: color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent);
  --forge-side-surface-soft: color-mix(in srgb, var(--lw-bg-subtle) 74%, transparent);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--lw-text-main);
  background:
    linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.05), rgba(var(--lw-primary-rgb), 0.015) 22%, transparent 50%),
    color-mix(in srgb, var(--lw-bg-surface) 94%, var(--lw-bg-app));
}

.sidebar-top,
.import-strip,
.search-row,
.file-list-shell,
.detail-shell,
.editor-stage {
  min-width: 0;
}

.editor-stage {
  flex: 1;
  min-height: 0;
}

.sidebar-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--forge-side-line);
  align-items: center;
}

.sidebar-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.sidebar-title strong {
  font-size: 23px;
  line-height: 1;
  letter-spacing: -0.03em;
}

.sidebar-meta {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.sidebar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.import-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  padding: 0 18px 12px;
}

.book-select,
.search-input {
  width: 100%;
  border-radius: 999px;
  border: 1px solid var(--forge-side-line);
  background: color-mix(in srgb, var(--forge-side-surface) 96%, transparent);
  color: var(--lw-text-main);
  padding: 10px 14px;
  font-size: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.new-entry-btn,
.ghost-btn {
  border-radius: 999px;
  border: 1px solid var(--forge-side-line);
  background: color-mix(in srgb, var(--forge-side-surface) 96%, transparent);
  color: var(--lw-text-main);
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: var(--lw-transition);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.new-entry-btn {
  background: var(--lw-black);
  border-color: var(--lw-black);
  color: var(--lw-text-inverse);
}

.ghost-btn.subtle {
  color: var(--lw-text-muted);
}

.new-entry-btn:hover {
  background: #000000;
  border-color: #000000;
}

.ghost-btn:hover {
  background: var(--lw-bg-hover);
  border-color: var(--lw-border-hover);
  color: var(--lw-text-main);
}

.ghost-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.search-row {
  padding: 0 18px 16px;
}

.file-list-shell,
.detail-shell {
  min-height: 0;
  overflow: hidden;
}

.file-list-shell {
  flex: 1;
  padding: 0 12px 12px;
}

.file-list-header {
  padding: 0 6px 12px;
  font-size: 11px;
  color: var(--lw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.detail-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.detail-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-primary);
  opacity: 0.85;
}

.detail-title-text {
  margin: 2px 0 6px;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--lw-text-main);
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-timestamp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--lw-text-muted);
}

.ts-group {
  display: flex;
  gap: 4px;
}

.ts-label {
  opacity: 0.7;
}

.ts-value {
  font-weight: 600;
  color: var(--lw-text-secondary);
}

.ts-separator {
  opacity: 0.4;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 100%;
  overflow-y: auto;
  padding: 2px 6px 0;
}

.file-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 14px;
  border-radius: 24px;
  border: 1px solid var(--forge-side-line);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--forge-side-surface) 96%, transparent), color-mix(in srgb, var(--forge-side-surface-soft) 72%, transparent));
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--lw-transition);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.file-item:hover {
  border-color: var(--lw-border-hover);
  transform: translateY(-1px);
}

.file-item.is-active {
  border-color: rgba(var(--lw-primary-rgb), 0.2);
  background:
    linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.12), rgba(var(--lw-primary-rgb), 0.04));
  box-shadow:
    0 14px 30px rgba(15, 23, 42, 0.07),
    0 0 0 3px rgba(var(--lw-primary-rgb), 0.07);
}

.file-item-main,
.file-item-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.file-name {
  font-size: 19px;
  font-weight: 700;
  color: var(--lw-text-main);
  line-height: 1.12;
}

.file-id,
.file-item-meta {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.file-item-meta {
  flex-direction: column;
  gap: 3px;
  line-height: 1.55;
}

.file-empty {
  margin: 8px 6px 0;
  padding: 20px 18px;
  border-radius: 24px;
  border: 1px dashed var(--forge-side-line-strong);
  background: color-mix(in srgb, var(--forge-side-surface) 90%, transparent);
}

.file-empty strong {
  font-size: 14px;
  color: var(--lw-text-main);
}

.file-empty p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--lw-text-muted);
}

.detail-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 0 0 auto;
  padding: 8px 12px 16px;
  border-top: 1px solid var(--forge-side-line);
  background: color-mix(in srgb, var(--lw-bg-surface) 95%, transparent);
}

.preview-card-wrapper {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.preview-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--lw-text-muted);
}

.preview-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-chip {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(var(--lw-primary-rgb), 0.1);
  border: 1px solid rgba(var(--lw-primary-rgb), 0.14);
  color: var(--lw-primary);
  font-size: 11px;
}

.preview-muted {
  font-size: 12px;
  color: var(--lw-text-muted);
}

.content-preview {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.65;
  color: var(--lw-text-secondary);
  font-family: inherit;
}

.inline-expand-btn {
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--forge-side-line);
  background: color-mix(in srgb, var(--forge-side-surface) 96%, transparent);
  color: var(--lw-text-secondary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.inline-expand-btn:hover {
  background: var(--lw-bg-hover);
  border-color: var(--lw-border-hover);
  color: var(--lw-text-main);
}

</style>
