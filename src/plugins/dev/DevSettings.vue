<template>
  <div class="dev-settings">
    <div class="dev-header">
      <div class="header-content">
        <h4>开发者工具箱</h4>
        <p class="dev-desc">深度调试与数据干预工具。非开发者请谨慎操作。</p>
      </div>
      <div class="header-badge">v5.3-dev</div>
    </div>

    <div class="dev-section">
      <div class="section-header">
        <div class="section-title">资源 VFS 终端</div>
        <div class="header-actions">
          <button class="icon-btn" :disabled="vfsHistory.length === 0" title="清空输出" @click="clearVfsHistory">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path></svg>
          </button>
        </div>
      </div>

      <div class="dev-card glass-effect vfs-card">
        <form class="vfs-command-row" @submit.prevent="executeVfsCommand()">
          <span class="vfs-prompt">$</span>
          <input
            v-model="vfsCommandLine"
            class="lw-input transparent vfs-input"
            spellcheck="false"
            autocomplete="off"
            placeholder="cat /sources/local/worldbooks/example | grep key"
          />
          <button class="lw-btn primary sm" type="submit" :disabled="isRunningVfsCommand || !vfsCommandLine.trim()">
            {{ isRunningVfsCommand ? '运行中' : '运行' }}
          </button>
        </form>

        <div class="vfs-quick-row">
          <button
            v-for="command in vfsQuickCommands"
            :key="command"
            class="helper-btn sm"
            type="button"
            @click="runVfsQuickCommand(command)"
          >
            {{ command }}
          </button>
        </div>

        <div class="vfs-output custom-scrollbar">
          <div v-if="vfsHistory.length === 0" class="empty-mini">暂无命令输出</div>
          <div
            v-for="record in vfsHistory"
            :key="record.id"
            :class="['vfs-record', { error: !record.ok }]"
          >
            <div class="vfs-record-command">$ {{ record.command }}</div>
            <pre class="vfs-record-output">{{ record.output }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- 消息节点选择器 (优化版) -->
    <div class="dev-section">
      <div class="section-header">
        <div class="section-title">消息节点选择</div>
        <div class="header-actions">
          <button class="icon-btn" @click="refreshCurrentNode" title="抓取当前激活节点">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        </div>
      </div>

      <div class="dev-card search-card glass-effect">
        <div class="search-box">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            v-model="nodeSearchQuery" 
            placeholder="搜索节点内容或 ID..." 
            class="lw-input transparent"
          />
        </div>
        <div class="node-list-container custom-scrollbar">
          <div 
            v-for="node in filteredNodes" 
            :key="node.id" 
            :class="['node-item', { active: selectedNodeId === node.id, current: node.id === activeLeafId }]"
            @click="selectedNodeId = node.id"
          >
            <div :class="['role-tag', node.role]">
              {{ node.role === 'user' ? 'U' : 'A' }}
            </div>
            <div class="node-info">
              <div class="node-text">{{ truncate(node.mesRaw, 40) }}</div>
              <div class="node-meta">
                <span class="node-id">#{{ node.id.slice(0, 8) }}</span>
                <span v-if="node.id === activeLeafId" class="active-label">当前活跃</span>
                <span v-if="hasSnapshots(node)" class="snapshot-indicator" title="存有快照">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                </span>
              </div>
            </div>
          </div>
          <div v-if="filteredNodes.length === 0" class="empty-state">未找到匹配节点</div>
        </div>
      </div>
    </div>

    <!-- 节点编辑器 -->
    <div class="dev-section" v-if="selectedNodeId">
      <div class="section-title">内容编辑: <code class="sm-code">{{ selectedNodeId.slice(0, 8) }}</code></div>
      <div class="dev-card node-editor-card glass-effect">
        <div class="field-tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            :class="['tab-btn', { active: selectedField === tab.id }]"
            @click="selectedField = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="editor-body">
          <template v-if="selectedField === 'parentId'">
            <div class="parent-selector">
              <label>重挂载父节点 (物理保留子树)</label>
              <div class="search-box sm">
                <input type="text" v-model="parentSearchQuery" placeholder="筛选父节点..." class="lw-input sm" />
              </div>
              <div class="parent-list custom-scrollbar">
                <div 
                  :class="['parent-item', { active: editValue === null }]" 
                  @click="editValue = null"
                >
                  <span class="role-tag-sm system">R</span>
                  <span class="parent-text">根节点 (null)</span>
                </div>
                <div 
                  v-for="node in filteredParentOptions" 
                  :key="node.id" 
                  :class="['parent-item', { active: editValue === node.id }]"
                  @click="editValue = node.id"
                >
                  <span :class="['role-tag-sm', node.role]">{{ node.role === 'user' ? 'U' : 'A' }}</span>
                  <span class="parent-text">{{ truncate(node.mesRaw, 50) }}</span>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="selectedField === 'extra'">
            <div class="json-editor-container">
              <textarea 
                v-model="editValue" 
                class="lw-textarea json-editor" 
                placeholder="请输入 JSON 格式元数据..."
                spellcheck="false"
              ></textarea>
              <div class="json-actions">
                <button class="helper-btn sm" @click="formatJSON">格式化</button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="textarea-wrapper">
              <textarea 
                v-model="editValue" 
                class="lw-textarea content-editor" 
                placeholder="在此输入内容..."
              ></textarea>
              <div class="dsl-helpers">
                <span class="helper-label">快捷插入:</span>
                <button class="helper-btn" @click="insertDSL('Stat')">Stat</button>
                <button class="helper-btn" @click="insertDSL('Choices')">Choices</button>
                <button class="helper-btn" @click="insertDSL('Alert')">Alert</button>
                <button class="helper-btn" @click="insertDSL('Progress')">Progress</button>
              </div>
            </div>
          </template>
        </div>

        <div class="editor-footer">
          <div class="left-actions">
            <button class="lw-btn danger ghost sm" @click="handleDeleteNode">删除节点</button>
            <button class="lw-btn secondary ghost sm" @click="handleAddNode">添加子节点</button>
          </div>
          <div class="footer-spacer"></div>
          <button class="lw-btn secondary sm" @click="resetEditor">重置</button>
          <button class="lw-btn primary sm" :disabled="!hasChanges" @click="handleSaveNode">
            应用修改
          </button>
        </div>
      </div>
    </div>

    <!-- 快照管理 (新增) -->
    <div class="dev-section">
      <div class="section-title">状态快照管理</div>
      <div class="dev-card glass-effect snapshot-card">
        <div class="snapshot-header">
          <div class="stat-group">
            <div class="stat-item">
              <span class="stat-val">{{ snapshotNodes.length }}</span>
              <span class="stat-label">含快照节点</span>
            </div>
          </div>
          <button class="lw-btn danger sm" @click="handleClearAllSnapshots" :disabled="snapshotNodes.length === 0">
            清空所有快照
          </button>
        </div>

        <div class="snapshot-list custom-scrollbar" v-if="snapshotNodes.length > 0">
          <div v-for="node in snapshotNodes" :key="node.id" class="snapshot-item">
            <div class="snap-node-info" @click="jumpToNode(node.id)">
              <span :class="['role-tag-xs', node.role]">{{ node.role === 'user' ? 'U' : 'A' }}</span>
              <span class="snap-text">{{ truncate(node.mesRaw, 30) }}</span>
            </div>
            <div class="snap-tags">
              <span v-for="s in node.snapshots" :key="s" class="snap-tag s">{{ s }}</span>
              <span v-for="d in node.deltas" :key="d" class="snap-tag d">Δ {{ d }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-mini">当前无任何持久化快照数据</div>
      </div>
    </div>

    <!-- 全局维护 -->
    <div class="dev-section">
      <div class="section-title">全局维护</div>
      <div class="dev-card glass-effect maintenance-card">
        <div class="maintenance-item">
          <div class="item-info">
            <h5>同步对比报告</h5>
            <p>生成并可视化展示“插件影子图谱 vs ST 线性列表”的对齐与差异报告。</p>
          </div>
          <button class="lw-btn secondary ghost sm" @click="openSyncReport">
            打开报告
          </button>
        </div>
        <div class="maintenance-item">
          <div class="item-info">
            <h5>重建当前对话 (UI Rebuild)</h5>
            <p>从插件原始数据重新解析并对齐 ST 展示层。</p>
          </div>
          <button 
            class="lw-btn primary ghost sm rebuild-btn" 
            :disabled="isRebuilding" 
            @click="handleRebuild"
          >
            <span v-if="isRebuilding" class="rebuild-spinner"></span>
            {{ isRebuilding ? '正在重写核心归一化字段...' : '重建 & 深度校准对话' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { luminaWeaveApi } from '../../api/index.js';
import { vfsCommandService } from '../../api/core/hal/shell/index.js';
import { createPrefixedId } from '@shared/CommonUtils.js';

const debugChat = luminaWeaveApi.debugChat;

const selectedNodeId = ref('');
const selectedField = ref('mesRaw');
const editValue = ref('');
const isRebuilding = ref(false);

const nodeSearchQuery = ref('');
const parentSearchQuery = ref('');
const vfsCommandLine = ref('ls /');
const vfsHistory = ref([]);
const isRunningVfsCommand = ref(false);
const vfsQuickCommands = [
  'ls /',
  'ls /sources',
  'ls /library',
  'find /library',
  'grep world /library/worldbooks',
  'cat /sources/local/worldbooks/example | grep key'
];

const tabs = [
  { id: 'mesRaw', label: '原始正文 (mesRaw)' },
  { id: 'mes', label: '显示正文 (mes)' },
  { id: 'pluginRaw', label: '插件原始 (pluginRaw)' },
  { id: 'extra', label: '元数据 (extra)' },
  { id: 'parentId', label: '父节点 (parentId)' },
];

const activeLeafId = computed(() => debugChat.getActiveLeafId());

const nodeOptions = computed(() => {
  return debugChat.listNodes();
});

const filteredNodes = computed(() => {
  const query = nodeSearchQuery.value.toLowerCase();
  if (!query) return nodeOptions.value.slice().reverse();
  return nodeOptions.value.filter(n => 
    n.id.toLowerCase().includes(query) || 
    (n.mesRaw && n.mesRaw.toLowerCase().includes(query))
  ).slice().reverse();
});

const snapshotNodes = computed(() => {
  return debugChat.getSnapshotNodes() || [];
});

const currentNode = computed(() => {
  return debugChat.getNode(selectedNodeId.value);
});

const hasSnapshots = (node) => {
  if (!node.extra) return false;
  return Object.keys(node.extra).some(k => k.endsWith('_snapshot') || k.endsWith('_delta'));
};

const jumpToNode = (id) => {
  selectedNodeId.value = id;
  const el = document.querySelector('.search-card');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

// 过滤掉当前节点及其所有子节点，防止循环引用
const validParentOptions = computed(() => {
  if (!selectedNodeId.value) return nodeOptions.value;
  const toExclude = new Set([selectedNodeId.value]);
  
  const collectChildren = (id) => {
    const children = debugChat.getChildren(id);
    children.forEach(c => {
      toExclude.add(c.id);
      collectChildren(c.id);
    });
  };
  
  collectChildren(selectedNodeId.value);
  return nodeOptions.value.filter(n => !toExclude.has(n.id));
});

const filteredParentOptions = computed(() => {
  const query = parentSearchQuery.value.toLowerCase();
  if (!query) return validParentOptions.value;
  return validParentOptions.value.filter(n => 
    n.id.toLowerCase().includes(query) || 
    (n.mesRaw && n.mesRaw.toLowerCase().includes(query))
  );
});

const hasChanges = computed(() => {
  if (!currentNode.value) return false;
  let original = currentNode.value[selectedField.value];
  if (selectedField.value === 'extra') {
    return JSON.stringify(original) !== editValue.value;
  }
  return original !== editValue.value;
});

onMounted(() => {
  selectedNodeId.value = debugChat.getActiveLeafId() || '';
});

watch([selectedNodeId, selectedField], () => {
  resetEditor();
}, { immediate: true });

const resetEditor = () => {
  if (!currentNode.value) {
    editValue.value = '';
    return;
  }
  const val = currentNode.value[selectedField.value];
  if (selectedField.value === 'extra') {
    editValue.value = JSON.stringify(val || {}, null, 2);
  } else {
    editValue.value = val || '';
  }
};

const refreshCurrentNode = () => {
  selectedNodeId.value = debugChat.getActiveLeafId() || '';
  resetEditor();
};

const formatJSON = () => {
  try {
    const obj = JSON.parse(editValue.value);
    editValue.value = JSON.stringify(obj, null, 2);
  } catch (e) {
    luminaWeaveApi.services.host.showToast('JSON 格式无效', 'warning');
  }
};

const insertDSL = (type) => {
  let tag = '';
  switch (type) {
    case 'Stat': tag = '<V>Stat("生命值", 80, 100)</V>'; break;
    case 'Choices': tag = '<V>Choices(["继续探索", "撤退"])</V>'; break;
    case 'Alert': tag = '<V>Alert("warning", "前方有危险")</V>'; break;
    case 'Progress': tag = '<V>Progress("当前进度", 45)</V>'; break;
  }
  const textarea = document.querySelector('.content-editor');
  if (textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    editValue.value = editValue.value.substring(0, start) + tag + editValue.value.substring(end);
  } else {
    editValue.value += tag;
  }
};

const handleSaveNode = async () => {
  if (!currentNode.value) return;
  
  const id = selectedNodeId.value;
  const field = selectedField.value;
  let finalValue = editValue.value;

  try {
    if (field === 'extra') {
      finalValue = JSON.parse(editValue.value);
    }
    
    const updatedNode = { ...currentNode.value, [field]: finalValue };
    debugChat.upsertNode(updatedNode);
    await debugChat.persistCurrentChat();
    luminaWeaveApi.services.host.showToast('应用修改成功', 'success');
  } catch (e) {
    console.error('[DevSettings] Save failed:', e);
    luminaWeaveApi.services.host.showToast('保存失败: ' + e.message, 'error');
  }
};

const handleAddNode = async () => {
  const role = confirm('添加为 [助手] 消息吗？(取消则添加为 [用户] 消息)') ? 'assistant' : 'user';
  const newNode = {
    id: createPrefixedId('lw'),
    parentId: selectedNodeId.value || null,
    role,
    mesRaw: `[新${role === 'user' ? '用户' : '助手'}节点]`,
    pluginRaw: '',
    extra: {},
    characterId: currentNode.value?.characterId || ''
  };
  
  debugChat.upsertNode(newNode);
  selectedNodeId.value = newNode.id;

  await debugChat.persistCurrentChat();
  luminaWeaveApi.services.host.showToast('已添加新节点', 'success');
};

const handleDeleteNode = async () => {
  if (!selectedNodeId.value) return;
  if (!confirm('确定要彻底删除该节点及其所有子分支吗？此操作不可恢复。')) return;
  
  try {
    debugChat.removeSubtree(selectedNodeId.value);
    selectedNodeId.value = debugChat.getActiveLeafId() || '';
    await debugChat.persistCurrentChat();
    luminaWeaveApi.services.host.showToast('节点物理删除成功', 'success');
  } catch (e) {
    luminaWeaveApi.services.host.showToast('删除失败: ' + e.message, 'error');
  }
};

const handleClearAllSnapshots = async () => {
  if (!confirm('确定要清空所有状态快照吗？这将导致下次对话需要从头重播指令。')) return;
  try {
    const res = await luminaWeaveApi.clearAllSnapshots();
    luminaWeaveApi.services.host.showToast(`快照清理完毕: 回收 ${res.cleared} 个节点资源`, 'success');
  } catch (e) {
    luminaWeaveApi.services.host.showToast('清理失败: ' + e.message, 'error');
  }
};

const handleRebuild = async () => {
  if (!confirm('【深度重构确认】\n这将触发全局归一化管道：\n1. 重新从 pluginRaw 提取 mesRaw\n2. 重新应用正则表达式生成 mes\n3. 重新计算内容指纹\n4. 强制同步至 ST 与独立存储\n\n确定要执行吗？')) return;
  
  isRebuilding.value = true;
  const startTime = Date.now();
  
  try {
    const res = await luminaWeaveApi.rebuildCurrentChatMessages();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    luminaWeaveApi.services.host.showToast(
      `重构完成！\n处理节点: ${res.total}\n实质变更: ${res.rebuilt}\n耗时: ${duration}s`, 
      'success',
      '深度校准成功'
    );
  } catch (e) {
    luminaWeaveApi.services.host.showToast('重建过程中发生错误: ' + e.message, 'error');
    console.error('[DevSettings] Rebuild failed:', e);
  } finally {
    isRebuilding.value = false;
  }
};

const openSyncReport = () => {
  luminaWeaveApi.services.desktopSurface.openPanel('sync_report');
};

const executeVfsCommand = async (line = vfsCommandLine.value) => {
  const command = line.trim();
  if (!command || isRunningVfsCommand.value) return;

  isRunningVfsCommand.value = true;
  try {
    const result = await vfsCommandService.executeLine(command);
    vfsHistory.value.unshift({
      id: createPrefixedId('vfs_hist'),
      command,
      ok: result.ok,
      output: result.ok ? (result.text || '(empty)') : (result.error || 'Command failed')
    });
  } catch (error) {
    vfsHistory.value.unshift({
      id: createPrefixedId('vfs_hist'),
      command,
      ok: false,
      output: error instanceof Error ? error.message : String(error)
    });
  } finally {
    vfsHistory.value = vfsHistory.value.slice(0, 24);
    isRunningVfsCommand.value = false;
  }
};

const runVfsQuickCommand = (command) => {
  vfsCommandLine.value = command;
  executeVfsCommand(command);
};

const clearVfsHistory = () => {
  vfsHistory.value = [];
};

const truncate = (str, len) => {
  if (!str) return '空';
  return str.length > len ? str.slice(0, len) + '...' : str;
};
</script>

<style scoped>
.dev-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  height: 100%;
  overflow-y: auto;
  color: var(--lw-text-main);
  background: var(--lw-bg-app);
}

.dev-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.dev-header h4 {
  margin: 0;
  font-size: var(--lw-type-title-large-size);
  font-weight: var(--lw-type-title-small-weight);
  background: linear-gradient(135deg, var(--lw-primary) 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-badge {
  font-size: var(--lw-type-label-small-size);
  padding: 2px 6px;
  background: rgba(var(--lw-primary-rgb, 99, 102, 241), 0.1);
  color: var(--lw-primary);
  border-radius: 4px;
  font-weight: var(--lw-type-label-medium-weight);
}

.dev-desc {
  margin: 4px 0 0 0;
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-dim);
}

.dev-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.dev-card {
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-effect {
  background: rgba(var(--lw-surface-rgb, 255, 255, 255), 0.7) !important;
  backdrop-filter: blur(12px) saturate(180%);
}

/* Search Box */
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.05);
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  color: var(--lw-text-dim);
}

.search-box.sm {
  padding: 4px 8px;
  margin-bottom: 8px;
}

.transparent {
  background: transparent !important;
  border: none !important;
  outline: none !important;
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-medium-size);
  width: 100%;
}

/* Node List */
.node-list-container {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.node-item:hover {
  background: rgba(var(--lw-primary-rgb), 0.05);
}

.node-item.active {
  background: rgba(var(--lw-primary-rgb), 0.1);
  border-color: rgba(var(--lw-primary-rgb), 0.2);
}

.node-item.current {
  background: linear-gradient(90deg, rgba(var(--lw-primary-rgb), 0.1) 0%, transparent 100%);
  position: relative;
}

.node-item.current::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: var(--lw-primary);
  border-radius: 0 4px 4px 0;
}

.role-tag {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  flex-shrink: 0;
}

.role-tag.user { background: #3b82f6; color: white; }
.role-tag.assistant { background: #10b981; color: white; }

.node-info {
  flex: 1;
  min-width: 0;
}

.node-text {
  font-size: var(--lw-type-body-medium-size);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--lw-text-main);
}

.node-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.node-id {
  font-size: var(--lw-type-label-small-size);
  font-family: var(--lw-font-mono);
  color: var(--lw-text-dim);
}

.active-label {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-primary);
  font-weight: var(--lw-type-title-small-weight);
}

.snapshot-indicator {
  color: #f59e0b;
}

/* Tabs */
.field-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: rgba(0, 0, 0, 0.03);
  padding: 4px;
  border-radius: 8px;
}

.tab-btn {
  flex: 1;
  padding: 6px 4px;
  font-size: var(--lw-type-label-small-size);
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--lw-text-dim);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: white;
  color: var(--lw-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Editor Body */
.lw-textarea {
  width: 100%;
  min-height: 150px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--lw-border);
  border-radius: 8px;
  padding: 12px;
  font-size: var(--lw-type-body-medium-size);
  line-height: 1.6;
  font-family: inherit;
  resize: vertical;
}

.json-editor {
  min-height: 240px;
  font-family: var(--lw-font-mono, monospace);
  font-size: var(--lw-type-body-small-size);
}

.json-editor-container {
  position: relative;
}

.json-actions {
  position: absolute;
  right: 12px;
  top: 12px;
}

.dsl-helpers {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.helper-label {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-dim);
  margin-right: 4px;
}

.helper-btn {
  padding: 4px 8px;
  font-size: var(--lw-type-label-small-size);
  border-radius: 4px;
  border: 1px solid var(--lw-border);
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.helper-btn:hover {
  background: #f8fafc;
  border-color: var(--lw-primary);
}

.helper-btn.sm { padding: 2px 6px; }

.vfs-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vfs-command-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid var(--lw-border);
  border-radius: 8px;
  padding: 8px 10px;
}

.vfs-prompt {
  font-family: var(--lw-font-mono);
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-primary);
  flex-shrink: 0;
}

.vfs-input {
  font-family: var(--lw-font-mono);
  font-size: var(--lw-type-body-small-size);
}

.vfs-quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.vfs-output {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.vfs-record {
  border: 1px solid var(--lw-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.68);
  overflow: hidden;
}

.vfs-record.error {
  border-color: rgba(239, 68, 68, 0.35);
}

.vfs-record-command {
  font-family: var(--lw-font-mono);
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-dim);
  background: rgba(15, 23, 42, 0.04);
  border-bottom: 1px solid var(--lw-border);
  padding: 6px 8px;
}

.vfs-record.error .vfs-record-command {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.06);
}

.vfs-record-output {
  margin: 0;
  padding: 8px;
  font-family: var(--lw-font-mono);
  font-size: var(--lw-type-label-small-size);
  line-height: 1.5;
  color: var(--lw-text-main);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 220px;
  overflow: auto;
}

/* Parent Selector */
.parent-list {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--lw-border);
  border-radius: 8px;
  background: white;
}

.parent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(0, 0, 0, 0.02);
}

.parent-item:hover { background: rgba(var(--lw-primary-rgb), 0.03); }
.parent-item.active { background: rgba(var(--lw-primary-rgb), 0.08); }

.role-tag-sm {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  flex-shrink: 0;
  color: white;
}

.role-tag-sm.user { background: #3b82f6; }
.role-tag-sm.assistant { background: #10b981; }
.role-tag-sm.system { background: #64748b; }

.parent-text {
  font-size: var(--lw-type-label-small-size);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Footer */
.editor-footer {
  display: flex;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--lw-border);
}

.left-actions {
  display: flex;
  gap: 8px;
}

.sm-code {
  font-family: var(--lw-font-mono);
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 0.9em;
  color: var(--lw-primary);
}

/* Snapshot Card */
.snapshot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-val {
  font-size: var(--lw-type-title-large-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-primary);
}

.stat-label {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-dim);
}

.snapshot-list {
  max-height: 140px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.snapshot-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.snap-node-info {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.snap-node-info:hover .snap-text {
  text-decoration: underline;
  color: var(--lw-primary);
}

.snap-text {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-main);
}

.snap-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.snap-tag {
  font-size: var(--lw-type-label-small-size);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: var(--lw-font-mono);
}

.snap-tag.s { background: #fef3c7; color: #92400e; }
.snap-tag.d { background: #dcfce7; color: #166534; }

.role-tag-xs {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: white;
}

.role-tag-xs.user { background: #3b82f6; }
.role-tag-xs.assistant { background: #10b981; }

.empty-mini {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-dim);
  text-align: center;
  padding: 12px;
}

/* Maintenance */
.maintenance-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.maintenance-item h5 {
  margin: 0;
  font-size: var(--lw-type-title-small-size);
}

.maintenance-item p {
  margin: 2px 0 0 0;
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-dim);
}

/* Buttons */
.rebuild-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
  justify-content: center;
}

.rebuild-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(var(--lw-primary-rgb), 0.2);
  border-top-color: var(--lw-primary);
  border-radius: 50%;
  animation: lw-spin 0.8s linear infinite;
}

@keyframes lw-spin {
  to { transform: rotate(360deg); }
}

.lw-btn {
  border-radius: 8px;
  font-weight: var(--lw-type-label-medium-weight);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.lw-btn.primary { background: var(--lw-primary); color: white; }
.lw-btn.primary.ghost { background: transparent; border-color: var(--lw-primary); color: var(--lw-primary); }
.lw-btn.danger { background: #ef4444; color: white; }
.lw-btn.danger.ghost { background: transparent; border-color: #fca5a5; color: #ef4444; }
.lw-btn.secondary { background: #f1f5f9; color: #475569; }
.lw-btn.secondary.ghost { background: transparent; border-color: #cbd5e1; color: #64748b; }

.lw-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.sm { padding: 4px 10px; font-size: var(--lw-type-label-small-size); }

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--lw-text-dim);
  font-size: var(--lw-type-body-small-size);
}
</style>
