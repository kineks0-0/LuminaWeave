<template>
  <div class="lw-timeline-container" :class="mode">

    <!-- Large Mode Background Area (Managed by LogicFlow) -->
    <div v-if="mode === 'large'" class="large-viewport-container"></div>
    <TeleportContainer v-if="mode === 'large'" :flow-id="flowId" />

    <!-- Small Mode: Vertical Timeline -->
    <div v-if="mode === 'small'" class="small-timeline-wrapper">
      <div class="timeline-context-pill compact">
        <span>{{ currentSourceLabel }}</span>
      </div>

      <div class="timeline-tree small" ref="timelineTreeRef">
        <div class="s-node" v-for="(item, index) in flattenedTree" :key="item.id">
          <!-- Multi-Track Graph Column (Modified to 2-lane layout) -->
          <div class="s-graph-track" :style="{ width: '40px' }">
            <svg class="track-svg" width="40" height="100%">
              <!-- Lane Index based positioning: Lane 0 at 10px, Lane 1 at 26px -->
              <template v-for="lane in 2" :key="'lane-line-' + lane">
                <line v-if="isLaneActiveAt(lane - 1, index) && !isFirstInLane(lane - 1, index)"
                  :x1="(lane - 1) * 16 + 10" y1="0" :x2="(lane - 1) * 16 + 10" y2="24"
                  :stroke="getLaneStrokeColor(lane - 1, index)" :stroke-width="lane - 1 === 0 ? 3 : 2"
                  :opacity="lane - 1 === 0 ? 1 : 0.4" />
                <line v-if="isLaneActiveAt(lane - 1, index) && !isLastInLaneAt(lane - 1, index)"
                  :x1="(lane - 1) * 16 + 10" y1="24" :x2="(lane - 1) * 16 + 10" y2="100%"
                  :stroke="getLaneStrokeColor(lane - 1, index)" :stroke-width="lane - 1 === 0 ? 3 : 2"
                  :opacity="lane - 1 === 0 ? 1 : 0.4" />
              </template>

              <!-- Branching curves -->
              <path v-if="item.parentId && getParentLane(item) !== item.laneIndex" :d="getBranchCurve(item)" fill="none"
                :stroke="getTrackColor(item.trackIndex || 0, index)" stroke-width="2" opacity="0.6" />

              <!-- Current Node Dot -->
              <circle :cx="(item.laneIndex || 0) * 16 + 10" cy="24" r="5"
                :fill="getTrackColor(item.trackIndex || 0, index)" :class="{ 'glow-dot': item.id === activeLeafId }" />
            </svg>
          </div>

          <div class="s-card-wrapper">
            <div class="s-card" :class="{ active: item.id === activeLeafId, inactive: !isNodeInActivePath(item.id) }"
              @click="handleNodeClick(item)">
              <div class="s-card-header">
                <span class="s-title">#{{ String(item.depth + 1).padStart(3, '0') }} {{ getNodeStatusLabel(item)
                }}</span>
                <span class="s-role-tag" :class="item.role">{{ item.role === 'user' ? 'ME' : 'AI' }}</span>
              </div>
              <div class="s-card-content">
                <div class="s-avatar-mini" v-if="item.role !== 'user'">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <p class="s-text">{{ getPreviewText(item.text) }}</p>
              </div>
              <div class="s-variant-info">
                <span class="s-variant-text" v-if="getNodeSiblings(item).length > 1">
                  分支 {{ getNodeSiblingIndex(item) + 1 }} / {{ getNodeSiblings(item).length }}
                  <span class="s-switch-btn" @click.stop="switchSibling(item)">切换分支</span>
                </span>
                <span class="s-variant-text" v-else-if="item.id === activeLeafId">当前为活跃末端</span>
              </div>
            </div>

            <!-- Slide-out Actions -->
            <transition name="slide-down">
              <div v-if="focusedNodeId === item.id" class="s-actions-group">
                <div class="s-action-btn grey" @click.stop="handlePreviewNode(item)">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span>预览</span>
                </div>
                <div class="s-action-btn branch" @click.stop="handleBranchNode(item)">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="19" x2="12" y2="12"></line>
                    <line x1="12" y1="12" x2="19" y2="5"></line>
                    <line x1="12" y1="12" x2="5" y2="5"></line>
                    <polyline points="15 5 19 5 19 9"></polyline>
                    <polyline points="9 5 5 5 5 9"></polyline>
                  </svg>
                  <span>{{ item.role === 'user' ? '重编辑分支' : '从此处分支' }}</span>
                </div>
                <div class="s-action-btn rollback" @click.stop="handleRollbackNode(item)">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>{{ item.role === 'user' ? '重编辑并回滚' : '物理回退' }}</span>
                </div>
              </div>
            </transition>
          </div>
        </div>

        <!-- Add Button -->
        <div class="s-node action-node" v-if="flattenedTree.length > 0">
          <div class="s-graph-track" :style="{ width: '40px' }">
            <svg class="track-svg" width="40" height="100%">
              <!-- Line from top to dot -->
              <line v-if="isActionNodeConnected" x1="10" y1="0" x2="10" y2="20" stroke="var(--lw-primary)"
                stroke-width="3" />
              <circle cx="10" cy="20" r="4" :fill="isActionNodeConnected ? 'var(--lw-primary)' : '#cbd5e1'" />
            </svg>
          </div>
          <div class="s-card-wrapper">
            <div class="s-action-card">
              <span class="plus-icon"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                  stroke-width="2" fill="none">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg></span>
              <span>继续对话</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Large Mode: Floating Nodes Matrix -->
    <div v-if="mode === 'large'" class="large-timeline-wrapper" style="width: 100%; height: 100%;">
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
    </div>
    <!-- Global Switching Overlay -->
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

    <!-- Rollback Confirmation Modal -->
    <ConfirmationModal :isOpen="!!nodeToRollback" title="物理回滚确认" :message="rollbackConfirmMessage"
      @confirm="handleConfirmRollback" @cancel="nodeToRollback = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, markRaw, watch, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { luminaWeaveApi as lwApi, TimelineNode } from '../../api/index';
import LogicFlow, { HtmlNodeModel, PolylineEdgeModel } from '@logicflow/core';
//import { Menu } from '@logicflow/extension';
import { register, getTeleport } from '@logicflow/vue-node-registry';
import { VueNodeModel } from '@logicflow/vue-node-registry';
import { PolylineEdge } from '@logicflow/core';
import '@logicflow/core/dist/index.css';
import '@logicflow/extension/lib/style/index.css';

import { Dagre } from '@logicflow/layout';
import HistoryNode from './HistoryNode.vue';
import NodePreviewModal from './NodePreviewModal.vue';
import ConfirmationModal from './ConfirmationModal.vue';
import gsap from 'gsap';
import { useTimelineStore } from '../../stores/useTimelineStore';

export interface TimelineViewNode extends TimelineNode {
  children: TimelineViewNode[];
  depth: number;
  layoutX?: number;
  layoutY?: number;
  laneIndex?: number; // 0: 主线, 1: 分支
  trackIndex?: number; // 颜色索引，保持逻辑一致
  isLastInTrack?: boolean;
  childrenCount?: number;
  isRoot?: boolean;
  isLeaf?: boolean;
}

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
      style.stroke = '#3b82f6';
      style.strokeWidth = 3;
      style.opacity = 1;
    } else {
      style.stroke = '#cbd5e1';
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

// 内部判定移动端，增加对 navigator 的 fallback 以增强稳健性
const isMobileDevice = computed(() => {
  return props.isMobile || (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
});

const lf = ref<LogicFlow | null>(null);
const lfContainerRef = ref<HTMLElement | null>(null);
const timelineStore = useTimelineStore();
const {
  graph: timelineGraph,
  activeLeafId: storeActiveLeafId,
  isReady: isTimelineReady,
  revision: timelineRevision,
  activeSourceId,
  sources: timelineSources
} = storeToRefs(timelineStore);

const flattenedTree = ref<TimelineViewNode[]>([]);
const activeLeafId = ref<string | null>(null);
const activePathIds = ref<Set<string | number>>(new Set());
const focusedNodeId = ref<string | null>(null);
const timelineTreeRef = ref<HTMLElement | null>(null);
const maxTrackIndex = ref(0);
const layoutOrientation = ref<'horizontal' | 'vertical'>('horizontal');
const wheelMode = ref<'zoom' | 'scroll'>('zoom');
const isFirstLargeLayoutDone = ref(false); // 优化：仅在首次进入大窗口或重载时强制缩放

// Cache for O(1) lane queries
const laneTrackBounds = ref<Map<string, { first: number, last: number }>>(new Map());
const lastActivePathIndex = ref(-1);

const TeleportContainer = getTeleport();
const flowId = ref('');

const isActionNodeConnected = computed(() => {
  if (flattenedTree.value.length === 0) return false;
  const lastNode = flattenedTree.value[flattenedTree.value.length - 1];
  // 只有当最后一个展示的节点属于活跃路径时，继续对话按钮才与之相连
  return activePathIds.value.has(lastNode.id);
});

const currentSourceLabel = computed(() => {
  return timelineSources.value.find(source => source.id === activeSourceId.value)?.label ?? '剧情演播';
});

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
      backgroundColor: '#fcfcfd', // 统一底色
    },
    grid: {
      size: 40, // 稀疏点阵间距，与设计稿同步
      visible: true,
      type: 'dot',
      config: {
        color: '#cbd5e1', // 点颜色
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
      stroke: '#cbd5e1',
      strokeWidth: 2,
      radius: 12, // 圆角半径
    },
    // 保留 bezier 以防 small mode 或其他地方用到，虽然 large mode 主力用 polyline
    bezier: {
      stroke: '#cbd5e1',
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

const getPreviewText = (text?: string): string => {
  if (!text) return '...';
  let plain = text.replace(/<[^>]+>/g, '');
  return plain.length > 500 ? plain.substring(0, 500) + '...' : plain;
};

// --- Git Color System ---
const TRACK_COLORS = [
  '#0061e0', // Blue (Main)
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#0046b0', // Deep Blue
  '#06b6d4', // Cyan
];

const getTrackColor = (trackIndex: number, rowIndex: number) => {
  if (trackIndex === 0 && isTrackOnActivePath(0, rowIndex)) return '#0061e0';
  return TRACK_COLORS[trackIndex % TRACK_COLORS.length];
};

const isNodeInActivePath = (id: string | number) => activePathIds.value.has(id);

const isTrackOnActivePath = (trackIndex: number, rowIndex: number): boolean => {
  if (trackIndex !== 0) return false;
  const node = flattenedTree.value[rowIndex];
  return node && isNodeInActivePath(node.id);
};

const getNodeStatusLabel = (item: TimelineViewNode) => {
  if (item.id === activeLeafId.value) return '活跃末端';
  if (activePathIds.value.has(item.id)) return (item.parentId === null) ? '世界起点' : '时空主轴';
  return item.children.length === 0 ? '异界终点' : '平行分支';
};

const isLaneActiveAt = (laneIndex: number, rowIndex: number): boolean => {
  const node = flattenedTree.value[rowIndex];
  if (!node) return false;

  if (laneIndex === 0) {
    // 主轴（车道0）：仅在当前行或其下方仍有属于活跃路径的节点时显示
    return rowIndex <= lastActivePathIndex.value;
  }

  // 分支车道：检查当前节点所在的链是否在该车道上经过
  if (node.laneIndex === laneIndex) return true;

  // 检查是否有任何属于该 laneIndex 的 track 跨越了当前行
  for (const [key, bounds] of laneTrackBounds.value.entries()) {
    if (key.startsWith(`${laneIndex}_`)) {
      if (rowIndex > bounds.first && rowIndex < bounds.last) {
        return true;
      }
    }
  }

  return false;
};

const isFirstInLane = (laneIndex: number, rowIndex: number): boolean => {
  const node = flattenedTree.value[rowIndex];
  if (node.laneIndex !== laneIndex) return false;

  const key = `${laneIndex}_${node.trackIndex}`;
  const bounds = laneTrackBounds.value.get(key);
  return bounds ? bounds.first === rowIndex : false;
};

const isLastInLaneAt = (laneIndex: number, rowIndex: number): boolean => {
  const node = flattenedTree.value[rowIndex];
  if (node.laneIndex !== laneIndex) return false;

  const key = `${laneIndex}_${node.trackIndex}`;
  const bounds = laneTrackBounds.value.get(key);
  const isLast = bounds ? bounds.last === rowIndex : false;

  if (!isLast) return false;

  // 特殊：如果是主线节点，且它有任何孩子（包括开启分支的孩子），
  // 则不视为物理末端，因为它需要向下延伸一段短线以便连接分叉曲线
  if (laneIndex === 0) {
    const hasChildren = (node as any).childrenCount > 0;
    return !hasChildren;
  }

  return true;
};

const getParentLane = (node: TimelineViewNode): number => {
  const parent = flattenedTree.value.find(n => n.id === node.parentId);
  return parent ? (parent.laneIndex || 0) : 0;
};

const getLaneStrokeColor = (laneIndex: number, rowIndex: number): string => {
  if (laneIndex === 0) return '#0061e0';
  const node = flattenedTree.value[rowIndex];
  return getTrackColor(node.trackIndex || 1, rowIndex);
};

const getBranchCurve = (node: TimelineViewNode): string => {
  const targetLane = node.laneIndex || 0;
  const sourceLane = getParentLane(node);
  const x1 = sourceLane * 16 + 10;
  const x2 = targetLane * 16 + 10;
  if (sourceLane === targetLane) return `M ${x1} 0 L ${x2} 24`;
  return `M ${x1} 0 C ${x1} 15, ${x2} 10, ${x2} 24`;
};

const getNodeSiblings = (node: TimelineViewNode): string[] => {
  const graph = timelineGraph.value;
  if (!node.parentId) {
    return Object.values(graph).filter(n => !n.parentId).map(n => n.id);
  }
  return Object.values(graph).filter(n => n.parentId === node.parentId).map(n => n.id);
};

const getNodeSiblingIndex = (node: TimelineViewNode): number => {
  const siblings = getNodeSiblings(node);
  return siblings.indexOf(node.id);
};

const switchSibling = async (node: TimelineViewNode) => {
  const siblings = getNodeSiblings(node);
  if (siblings.length <= 1) return;
  const currIdx = siblings.indexOf(node.id);
  const nextIdx = (currIdx + 1) % siblings.length;
  const nextNodeId = siblings[nextIdx];

  isSwitching.value = true;
  try {
    await timelineStore.branchFromNode(nextNodeId);
  } finally {
    isSwitching.value = false;
  }
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
  if (!isTimelineReady.value) return;

  if (props.mode === 'large' && isLayouting) {
    pendingRefresh = true;
    return;
  }

  const graphData = timelineGraph.value as Record<string, TimelineNode>;
  const rawNodes = Object.values(graphData);
  activeLeafId.value = storeActiveLeafId.value;

  console.log('[LuminaTimeline] refreshTree mode:', props.mode, 'rawNodes:', rawNodes.length, 'activeLeafId:', activeLeafId.value);

  // 1. 构建索引
  const childrenMap = new Map<string, string[]>();
  rawNodes.forEach((n: TimelineNode) => {
    if (n.parentId) {
      if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
      childrenMap.get(n.parentId)!.push(n.id);
    }
  });

  // 2. 识别活跃路径
  const pathSet = new Set<string | number>();
  let curr: string | number | null = activeLeafId.value;
  while (curr && graphData[String(curr)]) {
    pathSet.add(curr);
    curr = graphData[String(curr)].parentId;
  }
  activePathIds.value = pathSet;

  // 3. 识别选中路径 (Focused Path)
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
            onSwitchBranch: handleSwitchBranch,
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

  // --- Small Mode Layout logic ---
  const flat: TimelineViewNode[] = [];
  const trackOccupiedUntil = new Map<number, number>();
  const map: Record<string, TimelineViewNode> = {};
  rawNodes.forEach(n => map[n.id] = { ...n, children: [], depth: 0 });

  const findAvailableTrack = (startRow: number): number => {
    let t = 0;
    while (trackOccupiedUntil.has(t) && trackOccupiedUntil.get(t)! >= startRow) t++;
    return t;
  };

  const roots = rawNodes.filter(n => !n.parentId);
  let colorSeed = 1; // 0 指给主线

  const layoutNodeSmall = (nodeId: string, depth: number, inheritedTrack: number | null | undefined) => {
    const node = map[nodeId];
    if (!node) return;

    const isMain = activePathIds.value.has(nodeId);
    node.laneIndex = isMain ? 0 : 1;

    if (isMain) {
      node.trackIndex = 0;
    } else {
      node.trackIndex = (inheritedTrack !== null && inheritedTrack !== undefined)
        ? inheritedTrack
        : colorSeed++;
    }

    node.depth = depth;
    const children = childrenMap.get(nodeId) || [];
    node.childrenCount = children.length;
    flat.push(node);

    // 优先处理活跃路径上的孩子
    children.sort((a, b) => (activePathIds.value.has(b) ? 1 : 0) - (activePathIds.value.has(a) ? 1 : 0));

    children.forEach((childId) => {
      const isMainChild = activePathIds.value.has(childId);
      // 如果是主线孩子，继承 trackIndex=0，否则如果是新分支开启，则不继承（触发新颜色）
      layoutNodeSmall(childId, depth + 1, isMainChild ? 0 : (node.laneIndex === 0 ? null : node.trackIndex));
    });
  };

  roots.forEach(r => layoutNodeSmall(r.id, 0, null));

  maxTrackIndex.value = 1;
  flattenedTree.value = flat;

  // Build cache for O(1) lane queries
  const bounds = new Map<string, { first: number, last: number }>();
  let lastActive = -1;

  flat.forEach((node, idx) => {
    if (activePathIds.value.has(node.id)) {
      lastActive = idx;
    }
    const key = `${node.laneIndex}_${node.trackIndex}`;
    if (!bounds.has(key)) {
      bounds.set(key, { first: idx, last: idx });
    } else {
      bounds.get(key)!.last = idx;
    }
  });

  laneTrackBounds.value = bounds;
  lastActivePathIndex.value = lastActive;

  nextTick(() => {
    if (timelineTreeRef.value && props.mode === 'small') {
      const activeEl = timelineTreeRef.value.querySelector('.s-node .active');
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
};

const handleNodeClick = async (node: TimelineViewNode) => {
  if (focusedNodeId.value === node.id) {
    focusedNodeId.value = null;
  } else {
    focusedNodeId.value = node.id;
  }
  if (lf.value) {
    const nodes = lf.value.graphModel.nodes;
    nodes.forEach(n => {
      n.setProperty('isFocused', n.id === focusedNodeId.value);
    });
  }
};

const isSwitching = ref(false);
const previewingNode = ref<TimelineViewNode | null>(null);
const nodeToRollback = ref<TimelineViewNode | null>(null);

const rollbackConfirmMessage = computed(() => {
  if (!nodeToRollback.value) return '';
  return nodeToRollback.value.role === 'user'
    ? '确定回滚并重新编辑这条输入吗？后续分支将被物理删除。'
    : '警告：物理回退将删除该节点之后的所有异界分支，此操作不可逆。确定执行吗？';
});

const handlePreviewNode = (node: TimelineViewNode) => {
  previewingNode.value = node;
};

const handleSwitchBranch = async (node: TimelineViewNode) => {
  await switchSibling(node);
};

const renderMarkdown = (text: string) => {
  if (!text) return '';
  const lines = text.split('\n');
  const htmlLines = lines.map(line => {
    if (!line.trim()) return '<div class="empty-line" style="height: 1em;"></div>';
    let parsed = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^\*]+)\*/g, '<em style="color:var(--lw-primary);">$1</em>')
      .replace(/"([^"]+)"/g, '<span style="color: var(--lw-primary);">"$1"</span>')
      .replace(/“([^“]+)”/g, '<span style="color: var(--lw-primary);">"$1"</span>');
    return `<p style="margin-bottom: 1em; line-height: 1.6;">${parsed}</p>`;
  });
  return htmlLines.join('');
};

const handleBranchNode = async (node: TimelineViewNode) => {
  isSwitching.value = true;
  previewingNode.value = null;
  try {
    if (node.role === 'user') {
      const targetId = node.parentId || node.id;
      await timelineStore.branchFromNode(String(targetId));
      lwApi.emit('FOCUS_MAIN_INPUT', { text: node.text });
    } else {
      await timelineStore.branchFromNode(node.id);
      lwApi.emit('FOCUS_MAIN_INPUT', {});
    }
  } finally {
    isSwitching.value = false;
    focusedNodeId.value = null;
  }
};

const handleRollbackNode = async (node: TimelineViewNode) => {
  nodeToRollback.value = node;
};

const handleConfirmRollback = async () => {
  if (!nodeToRollback.value) return;
  const node = nodeToRollback.value;
  nodeToRollback.value = null;

  isSwitching.value = true;
  try {
    if (node.role === 'user') {
      const targetId = node.parentId || node.id;
      await timelineStore.rollbackFromNode(String(targetId));
      lwApi.emit('FOCUS_MAIN_INPUT', { text: node.text });
    } else {
      await timelineStore.rollbackFromNode(node.id);
    }
  } finally {
    isSwitching.value = false;
    focusedNodeId.value = null;
  }
};


const handleJumpNode = async (node: TimelineViewNode) => {
  isSwitching.value = true;
  try {
    await timelineStore.switchToNode(node.id);
  } finally {
    isSwitching.value = false;
    focusedNodeId.value = null;
  }
};

const handleNodeAction = ({ type, node }: { type: string, node: TimelineViewNode }) => {
  console.log(`[LuminaTimeline] Received node action: ${type}`, node);
  switch (type) {
    case 'preview':
      handlePreviewNode(node);
      break;
    case 'branch':
      handleBranchNode(node);
      break;
    case 'rollback':
      handleRollbackNode(node);
      break;
    case 'switch':
      handleSwitchBranch(node);
      break;
    case 'jump':
      handleJumpNode(node);
      break;
  }
};

onMounted(() => {
  timelineStore.bind();
  lwApi.on('TIMELINE_NODE_ACTION', handleNodeAction);
});

watch(
  [() => props.mode, isTimelineReady, timelineRevision],
  ([mode, ready], [oldMode]) => {
    if (!ready) return;

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
  lwApi.off('TIMELINE_NODE_ACTION', handleNodeAction);
  timelineStore.unbind();
});
</script>

<style scoped>
/* 样式保持不变 */
.lw-timeline-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    linear-gradient(180deg, rgba(var(--lw-bg-elevated-rgb), 0.42), rgba(var(--lw-bg-elevated-rgb), 0));
  position: relative;
  font-family: inherit;
  overflow: hidden;
}

.lw-timeline-container.large {
  background: var(--lw-bg-app);
}

/* 页眉工具栏 - 极简 Modern Geek */
.large-header {
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent);
  backdrop-filter: var(--lw-glass-blur);
  border-bottom: 1px solid var(--lw-border-base);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 800;
  color: var(--lw-text-main);
  letter-spacing: -0.01em;
}

.header-source-pill {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-secondary);
  background: var(--lw-bg-subtle);
  padding: 4px 8px;
  border-radius: 999px;
}

.timeline-context-pill {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 7px 10px;
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.timeline-context-pill.compact {
  margin-bottom: 16px;
}

.timeline-source-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-source-switcher.compact {
  padding: 0 0 16px;
  overflow-x: auto;
}

.source-chip {
  border: 1px solid var(--lw-border-base);
  background: rgba(255, 255, 255, 0.78);
  color: var(--lw-text-dim);
  border-radius: 999px;
  padding: 7px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--lw-transition);
  white-space: nowrap;
}

.source-chip strong {
  font-size: 11px;
  color: inherit;
  opacity: 0.78;
}

.source-chip.active {
  background: var(--lw-black);
  border-color: var(--lw-black);
  color: var(--lw-text-inverse);
  box-shadow: var(--lw-shadow);
}

.source-chip:hover {
  transform: translateY(-1px);
  border-color: var(--lw-border-hover);
  color: var(--lw-text-main);
}

.source-chip.active:hover {
  color: #fff;
}

.header-tools {
  display: flex;
  gap: 6px;
  padding-left: 20px;
  border-left: 1px solid var(--lw-border-base);
}

.tool-btn {
  padding: 6px;
  min-width: 32px;
  height: 32px;
}

.active-pulse {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-success);
  background: color-mix(in srgb, var(--lw-success) 12%, white);
  padding: 4px 10px;
  border-radius: 20px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background: var(--lw-success);
  border-radius: 50%;
  box-shadow: 0 0 0 6px rgba(19, 137, 92, 0.08);
  animation: pulse-ring 2s infinite;
}

@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 1;
  }

  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

.canvas-controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  padding: 8px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent);
  backdrop-filter: var(--lw-glass-blur);
  border: 1px solid var(--lw-border-base);
  border-radius: 20px;
  box-shadow: var(--lw-shadow-hover);
  z-index: 100;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}

.control-group:not(:last-child) {
  border-right: 1px solid var(--lw-border-base);
  padding-right: 10px;
}

.run-btn {
  background: var(--lw-primary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  transition: 0.2s;
}

.run-btn:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}

.lw-timeline-container.small {
  background: transparent;
}

.small-timeline-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px;
  padding-bottom: 0;
}

/* Small Mode Styles */
.timeline-tree {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  scrollbar-width: thin;
}

.s-node {
  display: flex;
  position: relative;
  /* margin-bottom: 12px; */
}

.s-graph-track {
  position: relative;
  flex-shrink: 0;
}

.track-svg {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.glow-dot {
  filter: drop-shadow(0 0 1px currentColor);
  stroke: #fff;
  stroke-width: 2px;
}

.s-card-wrapper {
  flex: 1;
  padding-left: 12px;
  padding-bottom: 18px;
  /* 减小底部填充，因为现在主要靠 s-node 的 margin-bottom 控制间距 */
  position: relative;
}

.s-card {
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius);
  padding: 12px 16px;
  cursor: pointer;
  transition: var(--lw-transition);
  position: relative;
  overflow: hidden;
}

.s-card.active {
  border-color: var(--lw-border-active);
  box-shadow: var(--lw-shadow-hover);
}

.s-card.inactive {
  opacity: 0.6;
  filter: grayscale(0.5);
}

.s-card:hover {
  transform: translateY(-2px);
  border-color: var(--lw-border-hover);
}

.s-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.s-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-dim);
  font-family: var(--lw-font-mono, monospace);
}

.s-role-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.s-role-tag.user {
  background: color-mix(in srgb, var(--lw-success) 12%, white);
  color: var(--lw-success);
}

.s-role-tag.char {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
}

.s-card-content {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.s-avatar-mini {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--lw-bg-app);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-text-dim);
  flex-shrink: 0;
  margin-top: 2px;
}

.s-text {
  font-size: 13px;
  color: #334155;
  line-height: 1.6;
  /* 增加行高 */
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.s-variant-info {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #f1f5f9;
}

.s-variant-text {
  font-size: 10px;
  color: #94a3b8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.s-switch-btn {
  color: var(--lw-primary);
  font-weight: 700;
  cursor: pointer;
}

.s-switch-btn:hover {
  text-decoration: underline;
}

.s-actions-group {
  position: relative;
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-primary);
  border-top: none;
  border-radius: 0 0 var(--lw-radius) var(--lw-radius);
  display: flex;
  padding: 8px;
  gap: 8px;
  z-index: 10;
  box-shadow: var(--lw-shadow-hover);
  margin-top: -12px;
  padding-top: 18px;
  width: auto;
}

.s-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: 0.2s;
}

.s-action-btn.branch {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
}

.s-action-btn.rollback {
  background: color-mix(in srgb, var(--lw-danger) 10%, white);
  color: var(--lw-danger);
}

.s-action-btn.grey {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
}

.s-action-btn:hover {
  filter: brightness(0.95);
}

.s-action-card {
  border: 2px dashed var(--lw-border-base);
  border-radius: var(--lw-radius);
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--lw-text-dim);
  font-size: 13px;
  font-weight: 600;
}

/* Animations */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* --- Global Loading Overlay --- */
.global-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(8px) saturate(180%);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: float 3s ease-in-out infinite;
}

.spinner-container {
  position: relative;
  width: 60px;
  height: 60px;
  margin-bottom: 24px;
}

.spinner {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 4px solid #f1f5f9;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-ring {
  position: absolute;
  top: -8px;
  left: -8px;
  right: -8px;
  bottom: -8px;
  border: 2px solid rgba(59, 130, 246, 0.1);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.loading-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--lw-text-main);
  margin: 0 0 8px 0;
  letter-spacing: 0.5px;
}

.loading-desc {
  font-size: 13px;
  color: var(--lw-text-secondary);
  margin: 0;
  font-weight: 500;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }

  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

/* --- Message Detail Modal --- */
.l-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(4px);
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.l-modal-container {
  width: 100%;
  max-width: 800px;
  max-height: 80vh;
  background: var(--lw-bg-elevated);
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.l-modal-header {
  padding: 20px 28px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.l-modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.l-modal-badge {
  background: #f1f5f9;
  color: #475569;
  font-size: 10px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.l-modal-id {
  font-family: monospace;
  font-size: 12px;
  color: #94a3b8;
}

.l-modal-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition: 0.2s;
}

.l-modal-close:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.l-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px;
  background: #fafafa;
}

.l-modal-content-wrapper {
  max-width: 680px;
  margin: 0 auto;
  font-size: 16px;
  line-height: 1.8;
  color: #334155;
}

.l-modal-footer {
  padding: 20px 40px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
}

.l-footer-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
}

.l-footer-meta .divider {
  opacity: 0.3;
}

.l-modal-action-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: 0.2s;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.l-modal-action-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}
</style>
