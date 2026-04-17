<template>
  <aside class="forge-sidebar" :class="{ 'is-collapsed': isCollapsed }">
    <div v-if="!isCollapsed" class="forge-sidebar__content">
      <div class="forge-sidebar__section">
        <div class="forge-sidebar__section-head">
          <span class="forge-sidebar__section-label">会话</span>
          <button class="forge-sidebar__icon-btn" type="button" title="新建会话" @click="handleCreateWorkspace">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        <div class="forge-sidebar__session-list">
          <button
            v-for="session in forgeSessions"
            :key="session.id"
            class="forge-sidebar__session-item"
            :class="{ 'is-active': session.id === store.workspaceSessionId }"
            type="button"
            @click="handleOpenWorkspace(session.id)"
          >
            <span class="forge-sidebar__session-name">{{ session.title }}</span>
            <span class="forge-sidebar__session-meta">{{ session.messageCount }}n</span>
          </button>
          <div v-if="forgeSessions.length === 0" class="forge-sidebar__empty">暂无工作会话</div>
        </div>
      </div>

      <div class="forge-sidebar__divider"></div>

      <div class="forge-sidebar__section">
        <div class="forge-sidebar__section-head">
          <span class="forge-sidebar__section-label">辅助面板</span>
          <div class="forge-sidebar__mode-btns">
            <button
              class="forge-sidebar__icon-btn"
              type="button"
              title="切换到右侧内嵌"
              @click="$emit('switchMode', 'right')"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <rect x="3" y="3" width="11" height="18" rx="1"></rect>
                <rect x="16" y="3" width="5" height="18" rx="1"></rect>
              </svg>
            </button>
            <button
              class="forge-sidebar__icon-btn"
              type="button"
              title="拆出为小窗"
              @click="$emit('switchMode', 'widget')"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <rect x="3" y="3" width="7" height="18" rx="1"></rect>
                <rect x="14" y="3" width="7" height="10" rx="1"></rect>
              </svg>
            </button>
          </div>
        </div>
        <div class="forge-sidebar__aux-tabs">
          <button
            v-for="item in auxPanelButtons"
            :key="item.kind"
            class="forge-sidebar__aux-tab"
            :class="{ 'is-active': store.activeAuxPanel === item.kind }"
            type="button"
            @click="store.setActiveAuxPanel(item.kind)"
          >
            <span class="forge-sidebar__aux-icon" aria-hidden="true">{{ item.icon }}</span>
            <span class="forge-sidebar__aux-label">{{ item.shortLabel }}</span>
          </button>
        </div>
        <div class="forge-sidebar__aux-body">
          <ForgeAuxPanelView :kind="store.activeAuxPanel" />
        </div>
      </div>
    </div>

    <button
      class="forge-sidebar__toggle"
      type="button"
      :title="isCollapsed ? '展开侧栏' : '收起侧栏'"
      @click="$emit('toggleCollapse')"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
        <polyline :points="isCollapsed ? '9 6 15 12 9 18' : '15 6 9 12 15 18'"></polyline>
      </svg>
    </button>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useCardMakerStore } from '../plugins/forge/CardMakerStore';
import { useSessionIndexStore } from '../stores/useSessionIndexStore';
import ForgeAuxPanelView from '../plugins/forge/ForgeAuxPanelView.vue';
import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from '../plugins/forge/forgeAuxPanels';
import type { ForgeAuxPanelKind } from '../types/ForgeWorkflowTypes';

defineProps<{
  isCollapsed?: boolean;
}>();

defineEmits<{
  (e: 'toggleCollapse'): void;
  (e: 'switchMode', mode: 'left' | 'right' | 'widget'): void;
}>();

const store = useCardMakerStore();
const sessionIndexStore = useSessionIndexStore();

const forgeSessions = computed(() => sessionIndexStore.forgeSessions);

const auxPanelButtons = FORGE_AUX_PANEL_ORDER.map((kind: ForgeAuxPanelKind) => ({
    kind,
    ...FORGE_AUX_PANEL_META[kind]
}));

const handleCreateWorkspace = () => {
    store.createWorkspaceSession();
    void sessionIndexStore.refresh();
};

const handleOpenWorkspace = (id: string) => {
    store.openWorkspaceSession(id);
    sessionIndexStore.selectForgeSession(id);
};

onMounted(async () => {
    await sessionIndexStore.refresh();
});
</script>

<style scoped>
.forge-sidebar {
  display: flex;
  flex-direction: row;
  height: 100%;
  min-height: 0;
  border-right: 1px solid var(--lw-border-base);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 98%, transparent), color-mix(in srgb, var(--lw-bg-surface) 96%, transparent));
  transition: width 220ms cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
  flex-shrink: 0;
  width: 300px;
}

.forge-sidebar.is-collapsed {
  width: 40px;
}

.forge-sidebar__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.forge-sidebar__section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.forge-sidebar__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  flex-shrink: 0;
}

.forge-sidebar__section-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.forge-sidebar__icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--lw-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--lw-transition);
}

.forge-sidebar__icon-btn:hover {
  background: var(--lw-bg-hover);
  border-color: var(--lw-border-base);
  color: var(--lw-text-main);
}

.forge-sidebar__mode-btns {
  display: flex;
  gap: 4px;
}

.forge-sidebar__session-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
  max-height: 200px;
  overflow-y: auto;
  flex-shrink: 0;
}

.forge-sidebar__session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--lw-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: var(--lw-transition);
}

.forge-sidebar__session-item:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.forge-sidebar__session-item.is-active {
  background: var(--lw-bg-selection);
  border-color: rgba(var(--lw-primary-rgb), 0.18);
  color: var(--lw-text-main);
}

.forge-sidebar__session-name {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.forge-sidebar__session-meta {
  font-size: 10px;
  color: var(--lw-text-muted);
  flex-shrink: 0;
}

.forge-sidebar__empty {
  padding: 12px 10px;
  font-size: 11px;
  color: var(--lw-text-muted);
  text-align: center;
}

.forge-sidebar__divider {
  height: 1px;
  margin: 8px 14px;
  background: var(--lw-border-base);
  flex-shrink: 0;
}

.forge-sidebar__aux-tabs {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.forge-sidebar__aux-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  color: var(--lw-text-secondary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--lw-transition);
}

.forge-sidebar__aux-tab:hover {
  border-color: var(--lw-border-hover);
  color: var(--lw-text-main);
}

.forge-sidebar__aux-tab.is-active {
  border-color: rgba(var(--lw-primary-rgb), 0.28);
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-text-main);
}

.forge-sidebar__aux-icon {
  font-size: 12px;
}

.forge-sidebar__aux-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 8px 8px;
}

.forge-sidebar__toggle {
  width: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-left: 1px solid var(--lw-border-base);
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
  transition: var(--lw-transition);
}

.forge-sidebar__toggle:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}
</style>
