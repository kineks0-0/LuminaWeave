<template>
  <div class="forge-window-header-actions" ref="rootRef" @pointerdown.stop>
    <ForgePromptPreview :open="isPromptPreviewOpen" @close="isPromptPreviewOpen = false" />

    <button class="header-action-btn" type="button" @click="store.setWorkspacePage('session-browser')">
      <span>会话列表</span>
    </button>

    <button class="header-action-btn" type="button" @click="togglePresentationMode">
      <span>{{ store.auxPresentationMode === 'detached' ? '内嵌右栏' : '拆出小窗' }}</span>
    </button>

    <div class="header-menu-wrap">
      <button
        class="header-action-btn"
        :class="{ active: isMoreMenuOpen }"
        type="button"
        @click="isMoreMenuOpen = !isMoreMenuOpen"
      >
        <span>更多</span>
      </button>

      <transition name="forge-header-menu">
        <div v-if="isMoreMenuOpen" class="header-menu-panel">
          <div v-if="store.auxPresentationMode === 'detached'" class="header-menu-section">
            <span class="header-menu-label">辅助窗口</span>
            <div class="header-menu-pills">
              <button
                v-for="item in auxPanelButtons"
                :key="item.kind"
                class="header-pill-btn"
                :class="{ active: store.activeAuxPanel === item.kind }"
                type="button"
                @click="openDetachedAuxPanel(item.kind)"
              >
                <span>{{ item.icon }}</span>
                <span>{{ item.shortLabel }}</span>
              </button>
            </div>
          </div>

          <div class="header-menu-section">
            <span class="header-menu-label">工作区操作</span>
            <button class="header-menu-item" type="button" @click="handleCreateWorkspace">
              <span>新建会话</span>
            </button>
            <button
              v-if="store.selectedChatSessionId"
              class="header-menu-item"
              type="button"
              @click="handleClearReference"
            >
              <span>解绑参考</span>
            </button>
            <button class="header-menu-item" type="button" @click="handleAttachSeedFile">
              <span>添加素材文件</span>
            </button>
            <button
              class="header-menu-item"
              type="button"
              :disabled="!store.selectedPresetId"
              @click="openPromptPreview"
            >
              <span>Prompt 预览</span>
            </button>
            <button class="header-menu-item danger" type="button" @click="handleResetSession">
              <span>重置会话</span>
            </button>
          </div>

          <div class="header-menu-section">
            <span class="header-menu-label">协作节奏</span>
            <div class="header-menu-pills">
              <button
                class="header-pill-btn"
                :class="{ active: store.detailMode === 'detailed' }"
                type="button"
                @click="handleChooseDetailMode('detailed')"
              >
                <span>详细定制</span>
              </button>
              <button
                class="header-pill-btn"
                :class="{ active: store.detailMode === 'quick' }"
                type="button"
                @click="handleChooseDetailMode('quick')"
              >
                <span>快速开始</span>
              </button>
            </div>
          </div>
        </div>
      </transition>
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
import { inject, onMounted, onUnmounted, ref } from 'vue';
import { luminaWeaveApi } from '../../api';
import type { ForgeDetailMode } from '../../types/ForgeStructuredTypes.js';
import type { ForgeAuxPanelKind } from '../../types/ForgeWorkflowTypes.js';
import { useCardMakerStore } from './CardMakerStore';
import ForgePromptPreview from './ForgePromptPreview.vue';
import SeedSnippetSelector from './SeedSnippetSelector.vue';
import { useForgeSeedImport } from './useForgeSeedImport';
import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from './forgeAuxPanels';

const store = useCardMakerStore();
const workspaceActions = inject<{
  openWorkspaceApp?: (appId: string) => void;
  closeWorkspaceApps?: (appIds: string[]) => void;
} | null>('lwWorkspaceActions', null);
const rootRef = ref<HTMLElement | null>(null);
const isMoreMenuOpen = ref(false);
const isPromptPreviewOpen = ref(false);

const auxPanelButtons = FORGE_AUX_PANEL_ORDER.map((kind) => ({
  kind,
  ...FORGE_AUX_PANEL_META[kind]
}));
const auxWorkspaceAppIds = FORGE_AUX_PANEL_ORDER.map((kind) => `panel:${FORGE_AUX_PANEL_META[kind].id}`);

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
});

const closeMenus = () => {
  isMoreMenuOpen.value = false;
};

const handleGlobalPointerDown = (event: PointerEvent) => {
  const target = event.target as Node | null;
  if (!target) return;
  if (!rootRef.value?.contains(target)) {
    closeMenus();
  }
};

const togglePresentationMode = () => {
  const nextMode = store.auxPresentationMode === 'detached' ? 'embedded' : 'detached';
  store.setAuxPresentationMode(nextMode);
  if (nextMode === 'detached') {
    openDetachedAuxPanel(store.activeAuxPanel);
    return;
  }
  workspaceActions?.closeWorkspaceApps?.(auxWorkspaceAppIds);
  closeMenus();
};

const openDetachedAuxPanel = (kind: ForgeAuxPanelKind) => {
  store.setActiveAuxPanel(kind);
  const meta = FORGE_AUX_PANEL_META[kind];
  if (workspaceActions?.openWorkspaceApp) {
    workspaceActions.openWorkspaceApp(`panel:${meta.id}`);
  } else {
    luminaWeaveApi.openPanel(meta.id, { kind }, { mode: 'tab' });
  }
  closeMenus();
};

const handleCreateWorkspace = () => {
  store.createWorkspaceSession();
  closeMenus();
};

const handleClearReference = async () => {
  await store.attachChatSessionReference(null);
  closeMenus();
};

const handleChooseDetailMode = async (mode: ForgeDetailMode) => {
  await store.chooseDetailMode(mode);
  closeMenus();
};

const handleResetSession = () => {
  store.resetSession();
  closeMenus();
};

const handleAttachSeedFile = () => {
  closeMenus();
  openSeedInput();
};

const openPromptPreview = () => {
  isPromptPreviewOpen.value = true;
  closeMenus();
};

onMounted(() => {
  document.addEventListener('pointerdown', handleGlobalPointerDown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleGlobalPointerDown);
});
</script>

<style scoped>
.forge-window-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.header-action-btn,
.header-pill-btn,
.header-menu-item {
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 88%, white);
  background: color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent);
  color: var(--lw-text-main);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--lw-transition);
}

.header-action-btn {
  padding: 7px 11px;
}

.header-action-btn.active,
.header-pill-btn.active {
  border-color: rgba(var(--lw-primary-rgb), 0.28);
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-text-main);
}

.header-menu-wrap {
  position: relative;
}

.header-menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  width: 280px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 88%, white);
  background: color-mix(in srgb, var(--lw-bg-elevated) 98%, transparent);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.14);
  z-index: 5;
}

.header-menu-section + .header-menu-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--lw-border-base) 78%, transparent);
}

.header-menu-label {
  display: block;
  margin-bottom: 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.header-menu-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.header-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
}

.header-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
}

.header-menu-item + .header-menu-item {
  margin-top: 8px;
}

.header-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.header-menu-item.danger {
  color: #b91c1c;
}

.hidden-input {
  display: none;
}

.forge-header-menu-enter-active,
.forge-header-menu-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.forge-header-menu-enter-from,
.forge-header-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
