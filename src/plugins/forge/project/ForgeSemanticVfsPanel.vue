<template>
  <ForgeAuxPanelShell
    title="项目 VFS"
    kicker="Project VFS"
    :subtitle="`正在浏览 Agent 可见的 Forge 项目语义 VFS，共 ${projectEntryCount} 个条目。`"
  >
    <template #actions>
      <button
        class="vfs-refresh-btn"
        type="button"
        :disabled="isLoading"
        @click="refreshProjectFiles"
      >
        {{ isLoading ? '刷新中' : '刷新' }}
      </button>
      <span class="vfs-active-node">{{ activeNodeLabel }}</span>
    </template>

    <div class="vfs-summary">
      <div>
        <strong>{{ projectFileCount }}</strong>
        <span>语义文件</span>
      </div>
      <div>
        <strong>{{ directoryCount }}</strong>
        <span>目录节点</span>
      </div>
      <div>
        <strong>{{ aliasCount }}</strong>
        <span>动态别名</span>
      </div>
    </div>

    <p v-if="loadError" class="vfs-error">{{ loadError }}</p>

    <div class="vfs-layout">
      <section class="vfs-list" aria-label="Forge project VFS paths">
        <button
          v-for="row in treeRows"
          :key="row.path"
          type="button"
          class="vfs-row"
          :class="{ selected: selectedPath === row.path }"
          @click="selectedPath = row.path"
        >
          <span class="vfs-row__kind">{{ kindLabel(row.kind) }}</span>
          <span class="vfs-row__main">
            <strong>{{ row.path }}</strong>
            <small>{{ sourceLabel(row.source) }} · {{ policyLabel(row.writePolicy) }}</small>
          </span>
        </button>
      </section>

      <section class="vfs-detail" aria-label="Forge project VFS selected path">
        <template v-if="selectedRow">
          <header>
            <span>{{ kindLabel(selectedRow.kind) }}</span>
            <h3>{{ selectedRow.path }}</h3>
          </header>

          <dl class="vfs-detail__meta">
            <div>
              <dt>来源</dt>
              <dd>{{ sourceLabel(selectedRow.source) }}</dd>
            </div>
            <div>
              <dt>写入边界</dt>
              <dd>{{ policyLabel(selectedRow.writePolicy) }}</dd>
            </div>
          </dl>

          <div v-if="canEditSelectedOverride" class="vfs-override-editor">
            <div class="vfs-override-editor__head">
              <div>
                <strong>{{ selectedRow.source === 'workspace' ? '项目覆盖' : '创建项目覆盖' }}</strong>
                <span>{{ selectedRow.source === 'workspace' ? '保存后继续写入当前项目 VFS。' : '保存后只影响当前 Forge 项目，不回写预设或内置资源。' }}</span>
              </div>
              <div class="vfs-override-editor__actions">
                <button
                  v-if="!overrideEditorOpen"
                  class="vfs-action-btn"
                  type="button"
                  @click="beginOverrideEdit"
                >
                  {{ selectedRow.source === 'workspace' ? '编辑' : '创建覆盖' }}
                </button>
                <template v-else>
                  <button class="vfs-action-btn" type="button" :disabled="isSavingOverride" @click="saveOverride">
                    {{ isSavingOverride ? '保存中' : '保存' }}
                  </button>
                  <button class="vfs-action-btn subtle" type="button" :disabled="isSavingOverride" @click="cancelOverrideEdit">
                    取消
                  </button>
                </template>
              </div>
            </div>
            <textarea
              v-if="overrideEditorOpen"
              v-model="overrideDraft"
              class="vfs-override-textarea"
              rows="10"
            />
            <p v-if="overrideError" class="vfs-error">{{ overrideError }}</p>
          </div>

          <div class="vfs-content-header">
            <strong>{{ selectedRow.kind === 'directory' ? '目录内容' : '文件内容' }}</strong>
            <span>{{ selectedRow.content ? '完整内容' : '预览' }}</span>
          </div>
          <pre class="vfs-preview">{{ selectedRow.content || selectedRow.preview || '暂无文件内容' }}</pre>
        </template>
        <p v-else class="vfs-empty">暂无可展示的项目 VFS 文件。</p>
      </section>
    </div>
  </ForgeAuxPanelShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useForgeStore } from '../../../stores/useForgeStore.js';
import { useCardMakerStore } from '../CardMakerStore.js';
import ForgeAuxPanelShell from '../app/ForgeAuxPanelShell.vue';
import {
  buildForgeSemanticVfsTree,
  flattenForgeSemanticVfsTree,
  isForgeAgentResourceOverridePath,
  type ForgeSemanticVfsNode,
  type ForgeSemanticVfsNodeKind,
  type ForgeSemanticVfsProjectEntry,
  type ForgeSemanticVfsSource,
  type ForgeSemanticVfsWritePolicy
} from './forgeSemanticVfsPresentation.js';
import { compactId } from './forgeWorkspaceVersionPresentation.js';

const forgeStore = useForgeStore();
const cardMakerStore = useCardMakerStore();
const selectedPath = ref('./');
const projectEntries = ref<ForgeSemanticVfsProjectEntry[]>([]);
const isLoading = ref(false);
const loadError = ref<string | null>(null);
const overrideEditorOpen = ref(false);
const overrideDraft = ref('');
const overrideError = ref<string | null>(null);
const isSavingOverride = ref(false);

const tree = computed<ForgeSemanticVfsNode[]>(() => buildForgeSemanticVfsTree({
  contextBundle: null,
  sessionEntries: [],
  activeNodeId: forgeStore.activePiNodeId,
  includeAgentVirtualFiles: false,
  projectFiles: projectEntries.value
}));

const treeRows = computed<ForgeSemanticVfsNode[]>(() => flattenForgeSemanticVfsTree(tree.value));

const selectedRow = computed<ForgeSemanticVfsNode | null>(() =>
  treeRows.value.find(row => row.path === selectedPath.value) ?? treeRows.value[0] ?? null
);

watch(treeRows, (rows) => {
  if (rows.some(row => row.path === selectedPath.value)) return;
  selectedPath.value = rows[0]?.path ?? './';
});

watch(selectedPath, () => {
  overrideEditorOpen.value = false;
  overrideDraft.value = '';
  overrideError.value = null;
});

const refreshProjectFiles = async (): Promise<void> => {
  isLoading.value = true;
  loadError.value = null;
  try {
    projectEntries.value = await cardMakerStore.listProjectVfsEntries();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '项目 VFS 读取失败';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void refreshProjectFiles();
});

watch(
  () => [cardMakerStore.activeForgeProjectId, cardMakerStore.sessionChatId, forgeStore.piSessionEntries.length],
  () => {
    void refreshProjectFiles();
  }
);

const activeNodeLabel = computed(() =>
  forgeStore.activePiNodeId ? `active ${compactId(forgeStore.activePiNodeId)}` : 'active none'
);

const projectEntryCount = computed(() => projectEntries.value.length);
const projectFileCount = computed(() => projectEntries.value.filter(entry => entry.kind !== 'directory').length);
const directoryCount = computed(() => treeRows.value.filter(row => row.kind === 'directory' && row.path !== './').length);
const aliasCount = computed(() => treeRows.value.filter(row => row.kind === 'alias').length);
const canEditSelectedOverride = computed(() =>
  selectedRow.value?.kind === 'file' && isForgeAgentResourceOverridePath(selectedRow.value.path)
);

const beginOverrideEdit = (): void => {
  if (!selectedRow.value || !canEditSelectedOverride.value) return;
  overrideDraft.value = selectedRow.value.content || selectedRow.value.preview || '';
  overrideError.value = null;
  overrideEditorOpen.value = true;
};

const cancelOverrideEdit = (): void => {
  overrideEditorOpen.value = false;
  overrideDraft.value = '';
  overrideError.value = null;
};

const saveOverride = async (): Promise<void> => {
  if (!selectedRow.value || !canEditSelectedOverride.value) return;
  isSavingOverride.value = true;
  overrideError.value = null;
  try {
    const saved = await cardMakerStore.saveProjectVfsOverride(selectedRow.value.path, overrideDraft.value);
    if (!saved) {
      overrideError.value = '项目覆盖保存失败。';
      return;
    }
    await refreshProjectFiles();
    overrideEditorOpen.value = false;
  } catch (error) {
    overrideError.value = error instanceof Error ? error.message : '项目覆盖保存失败';
  } finally {
    isSavingOverride.value = false;
  }
};

const kindLabel = (kind: ForgeSemanticVfsNodeKind): string => {
  if (kind === 'alias') return 'alias';
  if (kind === 'resource-root') return 'root';
  if (kind === 'directory') return 'dir';
  return 'file';
};

const sourceLabel = (source: ForgeSemanticVfsSource): string => {
  if (source === 'context') return 'context';
  if (source === 'session') return 'session';
  if (source === 'workspace') return 'workspace';
  if (source === 'resource') return 'resource';
  return 'virtual';
};

const policyLabel = (policy: ForgeSemanticVfsWritePolicy): string => {
  if (policy === 'direct-write') return '直接写入';
  if (policy === 'protected') return '受保护';
  if (policy === 'pass-through') return '资源只读';
  return '只读';
};
</script>

<style scoped>
.vfs-active-node {
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 82%, transparent);
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, white);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
  display: inline-flex;
  align-items: center;
}

.vfs-refresh-btn {
  min-height: 28px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 82%, transparent);
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, white);
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-small-size);
  font-weight: 700;
  cursor: pointer;
}

.vfs-refresh-btn:disabled {
  color: var(--lw-text-secondary);
  cursor: wait;
}

.vfs-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.vfs-summary div {
  min-width: 0;
  padding: 11px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 82%, transparent);
  background: color-mix(in srgb, var(--lw-bg-subtle) 90%, white);
}

.vfs-summary strong,
.vfs-summary span {
  display: block;
}

.vfs-summary strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-title-large-size);
  line-height: 1;
}

.vfs-summary span {
  margin-top: 6px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
}

.vfs-error {
  margin: 0 0 12px;
  padding: 9px 11px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, #d92d20 30%, var(--lw-border-base));
  background: color-mix(in srgb, #d92d20 8%, var(--lw-bg-subtle));
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
}

.vfs-layout {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(280px, 0.86fr);
  gap: 12px;
  min-height: 0;
}

.vfs-list,
.vfs-detail {
  min-width: 0;
  border-radius: 8px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.vfs-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  max-height: 560px;
  overflow: auto;
}

.vfs-row {
  width: 100%;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 46px;
  padding: 7px 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--lw-text-main);
  text-align: left;
  cursor: pointer;
}

.vfs-row:hover,
.vfs-row.selected {
  border-color: color-mix(in srgb, var(--lw-primary) 30%, var(--lw-border-base));
  background: color-mix(in srgb, var(--lw-primary) 8%, var(--lw-bg-subtle));
}

.vfs-row__kind {
  color: var(--lw-text-secondary);
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-label-small-size);
  text-transform: uppercase;
}

.vfs-row__main {
  min-width: 0;
}

.vfs-row__main strong,
.vfs-row__main small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vfs-row__main strong {
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-main);
}

.vfs-row__main small {
  margin-top: 3px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
}

.vfs-detail {
  padding: 14px;
  max-height: 560px;
  overflow: auto;
}

.vfs-detail header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.vfs-detail header span {
  color: var(--lw-primary);
  font-size: var(--lw-type-label-small-size);
  font-weight: 700;
  text-transform: uppercase;
}

.vfs-detail h3 {
  margin: 0;
  color: var(--lw-text-main);
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-body-size);
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.vfs-detail__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 12px;
}

.vfs-detail__meta div {
  min-width: 0;
  padding: 9px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, transparent);
}

.vfs-detail__meta dt {
  margin: 0 0 4px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
}

.vfs-detail__meta dd {
  margin: 0;
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
  font-weight: 700;
}

.vfs-preview {
  margin: 0;
  min-height: 160px;
  padding: 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 92%, white);
  color: var(--lw-text-main);
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.vfs-override-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  padding: 11px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--lw-primary) 28%, var(--lw-border-base));
  background: color-mix(in srgb, var(--lw-primary) 6%, var(--lw-bg-subtle));
}

.vfs-override-editor__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.vfs-override-editor__head strong,
.vfs-override-editor__head span {
  display: block;
}

.vfs-override-editor__head strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
}

.vfs-override-editor__head span {
  margin-top: 3px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  line-height: 1.5;
}

.vfs-override-editor__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.vfs-action-btn {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-primary) 28%, var(--lw-border-base));
  background: color-mix(in srgb, var(--lw-primary) 10%, var(--lw-bg-elevated));
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-small-size);
  font-weight: 700;
  cursor: pointer;
}

.vfs-action-btn.subtle {
  border-color: color-mix(in srgb, var(--lw-border-base) 82%, transparent);
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, white);
  color: var(--lw-text-secondary);
}

.vfs-action-btn:disabled {
  color: var(--lw-text-muted);
  cursor: wait;
}

.vfs-override-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 180px;
  resize: vertical;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-app);
  color: var(--lw-text-main);
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
  outline: none;
}

.vfs-override-textarea:focus {
  border-color: var(--lw-border-active);
  box-shadow: 0 0 0 4px rgba(var(--lw-primary-rgb), 0.08);
}

.vfs-content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.vfs-content-header strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
}

.vfs-content-header span {
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
}

.vfs-empty {
  margin: 0;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
}

@media (max-width: 880px) {
  .vfs-summary,
  .vfs-layout {
    grid-template-columns: 1fr;
  }

  .vfs-override-editor__head {
    flex-direction: column;
  }

  .vfs-override-editor__actions {
    justify-content: flex-start;
  }
}
</style>
