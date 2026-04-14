<template>
  <div class="forge-editor">
    <div class="editor-header">
      <div class="editor-title-group">
        <span class="editor-kicker">{{ canDelete ? '编辑虚拟条目' : '新建虚拟条目' }}</span>
        <strong>{{ form.comment || '未命名条目' }}</strong>
      </div>
      <div class="editor-actions">
        <button class="ghost-btn" :class="{ 'is-active': showPreview }" @click="showPreview = !showPreview">
          {{ showPreview ? '返回编辑' : '实时预览' }}
        </button>
        <button class="ghost-btn" @click="$emit('close')">关闭</button>
        <button v-if="canDelete" class="ghost-btn danger" @click="$emit('delete')">删除</button>
        <button class="primary-btn" @click="save">保存</button>
      </div>
    </div>

    <div v-if="showPreview" class="editor-body preview-mode">
      <ForgeLorebookPreview :entry="form" />
      <div class="preview-hint">
        <p>这是条目在聊天 Trace 和工作区预览中的展示形态。</p>
      </div>
    </div>

    <div v-else class="editor-body">
      <section class="field-block">
        <label class="field-label">备注名称</label>
        <input v-model="form.comment" class="text-input" type="text" placeholder="输入条目名称" />
      </section>

      <section class="field-block">
        <div class="field-row">
          <label class="field-label">关键词</label>
          <span class="field-hint">回车添加</span>
        </div>
        <div class="keyword-input-row">
          <input v-model="newKey" class="text-input" type="text" placeholder="输入关键词后回车" @keydown.enter.prevent="addKey" />
        </div>
        <div class="keyword-list">
          <button v-for="(key, index) in form.key" :key="`${key}-${index}`" class="keyword-chip" @click="removeKey(index)">
            {{ key }}
            <span class="chip-close">×</span>
          </button>
          <span v-if="form.key.length === 0" class="field-hint">暂无关键词</span>
        </div>
      </section>

      <section class="field-block field-block-grow">
        <div class="field-row">
          <label class="field-label">内容</label>
          <span class="field-hint">支持长文本</span>
        </div>
        <textarea v-model="form.content" class="content-input" placeholder="输入虚拟条目内容"></textarea>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import ForgeLorebookPreview from './ForgeLorebookPreview.vue';

const props = defineProps<{
  entry: LuminaLorebookEntry;
  canDelete?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', entry: LuminaLorebookEntry): void;
  (e: 'delete'): void;
}>();

const form = reactive<LuminaLorebookEntry>({ ...props.entry });
const newKey = ref('');
const showPreview = ref(false);

watch(
  () => props.entry,
  (nextEntry) => {
    Object.assign(form, {
      ...nextEntry,
      key: Array.isArray(nextEntry.key) ? [...nextEntry.key] : [],
      keysecondary: Array.isArray(nextEntry.keysecondary) ? [...nextEntry.keysecondary] : []
    });
  },
  { deep: true, immediate: true }
);

const addKey = () => {
  const key = newKey.value.trim();
  if (!key) return;
  if (!Array.isArray(form.key)) {
    form.key = [];
  }
  if (!form.key.includes(key)) {
    form.key.push(key);
  }
  newKey.value = '';
};

const removeKey = (index: number) => {
  if (!Array.isArray(form.key)) return;
  form.key.splice(index, 1);
};

const save = () => {
  if (!form.content.trim()) {
    window.alert('内容不能为空');
    return;
  }
  emit('save', {
    ...form,
    key: Array.isArray(form.key) ? [...form.key] : [],
    keysecondary: Array.isArray(form.keysecondary) ? [...form.keysecondary] : []
  });
};
</script>

<style scoped>
.forge-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: color-mix(in srgb, var(--lw-bg-surface) 92%, var(--lw-bg-app));
  color: var(--lw-text-main);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 82%, transparent);
}

.editor-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.editor-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lw-primary);
}

.editor-title-group strong {
  font-size: 18px;
  line-height: 1.2;
}

.editor-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ghost-btn,
.primary-btn,
.keyword-chip {
  border-radius: 12px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--lw-transition);
}

.ghost-btn.danger {
  color: #f0b7b7;
}

.primary-btn {
  background: #111111;
  border-color: #111111;
  color: var(--lw-text-inverse);
}

.ghost-btn:hover,
.keyword-chip:hover {
  background: var(--lw-bg-hover);
  border-color: var(--lw-border-hover);
  color: var(--lw-text-main);
}

.ghost-btn.is-active {
  background: rgba(var(--lw-primary-rgb), 0.1);
  border-color: var(--lw-primary);
  color: var(--lw-primary);
}

.primary-btn:hover {
  background: #000000;
  border-color: #000000;
}

.editor-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
}

.editor-body.preview-mode {
  background: color-mix(in srgb, var(--lw-bg-app) 40%, transparent);
}

.preview-hint {
  margin-top: 20px;
  padding: 16px;
  border-radius: 16px;
  border: 1px dashed var(--lw-border-subtle);
  color: var(--lw-text-muted);
  font-size: 12px;
  text-align: center;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-block-grow {
  flex: 1;
  min-height: 260px;
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.field-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.field-hint {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.text-input,
.content-input {
  width: 100%;
  border-radius: 14px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-main);
  padding: 12px 14px;
  font-size: 13px;
}

.content-input {
  flex: 1;
  min-height: 260px;
  resize: vertical;
  line-height: 1.65;
}

.keyword-input-row {
  display: flex;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keyword-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: rgba(var(--lw-primary-rgb), 0.1);
  border-color: rgba(var(--lw-primary-rgb), 0.14);
  color: var(--lw-primary);
}

.chip-close {
  opacity: 0.7;
}
</style>
