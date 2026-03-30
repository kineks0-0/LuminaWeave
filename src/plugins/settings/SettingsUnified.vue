<template>
  <div class="settings-unified">
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
        <div v-if="syncDiff && syncDiff.totalDiff > 0" class="sync-diff-viewer">
          <div class="diff-header">检测到数据差异 ({{ syncDiff.totalDiff }} 项)</div>
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
            <span class="label-desc">开启后，流式生成时将屏蔽预思考与动作标签，仅展示回复主体内容。</span>
          </label>
          <label class="lw-toggle">
            <input type="checkbox" v-model="filterChatReply" @change="onFilterChatReplyChange" />
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
        <div class="engine-desc" style="margin-top: 16px;">
          选择【全局】作用域配置项的物理持久化位置。切换引擎后将重新拉取该区域的数据。
        </div>
        <div class="radio-group">
          <label class="radio-label active">
            <input type="radio" :checked="true" disabled />
            <div class="radio-text">
              <span class="radio-title">独立 JSONL 剥离 (高级全栈模式)</span>
              <span class="radio-sub">当前已强制开启。数据保存至后端 LuminaWeave 数据目录，支持 Timeline 回溯。</span>
            </div>
          </label>
        </div>
        <div class="backup-actions" v-if="isIndependent">
          <button class="lw-btn lw-btn-secondary" @click="downloadJson">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            备份本地 JSON
          </button>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { pluginManager } from '../../core/PluginManager';
import SettingControl from './SettingControl.vue';
import NexusPresetManager from './NexusPresetManager.vue';
import { useSettings } from './useSettings';
import { lwStorage } from '../../api/storage';
import { LuminaWeaveAPI } from '../../api/index';

const { initSettings } = useSettings();

const openDetailedDiff = () => {
  (window as any).LuminaWeave?.openConflictViewer();
};

defineEmits<{
  (e: 'open-detail', pluginId: string): void
}>();

const isIndependent = ref(lwStorage.useIndependentGlobalStorage);

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

const unlimitedResponse = ref(lwStorage.get('lumina-chat.unlimitedResponse', false, 'Global'));

const onUnlimitedResponseChange = () => {
  lwStorage.set('lumina-chat.unlimitedResponse', unlimitedResponse.value, 'Global');
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
  if (lw?.chatManager) {
    console.log('[Settings] 手动触发：覆盖至独立存储...');
    await lw.chatManager.syncFromST();
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
// ==========================

interface UnifiedBlock {
  pluginId: string;
  pluginName: string;
  pluginIcon: string;
  manifest: any;
  commonKeys: string[];
  hasMore: boolean;
}

const unifiedBlocks = computed(() => {
  const blocks: UnifiedBlock[] = [];
  const registered = (pluginManager as any).registeredSettings;
  Object.keys(registered).forEach(pluginId => {
    const p = pluginManager.getPlugin(pluginId);
    if (!p) return;

    const manifest = registered[pluginId];
    const commonKeys = Object.keys(manifest).filter(k => manifest[k].common);
    const hasMore = Object.keys(manifest).length > commonKeys.length;

    if (commonKeys.length > 0 || hasMore) {
      blocks.push({
        pluginId,
        pluginName: p.name,
        pluginIcon: p.icon,
        manifest,
        commonKeys,
        hasMore
      });
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
  gap: var(--lw-item-gap);
  background: var(--lw-bg-app);
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

/* 设置项 card 不需要跟交互卡片一样的悬浮抬升 */
.plugin-settings-block.lw-card:hover {
  box-shadow: none;
  border-color: var(--lw-border-base);
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
  font-weight: 600;
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
  color: var(--lw-primary);
  background: #5c73f614;
  padding: 6px;
  border-radius: var(--lw-radius-sm);
  width: 28px;
  height: 28px;
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
  background: #e0e7ff;
  color: #4338ca;
  animation: pulse 2s infinite;
}

.badge.success {
  background: #dcfce7;
  color: #15803d;
}

.badge.error {
  background: #fee2e2;
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
  background: var(--lw-bg-subtle);
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
  border-radius: var(--lw-radius-sm);
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
  background: #fffcf0;
  border: 1px solid #ffedd5;
  border-radius: var(--lw-radius);
}

.diff-header {
  font-size: 11px;
  font-weight: 700;
  color: #c2410c;
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
</style>
