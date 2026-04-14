<template>
  <div
    ref="rootRef"
    class="lw-workspace-window"
    role="region"
    :aria-labelledby="`window-title-${title}`"
    :class="{
      'is-main': kind === 'main',
      'is-active': isActive,
      'is-closing': isClosingLocal,
      'is-moving': interactionMode === 'move',
      'is-resizing': interactionMode === 'resize',
      'is-interacting': interactionMode !== null,
      'is-compact': isCompact
    }"
    :style="rootStyle"
    @pointerdown="emit('focus')"
  >
    <div ref="shellRef" class="lw-workspace-window-shell" :style="shellStyle">
      <div class="window-topbar">
        <button
          class="window-drag-handle window-drag-handle-top"
          type="button"
          aria-label="拖拽窗口"
          @pointerdown.stop.prevent="startMove"
        >
          <span class="window-drag-pill"></span>
        </button>
        <div class="window-heading" @pointerdown.stop.prevent="startMove">
          <div class="window-copy">
            <span v-if="eyebrow" class="window-eyebrow">{{ eyebrow }}</span>
            <div class="window-title-row">
              <span v-if="icon" class="window-icon" v-html="icon"></span>
              <span :id="`window-title-${title}`" class="window-title">{{ title }}</span>
            </div>
          </div>
          <div class="window-heading-side">
            <div v-if="$slots.actions" class="window-actions" @pointerdown.stop>
              <slot name="actions" />
            </div>
            <button
              v-if="closable"
              class="window-close"
              type="button"
              aria-label="关闭窗口"
              @pointerdown.stop
              @click.stop="handleCloseClick"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="window-body">
        <slot />
      </div>

      <div
        v-if="resizable"
        class="window-resizer"
        aria-label="调整大小"
        @pointerdown.stop.prevent="startResize"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  kind?: 'main' | 'widget';
  icon?: string;
  eyebrow?: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  sceneLeft?: number;
  sceneTop?: number;
  sceneRight?: number;
  sceneBottom?: number;
  closable?: boolean;
  resizable?: boolean;
  zIndex?: number;
  isActive?: boolean;
  isCompact?: boolean;
}>(), {
  kind: 'widget',
  icon: '',
  eyebrow: '',
  minWidth: 320,
  maxWidth: 980,
  minHeight: 320,
  maxHeight: 1000,
  sceneLeft: 0,
  sceneTop: 0,
  sceneRight: 0,
  sceneBottom: 0,
  closable: true,
  resizable: true,
  zIndex: 1,
  isActive: false,
  isCompact: false
});

const emit = defineEmits<{
  (e: 'updateLayout', patch: { x?: number; y?: number; width?: number; height?: number; interaction?: 'move' | 'resize'; isFinal?: boolean }): void;
  (e: 'requestClose'): void;
  (e: 'focus'): void;
  (e: 'switchAdjacent', direction: 'prev' | 'next'): void;
}>();

type DragMode = 'move' | 'resize' | 'switch' | null;

const rootRef = ref<HTMLElement | null>(null);
const shellRef = ref<HTMLElement | null>(null);
const interactionMode = ref<DragMode>(null);
const settleX = ref(0);
const settleY = ref(0);
const settleScale = ref(1);
const isClosingLocal = ref(false);
let activePointerId: number | null = null;
let activePointerTarget: HTMLElement | null = null;
let dragFrameId = 0;
let liveX = 0;
let liveY = 0;
let liveWidth = 0;
let liveHeight = 0;

let pointerStartX = 0;
let pointerStartY = 0;
let startLeft = 0;
let startTop = 0;
let startWidth = 0;
let startHeight = 0;
let lastPointerX = 0;
let lastPointerY = 0;
let lastMoveAt = 0;
let velocityX = 0;
let velocityY = 0;
let settleFrame = 0;
const rootStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  width: `${props.width}px`,
  height: `${props.height}px`,
  zIndex: props.zIndex
}));

const shellStyle = computed(() => {
  const transforms: string[] = [];

  if (settleX.value || settleY.value) {
    transforms.push(`translate3d(${settleX.value}px, ${settleY.value}px, 0)`);
  }

  if (interactionMode.value === 'move' || interactionMode.value === 'resize') {
    // 交互期间通过 Direct DOM 直接操作 transform，此处仅保留交互态的微移效果
    //transforms.push('translate3d(0, -1px, 0) ');//scale(1.002)
  } else if (settleScale.value !== 1) {
    //transforms.push(`scale(${settleScale.value})`);
  }

  return {
    transform: transforms.length ? transforms.join(' ') : undefined,
    transformOrigin: interactionMode.value === 'resize' ? '100% 100%' : '50% 50%'
  };
});

const getParentSize = () => {
  const parent = rootRef.value?.parentElement;
  return {
    width: parent?.clientWidth ?? window.innerWidth,
    height: parent?.clientHeight ?? window.innerHeight
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const cancelSettleAnimation = () => {
  if (settleFrame) {
    cancelAnimationFrame(settleFrame);
    settleFrame = 0;
  }
};

const setInteractionTransitionsEnabled = (enabled: boolean) => {
  const rootEl = rootRef.value;
  const shellEl = shellRef.value;
  if (rootEl) {
    rootEl.style.transition = enabled ? '' : 'none';
  }
  if (shellEl) {
    shellEl.style.transition = enabled ? '' : 'none';
  }
};

const capturePointer = (event: PointerEvent) => {
  activePointerId = event.pointerId;
  activePointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  if (activePointerTarget?.setPointerCapture) {
    try {
      activePointerTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures on browsers that reject late capture.
    }
  }
};

const releasePointerCapture = () => {
  if (activePointerTarget?.releasePointerCapture && activePointerId !== null) {
    try {
      activePointerTarget.releasePointerCapture(activePointerId);
    } catch {
      // Ignore release failures when capture was never established.
    }
  }
  activePointerId = null;
  activePointerTarget = null;
};



const animateSettle = (initialX: number, initialY: number, initialScale = 1, duration = 240) => {
  cancelSettleAnimation();
  const start = performance.now();
  settleX.value = initialX;
  settleY.value = initialY;
  settleScale.value = initialScale;

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    settleX.value = initialX * (1 - eased);
    settleY.value = initialY * (1 - eased);
    settleScale.value = initialScale + (1 - initialScale) * eased;

    if (t < 1) {
      settleFrame = requestAnimationFrame(tick);
      return;
    }

    settleX.value = 0;
    settleY.value = 0;
    settleScale.value = 1;
    settleFrame = 0;
  };

  settleFrame = requestAnimationFrame(tick);
};

const captureVelocity = (event: PointerEvent) => {
  const now = performance.now();
  if (!lastMoveAt) {
    lastMoveAt = now;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    return;
  }

  const dt = Math.max(16, now - lastMoveAt);
  velocityX = (event.clientX - lastPointerX) / dt;
  velocityY = (event.clientY - lastPointerY) / dt;
  lastMoveAt = now;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
};

const bindPointerEvents = () => {
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', stopInteraction);
  document.addEventListener('pointercancel', stopInteraction);
};

const unbindPointerEvents = () => {
  document.removeEventListener('pointermove', handlePointerMove);
  document.removeEventListener('pointerup', stopInteraction);
  document.removeEventListener('pointercancel', stopInteraction);
};

const isOutsideSceneBounds = () => {
  const parentSize = getParentSize();
  const rightEdge = parentSize.width - props.sceneRight;
  const bottomEdge = parentSize.height - props.sceneBottom;
  return (
    props.x < props.sceneLeft ||
    props.y < props.sceneTop ||
    props.x + props.width > rightEdge ||
    props.y + props.height > bottomEdge
  );
};

const startMove = (event: PointerEvent) => {
  if (isClosingLocal.value) return;
  emit('focus');
  cancelSettleAnimation();
  capturePointer(event);
  setInteractionTransitionsEnabled(false);
  interactionMode.value = 'move';
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  startLeft = props.x;
  startTop = props.y;
  liveX = startLeft;
  liveY = startTop;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  lastMoveAt = performance.now();
  velocityX = 0;
  velocityY = 0;

  // UX 增强
  document.body.style.userSelect = 'none';
  if (rootRef.value) {
    rootRef.value.style.willChange = 'transform, width, height';
  }

  bindPointerEvents();
};

const startResize = (event: PointerEvent) => {
  if (isClosingLocal.value) return;
  emit('focus');
  cancelSettleAnimation();
  capturePointer(event);
  setInteractionTransitionsEnabled(false);
  interactionMode.value = 'resize';
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  startWidth = props.width;
  startHeight = props.height;
  liveWidth = startWidth;
  liveHeight = startHeight;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  lastMoveAt = performance.now();
  velocityX = 0;
  velocityY = 0;

  // UX 增强
  document.body.style.userSelect = 'none';
  if (rootRef.value) {
    rootRef.value.style.willChange = 'transform, width, height';
  }

  bindPointerEvents();
};

const handlePointerMove = (event: PointerEvent) => {
  if (!interactionMode.value) return;
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  if (event.pointerType !== 'mouse') {
    event.preventDefault();
  }
  captureVelocity(event);

  if (dragFrameId) cancelAnimationFrame(dragFrameId);

  dragFrameId = requestAnimationFrame(() => {
    const dx = event.clientX - pointerStartX;
    const dy = event.clientY - pointerStartY;

    if (interactionMode.value === 'move') {
      const bounds = {
        left: props.sceneLeft,
        top: props.sceneTop,
        right: window.innerWidth - props.sceneRight,
        bottom: window.innerHeight - props.sceneBottom
      };
      
      const targetX = startLeft + dx;
      const targetY = startTop + dy;
      
      // 本地弹性边界计算 (Elastic Bounds)
      const maxX = Math.max(bounds.left, bounds.right - props.width);
      const maxY = Math.max(bounds.top, bounds.bottom - props.height);
      
      const applyElastic = (val: number, min: number, max: number) => {
        if (val < min) return min - (min - val) * 0.16;
        if (val > max) return max + (val - max) * 0.16;
        return val;
      };

      liveX = applyElastic(targetX, bounds.left, maxX);
      liveY = applyElastic(targetY, bounds.top, maxY);

      if (rootRef.value) {
        // 使用 translate3d 触发 GPU 加速且避开 Layout
        rootRef.value.style.transform = `translate3d(${liveX - startLeft}px, ${liveY - startTop}px, 0)`;
      }
    } else if (interactionMode.value === 'resize') {
      const minW = props.minWidth || 320;
      const minH = props.minHeight || 320;
      const maxW = Math.max(minW, props.maxWidth * 1.2);
      const maxH = Math.max(minH, props.maxHeight * 1.2);

      const targetW = startWidth + dx;
      const targetH = startHeight + dy;

      const applyElasticSize = (val: number, min: number, max: number) => {
        if (val < min) return min - (min - val) * 0.14;
        if (val > max) return max + (val - max) * 0.14;
        return val;
      };

      liveWidth = applyElasticSize(targetW, minW, maxW);
      liveHeight = applyElasticSize(targetH, minH, maxH);

      if (rootRef.value) {
        rootRef.value.style.width = `${liveWidth}px`;
        rootRef.value.style.height = `${liveHeight}px`;
      }
    }
  });
};

const stopInteraction = () => {
  releasePointerCapture();
  if (dragFrameId) cancelAnimationFrame(dragFrameId);

  // 恢复 UX
  document.body.style.userSelect = '';
  if (rootRef.value) {
    rootRef.value.style.willChange = '';
    rootRef.value.style.transform = '';
  }

  if (interactionMode.value === 'move') {
    // 最终状态同步回 Vue
    emit('updateLayout', { x: liveX, y: liveY, interaction: 'move', isFinal: true });
    if (!isOutsideSceneBounds()) {
      animateSettle(clamp(velocityX * 40, -8, 8), clamp(velocityY * 40, -8, 8), 1.003, 200);
    }
  } else if (interactionMode.value === 'resize') {
    emit('updateLayout', { width: liveWidth, height: liveHeight, interaction: 'resize', isFinal: true });
    if (!isOutsideSceneBounds()) {
      animateSettle(clamp(velocityX * 12, -3, 3), clamp(velocityY * 12, -3, 3), 1.006, 210);
    }
  }

  interactionMode.value = null;
  unbindPointerEvents();
  requestAnimationFrame(() => {
    setInteractionTransitionsEnabled(true);
  });
};

// 直接通知父组件移除，由 Vue TransitionGroup 统一处理离场动画
// 避免 WAAPI 的 fill:'forwards' 与 CSS transition 在桌面端产生渲染冲突
const handleCloseClick = () => {
  if (isClosingLocal.value) return;
  cancelSettleAnimation();
  interactionMode.value = null;
  unbindPointerEvents();
  releasePointerCapture();
  setInteractionTransitionsEnabled(true);
  isClosingLocal.value = true;
  emit('requestClose');
};

const onGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isActive && props.closable && !isClosingLocal.value) {
    handleCloseClick();
  }
};

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
});

onUnmounted(() => {
  releasePointerCapture();
  setInteractionTransitionsEnabled(true);
  cancelSettleAnimation();
  window.removeEventListener('keydown', onGlobalKeydown);
  unbindPointerEvents();
});
</script>

<style scoped>
.lw-workspace-window {
  position: absolute;
  min-height: 0;
  display: flex;
  flex-direction: column;
  will-change: left, top, width, height, opacity, transform, filter;

  /* Glassmorphism Core shifted to root per user feedback */
  background: var(--lw-glass-bg);
  border: 1px solid var(--lw-glass-border);
  border-radius: 28px;
  box-shadow: 0 22px 56px var(--lw-glass-shadow);
  backdrop-filter: blur(var(--lw-glass-blur, 20px)) saturate(var(--lw-glass-saturate, 125%));
  overflow: hidden;

  transition:
    left 240ms cubic-bezier(0.16, 1, 0.3, 1),
    top 240ms cubic-bezier(0.16, 1, 0.3, 1),
    width 260ms cubic-bezier(0.16, 1, 0.3, 1),
    height 260ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 280ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 320ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: 50% 60%;
}

.lw-workspace-window-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  will-change: transform;
  transition:
    transform 180ms cubic-bezier(0.25, 1, 0.5, 1);
}


.lw-workspace-window.is-main {
  z-index: 2;
}

.lw-workspace-window.is-active {
  border-color: var(--lw-border-active);
  box-shadow: 0 32px 64px var(--lw-glass-shadow);
}

.lw-workspace-window.is-closing {
  pointer-events: none;
}

.lw-workspace-window.is-interacting {
  transition: none;
}

.lw-workspace-window.is-interacting .lw-workspace-window-shell {
  transition: none;
}

.lw-workspace-window.workspace-window-motion-enter-active,
.lw-workspace-window.workspace-window-motion-leave-active {
  transition:
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 340ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 380ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lw-workspace-window.workspace-window-motion-enter-active .lw-workspace-window-shell,
.lw-workspace-window.workspace-window-motion-leave-active .lw-workspace-window-shell {
  transition:
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 340ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lw-workspace-window.workspace-window-motion-enter-from,
.lw-workspace-window.workspace-window-motion-appear-from {
  opacity: 0;
  filter: blur(14px);
  transform: translate3d(0, 34px, 0) scale(0.936);
}

.lw-workspace-window.workspace-window-motion-enter-from .lw-workspace-window-shell,
.lw-workspace-window.workspace-window-motion-appear-from .lw-workspace-window-shell {
  opacity: 0.88;
  transform: translate3d(0, 10px, 0) scale(0.988);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.1);
}

.lw-workspace-window.workspace-window-motion-leave-to {
  opacity: 0;
  filter: blur(20px);
  transform: translate3d(0, 36px, 0) scale(0.928);
}

.lw-workspace-window.workspace-window-motion-leave-to .lw-workspace-window-shell {
  opacity: 0.72;
  transform: translate3d(0, 12px, 0) scale(0.982);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.lw-workspace-window.workspace-window-motion-leave-active {
  transition:
    transform 560ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 440ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lw-workspace-window.workspace-window-motion-leave-active .lw-workspace-window-shell {
  transition:
    transform 560ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 440ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 380ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 340ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lw-workspace-window.workspace-window-motion-move {
  transition:
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lw-workspace-window.is-moving .lw-workspace-window-shell,
.lw-workspace-window.is-resizing .lw-workspace-window-shell {
  border-color: var(--lw-border-active);
  box-shadow: 0 28px 44px var(--lw-glass-shadow);
}

.window-topbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  min-height: 64px;
  padding: 12px 16px 14px;
  border-bottom: 1px solid var(--lw-glass-border);
  background: var(--lw-glass-bg-hover);
  transition:
    background 180ms cubic-bezier(0.25, 1, 0.5, 1),
    border-color 180ms cubic-bezier(0.25, 1, 0.5, 1);
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.window-drag-handle {
  width: 100%;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: grab;
  touch-action: none;
}

.window-drag-handle:active {
  cursor: grabbing;
}

.window-drag-pill {
  width: 88px;
  height: 5px;
  border-radius: 999px;
  background: rgba(17, 18, 21, 0.22);
  transition:
    transform 160ms cubic-bezier(0.25, 1, 0.5, 1),
    background 160ms cubic-bezier(0.25, 1, 0.5, 1);
}

.window-heading {
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -2px;
  padding: 2px;
  cursor: grab;
  touch-action: none;
}

.lw-workspace-window.is-moving .window-topbar,
.lw-workspace-window.is-resizing .window-topbar {
  background: var(--lw-glass-bg-hover);
}

.lw-workspace-window.is-moving .window-drag-pill,
.lw-workspace-window.is-resizing .window-drag-pill,
.window-drag-handle:hover .window-drag-pill {
  transform: scaleX(1.08);
  background: rgba(var(--lw-primary-rgb), 0.44);
}

.window-copy {
  flex: 1;
  width: auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  user-select: none;
  -webkit-user-select: none;
}

.window-heading-side {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.window-actions {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  cursor: default;
  touch-action: auto;
}

.window-eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.window-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.window-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 10px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  border: 1px solid var(--lw-border-subtle);
}

.window-title {
  font-family: var(--lw-font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--lw-text-main);
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
  -webkit-user-select: none;
}

.window-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
  transition: var(--lw-transition);
}

.window-close:hover {
  background: color-mix(in srgb, var(--lw-danger) 10%, white);
  color: var(--lw-danger);
  border-color: color-mix(in srgb, var(--lw-danger) 22%, white);
}

.window-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.window-resizer {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 22px;
  height: 22px;
  cursor: nwse-resize;
  touch-action: none;
}

.window-resizer::after {
  content: '';
  position: absolute;
  right: 1px;
  bottom: 1px;
  width: 12px;
  height: 12px;
  border-right: 2px solid transparent;
  border-bottom: 2px solid transparent;
  border-radius: 0 0 8px 0;
  transition:
    border-color 160ms cubic-bezier(0.25, 1, 0.5, 1),
    transform 160ms cubic-bezier(0.25, 1, 0.5, 1);
}

.lw-workspace-window.is-resizing .window-resizer::after,
.window-resizer:hover::after {
  border-color: rgba(var(--lw-primary-rgb), 0.52);
  transform: translate(-1px, -1px);
}


@media (max-width: 768px) {
  .lw-workspace-window {
    border-radius: 24px;
  }

  .window-topbar {
    min-height: 72px;
    padding: 12px 14px 12px;
  }

  .window-drag-pill {
    width: 104px;
    height: 6px;
  }

  .window-heading {
    gap: 10px;
  }

  .window-heading-side {
    gap: 8px;
  }

  .window-close {
    width: 34px;
    height: 34px;
    border-radius: 12px;
  }

  .window-resizer {
    right: 8px;
    bottom: 8px;
    width: 28px;
    height: 28px;
  }
}

.lw-workspace-window.is-compact {
  border-radius: 24px;
}

.lw-workspace-window.is-compact .window-topbar {
  min-height: 72px;
  padding: 12px 14px 12px;
}

.lw-workspace-window.is-compact .window-drag-pill {
  width: 104px;
  height: 6px;
}

.lw-workspace-window.is-compact .window-heading {
  gap: 10px;
}

.lw-workspace-window.is-compact .window-heading-side {
  gap: 8px;
}

.lw-workspace-window.is-compact .window-close {
  width: 34px;
  height: 34px;
  border-radius: 12px;
}

.lw-workspace-window.is-compact .window-resizer {
  right: 8px;
  bottom: 8px;
  width: 28px;
  height: 28px;
}
</style>
