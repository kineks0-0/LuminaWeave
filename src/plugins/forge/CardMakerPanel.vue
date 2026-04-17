<template>
  <div class="card-maker-root">
    <ForgeSessionBrowser v-if="store.workspacePage === 'session-browser'" @close="store.setWorkspacePage('workspace')" />

    <div v-else class="workspace-shell" :class="{ 'is-detached-workspace': isDetachedWorkspace, 'is-mobile-layout': isMobileLayout }">
      <header v-if="showWorkspaceHero" class="workspace-hero">
        <div v-if="!props.embeddedInWorkspaceWindow" class="hero-copy">
          <span class="hero-kicker">Forge Workspace</span>
          <h1 class="hero-title">{{ heroTitle }}</h1>
          <p class="hero-subtitle">{{ heroSubtitle }}</p>
        </div>

        <ForgeWindowActions v-if="!props.embeddedInWorkspaceWindow" class="hero-actions" presentation="hero" />
      </header>

      <div class="main-layout" :class="{ 'has-embedded-sidebar': showEmbeddedSidebar, 'is-detached-workspace': isDetachedWorkspace }">
        <section class="chat-section" :class="{ 'is-detached-workspace': isDetachedWorkspace }">
          <div v-if="showWorkspaceTopbar" class="window-handle" aria-hidden="true"></div>

          <div v-if="isMobileLayout" class="mobile-aux-strip">
            <button
              v-for="item in auxPanelButtons"
              :key="item.kind"
              class="mobile-aux-btn"
              type="button"
              @click="handleAuxPanelClick(item.kind)"
            >
              <span aria-hidden="true">{{ item.icon }}</span>
              <span>{{ item.shortLabel }}</span>
            </button>
          </div>

          <div v-if="showWorkspaceTopbar" class="topbar" :class="{ 'is-collapsed': isTopbarCollapsed }">
            <div v-if="!isTopbarCollapsed" class="topbar-content">
              <div class="title-group compact">
                <span class="icon">⚒</span>
                <div class="text">
                  <div class="display-name">当前工作流</div>
                  <div class="session-id">执行控制与会话操作</div>
                </div>
              </div>

              <ForgeSessionToolbar
                :title="store.workspaceTitle"
                :subtitle="workspaceSubtitle"
                :updated-at="store.workspaceUpdatedAt"
                :has-reference="Boolean(store.selectedChatSessionId)"
                :workflow-phase="store.workflowSnapshot?.visiblePhase || null"
                :workflow-staging-count="store.workflowSnapshot?.stagingCount || 0"
                :workflow-commit-ready-count="store.workflowSnapshot?.commitReadyCount || 0"
                compact
                @open-browser="store.setWorkspacePage('session-browser')"
                @new-session="handleCreateWorkspace"
                @clear-reference="handleClearChatReference"
              />

              <div v-if="showAuxStripInBody || showAuxStripForHiddenMode || showAuxStripForWidgetMode" class="aux-panel-strip" :class="{ 'is-window-launcher': props.embeddedInWorkspaceWindow, 'is-hidden-mode': showAuxStripForHiddenMode, 'is-widget-mode': showAuxStripForWidgetMode }">
                <span class="aux-panel-strip-label">{{ showAuxStripForHiddenMode ? '辅助面板（小窗）' : (showAuxStripForWidgetMode ? '辅助面板（右侧）' : (props.embeddedInWorkspaceWindow && store.auxPresentationMode === 'detached' ? '辅助窗口' : '辅助面板')) }}</span>
                <div class="aux-panel-strip-actions">
                  <button
                    v-for="item in auxPanelButtons"
                    :key="item.kind"
                    class="aux-panel-btn"
                    :class="{ 'is-active': isForgeAuxPanelVisibleInWidget(item.kind) }"
                    type="button"
                    @click="handleAuxPanelClick(item.kind)"
                  >
                    <span class="aux-panel-btn-icon" aria-hidden="true">{{ item.icon }}</span>
                    <span>{{ item.shortLabel }}</span>
                  </button>
                  <template v-if="isTraditionalWithRightSidebar">
                    <button class="aux-panel-mode-btn" type="button" title="切换到左侧" @click="handleSwitchAuxMode('left')">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <rect x="3" y="3" width="5" height="18" rx="1"></rect>
                        <rect x="10" y="3" width="11" height="18" rx="1"></rect>
                      </svg>
                    </button>
                    <button class="aux-panel-mode-btn" type="button" title="拆出小窗" @click="handleSwitchAuxMode('widget')">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <rect x="3" y="3" width="7" height="18" rx="1"></rect>
                        <rect x="14" y="3" width="7" height="10" rx="1"></rect>
                      </svg>
                    </button>
                  </template>
                  <template v-if="isTraditionalWithWidgetSidebar">
                    <button class="aux-panel-mode-btn" type="button" title="切换到左侧" @click="handleSwitchAuxMode('left')">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <rect x="3" y="3" width="5" height="18" rx="1"></rect>
                        <rect x="10" y="3" width="11" height="18" rx="1"></rect>
                      </svg>
                    </button>
                    <button class="aux-panel-mode-btn" type="button" title="切换到右侧内嵌" @click="handleSwitchAuxMode('right')">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <rect x="3" y="3" width="11" height="18" rx="1"></rect>
                        <rect x="16" y="3" width="5" height="18" rx="1"></rect>
                      </svg>
                    </button>
                  </template>
                </div>
              </div>
            </div>
            <div v-else class="topbar-collapsed-copy">
              <span class="collapsed-pill">工作流顶部已收起</span>
              <span class="collapsed-text">{{ workflowBadge }}</span>
            </div>

            <button class="section-toggle topbar-toggle" type="button" @click="isTopbarCollapsed = !isTopbarCollapsed">
              <span>{{ isTopbarCollapsed ? '展开顶部' : '收起顶部' }}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <polyline :points="isTopbarCollapsed ? '6 15 12 9 18 15' : '6 9 12 15 18 9'"></polyline>
              </svg>
            </button>
          </div>

          <div class="content-shell">
            <div class="message-scroller scroll-container" ref="msgScroller">
              <div v-if="!store.entryMode" class="entry-mode-stage">
                <div class="entry-mode-card">
                  <span class="entry-mode-kicker">A.U.T.O Flow</span>
                  <h2>选择 Forge 协作节奏</h2>
                  <p>详细定制会更多追问方向，并提供可主动填写的细化表单；快速开始只保留当前推进所需的最小表单。</p>
                  <div class="entry-mode-actions">
                    <button class="entry-primary" @click="store.chooseDetailMode('detailed')">详细定制</button>
                    <button class="entry-secondary" @click="store.chooseDetailMode('quick')">快速开始</button>
                  </div>
                </div>
              </div>

              <div class="conversation-shell">
                <template v-for="item in groupedFeed" :key="item.id">
                  <div v-if="item.kind === 'message'" class="forge-msg" :class="`role-${item.message.role}`">
                    <div class="msg-avatar" :class="item.message.role">
                      <span v-if="item.message.role === 'user'">U</span>
                      <span v-else>F</span>
                    </div>
                    <div class="msg-column">
                      <div class="msg-meta">
                        <span class="msg-author">{{ item.message.name }}</span>
                        <span class="msg-tag">{{ item.message.role === 'user' ? 'prompt' : 'assistant' }}</span>
                        <span class="msg-node-id">#{{ item.message.id.slice(-6) }}</span>
                      </div>
                      <div class="msg-bubble">
                        <ForgeMessageRenderer
                          :mes="item.message.mes || undefined"
                          :mes-raw="item.message.mesRaw || item.message.mes || ''"
                          :plugin-raw="item.message.pluginRaw || null"
                          :thinking-text="item.message.thinkingText || null"
                          :render-markdown="renderMarkdown"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- 操作分组：全部完成时折叠为摘要行 -->
                  <div v-else-if="item.kind === 'op-group'" class="op-group-wrap">
                    <template v-if="!item.allDone || expandedGroups.has(item.id)">
                      <ForgeInlineTrace v-for="op in item.operations" :key="op.id" :operation="op" />
                      <button v-if="item.allDone" class="op-group-collapse-btn" @click="expandedGroups.delete(item.id)">
                        收起
                      </button>
                    </template>
                    <button v-else class="op-group-summary" @click="expandedGroups.add(item.id)">
                      <span class="op-group-dot-row">
                        <span class="op-dot"></span><span class="op-dot"></span><span class="op-dot"></span>
                      </span>
                      <span class="op-group-label">运行了 {{ item.operations.length }} 步</span>
                      <span class="op-group-expand">展开</span>
                    </button>
                  </div>
                </template>

                <div v-if="(store.isGenerating || forgeStore.isProcessing) && !store.streamText && !store.streamThinkingText" class="streaming-placeholder">
                  <div class="pulse-dot"></div>
                  <span>{{ store.isGenerating ? 'Forge is working through the next reply…' : 'Forge 正在分析上下文并制定计划...' }}</span>
                </div>
              </div>
            </div>

            <div class="composer-section" :class="{ 'is-collapsed': isComposerCollapsed }">
              <template v-if="isComposerCollapsed">
                <div class="composer-collapsed-bar">
                  <div class="composer-inline-meta">
                    <span class="composer-inline-pill">FORGE</span>
                    <span class="composer-inline-text">输入框已收起，展开后继续和 Forge 协作。</span>
                  </div>
                  <button class="section-toggle composer-toggle" type="button" @click="toggleComposerCollapsed">
                    <span>展开输入框</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                      <polyline points="6 15 12 9 18 15"></polyline>
                    </svg>
                  </button>
                </div>
              </template>

              <template v-else>
                <div v-if="store.lastError" class="error-banner">{{ store.lastError }}</div>

                <div class="composer-shell" ref="composerMenuRef">
                  <ForgePromptPreview :open="isPromptPreviewOpen" @close="closePromptPreview" />

                  <div class="input-container codex-composer">
                    <textarea
                      ref="composerTextarea"
                      class="composer-textarea"
                      v-model="store.input"
                      :disabled="store.isGenerating"
                      placeholder="Ask Forge anything about this workspace"
                      @keydown.enter.prevent="handleEnter"
                    />

                    <div class="composer-toolbar">
                      <div class="composer-toolbar-left">
                        <div class="composer-menu-wrap">
                          <button
                            class="composer-plus-btn"
                            type="button"
                            :class="{ active: isComposerMenuOpen }"
                            @click="toggleComposerMenu"
                            title="更多操作"
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                          </button>

                          <transition name="composer-menu">
                            <div v-if="isComposerMenuOpen" class="composer-menu-panel">
                              <template v-if="!isDetailModeMenuOpen">
                                <button class="composer-menu-item" type="button" @click="handleAttachSeedFile">
                                  <span class="composer-menu-icon">
                                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                                      <path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.5 8.49a1.5 1.5 0 0 1-2.12-2.12l7.43-7.43"></path>
                                    </svg>
                                  </span>
                                  <span class="composer-menu-label">添加素材文件</span>
                                </button>

                                <button
                                  class="composer-menu-item"
                                  type="button"
                                  :disabled="!store.selectedPresetId"
                                  @click="togglePromptPreviewFromMenu"
                                >
                                  <span class="composer-menu-icon">
                                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                      <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                  </span>
                                  <span class="composer-menu-label">Prompt 预览</span>
                                  <span class="composer-menu-status" v-if="isPromptPreviewOpen">已打开</span>
                                </button>

                                <div class="composer-menu-group">
                                  <button
                                    class="composer-menu-item has-submenu"
                                    type="button"
                                    :disabled="store.isGenerating"
                                    @click="toggleDetailModeMenu"
                                  >
                                    <span class="composer-menu-icon">
                                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                                        <path d="M4 7h8"></path>
                                        <path d="M4 12h12"></path>
                                        <path d="M4 17h6"></path>
                                        <circle cx="18" cy="7" r="2"></circle>
                                        <circle cx="18" cy="17" r="2"></circle>
                                      </svg>
                                    </span>
                                    <span class="composer-menu-label">协作节奏</span>
                                    <span class="composer-menu-value">{{ detailModeLabel }}</span>
                                    <svg class="composer-menu-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                      <polyline points="9 6 15 12 9 18"></polyline>
                                    </svg>
                                  </button>
                                </div>
                              </template>

                              <div v-else class="composer-menu-submenu is-panel">
                                <button class="composer-menu-back" type="button" @click="toggleDetailModeMenu">
                                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <polyline points="15 6 9 12 15 18"></polyline>
                                  </svg>
                                  <span>返回</span>
                                </button>
                                <button
                                  class="composer-submenu-item"
                                  type="button"
                                  :class="{ active: store.detailMode === 'detailed' }"
                                  @click="handleChooseDetailMode('detailed')"
                                >
                                  <span>详细定制</span>
                                  <small>更多追问与细化表单</small>
                                </button>
                                <button
                                  class="composer-submenu-item"
                                  type="button"
                                  :class="{ active: store.detailMode === 'quick' }"
                                  @click="handleChooseDetailMode('quick')"
                                >
                                  <span>快速开始</span>
                                  <small>仅保留当前最小推进信息</small>
                                </button>
                              </div>
                            </div>
                          </transition>
                        </div>

                        <label class="composer-select-field">
                          <span class="composer-select-prefix">模型</span>
                          <select v-model="store.selectedPresetId" class="composer-select">
                            <option v-for="preset in store.presets" :key="preset.id" :value="preset.id">
                              {{ preset.name }}
                            </option>
                          </select>
                        </label>

                        <div class="composer-inline-meta">
                          <span class="composer-inline-pill">FORGE</span>
                          <span class="composer-inline-text">{{ stageHint }}</span>
                        </div>
                      </div>

                      <div class="composer-toolbar-right">
                        <button class="composer-minimize-btn" type="button" @click="toggleComposerCollapsed" title="收起输入框">
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                        <button
                          class="send-btn"
                          :class="{ 'is-generating': store.isGenerating || forgeStore.isProcessing }"
                          @click="(store.isGenerating || forgeStore.isProcessing) ? store.abort() : store.generate()"
                          :disabled="!(store.isGenerating || forgeStore.isProcessing) && !store.canGenerate"
                          :title="(store.isGenerating || forgeStore.isProcessing) ? '停止' : '发送'"
                        >
                          <span v-if="!(store.isGenerating || forgeStore.isProcessing)">➜</span>
                          <svg
                            v-else
                            class="stop-icon"
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <rect x="5" y="5" width="14" height="14" rx="2.5"></rect>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </section>

        <aside v-if="showEmbeddedSidebar" class="workspace-sidebar" :class="{ 'is-workspace-embedded': props.embeddedInWorkspaceWindow }">
          <div class="sidebar-body">
            <ForgeAuxPanelView :kind="store.activeAuxPanel" />
          </div>
        </aside>
      </div>
    </div>

  </div>

  <SeedSnippetSelector
    v-if="showSnippetSelector"
    :snippets="extractedSnippets"
    @select="onSnippetsSelected"
    @close="closeSnippetSelector"
  />
  <input ref="seedInput" type="file" accept=".txt,.md,.json" class="hidden-input" @change="handleSeedFile" />
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { luminaWeaveApi } from '../../api';
import { useCardMakerStore } from './CardMakerStore';
import { useForgeStore } from '../../stores/useForgeStore';
import { useSessionIndexStore } from '../../stores/useSessionIndexStore';
import ForgePromptPreview from './ForgePromptPreview.vue';
import ForgeInlineTrace from './ForgeInlineTrace.vue';
import ForgeSessionBrowser from './ForgeSessionBrowser.vue';
import ForgeSessionToolbar from './ForgeSessionToolbar.vue';
import ForgeAuxPanelView from './ForgeAuxPanelView.vue';
import ForgeMessageRenderer from './ForgeMessageRenderer.vue';
import ForgeWindowActions from './ForgeWindowActions.vue';
import SeedSnippetSelector from './SeedSnippetSelector.vue';
import { useForgeSeedImport } from './useForgeSeedImport';
import type { ForgeDetailMode } from '../../types/ForgeStructuredTypes';
import type { ForgeAuxPanelKind, ForgeVisiblePhase } from '../../types/ForgeWorkflowTypes.js';
import type { SidebarMode } from '../../composables/useResponsiveLayout';
import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from './forgeAuxPanels';

const props = withDefaults(defineProps<{
    embeddedInWorkspaceWindow?: boolean;
    auxSidebarMode?: SidebarMode;
    activeRightPanelId?: string;
}>(), {
    embeddedInWorkspaceWindow: false
});

const store = useCardMakerStore();
const forgeStore = useForgeStore();
const sessionIndexStore = useSessionIndexStore();
const workspaceActions = inject<{
    openWorkspaceApp?: (appId: string) => void;
} | null>('lwWorkspaceActions', null);
const msgScroller = ref<HTMLElement | null>(null);
const composerMenuRef = ref<HTMLElement | null>(null);
const composerTextarea = ref<HTMLTextAreaElement | null>(null);
const isTopbarCollapsed = ref(false);
const isComposerCollapsed = ref(false);
const isComposerMenuOpen = ref(false);
const isDetailModeMenuOpen = ref(false);
const isPromptPreviewOpen = ref(false);
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// 操作分组：连续的 operation 条目聚合为一组，全部完成后可折叠
const expandedGroups = reactive<Set<string>>(new Set());

interface FeedMessage { kind: 'message'; id: string; message: any }
interface FeedOpGroup { kind: 'op-group'; id: string; operations: any[]; allDone: boolean }
type GroupedFeedItem = FeedMessage | FeedOpGroup;

const groupedFeed = computed((): GroupedFeedItem[] => {
    const result: GroupedFeedItem[] = [];
    let opBuffer: any[] = [];
    let groupIndex = 0;

    const flushBuffer = () => {
        if (opBuffer.length === 0) return;
        const groupId = `opgrp-${opBuffer[0].id}`;
        const allDone = opBuffer.every((op) => op.status !== 'running');
        result.push({ kind: 'op-group', id: groupId, operations: [...opBuffer], allDone });
        opBuffer = [];
        groupIndex++;
    };

    for (const item of store.timelineFeed) {
        if (item.kind === 'message') {
            flushBuffer();
            result.push(item as FeedMessage);
        } else {
            opBuffer.push(item.item);
        }
    }
    flushBuffer();
    return result;
});

const {
    seedInput,
    showSnippetSelector,
    extractedSnippets,
    openSeedInput,
    handleSeedFile,
    onSnippetsSelected,
    closeSnippetSelector
} = useForgeSeedImport((text) => {
    store.input = text;
    void nextTick(() => composerTextarea.value?.focus());
});

const renderMarkdown = (text: string) => {
    if (!text) return '';
    return text
        .split('\n')
        .map(line => {
            if (!line.trim()) return '<div class="empty-line"></div>';
            return `<p>${line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^\*]+)\*/g, '<em style="color:var(--lw-primary);">$1</em>')}</p>`;
        })
        .join('');
};

const getVisiblePhaseLabel = (phase: ForgeVisiblePhase | null | undefined): string => {
    switch (phase) {
    case 'alignment':
        return '启动校准';
    case 'entity_world':
        return '角色与世界实体';
    case 'state_topology':
        return '状态与拓扑';
    case 'narrative_style':
        return '叙事与描写';
    case 'variables_index':
        return '变量与根目录';
    case 'output_delivery':
        return '输出交付';
    case 'kickoff':
        return '启动';
    case 'build':
        return '成型';
    case 'finalize':
        return '审阅导出';
    default:
        return '工作台';
    }
};

const auxPanelButtons = FORGE_AUX_PANEL_ORDER.map((kind) => ({
    kind,
    ...FORGE_AUX_PANEL_META[kind]
}));

const isDetachedWorkspace = computed(() => props.embeddedInWorkspaceWindow && store.auxPresentationMode === 'detached');
const isMobileLayout = computed(() => props.auxSidebarMode === 'hidden');
const showWorkspaceHero = computed(() => !isDetachedWorkspace.value && !isMobileLayout.value);
const showWorkspaceTopbar = computed(() => !isDetachedWorkspace.value && !isMobileLayout.value);
const isTraditionalWithLeftSidebar = computed(() =>
    !props.embeddedInWorkspaceWindow && props.auxSidebarMode === 'left'
);
const isTraditionalWithRightSidebar = computed(() =>
    !props.embeddedInWorkspaceWindow && props.auxSidebarMode === 'right'
);
const isTraditionalWithWidgetSidebar = computed(() =>
    !props.embeddedInWorkspaceWindow && props.auxSidebarMode === 'widget'
);
const isTraditionalWithHiddenSidebar = computed(() =>
    !props.embeddedInWorkspaceWindow && props.auxSidebarMode === 'hidden'
);
const showEmbeddedSidebar = computed(() =>
    isTraditionalWithRightSidebar.value
    || (!isTraditionalWithLeftSidebar.value
        && !isTraditionalWithWidgetSidebar.value
        && !isTraditionalWithHiddenSidebar.value
        && (!props.embeddedInWorkspaceWindow || store.auxPresentationMode === 'embedded'))
);
const showAuxStripInBody = computed(() =>
    isTraditionalWithRightSidebar.value
    || (!isTraditionalWithLeftSidebar.value
        && !isTraditionalWithHiddenSidebar.value
        && !isTraditionalWithWidgetSidebar.value
        && (!props.embeddedInWorkspaceWindow || store.auxPresentationMode === 'embedded'))
);
const showAuxStripForWidgetMode = computed(() =>
    isTraditionalWithWidgetSidebar.value
);
const showAuxStripForHiddenMode = computed(() =>
    isTraditionalWithHiddenSidebar.value
);
const isForgeAuxPanelVisibleInWidget = (kind: ForgeAuxPanelKind): boolean => {
    if (props.auxSidebarMode !== 'widget') return store.activeAuxPanel === kind;
    return props.activeRightPanelId === `forge_${kind}`;
};

const getActiveTaskLabel = () => {
    if (!store.workflowSnapshot) return '未开始';
    if (store.detailMode === 'quick') {
        return store.workflowSnapshot.missingFields.length > 0
            ? `缺 ${store.workflowSnapshot.missingFields.length} 项`
            : `处理中 · ${store.workflowSnapshot.activeLayer}`;
    }
    return store.workflowSnapshot.activeLayer;
};

const workflowBadge = computed(() => {
    if (!store.workflowSnapshot) return '工作台';
    return `${getVisiblePhaseLabel(store.workflowSnapshot.visiblePhase)} · ${getActiveTaskLabel()}`;
});

const workspaceSubtitle = computed(() => {
    if (store.selectedChatSessionId) {
        return `参考聊天 ${store.selectedChatSessionId}`;
    }
    return '当前工作区未绑定历史聊天参考';
});

const referenceChatTitle = computed(() => {
    if (!store.selectedChatSessionId) return '';
    return sessionIndexStore.chatSessions.find(session => session.id === store.selectedChatSessionId)?.title || '';
});

const heroTitle = computed(() => store.workspaceTitle || 'Forge Workspace');

const heroSubtitle = computed(() => {
    const stageLabel = store.workflowSnapshot
        ? `${getVisiblePhaseLabel(store.workflowSnapshot.visiblePhase)} / ${getActiveTaskLabel()}`
        : '尚未进入 Forge 流程';
    const modeLabel = store.detailMode === 'detailed'
        ? '详细定制'
        : store.detailMode === 'quick'
            ? '快速开始'
            : '未选择节奏';
    const refLabel = referenceChatTitle.value
        ? `参考聊天 · ${referenceChatTitle.value}`
        : store.selectedChatSessionId
            ? `参考聊天 · ${store.selectedChatSessionId}`
            : '未绑定参考聊天';
    return `${stageLabel} · ${modeLabel} · ${refLabel}`;
});

const stageHint = computed(() => {
    if (!store.workflowSnapshot) return '';
    const missing = store.workflowSnapshot.missingFields.length
        ? store.detailMode === 'quick'
            ? `当前缺口 ${store.workflowSnapshot.missingFields.length} 项`
            : `缺 ${store.workflowSnapshot.missingFields.join(' / ')}`
        : store.detailMode === 'quick'
            ? `当前任务 ${store.workflowSnapshot.activeLayer}`
            : '当前层已可推进';
    return `${getVisiblePhaseLabel(store.workflowSnapshot.visiblePhase)} · ${missing}`;
});

const detailModeLabel = computed(() => {
    if (store.detailMode === 'detailed') return '详细定制';
    if (store.detailMode === 'quick') return '快速开始';
    return '未选择';
});

const closeComposerMenu = () => {
    isComposerMenuOpen.value = false;
    isDetailModeMenuOpen.value = false;
};

const toggleComposerMenu = () => {
    isComposerMenuOpen.value = !isComposerMenuOpen.value;
    if (!isComposerMenuOpen.value) {
        isDetailModeMenuOpen.value = false;
    }
};

const toggleDetailModeMenu = () => {
    if (store.isGenerating) return;
    isDetailModeMenuOpen.value = !isDetailModeMenuOpen.value;
};

const closePromptPreview = () => {
    isPromptPreviewOpen.value = false;
};

const togglePromptPreviewFromMenu = () => {
    isPromptPreviewOpen.value = !isPromptPreviewOpen.value;
    closeComposerMenu();
};

const handleAttachSeedFile = () => {
    closeComposerMenu();
    openSeedInput();
};

const handleChooseDetailMode = (mode: ForgeDetailMode) => {
    closeComposerMenu();
    void store.chooseDetailMode(mode);
};

const toggleComposerCollapsed = () => {
    isComposerCollapsed.value = !isComposerCollapsed.value;
    if (isComposerCollapsed.value) {
        closeComposerMenu();
        closePromptPreview();
        return;
    }

    void nextTick(() => composerTextarea.value?.focus());
};

const handleEnter = (e: KeyboardEvent) => {
    if (e.shiftKey) return;
    store.generate();
};

const handleCreateWorkspace = () => {
    store.createWorkspaceSession();
};

const handleClearChatReference = () => {
    store.attachChatSessionReference(null);
};

const handleAuxPanelClick = (panel: ForgeAuxPanelKind) => {
    if (props.embeddedInWorkspaceWindow && store.auxPresentationMode === 'detached') {
        store.setActiveAuxPanel(panel);
        const meta = FORGE_AUX_PANEL_META[panel];
        if (workspaceActions?.openWorkspaceApp) {
            workspaceActions.openWorkspaceApp(`panel:${meta.id}`);
        } else {
            luminaWeaveApi.openPanel(meta.id, { kind: panel }, { mode: 'tab' });
        }
        return;
    }
    if (props.auxSidebarMode === 'widget') {
        const panelId = `forge_${panel}`;
        luminaWeaveApi.emit('TOGGLE_WIDGET_PANEL', panelId);
        return;
    }
    if (props.auxSidebarMode === 'hidden') {
        luminaWeaveApi.emit('SWITCH_WIDGET_PANEL', `forge_${panel}`);
        return;
    }
    store.setActiveAuxPanel(panel);
};

const handleSwitchAuxMode = (mode: 'left' | 'right' | 'widget') => {
    luminaWeaveApi.emit('SWITCH_AUX_SIDEBAR_MODE', mode);
};

const scrollToBottom = () => {
    if (msgScroller.value) {
        msgScroller.value.scrollTop = msgScroller.value.scrollHeight;
    }
};

const handleGlobalPointerDown = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (!composerMenuRef.value?.contains(target)) {
        closeComposerMenu();
    }
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    closeComposerMenu();
    closePromptPreview();
};

watch(() => store.timelineFeed.length, () => nextTick(scrollToBottom));
watch(() => store.streamText, () => nextTick(scrollToBottom));
watch(() => store.isGenerating, (isGenerating) => {
    if (isGenerating) {
        closeComposerMenu();
    }
});
watch(
  () => [
    store.workspaceSessionId,
    store.selectedPresetId,
    store.selectedChatSessionId,
    store.activeLeafId,
    store.messageCount,
    store.input,
    store.workflowSnapshot?.stage || '',
    store.workflowSnapshot?.updatedAt || 0,
    store.entryMode || '',
    store.activeLayer || '',
    store.completedLayers.join('|'),
    store.timelineFeed.map((item: any) => `${item.id}:${item.timestamp}:${item.item.updatedAt}`).join('|'),
    forgeStore.stagingArea.map((entry: any) => `${entry.id}:${entry.timestamp}:${entry.targetEntryId}`).join('|'),
    forgeStore.commitReadyEntries.map((entry: any) => `${entry.id}:${entry.timestamp}:${entry.targetEntryId}`).join('|')
  ],
  () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
      store.persistWorkspaceSession();
      persistTimer = null;
    }, 450);
  },
  { deep: false }
);

onMounted(async () => {
  document.addEventListener('pointerdown', handleGlobalPointerDown);
  document.addEventListener('keydown', handleGlobalKeydown);
  await store.refreshPresets();
  await store.ensureWorkspaceSession();
  await sessionIndexStore.refresh();
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleGlobalPointerDown);
  document.removeEventListener('keydown', handleGlobalKeydown);
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  store.flushWorkspaceSession();
});
</script>

<style scoped>
.card-maker-root {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  color: var(--lw-text-main);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-surface) 96%, transparent), color-mix(in srgb, var(--lw-bg-app) 92%, transparent));
  --forge-line: color-mix(in srgb, var(--lw-border-base) 90%, transparent);
  --forge-line-strong: color-mix(in srgb, var(--lw-border-strong) 72%, transparent);
  --forge-glass: color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent);
  --forge-glass-strong: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  --forge-glass-soft: color-mix(in srgb, var(--lw-bg-subtle) 72%, transparent);
  --forge-shadow:
    0 20px 48px rgba(15, 23, 42, 0.1),
    0 2px 10px rgba(15, 23, 42, 0.05);
}

.card-maker-root::before,
.card-maker-root::after {
  content: '';
  position: absolute;
  pointer-events: none;
  z-index: -1;
}

.card-maker-root::before {
  inset: -14% -6% auto auto;
  width: 52vw;
  height: 40vw;
  min-width: 460px;
  min-height: 340px;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(var(--lw-primary-rgb), 0.32), rgba(var(--lw-primary-rgb), 0.16) 28%, rgba(var(--lw-primary-rgb), 0.05) 52%, transparent 72%);
  filter: blur(28px);
}

.card-maker-root::after {
  inset: auto auto -10% -8%;
  width: 42vw;
  height: 28vw;
  min-width: 320px;
  min-height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--lw-primary-rgb), 0.16), transparent 72%);
  filter: blur(36px);
}

.workspace-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 24px 22px;
}

.workspace-shell.is-detached-workspace {
  gap: 0;
  padding: 0;
}

.workspace-shell.is-mobile-layout {
  gap: 0;
  padding: 0;
}

.workspace-shell.is-mobile-layout .chat-section {
  border: none;
  border-radius: 0;
}

.mobile-aux-strip {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.mobile-aux-strip::-webkit-scrollbar {
  display: none;
}

.mobile-aux-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid var(--lw-border-subtle);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s;
}

.mobile-aux-btn:active {
  background: var(--lw-primary-soft);
  color: var(--lw-primary);
  border-color: var(--lw-primary);
}

.workspace-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.hero-kicker {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--lw-text-muted);
}

.hero-title {
  margin: 0;
  font-family: var(--lw-font-display);
  font-size: clamp(28px, 3.4vw, 42px);
  line-height: 0.98;
  letter-spacing: -0.04em;
  color: var(--lw-text-main);
}

.hero-subtitle {
  margin: 0;
  max-width: 720px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.hero-actions {
  margin-left: auto;
}

.main-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
}

.main-layout.has-embedded-sidebar {
  grid-template-columns: minmax(0, 1fr) clamp(310px, 27vw, 388px);
}

.main-layout.is-detached-workspace {
  gap: 0;
}

.chat-section,
.workspace-sidebar {
  position: relative;
  min-height: 0;
  border-radius: 28px;
  border: 1px solid color-mix(in srgb, var(--forge-line-strong) 76%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--forge-glass-strong) 96%, transparent), color-mix(in srgb, var(--forge-glass) 90%, transparent));
  backdrop-filter: blur(20px);
  overflow: hidden;
}

.chat-section {
  display: flex;
  flex-direction: column;
}

.chat-section.is-detached-workspace {
  border: none;
  border-radius: 0;
  background: transparent;
  backdrop-filter: none;
}

.workspace-sidebar {
  display: flex;
  flex-direction: column;
}

.window-handle {
  width: 108px;
  height: 6px;
  margin: 12px auto 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-text-soft) 76%, transparent);
}

.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px 16px;
  border-bottom: 1px solid var(--forge-line);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--forge-glass-strong) 98%, transparent), color-mix(in srgb, var(--forge-glass) 84%, transparent));
}

.topbar.is-collapsed {
  align-items: center;
  padding-top: 12px;
  padding-bottom: 12px;
}

.topbar-content {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.topbar-collapsed-copy {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.collapsed-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--forge-line-strong) 82%, transparent);
  background: color-mix(in srgb, var(--forge-glass-strong) 88%, transparent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.collapsed-text {
  min-width: 0;
  font-size: 12px;
  color: var(--lw-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-toggle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--forge-line-strong) 82%, transparent);
  background: color-mix(in srgb, var(--forge-glass-strong) 90%, transparent);
  color: var(--lw-text-main);
  padding: 8px 11px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--lw-transition);
}

.aux-panel-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--forge-line) 76%, transparent);
  flex-wrap: wrap;
}

.aux-panel-strip.is-window-launcher {
  border-top-color: color-mix(in srgb, rgba(var(--lw-primary-rgb), 0.18) 72%, transparent);
}

.aux-panel-strip-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.aux-panel-strip-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.aux-panel-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  color: var(--lw-text-secondary);
  padding: 7px 11px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.aux-panel-btn.is-active {
  border-color: rgba(var(--lw-primary-rgb), 0.28);
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-text-main);
}

.aux-panel-btn-icon {
  font-size: 13px;
}

.aux-panel-mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  color: var(--lw-text-muted);
  cursor: pointer;
  transition: var(--lw-transition);
}

.aux-panel-mode-btn:hover {
  border-color: var(--lw-border-hover);
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.section-toggle:hover {
  border-color: var(--lw-border-hover);
  background: var(--lw-bg-hover);
}

.title-group {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.title-group.compact .display-name {
  font-size: 13px;
}

.title-group.compact .session-id {
  font-size: 10px;
}

.title-group .icon {
  width: 38px;
  height: 38px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--lw-primary);
  background:
    linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.12), rgba(var(--lw-primary-rgb), 0.04));
  border: 1px solid rgba(var(--lw-primary-rgb), 0.18);
}

.text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.display-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.session-id {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.content-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.message-scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 18px 10px;
}

.chat-section.is-detached-workspace .message-scroller {
  padding: 20px 22px 10px;
}

.entry-mode-stage,
.conversation-shell,
.composer-shell {
  width: min(780px, 100%);
  margin-left: auto;
  margin-right: auto;
}

.chat-section.is-detached-workspace .entry-mode-stage,
.chat-section.is-detached-workspace .conversation-shell,
.chat-section.is-detached-workspace .composer-shell {
  width: 100%;
  max-width: none;
  margin-left: 0;
  margin-right: 0;
}

.entry-mode-stage {
  margin-bottom: 20px;
}

.entry-mode-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.1), rgba(var(--lw-primary-rgb), 0.03));
  border: 1px solid rgba(var(--lw-primary-rgb), 0.16);
}

.entry-mode-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lw-primary);
}

.entry-mode-card h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.08;
}

.entry-mode-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--lw-text-secondary);
}

.entry-mode-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.entry-primary,
.entry-secondary {
  border-radius: 999px;
  border: 1px solid var(--forge-line);
  background: color-mix(in srgb, var(--forge-glass-strong) 94%, transparent);
  color: var(--lw-text-main);
  font-size: 12px;
  font-weight: 700;
  transition: var(--lw-transition);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.entry-primary {
  padding: 10px 15px;
  background: var(--lw-black);
  border-color: var(--lw-black);
  color: var(--lw-text-inverse);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
}

.entry-secondary {
  padding: 10px 15px;
}

.entry-secondary:hover,
.entry-secondary:hover {
  border-color: var(--lw-border-hover);
  background: var(--lw-bg-hover);
}

.conversation-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.conversation-shell::before {
  display: none;
}

.forge-msg {
  display: flex;
  width: min(760px, 100%);
  margin: 0 auto;
}

/* 操作分组折叠 */
.op-group-wrap {
  width: min(760px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.op-group-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  margin: 2px 0;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  color: var(--lw-text-muted);
  font-size: 12px;
  transition: background 0.12s ease;
}

.op-group-summary:hover {
  background: color-mix(in srgb, var(--lw-border-base) 30%, transparent);
}

.op-group-dot-row {
  display: flex;
  gap: 3px;
  align-items: center;
  flex-shrink: 0;
}

.op-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--lw-text-muted);
  opacity: 0.5;
}

.op-group-label {
  font-weight: 500;
  color: var(--lw-text-secondary);
}

.op-group-expand {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.6;
}

.op-group-collapse-btn {
  display: block;
  margin: 2px 0 4px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  color: var(--lw-text-muted);
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.12s;
}

.op-group-collapse-btn:hover {
  background: color-mix(in srgb, var(--lw-border-base) 30%, transparent);
}

.chat-section.is-detached-workspace .forge-msg {
  width: 100%;
  margin: 0;
}

.role-user {
  justify-content: flex-end;
}

.msg-avatar {
  display: none;
}

.msg-column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: min(760px, 100%);
}

.chat-section.is-detached-workspace .msg-column {
  max-width: none;
}

.role-user .msg-column {
  align-items: flex-end;
}

.msg-meta {
  display: none;
}

.msg-bubble {
  width: 100%;
  max-width: min(760px, 100%);
}

.chat-section.is-detached-workspace .msg-bubble {
  max-width: none;
}

.role-user .msg-bubble {
  width: fit-content;
  max-width: min(520px, calc(100vw - 72px));
  padding: 14px 18px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 90%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 98%, transparent), color-mix(in srgb, var(--lw-bg-subtle) 96%, transparent));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.role-assistant .msg-bubble {
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.role-assistant .msg-bubble :deep(.lv-message-renderer) {
  gap: 12px;
}

.role-assistant .msg-bubble :deep(.lv-message-renderer > *) {
  max-width: 74ch;
}

.chat-section.is-detached-workspace .role-assistant .msg-bubble :deep(.lv-message-renderer > *) {
  max-width: min(92ch, 100%);
}

.role-assistant .msg-bubble :deep(.lv-message-renderer p) {
  margin: 0;
  font-size: 15px;
  line-height: 1.72;
  color: var(--lw-text-main);
}

.role-user .msg-bubble :deep(.lv-message-renderer p) {
  margin: 0;
  font-size: 15px;
  line-height: 1.62;
}

.role-user .msg-bubble :deep(.thinking-block) {
  display: none;
}

.streaming-placeholder {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(760px, 100%);
  margin: 0 auto;
  padding: 0 0 0 2px;
  border: none;
  background: transparent;
  color: var(--lw-text-secondary);
  font-size: 12px;
}

.chat-section.is-detached-workspace .streaming-placeholder {
  width: 100%;
  margin: 0;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--lw-primary);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.84); opacity: 0.5; }
  50% { transform: scale(1.16); opacity: 1; }
  100% { transform: scale(0.84); opacity: 0.5; }
}

.composer-section {
  position: relative;
  padding: 18px 18px 14px;
  border-top: none;
  background: transparent;
  align-content: center;
  font-family: --lw-font-main;
}

.chat-section.is-detached-workspace .composer-section {
  padding: 12px 22px 18px;
}

.composer-section.is-collapsed {
  padding-top: 8px;
  padding-bottom: 8px;
}

.composer-collapsed-bar {
  width: min(780px, 100%);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.composer-inline-meta {
  min-width: 0;
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  overflow: hidden;
}

.composer-inline-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--forge-line-strong) 76%, transparent);
  background: transparent;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.composer-inline-text {
  min-width: 0;
  font-size: 10px;
  line-height: 1.4;
  color: var(--lw-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-toggle {
  margin-left: auto;
}

.error-banner {
  width: min(780px, 100%);
  margin: 0 auto 10px;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 12px;
  color: #ffb8b8;
  background: rgba(255, 115, 115, 0.1);
  border: 1px solid rgba(255, 115, 115, 0.16);
}

.composer-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 12px 5px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 88%, transparent);
  background: transparent;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.035);
}

.input-container:focus-within {
  border-color: var(--lw-border-active);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.09);
}

.composer-textarea {
  flex: 1;
  min-height: 44px;
  max-height: 128px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  padding: 8px 10px 2px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--lw-text-main);
}

.composer-textarea::placeholder {
  color: var(--lw-text-muted);
}

.composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.composer-toolbar-left,
.composer-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.composer-toolbar-left {
  flex: 1;
}

.composer-menu-wrap {
  position: relative;
  flex-shrink: 0;
}

.composer-plus-btn {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 88%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--lw-bg-surface) 98%, transparent);
  color: var(--lw-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--lw-transition);
}

.composer-plus-btn:hover,
.composer-plus-btn.active {
  color: var(--lw-text-main);
  border-color: var(--lw-border-hover);
  background: var(--lw-bg-hover);
}

.composer-menu-panel {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  width: 208px;
  padding: 6px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 90%, transparent);
  background: color-mix(in srgb, var(--lw-bg-surface) 98%, transparent);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(24px);
  z-index: 35;
  overflow: visible;
}

.composer-menu-item,
.composer-submenu-item {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--lw-text-main);
  border-radius: 14px;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  transition: var(--lw-transition);
}

.composer-menu-item:hover,
.composer-submenu-item:hover,
.composer-menu-group.active > .composer-menu-item {
  background: color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent);
}

.composer-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.composer-menu-group {
  position: relative;
}

.composer-menu-group::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  border-top: 1px solid color-mix(in srgb, var(--forge-line) 86%, transparent);
}

.composer-menu-group > .composer-menu-item {
  margin-top: 6px;
}

.composer-menu-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-text-secondary);
}

.composer-menu-label {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
}

.composer-menu-status,
.composer-menu-value {
  font-size: 10px;
  color: var(--lw-text-muted);
}

.composer-menu-chevron {
  flex-shrink: 0;
  color: var(--lw-text-muted);
}

.composer-menu-submenu {
  position: static;
  width: 100%;
  margin-top: 6px;
  padding: 4px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 90%, transparent);
  background: color-mix(in srgb, var(--lw-bg-surface) 98%, transparent);
  box-shadow: none;
}

.composer-menu-submenu.is-panel {
  margin-top: 0;
  padding: 0;
  border: none;
  background: transparent;
}

.composer-menu-back {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--lw-text-secondary);
  border-radius: 14px;
  padding: 8px 9px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--lw-transition);
}

.composer-menu-back:hover {
  background: color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent);
  color: var(--lw-text-main);
}

.composer-submenu-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 8px 9px;
}

.composer-submenu-item span {
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.composer-submenu-item small {
  font-size: 10px;
  line-height: 1.4;
  color: var(--lw-text-muted);
}

.composer-submenu-item.active {
  background: rgba(var(--lw-primary-rgb), 0.1);
}

.composer-submenu-item.active span,
.composer-submenu-item.active small {
  color: var(--lw-primary);
}

.composer-select-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 2px;
  color: var(--lw-text-secondary);
}

.composer-select-prefix {
  font-size: 10px;
  color: var(--lw-text-muted);
  flex-shrink: 0;
}

.composer-select {
  min-width: 0;
  max-width: min(168px, 32vw);
  border: none;
  background: transparent;
  color: var(--lw-text-main);
  font-size: 12px;
  font-weight: 600;
  outline: none;
  padding-right: 6px;
}

.composer-minimize-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 88%, transparent);
  border-radius: 50%;
  background: transparent;
  color: var(--lw-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--lw-transition);
}

.composer-minimize-btn:hover {
  color: var(--lw-text-main);
  border-color: var(--lw-border-hover);
  background: var(--lw-bg-hover);
}

.send-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--lw-black);
  color: white;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
  transition: var(--lw-transition);
}

.send-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.send-btn.is-generating {
  background: #1f2329;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
}

.send-btn.is-generating:disabled {
  opacity: 1;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
}

.stop-icon {
  display: block;
  color: #fff;
}

.composer-menu-enter-active,
.composer-menu-leave-active {
  transition: all 0.18s ease;
}

.composer-menu-enter-from,
.composer-menu-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.workspace-sidebar {
  min-width: 0;
}

.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sidebar-body :deep(.lore-editor) {
  background: transparent !important;
}

.hidden-input {
  display: none;
}

@media (max-width: 1100px) {
  .workspace-shell {
    padding: 16px;
  }

  .main-layout {
    grid-template-columns: 1fr;
  }

  .workspace-sidebar {
    min-height: 360px;
  }
}

@media (max-width: 720px) {
  .workspace-shell {
    gap: 14px;
    padding: 12px;
  }

  .workspace-hero {
    flex-direction: column;
  }

  .hero-actions {
    margin-left: 0;
  }

  .topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .topbar-content {
    grid-template-columns: 1fr;
  }

  .topbar-collapsed-copy,
  .composer-collapsed-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .composer-toolbar {
    flex-wrap: nowrap;
  }

  .composer-toolbar-left {
    flex-direction: row;
    flex-wrap: nowrap;
    /* overflow: hidden; */
  }

  .composer-inline-meta {
    display: none;
  }

  .composer-select-prefix {
    display: none;
  }

  .composer-select {
    max-width: 100px;
  }

  .section-toggle,
  .composer-toggle {
    align-self: flex-start;
  }

  .composer-toolbar-right {
    flex-shrink: 0;
  }

  .input-container {
    padding: 4px 10px 3px;
  }

  .composer-textarea {
    min-height: 32px;
    padding: 5px 8px 1px;
  }

  .composer-menu-panel {
    width: min(208px, calc(100vw - 48px));
  }

  .conversation-shell::before {
    left: 17px;
  }

  .streaming-placeholder {
    width: 100%;
  }
}
</style>
