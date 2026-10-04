<template>
  <div
    v-if="isVisible"
    class="setting-row"
    :class="[`kind-${controlKind}`, { 'is-row-toggle': isRowToggleEnabled }]"
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
        <label class="setting-label">{{ props.config.label }}</label>
        <button
          v-if="!isAtDefault"
          type="button"
          class="setting-meta-control setting-reset"
          :title="`恢复默认：${defaultValueLabel}`"
          :aria-label="`恢复 ${props.config.label} 的默认值`"
          @click.stop="resetSetting(storageKey, props.config)"
        >
          <RotateCcw :size="13" :stroke-width="2.2" aria-hidden="true" />
          <span>恢复默认</span>
        </button>
        <div v-if="hasScopeSelector" class="setting-meta-control setting-scope">
          <LuminaSelect class="scope-select compact-scope" size="sm" :modelValue="currentScope" @update:modelValue="onScopeValueChange" aria-label="设置作用域" title="作用域">
            <option v-for="scope in props.config.allowedScopes" :key="scope" :value="scope">
              {{ scopeLabels[scope] || scope }}
            </option>
          </LuminaSelect>
        </div>
      </div>
      <div class="setting-description" v-if="props.config.description">{{ props.config.description }}</div>
    </div>

    <div class="setting-options">
      <div class="setting-control-body">
        <!-- Theme Color Buttons -->
        <template v-if="props.config.type === 'theme'">
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
        <template v-else-if="props.config.type === 'options'">
          <template v-if="props.settingKey === 'fontFamily'">
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
          <template v-else-if="controlKind === 'select'">
            <div class="segment-control-container">
              <div class="setting-select-wrap">
                <LuminaSelect class="lw-select setting-select-field" :modelValue="String(displayedOptionValue)" :aria-label="props.config.label" @update:modelValue="value => updateValue(resolveSelectedOptionValue(resolvedOptions, value))">
                  <option v-for="opt in resolvedOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </LuminaSelect>
                <ChevronDown class="setting-select-chevron" :size="14" :stroke-width="2" aria-hidden="true" />
              </div>
              <div v-if="activeOptionDescription" class="option-description-tip">{{ activeOptionDescription }}</div>
            </div>
          </template>
          <template v-else>
            <div class="segment-control-container">
              <div class="segment-control">
                <button v-for="opt in resolvedOptions" :key="opt.value" type="button" :class="{ active: displayedOptionValue === opt.value }"
                  :aria-pressed="displayedOptionValue === opt.value"
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
        <template v-else-if="props.config.type === 'boolean'">
          <LuminaToggle class="lw-toggle" :modelValue="Boolean(currentValue)" @update:modelValue="updateValue" />
        </template>

        <!-- Stepper (LuminaStepper) 通用步进器 -->
        <template v-else-if="props.config.type === 'stepper'">
          <LuminaStepper :modelValue="currentValue" :min="props.config.min" :max="props.config.max" :step="props.config.step"
            @update:modelValue="updateValue" />
        </template>

        <!-- Slider -->
        <template v-else-if="props.config.type === 'slider'">
          <div class="slider-wrapper">
            <LuminaSlider :min="props.config.min" :max="props.config.max" :step="props.config.step" :modelValue="Number(currentValue)"
              @update:modelValue="updateValue" class="lw-slider-input" />
            <LuminaInput type="number" :min="props.config.min" :max="props.config.max" :step="props.config.step" :modelValue="currentValue"
              @update:modelValue="handleNumberInput" class="slider-number-input" />
          </div>
        </template>

        <!-- Nexus Select -->
        <template v-else-if="props.config.type === 'nexus-select'">
          <div class="setting-select-wrap">
            <LuminaSelect class="lw-select setting-select-field" :modelValue="currentValue" @update:modelValue="updateValue">
              <option value="">未指定 (使用 ST 全局模型)</option>
              <option v-for="preset in availableNexusPresets" :key="preset.id" :value="preset.id">
                ★ {{ preset.name }}
              </option>
            </LuminaSelect>
            <ChevronDown class="setting-select-chevron" :size="14" :stroke-width="2" aria-hidden="true" />
          </div>
        </template>

        <!-- Text Input -->
        <template v-else-if="props.config.type === 'text'">
          <LuminaInput type="text" class="lw-input" :modelValue="currentValue" @update:modelValue="updateValue"
            :placeholder="props.config.default || '请输入...'" />
        </template>

        <!-- Password Input -->
        <template v-else-if="props.config.type === 'password'">
          <LuminaInput type="password" autocomplete="off" class="lw-input" :modelValue="currentValue"
            @update:modelValue="updateValue" :placeholder="props.config.default || '请输入...'" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown, RotateCcw } from 'lucide-vue-next';
import { activeSettings, activeScopes, useSettings } from './useSettings.js';
import { lwStorage } from '../../api/storage.js';
import LuminaStepper from './LuminaStepper.vue';
import { LuminaInput, LuminaSelect, LuminaSlider, LuminaToggle } from '../../ui/primitives';
import { cn } from '../../ui/cn.js';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import { useSurfaceInput } from '../../platform/surface/useSurfaceRuntimeContext.js';
import {
  clampSettingNumber,
  getActiveSettingOptionDescription,
  getSettingScope,
  getSettingStorageKey,
  getSettingValue,
  hasSettingScopeSelector,
  isRowToggleSetting,
  isSettingAtDefault,
  isSettingVisible,
  resolveControlKind,
  resolveDisplayedOptionValue,
  resolveSelectedOptionValue,
  resolveSettingOptions,
  settingScopeLabels
} from './settingControlModel.js';

const { updateSetting, updateScope, resetSetting } = useSettings();
const { cssVars: settingsControlSkinVars, variant: settingsControlVariant } = useSurfaceSkin('settings.control');

const props = useSurfaceInput('settings.control');

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

const controlKind = computed(() => resolveControlKind(props.config));

// 存储值不在可选项中时（例如已卸载的桌面模式）显示实际生效的默认项
const displayedOptionValue = computed(() => resolveDisplayedOptionValue(resolvedOptions.value, currentValue.value, props.config.default));

// 计算当前激活选项的描述文字
const activeOptionDescription = computed(() => getActiveSettingOptionDescription(resolvedOptions.value, displayedOptionValue.value));

const isAtDefault = computed(() => isSettingAtDefault(activeSettings[storageKey.value], props.config.default));

const defaultValueLabel = computed(() => {
  const option = resolvedOptions.value.find(item => item.value === props.config.default);
  if (option) return option.label;
  if (typeof props.config.default === 'boolean') return props.config.default ? '开启' : '关闭';
  const text = String(props.config.default ?? '');
  return text === '' ? '空' : text;
});

const hasScopeSelector = computed(() => hasSettingScopeSelector(props.config));

const scopeLabels = settingScopeLabels;

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
/* 字段式排版：每行 = 标签/说明，下面跟一个整行控件字段 */
.setting-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  transition: var(--lw-transition);
}

.setting-row.is-row-toggle {
  cursor: pointer;
}

.setting-row.is-row-toggle:focus-visible {
  outline: 2px solid rgba(92, 139, 246, 0.28);
  outline-offset: 4px;
  border-radius: var(--lw-radius-sm);
}

.setting-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.label-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  justify-content: space-between;
  flex-wrap: wrap;
}

.setting-label {
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
  color: var(--lw-text-main);
  min-width: 0;
}

.setting-description {
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  font-weight: var(--lw-type-body-medium-weight);
  letter-spacing: var(--lw-type-body-medium-tracking);
  color: var(--lw-text-muted);
}

.setting-reset {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: auto;
  padding: 2px 8px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-muted);
  font: inherit;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  cursor: pointer;
  transition: background-color var(--lw-transition), color var(--lw-transition);
}

.setting-reset:hover,
.setting-reset:focus-visible {
  background: var(--lw-bg-hover);
  color: var(--lw-primary);
}

/* ---- 控件字段 ---- */
.setting-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.setting-control-body {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

/* 开关：整行灰底字段，开关在左，标签/说明在右 */
.kind-toggle {
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--lw-radius-xs);
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
}

.kind-toggle .setting-options {
  order: -1;
  width: auto;
  flex: 0 0 auto;
}

.kind-toggle .setting-label {
  display: block;
  min-height: 20px;
}

.kind-toggle .setting-control-body {
  width: auto;
}

.kind-toggle .setting-left {
  gap: 2px;
}

/* 下拉/输入框：整行灰底字段 */
.setting-control-body .lw-select,
.setting-control-body .lw-input {
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  /* 全局 .lw-select/.lw-input 用 !important 锁了盒装边框/背景，字段形态需要同级覆盖 */
  border: 0 !important;
  border-radius: var(--lw-radius-xs);
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle)) !important;
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  font-weight: var(--lw-type-body-medium-weight);
  letter-spacing: var(--lw-type-body-medium-tracking);
  outline: none;
}

.setting-control-body .lw-select:hover,
.setting-control-body .lw-input:hover {
  background: var(--lw-bg-hover) !important;
}

.setting-control-body .lw-select:focus,
.setting-control-body .lw-input:focus {
  border: 0 !important;
  background: var(--lw-bg-hover) !important;
  box-shadow: 0 0 0 3px rgba(var(--lw-primary-rgb), 0.12);
}

.setting-select-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.setting-select-wrap .setting-select-field {
  padding: 0 40px 0 14px;
  appearance: none;
  cursor: pointer;
}

.setting-select-chevron {
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  color: var(--lw-text-muted);
  pointer-events: none;
}

/* 作用域选择器 */
.setting-scope {
  margin-left: auto;
}

.scope-select {
  min-height: 30px;
  width: 88px;
  min-width: 88px;
  max-width: 88px;
  padding: 0 32px 0 12px;
  border: 1px solid var(--lw-setting-control-border, var(--lw-border-base));
  border-radius: 16px;
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  outline: none;
  cursor: pointer;
  transition: var(--lw-transition);
}

.compact-scope {
  min-height: 30px;
  width: 84px;
  min-width: 84px;
  max-width: 84px;
  padding-inline: 10px 28px;
  border-radius: 15px;
}

/* ---- 分段控件 ---- */
.segment-control-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.segment-control {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 4px;
  width: 100%;
  min-height: 44px;
  padding: 4px;
  border: 0;
  border-radius: var(--lw-radius-xs);
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
  transition: var(--lw-transition);
}

.segment-control button {
  flex: 1 1 auto;
  min-height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: calc(var(--lw-radius-xs) - 2px);
  background: transparent;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  font-weight: var(--lw-type-label-large-weight);
  letter-spacing: var(--lw-type-body-medium-tracking);
  cursor: pointer;
  transition: var(--lw-transition);
  white-space: nowrap;
}

.segment-control button.active {
  background: var(--lw-setting-control-active-bg, var(--lw-bg-elevated));
  color: var(--lw-text-main);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.segment-control button:hover:not(.active) {
  color: var(--lw-text-main);
  background: var(--lw-bg-hover);
}

/* 选中项说明 */
.option-description-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.option-description-tip svg {
  flex: 0 0 auto;
  margin-top: 2px;
}

/* ---- 主题色板 ---- */
.kind-theme .setting-control-body {
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--lw-radius-xs);
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
}

/* ---- 步进器：自身已是盒装控件，不再套一层字段 ---- */
.kind-stepper .setting-control-body {
  justify-content: flex-start;
}

.kind-stepper .setting-control-body > * {
  flex: 0 0 auto;
  width: auto;
}

/* ---- 滑块 ---- */
.kind-slider .setting-control-body {
  padding: 14px;
  border-radius: var(--lw-radius-xs);
  background: var(--lw-setting-control-bg, var(--lw-bg-subtle));
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.lw-slider-input {
  flex: 1;
  height: 6px;
  background: color-mix(in srgb, var(--lw-text-muted) 20%, transparent);
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
  width: 64px;
  min-height: 36px;
  padding: 6px 8px;
  border: 0;
  border-radius: calc(var(--lw-radius-xs) - 2px);
  background: var(--lw-setting-control-active-bg, var(--lw-bg-elevated));
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
  color: var(--lw-text-main);
  text-align: center;
  outline: none;
  font-family: inherit;
  transition: var(--lw-transition);
}

.slider-number-input:focus {
  box-shadow: 0 0 0 3px rgba(var(--lw-primary-rgb), 0.12);
}

/* ---- 字体选择 ---- */
.font-selector-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.font-preset-select {
  width: 100%;
}

.remote-font-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background: var(--lw-setting-control-active-bg, var(--lw-bg-elevated));
  border-radius: var(--lw-radius-xs);
}

.font-custom-input {
  width: 100%;
}

.font-preview-card {
  padding: 16px 20px;
  background: var(--lw-setting-control-active-bg, var(--lw-bg-elevated));
  border-radius: var(--lw-radius-xs);
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
}
</style>
