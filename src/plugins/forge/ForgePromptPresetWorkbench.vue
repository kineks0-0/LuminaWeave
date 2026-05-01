<template>
  <div class="prompt-preset-workbench">
    <div class="workbench-head">
      <div>
        <div class="workbench-title">Prompt 预设工作台</div>
        <div class="workbench-subtitle">管理 Forge 主模型、执行模型和测试聊天的预设提示词组合。</div>
      </div>
      <div class="workbench-actions">
        <button class="head-btn" type="button" @click="createPresetFromCurrent">新建</button>
        <button class="head-btn" type="button" @click="duplicateCurrentPreset">复制</button>
        <button class="head-btn" type="button" @click="restoreDefaultPreset">恢复默认</button>
      </div>
    </div>

    <div class="profile-tabs">
      <button
        v-for="profile in profiles"
        :key="profile.id"
        type="button"
        class="profile-tab"
        :class="{ active: activeProfileId === profile.id }"
        @click="switchProfile(profile.id)"
      >
        {{ profile.label }}
      </button>
    </div>

    <div class="preset-toolbar">
      <select class="preset-select" :value="activePresetId" @change="onPresetChange">
        <option v-for="preset in presets" :key="preset.id" :value="preset.id">
          {{ preset.name }}
        </option>
      </select>
      <span class="preset-engine">{{ draft.engine === 'st_preset' ? 'ST 预设直通' : '组合预设' }}</span>
      <span class="preset-state" :class="{ builtIn: draft.builtIn }">{{ draft.builtIn ? '内置预设' : '自定义预设' }}</span>
      <button v-if="!draft.builtIn" class="danger-btn" type="button" @click="deleteCurrentPreset">删除</button>
    </div>

    <div v-if="draft.builtIn" class="built-in-note">
      当前内置预设只支持条目启停。本体名称、结构和正文内容保持锁定；如需改写，请先复制为自定义预设。
    </div>

    <div class="editor-grid">
      <section class="editor-pane">
        <div class="section-title">预设基础</div>
        <label class="field-label">
          <span>名称</span>
          <input v-model="draft.name" class="field-input" type="text" :disabled="draft.builtIn" />
        </label>

        <label v-if="activeProfileId === 'forge-test-chat'" class="field-label">
          <span>引擎</span>
          <select v-model="draft.engine" class="field-select" :disabled="draft.builtIn">
            <option value="composed">组合预设</option>
            <option value="st_preset">ST 预设直通</option>
          </select>
        </label>

        <template v-if="activeProfileId === 'forge-test-chat'">
          <label class="field-label">
            <span>角色卡来源</span>
            <select v-model="draft.charCardMode" class="field-select" :disabled="draft.builtIn">
              <option value="from_st">来自 ST 当前角色</option>
              <option value="custom">自定义角色卡</option>
              <option value="none">不注入角色卡</option>
            </select>
          </label>

          <div v-if="draft.charCardMode === 'custom'" class="char-card-grid">
            <label class="field-label">
              <span>角色名称</span>
              <input v-model="draft.customCharCard.name" class="field-input" type="text" :disabled="draft.builtIn" />
            </label>
            <label class="field-label">
              <span>System Prompt</span>
              <textarea v-model="draft.customCharCard.systemPrompt" class="field-textarea" rows="3" :disabled="draft.builtIn" />
            </label>
            <label class="field-label">
              <span>角色描述</span>
              <textarea v-model="draft.customCharCard.description" class="field-textarea" rows="3" :disabled="draft.builtIn" />
            </label>
            <label class="field-label">
              <span>角色性格</span>
              <textarea v-model="draft.customCharCard.personality" class="field-textarea" rows="3" :disabled="draft.builtIn" />
            </label>
            <label class="field-label">
              <span>场景</span>
              <textarea v-model="draft.customCharCard.scenario" class="field-textarea" rows="3" :disabled="draft.builtIn" />
            </label>
          </div>
        </template>

        <div class="generation-settings-block">
          <div class="section-title">请求参数</div>
          <div class="generation-settings-grid">
            <label
              v-for="field in generationSettingFields"
              :key="field.key"
              class="field-label"
            >
              <span>{{ field.label }}</span>
              <input
                class="field-input"
                type="number"
                :step="field.step"
                :value="getGenerationSettingInputValue(field.key)"
                :disabled="draft.builtIn"
                :placeholder="field.placeholder"
                @input="updateGenerationSetting(field.key, $event)"
              />
            </label>
          </div>
          <p class="section-hint">
            留空表示不覆盖该参数。这里的值会随 Prompt 预设一起保存，并在模型请求调试窗中显示。
          </p>
        </div>

        <div v-if="specialDefinitions.length > 0 && draft.engine !== 'st_preset'" class="special-block">
          <div class="section-title">Special Prompt</div>
          <label v-for="special in specialDefinitions" :key="special.key" class="field-label">
            <span>{{ special.label }}</span>
            <textarea
              v-model="draft.specials[special.key]"
              class="field-textarea"
              rows="6"
              :disabled="draft.builtIn"
            />
          </label>
        </div>

        <div class="editor-actions">
          <button class="save-btn" type="button" :disabled="draft.builtIn" @click="savePreset">
            保存当前预设
          </button>
          <button class="secondary-btn" type="button" @click="applyActivePreset">
            设为当前绑定
          </button>
        </div>
      </section>

      <section class="editor-pane">
        <div class="section-head">
          <div class="section-title">条目顺序</div>
          <div class="section-actions">
            <select v-model="selectedSlotToAdd" class="slot-select" :disabled="draft.builtIn || availableSlots.length === 0 || draft.engine === 'st_preset'">
              <option value="">添加 Slot</option>
              <option v-for="slot in availableSlots" :key="slot.id" :value="slot.id">
                {{ slot.label }}
              </option>
            </select>
            <button class="secondary-btn" type="button" :disabled="!selectedSlotToAdd || draft.builtIn || draft.engine === 'st_preset'" @click="addSlotEntry">
              添加 Slot
            </button>
            <button class="secondary-btn" type="button" :disabled="draft.builtIn || draft.engine === 'st_preset'" @click="addCustomEntry">
              添加自定义
            </button>
          </div>
        </div>

        <div v-if="draft.engine === 'st_preset'" class="engine-hint">
          当前使用 ST 预设直通模式，条目顺序由 ST 当前上下文预设决定。
        </div>

        <div v-else class="entry-list">
          <div v-for="(entry, index) in draft.entries" :key="entry.id" class="entry-card">
            <div class="entry-row">
              <label class="entry-main">
                <input
                  class="entry-checkbox"
                  :checked="entry.enabled"
                  type="checkbox"
                  @change="handleEntryEnabledChange(entry, $event)"
                />
                <span class="entry-title">{{ resolveEntryTitle(entry) }}</span>
              </label>
              <div class="entry-tags">
                <span class="entry-tag">{{ entry.type === 'slot' ? 'SLOT' : 'CUSTOM' }}</span>
                <span class="entry-tag role">{{ resolveEntryRole(entry) }}</span>
              </div>
            </div>

            <div class="entry-actions">
              <button
                class="icon-btn"
                type="button"
                :disabled="index === 0 || draft.builtIn"
                aria-label="上移条目"
                title="上移"
                @click="moveEntry(index, -1)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" aria-hidden="true">
                  <polyline points="6 15 12 9 18 15"></polyline>
                </svg>
              </button>
              <button
                class="icon-btn"
                type="button"
                :disabled="index === draft.entries.length - 1 || draft.builtIn"
                aria-label="下移条目"
                title="下移"
                @click="moveEntry(index, 1)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <button
                class="icon-btn"
                type="button"
                :aria-label="expandedEntryIds.has(entry.id) ? '收起条目' : '展开条目'"
                :title="expandedEntryIds.has(entry.id) ? '收起' : '展开'"
                @click="toggleExpanded(entry.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  stroke="currentColor"
                  stroke-width="2.5"
                  fill="none"
                  aria-hidden="true"
                >
                  <polyline
                    :points="expandedEntryIds.has(entry.id) ? '6 15 12 9 18 15' : '6 9 12 15 18 9'"
                  ></polyline>
                </svg>
              </button>
              <button
                class="icon-btn danger"
                type="button"
                :disabled="draft.builtIn"
                aria-label="删除条目"
                title="删除"
                @click="removeEntry(index)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
                  <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>

            <div v-if="entry.type === 'custom' && expandedEntryIds.has(entry.id)" class="entry-editor">
              <label class="field-label">
                <span>Role</span>
                <select v-model="entry.role" class="field-select" :disabled="draft.builtIn">
                  <option value="system">system</option>
                  <option value="user">user</option>
                  <option value="assistant">assistant</option>
                </select>
              </label>
              <label class="field-label">
                <span>内容</span>
                <textarea v-model="entry.content" class="field-textarea" rows="5" :disabled="draft.builtIn" />
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { promptPresetRegistry } from '../../api/core/PromptPresetRegistry.js';
import { clonePromptPresetGenerationSettings } from '../../api/core/utils/promptPresetGenerationSettings.js';
import { lwStorage } from '../../api/storage.js';
import type {
    PromptPresetDefinition,
    PromptPresetEntry,
    PromptPresetGenerationSettings,
    PromptPresetProfileId,
    PromptPresetSpecialDefinition,
    PromptPresetSlotDefinition
} from '../../types/PromptPresetTypes.js';

defineProps<{
  pluginId?: string;
}>();

type EditablePreset = PromptPresetDefinition & {
    customCharCard: NonNullable<PromptPresetDefinition['customCharCard']>;
};

type GenerationSettingField = {
    key: keyof PromptPresetGenerationSettings;
    label: string;
    step: string;
    placeholder?: string;
};

const STORAGE_KEY_BUILTIN_OVERRIDES = 'lumina-prompt-presets.builtin-overrides';

const profiles = promptPresetRegistry.listProfiles();
const activeProfileId = ref<PromptPresetProfileId>('forge-main');
const presets = ref<PromptPresetDefinition[]>([]);
const activePresetId = ref('');
const selectedSlotToAdd = ref('');
const expandedEntryIds = reactive(new Set<string>());
const generationSettingFields: GenerationSettingField[] = [
    { key: 'temperature', label: 'temperature', step: '0.01', placeholder: '例如 0.7' },
    { key: 'top_p', label: 'top_p', step: '0.01', placeholder: '例如 0.9' },
    { key: 'top_k', label: 'top_k', step: '1', placeholder: '例如 40' },
    { key: 'presence_penalty', label: 'presence_penalty', step: '0.01', placeholder: '例如 0.2' },
    { key: 'frequency_penalty', label: 'frequency_penalty', step: '0.01', placeholder: '例如 0.2' },
    { key: 'max_tokens', label: 'max_tokens', step: '1', placeholder: '例如 512' },
    { key: 'max_length', label: 'max_length', step: '1', placeholder: '例如 1024' },
    { key: 'seed', label: 'seed', step: '1', placeholder: '例如 42' }
];

const draft = reactive<EditablePreset>({
    id: '',
    name: '',
    profileId: 'forge-main',
    builtIn: true,
    engine: 'composed',
    charCardMode: undefined,
    customCharCard: {
        name: '',
        description: '',
        personality: '',
        scenario: '',
        systemPrompt: ''
    },
    entries: [],
    specials: {},
    generationSettings: {},
    createdAt: 0,
    updatedAt: 0
});

const currentProfile = computed(() => profiles.find(profile => profile.id === activeProfileId.value) || profiles[0]);
const slotDefinitions = computed<Record<string, PromptPresetSlotDefinition>>(() =>
    Object.fromEntries(currentProfile.value.slots.map(slot => [slot.slot.id, slot.slot]))
);
const specialDefinitions = computed<PromptPresetSpecialDefinition[]>(() => currentProfile.value.specials);
const availableSlots = computed(() =>
    currentProfile.value.slots
        .map(slot => slot.slot)
        .filter(slot => !draft.entries.some(entry => entry.type === 'slot' && entry.slotId === slot.id))
);

const clonePreset = (preset: PromptPresetDefinition): EditablePreset => ({
    ...preset,
    entries: preset.entries.map(entry => ({ ...entry })),
    specials: { ...preset.specials },
    generationSettings: clonePromptPresetGenerationSettings(preset.generationSettings),
    customCharCard: {
        name: preset.customCharCard?.name || '',
        description: preset.customCharCard?.description || '',
        personality: preset.customCharCard?.personality || '',
        scenario: preset.customCharCard?.scenario || '',
        systemPrompt: preset.customCharCard?.systemPrompt || ''
    }
});

const assignDraft = (preset: PromptPresetDefinition) => {
    const next = clonePreset(preset);
    Object.assign(draft, next);
    expandedEntryIds.clear();
};

const loadProfile = (profileId: PromptPresetProfileId) => {
    promptPresetRegistry.reload();
    presets.value = promptPresetRegistry.listPresets(profileId);
    activePresetId.value = promptPresetRegistry.getActivePresetId(profileId);
    const activePreset = promptPresetRegistry.getActivePreset(profileId);
    assignDraft(activePreset);
};

const switchProfile = (profileId: PromptPresetProfileId) => {
    activeProfileId.value = profileId;
    selectedSlotToAdd.value = '';
    loadProfile(profileId);
};

const onPresetChange = (event: Event) => {
    const id = (event.target as HTMLSelectElement).value;
    activePresetId.value = id;
    const preset = promptPresetRegistry.getPreset(activeProfileId.value, id);
    if (preset) {
        assignDraft(preset);
    }
};

const createPresetFromCurrent = () => {
    const preset = promptPresetRegistry.createPreset(activeProfileId.value, {
        name: `新预设 ${presets.value.length + 1}`,
        engine: draft.engine,
        charCardMode: draft.charCardMode,
        customCharCard: draft.customCharCard,
        entries: draft.entries,
        specials: draft.specials,
        generationSettings: draft.generationSettings
    });
    loadProfile(activeProfileId.value);
    activePresetId.value = preset.id;
    promptPresetRegistry.setActivePreset(activeProfileId.value, preset.id);
    const created = promptPresetRegistry.getPreset(activeProfileId.value, preset.id);
    if (created) assignDraft(created);
};

const duplicateCurrentPreset = () => {
    const duplicated = promptPresetRegistry.duplicatePreset(activeProfileId.value, draft.id);
    if (!duplicated) return;
    promptPresetRegistry.setActivePreset(activeProfileId.value, duplicated.id);
    loadProfile(activeProfileId.value);
};

const restoreDefaultPreset = () => {
    promptPresetRegistry.restoreProfileDefault(activeProfileId.value);
    loadProfile(activeProfileId.value);
};

const deleteCurrentPreset = () => {
    promptPresetRegistry.deletePreset(activeProfileId.value, draft.id);
    loadProfile(activeProfileId.value);
};

const savePreset = () => {
    if (draft.builtIn) return;
    promptPresetRegistry.updatePreset(activeProfileId.value, draft.id, {
        name: draft.name.trim() || '未命名预设',
        engine: draft.engine,
        charCardMode: draft.charCardMode,
        customCharCard: draft.charCardMode === 'custom' ? draft.customCharCard : undefined,
        entries: draft.entries.map(entry => ({ ...entry })),
        specials: { ...draft.specials },
        generationSettings: clonePromptPresetGenerationSettings(draft.generationSettings)
    });
    loadProfile(activeProfileId.value);
    const refreshed = promptPresetRegistry.getPreset(activeProfileId.value, draft.id);
    if (refreshed) {
        activePresetId.value = refreshed.id;
        assignDraft(refreshed);
    }
};

const applyActivePreset = () => {
    promptPresetRegistry.setActivePreset(activeProfileId.value, draft.id);
    loadProfile(activeProfileId.value);
};

const handleEntryEnabledChange = (entry: PromptPresetEntry, event: Event) => {
    const checked = (event.target as HTMLInputElement).checked;
    entry.enabled = checked;
    if (!draft.builtIn) {
        return;
    }
    promptPresetRegistry.setBuiltInEntryEnabled(activeProfileId.value, draft.id, entry.id, checked);
};

const moveEntry = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.entries.length) return;
    const nextEntries = draft.entries.slice();
    [nextEntries[index], nextEntries[nextIndex]] = [nextEntries[nextIndex], nextEntries[index]];
    draft.entries.splice(0, draft.entries.length, ...nextEntries);
};

const addCustomEntry = () => {
    draft.entries.push({
        id: `custom:${Date.now()}:${draft.entries.length}`,
        type: 'custom',
        enabled: true,
        role: 'system',
        content: ''
    });
};

const addSlotEntry = () => {
    if (!selectedSlotToAdd.value) return;
    draft.entries.push({
        id: `slot:${selectedSlotToAdd.value}:${Date.now()}`,
        type: 'slot',
        slotId: selectedSlotToAdd.value,
        enabled: true
    });
    selectedSlotToAdd.value = '';
};

const removeEntry = (index: number) => {
    const [entry] = draft.entries.splice(index, 1);
    if (entry) {
        expandedEntryIds.delete(entry.id);
    }
};

const toggleExpanded = (entryId: string) => {
    if (expandedEntryIds.has(entryId)) {
        expandedEntryIds.delete(entryId);
    } else {
        expandedEntryIds.add(entryId);
    }
};

const resolveEntryTitle = (entry: PromptPresetEntry) => {
    if (entry.type === 'custom') {
        return entry.content?.trim().slice(0, 32) || '自定义 Prompt';
    }
    return slotDefinitions.value[entry.slotId || '']?.label || entry.slotId || '未知 Slot';
};

const resolveEntryRole = (entry: PromptPresetEntry) => {
    if (entry.type === 'custom') {
        return entry.role || 'system';
    }
    return slotDefinitions.value[entry.slotId || '']?.defaultRole || 'system';
};

const getGenerationSettingInputValue = (key: keyof PromptPresetGenerationSettings): string => {
    const value = draft.generationSettings[key];
    return typeof value === 'number' ? String(value) : '';
};

const updateGenerationSetting = (key: keyof PromptPresetGenerationSettings, event: Event) => {
    const rawValue = (event.target as HTMLInputElement).value.trim();
    if (!rawValue) {
        delete draft.generationSettings[key];
        return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
        return;
    }

    draft.generationSettings[key] = parsedValue;
};

const handleStorageChange = (data: { key?: string } | null) => {
    const key = data?.key;
    if (!key || key === 'lumina-prompt-presets.registry' || key === 'lumina-prompt-presets.bindings' || key === STORAGE_KEY_BUILTIN_OVERRIDES) {
        loadProfile(activeProfileId.value);
    }
};

onMounted(() => {
    loadProfile(activeProfileId.value);
    lwStorage.on('*', handleStorageChange);
});

onUnmounted(() => {
    lwStorage.off('*', handleStorageChange);
});
</script>

<style scoped>
.prompt-preset-workbench {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
  min-width: 0;
}

.workbench-head,
.preset-toolbar,
.section-head,
.editor-actions,
.workbench-actions,
.profile-tabs,
.entry-row,
.entry-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.workbench-head,
.preset-toolbar,
.editor-pane,
.built-in-note {
  border: 1px solid var(--lw-border-base);
  border-radius: 20px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  min-width: 0;
}

.workbench-head {
  justify-content: space-between;
  padding: 18px 20px;
}

.workbench-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--lw-text-main);
  text-wrap: balance;
}

.workbench-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--lw-text-muted);
  line-height: 1.6;
  text-wrap: pretty;
}

.workbench-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.head-btn,
.save-btn,
.secondary-btn,
.danger-btn,
.mini-btn {
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-app);
  color: var(--lw-text-main);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.head-btn,
.secondary-btn,
.danger-btn,
.save-btn {
  padding: 8px 12px;
}

.danger-btn,
.mini-btn.danger {
  color: #dc2626;
}

.profile-tabs {
  flex-wrap: wrap;
}

.profile-tab {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.profile-tab.active {
  background: rgba(var(--lw-primary-rgb), 0.12);
  color: var(--lw-primary);
  border-color: rgba(var(--lw-primary-rgb), 0.28);
}

.preset-toolbar {
  padding: 14px 16px;
  flex-wrap: wrap;
  min-width: 0;
}

.built-in-note {
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-muted);
}

.section-head {
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.section-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.preset-select,
.field-input,
.field-select,
.field-textarea,
.slot-select {
  width: 100%;
  box-sizing: border-box;
  appearance: none;
  border: 1px solid var(--lw-border-base) !important;
  border-radius: 14px;
  background: var(--lw-bg-app) !important;
  color: var(--lw-text-main) !important;
  -webkit-text-fill-color: var(--lw-text-main);
  font: inherit;
  box-shadow: none;
  outline: none;
}

.preset-select:focus,
.field-input:focus,
.field-select:focus,
.field-textarea:focus,
.slot-select:focus {
  border-color: var(--lw-border-active) !important;
  box-shadow: 0 0 0 4px rgba(var(--lw-primary-rgb), 0.08);
}

.field-input::placeholder,
.field-textarea::placeholder {
  color: var(--lw-text-muted);
  -webkit-text-fill-color: var(--lw-text-muted);
}

.preset-select:disabled,
.field-input:disabled,
.field-select:disabled,
.field-textarea:disabled,
.slot-select:disabled {
  background: color-mix(in srgb, var(--lw-bg-muted) 94%, white) !important;
  color: var(--lw-text-muted) !important;
  -webkit-text-fill-color: var(--lw-text-muted);
  border-color: var(--lw-border-subtle) !important;
  cursor: not-allowed;
  opacity: 1;
}

.preset-select {
  min-width: 0;
  max-width: min(100%, 320px);
  padding: 8px 12px;
}

.preset-engine,
.preset-state,
.entry-tag {
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 10px;
  font-weight: 700;
  background: color-mix(in srgb, var(--lw-bg-subtle) 86%, transparent);
  color: var(--lw-text-secondary);
}

.preset-engine,
.preset-state {
  white-space: nowrap;
}

.preset-state.builtIn {
  color: var(--lw-text-muted);
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
}

.editor-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  min-width: 0;
  overflow: hidden;
}

.section-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--lw-text-main);
  min-width: 0;
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-secondary);
}

.field-input,
.field-select {
  padding: 10px 12px;
}

.field-textarea {
  resize: vertical;
  min-height: 92px;
  max-width: 100%;
  padding: 10px 12px;
  line-height: 1.55;
}

.slot-select {
  width: min(100%, 220px);
}

.char-card-grid,
.special-block,
.generation-settings-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.generation-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.section-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-muted);
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.entry-card {
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  padding: 12px;
  background: color-mix(in srgb, var(--lw-bg-app) 78%, transparent);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
}

.entry-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 260px;
}

.entry-checkbox {
  appearance: none;
  width: 18px;
  height: 18px;
  margin: 0;
  border: 1px solid var(--lw-border-strong) !important;
  border-radius: 6px;
  background: var(--lw-bg-elevated) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}

.entry-checkbox:focus {
  outline: none;
  border-color: var(--lw-border-active) !important;
  box-shadow: 0 0 0 4px rgba(var(--lw-primary-rgb), 0.08);
}

.entry-checkbox:checked {
  background: rgba(var(--lw-primary-rgb), 0.14) !important;
  border-color: rgba(var(--lw-primary-rgb), 0.36) !important;
}

.entry-checkbox:checked::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 5px;
  height: 10px;
  border: solid var(--lw-text-main);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.entry-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-main);
  line-height: 1.5;
  word-break: break-word;
}

.entry-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.entry-tag.role {
  color: var(--lw-primary);
}

.entry-row {
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.entry-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
  flex: 0 0 auto;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 12px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-app);
  color: var(--lw-text-secondary);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
}

.icon-btn:hover:not(:disabled) {
  color: var(--lw-text-main);
  background: color-mix(in srgb, var(--lw-bg-subtle) 92%, transparent);
}

.icon-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.icon-btn.danger {
  color: #dc2626;
}

.entry-editor,
.engine-hint {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.engine-hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-muted);
  border: 1px dashed var(--lw-border-base);
  border-radius: 14px;
  padding: 14px;
}

@media (max-width: 1080px) {
  .workbench-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .workbench-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .section-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (min-width: 1320px) {
  .editor-grid {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  }
}
</style>
