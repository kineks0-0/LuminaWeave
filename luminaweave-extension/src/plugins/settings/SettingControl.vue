<template>
  <div
    v-if="isVisible"
    class="setting-row"
    :class="[
      isVerticalLayout ? 'layout-vertical' : 'layout-horizontal',
      { 'is-row-toggle': isRowToggleEnabled }
    ]"
    :data-skin-variant="settingsControlVariant || 'default'"
    :style="settingControlStyle"
    :role="isRowToggleEnabled ? 'button' : undefined"
    :tabindex="isRowToggleEnabled ? 0 : undefined"
    :aria-pressed="isRowToggleEnabled ? Boolean(currentValue) : undefined"
    @click="handleRowToggle"
    @keydown.enter.prevent="handleRowToggle"
    @keydown.space.prevent="handleRowToggle"
  >
    <div class="setting-left">
      <div class="label-row">
        <label class="setting-label">{{ config.label }}</label>
        <div v-if="hasScopeSelector" class="setting-meta-control setting-scope">
          <LuminaSelect class="scope-select compact-scope" size="sm" :modelValue="currentScope" @update:modelValue="onScopeValueChange" aria-label="设置作用域" title="作用域">
            <option v-for="scope in config.allowedScopes" :key="scope" :value="scope">
              {{ scopeLabels[scope] || scope }}
            </option>
          </LuminaSelect>
        </div>
      </div>
      <div class="setting-description" v-if="config.description">{{ config.description }}</div>
    </div>

    <div
      class="setting-options"
      :class="[controlClass, !isVerticalLayout && 'tw:max-[720px]:w-full tw:max-[720px]:justify-start']"
    >
      <div class="setting-control-body" :class="controlBodyClass">
        <!-- Theme Color Buttons -->
        <template v-if="config.type === 'theme'">
          <button v-for="theme in themes" :key="theme.value" :class="getThemeColorButtonClass(theme.value)"
            :style="{ background: theme.color }" :aria-label="`切换到 ${theme.value} 主题`"
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
              <LuminaSelect class="lw-select font-preset-select" :modelValue="isRemoteOrCustom ? 'remote' : currentValue"
                @update:modelValue="handleFontPresetChange">
                <option v-for="opt in resolvedOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                <option value="remote">★ 探索远端字体</option>
              </LuminaSelect>

              <div v-if="isRemoteOrCustom" class="remote-font-picker tw:animate-[setting-slide-down_200ms_ease-out]">
                <LuminaSelect class="lw-select" :modelValue="currentValue" @update:modelValue="handleRemoteFontChange">
                  <option value="" disabled>请选择一个远端字体...</option>
                  <option v-for="font in remoteFonts" :key="font.id" :value="font.family">
                    {{ font.label }}
                  </option>
                  <option value="__custom__">-- 手动输入其他字体 --</option>
                </LuminaSelect>

                <div v-if="currentValue === '__custom__' || isTrulyCustom" class="font-custom-input">
                  <LuminaInput type="text" class="lw-input" :modelValue="isTrulyCustom ? currentValue : ''"
                    placeholder="输入字体名称 (如 MiSans)..." @update:modelValue="updateValue" />
                </div>

                <div class="font-preview-card" :style="{ fontFamily: currentValue }">
                  Aa 漫步在云端 - The quick brown fox jumps over the lazy dog.
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="segment-control-container">
              <div class="segment-control">
                <button v-for="opt in resolvedOptions" :key="opt.value" :class="{ active: currentValue === opt.value }"
                  @click="updateValue(opt.value)">
                  {{ opt.label }}
                </button>
              </div>
              <!-- 展现选中项的详细描述 -->
              <transition
                enter-active-class="tw:transition-[opacity,transform] tw:duration-200 tw:ease-out"
                leave-active-class="tw:transition-[opacity,transform] tw:duration-200 tw:ease-out"
                enter-from-class="tw:-translate-y-1 tw:opacity-0"
                leave-to-class="tw:-translate-y-1 tw:opacity-0"
              >
                <div v-if="activeOptionDescription" class="option-description-tip tw:animate-[setting-slide-in-top_200ms_ease-out]">
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  {{ activeOptionDescription }}
                </div>
              </transition>
            </div>
          </template>
        </template>

        <!-- Boolean (Toggle Switch) -->
        <template v-else-if="config.type === 'boolean'">
          <LuminaToggle class="lw-toggle" :modelValue="Boolean(currentValue)" @update:modelValue="updateValue" />
        </template>

        <!-- Stepper (LuminaStepper) 通用步进器 -->
        <template v-else-if="config.type === 'stepper'">
          <LuminaStepper :modelValue="currentValue" :min="config.min" :max="config.max" :step="config.step"
            @update:modelValue="updateValue" />
        </template>

        <!-- Slider -->
        <template v-else-if="config.type === 'slider'">
          <div class="slider-wrapper">
            <LuminaSlider :min="config.min" :max="config.max" :step="config.step" :modelValue="Number(currentValue)"
              @update:modelValue="updateValue" class="lw-slider-input" />
            <LuminaInput type="number" :min="config.min" :max="config.max" :step="config.step" :modelValue="currentValue"
              @update:modelValue="handleNumberInput" class="slider-number-input" />
          </div>
        </template>

        <!-- Nexus Select -->
        <template v-else-if="config.type === 'nexus-select'">
          <LuminaSelect class="lw-select" :modelValue="currentValue" @update:modelValue="updateValue">
            <option value="">未指定 (使用 ST 全局模型)</option>
            <option v-for="preset in availableNexusPresets" :key="preset.id" :value="preset.id">
              ★ {{ preset.name }}
            </option>
          </LuminaSelect>
        </template>

        <!-- Text Input -->
        <template v-else-if="config.type === 'text'">
          <LuminaInput type="text" class="lw-input" :modelValue="currentValue" @update:modelValue="updateValue"
            :placeholder="config.default || '请输入...'" />
        </template>

        <!-- Password Input -->
        <template v-else-if="config.type === 'password'">
          <LuminaInput type="password" autocomplete="off" class="lw-input" :modelValue="currentValue"
            @update:modelValue="updateValue" :placeholder="config.default || '请输入...'" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { activeSettings, activeScopes, useSettings } from './useSettings.js';
import { lwStorage } from '../../api/storage.js';
import LuminaStepper from './LuminaStepper.vue';
import { LuminaInput, LuminaSelect, LuminaSlider, LuminaToggle } from '../../ui/primitives';
import { cn } from '../../ui/cn.js';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import {
  clampSettingNumber,
  getActiveSettingOptionDescription,
  getSettingControlBodyClass,
  getSettingControlClass,
  getSettingScope,
  getSettingStorageKey,
  getSettingValue,
  hasSettingScopeSelector,
  isRowToggleSetting,
  isSettingVisible,
  resolveSettingOptions,
  settingScopeLabels,
  shouldUseVerticalSettingLayout,
  type SettingControlConfig
} from './settingControlModel.js';

const { updateSetting, updateScope } = useSettings();
const { cssVars: settingsControlSkinVars, variant: settingsControlVariant } = useSurfaceSkin('settings.control');

const props = defineProps<{
  pluginId: string;
  settingKey: string;
  config: SettingControlConfig;
}>();

const storageKey = computed(() => getSettingStorageKey(props.pluginId, props.settingKey));

const currentValue = computed(() => {
  return getSettingValue(activeSettings, storageKey.value, props.config.default);
});

const currentScope = computed({
  get: () => getSettingScope(activeScopes, storageKey.value, props.config.allowedScopes),
  set: (val: string) => {
    activeScopes[storageKey.value] = val;
  }
});

const isVisible = computed(() => isSettingVisible(props.config, activeSettings));

const isRowToggleEnabled = computed(() => isRowToggleSetting(props.config, props.settingKey));

const resolvedOptions = computed(() => resolveSettingOptions(props.config));

// 计算当前激活选项的描述文字
const activeOptionDescription = computed(() => getActiveSettingOptionDescription(resolvedOptions.value, currentValue.value));

const hasScopeSelector = computed(() => hasSettingScopeSelector(props.config));

const scopeLabels = settingScopeLabels;

const isVerticalLayout = computed(() => shouldUseVerticalSettingLayout(props.config, props.settingKey));

const controlClass = computed(() => getSettingControlClass(props.config, isVerticalLayout.value));

const controlBodyClass = computed(() => getSettingControlBodyClass(props.config));

// 主题色板 — 与 App.vue 中的主题实现保持同步
const themes = [
  { value: 'gray', color: '#f1f5f9' },
  { value: 'warm', color: '#fef9c3' },
  { value: 'green', color: '#dcfce7' },
  { value: 'blue', color: '#dbeafe' },
  { value: 'dark', color: '#1e293b' }
];

const getThemeColorButtonClass = (themeValue: string): string => cn(
  'color-btn tw:flex tw:size-9 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:border-2 tw:border-[rgba(0,0,0,0.08)] tw:p-0 tw:transition-[border-color,box-shadow,scale] tw:duration-150 tw:ease-out tw:hover:scale-110 tw:hover:border-[rgba(0,0,0,0.18)]',
  currentValue.value === themeValue
  && 'active tw:scale-[1.08] tw:border-transparent tw:shadow-[0_0_0_2px_var(--lw-bg-surface),0_0_0_4px_rgba(0,0,0,0.25)] tw:hover:scale-[1.08] tw:hover:border-transparent'
);

const remoteFonts = computed(() => {
  return (window as any).LuminaWeave?.fontManager?.getFontCatalog() || [];
});

const isRemoteOrCustom = computed(() => {
  if (props.settingKey !== 'fontFamily') return false;
  const standardValues = resolvedOptions.value.map(o => o.value);
  return !standardValues.includes(currentValue.value);
});

const isTrulyCustom = computed(() => {
  if (!isRemoteOrCustom.value) return false;
  return !remoteFonts.value.some((f: any) => f.family === currentValue.value);
});

const handleFontPresetChange = (val: string) => {
  if (val === 'remote') {
    // 默认切到列表第一个，或者保持原样
    if (!isRemoteOrCustom.value) updateValue(remoteFonts.value[0]?.family || '');
  } else {
    updateValue(val);
  }
};

const handleRemoteFontChange = (val: string) => {
  if (val === '__custom__') {
    updateValue('');
  } else {
    updateValue(val);
  }
};

const updateValue = (val: any) => {
  updateSetting(storageKey.value, val);
};

const handleNumberInput = (rawValue: string | number) => {
  const clamped = clampSettingNumber(String(rawValue), props.config);
  if (clamped !== null) {
    updateValue(clamped);
  }
};

const toggleBooleanSetting = () => {
  updateValue(!currentValue.value);
};

const handleRowToggle = (e: Event) => {
  if (!isRowToggleEnabled.value) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest('input, select, button, a, textarea, .lw-toggle, .setting-meta-control')) {
    return;
  }
  toggleBooleanSetting();
};

// 专用于 nexus-select 类型的预设拉取
const availableNexusPresets = computed(() => {
  if (props.config.type === 'nexus-select') {
    return (lwStorage as any).get('nexus.presets', [], 'Global');
  }
  return [];
});

const onScopeValueChange = (value: string) => {
  currentScope.value = value;
  updateScope(storageKey.value, value);
};

const settingControlStyle = computed(() => settingsControlSkinVars.value);
</script>


<style scoped>
.setting-row {
  display: flex;
  flex-wrap: wrap; /* 允许在窄屏时换行 */
  gap: 8px 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--lw-border-base);
  transition: var(--lw-transition);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row.is-row-toggle {
  cursor: pointer;
}

.setting-row.is-row-toggle:focus-visible {
  outline: 2px solid rgba(92, 139, 246, 0.28);
  outline-offset: 4px;
  border-radius: var(--lw-radius-sm);
}

/* 水平排版：开关类控件（标签左，控件右） */
.setting-row.layout-horizontal {
  align-items: center;
}

/* 水平排版悬停时给予轻微背景反馈 */
.setting-row.layout-horizontal:hover {
  background: var(--lw-setting-row-hover-bg, var(--lw-bg-hover));
  margin-left: -12px;
  margin-right: -12px;
  padding-left: 12px;
  padding-right: 12px;
  border-radius: var(--lw-radius-sm);
  border-bottom-color: transparent;
}

/* 垂直排版：复杂控件（标签上，控件下） */
.setting-row.layout-vertical {
  align-items: flex-start;
}

.setting-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1; /* 恢复为自由伸缩，不再强制 180px 基础宽度 */
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
  align-items: flex-start;
  gap: 10px;
  justify-content: space-between;
  flex-wrap: wrap;
}

/* 水平布局：正常标签样式 */
.setting-label {
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
  color: var(--lw-text-main);
  min-width: 120px; /* 防止在窄屏下被挤压导致文字垂直堆叠 */
}

/* 垂直布局：高对比度小标题样式（取消大写，提高可读性） */
.layout-vertical .setting-label {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-muted);
  font-weight: var(--lw-type-label-small-weight);
  text-transform: uppercase;
}

.setting-description {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-muted);
}

/* 控件容器 */
.setting-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  align-items: flex-start;
  min-width: 0;
}

.layout-horizontal .setting-options {
  justify-content: flex-end;
  flex: 0 1 auto;
}

.layout-vertical .setting-options {
  justify-content: flex-start;
  align-items: stretch;
  width: 100%;
}

.setting-options.full-width {
  width: 100%;
}

.setting-meta-control {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
}

.scope-select,
.setting-control-body .lw-select,
.setting-control-body .lw-input {
  min-height: 36px;
  border-radius: 18px;
  border: 1px solid var(--lw-setting-control-border, var(--lw-border-base));
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
  color: var(--lw-text-main);
  transition: var(--lw-transition);
}

.scope-select {
  min-height: 32px;
  width: 88px;
  min-width: 88px;
  max-width: 88px;
  padding: 0 32px 0 12px;
  border-radius: 16px;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-secondary);
  outline: none;
  cursor: pointer;
}

.compact-scope {
  min-height: 30px;
  width: 84px;
  min-width: 84px;
  max-width: 84px;
  padding-inline: 10px 28px;
  border-radius: 15px;
}

.scope-select:hover,
.setting-control-body .lw-select:hover,
.setting-control-body .lw-input:hover {
  border-color: var(--lw-setting-control-border, var(--lw-border-base));
  background: var(--lw-bg-hover);
}

.scope-select:focus,
.setting-control-body .lw-select:focus,
.setting-control-body .lw-input:focus {
  border-color: var(--lw-primary);
  box-shadow: 0 0 0 3px rgba(92, 139, 246, 0.12);
  background: var(--lw-setting-control-active-bg, var(--lw-bg-surface));
}

.setting-control-body {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.layout-horizontal .setting-control-body {
  justify-content: flex-end;
}

.layout-vertical .setting-control-body {
  width: 100%;
}

.setting-options.full-width > .setting-control-body {
  width: 100%;
  max-width: 100%;
}

.setting-control-body.options-control,
.setting-control-body.theme-options {
  width: 100%;
}

/* ---- Segment Control ---- */
.segment-control-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.segment-control {
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
  border-radius: 18px;
  padding: 2px;
  display: flex;
  gap: 2px;
  border: 1px solid var(--lw-setting-control-border, var(--lw-border-base));
  flex-wrap: wrap;
  min-height: 36px;
  align-items: stretch;
}

.segment-control button {
  background: transparent;
  border: none;
  padding: 0 14px;
  min-height: 32px;
  border-radius: 16px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
  cursor: pointer;
  transition: var(--lw-transition);
  white-space: nowrap;
  flex: 1;
}

.segment-control button.active {
  background: var(--lw-setting-control-active-bg, var(--lw-bg-surface));
  color: var(--lw-text-main);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.segment-control button:hover:not(.active) {
  color: var(--lw-text-main);
  background: var(--lw-bg-active);
}

.option-description-tip {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-muted);
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
  padding: 6px 10px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--lw-setting-tip-border, var(--lw-primary)) 22%, var(--lw-border-subtle));
}

.stepper-control {
  align-items: center;
}

.stepper-control .setting-control-body {
  width: auto;
}

.stepper-body {
  flex: 0 0 auto;
}

.setting-control-body :deep(.lw-stepper) {
  flex: 0 0 auto;
}

.setting-control-body :deep(.lw-select) {
  width: 100%;
  padding: 0 40px 0 14px;
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
}

.setting-control-body :deep(.lw-input) {
  width: 100%;
  padding: 0 14px;
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.font-preset-select {
  width: 100%;
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
  background: var(--lw-setting-slider-track, #f1f5f9);
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
  border: 1px solid var(--lw-setting-control-border, var(--lw-border-base));
  border-radius: var(--lw-radius-sm);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
  color: var(--lw-text-main);
  text-align: center;
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
  transition: var(--lw-transition);
  outline: none;
  font-family: inherit;
}

.slider-number-input:focus {
  background: var(--lw-setting-control-active-bg, var(--lw-bg-surface));
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
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
  border: 1px solid var(--lw-setting-control-border, var(--lw-border-base));
  border-radius: var(--lw-radius-sm);
}

.font-preview-card {
  padding: 16px 20px;
  background: var(--lw-setting-control-active-bg, var(--lw-bg-surface));
  border: 1px solid var(--lw-setting-control-border, var(--lw-border-base));
  border-radius: var(--lw-radius-sm);
  font-size: var(--lw-type-body-large-size);
  line-height: var(--lw-type-body-large-line-height);
  font-weight: var(--lw-type-body-large-weight);
  letter-spacing: var(--lw-type-body-large-tracking);
  color: var(--lw-text-main);
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: var(--lw-shadow);
}

.setting-row[data-skin-variant='discord'] .segment-control {
  border-radius: 14px;
}

.setting-row[data-skin-variant='discord'] .segment-control button {
  border-radius: 12px;
}

.setting-row[data-skin-variant='discord'] .scope-select,
.setting-row[data-skin-variant='discord'] .setting-control-body .lw-select,
.setting-row[data-skin-variant='discord'] .setting-control-body .lw-input,
.setting-row[data-skin-variant='discord'] .slider-number-input {
  border-radius: 12px;
}

.setting-row[data-skin-variant='telegram'] {
  border-bottom-color: var(--lw-border-subtle);
  min-height: 44px;
}

.setting-row[data-skin-variant='telegram'].layout-horizontal:hover {
  background: color-mix(in srgb, var(--lw-primary) 7%, transparent);
}

.setting-row[data-skin-variant='telegram'] .segment-control,
.setting-row[data-skin-variant='telegram'] .scope-select,
.setting-row[data-skin-variant='telegram'] .setting-control-body .lw-select,
.setting-row[data-skin-variant='telegram'] .setting-control-body .lw-input,
.setting-row[data-skin-variant='telegram'] .slider-number-input,
.setting-row[data-skin-variant='telegram'] .remote-font-picker,
.setting-row[data-skin-variant='telegram'] .font-preview-card,
.setting-row[data-skin-variant='telegram'] .option-description-tip {
  border-color: var(--lw-setting-control-border, var(--lw-border-subtle));
  background: color-mix(in srgb, var(--lw-setting-control-bg, var(--lw-surface-container)) 84%, transparent);
}

.setting-row[data-skin-variant='telegram'] .segment-control,
.setting-row[data-skin-variant='telegram'] .segment-control button,
.setting-row[data-skin-variant='telegram'] .scope-select,
.setting-row[data-skin-variant='telegram'] .setting-control-body .lw-select,
.setting-row[data-skin-variant='telegram'] .setting-control-body .lw-input {
  border-radius: 999px;
  min-height: 40px;
}

.setting-row[data-skin-variant='telegram'] .segment-control button.active {
  background: var(--lw-setting-control-active-bg, var(--lw-surface-container-high));
  box-shadow: var(--lw-setting-control-active-shadow, 0 8px 18px rgba(44, 92, 130, 0.1));
}

</style>
