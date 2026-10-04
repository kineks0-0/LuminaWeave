<template>
  <div class="browser-root" @pointerdown="handleBrowserPointerDown">
    <header class="browser-header">
      <div>
        <span class="eyebrow">Forge Projects</span>
        <h2>项目中心</h2>
        <p>Forge 项目是长期制卡容器；右侧只显示选中项目内的协作线程。</p>
        <div v-if="recentWorkspace" class="recent-banner">
          <div class="recent-copy">
            <span class="recent-kicker">最近恢复</span>
            <strong>{{ recentWorkspace.title }}</strong>
            <span>更新于 {{ formatTime(recentWorkspace.updatedAt) }}</span>
          </div>
          <button class="recent-action" type="button" @click="handleOpenWorkspace(recentWorkspace.id)">
            继续此项目
          </button>
        </div>
      </div>
      <div class="header-actions">
        <button class="action-btn primary" type="button" @click="handleCreateWorkspace">新建 Forge 项目</button>
        <button class="action-btn" type="button" @click="$emit('close')">返回工作台</button>
      </div>
    </header>

    <section class="browser-column project-column" aria-label="Forge 项目">
      <div class="column-head">
        <strong>Forge 项目</strong>
        <span>{{ sessionIndexStore.forgeSessions.length }} 个</span>
      </div>
      <div class="project-tree">
        <div
          v-for="row in projectRows"
          :key="`${row.kind}:${row.id}`"
          class="project-group"
          :class="{ 'is-expanded': row.expanded }"
        >
          <div class="tree-row-wrap kind-project" :class="{ 'is-menu-open': activeMenuKey === rowKey(row) }">
            <button class="tree-row" :class="{ 'is-selected': row.selected, 'is-expanded': row.expanded }" type="button"
              @click="handleSelectRow(row)">
              <span class="tree-row-icon" aria-hidden="true">
                <FolderOpen v-if="row.kind === 'project' && row.expanded" :size="24" />
                <Folder v-else :size="24" />
              </span>
              <span class="tree-row-main">
                <span class="tree-row-title">{{ row.title }}</span>
                <span v-if="row.kind === 'thread'" class="tree-row-meta">{{ row.metaLabel }}</span>
              </span>
              <span class="tree-row-time">{{ row.timeLabel }}</span>
            </button>

            <div class="tree-row-tools">
              <button v-if="row.kind === 'project'" class="row-tool" type="button" title="展开项目"
                :aria-expanded="row.expanded" @pointerdown.stop @click.stop="handleSelectRow(row)">
                <ChevronDown :size="18" aria-hidden="true" />
              </button>
              <button v-if="row.kind === 'project'" class="row-tool" type="button" title="重命名项目" @pointerdown.stop
                @click.stop="handleRenameProject(row.projectId, row.title)">
                <Pencil :size="18" aria-hidden="true" />
              </button>
              <button class="row-tool" type="button" title="更多操作" :aria-expanded="activeMenuKey === rowKey(row)"
                @pointerdown.stop @click.stop="toggleMenu(row)">
                <MoreHorizontal :size="19" aria-hidden="true" />
              </button>
            </div>

            <transition name="project-menu">
              <div v-if="activeMenuKey === rowKey(row)" class="project-menu" role="menu" @pointerdown.stop>
                <button v-for="item in menuFor(row.kind)" :key="item.id" class="project-menu-item"
                  :class="{ danger: item.id === 'remove-project' || item.id === 'remove-thread' }" type="button"
                  role="menuitem" :disabled="item.disabled" :aria-disabled="item.disabled ? 'true' : 'false'"
                  :title="item.disabled ? item.disabledTitle : item.label" @click="handleMenuAction(row, item.id)">
                  <component :is="menuIcon(item.id)" :size="21" aria-hidden="true" />
                  <span>{{ item.label }}</span>
                </button>
              </div>
            </transition>
          </div>

          <div v-if="row.expanded && row.threads.length > 0" class="project-threads">
            <div
              v-for="thread in row.threads"
              :key="`${thread.kind}:${thread.id}`"
              class="tree-row-wrap kind-thread"
              :class="{ 'is-menu-open': activeMenuKey === rowKey(thread) }"
            >
              <button class="tree-row" :class="{ 'is-selected': thread.selected }" type="button"
                @click="handleSelectRow(thread)">
                <span class="tree-row-icon" aria-hidden="true">
                  <Folder :size="20" />
                </span>
                <span class="tree-row-main">
                  <span class="tree-row-title">{{ thread.title }}</span>
                  <span class="tree-row-meta">{{ thread.metaLabel }}</span>
                </span>
                <span class="tree-row-time">{{ thread.timeLabel }}</span>
              </button>

              <div class="tree-row-tools">
                <button class="row-tool" type="button" title="更多操作" :aria-expanded="activeMenuKey === rowKey(thread)"
                  @pointerdown.stop @click.stop="toggleMenu(thread)">
                  <MoreHorizontal :size="19" aria-hidden="true" />
                </button>
              </div>

              <transition name="project-menu">
                <div v-if="activeMenuKey === rowKey(thread)" class="project-menu" role="menu" @pointerdown.stop>
                  <button v-for="item in menuFor(thread.kind)" :key="item.id" class="project-menu-item"
                    :class="{ danger: item.id === 'remove-project' || item.id === 'remove-thread' }" type="button"
                    role="menuitem" :disabled="item.disabled" :aria-disabled="item.disabled ? 'true' : 'false'"
                    :title="item.disabled ? item.disabledTitle : item.label" @click="handleMenuAction(thread, item.id)">
                    <component :is="menuIcon(item.id)" :size="21" aria-hidden="true" />
                    <span>{{ item.label }}</span>
                  </button>
                </div>
              </transition>
            </div>
          </div>

        </div>

        <div v-if="projectRows.length === 0" class="empty-state">
          暂无 Forge 项目
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatShortDateTime } from '../../../api/utils/dateFormat.js';
import {
  Archive,
  ChevronDown,
  ExternalLink,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  X
} from 'lucide-vue-next';
import { useSessionIndexStore } from '../../../stores/useSessionIndexStore.js';
import { useCardMakerStore } from '../CardMakerStore.js';
import {
  buildForgeProjectCenterMenu,
  buildForgeProjectCenterRows,
  type ForgeProjectCenterMenuAction,
  type ForgeProjectCenterRow,
  type ForgeProjectCenterRowKind
} from './forgeProjectCenterPresentation.js';

const store = useCardMakerStore();
const sessionIndexStore = useSessionIndexStore();
const activeMenuKey = ref<string | null>(null);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const recentWorkspace = computed(() => {
  const selectedId = sessionIndexStore.selectedForgeSessionId;
  return sessionIndexStore.forgeSessions.find(session => session.id === selectedId) || sessionIndexStore.forgeSessions[0] || null;
});

const projectRows = computed<ForgeProjectCenterRow[]>(() => buildForgeProjectCenterRows({
  projects: sessionIndexStore.forgeProjects,
  getThreads: sessionIndexStore.getForgeProjectThreads,
  selectedProjectId: sessionIndexStore.selectedForgeProjectId,
  activeThreadId: store.workspaceSessionId
}));

const formatTime = formatShortDateTime;

const rowKey = (row: ForgeProjectCenterRow): string => `${row.kind}:${row.id}`;

const menuFor = (kind: ForgeProjectCenterRowKind) => buildForgeProjectCenterMenu(kind);

const menuIcon = (action: ForgeProjectCenterMenuAction) => {
  switch (action) {
    case 'create-thread':
      return Plus;
    case 'pin-project':
      return Pin;
    case 'open-resource-manager':
      return Folder;
    case 'create-permanent-worktree':
      return ExternalLink;
    case 'rename-project':
    case 'rename-thread':
      return Pencil;
    case 'archive-conversation':
      return Archive;
    case 'open-thread':
      return FolderOpen;
    case 'remove-project':
    case 'remove-thread':
      return X;
    default:
      return MoreHorizontal;
  }
};

const closeMenu = (): void => {
  activeMenuKey.value = null;
};

const toggleMenu = (row: ForgeProjectCenterRow): void => {
  const key = rowKey(row);
  activeMenuKey.value = activeMenuKey.value === key ? null : key;
};

const handleBrowserPointerDown = (): void => {
  closeMenu();
};

const handleCreateWorkspace = (): void => {
  closeMenu();
  store.createWorkspaceSession();
  void sessionIndexStore.refresh();
  emit('close');
};

const handleCreateThread = async (projectId: string): Promise<void> => {
  closeMenu();
  const created = await store.createWorkspaceThread(projectId);
  await sessionIndexStore.refresh();
  sessionIndexStore.selectForgeSession(created.id);
  emit('close');
};

const handleSelectRow = (row: ForgeProjectCenterRow): void => {
  closeMenu();
  if (row.kind === 'project') {
    sessionIndexStore.selectForgeSession(row.sessionId);
    return;
  }
  handleOpenWorkspace(row.sessionId);
};

const handleOpenWorkspace = (id: string): void => {
  store.openWorkspaceSession(id);
  sessionIndexStore.selectForgeSession(id);
  emit('close');
};

const handleRenameProject = async (projectId: string, currentTitle: string): Promise<void> => {
  closeMenu();
  const nextTitle = window.prompt('输入新的 Forge 项目标题', currentTitle)?.trim();
  if (!nextTitle || nextTitle === currentTitle) return;

  await sessionIndexStore.renameForgeProject(projectId, nextTitle);
};

const handleRenameThread = async (id: string, currentTitle: string): Promise<void> => {
  closeMenu();
  const nextTitle = window.prompt('输入新的协作线程标题', currentTitle)?.trim();
  if (!nextTitle || nextTitle === currentTitle) return;

  if (id === store.workspaceSessionId) {
    await store.renameWorkspaceSession(nextTitle);
    await sessionIndexStore.refresh();
    return;
  }

  await sessionIndexStore.renameForgeThread(id, nextTitle);
};

const handleDeleteThread = async (id: string, title: string): Promise<void> => {
  closeMenu();
  const confirmed = window.confirm(`删除协作线程“${title}”？项目资源会保留。`);
  if (!confirmed) return;

  await sessionIndexStore.deleteForgeThread(id);
  if (id === store.workspaceSessionId) {
    const nextThread = sessionIndexStore.selectedForgeSessionId;
    if (nextThread) {
      await store.openWorkspaceSession(nextThread);
    } else {
      store.resetSession();
    }
  }
};

const handleDeleteProject = async (projectId: string, title: string): Promise<void> => {
  closeMenu();
  const confirmed = window.confirm(`删除 Forge 项目“${title}”及其所有协作线程？此操作会清理项目资源。`);
  if (!confirmed) return;

  const currentProjectId = store.activeForgeProjectId;
  await sessionIndexStore.deleteForgeProject(projectId);
  if (currentProjectId === projectId) {
    const nextThread = sessionIndexStore.selectedForgeSessionId;
    if (nextThread) {
      await store.openWorkspaceSession(nextThread);
    } else {
      await store.createWorkspaceSession();
      await sessionIndexStore.refresh();
    }
  }
};

const handleMenuAction = (row: ForgeProjectCenterRow, action: ForgeProjectCenterMenuAction): void => {
  if (buildForgeProjectCenterMenu(row.kind).find(item => item.id === action)?.disabled) return;

  if (action === 'create-thread') {
    void handleCreateThread(row.projectId);
    return;
  }
  if (action === 'open-thread') {
    handleOpenWorkspace(row.sessionId);
    return;
  }
  if (action === 'rename-project') {
    void handleRenameProject(row.projectId, row.title);
    return;
  }
  if (action === 'rename-thread') {
    void handleRenameThread(row.sessionId, row.title);
    return;
  }
  if (action === 'remove-project') {
    void handleDeleteProject(row.projectId, row.title);
    return;
  }
  if (action === 'remove-thread') {
    void handleDeleteThread(row.sessionId, row.title);
    return;
  }
};

onMounted(async () => {
  await sessionIndexStore.refresh();
});
</script>

<style scoped>
.browser-root {
  --forge-project-bg: linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-surface) 98%, transparent), color-mix(in srgb, var(--lw-bg-app) 96%, transparent));
  --forge-project-group-bg: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  --forge-project-row-hover: color-mix(in srgb, var(--lw-bg-elevated) 78%, var(--lw-primary) 6%);
  --forge-project-row-active: color-mix(in srgb, var(--lw-bg-elevated) 84%, var(--lw-primary) 10%);
  --forge-project-menu-bg: color-mix(in srgb, var(--lw-bg-elevated) 98%, transparent);
  --forge-project-menu-border: color-mix(in srgb, var(--lw-border-base) 88%, transparent);
  --forge-project-line: color-mix(in srgb, var(--lw-border-base) 92%, transparent);
  --forge-browser-surface: color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent);
  --forge-browser-surface-strong: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  --forge-browser-line: color-mix(in srgb, var(--lw-border-base) 92%, transparent);
  --forge-browser-accent: var(--lw-primary);
  --forge-browser-accent-soft: rgba(var(--lw-primary-rgb), 0.1);

  position: relative;
  isolation: isolate;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: auto;
  background: var(--forge-project-bg);
  color: var(--lw-text-main);
}

.browser-header {
  /* display: flex;
  align-items: flex-start; */
  display: block;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
  padding: 6px 2px 0;
}

.eyebrow {
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--forge-browser-accent);
}

.browser-header h2 {
  margin: 8px 0 10px;
  font-family: var(--lw-font-display);
  font-size: var(--lw-type-headline-medium-size);
  line-height: 1.06;
  letter-spacing: 0;
}

.browser-header p {
  margin: 0;
  max-width: 720px;
  color: var(--lw-text-secondary);
  line-height: 1.6;
  font-size: var(--lw-type-body-medium-size);
}

.recent-banner {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 18px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--forge-browser-accent-soft) 100%, var(--lw-bg-elevated)), color-mix(in srgb, var(--forge-browser-accent-soft) 58%, transparent));
  border: 1px solid color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.22) 72%, var(--forge-browser-line));
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.05);
}

.recent-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.recent-kicker {
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--forge-browser-accent);
}

.recent-copy strong {
  font-size: var(--lw-type-title-small-size);
  color: var(--lw-text-main);
}

.recent-copy span:last-child {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.recent-action {
  border-radius: 999px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.24) 72%, var(--forge-browser-line));
  background: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.14) 100%, var(--lw-bg-elevated));
  color: var(--lw-text-main);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.action-btn {
  border-radius: 999px;
  padding: 10px 14px;
  border: 1px solid var(--forge-browser-line);
  background: color-mix(in srgb, var(--forge-browser-surface) 94%, transparent);
  color: var(--lw-text-main);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.action-btn.primary {
  background: var(--lw-black);
  color: var(--lw-text-inverse);
  border-color: var(--lw-black);
}

.row-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: color-mix(in srgb, var(--lw-text-secondary) 86%, var(--lw-text-main));
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}

.row-tool:hover,
.tree-row-wrap.is-menu-open .row-tool {
  background: color-mix(in srgb, var(--lw-text-main) 8%, transparent);
  color: var(--lw-text-main);
}

.project-tree {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  overflow: visible;
}

.browser-column {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--forge-browser-line);
  border-radius: 26px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--forge-browser-surface-strong) 95%, transparent), color-mix(in srgb, var(--forge-browser-surface) 88%, transparent));
  box-shadow:
    0 16px 40px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(18px);
}

.column-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 18px;
  border-bottom: 1px solid var(--forge-browser-line);
}

.column-head strong {
  font-size: var(--lw-type-title-small-size);
}

.column-head span {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.project-group {
  position: relative;
  min-width: 0;
  border-radius: 18px;
  padding: 2px;
}

.project-group.is-expanded {
  background: var(--forge-project-group-bg);
  border: 1px solid var(--forge-project-line);
}

.tree-row-wrap {
  position: relative;
  min-width: 0;
}

.tree-row {
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 13px;
  border: 0;
  border-radius: 14px;
  padding: 0 84px 0 14px;
  background: transparent;
  color: var(--lw-text-main);
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms ease;

  
}

.tree-row:hover {
  background: var(--forge-project-row-hover);
}

/* 对话 */
.tree-row.is-selected {
  /* background: var(--forge-project-row-active); */
}

/* 项目展开时的行背景 */
.project-group.is-expanded > .kind-project .tree-row {
  /* background: color-mix(in srgb, var(--forge-project-row-active) 72%, transparent); */
}

.kind-thread > .tree-row.is-selected {
  background: var(--forge-project-row-active);
}

.tree-row-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: color-mix(in srgb, var(--lw-text-secondary) 88%, var(--lw-primary));
}

.tree-row-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.tree-row-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--lw-type-title-small-size);
  line-height: 1.25;
  color: var(--lw-text-main);
}

.tree-row-meta {
  flex: 0 0 auto;
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.tree-row-time {
  flex: 0 0 auto;
  min-width: 36px;
  text-align: right;
  font-size: var(--lw-type-title-small-size);
  color: var(--lw-text-muted);
}

.tree-row-tools {
  position: absolute;
  right: 9px;
  top: 50%;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transform: translateY(-50%);
}

.row-tool {
  width: 28px;
  height: 28px;
}

.project-threads {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0 6px;
}

.kind-thread .tree-row {
  min-height: 42px;
  padding-left: 19px;
  padding-right: 50px;
  
}

.kind-thread .tree-row-title {
  font-size: var(--lw-type-body-medium-size);
}

.kind-thread .tree-row-icon {
  opacity: 0;
}

.kind-thread .tree-row-time {
  font-size: var(--lw-type-body-medium-size);
}

.kind-thread .tree-row-tools {
  right: 12px;
}

.project-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 2px);
  right: 46px;
  width: min(330px, calc(100vw - 48px));
  padding: 12px 0;
  border: 1px solid var(--forge-project-menu-border);
  border-radius: 22px;
  background: var(--forge-project-menu-bg);
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.12);
}

.project-menu-item {
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 15px;
  border: 0;
  padding: 0 24px;
  background: transparent;
  color: var(--lw-text-main);
  text-align: left;
  font-size: var(--lw-type-title-small-size);
  cursor: pointer;
}

.project-menu-item:hover:not(:disabled) {
  background: color-mix(in srgb, var(--lw-text-main) 7%, transparent);
}

.project-menu-item:disabled {
  color: color-mix(in srgb, var(--lw-text-muted) 58%, transparent);
  cursor: not-allowed;
}

.project-menu-item.danger:not(:disabled) {
  color: var(--lw-danger, #b42318);
}

.empty-state {
  margin: 16px 0 0;
  font-size: var(--lw-type-title-small-size);
  color: color-mix(in srgb, var(--lw-text-muted) 70%, transparent);
}

.empty-state {
  padding: 28px 12px;
}

.project-menu-enter-active,
.project-menu-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.project-menu-enter-from,
.project-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 680px) {
  .browser-root {
    padding: 18px 14px 24px;
  }

  .browser-header {
    flex-direction: column;
  }

  .recent-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .tree-row {
    padding-right: 78px;
  }

  .tree-row-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .tree-row-title {
    max-width: 100%;
  }

  .project-menu {
    right: 6px;
  }
}
</style>
