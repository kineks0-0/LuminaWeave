<template>
  <div 
    class="lw-sidebar-root" 
    :class="{ 'is-bubbled': isBubbled, 'is-dragging': isDragging }"
    :style="{ 
      left: position.x + 'px', 
      top: position.y + 'px' 
    }"
  >
    <!-- 悬浮球模式 (Bubble) -->
    <div v-if="isBubbled" class="lw-bubble" 
      @mousedown="startDrag" 
      @touchstart.passive="startDrag"
      @click="handleBubbleClick">
      <div class="lw-dot"></div>
      <div class="bubble-hover-hint">Lumina</div>
    </div>

    <!-- 面板模式 (Panel) -->
    <div v-else class="lw-sidebar">
      <div class="lw-sidebar-header" @mousedown="startDrag" @touchstart.passive="startDrag">
        <div class="lw-logo">
          <span class="lw-dot"></span>
          Lumina
        </div>
        <div class="lw-header-actions">
          <button class="lw-btn-action" @click="isBubbled = true" title="收起为悬浮球">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <button class="lw-btn-action expand" @click="$emit('expand')" title="展开全网页视图">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M15 3h6v6"></path>
              <path d="M10 14L21 3"></path>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="lw-sidebar-content">
        <p class="lw-text-mini">当前世界线</p>
        <div class="lw-timeline-node active">
          <div class="node-indicator"></div>
          <div class="node-content">
            <span class="node-title">活跃时空端点</span>
            <span class="node-desc">{{ initStatusText }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue';
import { lwStorage } from '../api/storage';
import { luminaWeaveApi as lwApi } from '../api/index';

defineEmits<{
  (e: 'expand'): void
}>();

// --- 状态与初始化进度 ---
const initStatusText = ref('系统启动中...');
const handleProgress = (text: string) => {
  initStatusText.value = text;
};

onMounted(() => {
  lwApi.on('INIT_PROGRESS', handleProgress);
  if ((lwApi as any)._ready) {
    initStatusText.value = '实时指纹捕获中...';
  }
});

onUnmounted(() => {
  lwApi.off('INIT_PROGRESS', handleProgress);
});

// --- 状态持久化 ---
const isBubbled = ref(lwStorage.get('lumina-ui.miniSidebar.isBubbled', false, 'Global'));

/**
 * 核心修复：坐标纠偏算法
 * 确保在不同分辨率设备间同步时，悬浮窗始终保持在可视区域内。
 */
const getSafePosition = (savedPos: { x: number, y: number }) => {
  const sidebarWidth = isBubbled.value ? 56 : 240;
  const sidebarHeight = isBubbled.value ? 56 : 180;
  
  // 采样当前视口尺寸
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 算法：如果坐标超出屏幕，则强制推回边缘；如果从未保存过，则默认右下角。
  let x = savedPos.x;
  let y = savedPos.y;

  // 纠偏逻辑
  if (x + sidebarWidth > vw) x = vw - sidebarWidth - 20;
  if (y + sidebarHeight > vh) y = vh - sidebarHeight - 20;
  if (x < 0) x = 20;
  if (y < 0) y = 20;

  return { x, y };
};

const savedPosition = lwStorage.get('lumina-ui.miniSidebar.position', { x: window.innerWidth - 260, y: 60 }, 'Global');
const position = reactive(getSafePosition(savedPosition));

// --- 拖拽逻辑 ---
const isDragging = ref(false);
const dragOffset = { x: 0, y: 0 };
let hasMoved = false;

const getCoords = (e: MouseEvent | TouchEvent) => {
  if ('touches' in e) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
};

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return;
  
  hasMoved = true;
  const { x, y } = getCoords(e);
  let newX = x - dragOffset.x;
  let newY = y - dragOffset.y;
  
  // 边界检查：动态根据当前模式获取尺寸
  const sidebarWidth = isBubbled.value ? 56 : 240;
  const sidebarHeight = isBubbled.value ? 56 : 180;
  
  newX = Math.max(0, Math.min(window.innerWidth - sidebarWidth, newX));
  newY = Math.max(0, Math.min(window.innerHeight - sidebarHeight, newY));
  
  position.x = newX;
  position.y = newY;

  // 移动端防止滚动
  if (e.cancelable) e.preventDefault();
};

const stopDrag = () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', stopDrag);
  
  // 最终校验并保存位置
  const safePos = getSafePosition(position);
  position.x = safePos.x;
  position.y = safePos.y;
  
  lwStorage.set('lumina-ui.miniSidebar.position', { ...position }, 'Global');
};

const startDrag = (e: MouseEvent | TouchEvent) => {
  // 如果点击的是按钮，不触发拖拽
  if ((e.target as HTMLElement).closest('button')) return;
  
  isDragging.value = true;
  hasMoved = false;
  
  const { x, y } = getCoords(e);
  dragOffset.x = x - position.x;
  dragOffset.y = y - position.y;
  
  if (e.type === 'mousedown') {
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
  } else {
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
  }
};

const handleBubbleClick = (e: MouseEvent | TouchEvent) => {
  // 如果只是拖动，不切换状态
  if (!hasMoved) {
    isBubbled.value = false;
  }
};

// 监听状态变化并保存
watch(isBubbled, (val) => {
  lwStorage.set('lumina-ui.miniSidebar.isBubbled', val, 'Global');
});
</script>

<script lang="ts">
export default {
  name: 'MiniSidebar'
};
</script>

<style scoped>
.lw-sidebar-root {
  position: fixed;
  z-index: 10001;
  user-select: none;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s;
}

.lw-sidebar-root.is-dragging {
  opacity: 0.8;
  transition: none; /* 拖拽时禁用平滑过渡 */
}

/* 悬浮球视图 */
.lw-bubble {
  width: 56px;
  height: 56px;
  background: var(--lw-surface);
  backdrop-filter: var(--lw-glass-blur);
  -webkit-backdrop-filter: var(--lw-glass-blur);
  border: 1px solid var(--lw-border);
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: var(--lw-shadow);
  position: relative;
  transition: all 0.3s ease;
}

.lw-bubble:hover {
  transform: scale(1.1);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.lw-bubble:active {
  cursor: grabbing;
}

.bubble-hover-hint {
  position: absolute;
  bottom: -24px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.lw-bubble:hover .bubble-hover-hint {
  opacity: 1;
}

/* 面板视图 */
.lw-sidebar {
  width: 240px;
  background: var(--lw-surface);
  backdrop-filter: var(--lw-glass-blur);
  -webkit-backdrop-filter: var(--lw-glass-blur);
  border: 1px solid var(--lw-border);
  border-radius: var(--lw-radius);
  box-shadow: var(--lw-shadow);
  overflow: hidden;
}

.lw-sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--lw-border);
  background: rgba(255, 255, 255, 0.5);
  cursor: grab;
}

.lw-sidebar-header:active {
  cursor: grabbing;
}

.lw-logo {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--lw-text-main);
  font-size: 13px;
}

.lw-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--lw-primary);
  box-shadow: 0 0 8px var(--lw-primary);
  animation: pulse 2s infinite ease-in-out;
}

.lw-header-actions {
  display: flex;
  gap: 4px;
}

.lw-btn-action {
  background: none;
  border: none;
  color: var(--lw-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: var(--lw-transition);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lw-btn-action:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--lw-primary);
}

.lw-sidebar-content {
  padding: 14px;
}

.lw-text-mini {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--lw-text-secondary);
  margin-top: 0;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.lw-timeline-node {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.02);
}

.node-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--lw-primary);
  background: var(--lw-primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
  margin-top: 3px;
}

.node-content {
  display: flex;
  flex-direction: column;
}

.node-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--lw-text-main);
}

.node-desc {
  font-size: 11px;
  color: var(--lw-text-secondary);
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
  70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
}
</style>
