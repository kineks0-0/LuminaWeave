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
          <h3 class="section-main-title">行动规划 (Next_Plan)</h3>
          <span class="lw-badge" :class="isOrchestrationAsync ? 'lw-badge-primary' : 'lw-badge-subtle'">
            {{ isOrchestrationAsync ? 'Async 模式' : 'Piggyback 模式' }}
          </span>
        </div>
        <div class="plan-bubble" :class="{ 'empty': !nextPlan }">
          <div v-if="nextPlan" class="bubble-text">{{ nextPlan }}</div>
          <div v-else class="bubble-placeholder">
            <span class="loading-dots">...</span>
            尚未探测到后续剧情波形
          </div>
        </div>
      </div>

      <!-- 3. 动态状态表格 (Persistent Snapshot) -->
      <div class="content-section">
        <div class="section-title-wrapper">
          <h3 class="section-main-title">世界快照 (Mutation Tables)</h3>
        </div>
        
        <div class="dynamic-tables-grid">
           <div v-for="(meta, id) in tier1Store.tableRegistry" :key="id" class="lw-card table-card">
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
                       <span>{{ val }}</span>
                    </div>
                 </div>

                 <!-- 3.2 Relationships 渲染 (例如 Characters) -->
                 <div v-else-if="meta.renderType === 'relationships'" class="relationships-list">
                    <div v-for="(char, name) in tables[id].npcs" :key="name" class="relationship-item">
                       <div class="rel-info">
                          <span class="rel-name">{{ name }}</span>
                          <span class="rel-status">{{ char.status }}</span>
                       </div>
                       <div class="rel-affinity">
                          <div class="affinity-track">
                             <div class="affinity-fill" :style="{ width: char.affinity + '%' }"></div>
                          </div>
                          <span class="affinity-num">{{ char.affinity }}</span>
                       </div>
                    </div>
                    <div v-if="Object.keys(tables[id].npcs).length === 0" class="data-empty">暂无人物数据</div>
                 </div>

                 <!-- 3.3 Table 渲染 (例如 Inventory) -->
                 <div v-else-if="meta.renderType === 'table'" class="table-wrapper">
                    <table class="data-table">
                       <tbody v-if="tables[id].length > 0">
                          <tr v-for="(item, idx) in tables[id]" :key="idx">
                             <td class="cell-main">{{ item.item }}</td>
                             <td class="cell-val">x{{ item.count }}</td>
                             <td class="cell-dim">{{ item.desc || '-' }}</td>
                          </tr>
                       </tbody>
                       <div v-else class="data-empty">列表为空</div>
                    </table>
                 </div>

                 <!-- 3.4 List 渲染 (例如 Skills) -->
                 <div v-else-if="meta.renderType === 'list'" class="tags-container">
                    <span v-for="tag in tables[id]" :key="tag" class="data-tag">{{ tag }}</span>
                    <div v-if="tables[id].length === 0" class="data-empty">暂未习得任何能力</div>
                 </div>

                 <!-- 3.5 Text/Plot 渲染 (例如 Plot) -->
                 <div v-else-if="meta.renderType === 'text'" class="text-block">
                    <div class="plot-outline"><strong>大纲:</strong> {{ tables[id].outline }}</div>
                    <div class="plot-tasks"><strong>任务:</strong> {{ tables[id].tasks?.join(', ') || '无' }}</div>
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
import { computed, inject } from 'vue';
import { useDirectorStore } from '../DirectorStore';
import { useTier1Store } from '../Tier1Store';
import { lwStorage } from '../../../api/storage';
import { LuminaWeaveAPI } from '../../../api';

const lwApi = inject<LuminaWeaveAPI>('lwApi');

const directorStore = useDirectorStore();
const tier1Store = useTier1Store();

// 获取配置
const isOrchestrationAsync = computed(() => lwStorage.get('lumina-director.orchestrationMode', 'piggyback') === 'async');

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

</script>

<style scoped>
.director-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lw-bg-app);
  color: var(--lw-text-main);
  overflow: hidden;
  font-family: var(--lw-font-main);
}

/* 1. Header Styles - Simplified Actions Only */
.panel-header {
  padding: 12px 20px;
  background: var(--lw-bg-surface);
  border-bottom: 1px solid var(--lw-border-base);
  z-index: 10;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 按钮统一使用 lw-btn 逻辑，这里只需微调 header 内部间距 */
.action-btn {
  padding: 6px 12px;
  font-size: 11px;
}

.action-btn.primary {
  background: var(--lw-primary); /* 确保一致性 */
}

/* 2. Content Sections */
.panel-content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-title-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-main-title {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  color: var(--lw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 3. Plan Bubble */
.plan-bubble {
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  border-left: 3px solid var(--lw-primary);
  border-radius: var(--lw-radius);
  padding: 16px;
  transition: var(--lw-transition);
}

.plan-bubble:hover {
  border-color: var(--lw-border-hover);
  box-shadow: var(--lw-shadow);
}

.bubble-text {
  font-size: 13px;
  color: var(--lw-text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.bubble-placeholder {
  color: var(--lw-text-muted);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-dots { font-weight: 900; animation: blink 1.5s infinite; }

/* 4. Dynamic Tables Grid */
.dynamic-tables-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.table-card {
  padding: 0; /* 内部 padding 重新控制 */
  overflow: hidden;
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

.data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.data-table td { padding: 8px 4px; border-bottom: 1px solid var(--lw-border-subtle); }
.cell-main { font-weight: 600; color: var(--lw-text-secondary); }
.cell-val { color: var(--lw-primary); font-weight: 800; text-align: center; }
.cell-dim { color: var(--lw-text-muted); font-size: 11px; }

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

.data-empty { padding: 12px; text-align: center; font-size: 12px; color: var(--lw-text-muted); font-style: italic; }

/* 5. Memory Cards */
.memory-cards { display: flex; flex-direction: column; gap: 16px; }

.memory-card {
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius);
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
.row-time { 
  font-size: 9px;
}
.row-loc { font-size: 10px; color: var(--lw-text-muted); font-weight: 600; }
.row-summary { font-size: 12px; color: var(--lw-text-main); font-weight: 500; line-height: 1.5; }

@keyframes blink {
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
}
</style>

