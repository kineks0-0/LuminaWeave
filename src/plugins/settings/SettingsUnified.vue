<template>
  <div class="settings-unified" :style="unifiedSkinStyle">
    <!-- 对话同步与系统权限管理 -->
    <div class="plugin-settings-block permissions-block lw-card">
      <div class="block-header">
        <div class="block-title">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>权限与系统同步</span>
        </div>
        <div class="sync-badges">
          <span class="badge" :class="syncInfo.status">{{ syncLabel }}</span>
        </div>
      </div>
      <div class="sync-content">
        <div class="sync-meta">
          <div class="meta-item">
            <span class="label">存储策略:</span>
            <span class="value">{{ syncInfo.policy === 'st' ? 'ST 原生' : '独立 JSON' }}</span>
          </div>
          <div class="status-detail">
            <span>消息总数: <b>{{ syncInfo.details.messageCount }}</b></span>
            <span v-if="syncInfo.details.stCount"> (ST: {{ syncInfo.details.stCount }})</span>
            <span> | 耗时: {{ syncInfo.details.duration }}ms</span>
          </div>
          <div class="status-detail">
            <span>存储模式: <b style="color:var(--lw-primary)">{{ syncInfo.details.storageType || 'JSONL' }}</b></span>
            <span> | 差异: <b :style="{ color: syncInfo.details.diffCount > 0 ? '#f97316' : '#22c55e' }">{{
              syncInfo.details.diffCount }}</b> 项</span>
          </div>
        </div>
        <div class="sync-actions">
          <button class="lw-btn lw-btn-primary" :disabled="syncInfo.status === 'syncing'" @click="handleForceSync">
            <svg :class="{ 'spin': syncInfo.status === 'syncing' }" viewBox="0 0 24 24" width="14" height="14"
              stroke="currentColor" stroke-width="2" fill="none">
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            {{ syncInfo.status === 'syncing' ? '正在同步...' : '立即强制全量同步' }}
          </button>
        </div>
        <div v-if="syncInfo.error" class="sync-error">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {{ syncInfo.error }}
        </div>

        <!-- 权限控制项 -->
        <div class="permissions-list">
          <div class="permission-item" v-for="p in pluginPermissionsList" :key="p.id">
            <div class="perm-info">
              <span class="plugin-icon" v-html="p.icon"></span>
              <span class="perm-name">{{ p.name }} 提示词注入</span>
            </div>
            <label class="lw-toggle">
              <input type="checkbox" v-model="p.enabled" @change="togglePluginPermission(p)" />
              <span class="lw-toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 差异详情查看器 -->
        <div v-if="syncDiff && syncDiff.diffCount > 0" class="sync-diff-viewer">
          <div class="diff-header">检测到数据差异 ({{ syncDiff.diffCount }} 项)</div>
          <div class="diff-actions">
            <button class="lw-btn lw-btn-ghost lw-btn-small" @click="openDetailedDiff">详细差异</button>
            <button class="lw-btn lw-btn-ghost lw-btn-small" @click="overwriteToIndependent">覆盖独立存储</button>
            <button class="lw-btn lw-btn-ghost lw-btn-small" @click="overwriteToST">回写至 ST</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 顶级：存储引擎设置 -->
    <div class="plugin-settings-block engine-block lw-card">
      <div class="block-header">
        <div class="block-title">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z">
            </path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <span>全局流式与存储策略</span>
        </div>
      </div>
      <div class="engine-content">
        <div class="setting-item">
          <label class="lw-toggle-label">
            <span class="label-text">仅输出 Chat_Reply 内容 (流式过滤)</span>
            <span class="label-desc">开启后，将屏蔽预思考与动作标签（如 Character_Action），仅展示回复主体。</span>
          </label>
          <label class="lw-toggle">
            <input type="checkbox" v-model="filterChatReply" @change="onFilterChatReplyChange" />
            <span class="lw-toggle-slider"></span>
          </label>
        </div>
        <div class="setting-item" v-if="filterChatReply">
          <label class="lw-toggle-label" style="padding-left: 20px; border-left: 2px solid var(--lw-primary-bg);">
            <span class="label-text">展示非标签正文 (顶层文本保护)</span>
            <span class="label-desc">开启后，如果模型输出了不带任何标签的文本，将予以显示。关闭则强制仅显示指定标签内容。</span>
          </label>
          <label class="lw-toggle">
            <input type="checkbox" v-model="allowTopLevelInFilter" @change="onAllowTopLevelChange" />
            <span class="lw-toggle-slider"></span>
          </label>
        </div>
        <div class="setting-item" v-if="filterChatReply">
          <label class="lw-toggle-label" style="padding-left: 20px; border-left: 2px solid var(--lw-primary-bg);">
            <span class="label-text">起始非标签内容视为思考 (thinking)</span>
            <span class="label-desc">开启后，如果消息开头是普通文本而非标签，将自动被视为思考过程并予以隐藏（直到遇到下一个标签）。</span>
          </label>
          <label class="lw-toggle">
            <input type="checkbox" v-model="implicitThinkingInFilter" @change="onImplicitThinkingChange" />
            <span class="lw-toggle-slider"></span>
          </label>
        </div>
        <div class="setting-item" v-if="filterChatReply && implicitThinkingInFilter">
          <label class="lw-toggle-label" style="padding-left: 40px; border-left: 2px solid var(--lw-primary-bg);">
            <span class="label-text">激进模式 (强制过滤直到 &lt;/thinking&gt;)</span>
            <span class="label-desc">开启后，首个 &lt;/thinking&gt; 标签及其之前的所有内容都将被视为思考过程而予以隐藏。</span>
          </label>
          <label class="lw-toggle">
            <input type="checkbox" v-model="aggressiveThinking" @change="onAggressiveThinkingChange" />
            <span class="lw-toggle-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <label class="lw-toggle-label">
            <span class="label-text">流式无限输出 (不限制 max_tokens)</span>
            <span class="label-desc">开启后，将不向后端传递 max_tokens，由大模型自行决定输出长度。</span>
          </label>
          <label class="lw-toggle">
            <input type="checkbox" v-model="unlimitedResponse" @change="onUnlimitedResponseChange" />
            <span class="lw-toggle-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <label class="lw-toggle-label">
            <span class="label-text">思维链显示模式</span>
            <span class="label-desc">同时作用于聊天面板和 Forge 工作台。正文保持独立显示，思维链仅作为单独折叠区出现。</span>
          </label>
          <select class="lw-select thinking-mode-select" v-model="thinkingDisplayMode" @change="onThinkingDisplayModeChange">
            <option value="collapsible">可折叠显示</option>
            <option value="hidden">隐藏思维链</option>
          </select>
        </div>
        <div class="setting-item" v-if="thinkingDisplayMode === 'collapsible'">
          <label class="lw-toggle-label">
            <span class="label-text">无输出时自动展开思维链</span>
            <span class="label-desc">开启后，当消息只有思维链内容、没有正文输出时，自动展开思维链区域；一旦出现正文则自动收起。</span>
          </label>
          <label class="lw-toggle">
            <input type="checkbox" v-model="thinkingAutoExpand" @change="onThinkingAutoExpandChange" />
            <span class="lw-toggle-slider"></span>
          </label>
        </div>
        <div class="engine-desc" style="margin-top: 16px;">
          选择【全局】作用域配置项的物理持久化位置。切换引擎后将重新拉取该区域的数据。
        </div>
        <div class="radio-group">
          <label class="radio-label active">
            <input type="radio" :checked="true" disabled />
            <div class="radio-text">
              <span class="radio-title">{{ storageState.title }}</span>
              <span class="radio-sub">{{ storageState.sub }}</span>
            </div>
          </label>
        </div>
      </div>
    </div>

    <!-- 备份与迁移控制台 -->
    <div class="plugin-settings-block migration-block lw-card">
      <div class="block-header">
        <div class="block-title">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <span>备份与迁移</span>
        </div>
      </div>
      <div class="block-content migration-content">
        <div class="scope-selector">
          <div class="scope-item">
            <label class="lw-checkbox-label">
              <input type="checkbox" v-model="migrationScope.apis" />
              <span>API 接口配置</span>
            </label>
          </div>
          <div class="scope-item">
            <label class="lw-checkbox-label">
              <input type="checkbox" v-model="migrationScope.presets" />
              <span>Nexus 编排预设</span>
            </label>
          </div>
          <div class="scope-item">
            <label class="lw-checkbox-label">
              <input type="checkbox" v-model="migrationScope.chat" />
              <span>对话/流式过滤设置</span>
            </label>
          </div>
          <div class="scope-item">
            <label class="lw-checkbox-label">
              <input type="checkbox" v-model="migrationScope.general" />
              <span>系统常规偏好</span>
            </label>
          </div>
        </div>

        <div class="migration-actions">
          <button class="lw-btn lw-btn-primary lw-btn-small" @click="handleExport">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            导出选定范围
          </button>
          <div class="import-wrapper">
            <button class="lw-btn lw-btn-secondary lw-btn-small" @click="triggerImport">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              导入配置
            </button>
            <input type="file" ref="importFileInput" style="display: none" accept=".json" @change="handleImportFile" />
          </div>
        </div>
        <div class="migration-hint">
          * 导入操作将根据选定范围覆盖当前配置，请谨慎操作。
        </div>
      </div>
    </div>

    <!-- LLM 模型与生成系统 -->
    <div class="plugin-settings-block llm-block lw-card">
      <div class="block-header">
        <div class="block-title">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path
              d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6">
            </path>
            <line x1="2" y1="20" x2="2.01" y2="20"></line>
          </svg>
          <span>大模型编排枢纽</span>
        </div>
        <button class="icon-only-btn" @click="refreshLlmData" title="重新拉取">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>
      <div class="block-content">
        <NexusPresetManager />

        <div class="preset-row" v-if="genPresets.length > 0">
          <label>全局生成参数设定</label>
          <select v-model="activeGenPreset" @change="onGenPresetChange" class="lw-select">
            <option v-for="p in genPresets" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- 上下文窗口与概览控制 (DCC) -->
    <div class="plugin-settings-block context-block lw-card">
      <div class="block-header">
        <div class="block-title">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>上下文窗口与概览控制 (DCC)</span>
        </div>
      </div>
      <div class="block-content">
        <div class="engine-desc" style="margin-bottom: 12px;">
          动态管理长对话历史的发送策略。超出全量范围的消息将以“概览标签”形式发送以节省 Context。
        </div>

        <!-- 1. 全量区设置 -->
        <div class="dcc-section">
          <div class="dcc-section-label">全量发送范围 (Full Content)</div>
          <SettingControl v-if="chatManifest['contextControl.fullMode']"
            pluginId="lumina-chat" settingKey="contextControl.fullMode" :config="chatManifest['contextControl.fullMode']" />
          <SettingControl v-if="chatManifest['contextControl.fullValueCount']"
            pluginId="lumina-chat" settingKey="contextControl.fullValueCount" :config="chatManifest['contextControl.fullValueCount']" />
          <SettingControl v-if="chatManifest['contextControl.fullValueToken']"
            pluginId="lumina-chat" settingKey="contextControl.fullValueToken" :config="chatManifest['contextControl.fullValueToken']" />
          <SettingControl v-if="chatManifest['contextControl.fullValueChar']"
            pluginId="lumina-chat" settingKey="contextControl.fullValueChar" :config="chatManifest['contextControl.fullValueChar']" />
        </div>
        
        <!-- 2. 概览区设置 -->
        <div class="dcc-section dcc-section-summary">
          <div class="dcc-section-label">概览发送范围 (Summary/Overview)</div>
          <SettingControl v-if="chatManifest['contextControl.summaryMode']"
            pluginId="lumina-chat" settingKey="contextControl.summaryMode" :config="chatManifest['contextControl.summaryMode']" />
          <SettingControl v-if="chatManifest['contextControl.summaryValueCount']"
            pluginId="lumina-chat" settingKey="contextControl.summaryValueCount" :config="chatManifest['contextControl.summaryValueCount']" />
          <SettingControl v-if="chatManifest['contextControl.summaryValueToken']"
            pluginId="lumina-chat" settingKey="contextControl.summaryValueToken" :config="chatManifest['contextControl.summaryValueToken']" />
          <SettingControl v-if="chatManifest['contextControl.summaryValueChar']"
            pluginId="lumina-chat" settingKey="contextControl.summaryValueChar" :config="chatManifest['contextControl.summaryValueChar']" />
        </div>
        
        <!-- 3. 进阶参数 -->
        <div class="dcc-section dcc-section-advanced">
          <SettingControl v-if="chatManifest['contextControl.tokenMaxFloat']"
            pluginId="lumina-chat" settingKey="contextControl.tokenMaxFloat" :config="chatManifest['contextControl.tokenMaxFloat']" />
          <div class="dcc-paired-settings">
            <SettingControl v-if="directorManifest['fullSplit']"
              pluginId="lumina-director" settingKey="fullSplit" :config="directorManifest['fullSplit']" />
            <SettingControl v-if="directorManifest['fullFloating']"
              pluginId="lumina-director" settingKey="fullFloating" :config="directorManifest['fullFloating']" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeDesktopModeBlock" class="plugin-settings-block lw-card core-block desktop-mode-block">
      <div class="block-header">
        <div class="block-title">
          <span class="plugin-icon-wrap" v-html="activeDesktopModeBlock.pluginIcon"></span>
          <span>{{ activeDesktopModeBlock.pluginName }} - 桌面模式</span>
        </div>
        <button class="lw-btn lw-btn-ghost lw-btn-small" @click="$emit('open-detail', activeDesktopModeBlock.pluginId)">
          模式详情
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <div class="block-content">
        <div class="engine-desc">
          当前桌面模式提供的附加设置。这里的选项会直接影响当前桌面模式下的聊天流、侧栏、设置面板和时间线表现。
        </div>
        <div class="desktop-mode-shell-label">
          当前壳层：{{ activeDesktopModeShellLabel }}
        </div>
        <div v-if="activeDesktopModeDescription" class="desktop-mode-summary">
          {{ activeDesktopModeDescription }}
        </div>
        <SettingControl
          v-for="key in activeDesktopModeBlock.commonKeys"
          :key="key"
          :pluginId="activeDesktopModeBlock.pluginId"
          :settingKey="key"
          :config="activeDesktopModeBlock.manifest[key]"
        />
      </div>
    </div>

    <!-- 各子插件的常用设置 -->
    <div v-for="block in unifiedBlocks" :key="block.pluginId" class="plugin-settings-block lw-card"
      :class="{ 'core-block': block.pluginId === 'lumina-settings' }">
      <div class="block-header">
        <div class="block-title">
          <span class="plugin-icon-wrap" v-html="block.pluginIcon"></span>
          <span>{{ block.pluginName }} - 常用偏好</span>
        </div>
        <button v-if="block.hasMore" class="lw-btn lw-btn-ghost lw-btn-small"
          @click="$emit('open-detail', block.pluginId)">
          更详细
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <div class="block-content">
        <SettingControl v-for="key in block.commonKeys" :key="key" :pluginId="block.pluginId" :settingKey="key"
          :config="block.manifest[key]" />
        <component
          v-if="block.inlineComponent"
          :is="block.inlineComponent"
          style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--lw-border-subtle);"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { pluginManager } from '../../core/PluginManager';
import SettingControl from './SettingControl.vue';
import NexusPresetManager from './NexusPresetManager.vue';
import { activeSettings, useSettings } from './useSettings';
import { lwStorage } from '../../api/storage';
import { LuminaWeaveAPI } from '../../api/index';
import { getSettingsEntry, getVisibleSettingsEntries } from './settingsRegistry';
import { useComponentSkin } from '../../theme/useComponentSkin';
import { getActiveDesktopModeIdFromSettings, getDesktopModeOrDefault, getDesktopModeSettingsPluginId } from '../../theme/themeRegistry';

const { initSettings } = useSettings();
const { cssVars } = useComponentSkin('settings.unified');
const unifiedSkinStyle = computed(() => cssVars.value);
const activeThemeId = computed(() => getActiveDesktopModeIdFromSettings(activeSettings));

const openDetailedDiff = () => {
  (window as any).LuminaWeave?.openConflictViewer();
};

defineEmits<{
  (e: 'open-detail', pluginId: string): void
}>();
const isIndependent = ref(lwStorage.useIndependentGlobalStorage);

const storageState = computed(() => {
  const isTauri = (window as any).__TAURITAVERN__;
  if (isTauri) {
    return {
      title: '独立 JSON 存储 (TauriTavern 本地模式)',
      sub: '当前由于检测到 Tauri 宿主环境已自动开启。数据持久化至应用程序目录，无需 LuminaServer 即可直接回溯与同步。'
    };
  }
  return {
    title: '独立 JSONL 剥离 (高级全栈模式)',
    sub: '系统检测到全栈服务端模式已强制开启。数据保存至 LuminaServer 数据目录，支持高性能 Timeline 分支回溯。'
  };
});
const migrationScope = ref({
  apis: true,
  presets: true,
  chat: true,
  general: true
});

const getKeysFromScope = () => {
  const keys: string[] = [];
  if (migrationScope.value.apis) keys.push('nexus.apis');
  if (migrationScope.value.presets) keys.push('nexus.presets');
  if (migrationScope.value.chat) {
    keys.push('lumina-chat.filterChatReply', 'lumina-chat.allowTopLevelInFilter', 'lumina-chat.implicitThinkingInFilter', 'lumina-chat.aggressiveThinking', 'lumina-chat.unlimitedResponse');
  }
  if (migrationScope.value.general) {
    keys.push('lumina-settings.thinkingDisplayMode', 'lumina-settings.thinkingAutoExpand', 'nexus.useSSE');
  }
  return keys;
};

const handleExport = () => {
  const data: Record<string, any> = {};
  const keys = getKeysFromScope();
  
  keys.forEach(key => {
    const val = lwStorage.get(key, undefined, 'Global');
    if (val !== undefined) data[key] = val;
  });

  if (Object.keys(data).length === 0) {
    (window as any).LuminaWeave?.showToast('没有可导出的数据，请至少勾选一项。', 'warning');
    return;
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `LuminaWeave_Backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  (window as any).LuminaWeave?.showToast('配置导出成功！', 'success');
};

const importFileInput = ref<HTMLInputElement | null>(null);

const triggerImport = () => {
  importFileInput.value?.click();
};

const handleImportFile = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const content = event.target?.result as string;
      const data = JSON.parse(content);
      const keys = getKeysFromScope();
      
      const foundKeys = Object.keys(data).filter(k => keys.includes(k));
      if (foundKeys.length === 0) {
         (window as any).LuminaWeave?.showToast('所选文件不包含当前勾选范围内的任何有效配置。', 'warning');
         return;
      }

      if (confirm(`检测到 ${foundKeys.length} 项有效配项，确定要导入并覆盖当前设置吗？`)) {
        await (lwStorage as any).importData(data, foundKeys);
        (window as any).LuminaWeave?.showToast('配置导入成功！', 'success');
        // 刷新当前页面的响应式变量
        refreshFromStorage();
      }
    } catch (err) {
      console.error('[LuminaWeave] Import failed:', err);
      (window as any).LuminaWeave?.showToast('导入失败：文件格式错误。', 'error');
    } finally {
      if (importFileInput.value) importFileInput.value.value = '';
    }
  };
  reader.readAsText(file);
};

const refreshFromStorage = () => {
  filterChatReply.value = lwStorage.get('lumina-chat.filterChatReply', false, 'Global');
  allowTopLevelInFilter.value = lwStorage.get('lumina-chat.allowTopLevelInFilter', true, 'Global');
  implicitThinkingInFilter.value = lwStorage.get('lumina-chat.implicitThinkingInFilter', false, 'Global');
  aggressiveThinking.value = lwStorage.get('lumina-chat.aggressiveThinking', false, 'Global');
  unlimitedResponse.value = lwStorage.get('lumina-chat.unlimitedResponse', false, 'Global');
  thinkingDisplayMode.value = lwStorage.get('lumina-settings.thinkingDisplayMode', 'collapsible', 'Global');
  thinkingAutoExpand.value = Boolean(lwStorage.get('lumina-settings.thinkingAutoExpand', true, 'Global'));
};

const downloadJson = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify((lwStorage as any).globalIndependentData, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "LuminaWeave.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

onMounted(() => {
  initSettings();
  refreshLlmData();
  refreshSyncState();
  refreshPermissions();

  const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
  if (lw) {
    lw.on('CHAT_UPDATED', refreshSyncState);
    lw.on('CHAT_CONFLICT', refreshSyncState);
  }

  // 每 3 秒拉取一次最新模型与预设状态，并更新同步状态 (作为兜底)
  let timerId = setInterval(() => {
    refreshLlmData();
    refreshSyncState();
  }, 3000);

  onBeforeUnmount(() => {
    clearInterval(timerId);
    if (lw) {
      lw.off('CHAT_UPDATED', refreshSyncState);
      lw.off('CHAT_CONFLICT', refreshSyncState);
    }
  });
});

// ==== 大模型引擎控制状态 ====
const currentApi = ref<string>('');
const genPresets = ref<string[]>([]);
const activeGenPreset = ref<string>('');

const filterChatReply = ref(lwStorage.get('lumina-chat.filterChatReply', false, 'Global'));

const onFilterChatReplyChange = () => {
  lwStorage.set('lumina-chat.filterChatReply', filterChatReply.value, 'Global');
};

const allowTopLevelInFilter = ref(lwStorage.get('lumina-chat.allowTopLevelInFilter', true, 'Global'));

const onAllowTopLevelChange = () => {
  lwStorage.set('lumina-chat.allowTopLevelInFilter', allowTopLevelInFilter.value, 'Global');
};

const implicitThinkingInFilter = ref(lwStorage.get('lumina-chat.implicitThinkingInFilter', false, 'Global'));

const onImplicitThinkingChange = () => {
  lwStorage.set('lumina-chat.implicitThinkingInFilter', implicitThinkingInFilter.value, 'Global');
};

const aggressiveThinking = ref(lwStorage.get('lumina-chat.aggressiveThinking', false, 'Global'));

const onAggressiveThinkingChange = () => {
  lwStorage.set('lumina-chat.aggressiveThinking', aggressiveThinking.value, 'Global');
};

const unlimitedResponse = ref(lwStorage.get('lumina-chat.unlimitedResponse', false, 'Global'));

const onUnlimitedResponseChange = () => {
  lwStorage.set('lumina-chat.unlimitedResponse', unlimitedResponse.value, 'Global');
};

const thinkingDisplayMode = ref(lwStorage.get('lumina-settings.thinkingDisplayMode', 'collapsible', 'Global'));

const onThinkingDisplayModeChange = () => {
  lwStorage.set('lumina-settings.thinkingDisplayMode', thinkingDisplayMode.value, 'Global');
};

const thinkingAutoExpand = ref(Boolean(lwStorage.get('lumina-settings.thinkingAutoExpand', true, 'Global')));

const onThinkingAutoExpandChange = () => {
  lwStorage.set('lumina-settings.thinkingAutoExpand', thinkingAutoExpand.value, 'Global');
};

// ==== 子插件权限状态 ====
const pluginPermissionsList = ref<any[]>([]);

const refreshPermissions = () => {
  const list: any[] = [];
  Object.values(pluginManager.plugins).forEach(p => {
    if (p.id === 'lumina-settings') return;
    list.push({
      id: p.id,
      name: p.name,
      icon: p.icon,
      enabled: pluginManager.isPluginPromptEnabled(p.id)
    });
  });
  pluginPermissionsList.value = list;
};

const togglePluginPermission = (p: any) => {
  lwStorage.set(`lumina-settings.plugins.${p.id}.promptEnabled`, p.enabled, 'Global');
};


// ==== 同步状态响应式 ====
interface SyncInfo {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSync: string | null;
  error: string | null;
  policy: string;
  details: {
    messageCount: number;
    stCount: number;
    diffCount: number;
    duration: number;
    source: string;
    storageType?: string;
  };
}

const syncInfo = ref<SyncInfo>({
  status: 'idle',
  lastSync: null,
  error: null,
  policy: 'independent',
  details: { messageCount: 0, stCount: 0, diffCount: 0, duration: 0, source: 'ST' }
});

const syncDiff = ref<any>(null);

const syncLabel = computed(() => {
  const m: Record<string, string> = { idle: '就绪', syncing: '同步中', success: '完成', error: '同步异常' };
  return m[syncInfo.value.status] || '未知';
});

const refreshSyncState = () => {
  const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
  if (lw?.syncState) {
    syncInfo.value = { ...lw.syncState } as SyncInfo;
    syncDiff.value = lw.getSyncDiff ? lw.getSyncDiff() : null;
  }
};

const handleForceSync = async () => {
  const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
  if (lw?.forceSync) {
    await lw.forceSync();
    refreshSyncState();
  }
};

const overwriteToIndependent = async () => {
  const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
  if (lw?.syncFromST) {
    console.log('[Settings] 手动触发：覆盖至独立存储...');
    await lw.syncFromST();
    refreshSyncState();
  }
};

const overwriteToST = async () => {
  const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
  if (lw?.commitToST) {
    if (confirm('确定要将独立存储的数据回写并替换 ST 消息列表吗？此操作不可逆。')) {
      await lw.commitToST();
      alert('回写完成。');
      refreshSyncState();
    }
  }
};

const refreshLlmData = async () => {
  if (typeof (window as any).LuminaWeave === 'undefined') return;
  const lw = (window as any).LuminaWeave as LuminaWeaveAPI;

  let detectedApi = 'unknown';
  if (typeof (window as any).main_api === 'string') {
    detectedApi = (window as any).main_api;
  } else if (typeof (window as any).$ !== 'undefined') {
    detectedApi = (window as any).$('#main_api').val() || 'unknown';
  }
  currentApi.value = detectedApi;

  const parsePresets = (rawPresets: any): string[] => {
    if (!rawPresets) return [];
    if (Array.isArray(rawPresets)) return rawPresets;
    if (typeof rawPresets === 'object') {
      const keys = Object.keys(rawPresets);
      if (keys.length > 0 && !isNaN(Number(keys[0]))) {
        return Object.values(rawPresets).filter(v => typeof v === 'string') as string[];
      }
      return keys;
    }
    return [];
  };

  const fetchedGenPresets = await (lw as any).getPresets(currentApi.value);
  genPresets.value = parsePresets(fetchedGenPresets);
  activeGenPreset.value = await (lw as any).getActivePresetName(currentApi.value);
};

const onGenPresetChange = () => (window as any).LuminaWeave?.selectPreset(currentApi.value, activeGenPreset.value);

const chatManifest = computed(() => getSettingsEntry('lumina-chat')?.manifest || {});
const directorManifest = computed(() => getSettingsEntry('lumina-director')?.manifest || {});
// ==========================

interface UnifiedBlock {
  pluginId: string;
  pluginName: string;
  pluginIcon: string;
  kind: 'plugin' | 'desktop-mode';
  manifest: any;
  commonKeys: string[];
  hasMore: boolean;
  inlineComponent?: any;
}

const buildUnifiedBlock = (pluginId: string): UnifiedBlock | null => {
  const entry = getSettingsEntry(pluginId);
  if (!entry) return null;
  const manifest = entry.manifest;
  const commonKeys = Object.keys(manifest).filter(k => {
    if (!manifest[k].common) return false;
    if (pluginId === 'lumina-chat' && k.startsWith('contextControl.')) return false;
    return true;
  });
  const hasMore = Object.keys(manifest).length > commonKeys.length;

  if (commonKeys.length === 0 && !hasMore && !entry.settingsInlineComponent) {
    return null;
  }

  return {
    pluginId,
    pluginName: entry.pluginName,
    pluginIcon: entry.pluginIcon,
    kind: entry.kind,
    manifest,
    commonKeys,
    hasMore,
    inlineComponent: entry.settingsInlineComponent
  };
};

const activeDesktopModeBlock = computed(() => buildUnifiedBlock(getDesktopModeSettingsPluginId(activeThemeId.value)));
const activeDesktopModeDescription = computed(() => getDesktopModeOrDefault(activeThemeId.value).description || '');
const activeDesktopModeShellLabel = computed(() =>
  getDesktopModeOrDefault(activeThemeId.value).shell.kind === 'freeform' ? '自由工作台' : '传统桌面'
);

const unifiedBlocks = computed(() => {
  const blocks: UnifiedBlock[] = [];
  getVisibleSettingsEntries(activeThemeId.value).forEach(entry => {
    if (entry.kind !== 'plugin') return;
    const block = buildUnifiedBlock(entry.pluginId);
    if (block) {
      blocks.push(block);
    }
  });
  return blocks;
});
</script>

<style scoped>
.settings-unified {
  padding: var(--lw-panel-padding);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
  gap: var(--lw-settings-grid-gap, var(--lw-item-gap));
  background: transparent;
}

.core-block {
  grid-column: 1 / -1;
}

/* 让 block-content 以纵向 flex 排列，使 SettingControl 正确换行 */
.block-content {
  display: flex;
  flex-direction: column;
  padding-top: 4px;
}

.migration-content {
  gap: 16px;
}

.scope-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  background: var(--lw-bg-subtle);
  padding: 12px;
  border-radius: var(--lw-radius-sm);
  border: 1px solid var(--lw-border-subtle);
}

.lw-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--lw-text-main);
  cursor: pointer;
}

.lw-checkbox-label input {
  width: 14px;
  height: 14px;
  accent-color: var(--lw-primary);
}

.migration-actions {
  display: flex;
  gap: 12px;
}

.import-wrapper {
  position: relative;
}

.migration-hint {
  font-size: 11px;
  color: var(--lw-text-muted);
  font-style: italic;
}

/* 设置项 card 不需要跟交互卡片一样的悬浮抬升 */
.plugin-settings-block.lw-card:hover {
  box-shadow: none;
  border-color: var(--lw-border-base);
}

.desktop-mode-block {
  background: var(--lw-settings-block-bg, color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent));
  border-color: var(--lw-settings-block-border, var(--lw-border-base));
}

.desktop-mode-shell-label {
  width: fit-content;
  margin-bottom: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--lw-border-subtle);
  background: color-mix(in srgb, var(--lw-bg-subtle) 92%, transparent);
  color: var(--lw-text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.desktop-mode-summary {
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 94%, transparent);
  border: 1px solid var(--lw-border-subtle);
  color: var(--lw-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--lw-border-subtle);
  margin-bottom: 4px;
}

.block-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-main);
  display: flex;
  align-items: center;
  gap: 10px;
  letter-spacing: -0.01em;
}

.plugin-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-text-main);
  background: var(--lw-bg-subtle);
  padding: 6px;
  border-radius: 12px;
  width: 28px;
  height: 28px;
  border: 1px solid var(--lw-border-subtle);
}

.sync-badges {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.badge.idle {
  background: var(--lw-bg-active);
  color: var(--lw-text-secondary);
}

.badge.syncing {
  background: var(--lw-primary-soft);
  color: var(--lw-primary);
  animation: pulse 2s infinite;
}

.badge.success {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.badge.error {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

.sync-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.sync-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 92%, transparent);
  border-radius: var(--lw-radius-sm);
  border: 1px solid var(--lw-border-subtle);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item .label {
  color: var(--lw-text-muted);
  font-size: 11px;
  font-weight: 500;
}

.meta-item .value {
  color: var(--lw-text-main);
  font-size: 12px;
  font-weight: 600;
}

.status-detail {
  grid-column: 1 / -1;
  font-size: 11px;
  color: var(--lw-text-muted);
  border-top: 1px solid var(--lw-border-subtle);
  padding-top: 10px;
  margin-top: 2px;
}

.sync-actions {
  display: flex;
  gap: 12px;
}

.spin {
  animation: spin-anim 2s linear infinite;
}

@keyframes spin-anim {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* Permissions List */
.permissions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.permission-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-subtle);
  border-radius: 14px;
  transition: var(--lw-transition);
}

.permission-item:hover {
  border-color: var(--lw-border-base);
  background: var(--lw-bg-hover);
}

.perm-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.perm-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--lw-text-main);
}

.perm-info .plugin-icon :deep(svg) {
  width: 14px;
  height: 14px;
  color: var(--lw-text-muted);
}

/* Engine Settings */
.engine-desc {
  font-size: 12px;
  color: var(--lw-text-muted);
  margin-bottom: 16px;
  line-height: 1.6;
}

.radio-label {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius);
  cursor: default;
}

.radio-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-text-main);
  margin-bottom: 4px;
}

.radio-sub {
  display: block;
  font-size: 11px;
  color: var(--lw-text-muted);
  line-height: 1.5;
}

.backup-actions {
  margin-top: 16px;
}

/* LLM Block */
.preset-row {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--lw-border-subtle);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preset-row label {
  font-size: 11px;
  font-weight: 600;
  color: var(--lw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.icon-only-btn {
  padding: 8px;
  color: var(--lw-text-muted);
  background: transparent;
  border: none;
  border-radius: var(--lw-radius-sm);
  cursor: pointer;
  transition: var(--lw-transition);
}

.icon-only-btn:hover {
  background: var(--lw-bg-active);
  color: var(--lw-primary);
}

/* Sync Diff */
.sync-diff-viewer {
  margin-top: 8px;
  padding: 16px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.18);
  border-radius: var(--lw-radius);
}

.diff-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-warning);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.diff-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lw-btn-small {
  padding: 4px 10px;
  font-size: 11px;
}

/* ---- Engine Settings Configuration Items (Fixed) ---- */
/* ---- Engine Settings Configuration Items (Fixed) ---- */
.engine-content {
  display: flex;
  flex-direction: column;
}

.setting-item {
  display: flex;
  flex-wrap: wrap; /* 允许在空间极窄时换行 */
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 0;
  border-bottom: 1px solid var(--lw-border-subtle);
  gap: 12px 24px; /* 纵向和横向间距 */
}

.setting-item:last-child {
  border-bottom: none;
}

.lw-toggle-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto; /* 恢复自由缩放 */
  min-width: 0;
  cursor: pointer;
}

.label-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-text-main);
  line-height: 1.5;
  min-width: 120px; /* 防止在窄屏下被挤压导致文字垂直堆叠 */
}

.label-desc {
  font-size: 11px;
  color: var(--lw-text-muted);
  line-height: 1.6;
}

.lw-toggle {
  margin-top: 4px; /* 垂直微调，对齐首行文字 */
  cursor: pointer;
}

.thinking-mode-select {
  min-width: 160px;
  margin-top: 4px;
  flex-shrink: 0; /* 禁止下拉框被压缩 */
}

/* Radio Group styling */
.radio-group {
  margin-top: 14px;
}

.radio-text {
  flex: 1;
  min-width: 0;
}

.dcc-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dcc-section-summary {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--lw-border-subtle);
}

.dcc-section-advanced {
  margin-top: 18px;
  padding: 14px 16px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 92%, transparent);
  border: 1px solid var(--lw-border-subtle);
  border-radius: 18px;
}

.dcc-paired-settings {
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px dashed var(--lw-border-subtle);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 18px;
}

.dcc-section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-muted);
  text-transform: uppercase;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  letter-spacing: 0.05em;
}

.dcc-section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--lw-border-subtle);
  margin-left: 10px;
  opacity: 0.5;
}

@media (max-width: 920px) {
  .sync-meta,
  .scope-selector,
  .dcc-paired-settings {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .migration-actions,
  .sync-actions {
    flex-wrap: wrap;
  }

  .block-header {
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
