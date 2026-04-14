<template>
  <div class="ftcs-root">
    <div class="ftcs-section-header">
      <span class="ftcs-section-title">测试聊天预设</span>
      <button class="ftcs-add-btn" type="button" @click="startCreate">
        + 新建预设
      </button>
    </div>

    <!-- 预设列表 -->
    <div class="ftcs-list">
      <div
        v-for="preset in allPresets"
        :key="preset.id"
        class="ftcs-item"
        :class="{ 'ftcs-item--active': preset.id === activePresetId }"
        @click="setActive(preset.id)"
      >
        <div class="ftcs-item-left">
          <span class="ftcs-item-name">{{ preset.name }}</span>
          <span class="ftcs-item-meta">
            {{ charCardModeLabel(preset.charCardMode) }} ·
            {{ preset.promptEntries.filter(e => e.enabled).length }} 个槽位
          </span>
        </div>
        <div class="ftcs-item-actions" @click.stop>
          <button
            v-if="!preset.builtIn"
            class="ftcs-icon-btn"
            title="编辑"
            type="button"
            @click="startEdit(preset)"
          >✏️</button>
          <button
            v-if="!preset.builtIn"
            class="ftcs-icon-btn ftcs-icon-btn--danger"
            title="删除"
            type="button"
            @click="deletePreset(preset.id)"
          >🗑️</button>
          <span v-if="preset.builtIn" class="ftcs-built-in-badge">内置</span>
        </div>
      </div>
    </div>

    <!-- 编辑/新建表单 -->
    <div v-if="editing" class="ftcs-editor">
      <div class="ftcs-editor-header">
        <span>{{ isCreating ? '新建预设' : '编辑预设' }}</span>
        <button class="ftcs-icon-btn" type="button" @click="cancelEdit">✕</button>
      </div>

      <div class="ftcs-field">
        <label class="ftcs-label">名称</label>
        <input v-model="editing.name" class="ftcs-input" type="text" placeholder="预设名称" />
      </div>

      <div class="ftcs-field">
        <label class="ftcs-label">角色卡来源</label>
        <select v-model="editing.charCardMode" class="ftcs-select">
          <option value="none">无（不注入角色卡）</option>
          <option value="from_st">来自 ST 当前角色</option>
          <option value="custom">自定义</option>
        </select>
      </div>

      <!-- 自定义角色卡字段 -->
      <template v-if="editing.charCardMode === 'custom'">
        <div class="ftcs-field">
          <label class="ftcs-label">角色名称</label>
          <input v-model="editing.customCharCard!.name" class="ftcs-input" type="text" placeholder="角色名称" />
        </div>
        <div class="ftcs-field">
          <label class="ftcs-label">角色描述</label>
          <textarea v-model="editing.customCharCard!.description" class="ftcs-textarea" rows="3" placeholder="角色描述" />
        </div>
        <div class="ftcs-field">
          <label class="ftcs-label">角色性格</label>
          <textarea v-model="editing.customCharCard!.personality" class="ftcs-textarea" rows="2" placeholder="角色性格" />
        </div>
        <div class="ftcs-field">
          <label class="ftcs-label">场景</label>
          <textarea v-model="editing.customCharCard!.scenario" class="ftcs-textarea" rows="2" placeholder="场景设定" />
        </div>
        <div class="ftcs-field">
          <label class="ftcs-label">系统提示</label>
          <textarea v-model="editing.customCharCard!.systemPrompt" class="ftcs-textarea" rows="3" placeholder="系统提示词" />
        </div>
      </template>

      <!-- 提示词槽位顺序 -->
      <div class="ftcs-field">
        <label class="ftcs-label">提示词槽位</label>
        <div class="ftcs-slots">
          <div
            v-for="(entry, idx) in editing.promptEntries"
            :key="entry.type === 'slot' ? entry.slot : (entry as any).id"
            class="ftcs-slot-item"
          >
            <input
              v-model="entry.enabled"
              type="checkbox"
              :disabled="entry.type === 'slot' && entry.slot === 'chat_history'"
              class="ftcs-slot-check"
            />
            <span class="ftcs-slot-label">{{ slotLabel(entry) }}</span>
            <div class="ftcs-slot-move">
              <button type="button" class="ftcs-icon-btn ftcs-icon-btn--sm" :disabled="idx === 0" @click="moveEntry(idx, -1)">↑</button>
              <button type="button" class="ftcs-icon-btn ftcs-icon-btn--sm" :disabled="idx === editing.promptEntries.length - 1" @click="moveEntry(idx, 1)">↓</button>
            </div>
            <button
              v-if="entry.type === 'custom'"
              type="button"
              class="ftcs-icon-btn ftcs-icon-btn--danger ftcs-icon-btn--sm"
              @click="removeCustomEntry(idx)"
            >✕</button>
          </div>
        </div>
        <button type="button" class="ftcs-add-custom-btn" @click="addCustomEntry">
          + 添加自定义 Prompt
        </button>
      </div>

      <div class="ftcs-editor-actions">
        <button type="button" class="ftcs-cancel-btn" @click="cancelEdit">取消</button>
        <button type="button" class="ftcs-save-btn" @click="saveEdit">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { lwStorage } from '../../api/storage.js';
import {
    createBuiltInPresets,
    type ForgeTestChatCharCardMode,
    type ForgeTestChatPreset,
    type ForgeTestChatPromptEntry,
    type ForgeTestChatPromptSlot,
    type ForgeTestChatCharCard
} from '../../types/ForgeTestChatTypes.js';

// ── 存储 Key（与 ForgeTestChatService 保持一致）
const STORAGE_KEY_PRESETS = 'lumina-forge.testChatPresets';
const STORAGE_KEY_ACTIVE_PRESET = 'lumina-forge.testChatActivePreset';

// ── 从 storage 加载用户预设
const userPresets = ref<ForgeTestChatPreset[]>(
    (() => {
        const raw = lwStorage.get(STORAGE_KEY_PRESETS, [], 'Global');
        return Array.isArray(raw) ? (raw as ForgeTestChatPreset[]).filter(p => !p.builtIn) : [];
    })()
);

const activePresetId = ref<string>(
    lwStorage.get(STORAGE_KEY_ACTIVE_PRESET, '', 'Global') as string || createBuiltInPresets()[1].id
);

// 合并内置 + 用户预设（只读计算）
const allPresets = computed<ForgeTestChatPreset[]>(() => [
    ...createBuiltInPresets(),
    ...userPresets.value
]);

// ── 持久化
function persistUserPresets() {
    lwStorage.set(STORAGE_KEY_PRESETS, userPresets.value, 'Global');
}

function setActive(id: string) {
    activePresetId.value = id;
    lwStorage.set(STORAGE_KEY_ACTIVE_PRESET, id, 'Global');
}

function deletePreset(id: string) {
    if (!confirm('确认删除此预设？')) return;
    userPresets.value = userPresets.value.filter(p => p.id !== id);
    if (activePresetId.value === id) {
        setActive(createBuiltInPresets()[1].id);
    }
    persistUserPresets();
}

// ── 编辑状态
const isCreating = ref(false);
const editing = ref<(ForgeTestChatPreset & { _origId?: string }) | null>(null);

function startCreate() {
    isCreating.value = true;
    editing.value = {
        id: '',
        name: '新预设',
        charCardMode: 'none',
        customCharCard: { name: '', description: '', personality: '', scenario: '', systemPrompt: '' },
        promptEntries: [
            { type: 'slot', slot: 'world_info', enabled: true },
            { type: 'slot', slot: 'chat_history', enabled: true }
        ],
        createdAt: 0,
        updatedAt: 0
    };
}

function startEdit(preset: ForgeTestChatPreset) {
    isCreating.value = false;
    editing.value = {
        ...preset,
        _origId: preset.id,
        customCharCard: preset.customCharCard ? { ...preset.customCharCard } : { name: '', description: '', personality: '', scenario: '', systemPrompt: '' },
        promptEntries: preset.promptEntries.map(e => ({ ...e }))
    };
}

function cancelEdit() {
    editing.value = null;
    isCreating.value = false;
}

function saveEdit() {
    if (!editing.value) return;
    const now = Date.now();
    const { _origId, ...data } = editing.value as any;

    if (data.charCardMode !== 'custom') {
        delete data.customCharCard;
    }

    if (isCreating.value) {
        const newPreset: ForgeTestChatPreset = { ...data, id: `user:${now}`, createdAt: now, updatedAt: now };
        userPresets.value.push(newPreset);
    } else {
        const idx = userPresets.value.findIndex(p => p.id === _origId);
        if (idx !== -1) {
            userPresets.value.splice(idx, 1, { ...data, id: _origId, updatedAt: now });
        }
    }

    persistUserPresets();
    cancelEdit();
}

// ── 槽位编辑
function moveEntry(idx: number, dir: -1 | 1) {
    if (!editing.value) return;
    const entries = editing.value.promptEntries;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= entries.length) return;
    [entries[idx], entries[newIdx]] = [entries[newIdx], entries[idx]];
}

function addCustomEntry() {
    editing.value?.promptEntries.push({
        type: 'custom',
        id: `custom-${Date.now()}`,
        enabled: true,
        prompt: { role: 'system', content: '' }
    });
}

function removeCustomEntry(idx: number) {
    editing.value?.promptEntries.splice(idx, 1);
}

// ── 标签工具
function charCardModeLabel(mode: ForgeTestChatCharCardMode): string {
    return { none: '无角色卡', from_st: 'ST 角色', custom: '自定义' }[mode] ?? mode;
}

const SLOT_LABELS: Record<ForgeTestChatPromptSlot, string> = {
    char_system_prompt: '角色系统提示',
    char_description: '角色描述',
    char_personality: '角色性格',
    scenario: '场景',
    world_info: '虚拟世界书',
    chat_history: '对话历史（固定）'
};

function slotLabel(entry: ForgeTestChatPromptEntry): string {
    if (entry.type === 'slot') return SLOT_LABELS[entry.slot] ?? entry.slot;
    return `自定义 [${entry.prompt.role}]: ${entry.prompt.content.slice(0, 24) || '（空）'}`;
}
</script>

<style scoped>
.ftcs-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.ftcs-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ftcs-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-text-main);
}

.ftcs-add-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--lw-border-base);
  background: transparent;
  color: var(--lw-primary);
  cursor: pointer;
}

.ftcs-add-btn:hover { background: var(--lw-bg-hover); }

.ftcs-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ftcs-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  cursor: pointer;
  transition: border-color 120ms;
}

.ftcs-item--active {
  border-color: var(--lw-primary);
  background: color-mix(in srgb, var(--lw-primary) 6%, var(--lw-bg-subtle));
}

.ftcs-item-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.ftcs-item-name { font-size: 13px; color: var(--lw-text-main); }
.ftcs-item-meta { font-size: 11px; color: var(--lw-text-muted); }

.ftcs-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ftcs-built-in-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--lw-bg-elevated);
  color: var(--lw-text-muted);
  border: 1px solid var(--lw-border-base);
}

.ftcs-icon-btn {
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--lw-border-base);
  background: transparent;
  color: var(--lw-text-secondary);
  cursor: pointer;
  line-height: 1.4;
  transition: background 100ms;
}

.ftcs-icon-btn:hover { background: var(--lw-bg-hover); }
.ftcs-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ftcs-icon-btn--danger:hover {
  background: color-mix(in srgb, var(--lw-danger, #ef4444) 12%, var(--lw-bg-elevated));
  color: var(--lw-danger, #ef4444);
}
.ftcs-icon-btn--sm { font-size: 11px; padding: 1px 4px; }

/* 编辑表单 */
.ftcs-editor {
  border: 1px solid var(--lw-border-base);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--lw-bg-subtle);
}

.ftcs-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-text-main);
}

.ftcs-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ftcs-label { font-size: 12px; color: var(--lw-text-secondary); }

.ftcs-input,
.ftcs-select,
.ftcs-textarea {
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  background: var(--lw-bg-input, var(--lw-bg-elevated));
  color: var(--lw-text-main);
  font-family: inherit;
  outline: none;
  transition: border-color 150ms;
}

.ftcs-input:focus,
.ftcs-select:focus,
.ftcs-textarea:focus { border-color: var(--lw-primary); }
.ftcs-textarea { resize: vertical; }

.ftcs-slots {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ftcs-slot-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
}

.ftcs-slot-check { cursor: pointer; }
.ftcs-slot-label {
  flex: 1;
  font-size: 12px;
  color: var(--lw-text-main);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ftcs-slot-move { display: flex; gap: 2px; }

.ftcs-add-custom-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px dashed var(--lw-border-base);
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
  margin-top: 4px;
}

.ftcs-add-custom-btn:hover {
  color: var(--lw-primary);
  border-color: var(--lw-primary);
}

.ftcs-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ftcs-cancel-btn,
.ftcs-save-btn {
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}

.ftcs-cancel-btn {
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
  border: 1px solid var(--lw-border-base);
}

.ftcs-save-btn { background: var(--lw-primary); color: var(--lw-on-primary, #fff); }
.ftcs-save-btn:hover { opacity: 0.85; }
</style>
