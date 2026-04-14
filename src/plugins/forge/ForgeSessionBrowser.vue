<template>
  <div class="browser-root">
    <div class="browser-header">
      <div>
        <span class="eyebrow">Forge Sessions</span>
        <h2>切换会话</h2>
        <p>默认工作台不变；在这里选择历史聊天会话作为参考源，或切换 Forge 工作会话。</p>
        <div v-if="recentWorkspace" class="recent-banner">
          <div class="recent-copy">
            <span class="recent-kicker">最近恢复</span>
            <strong>{{ recentWorkspace.title }}</strong>
            <span>更新于 {{ formatTime(recentWorkspace.updatedAt) }}</span>
          </div>
          <button class="recent-action" @click="handleOpenWorkspace(recentWorkspace.id)">继续此会话</button>
        </div>
      </div>
      <div class="header-actions">
        <button class="action-btn primary" @click="handleCreateWorkspace">新建 Forge 会话</button>
        <button class="action-btn" @click="$emit('close')">返回工作台</button>
      </div>
    </div>

    <div class="browser-grid">
      <section class="browser-column">
        <div class="column-head">
          <strong>Forge 工作会话</strong>
          <span>{{ sessionIndexStore.forgeSessions.length }} 个</span>
        </div>
        <div class="card-list">
          <ForgeSessionCard
            v-for="session in sessionIndexStore.forgeSessions"
            :key="session.id"
            :title="session.title"
            :summary="session.selectedChatSessionId ? `参考聊天：${session.selectedChatSessionId}` : '尚未绑定历史聊天参考'"
            :updated-at="session.updatedAt"
            :count-label="`${session.messageCount} nodes`"
            :subtitle="`创建于 ${formatTime(session.createdAt)}`"
            badge="Workspace"
            :active="session.id === store.workspaceSessionId"
            action-label="重命名"
            @select="handleOpenWorkspace(session.id)"
            @action="handleRenameWorkspace(session.id, session.title)"
          />
          <div v-if="sessionIndexStore.forgeSessions.length === 0" class="empty-state">还没有 Forge 工作会话</div>
        </div>
      </section>

      <section class="browser-column">
        <div class="column-head">
          <strong>历史聊天会话</strong>
          <span>{{ sessionIndexStore.chatSessions.length }} 个</span>
        </div>
        <div class="card-list">
          <ForgeSessionCard
            v-for="chat in sessionIndexStore.chatSessions"
            :key="chat.id"
            :title="chat.title"
            :summary="chat.summary"
            :updated-at="chat.updatedAt"
            :count-label="`${chat.messageCount} messages`"
            :subtitle="`leaf ${chat.activeLeafId ? chat.activeLeafId.slice(-6) : 'root'}`"
            badge="History"
            :active="chat.id === store.selectedChatSessionId"
            @select="handleSelectChat(chat.id)"
          />
          <div v-if="sessionIndexStore.chatSessions.length === 0" class="empty-state">暂无可读取的历史聊天会话</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useSessionIndexStore } from '../../stores/useSessionIndexStore';
import { useCardMakerStore } from './CardMakerStore';
import ForgeSessionCard from './ForgeSessionCard.vue';
import { forgeSessionRepository } from '../../api/core/ForgeSessionRepository';

const store = useCardMakerStore();
const sessionIndexStore = useSessionIndexStore();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const recentWorkspace = computed(() => {
    const selectedId = sessionIndexStore.selectedForgeSessionId;
    return sessionIndexStore.forgeSessions.find(session => session.id === selectedId) || sessionIndexStore.forgeSessions[0] || null;
});

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
});

const handleCreateWorkspace = () => {
    store.createWorkspaceSession();
    void sessionIndexStore.refresh();
    emit('close');
};

const handleOpenWorkspace = (id: string) => {
    store.openWorkspaceSession(id);
    sessionIndexStore.selectForgeSession(id);
    emit('close');
};

const handleRenameWorkspace = (id: string, currentTitle: string) => {
    const nextTitle = window.prompt('输入新的 Forge 工作会话标题', currentTitle)?.trim();
    if (!nextTitle || nextTitle === currentTitle) return;

    if (id === store.workspaceSessionId) {
        store.renameWorkspaceSession(nextTitle);
    } else {
        forgeSessionRepository.renameSession(id, nextTitle);
    }

    void sessionIndexStore.refresh();
};

const handleSelectChat = (id: string) => {
    store.attachChatSessionReference(id);
    void sessionIndexStore.refresh();
    emit('close');
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
  content: '';
  position: absolute;
  pointer-events: none;
  z-index: -1;
}

.browser-root::before {
  top: -12%;
  right: -4%;
  width: 34vw;
  height: 34vw;
  min-width: 300px;
  min-height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--lw-primary-rgb), 0.16), rgba(var(--lw-primary-rgb), 0.05) 42%, transparent 70%);
  filter: blur(24px);
}

.browser-root::after {
  top: 0;
  left: 0;
  right: 0;
  height: 220px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent),
    radial-gradient(circle at 16% 0%, rgba(var(--lw-primary-rgb), 0.08), transparent 34%);
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
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--forge-browser-accent);
}

.browser-header h2 {
  margin: 8px 0 10px;
  font-family: var(--lw-font-display);
  font-size: 26px;
  line-height: 1.06;
  letter-spacing: -0.03em;
}

.browser-header p {
  margin: 0;
  max-width: 720px;
  color: var(--lw-text-secondary);
  line-height: 1.6;
  font-size: 13px;
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
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--forge-browser-accent);
}

.recent-copy strong {
  font-size: 14px;
  color: var(--lw-text-main);
}

.recent-copy span:last-child {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.recent-action {
  border-radius: 999px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.24) 72%, var(--forge-browser-line));
  background: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.14) 100%, var(--lw-bg-elevated));
  color: var(--lw-text-main);
  font-weight: 700;
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
  font-weight: 700;
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
  grid-template-columns: 1.1fr 1fr;
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
  font-size: 14px;
}

.column-head span {
  font-size: 11px;
  color: var(--lw-text-muted);
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
  font-size: 12px;
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
