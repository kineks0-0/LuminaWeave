<template>
  <div class="director-panel lw-widget-padding">
    
    <!-- 1. 极简主义/微交互面板头部 -->
    <!-- 1. 顶部操作栏 (Simplified Actions) -->
    <div class="panel-header actions-only">
      <div class="header-actions">
        <button class="lw-btn lw-btn-secondary action-btn" @click="handleManualReload" title="清空状态并从头重新执行所有 M 标签指令">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          <span>同步重载</span>
        </button>
        <button class="lw-btn lw-btn-primary action-btn primary" @click="handleReExecuteMutations" title="重载并执行当前节点的 Mutation 指令">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6M22.73 13a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          <span>时空重载</span>
        </button>
      </div>
    </div>

    <div class="panel-content-scroll scroll-container">
      <!-- 2. 下一回合规划 (Ephemeral Control) -->
      <div class="content-section">
        <div class="section-title-wrapper">
          <h3 class="section-main-title">当前规划 (Context Plan)</h3>
          <div class="header-badges">
            <span class="lw-badge" :class="isOrchestrationAsync ? 'lw-badge-primary' : 'lw-badge-subtle'">
              {{ isOrchestrationAsync ? 'Async 模式' : 'Piggyback 模式' }}
            </span>
          </div>
        </div>
        
        <div class="plan-bubble-group">
          <div class="plan-bubble" :class="{ 'empty': !nextPlan }">
            <div class="bubble-label">下一轮规划 (Next_Plan)</div>
            <div v-if="nextPlan" class="bubble-text">{{ nextPlan }}</div>
            <div v-else class="bubble-placeholder">尚未探测到后续剧情波形</div>
          </div>

          <div class="plan-bubble summary-bubble">
            <div class="bubble-label">剧情概况 (Story_Summary)</div>
            <textarea 
              class="summary-textarea" 
              v-model="editableSummary" 
              @blur="saveSummary"
              placeholder="凝练地总结当前剧情状态..."
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 3. 动态状态表格 (Persistent Snapshot) -->
      <div class="content-section">
        <div class="section-title-wrapper">
          <h3 class="section-main-title">世界快照 (Mutation Tables)</h3>
          <button class="lw-btn lw-btn-icon lw-btn-subtle" @click="isEditingTables = !isEditingTables" :title="isEditingTables ? '退出编辑' : '编辑表格'">
             <svg v-if="!isEditingTables" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
             <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
        </div>
        
        <div class="dynamic-tables-grid">
           <div v-for="(meta, id) in tier1Store.tableRegistry" :key="id" class="lw-card table-card" :class="{ 'is-editing': isEditingTables }">
              <div class="table-card-header">
                 <span class="table-icon">{{ meta.icon || '📊' }}</span>
                 <span class="table-name">{{ meta.title }}</span>
                 <span class="table-schema-id">{{ id }}</span>
              </div>
              
              <div class="table-card-body">
                 <!-- 3.1 Grid 渲染 (例如 Global) -->
                 <div v-if="meta.renderType === 'grid'" class="data-grid">
                    <div v-for="(val, key) in tables[id]" :key="key" class="grid-item">
                       <label>{{ key }}:</label>
                       <input v-if="isEditingTables" type="text" v-model="tables[id][key]" class="inline-input" @change="saveTable(id)">
                       <span v-else>{{ val }}</span>
                    </div>
                 </div>

                 <!-- 3.2 Relationships 渲染 (例如 Characters) -->
                 <div v-else-if="meta.renderType === 'relationships'" class="relationships-list">
                    <div v-for="(char, name) in tables[id].npcs" :key="name" class="relationship-item">
                       <div class="rel-info">
                          <span class="rel-name">{{ name }}</span>
                          <input v-if="isEditingTables" type="text" v-model="char.status" class="inline-input status-input" @change="saveTable(id)">
                          <span v-else class="rel-status">{{ char.status }}</span>
                       </div>
                       <div class="rel-affinity">
                          <div class="affinity-track">
                             <div class="affinity-fill" :style="{ width: char.affinity + '%' }"></div>
                          </div>
                          <input v-if="isEditingTables" type="number" v-model.number="char.affinity" class="inline-input affinity-input" min="0" max="100" @change="saveTable(id)">
                          <span v-else class="affinity-num">{{ char.affinity }}</span>
                       </div>
                    </div>
                    <div v-if="Object.keys(tables[id].npcs).length === 0" class="data-empty">暂无人物数据</div>
                 </div>

                 <!-- 3.3 Table 渲染 (例如 Inventory) -->
                 <div v-else-if="meta.renderType === 'table'" class="table-wrapper">
                    <table class="data-table">
                       <tbody v-if="tables[id].length > 0">
                          <tr v-for="(item, idx) in tables[id]" :key="idx">
                             <td class="cell-main">
                                <input v-if="isEditingTables" type="text" v-model="item.item" class="inline-input" @change="saveTable(id)">
                                <span v-else>{{ item.item }}</span>
                             </td>
                             <td class="cell-val">
                                <input v-if="isEditingTables" type="number" v-model.number="item.count" class="inline-input count-input" @change="saveTable(id)">
                                <span v-else>x{{ item.count }}</span>
                             </td>
                             <td class="cell-dim">
                                <input v-if="isEditingTables" type="text" v-model="item.desc" class="inline-input" @change="saveTable(id)">
                                <span v-else>{{ item.desc || '-' }}</span>
                             </td>
                          </tr>
                       </tbody>
                       <div v-else class="data-empty">列表为空</div>
                    </table>
                 </div>

                 <!-- 3.4 List 渲染 (例如 Skills) -->
                 <div v-else-if="meta.renderType === 'list'" class="tags-container">
                    <template v-if="isEditingTables">
                        <div v-for="(tag, idx) in tables[id]" :key="idx" class="edit-tag-wrapper">
                            <input type="text" v-model="tables[id][idx]" class="inline-input tag-input" @change="saveTable(id)">
                            <button @click="tables[id].splice(idx, 1); saveTable(id)" class="tag-del">×</button>
                        </div>
                        <button @click="tables[id].push('新能力'); saveTable(id)" class="lw-btn lw-btn-subtle lw-btn-icon">+</button>
                    </template>
                    <template v-else>
                        <span v-for="tag in tables[id]" :key="tag" class="data-tag">{{ tag }}</span>
                    </template>
                    <div v-if="tables[id].length === 0 && !isEditingTables" class="data-empty">暂未习得任何能力</div>
                 </div>

                 <!-- 3.5 Text/Plot 渲染 (例如 Plot) -->
                 <div v-else-if="meta.renderType === 'text'" class="text-block">
                    <div class="plot-outline">
                       <strong>大纲:</strong> 
                       <textarea v-if="isEditingTables" v-model="tables[id].outline" class="inline-textarea" @change="saveTable(id)"></textarea>
                       <span v-else>{{ tables[id].outline }}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <!-- 4. 剧情深度记忆 (Tier 3) -->
      <div class="content-section">
        <div class="section-title-wrapper">
          <h3 class="section-main-title">深度记忆 (Tier 3)</h3>
        </div>
        <div class="memory-cards">
           <div class="memory-card">
              <div class="card-label">总体大纲 &lt;outline&gt;</div>
              <div class="card-text">{{ overallOutline || '尚未定义' }}</div>
           </div>
           
           <div class="memory-card">
              <div class="card-label">过往剧集 &lt;past_memories&gt;</div>
              <div class="memory-rows" v-if="pastMemories.length > 0">
                 <div v-for="(m, i) in pastMemories" :key="i" class="memory-row">
                    <div class="row-header">
                       <span class="row-time">{{ m.timeSpan }}</span>
                       <span class="row-loc">@{{ m.location }}</span>
                    </div>
                    <div class="row-summary">{{ m.summary }}</div>
                 </div>
              </div>
              <div v-else class="data-empty">记忆尚未复苏...</div>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch } from 'vue';
import { useDirectorStore } from '../DirectorStore';
import { useTier1Store } from '../Tier1Store';
import { lwStorage } from '../../../api/storage';
import { LuminaWeaveAPI } from '../../../api';

const lwApi = inject<LuminaWeaveAPI>('lwApi');

const directorStore = useDirectorStore();
const tier1Store = useTier1Store();

// --- 状态控制 ---
const isOrchestrationAsync = computed(() => lwStorage.get('lumina-director.orchestrationMode', 'piggyback') === 'async');
const isEditingTables = ref(false);

// --- 剧情概况同步 ---
const editableSummary = ref(directorStore.storySummary);
watch(() => directorStore.storySummary, (newVal) => {
    editableSummary.value = newVal;
});

const saveSummary = () => {
    directorStore.setStorySummary(editableSummary.value);
    // 触发世界书同步
    if (lwApi) {
        lwApi.promptWorldInfoMount.syncToWorldInfo();
    }
};

// --- 数据解耦绑定 ---
const tables = computed(() => tier1Store.tables);
const nextPlan = computed(() => directorStore.nextPlan);

// Tier 3 深度记忆
const overallOutline = computed(() => directorStore.overallOutline);
const pastMemories = computed(() => directorStore.pastMemories);

// --- Actions ---
const handleManualReload = async () => {
    if (lwApi) {
        await lwApi.reExecuteAllMutations();
        console.log('[DirectorPanel] 全量 M 标签同步重载完成');
    }
};

const handleReExecuteMutations = async () => {
    if (lwApi && lwApi.chatManager.activeLeafId) {
        await lwApi.reExecuteMutations(lwApi.chatManager.activeLeafId);
    }
};

const saveTable = (tableId: string) => {
    // 强制触发持久化同步 (通过 lwApi)
    if (lwApi) {
        console.log(`[DirectorPanel] 手动更新表格数据: ${tableId}`);
        // 确保 UI 更新能同步到 Lumina 的独立存储中
        lwApi.chatManager.saveToIndependentChat();
        // 如果正在生成，可能需要同步
        lwApi.promptWorldInfoMount.syncToWorldInfo();
    }
};

</script>

<style scoped>
.director-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    linear-gradient(180deg, rgba(var(--lw-bg-elevated-rgb), 0.42), rgba(var(--lw-bg-elevated-rgb), 0));
  color: var(--lw-text-main);
  overflow: hidden;
  font-family: var(--lw-font-main);
}

/* 1. Header Styles */
.panel-header {
  padding: 14px 18px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  border-bottom: 1px solid var(--lw-border-base);
  z-index: 10;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  font-size: 11px;
}

.action-btn.primary {
  background: var(--lw-primary);
}

/* 2. Content Sections */
.panel-content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.content-section {
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  border: 1px solid var(--lw-border-base);
  border-radius: 20px;
  padding: 16px;
  box-shadow: var(--lw-shadow);
}

.section-title-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-main-title {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  color: var(--lw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

/* 3. Plan Hub */
.plan-bubble-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-bubble {
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  padding: 12px 16px;
  transition: var(--lw-transition);
}

.bubble-label {
    font-size: 10px;
    font-weight: 800;
    color: var(--lw-text-muted);
    margin-bottom: 6px;
    text-transform: uppercase;
}

.bubble-text {
  font-size: 13px;
  color: var(--lw-text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.summary-textarea {
    width: 100%;
    min-height: 60px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--lw-text-main);
    font-size: 12px;
    line-height: 1.5;
    resize: vertical;
    font-family: inherit;
}

.summary-bubble {
    background: color-mix(in srgb, var(--lw-bg-surface) 88%, var(--lw-primary-soft));
}

.bubble-placeholder {
  color: var(--lw-text-muted);
  font-size: 12px;
  padding: 8px 0;
}

/* 4. Dynamic Tables Grid */
.dynamic-tables-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.table-card {
  padding: 0;
  overflow: hidden;
  transition: all 0.2s ease;
  border-radius: 16px;
}

.table-card.is-editing {
    border-color: var(--lw-primary);
    box-shadow: 0 0 0 1px var(--lw-primary);
}

.table-card-header {
  padding: 10px 14px;
  background: var(--lw-bg-subtle);
  border-bottom: 1px solid var(--lw-border-base);
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-icon { font-size: 14px; }

.table-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-secondary);
}

.table-schema-id {
  font-size: 9px;
  color: var(--lw-text-muted);
  font-family: var(--lw-font-mono);
  background: var(--lw-bg-surface);
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--lw-border-base);
}

.table-card-body {
  padding: 12px;
}

/* Inline Editors */
.inline-input {
    background: var(--lw-bg-app);
    border: 1px solid var(--lw-border-base);
    border-radius: 4px;
    color: var(--lw-text-main);
    font-size: 11px;
    padding: 2px 6px;
    width: 100%;
    outline: none;
}

.inline-input:focus {
    border-color: var(--lw-primary);
}

.inline-textarea {
    width: 100%;
    min-height: 40px;
    background: var(--lw-bg-app);
    border: 1px solid var(--lw-border-base);
    border-radius: 4px;
    color: var(--lw-text-main);
    font-size: 11px;
    padding: 4px 8px;
    margin-top: 4px;
    outline: none;
    resize: vertical;
}

.count-input { width: 50px; text-align: center; }
.affinity-input { width: 60px; }
.status-input { font-weight: bold; color: var(--lw-primary); }

.edit-tag-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--lw-bg-subtle);
    padding: 2px 4px;
    border-radius: 4px;
}

.tag-del {
    border: none;
    background: transparent;
    color: var(--lw-text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
}

.tag-del:hover { color: var(--lw-danger); }

/* Specific Renderers */
.data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.grid-item {
  background: var(--lw-bg-subtle);
  padding: 8px 12px;
  border-radius: var(--lw-radius-sm);
  display: flex;
  flex-direction: column;
}

.grid-item label { 
  font-size: 9px; 
  color: var(--lw-text-muted); 
  font-weight: 700; 
  text-transform: uppercase; 
  margin-bottom: 2px;
}

.grid-item span { 
  font-size: 12px; 
  color: var(--lw-text-main); 
  font-weight: 600; 
}

.relationships-list { display: flex; flex-direction: column; gap: 8px; }

.relationship-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-subtle);
}

.rel-info { display: flex; justify-content: space-between; align-items: center; }
.rel-name { font-size: 12px; font-weight: 700; color: var(--lw-text-main); }
.rel-status { font-size: 10px; color: var(--lw-text-muted); font-weight: 600; }

.rel-affinity { display: flex; align-items: center; gap: 10px; }
.affinity-track { flex: 1; height: 4px; background: var(--lw-border-base); border-radius: 2px; overflow: hidden; }
.affinity-fill { height: 100%; background: var(--lw-primary); border-radius: 2px; transition: width 0.5s ease; }
.affinity-num { font-size: 10px; font-weight: 800; color: var(--lw-primary); min-width: 20px; text-align: right; }

.data-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.data-table td { padding: 6px 4px; border-bottom: 1px solid var(--lw-border-subtle); }
.cell-main { font-weight: 600; color: var(--lw-text-secondary); width: 40%; }
.cell-val { color: var(--lw-primary); font-weight: 800; text-align: center; width: 15%; }
.cell-dim { color: var(--lw-text-muted); font-size: 10px; width: 45%; }

.tags-container { display: flex; flex-wrap: wrap; gap: 6px; }
.data-tag { 
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: var(--lw-bg-selection);
  color: var(--lw-primary);
}

.text-block { font-size: 12px; color: var(--lw-text-secondary); display: flex; flex-direction: column; gap: 6px; }

.data-empty { padding: 12px; text-align: center; font-size: 11px; color: var(--lw-text-muted); font-style: italic; }

/* 5. Memory Cards */
.memory-cards { display: flex; flex-direction: column; gap: 16px; }

.memory-card {
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  padding: 16px;
}

.card-label {
  font-size: 10px;
  font-weight: 800;
  color: var(--lw-primary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-text { font-size: 12px; line-height: 1.6; color: var(--lw-text-secondary); }

.memory-rows { display: flex; flex-direction: column; gap: 12px; }

.memory-row {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--lw-border-subtle);
}

.memory-row:last-child { border-bottom: none; padding-bottom: 0; }

.row-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.row-time { font-size: 9px; }
.row-loc { font-size: 10px; color: var(--lw-text-muted); font-weight: 600; }
.row-summary { font-size: 12px; color: var(--lw-text-main); font-weight: 500; line-height: 1.5; }

@keyframes blink {
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
}
</style>

