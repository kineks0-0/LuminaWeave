<template>
  <div
    class="director-panel lw-widget-padding"
    :class="{ 'is-mobile': props.isMobile, 'is-small': props.mode === 'small' }"
    :data-skin-variant="directorVariant || 'default'"
    :style="directorPanelStyle"
  >
    
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
import { ref, computed, inject, watch, type CSSProperties } from 'vue';
import { useDirectorStore } from '../DirectorStore.js';
import { useTier1Store } from '../Tier1Store.js';
import { lwStorage } from '../../../api/storage.js';
import { LuminaWeaveAPI } from '../../../api';
import { useComponentSkin } from '../../../theme/useComponentSkin.js';

const props = withDefaults(defineProps<{
  mode?: 'large' | 'small';
  isMobile?: boolean;
}>(), {
  mode: 'small',
  isMobile: false
});

const lwApi = inject<LuminaWeaveAPI>('lwApi');
const { cssVars: directorCssVars, variant: directorVariant } = useComponentSkin('director.panel');
const directorPanelStyle = computed<CSSProperties>(() => directorCssVars.value as CSSProperties);

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
    if (lwApi) {
        const context = await lwApi.services.conversation.getContext({ sourceId: 'chat' });
        if (!context.activeLeafId) return;
        await lwApi.reExecuteMutations(context.activeLeafId);
    }
};

const saveTable = (tableId: string) => {
    // 强制触发持久化同步 (通过 lwApi)
    if (lwApi) {
        console.log(`[DirectorPanel] 手动更新表格数据: ${tableId}`);
        // 确保 UI 更新能同步到 Lumina 的独立存储中
        void lwApi.saveToIndependentChat();
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

.director-panel[data-skin-variant='telegram'] {
  background:
    var(--lw-director-panel-highlight, radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.72), transparent 34%)),
    var(--lw-director-panel-bg, rgba(232, 245, 255, 0.58));
  padding: 0;
}

/* 1. Header Styles */
.panel-header {
  padding: 14px 18px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  border-bottom: 1px solid var(--lw-border-base);
  z-index: 10;
}

.director-panel[data-skin-variant='telegram'] .panel-header {
  padding: 12px 14px;
  background: var(--lw-director-header-bg, rgba(255, 255, 255, 0.62));
  border-bottom-color: var(--lw-director-header-border, rgba(148, 190, 219, 0.34));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
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

.director-panel[data-skin-variant='telegram'] .header-actions {
  flex-wrap: wrap;
}

.director-panel[data-skin-variant='telegram'] .action-btn {
  min-height: 40px;
  border-radius: 999px;
  box-shadow: none;
}

.director-panel[data-skin-variant='telegram'].is-mobile .action-btn {
  min-height: 44px;
  flex: 1 1 0;
}

.content-section {
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  border: 1px solid var(--lw-border-base);
  border-radius: 20px;
  padding: 16px;
  box-shadow: var(--lw-shadow);
}

.director-panel[data-skin-variant='telegram'] .panel-content-scroll {
  padding: 14px;
  gap: 14px;
}

.director-panel[data-skin-variant='telegram'].is-mobile .panel-content-scroll {
  padding: 12px 12px calc(92px + env(safe-area-inset-bottom, 0px));
}

.director-panel[data-skin-variant='telegram'] .content-section {
  background: var(--lw-director-section-bg, rgba(255, 255, 255, 0.74));
  border-color: var(--lw-director-section-border, rgba(148, 190, 219, 0.38));
  border-radius: 18px;
  box-shadow: var(--lw-director-section-shadow, var(--lw-telegram-panel-shadow, 0 18px 42px rgba(44, 92, 130, 0.1)));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
}

.section-title-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-main-title {
  margin: 0;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-muted);
  text-transform: uppercase;
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
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
    color: var(--lw-text-muted);
    margin-bottom: 6px;
    text-transform: uppercase;
}

.bubble-text {
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  font-weight: var(--lw-type-body-medium-weight);
  letter-spacing: var(--lw-type-body-medium-tracking);
  color: var(--lw-text-secondary);
  white-space: pre-wrap;
}

.summary-textarea {
    width: 100%;
    min-height: 60px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--lw-text-main);
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
    resize: vertical;
    font-family: inherit;
}

.summary-bubble {
    background: color-mix(in srgb, var(--lw-bg-surface) 88%, var(--lw-primary-soft));
}

.bubble-placeholder {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
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

.table-icon {
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  font-weight: var(--lw-type-label-large-weight);
  letter-spacing: var(--lw-type-label-large-tracking);
}

.table-name {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-secondary);
}

.table-schema-id {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
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
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
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
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
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
    font-size: var(--lw-type-label-large-size);
    line-height: var(--lw-type-label-large-line-height);
    font-weight: var(--lw-type-label-large-weight);
    letter-spacing: var(--lw-type-label-large-tracking);
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
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-muted); 
  font-weight: var(--lw-type-label-small-weight);
  text-transform: uppercase; 
  margin-bottom: 2px;
}

.grid-item span { 
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-main); 
  font-weight: var(--lw-type-body-small-weight);
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
.rel-name {
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
  color: var(--lw-text-main);
}
.rel-status {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-muted);
}

.rel-affinity { display: flex; align-items: center; gap: 10px; }
.affinity-track { flex: 1; height: 4px; background: var(--lw-border-base); border-radius: 2px; overflow: hidden; }
.affinity-fill { height: 100%; background: var(--lw-primary); border-radius: 2px; transition: width 0.5s ease; }
.affinity-num {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-primary);
  min-width: 20px;
  text-align: right;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}
.data-table td { padding: 6px 4px; border-bottom: 1px solid var(--lw-border-subtle); }
.cell-main { font-weight: var(--lw-type-label-medium-weight); color: var(--lw-text-secondary); width: 40%; }
.cell-val { color: var(--lw-primary); font-weight: var(--lw-type-title-small-weight); text-align: center; width: 15%; }
.cell-dim {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  width: 45%;
}

.director-panel[data-skin-variant='telegram'] .plan-bubble,
.director-panel[data-skin-variant='telegram'] .table-card,
.director-panel[data-skin-variant='telegram'] .memory-card,
.director-panel[data-skin-variant='telegram'] .relationship-item {
  background: var(--lw-director-control-bg, rgba(255, 255, 255, 0.7));
  border-color: var(--lw-director-control-border, rgba(148, 190, 219, 0.32));
  border-radius: 16px;
  box-shadow: none;
}

.director-panel[data-skin-variant='telegram'] .table-card-header {
  min-height: 44px;
  background: var(--lw-director-control-header-bg, rgba(227, 244, 255, 0.5));
  border-bottom-color: var(--lw-director-control-border, rgba(148, 190, 219, 0.28));
}

.director-panel[data-skin-variant='telegram'] .summary-textarea,
.director-panel[data-skin-variant='telegram'] .inline-input,
.director-panel[data-skin-variant='telegram'] .inline-textarea {
  min-height: 44px;
  border-radius: 14px;
  border-color: var(--lw-director-input-border, rgba(148, 190, 219, 0.36));
  background: var(--lw-director-input-bg, rgba(255, 255, 255, 0.72));
}

.director-panel[data-skin-variant='telegram'] .data-table {
  border-collapse: separate;
  border-spacing: 0;
}

.director-panel[data-skin-variant='telegram'] .data-table td {
  min-height: 44px;
  padding: 10px 8px;
  border-bottom-color: var(--lw-director-table-border, rgba(148, 190, 219, 0.22));
}

.director-panel[data-skin-variant='telegram'] .data-tag,
.director-panel[data-skin-variant='telegram'] .lw-badge,
.director-panel[data-skin-variant='telegram'] .table-schema-id {
  border-radius: 999px;
}

.director-panel[data-skin-variant='telegram'].is-mobile .dynamic-tables-grid,
.director-panel[data-skin-variant='telegram'].is-small .dynamic-tables-grid {
  gap: 12px;
}

.director-panel[data-skin-variant='telegram'].is-mobile .content-section,
.director-panel[data-skin-variant='telegram'].is-small .content-section {
  padding: 14px;
}

.tags-container { display: flex; flex-wrap: wrap; gap: 6px; }
.data-tag { 
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  text-transform: uppercase;
  background: var(--lw-bg-selection);
  color: var(--lw-primary);
}

.text-block {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-secondary);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.data-empty {
  padding: 12px;
  text-align: center;
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-muted);
  font-style: italic;
}

/* 5. Memory Cards */
.memory-cards { display: flex; flex-direction: column; gap: 16px; }

.memory-card {
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  padding: 16px;
}

.card-label {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-primary);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.card-text {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-secondary);
}

.memory-rows { display: flex; flex-direction: column; gap: 12px; }

.memory-row {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--lw-border-subtle);
}

.memory-row:last-child { border-bottom: none; padding-bottom: 0; }

.row-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.row-time {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
}
.row-loc {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-muted);
}
.row-summary {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-main);
}

@keyframes blink {
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
}
</style>

