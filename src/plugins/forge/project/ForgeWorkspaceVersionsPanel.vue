<template>
  <ForgeAuxPanelShell
    title="文件版本"
    kicker="Workspace Versions"
    :subtitle="`当前 pi session 中有 ${versionRows.length} 条工作区版本记录。`"
  >
    <template #actions>
      <span v-if="activeNodeLabel" class="version-active-node">{{ activeNodeLabel }}</span>
    </template>

    <div v-if="versionRows.length > 0" class="version-branch-summary">
      <div>
        <strong>{{ branchDiffSummary.activeBranchChanges }}</strong>
        <span>当前分支变更</span>
      </div>
      <div>
        <strong>{{ branchDiffSummary.otherBranchChanges }}</strong>
        <span>其他分支变更</span>
      </div>
    </div>

    <div v-if="versionRows.length === 0" class="version-empty">
      <strong>暂无工作区版本记录</strong>
      <p>当 Forge 写入工具生成 proposal 或 checkpoint 时，这里会按 pi session tree 展示文件变更。</p>
    </div>

    <div v-else class="version-list">
      <article v-for="row in versionRows" :key="row.id" class="version-card">
        <header class="version-card__header">
          <div class="version-card__title-group">
            <span class="version-card__kind">{{ row.kind === 'patch' ? 'Patch' : 'Checkpoint' }}</span>
            <strong>{{ row.title }}</strong>
            <span class="version-card__node">node {{ compactId(row.nodeId) }}</span>
          </div>
          <div class="version-card__side">
            <span class="version-branch-pill" :class="{ muted: !row.isOnActiveBranch }">
              {{ row.isOnActiveBranch ? '当前分支' : '其他分支' }}
            </span>
            <time class="version-card__time">{{ formatTime(row.createdAt) }}</time>
          </div>
        </header>

        <p v-if="row.summary" class="version-card__summary">{{ row.summary }}</p>

        <template v-if="row.kind === 'patch'">
          <div class="version-card__actions">
            <button
              class="version-action-btn"
              type="button"
              :disabled="!canRestorePatchRow(row, 'before') || isRestoreApplied(row, 'before')"
              @click="applyRestore(row, 'before')"
            >
              撤回变更
            </button>
            <button
              class="version-action-btn"
              type="button"
              :disabled="!canRestorePatchRow(row, 'after') || isRestoreApplied(row, 'after')"
              @click="applyRestore(row, 'after')"
            >
              恢复变更后
            </button>
          </div>

          <div class="version-change-list">
            <div v-for="change in row.changes" :key="`${row.id}:${change.path}`" class="version-change-row">
              <div class="version-change-main">
                <strong>{{ change.path }}</strong>
                <span>{{ changeKindLabel(change.kind) }}</span>
              </div>
              <dl class="version-change-hashes">
                <div>
                  <dt>Before</dt>
                  <dd>{{ change.beforeHash || 'none' }}</dd>
                </div>
                <div>
                  <dt>After</dt>
                  <dd>{{ change.afterHash || 'none' }}</dd>
                </div>
              </dl>
              <details v-if="hasInlineDiff(change)" class="version-inline-diff">
                <summary>查看内容差异</summary>
                <div class="version-diff-grid">
                  <section>
                    <h4>Before</h4>
                    <pre>{{ resolvePatchChangeContents(change).before ?? 'none' }}</pre>
                  </section>
                  <section>
                    <h4>After</h4>
                    <pre>{{ resolvePatchChangeContents(change).after ?? 'none' }}</pre>
                  </section>
                </div>
              </details>
            </div>
          </div>
        </template>

        <dl v-else class="version-checkpoint-meta">
          <div>
            <dt>File tree</dt>
            <dd>{{ row.fileTreeHash }}</dd>
          </div>
          <div>
            <dt>Snapshot</dt>
            <dd>{{ row.stateSnapshotRef }}</dd>
          </div>
          <div v-if="row.label">
            <dt>Label</dt>
            <dd>{{ row.label }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </ForgeAuxPanelShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { luminaWeaveApi } from '../../../api/index.js';
import { useForgeStore } from '../../../stores/useForgeStore.js';
import { useCardMakerStore } from '../CardMakerStore.js';
import type { ForgePiWorkspacePatchChange } from '@shared/ForgePiTypes.js';
import ForgeAuxPanelShell from '../app/ForgeAuxPanelShell.vue';
import {
  buildWorkspaceVersionRows,
  canRestorePatchRow,
  compactId,
  countBranchDiffChanges,
  createWorkspaceVersionRestorePatch,
  resolvePatchChangeContents,
  type PatchVersionRow,
  type WorkspaceVersionRestoreDirection,
  type WorkspaceVersionRow
} from './forgeWorkspaceVersionPresentation.js';

const forgeStore = useForgeStore();
const cardMakerStore = useCardMakerStore();

const versionRows = computed<WorkspaceVersionRow[]>(() =>
  buildWorkspaceVersionRows(forgeStore.piSessionEntries, forgeStore.activePiNodeId)
);

const branchDiffSummary = computed(() => countBranchDiffChanges(versionRows.value));

const activeNodeLabel = computed(() =>
  forgeStore.activePiNodeId ? `active ${compactId(forgeStore.activePiNodeId)}` : ''
);

const restoredPatchKeys = computed(() => new Set(
  forgeStore.piSessionEntries
    .map((entry) => {
      const payload = entry.payload as { restoresEntryId?: unknown; restoreDirection?: unknown };
      return typeof payload.restoresEntryId === 'string' && typeof payload.restoreDirection === 'string'
        ? `${payload.restoresEntryId}:${payload.restoreDirection}`
        : null;
    })
    .filter((key): key is string => Boolean(key))
));

const formatTime = (value: number): string => new Date(value).toLocaleString([], {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const changeKindLabel = (kind: ForgePiWorkspacePatchChange['kind']): string => {
  if (kind === 'create') return '新增';
  if (kind === 'delete') return '删除';
  return '更新';
};

const hasInlineDiff = (change: ForgePiWorkspacePatchChange): boolean => {
  const contents = resolvePatchChangeContents(change);
  return contents.before !== null || contents.after !== null;
};

const isRestoreApplied = (row: PatchVersionRow, direction: WorkspaceVersionRestoreDirection): boolean =>
  restoredPatchKeys.value.has(`${row.id}:${direction}`);

const applyRestore = async (row: PatchVersionRow, direction: WorkspaceVersionRestoreDirection): Promise<void> => {
  const patch = createWorkspaceVersionRestorePatch(row, direction, `workspace-restore-${Date.now().toString(36)}-${row.id}-${direction}`);
  if (patch.changes.length === 0 || isRestoreApplied(row, direction)) return;
  const confirmed = await luminaWeaveApi.confirm({
    title: direction === 'before' ? '撤回文件变更' : '恢复文件变更',
    message: `将直接写入 ${patch.changes.length} 个项目文件，并生成一条反向 workspace_patch。\n\n此操作不会发布或覆盖真实 ST 世界书。`,
    confirmText: direction === 'before' ? '撤回' : '恢复',
    cancelText: '取消'
  });
  if (!confirmed) return;
  await cardMakerStore.applyWorkspacePatch(patch);
};
</script>

<style scoped>
.version-active-node {
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

.version-branch-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.version-branch-summary div {
  min-width: 0;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 82%, transparent);
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, white);
}

.version-branch-summary strong,
.version-branch-summary span {
  display: block;
}

.version-branch-summary strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-title-large-size);
  line-height: 1;
}

.version-branch-summary span {
  margin-top: 6px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
}

.version-empty,
.version-card {
  border-radius: 8px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.version-empty {
  padding: 16px;
  color: var(--lw-text-secondary);
}

.version-empty strong {
  display: block;
  margin-bottom: 6px;
  color: var(--lw-text-main);
}

.version-empty p {
  margin: 0;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-card {
  padding: 14px;
}

.version-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.version-card__title-group {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.version-card__side {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-end;
  flex-direction: column;
  gap: 6px;
}

.version-card__kind,
.version-card__node,
.version-card__time {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.version-card__title-group strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-title-small-size);
  line-height: 1.35;
}

.version-card__time {
  flex: 0 0 auto;
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
}

.version-branch-pill {
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid rgba(var(--lw-primary-rgb), 0.22);
  background: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.08) 82%, var(--lw-bg-elevated));
  color: rgb(var(--lw-primary-rgb));
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  display: inline-flex;
  align-items: center;
}

.version-branch-pill.muted {
  border-color: color-mix(in srgb, var(--lw-border-base) 78%, transparent);
  background: color-mix(in srgb, var(--lw-bg-subtle) 86%, white);
  color: var(--lw-text-muted);
}

.version-card__summary {
  margin: 10px 0 0;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
}

.version-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.version-action-btn {
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 78%, transparent);
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, white);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
}

.version-action-btn:not(:disabled):hover {
  border-color: rgba(var(--lw-primary-rgb), 0.24);
  background: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.08) 72%, var(--lw-bg-subtle));
  color: var(--lw-text-main);
}

.version-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.version-change-list {
  margin-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--lw-border-base) 74%, transparent);
}

.version-change-row {
  padding: 10px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--lw-border-base) 74%, transparent);
}

.version-change-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.version-change-main strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
}

.version-change-main span {
  flex: 0 0 auto;
  color: rgb(var(--lw-primary-rgb));
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.version-change-hashes,
.version-checkpoint-meta {
  margin: 8px 0 0;
  display: grid;
  gap: 6px;
}

.version-change-hashes div,
.version-checkpoint-meta div {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 8px;
}

.version-change-hashes dt,
.version-checkpoint-meta dt {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.version-change-hashes dd,
.version-checkpoint-meta dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
}

.version-inline-diff {
  margin-top: 10px;
}

.version-inline-diff summary {
  cursor: pointer;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.version-diff-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.version-diff-grid section {
  min-width: 0;
}

.version-diff-grid h4 {
  margin: 0 0 6px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.version-diff-grid pre {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  padding: 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 82%, white);
  color: var(--lw-text-secondary);
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-label-small-size);
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .version-diff-grid,
  .version-branch-summary {
    grid-template-columns: 1fr;
  }
}
</style>
