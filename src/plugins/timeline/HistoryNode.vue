<template>
  <div class="l-node-wrapper"
    :class="{ active: data.isActive, 'in-active-path': data.isInActivePath, ghost: !data.isInActivePath }">
    <!-- Current Path Badge - 更具质感的标签 -->
    <div v-if="data.isActive" class="active-badge">
      <span class="badge-glow"></span>
      CURRENT PATH
    </div>

    <div class="l-card" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
      <div class="l-card-header">
        <div class="l-header-top">
          <div class="l-title-group">
            <span class="l-label">TIMELINE {{ getTimelineLabel }}</span>
            <span v-if="data.isActive" class="l-status-pill active">ACTIVE</span>
            <span v-else-if="!data.isInActivePath" class="l-status-pill dormant">DORMANT</span>
          </div>
          <div class="l-meta-tags">
            <span v-if="data.node.role !== 'user'" class="l-stat-tag">
              <span class="dot"></span> HP: 100%
            </span>
          </div>
        </div>
      </div>

      <div class="l-card-body">
        <p class="l-main-text">{{ getPreviewText(data.node.text) }}</p>
      </div>

      <div class="l-card-footer">
        <div class="l-footer-left">
          <div class="l-avatar-wrapper">
            <div class="l-avatar" :class="data.node.role">
              <template v-if="data.node.role === 'user'">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </template>
              <template v-else>
                <div class="ai-icon">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"></path>
                    <path d="M12 8v4l3 3"></path>
                  </svg>
                </div>
              </template>
            </div>
            <div class="avatar-ring" v-if="data.isActive"></div>
          </div>
          <div class="l-author-info">
            <span class="l-author">{{ data.node.role === 'user' ? 'You' : (data.node.name || 'Assistant') }}</span>
          </div>
        </div>
        <div class="l-footer-right">
          <!-- Quick Actions Integrated in Footer -->
          <div class="l-footer-actions">
            <button class="l-action-btn-mini preview" @click.stop="handleAction('preview')" title="全文详情">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button class="l-action-btn-mini branch" @click.stop="handleAction('branch')" title="从此分支">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                <line x1="6" y1="3" x2="6" y2="15"></line>
                <circle cx="18" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <path d="M18 9a9 9 0 0 1-9 9"></path>
              </svg>
            </button>
            <button class="l-action-btn-mini rollback" @click.stop="handleAction('rollback')" title="物理回退">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                <path d="M3 10h10a5 5 0 1 1 5 5v3"></path>
                <polyline points="7 14 3 10 7 6"></polyline>
              </svg>
            </button>
          </div>

          <div class="l-floor-tag">FL {{ String(data.node.depth + 1).padStart(2, '0') }}</div>

          <!-- todo:记得处理这个 <div class="l-branch-tag" v-if="(data.node.childrenCount ?? 0) > 1" @click.stop="handleAction('switch')">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="7 13 12 18 17 13"></polyline>
              <polyline points="7 6 12 11 17 6"></polyline>
            </svg>
            <span>分支</span>
          </div> -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject, onMounted, onUnmounted, watch } from 'vue';
import { type TimelineViewNode } from './LuminaTimeline.vue';
import { EventType } from '@logicflow/core';

const props = defineProps<{
  node: {
    id: string;
    properties: {
      node: TimelineViewNode;
      isActive: boolean;
      isInActivePath: boolean;
      activeLeafId: string | null;
      activePathIds: string[];
      isFocused: boolean;
      onFocusChange?: (id: string | null) => void;
      onSwitchBranch?: (node: TimelineViewNode) => void;
    }
  }
}>();

const lwApi = (window as any).LuminaWeave;

// 注入 LogicFlow 提供的获取方法
const getNode = inject<() => any>('getNode');
const getGraph = inject<() => any>('getGraph');

// 内部驱动的响应式属性（手动同步）
const internalProperties = ref(props.node.properties);

// 关键修复：监听 props 变化，确保与 LogicFlow 的模型同步（实现世界线大窗口状态同步）
watch(() => props.node.properties, (newVal) => {
  internalProperties.value = newVal;
}, { deep: true });

const data = computed(() => internalProperties.value);
const isHovered = ref(false);

onMounted(() => {
  if (getNode && getGraph) {
    const nodeInstance = getNode();
    const graphInstance = getGraph();
    //console.log('[HistoryNode] Mounting node:', props.node.id);

    const updateHandler = (eventData: any) => {
      // 仅处理当前 ID 匹配的属性变更
      if (eventData.id === props.node.id) {
        console.log('[HistoryNode] Received property change (event):', eventData);
        internalProperties.value = {
          ...internalProperties.value,
          ...eventData.properties
        };
      }
    };

    graphInstance.eventCenter.on(EventType.NODE_PROPERTIES_CHANGE, updateHandler);

    onUnmounted(() => {
      console.log('[HistoryNode] Unmounting node:', props.node.id);
      graphInstance.eventCenter.off(EventType.NODE_PROPERTIES_CHANGE, updateHandler);
    });
  }
});

const handleAction = (type: string, _fn?: Function) => {
  if (lwApi) {
    lwApi.emit('TIMELINE_NODE_ACTION', { type, node: data.value.node });
  } else {
    console.error('[HistoryNode] lwApi not found, cannot emit action.');
  }
};

const getTimelineLabel = computed(() => {
  const node = data.value.node;
  const trackChar = String.fromCharCode(65 + (node.trackIndex || 0));
  return `${trackChar}${data.value.isActive ? ' (ACTIVE)' : ''}`;
});

const getPreviewText = (text?: string): string => {
  if (!text) return '...';
  let plain = text.replace(/<[^>]+>/g, '');
  return plain.length > 500 ? plain.substring(0, 500) + '...' : plain;
};

const formatTime = (ts?: number) => {
  if (!ts) return '00:00';
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
</script>

<style scoped>
.l-node-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 15px;
  perspective: 1000px;
  width: 100%;
  height: 100%;
}

.active-badge {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--lw-primary);
  color: white;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 12px;
  border-radius: 20px;
  z-index: 50;
  white-space: nowrap;
  letter-spacing: 1px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  display: flex;
  align-items: center;
  overflow: hidden;
}

.badge-glow {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shine 3s infinite;
}

@keyframes shine {
  0% {
    left: -100%;
  }

  20% {
    left: 200%;
  }

  100% {
    left: 200%;
  }
}

.l-card {
  width: 100%;
  background: var(--lw-bg-surface);
  backdrop-filter: var(--lw-glass-blur);
  border-radius: var(--lw-radius);
  border: 1.5px solid var(--lw-border-base);
  box-shadow: var(--lw-shadow-hover);
  display: flex;
  flex-direction: column;
  transition: var(--lw-transition);
  position: relative;
}

.l-node-wrapper.active .l-card {
  border-color: var(--lw-primary);
  box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.1);
}

.l-node-wrapper.ghost .l-card {
  opacity: 0.7;
  filter: saturate(0.8);
}

.l-card-header {
  padding: 16px 20px 10px;
}

.l-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.l-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.l-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--lw-text-dim);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.l-status-pill {
  font-size: 11px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.l-status-pill.dormant {
  background: var(--lw-bg-app);
  color: var(--lw-text-dim);
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.l-meta-tags {
  display: flex;
  gap: 8px;
}

.l-stat-tag {
  font-size: 10px;
  font-weight: 700;
  color: #10b981;
  display: flex;
  align-items: center;
  gap: 4px;
}

.l-stat-tag .dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
}

.l-card-body {
  padding: 0 20px 16px;
}

.l-main-text {
  font-size: 14px;
  color: var(--lw-text-main);
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 10;
  line-clamp: 10;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 500;
}

.l-card-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--lw-border-base);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.l-footer-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.l-avatar-wrapper {
  position: relative;
  width: 24px;
  height: 24px;
}

.l-avatar {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background: var(--lw-bg-app);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-text-dim);
  overflow: hidden;
  border: 1px solid var(--lw-border-base);
}

.l-avatar.user {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.avatar-ring {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 1.5px solid var(--lw-primary);
  border-radius: 6px;
  pointer-events: none;
}

.l-author-info {
  display: flex;
  flex-direction: column;
}

.l-author {
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.l-floor-tag {
  font-size: 10px;
  font-weight: 800;
  color: var(--lw-text-dim);
  font-family: monospace;
  background: var(--lw-bg-app);
  padding: 2px 6px;
  border-radius: 4px;
}

.l-footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.l-footer-actions {
  display: flex;
  gap: 6px;
  margin-right: 4px;
}

.l-action-btn-mini {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-surface);
  color: var(--lw-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--lw-transition);
}

.l-action-btn-mini:hover {
  transform: translateY(-1px);
  border-color: var(--lw-primary);
  color: var(--lw-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.l-action-btn-mini.rollback:hover {
  color: #ef4444;
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.l-action-btn-mini:active {
  transform: scale(0.9);
}
</style>
