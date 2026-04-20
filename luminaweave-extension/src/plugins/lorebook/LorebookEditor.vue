<template>
  <div
    class="lore-editor"
    :class="{ 'is-full-window': isFullWindow }"
    :data-skin-variant="editorVariant || 'default'"
    :style="editorSkinStyle"
  >
    <div class="editor-header">
      <div class="header-left">
        <button class="action-toggle-btn" @click="$emit('close')" title="返回">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <div class="title-group">
          <span class="editor-title">{{ isNew ? '新建世界书条目' : form.comment }}</span>
          <div v-if="versionLabel" class="version-badge">
            <span class="version-badge-title">{{ versionLabel }}</span>
            <span v-if="versionHint" class="version-badge-hint">{{ versionHint }}</span>
          </div>
        </div>
      </div>
      <div class="editor-actions">
        <button v-if="!isMobile" class="action-toggle-btn focus-btn" @click="isFullWindow = !isFullWindow"
          :title="isFullWindow ? '退出专注' : '全窗口专注'">
          <svg v-if="!isFullWindow" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="10" y1="14" x2="3" y2="21"></line>
          </svg>
        </button>
        <button v-if="!isMobile" class="action-toggle-btn swap-btn" @click="$emit('swap')"
          :title="mode === 'small' ? '展开至全屏' : '移至侧边栏'">
          <svg v-if="mode === 'small'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
        <button v-if="!isNew" class="action-toggle-btn delete-btn" @click="$emit('delete', form.uid)" title="删除">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <button class="save-button" :class="{ 'is-success': isSaveSuccess, 'is-saving': isSaving }" @click="save"
          :disabled="isSaving">
          <svg class="icon-sync" :class="{ 'rotating': isSaving }" viewBox="0 0 24 24" width="18" height="18"
            stroke="currentColor" fill="none" v-if="!isSaveSuccess">
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <svg class="icon-sync" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" v-else>
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          {{ isSaving ? '保存中...' : (isSaveSuccess ? '已同步' : '保存变更') }}
        </button>
      </div>
    </div>

    <div class="editor-body scroll-container">
      <!-- 基础设置 -->
      <section class="editor-section">
        <label>备注名称</label>
        <input type="text" class="lw-input" v-model="form.comment" placeholder="例如：角色 - 艾莉娜" />
      </section>

      <!-- 关键词管理 -->
      <section class="editor-section">
        <label>触发关键词</label>
        <div class="keywords-tool">
          <transition-group name="list" tag="div" class="keywords-list">
            <span v-for="(key, idx) in (form.key || [])" :key="key" class="key-chip">
              {{ key }}
              <button @click="removeKey(idx)">&times;</button>
            </span>
          </transition-group>
          <div class="keyword-input-group">
            <input type="text" class="lw-input" v-model="newKey" @keyup.enter="addKey" placeholder="输入关键词按回车添加..." />
          </div>
        </div>
      </section>

      <!-- 内容编辑 -->
      <section class="editor-section flex-grow">
        <label>内容文本</label>
        <textarea class="lw-input content-textarea" v-model="form.content" placeholder="输入当关键词被激活时注入到提示词中的文本..."></textarea>
      </section>

      <!-- 高级逻辑 -->
      <section v-if="!isFullWindow" class="editor-section advanced-container">
        <div class="section-subtitle">触发逻辑与插入策略</div>
        <div class="logic-grid">
          <!-- 第一行：位置与插入深度 -->
          <div class="field-item">
            <label class="field-label">插入位置</label>
            <select class="lw-select" v-model="uiPosition">
              <optgroup label="基础位置">
                <option value="0">角色定义之前 (↑Char)</option>
                <option value="1">角色定义之后 (↓Char)</option>
                <option value="5">示例消息之前 (↑EM)</option>
                <option value="6">示例消息之后 (↓EM)</option>
                <option value="2">作者注释之前 (↑AN)</option>
                <option value="3">作者注释之后 (↓AN)</option>
                <option value="7">外部输出 (Outlet)</option>
              </optgroup>
              <optgroup label="深度注入">
                <option value="4-0">@D [系统] 在深度</option>
                <option value="4-1">@D [用户] 在深度</option>
                <option value="4-2">@D [AI] 在深度</option>
              </optgroup>
            </select>
          </div>

          <template v-if="form.position === 4">
            <div class="field-item">
              <label class="field-label">插入深度 (Depth)</label>
              <div class="input-row">
                <input type="number" class="lw-input" v-model.number="form.depth" placeholder="0" />
                <span class="field-hint">0 为最新，数值越大越靠前</span>
              </div>
            </div>
          </template>
          <div class="field-item locked" v-else>
             <label class="field-label">深度参数已锁定</label>
             <div class="locked-status">
               <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none">
                 <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                 <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
               </svg>
               当前位置不支持深度注入
             </div>
          </div>

          <!-- 第二行：排序权重与搜索深度 -->
          <div class="field-item">
            <label class="field-label">权重 / 顺序</label>
            <div class="input-row">
              <input type="number" class="lw-input" v-model.number="form.order" placeholder="100" />
              <span class="field-hint">数值越高越优先处理</span>
            </div>
          </div>

          <div class="field-item">
            <label class="field-label">扫描深度</label>
            <div class="input-row">
              <input type="number" class="lw-input" v-model.number="form.scan_depth" placeholder="全局" />
              <span class="field-hint">关键词搜索的消息深度</span>
            </div>
          </div>

          <!-- 第三行：激活概率与开关逻辑 (1) -->
          <div class="field-item">
            <div class="label-row">
              <label class="field-label">激活概率</label>
              <span class="probability-val">{{ form.probability }}%</span>
            </div>
            <input type="range" class="lw-range" v-model.number="form.probability" min="0" max="100" />
            <div class="range-labels">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          <div class="toggle-card" :class="{ 'is-active': form.constant }" @click="form.constant = !form.constant">
            <div class="toggle-info">
              <span class="toggle-title">始终激活</span>
              <span class="toggle-desc">忽略关键词触发限制</span>
            </div>
            <div class="lw-switch" :class="{ 'checked': form.constant }">
              <div class="switch-dot"></div>
            </div>
          </div>

          <!-- 第四行：开关逻辑 (2) -->
          <div class="toggle-card" :class="{ 'is-active': form.selective }" @click="form.selective = !form.selective">
            <div class="toggle-info">
              <span class="toggle-title">选择触发</span>
              <span class="toggle-desc">仅在满足关键词时激活</span>
            </div>
            <div class="lw-switch" :class="{ 'checked': form.selective }">
              <div class="switch-dot"></div>
            </div>
          </div>

          <div class="field-item" v-if="form.selective">
            <label class="field-label">判断逻辑</label>
            <select class="lw-select" v-model.number="form.selectiveLogic">
              <option :value="0">AND (满足所有主/次关键词)</option>
              <option :value="1">OR (满足任一关键词)</option>
              <option :value="2">NOT (不包含任何关键词)</option>
            </select>
          </div>

          <div class="toggle-card danger" :class="{ 'is-active': form.disable }"
            @click="form.disable = !form.disable">
            <div class="toggle-info">
              <span class="toggle-title text-danger">禁用条目</span>
              <span class="toggle-desc">暂时移除此条目的效力</span>
            </div>
            <div class="lw-switch" :class="{ 'checked': form.disable }">
              <div class="switch-dot"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useComponentSkin } from '../../theme/useComponentSkin';

const props = defineProps<{
  entry: LuminaLorebookEntry,
  mode?: 'large' | 'small',
  isMobile?: boolean
  isFullWindow?: boolean
  versionLabel?: string
  versionHint?: string
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', entry: LuminaLorebookEntry): void;
  (e: 'delete', uid: string | number): void;
  (e: 'swap'): void;
  (e: 'update:isFullWindow', val: boolean): void;
}>();

const isFullWindow = computed({
  get: () => props.isFullWindow || false,
  set: (val) => emit('update:isFullWindow', val)
});
const { cssVars: editorSkinVars, variant: editorVariant } = useComponentSkin('lorebook.editor');
const editorSkinStyle = computed(() => editorSkinVars.value);

const isNew = computed(() => !props.entry.uid);
const form = reactive({ ...props.entry });
const newKey = ref('');

// 计算属性：将 position 和 role 映射为 UI 下拉值 (例: "4-0")
const uiPosition = computed({
  get: () => {
    if (form.position === 4) return `4-${form.role ?? 0}`;
    return String(form.position);
  },
  set: (val: string) => {
    if (val.includes('-')) {
      const [pos, role] = val.split('-').map(Number);
      form.position = pos;
      form.role = role;
    } else {
      form.position = Number(val);
      form.role = undefined;
    }
  }
});

// 状态反馈
const isSaving = ref(false);
const isSaveSuccess = ref(false);

// 监听 entry 变更以更新表单状态
watch(() => props.entry, (newVal) => {
  if (newVal) {
    // 使用 Object.assign 同步所有属性，确保表单对象保持引用不变但内容更新
    Object.assign(form, JSON.parse(JSON.stringify(newVal)));
    isSaveSuccess.value = false;
    isSaving.value = false;
  }
}, { deep: true, immediate: true });

const addKey = () => {
  const k = newKey.value.trim();
  if (!Array.isArray(form.key)) {
    form.key = [];
  }
  if (k && !form.key.includes(k)) {
    form.key.push(k);
    newKey.value = '';
  }
};

const removeKey = (idx: number) => {
  if (Array.isArray(form.key)) {
    form.key.splice(idx, 1);
  }
};

const save = async () => {
  if (!form.content.trim()) {
    alert('内容不能为空');
    return;
  }

  isSaving.value = true;
  emit('save', { ...form });

  // 模拟成功反馈 (实际保存由父组件 handleSave 处理，这里做视觉闭环)
  setTimeout(() => {
    isSaving.value = false;
    isSaveSuccess.value = true;
    setTimeout(() => isSaveSuccess.value = false, 2000);
  }, 300);
};
</script>

<style scoped>
.lore-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lw-lorebook-editor-bg, var(--lw-surface-container-lowest));
  box-shadow: var(--lw-shadow-xl);
  font-family: var(--lw-font-main);
  transition: var(--lw-transition);
  border-radius: var(--lw-radius-xl) 0 0 var(--lw-radius-xl);
  overflow: hidden;
}

.lore-editor.is-full-window {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  border-radius: 0;
}

.editor-header {
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--lw-lorebook-editor-header-bg, var(--lw-surface-container-lowest));
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title-badge {
  padding: 10px;
  background: var(--lw-bg-subtle);
  border-radius: 12px;
  color: var(--lw-primary);
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.editor-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--lw-text-main);
  letter-spacing: -0.02em;
}

.editor-subtitle {
  font-size: 11px;
  font-family: var(--lw-font-mono);
  color: var(--lw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.editor-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.editor-body {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.editor-section.flex-grow {
  flex: none;
  min-height: fit-content;
}

.editor-section label {
  font-family: var(--lw-font-main);
  font-size: 12px;
  font-weight: 800;
  color: var(--lw-text-main);
  letter-spacing: 0.02em;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-section label::before {
  content: "";
  width: 3px;
  height: 12px;
  background: var(--lw-primary);
  border-radius: 99px;
  display: inline-block;
}

input[type="text"],
input[type="number"],
textarea {
  transition: var(--lw-transition);
  background: var(--lw-lorebook-editor-control-bg, var(--lw-surface-container-low)) !important;
  border: none !important;
  outline: none !important;
  border-radius: var(--lw-radius-xl);
}

input:focus,
textarea:focus {
  box-shadow: 0 0 0 3px rgba(var(--lw-primary-rgb), 0.15);
  background: var(--lw-lorebook-editor-control-hover-bg, var(--lw-bg-surface)) !important;
}

/* List Transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(5px);
}

.content-textarea {
  flex: none;
  display: block;
  width: 100%;
  height: 380px;
  resize: vertical !important;
  min-height: 200px;
  font-family: inherit;
  line-height: 1.7;
  /* 彻底禁用 transition，实现绝对“跟手” */
  transition: none !important;
  overflow: auto !important;
}

/* Keywords Chips */
.keywords-tool {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.key-chip {
  background: var(--lw-lorebook-editor-control-bg, var(--lw-surface-container-low));
  color: var(--lw-text-secondary);
  padding: 6px 14px;
  border-radius: var(--lw-radius-sm);
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: var(--lw-transition);
  border: 1px solid var(--lw-border-subtle);
  font-family: var(--lw-font-main);
}

.key-chip:hover {
  border-color: var(--lw-primary);
  color: var(--lw-primary);
  background: var(--lw-bg-selection);
}

.key-chip button {
  background: none;
  border: none;
  color: currentColor;
  padding: 0;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  opacity: 0.5;
}

.key-chip button:hover {
  opacity: 1;
}

/* Advanced Logic Section */
.advanced-container {
  margin-top: 10px;
}

.section-subtitle {
  font-size: 15px;
  font-weight: 800;
  font-family: var(--lw-font-main);
  color: var(--lw-text-main);
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--lw-border-subtle);
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-subtitle::after {
  content: "ADVANCED";
  font-size: 9px;
  font-weight: 900;
  color: var(--lw-primary);
  background: var(--lw-bg-selection);
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.1em;
}

.logic-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}

/* .logic-column removed as it's no longer needed for flattened grid */

.field-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-label {
  /* 继承 .editor-section label 或者直接应用统一逻辑 */
  margin-bottom: 0 !important;
}

.input-row {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 8px;
}

.weight-input {
  width: 120px !important;
  height: 44px;
}

.field-hint {
  font-size: 11px;
  font-family: var(--lw-font-main);
  color: var(--lw-text-muted);
  font-style: italic;
  opacity: 0.7;
  letter-spacing: -0.01em;
}

.locked-status {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  background: var(--lw-lorebook-editor-control-bg, var(--lw-surface-container-low));
  border: 1px dashed var(--lw-border-base);
  border-radius: var(--lw-radius-xl);
  color: var(--lw-text-muted);
  font-size: 11px;
  font-weight: 600;
  opacity: 0.6;
}

.toggle-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--lw-lorebook-editor-control-bg, var(--lw-surface-container-low));
  border-radius: 16px;
  cursor: pointer;
  transition: var(--lw-transition);
  height: 100%;
  box-sizing: border-box;
}

.toggle-card:hover {
  background: var(--lw-lorebook-editor-control-hover-bg, var(--lw-surface-container-high));
}

.toggle-info {
  display: flex;
  flex-direction: column;
}

.toggle-title {
  font-size: 14px;
  font-weight: 800;
  font-family: var(--lw-font-main);
  color: var(--lw-text-main);
}

.version-badge {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--lw-lorebook-editor-accent-bg, var(--lw-bg-subtle));
  border: 1px solid var(--lw-border-base);
}

.version-badge-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-primary);
}

.version-badge-hint {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.toggle-desc {
  font-size: 12px;
  color: var(--lw-text-muted);
}

.lw-switch {
  width: 44px;
  height: 24px;
  background: var(--lw-lorebook-editor-switch-bg, var(--lw-surface-container-highest));
  border-radius: 99px;
  position: relative;
  transition: var(--lw-transition);
}

.lw-switch.checked {
  background: var(--lw-primary);
}

.toggle-card.danger.is-active .lw-switch.checked {
  background: var(--lw-danger);
}

.switch-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  background: var(--lw-lorebook-editor-switch-dot, var(--lw-bg-elevated));
  border-radius: 50%;
  box-shadow: var(--lw-shadow);
  transition: var(--lw-transition);
  transform: translateX(-20px);
}

.lw-switch.checked .switch-dot {
  transform: translateX(0);
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.probability-val {
  font-family: var(--lw-font-mono);
  font-size: 14px;
  font-weight: 800;
  color: var(--lw-primary);
  background: var(--lw-bg-selection);
  padding: 2px 8px;
  border-radius: 6px;
}

.lw-range {
  width: 100%;
  height: 6px;
  background: var(--lw-lorebook-editor-range-track, var(--lw-surface-container-high));
  border-radius: 99px;
  appearance: none;
  cursor: pointer;
}

.lw-range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--lw-primary);
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(var(--lw-primary-rgb), 0.24);
  transition: var(--lw-transition);
}

.lw-range::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.range-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  padding: 0 4px;
}

.range-labels span {
  font-size: 10px;
  font-family: var(--lw-font-mono);
  color: var(--lw-text-muted);
}

.warning-banner-new {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--lw-tertiary-fixed);
  color: var(--lw-on-tertiary-fixed);
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.action-toggle-btn {
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-base);
  color: var(--lw-text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--lw-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--lw-transition);
}

.action-toggle-btn:hover {
  background: var(--lw-bg-surface);
  color: var(--lw-primary);
  border-color: var(--lw-primary);
  transform: translateY(-1px);
}

.save-button {
  background: var(--lw-lorebook-editor-save-bg, var(--lw-black));
  color: var(--lw-lorebook-editor-save-color, var(--lw-text-inverse));
  border: none;
  border-radius: var(--lw-radius);
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 800;
  font-family: var(--lw-font-main);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  /* min-width: 140px; scale: 0.97;*/
  min-width: fit-content
}

.icon-sync {
  font-size: 18px !important;
  transition: transform 0.3s ease;
}

.icon-sync.rotating {
  animation: lw-rotate 1s linear infinite;
}

@keyframes lw-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.save-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--lw-shadow-card);
  background: var(--lw-lorebook-editor-save-hover-bg, color-mix(in srgb, var(--lw-black) 92%, white));
}

.save-button:active:not(:disabled) {
  transform: scale(0.96);
}

.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-button.is-success {
  background: var(--lw-lorebook-editor-success-bg, var(--lw-success));
}

.save-button.is-saving {
  background: var(--lw-lorebook-editor-saving-bg, var(--lw-bg-active));
}
</style>
