<template>
  <div class="forge-window-actions" :class="[`presentation-${presentation}`]" ref="rootRef" @pointerdown.stop>
    <ForgePromptPreview :open="isPromptPreviewOpen" placement="below" @close="isPromptPreviewOpen = false" />

    <div class="workspace-menu-wrap">
      <button
        class="action-btn workspace-menu-btn"
        :class="{ active: isWorkspaceMenuOpen }"
        type="button"
        title="工作区"
        @pointerdown.stop
        @click="toggleWorkspaceMenu"
      >
        <span>工作区</span>
      </button>

      <transition name="forge-action-menu">
        <div v-if="isWorkspaceMenuOpen" class="workspace-menu-panel">
          <div class="workspace-menu-section">
            <span class="workspace-menu-label">辅助窗口</span>
            <div class="workspace-menu-pills">
              <button
                v-for="item in auxPanelButtons"
                :key="item.kind"
                class="workspace-pill-btn"
                :class="{ active: isAuxPanelSelected(item.kind) }"
                type="button"
                @click="handleOpenAuxPanel(item.kind)"
              >
                <span>{{ item.icon }}</span>
                <span>{{ item.shortLabel }}</span>
              </button>
            </div>
          </div>

          <div class="workspace-menu-section">
            <span class="workspace-menu-label">辅助视图位置</span>
            <div class="workspace-menu-pills">
              <button
                v-for="mode in auxDisplayModes"
                :key="mode.value"
                class="workspace-pill-btn"
                :class="{ active: currentAuxSidebarMode === mode.value }"
                type="button"
                @click="handleSwitchAuxMode(mode.value)"
              >
                <span>{{ mode.icon }}</span>
                <span>{{ mode.label }}</span>
              </button>
            </div>
          </div>

          <div class="workspace-menu-section">
            <span class="workspace-menu-label">工作区操作</span>
            <button class="workspace-menu-item" type="button" @click="handleOpenProjectCenter">
              <span>项目中心</span>
            </button>
            <button class="workspace-menu-item" type="button" @click="handleCreateProject">
              <span>新建项目</span>
            </button>
            <button class="workspace-menu-item" type="button" @click="handleAttachSeedFile">
              <span>添加素材文件</span>
            </button>
            <button
              class="workspace-menu-item"
              type="button"
              @click="openPromptPreview"
            >
              <span>Prompt 预览</span>
            </button>
            <button class="workspace-menu-item danger" type="button" @click="handleResetSession">
              <span>重置会话</span>
            </button>
          </div>

          <div class="workspace-menu-section">
            <span class="workspace-menu-label">协作节奏</span>
            <div class="workspace-menu-pills">
              <button
                class="workspace-pill-btn"
                :class="{ active: store.detailMode === 'detailed' }"
                type="button"
                @click="handleChooseDetailMode('detailed')"
              >
                <span>详细定制</span>
              </button>
              <button
                class="workspace-pill-btn"
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

    <button class="action-btn subtle" type="button" title="重置会话" @pointerdown.stop @click="store.resetSession">
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      <span>重置会话</span>
    </button>
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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { luminaWeaveApi } from '../../api';
import type { SidebarMode } from '../../composables/useResponsiveLayout.js';
import type { ForgeDetailMode } from '../../types/ForgeStructuredTypes.js';
import type { ForgeAuxPanelKind } from '../../types/ForgeWorkflowTypes.js';
import { useCardMakerStore } from './CardMakerStore.js';
import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from './forgeAuxPanels.js';
import ForgePromptPreview from './inspector/ForgePromptPreview.vue';
import SeedSnippetSelector from './SeedSnippetSelector.vue';
import { useForgeSeedImport } from './useForgeSeedImport.js';

const props = withDefaults(defineProps<{
  presentation?: 'hero' | 'window';
  auxSidebarMode?: SidebarMode;
  activeRightPanelId?: string;
}>(), {
  presentation: 'window'
});

const store = useCardMakerStore();
const rootRef = ref<HTMLElement | null>(null);
const isWorkspaceMenuOpen = ref(false);
const isPromptPreviewOpen = ref(false);

const auxPanelButtons = FORGE_AUX_PANEL_ORDER.map((kind) => ({
  kind,
  ...FORGE_AUX_PANEL_META[kind]
}));

const auxDisplayModes: Array<{ value: 'left' | 'right' | 'widget'; label: string; icon: string }> = [
  { value: 'left', label: '视图内左侧', icon: '◧' },
  { value: 'right', label: '视图内右侧', icon: '◨' },
  { value: 'widget', label: '扩展显示至小窗', icon: '▣' }
];

const currentAuxSidebarMode = computed<'left' | 'right' | 'widget'>(() => {
  if (props.auxSidebarMode === 'left' || props.auxSidebarMode === 'right' || props.auxSidebarMode === 'widget') {
    return props.auxSidebarMode;
  }
  return 'right';
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
});

const closeMenus = () => {
  isWorkspaceMenuOpen.value = false;
};

const toggleWorkspaceMenu = () => {
  isWorkspaceMenuOpen.value = !isWorkspaceMenuOpen.value;
};

const handleGlobalPointerDown = (event: PointerEvent) => {
  const target = event.target as Node | null;
  if (!target || rootRef.value?.contains(target)) return;
  closeMenus();
};

const handleOpenProjectCenter = () => {
  store.setWorkspacePage('session-browser');
  closeMenus();
};

const handleSwitchAuxMode = (mode: 'left' | 'right' | 'widget') => {
  store.setAuxPresentationMode(mode === 'widget' ? 'widget' : 'embedded');
  luminaWeaveApi.emit('SWITCH_AUX_SIDEBAR_MODE', mode);
  if (mode === 'widget') {
    openAuxPanelAsWidget(store.activeAuxPanel);
  } else {
    closeOpenAuxWidget();
  }
  closeMenus();
};

const getWidgetPanelId = (kind: ForgeAuxPanelKind) => `forge_${kind}`;

const closeOpenAuxWidget = () => {
  const openPanelId = props.activeRightPanelId;
  if (!openPanelId) return;
  const isForgeAuxPanel = FORGE_AUX_PANEL_ORDER.some((kind) => FORGE_AUX_PANEL_META[kind].id === openPanelId);
  if (!isForgeAuxPanel) return;
  luminaWeaveApi.emit('TOGGLE_WIDGET_PANEL', openPanelId);
};

const openAuxPanelAsWidget = (kind: ForgeAuxPanelKind) => {
  store.setActiveAuxPanel(kind);
  if (props.activeRightPanelId === getWidgetPanelId(kind)) return;
  launchAuxActivity(kind);
};

const launchAuxActivity = (kind: ForgeAuxPanelKind) => {
  const meta = FORGE_AUX_PANEL_META[kind];
  luminaWeaveApi.services.desktopSurface.launchActivity({
    id: meta.id,
    title: meta.title,
    icon: meta.icon,
    role: 'auxiliary',
    target: {
      kind: 'registered-panel',
      panelId: meta.id
    },
    activity: {
      size: 'small',
      pageType: 'nested',
      titleBar: {
        title: meta.title,
        showBack: true
      }
    },
    props: { kind },
    dedupeKey: `panel:${meta.id}`
  });
};

const isAuxPanelSelected = (kind: ForgeAuxPanelKind): boolean => {
  if (currentAuxSidebarMode.value === 'widget') {
    return props.activeRightPanelId === getWidgetPanelId(kind);
  }
  return store.activeAuxPanel === kind;
};

const handleOpenAuxPanel = (kind: ForgeAuxPanelKind) => {
  const panelId = getWidgetPanelId(kind);
  const isSelected = isAuxPanelSelected(kind);

  if (currentAuxSidebarMode.value === 'widget') {
    store.setActiveAuxPanel(kind);
    if (isSelected) {
      luminaWeaveApi.emit('TOGGLE_WIDGET_PANEL', panelId);
      return;
    }
    launchAuxActivity(kind);
    return;
  }

  if (isSelected) {
    store.setAuxPresentationMode('widget');
    luminaWeaveApi.emit('SWITCH_AUX_SIDEBAR_MODE', 'widget');
    openAuxPanelAsWidget(kind);
    return;
  }

  store.setActiveAuxPanel(kind);
  if (!props.auxSidebarMode || props.auxSidebarMode === 'hidden') {
    luminaWeaveApi.emit('SWITCH_AUX_SIDEBAR_MODE', 'right');
  }
};

const handleCreateProject = () => {
  store.createWorkspaceSession();
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

const handleResetSession = () => {
  store.resetSession();
  closeMenus();
};

const handleChooseDetailMode = async (mode: ForgeDetailMode) => {
  await store.chooseDetailMode(mode);
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
.forge-window-actions {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.action-btn,
.workspace-pill-btn,
.workspace-menu-item {
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 86%, white);
  background: color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent);
  color: var(--lw-text-main);
  padding: 9px 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
  transition: var(--lw-transition);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.action-btn:hover,
.workspace-pill-btn:hover,
.workspace-menu-item:hover {
  border-color: var(--lw-border-hover);
  background: var(--lw-bg-hover);
}

.action-btn.subtle {
  color: var(--lw-text-secondary);
}

.workspace-menu-wrap {
  position: relative;
}

.workspace-menu-btn.active,
.workspace-pill-btn.active {
  border-color: rgba(var(--lw-primary-rgb), 0.28);
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-text-main);
}

.workspace-menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  width: 330px;
  padding: 12px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 88%, white);
  background: color-mix(in srgb, var(--lw-bg-elevated) 98%, transparent);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.14);
  z-index: 40;
}

.workspace-menu-section + .workspace-menu-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--lw-border-base) 78%, transparent);
}

.workspace-menu-label {
  display: block;
  margin-bottom: 8px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.workspace-menu-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workspace-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
}

.workspace-menu-item {
  width: 100%;
  justify-content: space-between;
  padding: 9px 12px;
}

.workspace-menu-item + .workspace-menu-item {
  margin-top: 8px;
}

.workspace-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.workspace-menu-item.danger {
  color: #b91c1c;
}

.hidden-input {
  display: none;
}

.forge-action-menu-enter-active,
.forge-action-menu-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.forge-action-menu-enter-from,
.forge-action-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.presentation-window .action-btn {
  padding: 7px 12px;
  font-size: var(--lw-type-label-small-size);
}
</style>
