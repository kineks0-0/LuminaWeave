<template>
  <div class="lumina-nexus" :class="{ 'is-compact': isCompact }">
    <!-- 搜索栏 -->
    <div class="nexus-header">
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="搜索会话..." 
          class="search-input"
          @keydown.stop
        />
        <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <button v-if="!isCompact" class="nexus-collapse-btn" @click="$emit('close')" title="折叠">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
          <polyline points="11 17 6 12 11 7"></polyline>
          <polyline points="18 17 13 12 18 7"></polyline>
        </svg>
      </button>
    </div>

    <div class="nexus-scroll scroll-container">
      <!-- 核心枢纽 (置顶显示) -->
      <div v-if="coreSessions.length" class="nexus-section">
        <h3 class="section-title">核心枢纽</h3>
        <div class="nexus-list">
          <div 
            v-for="session in coreSessions" 
            :key="session.id" 
            class="nexus-item is-core"
            :class="{ 'is-active': session.isActive }"
            @click="handleSelect(session)"
          >
            <div class="item-icon-wrap" :class="session.type">
              <span v-if="session.type === 'forge'" class="icon">🧩</span>
              <span v-else class="icon">💬</span>
            </div>
            <div class="item-content">
              <div class="item-title">{{ session.title }}</div>
              <div class="item-subtitle">{{ session.subtitle }}</div>
            </div>
            <div v-if="session.isActive" class="active-indicator"></div>
          </div>
        </div>
      </div>

      <!-- 制卡历史 -->
      <div v-if="filteredForgeSessions.length" class="nexus-section">
        <h3 class="section-title">制卡历史</h3>
        <div class="nexus-list">
          <div 
            v-for="session in filteredForgeSessions" 
            :key="session.id" 
            class="nexus-item"
            :class="{ 'is-active': session.isActive }"
            @click="handleSelect(session)"
          >
            <div class="item-icon-wrap forge">
              <span class="icon">📦</span>
            </div>
            <div class="item-content">
              <div class="item-title">{{ session.title }}</div>
              <div class="item-subtitle">{{ formatDate(session.updatedAt) }}</div>
            </div>
            <div v-if="session.isActive" class="active-indicator"></div>
          </div>
        </div>
      </div>

      <!-- 剧情历史 -->
      <div v-if="filteredChatSessions.length" class="nexus-section">
        <h3 class="section-title">剧情历史</h3>
        <div class="nexus-list">
          <div 
            v-for="session in filteredChatSessions" 
            :key="session.id" 
            class="nexus-item"
            :class="{ 'is-active': session.isActive }"
            @click="handleSelect(session)"
          >
            <div class="item-icon-wrap chat">
              <span class="icon">📜</span>
            </div>
            <div class="item-content">
              <div class="item-title">{{ session.title }}</div>
              <div class="item-subtitle">{{ formatDate(session.updatedAt) }}</div>
            </div>
            <div v-if="session.isActive" class="active-indicator"></div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="isEmpty" class="nexus-empty">
        <p v-if="searchQuery">没有匹配的会话</p>
        <p v-else>暂无会话记录</p>
      </div>
    </div>

    <div class="nexus-footer">
      <div class="sync-status">
        <span class="status-dot online"></span>
        Nexus 机能同步中
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConversationContextStore } from '../stores/useConversationContextStore';

const props = defineProps<{
  isCompact?: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const contextStore = useConversationContextStore();

const searchQuery = ref('');

interface NexusSessionRef {
  id: string;
  title: string;
  subtitle: string;
  type: 'chat' | 'forge';
  updatedAt?: number;
  isActive: boolean;
  isCore?: boolean;
}

const coreSessions = computed<NexusSessionRef[]>(() => {
  const result: NexusSessionRef[] = [];
  const forgeSource = contextStore.sources.find((source) => source.id === 'forge');
  const chatSource = contextStore.sources.find((source) => source.id === 'chat');

  // 1. 当前制卡工坊会话
  const activeForgeId = forgeSource?.sessionId || null;
  if (activeForgeId) {
    const forgeSession = contextStore.forgeSessions.find(s => s.id === activeForgeId);
    result.push({
      id: activeForgeId,
      title: '当前制卡工坊',
      subtitle: forgeSession?.title || `Forge Workspace ${activeForgeId.slice(-4)}`,
      type: 'forge',
      isActive: contextStore.selectedViewSessionId === activeForgeId || (contextStore.activeSourceId === 'forge' && !contextStore.selectedViewSessionId),
      isCore: true
    });
  }

  // 2. ST 活跃聊天 (跟随主窗口)
  const currentChatId = chatSource?.sessionId || contextStore.currentChatSessionId;
  if (currentChatId) {
    const chatSession = contextStore.chatSessions.find(s => s.id === currentChatId);
    result.push({
      id: currentChatId,
      title: 'ST 活跃聊天',
      subtitle: chatSession?.title || '自动跟随主窗口',
      type: 'chat',
      isActive: contextStore.selectedViewSessionId === currentChatId || (contextStore.activeSourceId === 'chat' && !contextStore.selectedViewSessionId),
      isCore: true
    });
  }

  return result;
});

const filteredForgeSessions = computed<NexusSessionRef[]>(() => {
  const coreIds = new Set(coreSessions.value.map(s => s.id));
  return contextStore.forgeSessions
    .filter(s => !coreIds.has(s.id))
    .filter(s => !searchQuery.value || s.title.toLowerCase().includes(searchQuery.value.toLowerCase()))
    .map(s => ({
      id: s.id,
      title: s.title,
      subtitle: '',
      type: 'forge' as const,
      updatedAt: (s as any).updatedAt || (s as any).createdAt,
      isActive: contextStore.selectedViewSessionId === s.id
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
});

const filteredChatSessions = computed<NexusSessionRef[]>(() => {
  const coreIds = new Set(coreSessions.value.map(s => s.id));
  return contextStore.chatSessions
    .filter(s => !coreIds.has(s.id))
    .filter(s => !searchQuery.value || s.title.toLowerCase().includes(searchQuery.value.toLowerCase()))
    .map(s => ({
      id: s.id,
      title: s.title,
      subtitle: '',
      type: 'chat' as const,
      updatedAt: (s as any).updatedAt,
      isActive: contextStore.selectedViewSessionId === s.id
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
});

const isEmpty = computed(() => {
  return !coreSessions.value.length && !filteredForgeSessions.value.length && !filteredChatSessions.value.length;
});

const handleSelect = (session: NexusSessionRef) => {
  void contextStore.selectViewSession(session.id);
};

const formatDate = (ts?: number) => {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  const format = (n: number) => String(n).padStart(2, '0');
  
  if (isToday) {
    return `${format(date.getHours())}:${format(date.getMinutes())}`;
  }
  return `${format(date.getMonth() + 1)}/${format(date.getDate())} ${format(date.getHours())}:${format(date.getMinutes())}`;
};
</script>

<style scoped>
.lumina-nexus {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lw-glass-bg);
  backdrop-filter: blur(20px) saturate(180%);
  border-right: 1px solid var(--lw-glass-border);
  color: var(--lw-text-main);
  box-sizing: border-box;
}

.lumina-nexus.is-compact {
  border-right: none;
}

.nexus-header {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-base);
  border-radius: 8px;
  padding: 8px 32px;
  font-size: 13px;
  color: var(--lw-text-main);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-input:focus {
  outline: none;
  background: var(--lw-bg-elevated);
  border-color: var(--lw-primary);
  box-shadow: 0 0 0 3px rgba(var(--lw-primary-rgb), 0.1);
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--lw-text-muted);
  pointer-events: none;
}

.clear-search {
  position: absolute;
  right: 8px;
  border: none;
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
  display: flex;
  padding: 4px;
}

.nexus-collapse-btn {
  border: none;
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.nexus-collapse-btn:hover {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
}

.nexus-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;
}

.nexus-section {
  margin-top: 16px;
}

.section-title {
  padding: 0 12px;
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lw-text-muted);
}

.nexus-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nexus-item {
  position: relative;
  padding: 10px 12px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.nexus-item:hover {
  background: var(--lw-glass-bg-hover);
}

.nexus-item.is-active {
  background: var(--lw-bg-elevated);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.nexus-item.is-core {
  background: color-mix(in srgb, var(--lw-bg-elevated) 60%, transparent);
  border: 1px solid var(--lw-glass-border);
}

.nexus-item.is-core.is-active {
  background: var(--lw-bg-elevated);
  border-color: var(--lw-primary);
}

.item-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lw-bg-subtle);
  font-size: 16px;
  flex-shrink: 0;
}

.item-icon-wrap.forge {
  background: rgba(var(--lw-primary-rgb), 0.1);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-core .item-title {
  font-weight: 700;
}

.item-subtitle {
  font-size: 11px;
  color: var(--lw-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.active-indicator {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--lw-primary);
  box-shadow: 0 0 8px var(--lw-primary);
}

.nexus-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--lw-text-muted);
  font-size: 13px;
}

.nexus-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--lw-glass-border);
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--lw-text-muted);
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.online {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

/* 适配移动端或窄窗 */
@media (max-width: 480px) {
  .lumina-nexus {
    border-right: none;
  }
}
</style>
