import { computed, nextTick, onMounted, onUnmounted, ref, type Ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { luminaWeaveApi as lwApi } from '../../api/index';
import type { TimelineNode } from '../../api/index';
import { useTimelineStore } from '../../stores/useTimelineStore';

export interface TimelineViewNode extends TimelineNode {
  children: TimelineViewNode[];
  depth: number;
  layoutX?: number;
  layoutY?: number;
  laneIndex?: number;
  trackIndex?: number;
  isLastInTrack?: boolean;
  childrenCount?: number;
  isRoot?: boolean;
  isLeaf?: boolean;
}

interface TimelineGraphViewModelOptions {
  enabled?: Ref<boolean>;
}

const TRACK_COLORS = ['#0061e0', '#10b981', '#f59e0b', '#ec4899', '#0046b0', '#06b6d4'];

export const useTimelineGraphViewModel = (options: TimelineGraphViewModelOptions = {}) => {
  const enabled = options.enabled ?? ref(true);
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
  const laneTrackBounds = ref<Map<string, { first: number; last: number }>>(new Map());
  const lastActivePathIndex = ref(-1);
  const isSwitching = ref(false);
  const previewingNode = ref<TimelineViewNode | null>(null);
  let isRuntimeBound = false;

  const isActionNodeConnected = computed(() => {
    if (flattenedTree.value.length === 0) return false;
    const lastNode = flattenedTree.value[flattenedTree.value.length - 1];
    return activePathIds.value.has(lastNode.id);
  });

  const currentSourceLabel = computed(() => {
    return timelineSources.value.find(source => source.id === activeSourceId.value)?.label ?? '剧情演播';
  });

  const getPreviewText = (text?: string): string => {
    if (!text) return '...';
    const plain = text.replace(/<[^>]+>/g, '');
    return plain.length > 500 ? `${plain.substring(0, 500)}...` : plain;
  };

  const isNodeInActivePath = (id: string | number) => activePathIds.value.has(id);

  const isTrackOnActivePath = (trackIndex: number, rowIndex: number): boolean => {
    return trackIndex === 0 && Boolean(flattenedTree.value[rowIndex] && isNodeInActivePath(flattenedTree.value[rowIndex].id));
  };

  const getTrackColor = (trackIndex: number, rowIndex: number) => {
    return trackIndex === 0 && isTrackOnActivePath(0, rowIndex)
      ? '#0061e0'
      : TRACK_COLORS[trackIndex % TRACK_COLORS.length];
  };

  const getNodeStatusLabel = (item: TimelineViewNode) => {
    if (item.id === activeLeafId.value) return '活跃末端';
    if (activePathIds.value.has(item.id)) return item.parentId === null ? '世界起点' : '时空主轴';
    return item.children.length === 0 ? '异界终点' : '平行分支';
  };

  const isLaneActiveAt = (laneIndex: number, rowIndex: number): boolean => {
    const node = flattenedTree.value[rowIndex];
    if (!node) return false;
    if (laneIndex === 0) return rowIndex <= lastActivePathIndex.value;
    if (node.laneIndex === laneIndex) return true;

    for (const [key, bounds] of laneTrackBounds.value.entries()) {
      if (key.startsWith(`${laneIndex}_`) && rowIndex > bounds.first && rowIndex < bounds.last) return true;
    }
    return false;
  };

  const isFirstInLane = (laneIndex: number, rowIndex: number): boolean => {
    const node = flattenedTree.value[rowIndex];
    if (!node || node.laneIndex !== laneIndex) return false;
    const bounds = laneTrackBounds.value.get(`${laneIndex}_${node.trackIndex}`);
    return bounds ? bounds.first === rowIndex : false;
  };

  const isLastInLaneAt = (laneIndex: number, rowIndex: number): boolean => {
    const node = flattenedTree.value[rowIndex];
    if (!node || node.laneIndex !== laneIndex) return false;
    const bounds = laneTrackBounds.value.get(`${laneIndex}_${node.trackIndex}`);
    const isLast = bounds ? bounds.last === rowIndex : false;
    if (!isLast) return false;
    return laneIndex === 0 ? (node.childrenCount ?? 0) === 0 : true;
  };

  const getParentLane = (node: TimelineViewNode): number => {
    return flattenedTree.value.find(n => n.id === node.parentId)?.laneIndex ?? 0;
  };

  const getLaneStrokeColor = (laneIndex: number, rowIndex: number): string => {
    return laneIndex === 0 ? '#0061e0' : getTrackColor(flattenedTree.value[rowIndex]?.trackIndex ?? 1, rowIndex);
  };

  const getBranchCurve = (node: TimelineViewNode): string => {
    const targetLane = node.laneIndex ?? 0;
    const sourceLane = getParentLane(node);
    const x1 = sourceLane * 16 + 10;
    const x2 = targetLane * 16 + 10;
    return sourceLane === targetLane ? `M ${x1} 0 L ${x2} 24` : `M ${x1} 0 C ${x1} 15, ${x2} 10, ${x2} 24`;
  };

  const getNodeSiblings = (node: TimelineViewNode): string[] => {
    const graph = timelineGraph.value;
    if (!node.parentId) return Object.values(graph).filter(n => !n.parentId).map(n => n.id);
    return Object.values(graph).filter(n => n.parentId === node.parentId).map(n => n.id);
  };

  const getNodeSiblingIndex = (node: TimelineViewNode): number => getNodeSiblings(node).indexOf(node.id);

  const refreshSmallTree = async () => {
    if (!enabled.value || !isTimelineReady.value) return;
    const graphData = timelineGraph.value as Record<string, TimelineNode>;
    const rawNodes = Object.values(graphData);
    activeLeafId.value = storeActiveLeafId.value;

    const childrenMap = new Map<string, string[]>();
    rawNodes.forEach((node) => {
      if (!node.parentId) return;
      if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
      childrenMap.get(node.parentId)!.push(node.id);
    });

    const pathSet = new Set<string | number>();
    let current: string | number | null = activeLeafId.value;
    while (current && graphData[String(current)]) {
      pathSet.add(current);
      current = graphData[String(current)].parentId;
    }
    activePathIds.value = pathSet;

    const flat: TimelineViewNode[] = [];
    const viewNodeMap: Record<string, TimelineViewNode> = {};
    rawNodes.forEach((node) => {
      viewNodeMap[node.id] = { ...node, children: [], depth: 0 };
    });

    let colorSeed = 1;
    const layoutNodeSmall = (nodeId: string, depth: number, inheritedTrack: number | null | undefined) => {
      const node = viewNodeMap[nodeId];
      if (!node) return;

      const isMain = activePathIds.value.has(nodeId);
      node.laneIndex = isMain ? 0 : 1;
      node.trackIndex = isMain ? 0 : (inheritedTrack ?? colorSeed++);
      node.depth = depth;

      const children = [...(childrenMap.get(nodeId) ?? [])];
      node.childrenCount = children.length;
      node.children = children.map(childId => viewNodeMap[childId]).filter(Boolean);
      flat.push(node);

      children.sort((a, b) => (activePathIds.value.has(b) ? 1 : 0) - (activePathIds.value.has(a) ? 1 : 0));
      children.forEach((childId) => {
        layoutNodeSmall(childId, depth + 1, activePathIds.value.has(childId) ? 0 : (node.laneIndex === 0 ? null : node.trackIndex));
      });
    };

    rawNodes.filter(node => !node.parentId).forEach(root => layoutNodeSmall(root.id, 0, null));
    flattenedTree.value = flat;

    const bounds = new Map<string, { first: number; last: number }>();
    let lastActive = -1;
    flat.forEach((node, index) => {
      if (activePathIds.value.has(node.id)) lastActive = index;
      const key = `${node.laneIndex}_${node.trackIndex}`;
      const existing = bounds.get(key);
      if (existing) existing.last = index;
      else bounds.set(key, { first: index, last: index });
    });
    laneTrackBounds.value = bounds;
    lastActivePathIndex.value = lastActive;

    await nextTick();
  };

  const switchSibling = async (node: TimelineViewNode) => {
    const siblings = getNodeSiblings(node);
    if (siblings.length <= 1) return;
    const nextNodeId = siblings[(siblings.indexOf(node.id) + 1) % siblings.length];

    isSwitching.value = true;
    try {
      await timelineStore.branchFromNode(nextNodeId);
    } finally {
      isSwitching.value = false;
    }
  };

  const handleNodeClick = (node: TimelineViewNode) => {
    focusedNodeId.value = focusedNodeId.value === node.id ? null : node.id;
  };

  const handlePreviewNode = (node: TimelineViewNode) => {
    previewingNode.value = node;
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
    const message = node.role === 'user'
      ? '确定回滚并重新编辑这条输入吗？后续分支将被物理删除。'
      : '警告：物理回退将删除该节点之后的所有异界分支，此操作不可逆。确定执行吗？';
    const isConfirmed = await lwApi.services.host.confirm({
      title: '物理回滚确认',
      message,
      confirmText: '确定回退',
      danger: true
    });
    if (!isConfirmed) return;

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

  const handleNodeAction = ({ type, node }: { type: string; node: TimelineViewNode }) => {
    if (!enabled.value) return;
    if (type === 'preview') handlePreviewNode(node);
    if (type === 'branch') void handleBranchNode(node);
    if (type === 'rollback') void handleRollbackNode(node);
    if (type === 'switch') void switchSibling(node);
    if (type === 'jump') void handleJumpNode(node);
  };

  const bindRuntime = () => {
    if (isRuntimeBound || !enabled.value) return;
    isRuntimeBound = true;
    timelineStore.bind();
    lwApi.on('TIMELINE_NODE_ACTION', handleNodeAction);
  };

  const unbindRuntime = () => {
    if (!isRuntimeBound) return;
    isRuntimeBound = false;
    lwApi.off('TIMELINE_NODE_ACTION', handleNodeAction);
    timelineStore.unbind();
  };

  onMounted(() => {
    bindRuntime();
  });

  watch(enabled, (isEnabled) => {
    if (!isEnabled) {
      unbindRuntime();
      return;
    }
    bindRuntime();
    void refreshSmallTree();
  }, { immediate: true });

  watch([isTimelineReady, timelineRevision, enabled], ([ready, , isEnabled]) => {
    if (!ready || !isEnabled) return;
    void refreshSmallTree();
  }, { immediate: true });

  onUnmounted(() => {
    unbindRuntime();
  });

  return {
    timelineGraph,
    timelineStore,
    flattenedTree,
    activeLeafId,
    activePathIds,
    focusedNodeId,
    laneTrackBounds,
    lastActivePathIndex,
    isSwitching,
    previewingNode,
    isActionNodeConnected,
    currentSourceLabel,
    refreshSmallTree,
    getPreviewText,
    getTrackColor,
    isNodeInActivePath,
    isTrackOnActivePath,
    getNodeStatusLabel,
    isLaneActiveAt,
    isFirstInLane,
    isLastInLaneAt,
    getParentLane,
    getLaneStrokeColor,
    getBranchCurve,
    getNodeSiblings,
    getNodeSiblingIndex,
    switchSibling,
    handleNodeClick,
    handlePreviewNode,
    handleBranchNode,
    handleRollbackNode,
    handleJumpNode,
    handleNodeAction
  };
};
