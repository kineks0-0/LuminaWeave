<template>
  <div class="browser-root">
    <div class="browser-header">
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
          <button class="recent-action" @click="handleOpenWorkspace(recentWorkspace.id)">继续此项目</button>
        </div>
      </div>
      <div class="header-actions">
        <button class="action-btn primary" @click="handleCreateWorkspace">新建 Forge 项目</button>
        <button class="action-btn" @click="$emit('close')">返回工作台</button>
      </div>
    </div>

    <div class="browser-grid">
      <section class="browser-column project-column">
        <div class="column-head">
          <strong>Forge 项目</strong>
          <span>{{ sessionIndexStore.forgeSessions.length }} 个</span>
        </div>
        <div class="card-list">
          <ForgeSessionCard
            v-for="session in projectSessions"
            :key="session.id"
            :title="session.title"
            :summary="projectSummary(session)"
            :updated-at="session.updatedAt"
            :count-label="`${threadCount(session)} threads`"
            :subtitle="`项目 ${shortId(projectIdOf(session))}`"
            badge="Project"
            :active="projectIdOf(session) === selectedProjectId"
            action-label="重命名"
            danger-action-label="删除项目"
            @select="handleSelectProject(session.id)"
            @action="handleRenameProject(projectIdOf(session), session.title)"
            @danger-action="handleDeleteProject(projectIdOf(session), session.title)"
          />
          <div v-if="projectSessions.length === 0" class="empty-state">还没有 Forge 项目</div>
        </div>
      </section>

      <section class="browser-column thread-column">
        <div class="column-head">
          <strong>协作线程</strong>
          <div class="column-actions">
            <span>{{ projectThreads.length }} 条</span>
            <button class="mini-action" :disabled="!selectedProjectId" @click="handleCreateThread">新建线程</button>
          </div>
        </div>
        <div class="card-list">
          <ForgeSessionCard
            v-for="thread in projectThreads"
            :key="thread.id"
            :title="threadTitle(thread)"
            :summary="threadSummary(thread)"
            :updated-at="thread.updatedAt"
            :count-label="`${thread.messageCount} nodes`"
            :subtitle="`conversation ${shortId(thread.conversationId || thread.sessionChatId || thread.id)}`"
            badge="Thread"
            :active="thread.id === store.workspaceSessionId"
            action-label="重命名"
            danger-action-label="删除线程"
            @select="handleOpenWorkspace(thread.id)"
            @action="handleRenameThread(thread.id, thread.title)"
            @danger-action="handleDeleteThread(thread.id, thread.title)"
          />
          <div v-if="projectThreads.length === 0" class="empty-state">选择左侧项目后显示它的协作线程</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useSessionIndexStore } from '../../../stores/useSessionIndexStore.js';
import { useCardMakerStore } from '../CardMakerStore.js';
import ForgeSessionCard from './ForgeSessionCard.vue';
import type { ForgeWorkspaceSessionRef } from '../../../types/SessionTypes.js';

const store = useCardMakerStore();
const sessionIndexStore = useSessionIndexStore();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const recentWorkspace = computed(() => {
    const selectedId = sessionIndexStore.selectedForgeSessionId;
    return sessionIndexStore.forgeSessions.find(session => session.id === selectedId) || sessionIndexStore.forgeSessions[0] || null;
});

const projectSessions = computed(() => sessionIndexStore.forgeProjects);
const selectedProjectId = computed(() => sessionIndexStore.selectedForgeProjectId);
const projectThreads = computed(() => sessionIndexStore.selectedForgeProjectThreads);

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
});

const projectSummary = (session: ForgeWorkspaceSessionRef) => {
    return `/workspaces/forge/${encodeURIComponent(projectIdOf(session))}`;
};

const projectIdOf = (session: ForgeWorkspaceSessionRef) => session.forgeProjectId || session.id;

const shortId = (id: string | null | undefined) => {
    if (!id) return 'new';
    return id.length <= 10 ? id : id.slice(-8);
};

const threadCount = (session: ForgeWorkspaceSessionRef) => {
    return sessionIndexStore.getForgeProjectThreads(projectIdOf(session)).length;
};

const threadTitle = (thread: ForgeWorkspaceSessionRef) => {
    return thread.id === store.workspaceSessionId ? `${thread.title}（当前）` : thread.title;
};

const threadSummary = (thread: ForgeWorkspaceSessionRef) => {
    const threadPath = `chat/${thread.conversationId || thread.sessionChatId || thread.id}`;
    const leaf = thread.activeLeafId ? `leaf ${shortId(thread.activeLeafId)}` : 'root leaf';
    return `${threadPath} · ${leaf}`;
};

const handleCreateWorkspace = () => {
    store.createWorkspaceSession();
    void sessionIndexStore.refresh();
    emit('close');
};

const handleCreateThread = async () => {
    const projectId = selectedProjectId.value;
    if (!projectId) return;
    const title = window.prompt('输入新协作线程标题', `协作线程 ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)?.trim();
    if (!title) return;

    const created = await store.createWorkspaceThread(projectId, title);
    sessionIndexStore.selectForgeSession(created.id);
    await sessionIndexStore.refresh();
    emit('close');
};

const handleOpenWorkspace = (id: string) => {
    store.openWorkspaceSession(id);
    sessionIndexStore.selectForgeSession(id);
    emit('close');
};

const handleSelectProject = (id: string) => {
    sessionIndexStore.selectForgeSession(id);
};

const handleRenameProject = async (projectId: string, currentTitle: string) => {
    const nextTitle = window.prompt('输入新的 Forge 项目标题', currentTitle)?.trim();
    if (!nextTitle || nextTitle === currentTitle) return;

    await sessionIndexStore.renameForgeProject(projectId, nextTitle);
};

const handleRenameThread = async (id: string, currentTitle: string) => {
    const nextTitle = window.prompt('输入新的协作线程标题', currentTitle)?.trim();
    if (!nextTitle || nextTitle === currentTitle) return;

    if (id === store.workspaceSessionId) {
        store.renameWorkspaceSession(nextTitle);
        await sessionIndexStore.refresh();
        return;
    }

    await sessionIndexStore.renameForgeThread(id, nextTitle);
};

const handleDeleteThread = async (id: string, title: string) => {
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

const handleDeleteProject = async (projectId: string, title: string) => {
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

onMounted(async () => {
    await sessionIndexStore.refresh();
});
</script>

<style scoped>
.browser-root {
  position: relative;
  isolation: isolate;
  --forge-browser-surface: color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent);
  --forge-browser-surface-strong: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  --forge-browser-line: color-mix(in srgb, var(--lw-border-base) 92%, transparent);
  --forge-browser-line-strong: color-mix(in srgb, var(--lw-border-strong) 82%, transparent);
  --forge-browser-accent: var(--lw-primary);
  --forge-browser-accent-soft: rgba(var(--lw-primary-rgb), 0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-surface) 98%, transparent), color-mix(in srgb, var(--lw-bg-app) 96%, transparent));
  color: var(--lw-text-main);
  padding: 20px;
  overflow: auto;
}

.browser-root::before,
.browser-root::after {
  display: none;
}

.browser-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
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
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--forge-browser-accent-soft) 100%, white), color-mix(in srgb, var(--forge-browser-accent-soft) 58%, transparent));
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

.browser-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.85fr);
  gap: 16px;
  min-height: 0;
}

.browser-column {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--forge-browser-line);
  border-radius: 26px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--forge-browser-surface-strong) 95%, transparent), color-mix(in srgb, var(--forge-browser-surface) 88%, transparent));
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

.column-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-action {
  border: 1px solid var(--forge-browser-line);
  background: color-mix(in srgb, var(--forge-browser-surface) 94%, transparent);
  color: var(--lw-text-main);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
}

.mini-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-list {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.empty-state {
  padding: 30px 12px;
  text-align: center;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
}

@media (max-width: 960px) {
  .browser-grid {
    grid-template-columns: 1fr;
  }

  .browser-header {
    flex-direction: column;
  }

  .recent-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
