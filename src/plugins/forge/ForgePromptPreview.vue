<template>
  <transition name="preview-panel">
    <div v-if="open" class="forge-prompt-preview">
      <div class="preview-panel">
        <div class="preview-head">
          <div class="preview-copy">
            <span class="preview-title">{{ activePreview?.title || 'Forge Prompt 预览' }}</span>
            <span class="preview-subtitle">{{ activePreview?.subtitle || '展示当前预设、世界书和会话链拼接后的消息载荷' }}</span>
          </div>
          <div class="preview-actions">
            <span class="payload-badge">{{ activePreview?.payload.length || 0 }} 条</span>
            <button class="refresh-btn" @click="refresh" :disabled="isLoading">
              刷新
            </button>
            <button class="close-btn" type="button" @click="$emit('close')" title="关闭预览">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="error" class="error-banner">{{ error }}</div>

        <div class="preview-body">
          <div v-if="previewBundle" class="tab-switcher">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'primary' }"
              @click="activeTab = 'primary'"
            >
              主模型
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'executor' }"
              @click="activeTab = 'executor'"
            >
              子 / 执行模型
            </button>
          </div>

          <div v-if="memorySnapshot" class="snapshot-card">
            <div class="snapshot-line">
              <span class="snapshot-label">会话</span>
              <strong>{{ memorySnapshot.sourceId }}</strong>
              <span>{{ memorySnapshot.sessionId || 'unknown' }}</span>
            </div>
            <div class="snapshot-line">
              <span class="snapshot-label">节点</span>
              <strong>{{ memorySnapshot.activeLeafId ? memorySnapshot.activeLeafId.slice(-6) : 'root' }}</strong>
              <span>{{ memorySnapshot.messageCount }} 条消息</span>
            </div>
            <div class="snapshot-line">
              <span class="snapshot-label">世界书</span>
              <strong>{{ memorySnapshot.lorebook.versionLabel }}</strong>
              <span>{{ memorySnapshot.lorebook.entryCount }} 条条目</span>
            </div>
          </div>

          <div v-if="activePreview?.sourceLabel || activePreview?.targetEntryId" class="snapshot-card preview-context-card">
            <div class="snapshot-line" v-if="activePreview?.sourceLabel">
              <span class="snapshot-label">来源</span>
              <strong>{{ activePreview.sourceLabel }}</strong>
            </div>
            <div class="snapshot-line" v-if="activePreview?.targetEntryId">
              <span class="snapshot-label">条目</span>
              <strong>{{ activePreview.targetEntryId }}</strong>
            </div>
          </div>

          <div v-if="!(activePreview?.payload.length) && !isLoading" class="empty-state">
            当前没有可预览的 Prompt 内容
          </div>

          <template v-else>
            <div v-for="(msg, index) in activePreview?.payload || []" :key="index" class="prompt-msg" :class="msg.role">
              <div class="prompt-meta">
                <span class="role">{{ roleLabel(msg.role) }}</span>
                <span class="name" v-if="msg.name">{{ msg.name }}</span>
              </div>
              <pre class="prompt-text">{{ formatPromptText(msg.content) }}</pre>
            </div>
          </template>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CleanedMessage } from '../../types/nexus';
import type { MemorySnapshot } from '../../types/MemorySnapshotTypes';
import type { ForgePromptPreviewBundle } from '../../types/ForgePromptTypes';
import { useCardMakerStore } from './CardMakerStore';

const props = withDefaults(defineProps<{
    open?: boolean;
}>(), {
    open: false
});

defineEmits<{
    (e: 'close'): void;
}>();

const store = useCardMakerStore();
const isLoading = ref(false);
const error = ref('');
const previewBundle = ref<ForgePromptPreviewBundle | null>(null);
const memorySnapshot = ref<MemorySnapshot | null>(null);
const activeTab = ref<'primary' | 'executor'>('primary');
const activePreview = computed(() => previewBundle.value?.[activeTab.value] || null);

const roleLabel = (role: CleanedMessage['role']) => {
    if (role === 'system') return 'System';
    if (role === 'user') return 'User';
    return 'Assistant';
};

const formatPromptText = (content: string) => {
    if (!content) return '';
    return content
        .replace(/^\s*\n+/, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n\s*$/, '');
};

const refresh = async () => {
    if (!store.selectedPresetId || isLoading.value) return;

    isLoading.value = true;
    error.value = '';

    try {
        memorySnapshot.value = store.buildMemorySnapshot();
        previewBundle.value = await store.buildPromptPreviewPayload();
    } catch (err: any) {
        error.value = err?.message || 'Prompt 预览加载失败';
    } finally {
        isLoading.value = false;
    }
};

watch(
    () => props.open,
    async (isOpen) => {
        if (isOpen) {
            await refresh();
        }
    }
);

watch(
    () => store.selectedPresetId,
    async () => {
        if (props.open) {
            await refresh();
        }
    }
);
</script>

<style scoped>
.forge-prompt-preview {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 12px);
  width: min(100%, clamp(320px, 72vw, 720px));
  max-width: min(100%, calc(100vw - 40px));
  margin-inline: auto;
  z-index: 30;
}

.preview-panel {
  width: 100%;
  background: color-mix(in srgb, var(--lw-bg-surface) 97%, transparent);
  border: 1px solid var(--lw-border-base);
  border-radius: 24px;
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  backdrop-filter: blur(20px);
}

.preview-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 84%, transparent);
}

.preview-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.preview-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.preview-subtitle {
  font-size: 11px;
  color: var(--lw-text-muted);
  line-height: 1.5;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.payload-badge {
  font-size: 10px;
  font-weight: 800;
  color: var(--lw-primary);
  background: rgba(var(--lw-primary-rgb), 0.1);
  border-radius: 999px;
  padding: 5px 8px;
}

.refresh-btn,
.close-btn {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
  border-radius: 999px;
  padding: 6px 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn {
  width: 30px;
  height: 30px;
  padding: 0;
}

.refresh-btn:hover,
.close-btn:hover {
  background: var(--lw-bg-hover);
  border-color: var(--lw-border-hover);
  color: var(--lw-text-main);
}

.refresh-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.error-banner {
  margin: 12px 16px 0;
  padding: 9px 11px;
  border-radius: 12px;
  background: rgba(255, 115, 115, 0.1);
  border: 1px solid rgba(255, 115, 115, 0.18);
  color: #ffc0c0;
  font-size: 11px;
}

.preview-body {
  max-height: clamp(260px, 44dvh, 460px);
  overflow-y: auto;
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent);
  width: fit-content;
}

.tab-btn {
  border: none;
  background: transparent;
  color: var(--lw-text-muted);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tab-btn.active {
  background: rgba(var(--lw-primary-rgb), 0.12);
  color: var(--lw-primary);
}

.snapshot-card {
  padding: 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent);
  border: 1px solid var(--lw-border-base);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-context-card {
  gap: 10px;
}

.snapshot-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--lw-text-secondary);
}

.snapshot-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-primary);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.snapshot-line strong {
  color: var(--lw-text-main);
  font-size: 11px;
}

.empty-state {
  padding: 32px 12px;
  text-align: center;
  color: var(--lw-text-muted);
  font-size: 12px;
}

.prompt-msg {
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  overflow: clip;
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
}

.prompt-msg.system .prompt-meta {
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-primary);
}

.prompt-msg.user .prompt-meta {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
}

.prompt-msg.assistant .prompt-meta {
  background: rgba(var(--lw-primary-rgb), 0.08);
  color: var(--lw-primary);
}

.prompt-meta {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.name {
  opacity: 0.72;
}

.prompt-text {
  margin: 0;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.65;
  color: var(--lw-text-main);
  font-size: 12px;
  font-family: ui-monospace, Consolas, monospace;
}

.preview-panel-enter-active,
.preview-panel-leave-active {
  transition: all 0.22s ease;
}

.preview-panel-enter-from,
.preview-panel-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 960px) {
  .forge-prompt-preview {
    left: 0;
    right: 0;
    width: 100%;
    max-width: none;
  }

  .preview-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
