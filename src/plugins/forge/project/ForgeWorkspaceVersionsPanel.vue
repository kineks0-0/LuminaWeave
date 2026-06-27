<template>
  <ForgeAuxPanelShell
    title="文件版本"
    kicker="Git Versions"
    :subtitle="`当前 Git 历史有 ${versionRows.length} 条提交，覆盖 ${totalChangedFiles} 个文件变更。`"
  >
    <template #actions>
      <button class="version-action-btn" type="button" :disabled="isLoading" @click="loadVersions">
        刷新
      </button>
    </template>

    <div v-if="loadError" class="version-error">{{ loadError }}</div>

    <div v-if="versionRows.length === 0 && !isLoading" class="version-empty">
      <strong>暂无 Git 版本记录</strong>
      <p>Forge 写入工具、bash 写入或项目 VFS 手动编辑产生文件变更后，会在这里显示 Git log 和 diff。</p>
    </div>

    <div v-else class="version-layout">
      <section class="version-list" aria-label="Git 提交列表">
        <article
          v-for="row in versionRows"
          :key="row.id"
          class="version-card"
          :class="{ active: selectedHash === row.hash }"
        >
          <button class="version-card__button" type="button" @click="selectRow(row)">
            <span class="version-card__hash">{{ row.shortHash }}</span>
            <strong>{{ row.title }}</strong>
            <time>{{ formatTime(row.createdAt) }}</time>
            <span>{{ row.changedFiles.length }} 个文件</span>
          </button>
        </article>
      </section>

      <section class="version-detail" aria-label="Git 差异">
        <div v-if="selectedRow" class="version-detail__header">
          <div>
            <span class="version-card__hash">{{ selectedRow.shortHash }}</span>
            <strong>{{ selectedRow.title }}</strong>
            <p>parent {{ selectedRow.parentHash ? compactId(selectedRow.parentHash) : 'none' }}</p>
          </div>
          <button class="version-action-btn" type="button" :disabled="isRestoring" @click="restoreSelected">
            恢复到此提交
          </button>
        </div>

        <div v-if="selectedRow" class="version-change-list">
          <div v-for="change in selectedRow.changedFiles" :key="`${selectedRow.id}:${change.path}`" class="version-change-row">
            <strong>{{ change.path }}</strong>
            <span>{{ gitChangeStatusLabel(change.status) }}</span>
          </div>
        </div>

        <pre v-if="selectedDiff" class="version-diff">{{ selectedDiff }}</pre>
        <div v-else-if="selectedRow && isDiffLoading" class="version-empty">正在加载 diff...</div>
        <div v-else-if="selectedRow" class="version-empty">该提交暂无可显示 diff。</div>
      </section>
    </div>
  </ForgeAuxPanelShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { luminaWeaveApi } from '../../../api/index.js';
import { shellWorkspaceService } from '../../../api/core/hal/shell/ShellWorkspaceService.js';
import { forgeWorkspaceGitService } from '../../../api/core/forge/project/ForgeWorkspaceGitService.js';
import { useCardMakerStore } from '../CardMakerStore.js';
import ForgeAuxPanelShell from '../app/ForgeAuxPanelShell.vue';
import {
  buildWorkspaceVersionRowsFromGitLog,
  compactId,
  countGitVersionChanges,
  gitChangeStatusLabel,
  type WorkspaceVersionRow
} from './forgeWorkspaceVersionPresentation.js';

const cardMakerStore = useCardMakerStore();
const versionRows = ref<WorkspaceVersionRow[]>([]);
const selectedHash = ref<string | null>(null);
const selectedDiff = ref('');
const isLoading = ref(false);
const isDiffLoading = ref(false);
const isRestoring = ref(false);
const loadError = ref('');

const projectId = computed(() => cardMakerStore.activeForgeProjectId);
const conversationId = computed(() => cardMakerStore.sessionChatId);
const totalChangedFiles = computed(() => countGitVersionChanges(versionRows.value));
const selectedRow = computed(() => versionRows.value.find(row => row.hash === selectedHash.value) ?? null);

const repoRoot = (id: string): string => `/forge/${encodeURIComponent(id)}`;

const getProjectFileSystem = async () => shellWorkspaceService.getFileSystem({
  projectId: projectId.value,
  conversationId: conversationId.value
});

const loadVersions = async (): Promise<void> => {
  isLoading.value = true;
  loadError.value = '';
  try {
    const fs = await getProjectFileSystem();
    const log = await forgeWorkspaceGitService.log({
      fs,
      repoRoot: repoRoot(projectId.value),
      limit: 50
    });
    versionRows.value = buildWorkspaceVersionRowsFromGitLog(log);
    selectedHash.value = versionRows.value[0]?.hash ?? null;
    await loadSelectedDiff();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
    versionRows.value = [];
    selectedHash.value = null;
    selectedDiff.value = '';
  } finally {
    isLoading.value = false;
  }
};

const loadSelectedDiff = async (): Promise<void> => {
  const row = selectedRow.value;
  if (!row) {
    selectedDiff.value = '';
    return;
  }
  isDiffLoading.value = true;
  try {
    const fs = await getProjectFileSystem();
    const diff = await forgeWorkspaceGitService.diff({
      fs,
      repoRoot: repoRoot(projectId.value),
      baseHash: row.parentHash,
      headHash: row.hash
    });
    selectedDiff.value = diff.text.trim();
  } catch (error) {
    selectedDiff.value = error instanceof Error ? error.message : String(error);
  } finally {
    isDiffLoading.value = false;
  }
};

const selectRow = async (row: WorkspaceVersionRow): Promise<void> => {
  selectedHash.value = row.hash;
  await loadSelectedDiff();
};

const restoreSelected = async (): Promise<void> => {
  const row = selectedRow.value;
  if (!row) return;
  const confirmed = await luminaWeaveApi.confirm({
    title: '恢复文件版本',
    message: `将把 Forge 项目 VFS 恢复到 Git 提交 ${row.shortHash}，并提交一条新的恢复记录。此操作不会发布或覆盖真实 ST 世界书。`,
    confirmText: '恢复',
    cancelText: '取消'
  });
  if (!confirmed) return;

  isRestoring.value = true;
  loadError.value = '';
  try {
    const fs = await getProjectFileSystem();
    await forgeWorkspaceGitService.restore({
      fs,
      repoRoot: repoRoot(projectId.value),
      ref: row.hash
    });
    await forgeWorkspaceGitService.commitAll({
      fs,
      repoRoot: repoRoot(projectId.value),
      message: `Restore Forge workspace to ${row.shortHash}`
    });
    await shellWorkspaceService.persist();
    await loadVersions();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isRestoring.value = false;
  }
};

const formatTime = (value: number): string => new Date(value).toLocaleString([], {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

onMounted(() => {
  void loadVersions();
});

watch(projectId, () => {
  void loadVersions();
});
</script>

<style scoped>
.version-action-btn {
  min-height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 78%, transparent);
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, white);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
}

.version-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.version-error,
.version-empty,
.version-card,
.version-detail {
  border-radius: 8px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.version-error,
.version-empty {
  padding: 14px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
}

.version-error {
  margin-bottom: 12px;
  border-color: color-mix(in srgb, var(--lw-danger, #d64f4f) 48%, var(--lw-border-base));
  color: var(--lw-danger, #d64f4f);
}

.version-empty strong {
  display: block;
  margin-bottom: 6px;
  color: var(--lw-text-main);
}

.version-empty p {
  margin: 0;
  line-height: 1.6;
}

.version-layout {
  display: grid;
  grid-template-columns: minmax(180px, 0.85fr) minmax(0, 1.25fr);
  gap: 12px;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.version-card.active {
  border-color: rgba(var(--lw-primary-rgb), 0.32);
  background: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.08) 72%, var(--lw-bg-elevated));
}

.version-card__button {
  width: 100%;
  padding: 12px;
  border: none;
  background: transparent;
  color: var(--lw-text-secondary);
  text-align: left;
  display: grid;
  gap: 5px;
  cursor: pointer;
}

.version-card__button strong,
.version-detail__header strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
}

.version-card__button time,
.version-card__button span,
.version-detail__header p,
.version-card__hash {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.version-card__hash {
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
}

.version-detail {
  min-width: 0;
  padding: 14px;
}

.version-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.version-detail__header p {
  margin: 4px 0 0;
}

.version-change-list {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.version-change-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 0;
  border-top: 1px solid color-mix(in srgb, var(--lw-border-base) 72%, transparent);
}

.version-change-row strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
}

.version-change-row span {
  flex: 0 0 auto;
  color: rgb(var(--lw-primary-rgb));
  font-size: var(--lw-type-label-small-size);
}

.version-diff {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 82%, white);
  color: var(--lw-text-secondary);
  font-family: var(--lw-font-mono), ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-label-small-size);
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .version-layout {
    grid-template-columns: 1fr;
  }

  .version-detail__header {
    flex-direction: column;
  }
}
</style>
