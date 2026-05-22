<template>
  <div class="lw-timeline-container" :class="mode" :data-skin-variant="timelineVariant || 'default'" :style="timelineSkinStyle">

    <div class="large-viewport-container"></div>
    <TeleportContainer :flow-id="flowId" />

    <div class="large-timeline-wrapper" style="width: 100%; height: 100%;">
      <div class="large-header">
        <div class="header-left">
          <div class="header-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>时空图谱</span>
            <span class="header-source-pill">{{ currentSourceLabel }}</span>
          </div>
          <div class="header-tools">
            <button class="lw-btn lw-btn-ghost tool-btn" title="居中对齐" @click="focusOnActiveLeaf">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 2v2m0 16v2m10-10h-2M4 12H2"></path>
              </svg>
            </button>
            <button class="lw-btn lw-btn-ghost tool-btn"
              :title="layoutOrientation === 'horizontal' ? '切换为纵向布局' : '切换为横向布局'" @click="toggleOrientation">
              <svg v-if="layoutOrientation === 'horizontal'" viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M19 12l-7 7-7-7"></path>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="header-right">
          <div class="active-pulse">
            <span class="pulse-dot"></span>
            实时同步中
          </div>
        </div>
      </div>

      <div class="l-canvas" ref="lfContainerRef" style="width: 100%; height: 100%;">
        <!-- LogicFlow 将挂载在此处 -->
      </div>

      <div class="canvas-controls" :class="{ 'is-mobile': isMobileDevice }">
        <div v-if="!isMobileDevice" class="control-group mode-toggle">
          <button class="lw-btn mode-btn" :class="wheelMode === 'zoom' ? 'lw-btn-primary' : 'lw-btn-ghost'"
            @click="toggleWheelMode" :title="wheelMode === 'zoom' ? '脚本：缩放' : '脚本：滚动'">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          <button class="lw-btn mode-btn" :class="wheelMode === 'scroll' ? 'lw-btn-primary' : 'lw-btn-ghost'"
            @click="toggleWheelMode">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="5 9 2 12 5 15"></polyline>
              <polyline points="9 5 12 2 15 5"></polyline>
              <polyline points="15 19 12 22 9 19"></polyline>
              <polyline points="19 9 22 12 19 15"></polyline>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="12" y1="2" x2="12" y2="22"></line>
            </svg>
          </button>
        </div>

        <div class="control-group zoom-controls">
          <button class="lw-btn lw-btn-ghost c-btn" @click="handleZoom(true)" title="放大">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button class="lw-btn lw-btn-ghost c-btn" @click="handleZoom(false)" title="缩小">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <div class="c-divider"></div>
          <button class="lw-btn lw-btn-ghost c-btn fit" @click="resetTransform" title="适应屏幕">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
            </svg>
          </button>
        </div>

        <div class="control-group legend">
          <div class="l-item"><span class="l-dot active"></span><span>Active</span></div>
          <div class="l-item"><span class="l-dot dormant"></span><span>Dormant</span></div>
        </div>
      </div>
    </div>    <!-- Global Switching Overlay -->
    <transition name="fade">
      <div v-if="isSwitching" class="global-loading-overlay">
        <div class="loading-content">
          <div class="spinner-container">
            <div class="spinner"></div>
            <div class="spinner-ring"></div>
          </div>
          <h3 class="loading-title">正在跳转时空分叉...</h3>
          <p class="loading-desc">正在重塑世界线一致性，请稍候</p>
        </div>
      </div>
    </transition>

    <!-- Message Detail Modal -->
    <NodePreviewModal v-if="previewingNode" :node="previewingNode" @close="previewingNode = null"
      @branch="handleBranchNode" />


  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, nextTick, markRaw, watch, computed } from 'vue';
import { luminaWeaveApi as lwApi } from '../../api/index.js';
import type { TimelineNode } from '../../api/index.js';
import LogicFlow, { HtmlNodeModel, PolylineEdgeModel } from '@logicflow/core';
//import { Menu } from '@logicflow/extension';
import { register, getTeleport } from '@logicflow/vue-node-registry';
import { VueNodeModel } from '@logicflow/vue-node-registry';
import { PolylineEdge } from '@logicflow/core';
import '@logicflow/core/dist/index.css';
import '@logicflow/extension/lib/style/index.css';

import { Dagre } from '@logicflow/layout/es/dagre';
import HistoryNode from './HistoryNode.vue';
import NodePreviewModal from './NodePreviewModal.vue';

import gsap from 'gsap';
import { useComponentSkin } from '../../theme/useComponentSkin.js';
import { useTimelineGraphViewModel, type TimelineViewNode } from './useTimelineGraphViewModel.js';

// LogicFlow 节点属性定义
export interface HistoryNodeProperties {
  node: TimelineViewNode;
  isActive: boolean;
  isInActivePath: boolean;
  isFocused: boolean;
  onBranch: (node: TimelineViewNode) => void;
  onRollback: (node: TimelineViewNode) => void;
  onPreview: (node: TimelineViewNode) => void;
  onSwitchBranch: (node: TimelineViewNode) => void;
  onFocusChange?: (id: string | null) => void;
  orientation?: 'horizontal' | 'vertical';
  width?: number;
  height?: number;
}

// --- 布局常量配置 ---
const NODE_LAYOUT_CONFIG = {
  WIDTH: 340,
  SAFE_MARGIN: 10,
  MIN_HEIGHT: 160,
  // 测量参数
  MEASURE_WIDTH: 267, // 340 - 30(wrapper) - 40(body) - 3(border)
  LINE_HEIGHT: 22.4,
  FONT_SIZE: 14,
  MAX_LINES: 10,
  // 基础高度校准 (需匹配 HistoryNode.vue 的非文本区域高度)
  // Wrapper(30) + Border(3) + Header(26+24) + BodyPadding(16) + Footer(24+26) + Border(1) = ~150
  BASE_HEIGHT: 154, 
  ACTIVE_INCREMENT: 32, // Badge 占据的空间与额外间距
};

// --- LogicFlow 定制模型 ---
class HistoryNodeModel extends VueNodeModel {
  //private __height = -1;
  setAttributes() {
    // 强制固定宽度，高度由 properties.nodeHeight 决定（由 calculateNodeHeight 计算并注入）
    //super.setAttributes();
    this.width = NODE_LAYOUT_CONFIG.WIDTH;
    // @ts-ignore
    this.height = this.properties.nodeHeight ?? NODE_LAYOUT_CONFIG.MIN_HEIGHT;
    //console.log('[HistoryNodeModel] setAttributes2: width', this.width, 'height', this.height);
  }

  getDefaultAnchor() {
    const { orientation } = this.properties;
    const { width, height, x, y } = this;
    if (orientation === 'vertical') {
      // 竖向布局：上下锚点
      return [
        { x: x, y: y - height / 2, id: 'top' },
        { x: x, y: y + height / 2, id: 'bottom' },
      ];
    } else {
      // 横向布局：左右锚点
      return [
        { x: x - width / 2, y: y, id: 'left' },
        { x: x + width / 2, y: y, id: 'right' },
      ];
    }
  }
}

class TimelineEdgeModel extends PolylineEdgeModel {
  getEdgeStyle() {
    const style = super.getEdgeStyle();
    const { isHighlighted } = this.properties;
    if (isHighlighted) {
      style.stroke = 'var(--lw-timeline-line-active, var(--lw-primary))';
      style.strokeWidth = 3;
      style.opacity = 1;
    } else {
      style.stroke = 'var(--lw-timeline-line-color, var(--lw-border-strong))';
      style.strokeWidth = 1.5;
      style.opacity = 0.4;
    }
    return style;
  }
}



/**
 * 动态测量节点高度
 * 基准宽度 340px，利用 pretext 进行精确测量
 */
const calculateNodeHeight = (text: string, isActive: boolean) => {
  if (!lwApi?.measureService) {
    // Fallback: 如果服务未就绪，使用旧的保守估算法
    const plainText = text;//getPreviewText(text);//text.replace(/<[^>]+>/g, '').trim();
    const charsPerLine = Math.floor(NODE_LAYOUT_CONFIG.MEASURE_WIDTH / 7); // 估算字符宽度
    const lineCount = Math.ceil(plainText.length / charsPerLine) || 1;
    const clampedLines = Math.min(NODE_LAYOUT_CONFIG.MAX_LINES, lineCount);
    const height = NODE_LAYOUT_CONFIG.BASE_HEIGHT + (clampedLines * NODE_LAYOUT_CONFIG.LINE_HEIGHT) + (isActive ? NODE_LAYOUT_CONFIG.ACTIVE_INCREMENT : 0);
    return Math.max(NODE_LAYOUT_CONFIG.MIN_HEIGHT, height + NODE_LAYOUT_CONFIG.SAFE_MARGIN);
  }

  // 使用 pretext 测量服务
  const result = lwApi.measureService.measure(text, {
    width: NODE_LAYOUT_CONFIG.MEASURE_WIDTH,
    lineHeight: NODE_LAYOUT_CONFIG.LINE_HEIGHT,
    fontSize: NODE_LAYOUT_CONFIG.FONT_SIZE,
    fontFamily: "Aptos, 'MiSans', 'PingFang SC', sans-serif",
    fontWeight: 500,
    maxLines: NODE_LAYOUT_CONFIG.MAX_LINES
  });

  let totalHeight = NODE_LAYOUT_CONFIG.BASE_HEIGHT + result.height;
  if (isActive) totalHeight += NODE_LAYOUT_CONFIG.ACTIVE_INCREMENT;

  const finalResult = Math.max(NODE_LAYOUT_CONFIG.MIN_HEIGHT, Math.ceil(totalHeight) + NODE_LAYOUT_CONFIG.SAFE_MARGIN);
  return finalResult;
};

// 增加锁，防止并发 ELK 布局导致的时序错乱
let isLayouting = false;
let pendingRefresh = false;
let shouldCenterNextLayout = false; // 标志位：是否在下次布局后居中活跃节点

const props = defineProps<{
  mode?: 'small' | 'large',
  isMobile?: boolean
}>();
const { cssVars: timelineSkinVars, variant: timelineVariant } = useComponentSkin('timeline.root');
const timelineSkinStyle = computed(() => timelineSkinVars.value);

// 内部判定移动端，增加对 navigator 的 fallback 以增强稳健性
const isMobileDevice = computed(() => {
  return props.isMobile || (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
});
const isTelegramSingleColumnTimeline = computed(() => timelineVariant.value === 'telegram' && isMobileDevice.value);
const isCanvasEnabled = computed(() => props.mode === 'large' && !isTelegramSingleColumnTimeline.value);

const lf = ref<LogicFlow | null>(null);
const lfContainerRef = ref<HTMLElement | null>(null);
const timeline = useTimelineGraphViewModel({ enabled: isCanvasEnabled });
const {
  timelineGraph,
  flattenedTree,
  activeLeafId,
  activePathIds,
  focusedNodeId,
  isSwitching,
  previewingNode,
  currentSourceLabel,
  getPreviewText,
  handlePreviewNode,
  handleBranchNode,
  handleRollbackNode,
  handleJumpNode,
} = timeline;
const layoutOrientation = ref<'horizontal' | 'vertical'>('horizontal');
const wheelMode = ref<'zoom' | 'scroll'>('zoom');
const isFirstLargeLayoutDone = ref(false); // 优化：仅在首次进入大窗口或重载时强制缩放

const TeleportContainer = getTeleport();
const flowId = ref('');

const toggleWheelMode = () => {
  wheelMode.value = wheelMode.value === 'zoom' ? 'scroll' : 'zoom';
  if (lf.value) {
    lf.value.updateEditConfig({
      stopZoomGraph: wheelMode.value === 'scroll',
      stopScrollGraph: wheelMode.value === 'zoom',
    });
  }
};

// --- 逻辑注册 ---
const initLogicFlow = () => {
  if (!lfContainerRef.value || lf.value) return;

  const lfInstance = new LogicFlow({
    container: lfContainerRef.value,
    background: {
      backgroundColor: 'var(--lw-timeline-canvas-bg, var(--lw-bg-app))', // 统一底色
    },
    grid: {
      size: 40, // 稀疏点阵间距，与设计稿同步
      visible: true,
      type: 'dot',
      config: {
        color: 'var(--lw-timeline-line-color, var(--lw-border-strong))', // 点颜色
        thickness: 1.5,    // 点大小
      }
    },
    keyboard: {
      enabled: true,
    },
    edgeTextDraggable: false,
    hoverOutline: false,
    plugins: [Dagre],
    hideAnchors: true,
    // 默认开启滚轮缩放，禁用滚轮滚动（由切换按钮控制）
    // 移动端默认不拦截，以便手势生效
    stopZoomGraph: wheelMode.value === 'scroll',
    stopScrollGraph: wheelMode.value === 'zoom',
    //stopScrollGraph: false, // 允许滚动/拖拽画布
    stopMoveGraph: false,
    adjustNodePosition: false,
    isSilentMode: true,
    stopMoveNode: true,
    stopResizeNode: true,
    nodeSelectedOutline: false,
    edgeSelectedOutline: false,
    editConfig: {
      stopMoveNode: true, // 禁止移动节点，拖拽节点将触发画布移动
    }
  });

  //const graphModel = lfInstance.graphModel;

  // 注册自定义 Vue 节点
  register({
    type: 'history-node',
    component: HistoryNode,
    // @ts-ignore
    model: HistoryNodeModel,
  }, lfInstance);

  lfInstance.register({
    type: 'timeline-edge',
    view: PolylineEdge,
    model: TimelineEdgeModel
  });

  // 设置默认样式
  lfInstance.setTheme({
    polyline: {
      stroke: 'var(--lw-timeline-line-color, var(--lw-border-strong))',
      strokeWidth: 2,
      radius: 12, // 圆角半径
    },
    // 保留 bezier 以防 small mode 或其他地方用到，虽然 large mode 主力用 polyline
    bezier: {
      stroke: 'var(--lw-timeline-line-color, var(--lw-border-strong))',
      strokeWidth: 2,
      curviness: 0.5,
    }
  });

  lf.value = markRaw(lfInstance);

  // 事件监听 
  /*lfInstance.on('node:click', ({ data }) => {
    if (data?.properties?.node) {
      handleNodeClick(data.properties.node);
    }
  }); */
  lfInstance.graphModel.addNodeMoveRules((model, deltaX, deltaY) => {
    lfInstance.translate(deltaX, deltaY);
    return true;
  });

  //lfInstance.graphModel.setPartial(true);

  lfInstance.on('graph:rendered', ({ graphModel }) => {
    flowId.value = graphModel.flowId!;
    console.log('[LuminaTimeline] graph:rendered, flowId:', flowId.value);
  });
};

const toggleOrientation = () => {
  layoutOrientation.value = layoutOrientation.value === 'horizontal' ? 'vertical' : 'horizontal';
  shouldCenterNextLayout = true; // 切换布局时请求居中
  refreshTree();
};

const handleZoom = (isZoomIn: boolean) => {
  if (!lf.value) return;
  //const _lf = lf.value;
  const graphModel = lf.value.graphModel;
  const transformModel = graphModel.transformModel;
  const currentScale = transformModel.SCALE_X;
  const targetScale = isZoomIn ? currentScale * 1.2 : currentScale / 1.2;

  const animProxy = { scale: currentScale };
  gsap.to(animProxy, {
    scale: targetScale,
    duration: 0.4,
    ease: "power2.out",
    overwrite: "auto",
    onUpdate: () => {
      // 核心：使用 transformModel.zoom 配合视口中心进行平滑缩放
      //const center: [number, number] = [transformModel.TRANSLATE_X * -1 * transformModel.SCALE_X, transformModel.TRANSLATE_Y * -1 * transformModel.SCALE_Y];
      //transformModel.zoom(animProxy.scale, center);
      if (lf.value) lf.value.zoom(animProxy.scale);
    }
  });
};

const resetTransform = () => {
  if (lf.value) {
    const transformModel = lf.value.graphModel.transformModel;
    // 记录重置前的状态
    const beforeTransform = {
      SCALE_X: transformModel.SCALE_X,
      SCALE_Y: transformModel.SCALE_Y,
      TRANSLATE_X: transformModel.TRANSLATE_X,
      TRANSLATE_Y: transformModel.TRANSLATE_Y,
    };

    // 执行 LogicFlow 原生的重置与自适应计算
    lf.value.resetTranslate();
    lf.value.fitView(100);

    // 获取目标状态（fitView 计算后的最终坐标）
    const targetTransform = {
      SCALE_X: transformModel.SCALE_X,
      SCALE_Y: transformModel.SCALE_Y,
      TRANSLATE_X: transformModel.TRANSLATE_X,
      TRANSLATE_Y: transformModel.TRANSLATE_Y,
    };

    // 立即还原原始状态，为 GSAP 动画做准备
    transformModel.SCALE_X = beforeTransform.SCALE_X;
    transformModel.SCALE_Y = beforeTransform.SCALE_Y;
    transformModel.TRANSLATE_X = beforeTransform.TRANSLATE_X;
    transformModel.TRANSLATE_Y = beforeTransform.TRANSLATE_Y;

    // 平滑过渡到 targetTransform
    gsap.to(transformModel, {
      SCALE_X: targetTransform.SCALE_X,
      SCALE_Y: targetTransform.SCALE_Y,
      TRANSLATE_X: targetTransform.TRANSLATE_X,
      TRANSLATE_Y: targetTransform.TRANSLATE_Y,
      duration: 0.5,
      ease: "power2.inOut",
      overwrite: true
    });
  }
};

const focusOnActiveLeaf = () => {
  if (lf.value && activeLeafId.value) {
    lf.value.focusOn({ id: String(activeLeafId.value) });
  } else {
    resetTransform();
  }
};

const refreshTree = async () => {
  if (!isCanvasEnabled.value) return;

  if (props.mode === 'large' && isLayouting) {
    pendingRefresh = true;
    return;
  }

  const graphData = timelineGraph.value as Record<string, TimelineNode>;
  const rawNodes = Object.values(graphData);

  console.log('[LuminaTimeline] refreshTree mode:', props.mode, 'rawNodes:', rawNodes.length, 'activeLeafId:', activeLeafId.value);

  // 1. 构建索引
  const childrenMap = new Map<string, string[]>();
  rawNodes.forEach((n: TimelineNode) => {
    if (n.parentId) {
      if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
      childrenMap.get(n.parentId)!.push(n.id);
    }
  });

  // 2. 识别选中路径 (Focused Path)
  const focusedPathIds = new Set<string | number>();
  if (focusedNodeId.value) {
    let fCurr: string | number | null = focusedNodeId.value;
    while (fCurr && graphData[String(fCurr)]) {
      focusedPathIds.add(fCurr);
      fCurr = graphData[String(fCurr)].parentId;
    }
  }

  // --- Large Mode Layout logic (Dagre Layout) ---
  if (props.mode === 'large') {
    isLayouting = true;
    try {
      if (!lf.value) return;

      const lfNodes: any[] = [];
      const lfEdges: any[] = [];

      // 1. 准备初始节点数据
      rawNodes.forEach((n) => {
        const previewText = getPreviewText(n.text || '');
        const nodeHeight = calculateNodeHeight(previewText, n.id === activeLeafId.value);
        const childrenCount = childrenMap.get(n.id)?.length || 0;

        lfNodes.push({
          id: String(n.id),
          type: 'history-node',
          x: 0, // 初始坐标由 Dagre 覆盖
          y: 0,
          draggable: false,
          properties: {
            node: {
              ...n,
              children: [],
              depth: (n as any).depth || 0,
              childrenCount,
              isRoot: !n.parentId,
              isLeaf: childrenCount === 0
            },
            isActive: n.id === activeLeafId.value,
            isInActivePath: activePathIds.value.has(n.id),
            activeLeafId: activeLeafId.value,
            activePathIds: Array.from(activePathIds.value),
            isFocused: focusedNodeId.value === n.id,
            onBranch: handleBranchNode,
            onRollback: handleRollbackNode,
            onPreview: handlePreviewNode,
            onSwitchBranch: timeline.switchSibling,
            onFocusChange: (id: string | null) => { focusedNodeId.value = id; refreshTree(); },
            orientation: layoutOrientation.value,
            width: NODE_LAYOUT_CONFIG.WIDTH,
            height: nodeHeight,
            previewText: previewText,
            nodeHeight: nodeHeight
          }
        });

        if (n.parentId && graphData[n.parentId]) {
          const isMainChain = activePathIds.value.has(n.parentId) && activePathIds.value.has(n.id);
          const isFocusedPath = focusedPathIds.has(n.parentId) && focusedPathIds.has(n.id);
          const isHighlighted = isMainChain || isFocusedPath;

          lfEdges.push({
            id: `e-${n.parentId}-${n.id}`,
            type: 'timeline-edge',
            sourceNodeId: String(n.parentId),
            targetNodeId: String(n.id),
            properties: {
              isHighlighted
            }
          });
        }
      });

      // 2. 渲染基础图表
      console.log('Rendering base graph for layout', lfNodes, lfEdges);
      lf.value.render({
        nodes: lfNodes,
        edges: lfEdges
      });

      // 3. 调用 Dagre 布局
      const rankdir = layoutOrientation.value === 'horizontal' ? 'LR' : 'TB';
      console.log('[LuminaTimeline] Applying Dagre layout:', rankdir);
      
      // 使用 nextTick 或微任务确保渲染层已根据 properties.height 调整
      await nextTick();
      
      const dagreInstance = lf.value.extension.dagre;
      if (dagreInstance instanceof Dagre) {
        dagreInstance.layout({
          // @ts-ignore
          rankdir: rankdir,
          nodesep: 80,
          ranksep: 100,
          marginx: 100,
          marginy: 100,
          isDefaultAnchor: true // 自动根据方向对齐连线锚点
        });
      } else {
        console.warn('[LuminaTimeline] Dagre plugin instance not found or invalid type');
      }

      // 4. 重置视图/居中显示
      setTimeout(() => {
        if (!lf.value || props.mode !== 'large') return;

        if (!isFirstLargeLayoutDone.value || shouldCenterNextLayout) {
          if (activeLeafId.value) {
            lf.value.zoom(1);
            lf.value.focusOn({ id: String(activeLeafId.value) });
            console.log('[LuminaTimeline] Dagre Layout completed: Focused on', activeLeafId.value);
          } else {
            lf.value.fitView(100, 100);
            console.log('[LuminaTimeline] Dagre Layout completed: Fit view');
          }
          isFirstLargeLayoutDone.value = true;
          shouldCenterNextLayout = false;
        }
      }, 10);

    } catch (err) {
      console.error('[LuminaTimeline] Dagre layout failed:', err);
    } finally {
      isLayouting = false;
      if (pendingRefresh) {
        pendingRefresh = false;
        nextTick(() => refreshTree());
      }
    }
  }

};

const handleNodeClick = (node: TimelineViewNode) => {
  timeline.handleNodeClick(node);
  if (lf.value) {
    const nodes = lf.value.graphModel.nodes;
    nodes.forEach(n => {
      n.setProperty('isFocused', n.id === focusedNodeId.value);
    });
  }
};

watch(
  [() => props.mode, isCanvasEnabled, flattenedTree],
  ([mode, enabled], [oldMode]) => {
    if (!enabled) return;

    if (mode === 'large' && oldMode !== 'large') {
      // 容器重建，清空旧实例
      lf.value = null;
    }

    if (mode === 'large') {
      nextTick(() => {
        initLogicFlow();
        refreshTree();
      });
      return;
    }
    refreshTree();
  },
  { immediate: true }
);

// 移除多余的单 props.mode 监听器
// watch(() => props.mode, ...)

onUnmounted(() => {
  if (lf.value) {
    // 销毁旧实例并清空
    // lf.value.destroy() might not exist depending on version, but we can clear the ref
    lf.value = null;
  }
  isFirstLargeLayoutDone.value = false;
});
</script>
