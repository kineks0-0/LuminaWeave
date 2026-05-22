<template>
  <div class="settings-unified tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] tw:gap-[var(--lw-settings-grid-gap,var(--lw-item-gap))] tw:bg-transparent tw:p-[var(--lw-settings-unified-padding,var(--lw-panel-padding))]" :data-skin-variant="unifiedVariant || 'default'" :style="unifiedSkinStyle">
    <!-- 对话同步与系统权限管理 -->
    <SettingsSectionPanel class="permissions-block">
      <SettingsBlockHeader title="权限与系统同步">
        <template #icon>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </template>
        <template #actions>
          <SettingsStatusBadge :status="syncInfo.status">{{ syncLabel }}</SettingsStatusBadge>
        </template>
      </SettingsBlockHeader>
      <div class="sync-content tw:flex tw:flex-col tw:gap-[18px]">
        <SettingsInsetPanel class="sync-meta tw:grid tw:grid-cols-2 tw:gap-3 tw:p-3.5 tw:max-[920px]:grid-cols-1">
          <SettingsMetaItem label="存储策略:">
            {{ syncInfo.policy === 'st' ? 'ST 原生' : '独立 JSON' }}
          </SettingsMetaItem>
          <div class="status-detail tw:col-span-full tw:mt-0.5 tw:border-t tw:border-lw-border-subtle tw:pt-2.5 tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:tabular-nums">
            <span>消息总数: <b>{{ syncInfo.details.messageCount }}</b></span>
            <span v-if="syncInfo.details.stCount"> (ST: {{ syncInfo.details.stCount }})</span>
            <span> | 耗时: {{ syncInfo.details.duration }}ms</span>
          </div>
          <div class="status-detail tw:col-span-full tw:mt-0.5 tw:border-t tw:border-lw-border-subtle tw:pt-2.5 tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:tabular-nums">
            <span>存储模式: <b style="color:var(--lw-primary)">{{ syncInfo.details.storageType || 'JSONL' }}</b></span>
            <span> | 差异: <b :style="{ color: syncInfo.details.diffCount > 0 ? '#f97316' : '#22c55e' }">{{
              syncInfo.details.diffCount }}</b> 项</span>
          </div>
        </SettingsInsetPanel>
        <div class="sync-actions tw:flex tw:gap-3 tw:max-[720px]:flex-wrap">
          <LuminaButton class="settings-action-button" tone="primary" :disabled="syncInfo.status === 'syncing'" @click="handleForceSync">
            <svg :class="syncInfo.status === 'syncing' ? 'tw:animate-spin' : undefined" viewBox="0 0 24 24" width="14" height="14"
              stroke="currentColor" stroke-width="2" fill="none">
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            {{ syncInfo.status === 'syncing' ? '正在同步...' : '立即强制全量同步' }}
          </LuminaButton>
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
        <div class="permissions-list tw:flex tw:flex-col tw:gap-2">
          <SettingsInsetPanel v-for="p in pluginPermissionsList" :key="p.id" interactive class="permission-item tw:flex tw:items-center tw:justify-between tw:gap-3 tw:px-3.5 tw:py-2.5">
            <div class="perm-info tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
              <span class="plugin-icon tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:text-lw-text-muted" v-html="p.icon"></span>
              <span class="perm-name tw:min-w-0 tw:truncate tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">{{ p.name }} 提示词注入</span>
            </div>
            <LuminaToggle
              :modelValue="Boolean(p.enabled)"
              :aria-label="`${p.name} 提示词注入`"
              @update:modelValue="value => updatePluginPermission(p, value)"
            />
          </SettingsInsetPanel>
        </div>

        <!-- 差异详情查看器 -->
        <div v-if="syncDiff && syncDiff.diffCount > 0" class="sync-diff-viewer tw:mt-2 tw:rounded-lw tw:border tw:border-[rgba(245,158,11,0.18)] tw:bg-[rgba(245,158,11,0.08)] tw:p-4">
          <div class="diff-header tw:mb-3.5 tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-warning tw:uppercase">检测到数据差异 ({{ syncDiff.diffCount }} 项)</div>
          <div class="diff-actions tw:flex tw:flex-wrap tw:gap-2">
            <LuminaButton class="settings-action-button" variant="ghost" size="sm" @click="openDetailedDiff">详细差异</LuminaButton>
            <LuminaButton class="settings-action-button" variant="ghost" size="sm" @click="overwriteToIndependent">覆盖独立存储</LuminaButton>
            <LuminaButton class="settings-action-button" variant="ghost" size="sm" @click="overwriteToST">回写至 ST</LuminaButton>
          </div>
        </div>
      </div>
    </SettingsSectionPanel>

    <!-- 顶级：存储引擎设置 -->
    <SettingsSectionPanel class="engine-block">
      <SettingsBlockHeader title="全局流式与存储策略">
        <template #icon>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z">
            </path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </template>
      </SettingsBlockHeader>
      <div class="engine-content tw:flex tw:flex-col">
        <div class="setting-item tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-x-6 tw:gap-y-3 tw:border-b tw:border-lw-border-subtle tw:py-4 tw:last:border-b-0">
          <div class="setting-copy tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
            <span class="label-text tw:min-w-[120px] tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">仅输出 Chat_Reply 内容 (流式过滤)</span>
            <span class="label-desc tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:text-pretty">开启后，将屏蔽预思考与动作标签（如 Character_Action），仅展示回复主体。</span>
          </div>
          <LuminaToggle
            v-model="filterChatReply"
            aria-label="仅输出 Chat_Reply 内容"
            @update:modelValue="onFilterChatReplyChange"
          />
        </div>
        <div class="setting-item tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-x-6 tw:gap-y-3 tw:border-b tw:border-lw-border-subtle tw:py-4 tw:last:border-b-0" v-if="filterChatReply">
          <div class="setting-copy tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1 tw:border-l-2 tw:border-[var(--lw-primary-bg)] tw:pl-5">
            <span class="label-text tw:min-w-[120px] tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">展示非标签正文 (顶层文本保护)</span>
            <span class="label-desc tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:text-pretty">开启后，如果模型输出了不带任何标签的文本，将予以显示。关闭则强制仅显示指定标签内容。</span>
          </div>
          <LuminaToggle
            v-model="allowTopLevelInFilter"
            aria-label="展示非标签正文"
            @update:modelValue="onAllowTopLevelChange"
          />
        </div>
        <div class="setting-item tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-x-6 tw:gap-y-3 tw:border-b tw:border-lw-border-subtle tw:py-4 tw:last:border-b-0" v-if="filterChatReply">
          <div class="setting-copy tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1 tw:border-l-2 tw:border-[var(--lw-primary-bg)] tw:pl-5">
            <span class="label-text tw:min-w-[120px] tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">起始非标签内容视为思考 (thinking)</span>
            <span class="label-desc tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:text-pretty">开启后，如果消息开头是普通文本而非标签，将自动被视为思考过程并予以隐藏（直到遇到下一个标签）。</span>
          </div>
          <LuminaToggle
            v-model="implicitThinkingInFilter"
            aria-label="起始非标签内容视为思考"
            @update:modelValue="onImplicitThinkingChange"
          />
        </div>
        <div class="setting-item tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-x-6 tw:gap-y-3 tw:border-b tw:border-lw-border-subtle tw:py-4 tw:last:border-b-0" v-if="filterChatReply && implicitThinkingInFilter">
          <div class="setting-copy tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1 tw:border-l-2 tw:border-[var(--lw-primary-bg)] tw:pl-10">
            <span class="label-text tw:min-w-[120px] tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">激进模式 (强制过滤直到 &lt;/thinking&gt;)</span>
            <span class="label-desc tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:text-pretty">开启后，首个 &lt;/thinking&gt; 标签及其之前的所有内容都将被视为思考过程而予以隐藏。</span>
          </div>
          <LuminaToggle
            v-model="aggressiveThinking"
            aria-label="激进模式"
            @update:modelValue="onAggressiveThinkingChange"
          />
        </div>
        <div class="setting-item tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-x-6 tw:gap-y-3 tw:border-b tw:border-lw-border-subtle tw:py-4 tw:last:border-b-0">
          <div class="setting-copy tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
            <span class="label-text tw:min-w-[120px] tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">流式无限输出 (不限制 max_tokens)</span>
            <span class="label-desc tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:text-pretty">开启后，将不向后端传递 max_tokens，由大模型自行决定输出长度。</span>
          </div>
          <LuminaToggle
            v-model="unlimitedResponse"
            aria-label="流式无限输出"
            @update:modelValue="onUnlimitedResponseChange"
          />
        </div>
        <div class="setting-item tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-x-6 tw:gap-y-3 tw:border-b tw:border-lw-border-subtle tw:py-4 tw:last:border-b-0">
          <div class="setting-copy tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
            <span class="label-text tw:min-w-[120px] tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">思维链显示模式</span>
            <span class="label-desc tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:text-pretty">同时作用于聊天面板和 Forge 工作台。正文保持独立显示，思维链仅作为单独折叠区出现。</span>
          </div>
          <LuminaSelect class="thinking-mode-select tw:mt-1 tw:min-w-40 tw:shrink-0" v-model="thinkingDisplayMode" size="sm" aria-label="思维链显示模式" @update:modelValue="onThinkingDisplayModeChange">
            <option value="collapsible">可折叠显示</option>
            <option value="hidden">隐藏思维链</option>
          </LuminaSelect>
        </div>
        <div class="setting-item tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-x-6 tw:gap-y-3 tw:border-b tw:border-lw-border-subtle tw:py-4 tw:last:border-b-0" v-if="thinkingDisplayMode === 'collapsible'">
          <div class="setting-copy tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
            <span class="label-text tw:min-w-[120px] tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">无输出时自动展开思维链</span>
            <span class="label-desc tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:text-pretty">开启后，当消息只有思维链内容、没有正文输出时，自动展开思维链区域；一旦出现正文则自动收起。</span>
          </div>
          <LuminaToggle
            v-model="thinkingAutoExpand"
            aria-label="无输出时自动展开思维链"
            @update:modelValue="onThinkingAutoExpandChange"
          />
        </div>
        <SettingsDescription class="tw:mt-4">
          选择【全局】作用域配置项的物理持久化位置。切换引擎后将重新拉取该区域的数据。
        </SettingsDescription>
        <div class="radio-group tw:mt-3.5">
          <SettingsInsetPanel as="label" class="radio-label active tw:flex tw:cursor-default tw:gap-3 tw:border-lw-border tw:p-3.5">
            <input type="radio" :checked="true" disabled />
            <div class="radio-text tw:min-w-0 tw:flex-1">
              <span class="radio-title tw:mb-1 tw:block tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text tw:text-balance">{{ storageState.title }}</span>
              <span class="radio-sub tw:block tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:text-pretty">{{ storageState.sub }}</span>
            </div>
          </SettingsInsetPanel>
        </div>
      </div>
    </SettingsSectionPanel>

    <!-- 备份与迁移控制台 -->
    <SettingsSectionPanel class="migration-block">
      <SettingsBlockHeader title="备份与迁移">
        <template #icon>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </template>
      </SettingsBlockHeader>
      <div class="block-content migration-content tw:flex tw:flex-col tw:gap-4 tw:pt-1">
        <SettingsInsetPanel class="scope-selector tw:grid tw:grid-cols-2 tw:gap-2.5 tw:p-3 tw:max-[920px]:grid-cols-1">
          <LuminaCheckbox v-model="migrationScope.apis">
            API 接口配置
          </LuminaCheckbox>
          <LuminaCheckbox v-model="migrationScope.presets">
            Nexus 编排预设
          </LuminaCheckbox>
          <LuminaCheckbox v-model="migrationScope.chat">
            对话/流式过滤设置
          </LuminaCheckbox>
          <LuminaCheckbox v-model="migrationScope.general">
            系统常规偏好
          </LuminaCheckbox>
        </SettingsInsetPanel>

        <div class="migration-actions tw:flex tw:gap-3 tw:max-[720px]:flex-wrap">
          <LuminaButton class="settings-action-button" tone="primary" size="sm" @click="handleExport">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            导出选定范围
          </LuminaButton>
          <div class="import-wrapper tw:relative">
            <LuminaButton class="settings-action-button" variant="soft" size="sm" @click="triggerImport">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              导入配置
            </LuminaButton>
            <input type="file" ref="importFileInput" style="display: none" accept=".json" @change="handleImportFile" />
          </div>
        </div>
        <SettingsDescription class="migration-hint tw:italic">
          * 导入操作将根据选定范围覆盖当前配置，请谨慎操作。
        </SettingsDescription>
      </div>
    </SettingsSectionPanel>

    <!-- LLM 模型与生成系统 -->
    <SettingsSectionPanel class="llm-block">
      <SettingsBlockHeader title="大模型编排枢纽">
        <template #icon>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path
              d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6">
            </path>
            <line x1="2" y1="20" x2="2.01" y2="20"></line>
          </svg>
        </template>
        <template #actions>
        <LuminaIconButton class="settings-action-button" ariaLabel="重新拉取大模型数据" title="重新拉取" size="sm" @click="refreshLlmData">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </LuminaIconButton>
        </template>
      </SettingsBlockHeader>
      <div class="block-content tw:flex tw:flex-col tw:pt-1">
        <NexusPresetManager />

        <div class="preset-row tw:mt-5 tw:flex tw:flex-col tw:gap-2.5 tw:border-t tw:border-lw-border-subtle tw:pt-5" v-if="genPresets.length > 0">
          <label class="tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">全局生成参数设定</label>
          <LuminaSelect v-model="activeGenPreset" size="sm" aria-label="全局生成参数设定" @update:modelValue="onGenPresetChange">
            <option v-for="p in genPresets" :key="p" :value="p">{{ p }}</option>
          </LuminaSelect>
        </div>
      </div>
    </SettingsSectionPanel>
    
    <!-- 上下文窗口与概览控制 (DCC) -->
    <SettingsSectionPanel class="context-block">
      <SettingsBlockHeader title="上下文窗口与概览控制 (DCC)">
        <template #icon>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </template>
      </SettingsBlockHeader>
      <div class="block-content tw:flex tw:flex-col tw:pt-1">
        <SettingsDescription class="tw:mb-3">
          动态管理长对话历史的发送策略。超出全量范围的消息将以“概览标签”形式发送以节省 Context。
        </SettingsDescription>

        <!-- 1. 全量区设置 -->
        <div class="dcc-section tw:flex tw:flex-col tw:gap-1">
          <div class="dcc-section-label tw:mb-2.5 tw:flex tw:items-center tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">
            <span class="tw:shrink-0">全量发送范围 (Full Content)</span>
            <span aria-hidden="true" class="tw:ml-2.5 tw:h-px tw:flex-1 tw:bg-lw-border-subtle tw:opacity-50"></span>
          </div>
          <SurfaceOutlet contract-id="settings.control" v-if="chatManifest['contextControl.fullMode']"
            pluginId="lumina-chat" settingKey="contextControl.fullMode" :config="chatManifest['contextControl.fullMode']" />
          <SurfaceOutlet contract-id="settings.control" v-if="chatManifest['contextControl.fullValueCount']"
            pluginId="lumina-chat" settingKey="contextControl.fullValueCount" :config="chatManifest['contextControl.fullValueCount']" />
          <SurfaceOutlet contract-id="settings.control" v-if="chatManifest['contextControl.fullValueToken']"
            pluginId="lumina-chat" settingKey="contextControl.fullValueToken" :config="chatManifest['contextControl.fullValueToken']" />
          <SurfaceOutlet contract-id="settings.control" v-if="chatManifest['contextControl.fullValueChar']"
            pluginId="lumina-chat" settingKey="contextControl.fullValueChar" :config="chatManifest['contextControl.fullValueChar']" />
        </div>
        
        <!-- 2. 概览区设置 -->
        <div class="dcc-section dcc-section-summary tw:mt-4 tw:flex tw:flex-col tw:gap-1 tw:border-t tw:border-dashed tw:border-lw-border-subtle tw:pt-4">
          <div class="dcc-section-label tw:mb-2.5 tw:flex tw:items-center tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">
            <span class="tw:shrink-0">概览发送范围 (Summary/Overview)</span>
            <span aria-hidden="true" class="tw:ml-2.5 tw:h-px tw:flex-1 tw:bg-lw-border-subtle tw:opacity-50"></span>
          </div>
          <SurfaceOutlet contract-id="settings.control" v-if="chatManifest['contextControl.summaryMode']"
            pluginId="lumina-chat" settingKey="contextControl.summaryMode" :config="chatManifest['contextControl.summaryMode']" />
          <SurfaceOutlet contract-id="settings.control" v-if="chatManifest['contextControl.summaryValueCount']"
            pluginId="lumina-chat" settingKey="contextControl.summaryValueCount" :config="chatManifest['contextControl.summaryValueCount']" />
          <SurfaceOutlet contract-id="settings.control" v-if="chatManifest['contextControl.summaryValueToken']"
            pluginId="lumina-chat" settingKey="contextControl.summaryValueToken" :config="chatManifest['contextControl.summaryValueToken']" />
          <SurfaceOutlet contract-id="settings.control" v-if="chatManifest['contextControl.summaryValueChar']"
            pluginId="lumina-chat" settingKey="contextControl.summaryValueChar" :config="chatManifest['contextControl.summaryValueChar']" />
        </div>
        
        <!-- 3. 进阶参数 -->
        <div class="dcc-section dcc-section-advanced tw:mt-[18px] tw:flex tw:flex-col tw:gap-1 tw:rounded-[18px] tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:px-4 tw:py-3.5">
          <SurfaceOutlet contract-id="settings.control" v-if="chatManifest['contextControl.tokenMaxFloat']"
            pluginId="lumina-chat" settingKey="contextControl.tokenMaxFloat" :config="chatManifest['contextControl.tokenMaxFloat']" />
          <div class="dcc-paired-settings tw:mt-2.5 tw:grid tw:grid-cols-2 tw:gap-x-[18px] tw:gap-y-3 tw:border-t tw:border-dashed tw:border-lw-border-subtle tw:pt-3 tw:max-[920px]:grid-cols-1">
            <SurfaceOutlet contract-id="settings.control" v-if="directorManifest['fullSplit']"
              pluginId="lumina-director" settingKey="fullSplit" :config="directorManifest['fullSplit']" />
            <SurfaceOutlet contract-id="settings.control" v-if="directorManifest['fullFloating']"
              pluginId="lumina-director" settingKey="fullFloating" :config="directorManifest['fullFloating']" />
          </div>
        </div>
      </div>
    </SettingsSectionPanel>

    <SettingsSectionPanel v-if="activeDesktopModeBlock" core class="desktop-mode-block">
      <SettingsBlockHeader :title="`${activeDesktopModeBlock.pluginName} - 桌面模式`">
        <template #icon>
          <span class="plugin-icon-wrap tw:inline-flex tw:size-7 tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:p-1.5 tw:text-lw-text" v-html="activeDesktopModeBlock.pluginIcon"></span>
        </template>
        <template #actions>
        <LuminaButton class="settings-action-button" variant="ghost" size="sm" @click="$emit('open-detail', activeDesktopModeBlock.pluginId)">
          模式详情
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </LuminaButton>
        </template>
      </SettingsBlockHeader>

      <div class="block-content tw:flex tw:flex-col tw:pt-1">
        <SettingsDescription>
          当前桌面模式提供的附加设置。这里的选项会直接影响当前桌面模式下的聊天流、侧栏、设置面板和时间线表现。
        </SettingsDescription>
        <div class="desktop-mode-shell-label tw:mb-2.5 tw:w-fit tw:rounded-lw-pill tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:px-2.5 tw:py-1.5 tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:text-lw-text-secondary">
          当前壳层：{{ activeDesktopModeShellLabel }}
        </div>
        <SettingsInsetPanel v-if="activeDesktopModeDescription" class="desktop-mode-summary tw:mb-3.5 tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-secondary tw:text-pretty">
          {{ activeDesktopModeDescription }}
        </SettingsInsetPanel>
        <SurfaceOutlet contract-id="settings.control"
          v-for="key in activeDesktopModeBlock.commonKeys"
          :key="key"
          :pluginId="activeDesktopModeBlock.pluginId"
          :settingKey="key"
          :config="activeDesktopModeBlock.manifest[key]"
        />
      </div>
    </SettingsSectionPanel>

    <!-- 各子插件的常用设置 -->
    <SettingsSectionPanel v-for="block in unifiedBlocks" :key="block.pluginId" :core="block.pluginId === 'lumina-settings'">
      <SettingsBlockHeader :title="`${block.pluginName} - 常用偏好`">
        <template #icon>
          <span class="plugin-icon-wrap tw:inline-flex tw:size-7 tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:p-1.5 tw:text-lw-text" v-html="block.pluginIcon"></span>
        </template>
        <template #actions>
        <LuminaButton v-if="block.hasMore" class="settings-action-button" variant="ghost" size="sm"
          @click="$emit('open-detail', block.pluginId)">
          更详细
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </LuminaButton>
        </template>
      </SettingsBlockHeader>

      <div class="block-content tw:flex tw:flex-col tw:pt-1">
        <SurfaceOutlet contract-id="settings.control" v-for="key in block.commonKeys" :key="key" :pluginId="block.pluginId" :settingKey="key"
          :config="block.manifest[key]" />
        <component
          v-if="block.inlineComponent"
          :is="block.inlineComponent"
          class="tw:mt-4 tw:border-t tw:border-lw-border-subtle tw:pt-4"
        />
      </div>
    </SettingsSectionPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { pluginManager } from '../../core/PluginManager.js';
import SurfaceOutlet from '../../platform/surface/SurfaceOutlet.vue';
import NexusPresetManager from './NexusPresetManager.vue';
import { SettingsBlockHeader, SettingsDescription, SettingsInsetPanel, SettingsMetaItem, SettingsSectionPanel, SettingsStatusBadge } from './components';
import { activeSettings, useSettings } from './useSettings.js';
import { settingsDomainService } from '../../api/services/SettingsDomainService.js';
import { LuminaWeaveAPI } from '../../api/index.js';
import { getSettingsEntry, getVisibleSettingsEntries } from './settingsRegistry.js';
import { useComponentSkin } from '../../theme/useComponentSkin.js';
import { getActiveDesktopModeIdFromSettings, getDesktopModeOrDefault, getDesktopModeSettingsPluginId } from '../../theme/themeRegistry.js';
import { LuminaButton, LuminaCheckbox, LuminaIconButton, LuminaSelect, LuminaToggle } from '../../ui/primitives';

const { initSettings } = useSettings();
const { cssVars, variant: unifiedVariant } = useComponentSkin('settings.unified');
const unifiedSkinStyle = computed(() => cssVars.value);
const activeThemeId = computed(() => getActiveDesktopModeIdFromSettings(activeSettings));

const openDetailedDiff = () => {
  const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
  const diff = lw?.getSyncDiff?.();
  if (diff?.hasDivergence && diff?.diffCount) {
    lw?.openConflictViewer?.();
    return;
  }
  lw?.openSyncReportViewer?.();
};

defineEmits<{
  (e: 'open-detail', pluginId: string): void
}>();
const isIndependent = ref(settingsDomainService.isIndependentGlobalStorageEnabled());

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
    const val = settingsDomainService.getGlobalValue(key, undefined);
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
        await settingsDomainService.importData(data, foundKeys);
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
  filterChatReply.value = settingsDomainService.getGlobalValue('lumina-chat.filterChatReply', false);
  allowTopLevelInFilter.value = settingsDomainService.getGlobalValue('lumina-chat.allowTopLevelInFilter', true);
  implicitThinkingInFilter.value = settingsDomainService.getGlobalValue('lumina-chat.implicitThinkingInFilter', false);
  aggressiveThinking.value = settingsDomainService.getGlobalValue('lumina-chat.aggressiveThinking', false);
  unlimitedResponse.value = settingsDomainService.getGlobalValue('lumina-chat.unlimitedResponse', false);
  thinkingDisplayMode.value = settingsDomainService.getGlobalValue('lumina-settings.thinkingDisplayMode', 'collapsible');
  thinkingAutoExpand.value = Boolean(settingsDomainService.getGlobalValue('lumina-settings.thinkingAutoExpand', true));
};

const downloadJson = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settingsDomainService.getGlobalSettingsSnapshot(), null, 2));
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

const filterChatReply = ref(settingsDomainService.getGlobalValue('lumina-chat.filterChatReply', false));

const onFilterChatReplyChange = () => {
  void settingsDomainService.setGlobalValue('lumina-chat.filterChatReply', filterChatReply.value);
};

const allowTopLevelInFilter = ref(settingsDomainService.getGlobalValue('lumina-chat.allowTopLevelInFilter', true));

const onAllowTopLevelChange = () => {
  void settingsDomainService.setGlobalValue('lumina-chat.allowTopLevelInFilter', allowTopLevelInFilter.value);
};

const implicitThinkingInFilter = ref(settingsDomainService.getGlobalValue('lumina-chat.implicitThinkingInFilter', false));

const onImplicitThinkingChange = () => {
  void settingsDomainService.setGlobalValue('lumina-chat.implicitThinkingInFilter', implicitThinkingInFilter.value);
};

const aggressiveThinking = ref(settingsDomainService.getGlobalValue('lumina-chat.aggressiveThinking', false));

const onAggressiveThinkingChange = () => {
  void settingsDomainService.setGlobalValue('lumina-chat.aggressiveThinking', aggressiveThinking.value);
};

const unlimitedResponse = ref(settingsDomainService.getGlobalValue('lumina-chat.unlimitedResponse', false));

const onUnlimitedResponseChange = () => {
  void settingsDomainService.setGlobalValue('lumina-chat.unlimitedResponse', unlimitedResponse.value);
};

const thinkingDisplayMode = ref(settingsDomainService.getGlobalValue('lumina-settings.thinkingDisplayMode', 'collapsible'));

const onThinkingDisplayModeChange = () => {
  void settingsDomainService.setGlobalValue('lumina-settings.thinkingDisplayMode', thinkingDisplayMode.value);
};

const thinkingAutoExpand = ref(Boolean(settingsDomainService.getGlobalValue('lumina-settings.thinkingAutoExpand', true)));

const onThinkingAutoExpandChange = () => {
  void settingsDomainService.setGlobalValue('lumina-settings.thinkingAutoExpand', thinkingAutoExpand.value);
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
  void settingsDomainService.setGlobalValue(`lumina-settings.plugins.${p.id}.promptEnabled`, p.enabled);
};

const updatePluginPermission = (p: any, enabled: boolean) => {
  p.enabled = enabled;
  togglePluginPermission(p);
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
    await lw.syncFromST({ resolveIntent: 'st' });
    refreshSyncState();
  }
};

const overwriteToST = async () => {
  const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
  if (lw?.syncFromST) {
    if (confirm('确定要将独立存储的数据回写并替换 ST 消息列表吗？此操作不可逆。')) {
      await lw.syncFromST({ resolveIntent: 'lumina' });
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
.desktop-mode-block {
  background: var(--lw-settings-block-bg, color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent));
  border-color: var(--lw-settings-block-border, var(--lw-border-base));
}

.perm-info .plugin-icon :deep(svg) {
  width: 14px;
  height: 14px;
  color: var(--lw-text-muted);
}

.settings-unified[data-skin-variant='telegram'] {
  padding: var(--lw-settings-unified-padding, clamp(18px, 3vw, 32px));
  gap: 18px;
}

.settings-unified[data-skin-variant='telegram'] .plugin-settings-block.lw-card {
  border-color: var(--lw-settings-block-border, var(--lw-border-subtle));
  background: var(--lw-settings-block-bg, color-mix(in srgb, var(--lw-surface-container-high) 78%, transparent));
  border-radius: 18px;
  box-shadow: var(--lw-settings-block-shadow, 0 10px 24px rgba(44, 92, 130, 0.08));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
}

.settings-unified[data-skin-variant='telegram'] .block-header {
  border-bottom-color: var(--lw-border-subtle);
}

.settings-unified[data-skin-variant='telegram'] .plugin-icon-wrap,
.settings-unified[data-skin-variant='telegram'] .sync-meta,
.settings-unified[data-skin-variant='telegram'] .scope-selector,
.settings-unified[data-skin-variant='telegram'] .permission-item,
.settings-unified[data-skin-variant='telegram'] .radio-label,
.settings-unified[data-skin-variant='telegram'] .dcc-section-advanced,
.settings-unified[data-skin-variant='telegram'] .desktop-mode-summary {
  border-color: var(--lw-settings-inner-card-border, var(--lw-border-subtle));
  background: var(--lw-settings-inner-card-bg, color-mix(in srgb, var(--lw-surface-container) 72%, transparent));
  border-radius: 16px;
  box-shadow: none;
}

.settings-unified[data-skin-variant='telegram'] .settings-action-button {
  min-height: 40px;
  border-radius: 999px;
}

.settings-unified[data-skin-variant='telegram'] .setting-item {
  min-height: 44px;
}

</style>
