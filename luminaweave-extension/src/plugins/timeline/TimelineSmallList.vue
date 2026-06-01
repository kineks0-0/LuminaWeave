<template>
  <div class="lw-timeline-container" :class="mode" :data-skin-variant="timelineVariant || 'default'" :style="timelineSkinStyle">
    <div class="small-timeline-wrapper">
      <div class="timeline-context-pill compact">
        <span>{{ currentSourceLabel }}</span>
      </div>

      <div class="timeline-tree small" ref="timelineTreeRef">
        <div class="s-node" v-for="(item, index) in flattenedTree" :key="item.id">
          <div class="s-graph-track" :style="{ width: '40px' }">
            <svg class="track-svg" width="40" height="100%">
              <template v-for="lane in 2" :key="'lane-line-' + lane">
                <line v-if="isLaneActiveAt(lane - 1, index) && !isFirstInLane(lane - 1, index)" :x1="(lane - 1) * 16 + 10" y1="0" :x2="(lane - 1) * 16 + 10" y2="24" :stroke="getLaneStrokeColor(lane - 1, index)" :stroke-width="lane - 1 === 0 ? 3 : 2" :opacity="lane - 1 === 0 ? 1 : 0.4" />
                <line v-if="isLaneActiveAt(lane - 1, index) && !isLastInLaneAt(lane - 1, index)" :x1="(lane - 1) * 16 + 10" y1="24" :x2="(lane - 1) * 16 + 10" y2="100%" :stroke="getLaneStrokeColor(lane - 1, index)" :stroke-width="lane - 1 === 0 ? 3 : 2" :opacity="lane - 1 === 0 ? 1 : 0.4" />
              </template>

              <path v-if="item.parentId && getParentLane(item) !== item.laneIndex" :d="getBranchCurve(item)" fill="none" :stroke="getTrackColor(item.trackIndex || 0, index)" stroke-width="2" opacity="0.6" />
              <circle :cx="(item.laneIndex || 0) * 16 + 10" cy="24" r="5" :fill="getTrackColor(item.trackIndex || 0, index)" :class="{ 'glow-dot': item.id === activeLeafId }" />
            </svg>
          </div>

          <div class="s-card-wrapper">
            <div class="s-card" :class="{ active: item.id === activeLeafId, inactive: !isNodeInActivePath(item.id) }" @click="handleNodeClick(item)">
              <div class="s-card-header">
                <span class="s-title">#{{ String(item.depth + 1).padStart(3, '0') }} {{ getNodeStatusLabel(item) }}</span>
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

        <div class="s-node action-node" v-if="flattenedTree.length > 0">
          <div class="s-graph-track" :style="{ width: '40px' }">
            <svg class="track-svg" width="40" height="100%">
              <line v-if="isActionNodeConnected" x1="10" y1="0" x2="10" y2="20" stroke="var(--lw-primary)" stroke-width="3" />
              <circle cx="10" cy="20" r="4" :fill="isActionNodeConnected ? 'var(--lw-primary)' : 'var(--lw-timeline-line-color, var(--lw-border-strong))'" />
            </svg>
          </div>
          <div class="s-card-wrapper">
            <div class="s-action-card">
              <span class="plus-icon"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg></span>
              <span>继续对话</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <transition name="fade">
      <div v-if="isSwitching" class="global-loading-overlay">
        <div class="loading-content">
          <div class="spinner-container"><div class="spinner"></div><div class="spinner-ring"></div></div>
          <h3 class="loading-title">正在跳转时空分叉...</h3>
          <p class="loading-desc">正在重塑世界线一致性，请稍候</p>
        </div>
      </div>
    </transition>

    <NodePreviewModal v-if="previewingNode" :node="previewingNode" @close="previewingNode = null" @branch="handleBranchNode" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import NodePreviewModal from './NodePreviewModal.vue';
import { useTimelineGraphViewModel } from './useTimelineGraphViewModel.js';

const props = defineProps<{
  mode?: 'small' | 'large';
}>();

const { cssVars: timelineSkinVars, variant: timelineVariant } = useSurfaceSkin('timeline.root');
const timelineSkinStyle = computed(() => timelineSkinVars.value);
const mode = computed(() => props.mode ?? 'small');
const timelineTreeRef = ref<HTMLElement | null>(null);

const timeline = useTimelineGraphViewModel();
const {
  flattenedTree,
  activeLeafId,
  focusedNodeId,
  isActionNodeConnected,
  isSwitching,
  previewingNode,
  currentSourceLabel,
  getPreviewText,
  getTrackColor,
  isNodeInActivePath,
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
  handleRollbackNode
} = timeline;

watch(flattenedTree, async () => {
  await nextTick();
  timelineTreeRef.value?.querySelector('.s-node .active')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
</script>
