<template>
  <div class="ftc-root">
    <!-- 工具栏 -->
    <div class="ftc-toolbar">
      <div class="ftc-toolbar-left">
        <span class="ftc-title">测试聊天</span>
        <span class="ftc-subtitle">
          {{ entryCount > 0 ? `已加载 ${entryCount} 个虚拟世界书条目` : '虚拟世界书为空' }}
        </span>
      </div>
      <div class="ftc-toolbar-right">
        <!-- 预设切换下拉 -->
        <select
          v-if="service.presets.length > 0"
          class="ftc-preset-select"
          :disabled="service.isStreaming"
          :value="service.activePresetId"
          @change="onPresetChange"
        >
          <option v-for="preset in service.presets" :key="preset.id" :value="preset.id">
            {{ preset.name }}
          </option>
        </select>
        <!-- 清空按钮 -->
        <button
          v-if="service.messages.length > 0"
          class="ftc-clear-btn"
          type="button"
          :disabled="service.isStreaming"
          @click="service.clearMessages()"
          title="清空对话"
        >
          清空
        </button>
      </div>
    </div>

    <section class="ftc-resource-panel">
      <div class="ftc-resource-head">
        <div>
          <span class="ftc-resource-title">资源绑定</span>
          <span class="ftc-resource-subtitle">
            {{ boundRefs.length > 0 ? `${boundRefs.length} 个资源将参与 Lumina 自合成` : '当前只使用虚拟世界书与预设内容' }}
          </span>
        </div>
        <button class="ftc-small-btn" type="button" :disabled="resourceLoading" @click="refreshResourcePanel">
          {{ resourceLoading ? '读取中' : '刷新' }}
        </button>
      </div>

      <div class="ftc-resource-controls">
        <label class="ftc-toggle">
          <input
            type="checkbox"
            :checked="worldbookEnabled"
            :disabled="service.isStreaming"
            @change="setWorldbookEnabledFromEvent"
          />
          <span>启用绑定世界书</span>
        </label>
        <span class="ftc-resource-note">关闭后，仅被标记为“强制包含”的世界书会继续参与。</span>
      </div>

      <div v-if="boundResources.length" class="ftc-bound-list">
        <div v-for="item in boundResources" :key="resourceRefKey(item.ref)" class="ftc-bound-item">
          <div class="ftc-bound-main">
            <span class="ftc-resource-type">{{ resourceTypeLabel(item.ref.resourceType) }}</span>
            <strong>{{ item.name }}</strong>
            <span>{{ item.ref.sourceId }} · {{ item.ref.path }}</span>
          </div>
          <div class="ftc-bound-actions">
            <select
              v-if="item.ref.resourceType === 'worldbook'"
              class="ftc-mode-select"
              :value="worldbookSelectionMode(item.ref)"
              :disabled="service.isStreaming"
              @change="setWorldbookSelectionMode(item.ref, $event)"
            >
              <option value="default">跟随总开关</option>
              <option value="include">强制包含</option>
              <option value="exclude">排除</option>
            </select>
            <button class="ftc-small-btn danger" type="button" :disabled="service.isStreaming" @click="removeResourceBinding(item.ref)">
              移除
            </button>
          </div>
        </div>
      </div>

      <div class="ftc-resource-picker">
        <div class="ftc-resource-column">
          <div class="ftc-picker-title">角色卡</div>
          <button
            v-for="doc in availableCharacters"
            :key="resourceRefKey(doc.ref)"
            class="ftc-picker-row"
            type="button"
            :disabled="isBound(doc.ref) || service.isStreaming"
            @click="addResourceBinding(doc.ref)"
          >
            <span>{{ doc.summary.name }}</span>
            <small>{{ doc.ref.sourceId }}</small>
          </button>
          <div v-if="!availableCharacters.length" class="ftc-resource-empty">暂无可用角色卡</div>
        </div>

        <div class="ftc-resource-column">
          <div class="ftc-picker-title">世界书</div>
          <button
            v-for="doc in availableWorldbooks"
            :key="resourceRefKey(doc.ref)"
            class="ftc-picker-row"
            type="button"
            :disabled="isBound(doc.ref) || service.isStreaming"
            @click="addResourceBinding(doc.ref)"
          >
            <span>{{ doc.summary.name }}</span>
            <small>{{ doc.ref.sourceId }} · {{ doc.summary.entryCount ?? 0 }} 条</small>
          </button>
          <div v-if="!availableWorldbooks.length" class="ftc-resource-empty">暂无可用世界书</div>
        </div>
      </div>
    </section>

    <!-- 聊天视图 -->
    <SimpleChatView
      :messages="service.messages"
      :is-streaming="service.isStreaming"
      :render-markdown="renderMarkdown"
      @send="service.sendMessage($event)"
      @abort="service.abort()"
    >
      <template #empty>
        <div class="ftc-empty-icon">💬</div>
        <p>在此体验当前虚拟世界书效果</p>
        <p class="ftc-empty-hint">
          {{ entryCount > 0
            ? `当前已有 ${entryCount} 个条目作为世界背景`
            : '前往「世界书」面板添加虚拟条目后再来测试' }}
        </p>
      </template>
    </SimpleChatView>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useCardMakerStore } from '../CardMakerStore.js';
import SimpleChatView from '../../chat/components/SimpleChatView.vue';
import {
    PromptResourceBindingService,
    promptResourceBindingService,
    resourceService
} from '../../../api/core/hal/resource/index.js';
import type {
    ResourceDocument,
    ResourceRef
} from '../../../../shared/resources/index.js';

const store = useCardMakerStore();
const service = store.testChatService;
const resourceDocs = ref<ResourceDocument[]>([]);
const resourceLoading = ref(false);
const bindingResolution = ref(promptResourceBindingService.resolveBindings(
    PromptResourceBindingService.forgeWorkspaceOwner(store.workspaceSessionId || store.sessionChatId)
));

const entryCount = computed(
    () => store.virtualLorebookEntries.filter(e => !e.entry.disable).length
);
const workspaceOwner = computed(() =>
    PromptResourceBindingService.forgeWorkspaceOwner(store.workspaceSessionId || store.sessionChatId)
);
const boundRefs = computed(() => bindingResolution.value.refs);
const boundResources = computed(() => boundRefs.value.map(ref => ({
    ref,
    name: resourceDocs.value.find(doc => resourceRefKey(doc.ref) === resourceRefKey(ref))?.summary.name || ref.resourceId
})));
const availableCharacters = computed(() => resourceDocs.value.filter(doc => doc.ref.resourceType === 'character'));
const availableWorldbooks = computed(() => resourceDocs.value.filter(doc => doc.ref.resourceType === 'worldbook'));
const worldbookEnabled = computed(() => bindingResolution.value.sourceSelection?.worldbook?.enabled !== false);

const onPresetChange = (event: Event) => {
    const select = event.target as HTMLSelectElement;
    service.setActivePreset(select.value);
};

const refreshBindings = () => {
    bindingResolution.value = promptResourceBindingService.resolveBindings(workspaceOwner.value);
};

const refreshResourcePanel = async () => {
    resourceLoading.value = true;
    try {
        const [characters, worldbooks] = await Promise.all([
            resourceService.listResources({ resourceType: 'character' }),
            resourceService.listResources({ resourceType: 'worldbook' })
        ]);
        resourceDocs.value = [...characters, ...worldbooks];
        refreshBindings();
    } finally {
        resourceLoading.value = false;
    }
};

const resourceRefKey = (ref: ResourceRef): string => `${ref.sourceId}:${ref.resourceType}:${ref.resourceId}`;

const isBound = (ref: ResourceRef): boolean => boundRefs.value.some(item => resourceRefKey(item) === resourceRefKey(ref));

const addResourceBinding = (ref: ResourceRef) => {
    promptResourceBindingService.addBinding(workspaceOwner.value, ref);
    refreshBindings();
};

const removeResourceBinding = (ref: ResourceRef) => {
    promptResourceBindingService.removeBinding(workspaceOwner.value, {
        sourceId: ref.sourceId,
        resourceType: ref.resourceType,
        resourceId: ref.resourceId
    });
    if (ref.resourceType === 'worldbook') {
        promptResourceBindingService.clearWorldbookRefSelection(workspaceOwner.value, ref);
    }
    refreshBindings();
};

const setWorldbookEnabledFromEvent = (event: Event) => {
    promptResourceBindingService.setWorldbookEnabled(workspaceOwner.value, (event.target as HTMLInputElement).checked);
    refreshBindings();
};

const worldbookSelectionMode = (ref: ResourceRef): 'default' | 'include' | 'exclude' => {
    const selection = bindingResolution.value.sourceSelection?.worldbook;
    if (selection?.includedRefs?.some(item => resourceRefKey(item) === resourceRefKey(ref))) return 'include';
    if (selection?.excludedRefs?.some(item => resourceRefKey(item) === resourceRefKey(ref))) return 'exclude';
    return 'default';
};

const setWorldbookSelectionMode = (ref: ResourceRef, event: Event) => {
    const mode = (event.target as HTMLSelectElement).value;
    if (mode === 'include') {
        promptResourceBindingService.includeWorldbook(workspaceOwner.value, ref);
    } else if (mode === 'exclude') {
        promptResourceBindingService.excludeWorldbook(workspaceOwner.value, ref);
    } else {
        promptResourceBindingService.clearWorldbookRefSelection(workspaceOwner.value, ref);
    }
    refreshBindings();
};

const resourceTypeLabel = (type: ResourceRef['resourceType']): string => {
    const labels: Record<ResourceRef['resourceType'], string> = {
        character: '角色',
        worldbook: '世界书',
        preset: '预设',
        regex: '正则',
        memory: '记忆'
    };
    return labels[type] ?? type;
};

watch(
    () => store.workspaceSessionId || store.sessionChatId,
    () => refreshBindings()
);

onMounted(() => {
    void refreshResourcePanel();
});

const renderMarkdown = (text: string): string => {
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
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`;
        })
        .join('');
};
</script>

<style scoped>
.ftc-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.ftc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px 8px;
  border-bottom: 1px solid var(--lw-border-base);
  flex-shrink: 0;
}

.ftc-toolbar-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ftc-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ftc-title {
  font-size: var(--lw-type-body-medium-size);
  font-weight: var(--lw-type-label-medium-weight);
  color: var(--lw-text-main);
}

.ftc-subtitle {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.ftc-preset-select {
  font-size: var(--lw-type-body-small-size);
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  cursor: pointer;
  max-width: 120px;
}

.ftc-preset-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ftc-clear-btn {
  font-size: var(--lw-type-body-small-size);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--lw-border-base);
  background: transparent;
  color: var(--lw-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms, color 120ms;
}

.ftc-clear-btn:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.ftc-resource-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent);
  flex-shrink: 0;
}

.ftc-resource-head,
.ftc-resource-controls,
.ftc-bound-item,
.ftc-bound-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ftc-resource-head,
.ftc-bound-item {
  justify-content: space-between;
}

.ftc-resource-title,
.ftc-picker-title {
  display: block;
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-label-medium-weight);
}

.ftc-resource-subtitle,
.ftc-resource-note,
.ftc-resource-empty,
.ftc-bound-main span,
.ftc-picker-row small {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.ftc-resource-controls {
  flex-wrap: wrap;
}

.ftc-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  cursor: pointer;
}

.ftc-toggle input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--lw-primary);
}

.ftc-bound-list,
.ftc-resource-picker,
.ftc-resource-column {
  display: grid;
  gap: 8px;
}

.ftc-bound-item {
  padding: 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: 8px;
  background: var(--lw-bg-app);
}

.ftc-bound-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.ftc-bound-main strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
  overflow-wrap: anywhere;
}

.ftc-resource-type {
  width: fit-content;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary) !important;
  font-weight: var(--lw-type-label-medium-weight);
}

.ftc-mode-select {
  max-width: 108px;
  padding: 4px 6px;
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-small-size);
}

.ftc-resource-picker {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ftc-resource-column {
  align-content: start;
  padding: 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: 8px;
  background: color-mix(in srgb, var(--lw-bg-app) 76%, transparent);
  min-width: 0;
}

.ftc-picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  text-align: left;
  cursor: pointer;
}

.ftc-picker-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ftc-picker-row:hover:not(:disabled),
.ftc-small-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--lw-primary) 28%, var(--lw-border-base));
  background: color-mix(in srgb, var(--lw-primary) 8%, var(--lw-bg-elevated));
  color: var(--lw-text-main);
}

.ftc-picker-row:disabled {
  opacity: 0.54;
  cursor: not-allowed;
}

.ftc-small-btn {
  padding: 4px 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  background: var(--lw-bg-app);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  cursor: pointer;
}

.ftc-small-btn.danger {
  color: #dc2626;
}

.ftc-empty-icon {
  font-size: var(--lw-type-headline-large-size);
  margin-bottom: 4px;
}

.ftc-empty-hint {
  font-size: var(--lw-type-body-small-size) !important;
  color: var(--lw-text-muted) !important;
}

@media (max-width: 760px) {
  .ftc-resource-picker {
    grid-template-columns: 1fr;
  }

  .ftc-bound-item,
  .ftc-resource-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .ftc-bound-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
