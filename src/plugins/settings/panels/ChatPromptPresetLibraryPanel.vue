<template>
  <SettingsSectionPanel class="prompt-preset-block" :class="{ 'is-expanded': expanded }" core>
    <div ref="rootRef" class="prompt-preset-library">
      <SettingsBlockHeader title="提示词预设库">
        <template #icon>
          <Library :size="18" :stroke-width="2" aria-hidden="true" />
        </template>
        <template #actions>
          <span v-if="saveState !== 'idle'" class="save-state" :data-state="saveState">
            {{ saveStateLabel }}
          </span>
          <LuminaIconButton ariaLabel="导入预设" title="导入 ST 预设 JSON" size="sm" @click="openImport">
            <Upload :size="14" :stroke-width="2" aria-hidden="true" />
          </LuminaIconButton>
          <LuminaIconButton ariaLabel="从默认新建" title="从默认新建" size="sm" @click="createFromDefault">
            <Plus :size="14" :stroke-width="2" aria-hidden="true" />
          </LuminaIconButton>
          <LuminaIconButton
            :ariaLabel="expanded ? '退出展开' : '展开编辑'"
            :title="expanded ? '退出展开' : '展开编辑'"
            size="sm"
            @click="expanded = !expanded"
          >
            <Minimize2 v-if="expanded" :size="14" :stroke-width="2" aria-hidden="true" />
            <Maximize2 v-else :size="14" :stroke-width="2" aria-hidden="true" />
          </LuminaIconButton>
        </template>
      </SettingsBlockHeader>

      <input ref="fileInput" class="tw:hidden" type="file" accept=".json,application/json" @change="handleImportFile" />

      <div v-if="loading" class="library-skeleton">
        <div v-for="index in 3" :key="index" class="skeleton-row" aria-hidden="true"></div>
      </div>

      <LuminaEmptyState
        v-else-if="presets.length === 0"
        title="还没有自定义预设"
        description="导入酒馆预设 JSON，或从内置默认复制一份开始。"
      >
        <template #action>
          <div class="tw:flex tw:gap-2">
            <LuminaButton variant="soft" size="sm" @click="openImport">导入预设</LuminaButton>
            <LuminaButton variant="soft" size="sm" @click="createFromDefault">从默认新建</LuminaButton>
          </div>
        </template>
      </LuminaEmptyState>

      <div v-else class="library-body" :data-view="isWide ? 'split' : view">
        <aside class="library-list" :aria-hidden="!isWide && view === 'detail' ? 'true' : undefined">
          <div class="list-search">
            <Search :size="14" :stroke-width="2" aria-hidden="true" />
            <input v-model="search" type="search" placeholder="搜索预设…" aria-label="搜索预设" />
          </div>
          <div class="list-scroll">
            <button
              v-for="preset in filteredPresets"
              :key="preset.id"
              type="button"
              class="preset-row"
              :class="{ 'is-selected': preset.id === selectedId }"
              @click="selectPreset(preset.id)"
            >
              <span class="preset-row-name">{{ preset.name }}</span>
              <span class="preset-row-meta">
                <span>{{ preset.promptCount }} 条</span>
                <span v-if="preset.id === activeId" class="active-badge">使用中</span>
              </span>
            </button>
            <p v-if="filteredPresets.length === 0" class="list-empty">没有匹配「{{ search }}」的预设。</p>
          </div>
        </aside>

        <section v-if="draft && selectedId" class="library-detail">
          <header class="detail-head">
            <button v-if="!isWide" type="button" class="back-button" @click="view = 'list'">
              <ChevronLeft :size="16" :stroke-width="2" aria-hidden="true" />
              列表
            </button>
            <input v-model="draft.name" class="detail-name" aria-label="预设名称" />
            <div class="detail-actions">
              <LuminaButton
                v-if="selectedId !== activeId"
                variant="soft"
                size="sm"
                @click="activatePreset(selectedId)"
              >启用</LuminaButton>
              <span v-else class="active-badge">使用中</span>
              <LuminaIconButton ariaLabel="复制预设" title="复制" size="sm" @click="duplicateSelected">
                <Copy :size="14" :stroke-width="2" aria-hidden="true" />
              </LuminaIconButton>
              <LuminaIconButton
                ariaLabel="删除预设"
                title="删除"
                size="sm"
                tone="danger"
                @click="requestDelete(selectedId, draft.name)"
              >
                <Trash2 :size="14" :stroke-width="2" aria-hidden="true" />
              </LuminaIconButton>
            </div>
          </header>

          <nav class="detail-tabs" aria-label="预设编辑分区">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              type="button"
              :class="{ 'is-active': activeTab === tab.value }"
              @click="activeTab = tab.value"
            >{{ tab.label }}</button>
          </nav>

          <div v-if="activeTab === 'structure'" class="tab-panel">
            <div class="structure-toolbar">
              <SettingsDescription>拖拽或使用箭头调整顺序；标记条目由角色卡、世界书或历史自动填充。</SettingsDescription>
              <LuminaButton variant="soft" size="sm" @click="addCustomPrompt">
                <Plus :size="14" :stroke-width="2" aria-hidden="true" />
                自定义提示词
              </LuminaButton>
            </div>
            <div class="prompt-rows">
              <div
                v-for="(item, index) in orderedPrompts"
                :key="item.order.identifier"
                class="prompt-row"
                :class="{ 'is-dragging': dragIndex === index, 'is-disabled': !item.order.enabled }"
                :draggable="true"
                tabindex="0"
                @dragstart="dragIndex = index"
                @dragover.prevent
                @drop="handleDrop(index)"
                @dragend="dragIndex = null"
                @keydown.alt.up.prevent="movePrompt(index, -1)"
                @keydown.alt.down.prevent="movePrompt(index, 1)"
              >
                <div class="prompt-row-main">
                  <span class="drag-handle" aria-hidden="true"><GripVertical :size="14" :stroke-width="2" /></span>
                  <LuminaToggle v-model="item.order.enabled" :disabled="false" />
                  <span class="prompt-name">{{ item.entry?.name || item.order.identifier }}</span>
                  <span class="prompt-badge" :data-role="item.entry?.role ?? 'system'">{{ roleLabel(item.entry?.role) }}</span>
                  <span v-if="item.entry?.marker" class="prompt-badge is-marker">自动填充</span>
                  <span v-else-if="item.entry?.injectionPosition === 1" class="prompt-badge">深度 {{ item.entry.injectionDepth }}</span>
                  <span class="prompt-row-spacer"></span>
                  <LuminaIconButton
                    :ariaLabel="expandedPromptId === item.order.identifier ? '收起' : '展开'"
                    :title="expandedPromptId === item.order.identifier ? '收起' : '编辑'"
                    size="sm"
                    @click="togglePromptEditor(item.order.identifier)"
                  >
                    <ChevronDown
                      v-if="expandedPromptId === item.order.identifier"
                      :size="14"
                      :stroke-width="2"
                      aria-hidden="true"
                    />
                    <ChevronUp v-else :size="14" :stroke-width="2" aria-hidden="true" />
                  </LuminaIconButton>
                  <LuminaIconButton ariaLabel="上移" title="上移 (Alt+↑)" size="sm" :disabled="index === 0" @click="movePrompt(index, -1)">
                    <ArrowUp :size="14" :stroke-width="2" aria-hidden="true" />
                  </LuminaIconButton>
                  <LuminaIconButton
                    ariaLabel="下移"
                    title="下移 (Alt+↓)"
                    size="sm"
                    :disabled="index === orderedPrompts.length - 1"
                    @click="movePrompt(index, 1)"
                  >
                    <ArrowDown :size="14" :stroke-width="2" aria-hidden="true" />
                  </LuminaIconButton>
                  <LuminaIconButton
                    v-if="!item.entry?.marker"
                    ariaLabel="删除提示词"
                    title="删除"
                    size="sm"
                    tone="danger"
                    @click="removeCustomPrompt(item.order.identifier)"
                  >
                    <Trash2 :size="14" :stroke-width="2" aria-hidden="true" />
                  </LuminaIconButton>
                </div>

                <div v-if="expandedPromptId === item.order.identifier && item.entry" class="prompt-editor">
                  <template v-if="!item.entry.marker">
                    <div class="editor-grid">
                      <label class="field">
                        <span>名称</span>
                        <input :value="item.entry.name" @input="updateEntry(item.order.identifier, { name: inputValue($event) })" />
                      </label>
                      <label class="field">
                        <span>角色</span>
                        <select :value="item.entry.role" @change="updateEntry(item.order.identifier, { role: roleValue($event) })">
                          <option value="system">system</option>
                          <option value="user">user</option>
                          <option value="assistant">assistant</option>
                        </select>
                      </label>
                      <label class="field">
                        <span>插入位置</span>
                        <select
                          :value="String(item.entry.injectionPosition)"
                          @change="updateEntry(item.order.identifier, { injectionPosition: positionValue($event) })"
                        >
                          <option value="0">相对位置</option>
                          <option value="1">绝对深度</option>
                        </select>
                      </label>
                      <label v-if="item.entry.injectionPosition === 1" class="field">
                        <span>深度</span>
                        <input
                          type="number"
                          min="0"
                          :value="item.entry.injectionDepth"
                          @input="updateEntry(item.order.identifier, { injectionDepth: numberValue($event) })"
                        />
                      </label>
                      <label class="field">
                        <span>顺序权重</span>
                        <input
                          type="number"
                          :value="item.entry.injectionOrder"
                          @input="updateEntry(item.order.identifier, { injectionOrder: numberValue($event) })"
                        />
                      </label>
                    </div>
                    <textarea
                      class="prompt-content"
                      rows="5"
                      :value="item.entry.content"
                      placeholder="提示词内容，支持 {{char}}、{{user}} 等宏"
                      @input="updateEntry(item.order.identifier, { content: inputValue($event) })"
                    ></textarea>
                  </template>
                  <p v-else class="marker-note">
                    该条目为预设标记，内容由角色卡、世界书或对话历史在生成时填充。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'sampling'" class="tab-panel">
            <div class="number-grid">
              <label v-for="field in samplingFields" :key="field.key" class="field">
                <span>{{ field.label }}</span>
                <input
                  type="number"
                  :step="field.step"
                  :min="field.min"
                  :value="draft.sampling[field.key]"
                  @input="draft.sampling[field.key] = numberValue($event)"
                />
              </label>
            </div>
          </div>

          <div v-else-if="activeTab === 'advanced'" class="tab-panel">
            <div class="editor-grid">
              <label class="field">
                <span>名字行为</span>
                <select :value="String(draft.behavior.namesBehavior)" @change="draft.behavior.namesBehavior = namesBehaviorValue($event)">
                  <option value="0">默认</option>
                  <option value="1">从不附加名字</option>
                  <option value="2">总是附加名字</option>
                </select>
              </label>
              <label class="field field-toggle">
                <span>消息加引号</span>
                <LuminaToggle v-model="draft.behavior.wrapInQuotes" />
              </label>
              <label class="field field-toggle">
                <span>Assistant 冒充</span>
                <LuminaToggle v-model="draft.behavior.assistantImpersonation" />
              </label>
            </div>
            <label class="field">
              <span>空输入提示词</span>
              <input :value="draft.behavior.sendIfEmpty" @input="draft.behavior.sendIfEmpty = inputValue($event)" />
            </label>
            <label class="field">
              <span>Assistant 前缀</span>
              <input
                :value="draft.behavior.assistantPrefill"
                placeholder="生成前预填的 assistant 内容"
                @input="draft.behavior.assistantPrefill = inputValue($event)"
              />
            </label>
          </div>

          <div v-else class="tab-panel">
            <SettingsDescription>高级逃生门：直接编辑 ST 兼容 JSON，应用后覆盖表单字段。</SettingsDescription>
            <textarea v-model="jsonText" class="json-editor" rows="16" spellcheck="false"></textarea>
            <p v-if="jsonError" class="json-error">{{ jsonError }}</p>
            <div class="json-actions">
              <LuminaButton variant="soft" size="sm" @click="formatJson">格式化</LuminaButton>
              <LuminaButton variant="soft" size="sm" tone="primary" @click="applyJson">应用到表单</LuminaButton>
            </div>
          </div>
        </section>
      </div>
    </div>
  </SettingsSectionPanel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Library,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Trash2,
  Upload
} from 'lucide-vue-next';
import { SettingsBlockHeader, SettingsDescription, SettingsSectionPanel } from '../components';
import {
  LuminaButton,
  LuminaEmptyState,
  LuminaIconButton,
  LuminaToggle
} from '../../../ui/primitives';
import { useModalStore } from '../../../stores/useModalStore.js';
import {
  chatPromptPresetLibraryService,
  type ChatPromptPresetListEntry
} from '../../../api/core/hal/prompt/chat/ChatPromptPresetLibraryService.js';
import {
  parseChatCompletionPreset,
  serializeChatCompletionPreset
} from '../../../api/core/hal/prompt/chat/ChatCompletionPresetParser.js';
import {
  DEFAULT_CHAT_COMPLETION_ENTRY,
  ST_DEFAULT_CHARACTER_ID,
  type ChatCompletionNamesBehavior,
  type ChatCompletionPreset,
  type ChatCompletionPresetEntry,
  type ChatCompletionPromptRole
} from '../../../types/ChatCompletionPresetTypes.js';

type ToastKind = 'success' | 'warning' | 'error' | 'info';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LuminaToastHost {
  LuminaWeave?: {
    showToast?: (message: string, kind?: ToastKind) => void;
  };
}

const modal = useModalStore();
const rootRef = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const presets = ref<ChatPromptPresetListEntry[]>([]);
const activeId = ref('');
const selectedId = ref('');
const draft = ref<ChatCompletionPreset | null>(null);
const loading = ref(true);
const search = ref('');
const view = ref<'list' | 'detail'>('list');
const expanded = ref(false);
const isWide = ref(false);
const activeTab = ref<'structure' | 'sampling' | 'advanced' | 'json'>('structure');
const expandedPromptId = ref<string | null>(null);
const jsonText = ref('');
const jsonError = ref('');
const saveState = ref<SaveState>('idle');
const dragIndex = ref<number | null>(null);

let saveTimer: number | null = null;
let suppressSave = false;
let resizeObserver: ResizeObserver | null = null;

const tabs = [
  { value: 'structure' as const, label: '结构' },
  { value: 'sampling' as const, label: '采样' },
  { value: 'advanced' as const, label: '高级' },
  { value: 'json' as const, label: 'JSON' }
];

const samplingFields = [
  { key: 'temperature' as const, label: 'Temperature', step: 0.05, min: 0 },
  { key: 'topP' as const, label: 'Top P', step: 0.01, min: 0 },
  { key: 'topK' as const, label: 'Top K', step: 1, min: 0 },
  { key: 'minP' as const, label: 'Min P', step: 0.01, min: 0 },
  { key: 'frequencyPenalty' as const, label: 'Frequency Penalty', step: 0.1, min: -2 },
  { key: 'presencePenalty' as const, label: 'Presence Penalty', step: 0.1, min: -2 },
  { key: 'repetitionPenalty' as const, label: 'Repetition Penalty', step: 0.05, min: 0 },
  { key: 'maxTokens' as const, label: 'Max Tokens', step: 1, min: 0 }
];

const saveStateLabel = computed(() => {
  if (saveState.value === 'saving') return '保存中…';
  if (saveState.value === 'saved') return '已保存';
  if (saveState.value === 'error') return '保存失败';
  return '';
});

const filteredPresets = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return presets.value;
  return presets.value.filter(preset => preset.name.toLowerCase().includes(keyword));
});

const primaryGroup = computed(() => {
  const preset = draft.value;
  if (!preset) return null;
  return preset.promptOrder.find(group => group.characterId === ST_DEFAULT_CHARACTER_ID)
    ?? preset.promptOrder[0]
    ?? null;
});

const orderedPrompts = computed(() => {
  const preset = draft.value;
  const group = primaryGroup.value;
  if (!preset || !group) return [];
  return group.order.map(item => ({
    order: item,
    entry: preset.prompts.find(entry => entry.identifier === item.identifier) ?? null
  }));
});

const showToast = (message: string, kind: ToastKind = 'info'): void => {
  (window as LuminaToastHost).LuminaWeave?.showToast?.(message, kind);
};

const inputValue = (event: Event): string => (event.target as HTMLInputElement | HTMLTextAreaElement).value;
const numberValue = (event: Event): number => {
  const parsed = Number((event.target as HTMLInputElement).value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const roleValue = (event: Event): ChatCompletionPromptRole => {
  const value = (event.target as HTMLSelectElement).value;
  return value === 'user' || value === 'assistant' ? value : 'system';
};
const positionValue = (event: Event): 0 | 1 => (event.target as HTMLSelectElement).value === '1' ? 1 : 0;
const namesBehaviorValue = (event: Event): ChatCompletionNamesBehavior => {
  const value = Number((event.target as HTMLSelectElement).value);
  return value === 1 || value === 2 ? value : 0;
};
const roleLabel = (role: ChatCompletionPromptRole | undefined): string => role ?? 'system';

const refresh = async (): Promise<void> => {
  loading.value = true;
  try {
    presets.value = await chatPromptPresetLibraryService.list();
    activeId.value = chatPromptPresetLibraryService.getActiveId();
  } catch (error) {
    console.warn('[ChatPromptPresetLibraryPanel] 读取预设库失败', error);
  } finally {
    loading.value = false;
  }
};

const selectPreset = async (id: string): Promise<void> => {
  suppressSave = true;
  const result = await chatPromptPresetLibraryService.load(id);
  draft.value = result.preset;
  selectedId.value = id;
  expandedPromptId.value = null;
  jsonError.value = '';
  saveState.value = 'idle';
  suppressSave = false;
  if (!result.preset) {
    showToast(result.diagnostics[0]?.message ?? '预设读取失败', 'error');
    return;
  }
  view.value = 'detail';
};

const activatePreset = (id: string): void => {
  chatPromptPresetLibraryService.setActive(id);
  activeId.value = id;
  showToast('已启用该预设', 'success');
};

const openImport = (): void => fileInput.value?.click();

const handleImportFile = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const raw: unknown = JSON.parse(await file.text());
    const result = await chatPromptPresetLibraryService.importFromRaw(raw, file.name.replace(/\.json$/i, ''));
    if (!result.document) {
      showToast(result.diagnostics[0]?.message ?? '导入失败', 'error');
      return;
    }
    await refresh();
    await selectPreset(result.document.ref.resourceId);
    showToast('预设已导入', 'success');
  } catch (error) {
    console.warn('[ChatPromptPresetLibraryPanel] 导入失败', error);
    showToast('JSON 解析失败，请检查文件格式。', 'error');
  }
};

const createFromDefault = async (): Promise<void> => {
  try {
    const document = await chatPromptPresetLibraryService.createFromDefault();
    await refresh();
    await selectPreset(document.ref.resourceId);
    showToast('已从默认预设创建', 'success');
  } catch (error) {
    console.warn('[ChatPromptPresetLibraryPanel] 创建默认预设失败', error);
    showToast('创建失败', 'error');
  }
};

const duplicateSelected = async (): Promise<void> => {
  if (!selectedId.value) return;
  const document = await chatPromptPresetLibraryService.duplicate(selectedId.value);
  if (!document) {
    showToast('复制失败', 'error');
    return;
  }
  await refresh();
  await selectPreset(document.ref.resourceId);
  showToast('已复制预设', 'success');
};

const requestDelete = async (id: string, name: string): Promise<void> => {
  const confirmed = await modal.confirm({
    title: '删除预设',
    message: `删除「${name}」？此操作不可撤销。`,
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;
  const removed = await chatPromptPresetLibraryService.remove(id);
  if (!removed) {
    showToast('删除失败', 'error');
    return;
  }
  if (selectedId.value === id) {
    draft.value = null;
    selectedId.value = '';
    view.value = 'list';
  }
  await refresh();
  showToast('预设已删除', 'success');
};

const movePrompt = (index: number, delta: number): void => {
  const group = primaryGroup.value;
  if (!group) return;
  const target = index + delta;
  if (target < 0 || target >= group.order.length) return;
  const [item] = group.order.splice(index, 1);
  group.order.splice(target, 0, item);
};

const handleDrop = (index: number): void => {
  const from = dragIndex.value;
  dragIndex.value = null;
  if (from === null || from === index) return;
  movePrompt(from, index - from);
};

const togglePromptEditor = (identifier: string): void => {
  expandedPromptId.value = expandedPromptId.value === identifier ? null : identifier;
};

const updateEntry = (identifier: string, patch: Partial<ChatCompletionPresetEntry>): void => {
  const preset = draft.value;
  if (!preset) return;
  const index = preset.prompts.findIndex(entry => entry.identifier === identifier);
  if (index < 0) return;
  preset.prompts[index] = { ...preset.prompts[index], ...patch };
};

const addCustomPrompt = (): void => {
  const preset = draft.value;
  const group = primaryGroup.value;
  if (!preset || !group) return;
  const identifier = `custom-${Date.now().toString(36)}`;
  preset.prompts.push({
    ...DEFAULT_CHAT_COMPLETION_ENTRY,
    identifier,
    name: '自定义提示词',
    content: '',
    role: 'system'
  });
  group.order.push({ identifier, enabled: true });
  expandedPromptId.value = identifier;
};

const removeCustomPrompt = (identifier: string): void => {
  const preset = draft.value;
  const group = primaryGroup.value;
  if (!preset || !group) return;
  preset.prompts = preset.prompts.filter(entry => entry.identifier !== identifier);
  const index = group.order.findIndex(item => item.identifier === identifier);
  if (index >= 0) group.order.splice(index, 1);
  if (expandedPromptId.value === identifier) expandedPromptId.value = null;
};

const formatJson = (): void => {
  try {
    jsonText.value = JSON.stringify(JSON.parse(jsonText.value), null, 4);
    jsonError.value = '';
  } catch (error) {
    jsonError.value = error instanceof Error ? error.message : String(error);
  }
};

const scheduleSave = (): void => {
  if (!draft.value || !selectedId.value) return;
  const targetId = selectedId.value;
  const snapshot = draft.value;
  saveState.value = 'saving';
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    saveTimer = null;
    try {
      await chatPromptPresetLibraryService.save(targetId, snapshot);
      saveState.value = 'saved';
      presets.value = await chatPromptPresetLibraryService.list();
    } catch (error) {
      console.warn('[ChatPromptPresetLibraryPanel] 保存失败', error);
      saveState.value = 'error';
    }
  }, 500);
};

const applyJson = (): void => {
  try {
    const raw: unknown = JSON.parse(jsonText.value);
    const parsed = parseChatCompletionPreset(raw);
    if (!parsed.preset) {
      jsonError.value = parsed.diagnostics.find(item => item.level === 'error')?.message ?? '解析失败';
      return;
    }
    suppressSave = true;
    draft.value = parsed.preset;
    suppressSave = false;
    jsonError.value = '';
    scheduleSave();
    showToast('已应用到表单', 'success');
  } catch (error) {
    jsonError.value = error instanceof Error ? error.message : String(error);
  }
};

watch(activeTab, (tab) => {
  if (tab === 'json' && draft.value) {
    jsonText.value = JSON.stringify(serializeChatCompletionPreset(draft.value), null, 4);
    jsonError.value = '';
  }
});

watch(draft, () => {
  if (suppressSave) return;
  scheduleSave();
}, { deep: true });

onMounted(async () => {
  await refresh();
  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      isWide.value = width >= 840;
    });
    resizeObserver.observe(rootRef.value);
  }
  if (activeId.value) {
    await selectPreset(activeId.value);
  } else if (presets.value.length > 0) {
    await selectPreset(presets.value[0].id);
  }
});

onBeforeUnmount(() => {
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.prompt-preset-block.is-expanded {
  position: fixed;
  inset: 12px;
  z-index: 400;
  overflow: auto;
  border-radius: var(--lw-radius-md, 14px);
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

.save-state {
  font-size: var(--lw-type-label-small-size, 11px);
  color: var(--lw-text-muted);
}

.save-state[data-state='error'] {
  color: var(--lw-danger, #b91c1c);
}

.library-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
}

.skeleton-row {
  height: 44px;
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-subtle);
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.library-body {
  display: grid;
  gap: 12px;
  padding-top: 12px;
}

.library-body[data-view='split'] {
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
}

.library-list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-subtle);
  padding: 10px;
}

.library-body[data-view='detail'] .library-list {
  display: none;
}

.library-body[data-view='list'] .library-detail {
  display: none;
}

.list-search {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-elevated);
  padding: 0 8px;
  color: var(--lw-text-muted);
}

.list-search input {
  width: 100%;
  min-height: 30px;
  border: 0;
  background: transparent;
  color: var(--lw-text-main);
  font: inherit;
  font-size: var(--lw-type-label-small-size, 12px);
  outline: none;
}

.list-scroll {
  display: flex;
  max-height: 420px;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
}

.preset-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid transparent;
  border-radius: var(--lw-radius-xs, 8px);
  background: transparent;
  padding: 7px 9px;
  text-align: left;
  cursor: pointer;
}

.preset-row:hover {
  background: var(--lw-bg-hover, var(--lw-bg-elevated));
}

.preset-row.is-selected {
  border-color: var(--lw-primary);
  background: var(--lw-bg-elevated);
}

.preset-row-name {
  font-size: var(--lw-type-label-size, 13px);
  font-weight: 600;
  color: var(--lw-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-row-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--lw-type-label-small-size, 11px);
  color: var(--lw-text-muted);
}

.active-badge {
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-primary) 14%, transparent);
  color: var(--lw-primary-strong, var(--lw-primary));
  padding: 1px 7px;
  font-size: var(--lw-type-label-small-size, 11px);
  font-weight: 600;
}

.list-empty {
  margin: 4px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size, 12px);
}

.library-detail {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 0;
  background: transparent;
  color: var(--lw-text-secondary);
  font: inherit;
  font-size: var(--lw-type-label-small-size, 12px);
  cursor: pointer;
}

.detail-name {
  min-width: 0;
  flex: 1;
  border: 1px solid transparent;
  border-radius: var(--lw-radius-sm);
  background: transparent;
  color: var(--lw-text-main);
  font: inherit;
  font-size: var(--lw-type-title-small-size, 15px);
  font-weight: 650;
  padding: 5px 8px;
  outline: none;
}

.detail-name:hover,
.detail-name:focus {
  border-color: var(--lw-border-base);
  background: var(--lw-bg-elevated);
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--lw-border-base);
}

.detail-tabs button {
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--lw-text-secondary);
  font: inherit;
  font-size: var(--lw-type-label-size, 13px);
  padding: 6px 10px;
  cursor: pointer;
}

.detail-tabs button.is-active {
  border-bottom-color: var(--lw-primary);
  color: var(--lw-text-main);
  font-weight: 600;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.structure-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.prompt-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.prompt-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-elevated);
  padding: 7px 9px;
}

.prompt-row.is-dragging {
  border-style: dashed;
  border-color: var(--lw-primary);
}

.prompt-row.is-disabled .prompt-name,
.prompt-row.is-disabled .prompt-badge {
  opacity: 0.55;
}

.prompt-row-main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.drag-handle {
  display: inline-flex;
  color: var(--lw-text-muted);
  cursor: grab;
}

.prompt-name {
  min-width: 0;
  max-width: 32%;
  overflow: hidden;
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-size, 13px);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-badge {
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-muted);
  padding: 1px 7px;
  font-size: var(--lw-type-label-small-size, 11px);
}

.prompt-badge.is-marker {
  background: color-mix(in srgb, var(--lw-primary) 12%, transparent);
  color: var(--lw-primary-strong, var(--lw-primary));
}

.prompt-row-spacer {
  flex: 1;
}

.prompt-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px dashed var(--lw-border-base);
  padding-top: 8px;
}

.editor-grid,
.number-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: 8px;
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.field > span {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size, 11px);
}

.field input,
.field select,
.prompt-content,
.json-editor {
  width: 100%;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-main);
  font: inherit;
  font-size: var(--lw-type-body-small-size, 12px);
  padding: 6px 8px;
  outline: none;
}

.field input:focus,
.field select:focus,
.prompt-content:focus,
.json-editor:focus {
  border-color: var(--lw-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--lw-primary) 12%, transparent);
}

.field-toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.prompt-content,
.json-editor {
  font-family: var(--lw-font-main);
  line-height: 1.5;
  resize: vertical;
}

.json-editor {
  font-family: var(--lw-font-mono);
  font-size: 12px;
}

.marker-note {
  margin: 0;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size, 12px);
}

.json-error {
  margin: 0;
  color: var(--lw-danger, #b91c1c);
  font-size: var(--lw-type-label-small-size, 12px);
}

.json-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
