<template>
  <div class="memory-panel lw-widget-padding">
    <div class="panel-section memory-section">
      <div class="section-header">
        <h3 class="section-title">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"></path>
            <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
            <path d="M2 15h10"></path>
            <path d="M6 12l-4 3 4 3"></path>
          </svg>
          宏观记忆 (Tier 3/长线)
        </h3>
        <span class="mode-badge" :class="isMemoryAsync ? 'async' : 'piggyback'">
          {{ isMemoryAsync ? 'Async后台推演' : '随显挂载' }}
        </span>
      </div>

      <div class="section-body">
        <div class="memory-list" v-if="tier3Memories && tier3Memories.length > 0">
          <div class="memory-item" v-for="(mem, idx) in tier3Memories" :key="idx">
            <div class="memory-bullet"></div>
            <div class="memory-text">{{ mem }}</div>
            <button class="delete-btn" @click="removeTier3(idx)" title="移除此条目">×</button>
          </div>
        </div>
        <div class="card-empty memory-empty" v-else>
          宏观时间线尚未发生显著波动，需要积累更多节点。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDirectorStore } from '../../director/DirectorStore';
import { lwStorage } from '../../../api/storage';

const directorStore = useDirectorStore();

// 获取当前配置引擎的主设置
const isMemoryAsync = computed(() => lwStorage.get('lumina-memory.memoryMode', 'async') === 'async');

// --- Tier 3 数据获取 ---
const tier3Memories = computed(() => directorStore.pastMemories.map(m => `${m.timeSpan} | ${m.summary}`));

const removeTier3 = (index: number) => {
    if (index >= 0 && index < directorStore.pastMemories.length) {
        directorStore.pastMemories.splice(index, 1);
    }
};
</script>

<style scoped>
.memory-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
  background: #f8fafc;
  height: 100%;
  overflow-y: auto;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 8px;
}

.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title svg {
  color: var(--lw-primary);
}

.mode-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.mode-badge.piggyback {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #cbd5e1;
}

.mode-badge.async {
  background: #e0e7ff;
  color: #4f46e5;
  border: 1px solid #c7d2fe;
}

.card-empty {
  padding: 16px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-style: italic;
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memory-item {
  background: #ffffff;
  border: 1px solid #fecdd3;
  border-left: 3px solid #f43f5e;
  padding: 10px 12px;
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  transition: all 0.2s;
  position: relative;
}

.memory-item:hover {
  border-color: #fda4af;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

.memory-bullet {
  width: 6px;
  height: 6px;
  background: #f43f5e;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.memory-text {
  flex: 1;
  font-size: 13px;
  color: #1f2937;
  line-height: 1.4;
}

.memory-empty {
  background: #fff;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  color: #f43f5e;
}
</style>
