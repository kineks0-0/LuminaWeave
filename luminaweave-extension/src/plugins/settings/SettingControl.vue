<template>
  <div class="setting-row" :class="isVerticalLayout ? 'layout-vertical' : 'layout-horizontal'">
    <div class="setting-left">
      <div class="label-row">
        <label class="setting-label">{{ config.label }}</label>
        <div class="setting-scope" v-if="config.allowedScopes && config.allowedScopes.length > 1">
          <select v-model="currentScope" @change="onScopeChange">
            <option v-for="scope in config.allowedScopes" :key="scope" :value="scope">
              {{ scopeLabels[scope] || scope }}
            </option>
          </select>
        </div>
      </div>
      <div class="setting-description" v-if="config.description">{{ config.description }}</div>
    </div>

    <div class="setting-options" :class="controlClass">
      <!-- Theme Color Buttons -->
      <template v-if="config.type === 'theme'">
        <button v-for="theme in themes" :key="theme.value" class="color-btn"
          :class="{ active: currentValue === theme.value }" :style="{ background: theme.color }"
          @click="updateValue(theme.value)">
          <!-- 深色主题用白色勾，浅色主题用深色勾 -->
          <svg v-if="currentValue === theme.value" viewBox="0 0 24 24" width="13" height="13"
            :stroke="theme.value === 'dark' ? '#fff' : '#1e293b'" stroke-width="2.5" fill="none">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </template>

      <!-- Options (Segmented Control) -->
      <template v-else-if="config.type === 'options'">
        <template v-if="settingKey === 'fontFamily'">
          <div class="font-selector-wrap">
            <select class="lw-select font-preset-select" :value="isRemoteOrCustom ? 'remote' : currentValue"
              @change="handleFontPresetChange">
              <option v-for="opt in config.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              <option value="remote">★ 探索远端字体</option>
            </select>

            <div v-if="isRemoteOrCustom" class="remote-font-picker slide-down">
              <select class="lw-select" :value="currentValue" @change="handleRemoteFontChange">
                <option value="" disabled>请选择一个远端字体...</option>
                <option v-for="font in remoteFonts" :key="font.id" :value="font.family">
                  {{ font.label }}
                </option>
                <option value="__custom__">-- 手动输入其他字体 --</option>
              </select>

              <div v-if="currentValue === '__custom__' || isTrulyCustom" class="font-custom-input">
                <input type="text" class="lw-input" :value="isTrulyCustom ? currentValue : ''"
                  placeholder="输入字体名称 (如 MiSans)..." @input="handleInput" />
              </div>

              <div class="font-preview-card" :style="{ fontFamily: currentValue }">
                Aa 漫步在云端 - The quick brown fox jumps over the lazy dog.
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="segment-control">
            <button v-for="opt in config.options" :key="opt.value" :class="{ active: currentValue === opt.value }"
              @click="updateValue(opt.value)">
              {{ opt.label }}
            </button>
          </div>
        </template>
      </template>

      <!-- Boolean (Toggle Switch) -->
      <template v-else-if="config.type === 'boolean'">
        <label class="lw-toggle">
          <input type="checkbox" :checked="currentValue" @change="handleCheckbox">
          <span class="lw-toggle-slider"></span>
        </label>
      </template>

      <!-- Stepper (A- / A+) 字重/字号步进器 -->
      <template v-else-if="config.type === 'stepper'">
        <div class="stepper-wrap">
          <button class="stepper-btn" @click="updateValue(currentValue - (config.step || 1))">
            {{ stepperChar }}-
          </button>
          <input type="number" class="stepper-val-input" :value="currentValue" :min="config.min" :max="config.max"
            :step="config.step || 1" @input="handleNumberInput" />
          <button class="stepper-btn" @click="updateValue(currentValue + (config.step || 1))">
            {{ stepperChar }}+
          </button>
        </div>
      </template>

      <!-- Slider -->
      <template v-else-if="config.type === 'slider'">
        <div class="slider-wrapper">
          <input type="range" :min="config.min" :max="config.max" :step="config.step" :value="currentValue"
            @input="handleRange" class="lw-slider-input" />
          <input type="number" :min="config.min" :max="config.max" :step="config.step" :value="currentValue"
            @input="handleNumberInput" class="slider-number-input" />
        </div>
      </template>

      <!-- Nexus Select -->
      <template v-else-if="config.type === 'nexus-select'">
        <select class="lw-select" :value="currentValue" @change="handleSelect">
          <option value="">未指定 (使用 ST 全局模型)</option>
          <option v-for="preset in availableNexusPresets" :key="preset.id" :value="preset.id">
            ★ {{ preset.name }}
          </option>
        </select>
      </template>

      <!-- Text Input -->
      <template v-else-if="config.type === 'text'">
        <input type="text" class="lw-input" :value="currentValue" @input="handleInput"
          :placeholder="config.default || '请输入...'" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { activeSettings, activeScopes, useSettings } from './useSettings';
import { lwStorage } from '../../api/storage';

const { updateSetting, updateScope } = useSettings();

interface SettingOption {
  value: any;
  label: string;
}

interface SettingConfig {
  label: string;
  description?: string;
  type: 'theme' | 'options' | 'boolean' | 'stepper' | 'slider' | 'nexus-select' | 'text';
  default: any;
  allowedScopes?: string[];
  options?: SettingOption[];
  min?: number;
  max?: number;
  step?: number;
  common?: boolean;
}

const props = defineProps<{
  pluginId: string;
  settingKey: string;
  config: SettingConfig;
}>();

const storageKey = computed(() => `${props.pluginId}.${props.settingKey}`);

const currentValue = computed(() => {
  const v = activeSettings[storageKey.value];
  return (v !== undefined && v !== null) ? v : props.config.default;
});

const currentScope = computed({
  get: () => activeScopes[storageKey.value] || (props.config.allowedScopes ? props.config.allowedScopes[0] : 'Global'),
  set: (val: string) => {
    activeScopes[storageKey.value] = val;
  }
});

const scopeLabels: Record<string, string> = {
  Global: '全局',
  Character: '随角色',
  Chat: '随对话',
  Session: '仅本地缓存'
};

const isVerticalLayout = computed(() =>
  props.config.type === 'slider' ||
  props.config.type === 'text' ||
  props.config.type === 'nexus-select' ||
  props.config.type === 'options' ||
  props.config.type === 'theme' ||
  props.settingKey === 'fontFamily'
  // stepper 保持水平布局（小巧的步进器适合水平排版）
);

const controlClass = computed(() => {
  const classes = [];
  if (props.config.type === 'theme') classes.push('theme-options');
  if (props.config.type === 'options') classes.push('btn-group wrap');
  if (props.config.type === 'stepper') classes.push('stepper-control');
  if (isVerticalLayout.value) classes.push('full-width');
  return classes.join(' ');
});

// 主题色板 — 与 App.vue 中的主题实现保持同步
const themes = [
  { value: 'gray', color: '#f1f5f9' },
  { value: 'warm', color: '#fef9c3' },
  { value: 'green', color: '#dcfce7' },
  { value: 'blue', color: '#dbeafe' },
  { value: 'dark', color: '#1e293b' }
];

// 从 config.label 中提取首个大写字母作为步进器按钮前缀（如 A- / A+）
const stepperChar = computed(() => {
  const label = props.config.label || '';
  // 优先取括号内缩写，否则取第一个汉字或首字母
  const abbr = label.match(/[A-Z]/);
  return abbr ? abbr[0] : 'A';
});

const remoteFonts = computed(() => {
  return (window as any).LuminaWeave?.fontManager?.getFontCatalog() || [];
});

const isRemoteOrCustom = computed(() => {
  if (props.settingKey !== 'fontFamily') return false;
  const standardValues = (props.config.options || []).map(o => o.value);
  return !standardValues.includes(currentValue.value);
});

const isTrulyCustom = computed(() => {
  if (!isRemoteOrCustom.value) return false;
  return !remoteFonts.value.some((f: any) => f.family === currentValue.value);
});

const handleFontPresetChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value;
  if (val === 'remote') {
    // 默认切到列表第一个，或者保持原样
    if (!isRemoteOrCustom.value) updateValue(remoteFonts.value[0]?.family || '');
  } else {
    updateValue(val);
  }
};

const handleRemoteFontChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value;
  if (val === '__custom__') {
    updateValue('');
  } else {
    updateValue(val);
  }
};

const updateValue = (val: any) => {
  updateSetting(storageKey.value, val);
};

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  updateValue(target.value);
};

const handleNumberInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const val = parseFloat(target.value);
  if (!isNaN(val)) {
    // 自动约束范围
    const clamped = Math.max(props.config.min || 0, Math.min(props.config.max || 100, val));
    updateValue(clamped);
  }
};

const handleCheckbox = (e: Event) => {
  const target = e.target as HTMLInputElement;
  updateValue(target.checked);
};

const handleRange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  updateValue(parseFloat(target.value));
};

const handleSelect = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  updateValue(target.value);
};

// 专用于 nexus-select 类型的预设拉取
const availableNexusPresets = computed(() => {
  if (props.config.type === 'nexus-select') {
    return (lwStorage as any).get('nexus.presets', [], 'Global');
  }
  return [];
});

const onScopeChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  updateScope(storageKey.value, target.value);
};
</script>


<style scoped>
.setting-row {
  display: flex;
  gap: 12px 24px;
  padding: 14px 0;
  border-bottom: 1px solid var(--lw-border-base);
  transition: var(--lw-transition);
}

.setting-row:last-child {
  border-bottom: none;
}

/* 水平排版：开关类控件（标签左，控件右） */
.setting-row.layout-horizontal {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

/* 水平排版悬停时给予轻微背景反馈 */
.setting-row.layout-horizontal:hover {
  background: var(--lw-bg-hover);
  margin-left: -12px;
  margin-right: -12px;
  padding-left: 12px;
  padding-right: 12px;
  border-radius: var(--lw-radius-sm);
  border-bottom-color: transparent;
}

/* 垂直排版：复杂控件（标签上，控件下） */
.setting-row.layout-vertical {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.setting-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.layout-horizontal .setting-left {
  width: auto;
}

.layout-vertical .setting-left {
  width: 100%;
}

.label-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 水平布局：正常标签样式 */
.setting-label {
  font-size: 13px;
  color: var(--lw-text-main);
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: -0.01em;
}

/* 垂直布局：高对比度小标题样式（取消大写，提高可读性） */
.layout-vertical .setting-label {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--lw-text-muted);
  font-weight: 600;
  text-transform: uppercase;
}

.setting-description {
  font-size: 12px;
  color: var(--lw-text-muted);
  line-height: 1.6;
}

/* 作用域选择器 */
.setting-scope select {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--lw-radius-sm);
  border: 1px solid var(--lw-border-base) !important;
  background-color: var(--lw-bg-subtle) !important;
  color: var(--lw-text-secondary) !important;
  outline: none;
  cursor: pointer;
  height: 20px;
  transition: var(--lw-transition);
}

.setting-scope select:hover {
  border-color: #94a3b8 !important;
  color: var(--lw-text-main) !important;
}

/* 控件容器 */
.setting-options {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.layout-horizontal .setting-options {
  justify-content: flex-end;
  flex-shrink: 0;
}

.layout-vertical .setting-options {
  justify-content: flex-start;
  width: 100%;
}

.setting-options.full-width {
  width: 100%;
}

.setting-options.full-width> :not(.color-btn) {
  width: 100%;
  max-width: 100%;
}

/* ---- Segment Control ---- */
.segment-control {
  background: var(--lw-bg-subtle);
  border-radius: var(--lw-radius-sm);
  padding: 2px;
  display: flex;
  gap: 2px;
  border: 1px solid var(--lw-border-base);
  flex-wrap: wrap;
}

.segment-control button {
  background: transparent;
  border: none;
  padding: 5px 12px;
  border-radius: 6px;
  color: var(--lw-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--lw-transition);
  white-space: nowrap;
  flex: 1;
}

.segment-control button.active {
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
  box-shadow: var(--lw-shadow);
  border: 1px solid var(--lw-border-base);
}

.segment-control button:hover:not(.active) {
  color: var(--lw-text-main);
  background: rgba(0, 0, 0, 0.04);
}

/* ---- Theme Color Swatches ---- */
.theme-options {
  gap: 10px;
  flex-wrap: wrap;
}

.color-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.08);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--lw-transition);
  padding: 0;
  flex-shrink: 0;
}

.color-btn:hover {
  transform: scale(1.1);
  border-color: rgba(0, 0, 0, 0.18);
}

.color-btn.active {
  transform: scale(1.12);
  box-shadow: 0 0 0 2px var(--lw-bg-surface), 0 0 0 4px rgba(0, 0, 0, 0.25);
  border-color: transparent;
}

/* ---- Stepper — A- / A+ 胶弹形标签步进器 ---- */
.stepper-wrap {
  display: inline-flex;
  align-items: center;
  background: var(--lw-bg-subtle);
  border-radius: 100px;
  /* 胶弹形 */
  border: 1px solid var(--lw-border-base);
  overflow: hidden;
}

.stepper-btn {
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: var(--lw-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--lw-transition);
  white-space: nowrap;
  line-height: 1;
  font-family: inherit;
  width: 60px;
  min-width: 10px;
}

.stepper-btn:hover {
  background: var(--lw-bg-active);
  color: var(--lw-text-main);
}

.stepper-btn:active {
  transform: scale(0.96);
}

/* 当前数值展示 (可点击修改) */
.stepper-val-input {
  min-width: 52px;
  width: 50px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--lw-text-main);
  background: transparent;
  border: none;
  /* border-left: 1px solid var(--lw-border-base);
  border-right: 1px solid var(--lw-border-base); */
  outline: none;
  font-family: inherit;
  padding: 8px 0;
  margin: 0;
  -moz-appearance: textfield;
  appearance: none;
}

.stepper-val-input::-webkit-outer-spin-button,
.stepper-val-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* ---- Slider ---- */
.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.lw-slider-input {
  flex: 1;
  height: 6px;
  background: #f1f5f9;
  border-radius: 99px;
  appearance: none;
  outline: none;
  cursor: pointer;
}

.lw-slider-input::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--lw-primary);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 97, 224, 0.2);
  transition: var(--lw-transition);
}

.lw-slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.slider-number-input {
  width: 58px;
  padding: 6px 8px;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--lw-text-main);
  text-align: center;
  background: var(--lw-bg-subtle);
  transition: var(--lw-transition);
  outline: none;
  font-family: inherit;
}

.slider-number-input:focus {
  background: var(--lw-bg-surface);
  border-color: var(--lw-accent);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05);
}

/* ---- Font Selector ---- */
.font-selector-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.remote-font-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
}

.font-preview-card {
  padding: 16px 20px;
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  font-size: 15px;
  color: var(--lw-text-main);
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: var(--lw-shadow);
}

/* ---- Animations ---- */
.slide-down {
  animation: slide-down 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
