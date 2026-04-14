<template>
  <ForgeAuxPanelShell
    title="后置轨"
    kicker="Post Tracks"
    subtitle="异步任务、世界书重组和开局包不阻塞主制卡流程，但会在这里持续提示缺口。"
  >
    <div class="post-track-list">
      <article v-for="item in trackCards" :key="item.id" class="post-track-card" :class="`status-${item.status}`">
        <div class="post-track-card__header">
          <strong>{{ item.title }}</strong>
          <span class="post-track-card__status">{{ item.statusLabel }}</span>
        </div>
        <p>{{ item.description }}</p>
      </article>
    </div>
  </ForgeAuxPanelShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardMakerStore } from './CardMakerStore';
import { useForgeStore } from '../../stores/useForgeStore';
import ForgeAuxPanelShell from './ForgeAuxPanelShell.vue';

const store = useCardMakerStore();
const forgeStore = useForgeStore();

const trackCards = computed(() => {
  const hasWorkspaceContent = store.virtualLorebookEntries.length > 0 || store.draftTree.nodes.length > 0;
  const hasReviewQueue = forgeStore.stagingArea.length > 0 || forgeStore.commitReadyEntries.length > 0;
  const isFinalizing = store.publishState === 'workspace_frozen' || store.workflowSnapshot?.visiblePhase === 'finalize' || store.workflowSnapshot?.visiblePhase === 'output_delivery';

  return [
    {
      id: 'async_tasks',
      title: '异步任务',
      status: hasReviewQueue ? 'ready' : 'pending',
      statusLabel: hasReviewQueue ? '可挂接' : '待积累',
      description: hasReviewQueue
        ? '当前已经有待审或待冻结内容，可以继续拆分为独立后续任务。'
        : '先让主流程产出 proposal 或 workspace-ready 内容，再决定需要挂起的异步任务。'
    },
    {
      id: 'worldbook_reorg',
      title: '世界书重组',
      status: hasWorkspaceContent ? 'ready' : 'pending',
      statusLabel: hasWorkspaceContent ? '可整理' : '待生成',
      description: hasWorkspaceContent
        ? '虚拟世界书和草案已经具备基础素材，可在导出前统一做目录与结构重组。'
        : '当前还没有足够的虚拟条目承载重组动作。'
    },
    {
      id: 'opening_package',
      title: '开局包',
      status: isFinalizing ? 'ready' : 'pending',
      statusLabel: isFinalizing ? '可生成' : '待收束',
      description: isFinalizing
        ? '当前已经接近输出交付阶段，可以开始整理开局演示、首回合模板和投放包。'
        : '等输出层和导出交付阶段稳定后，再整理开局包更稳。'
    }
  ];
});
</script>

<style scoped>
.post-track-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.post-track-card {
  padding: 16px;
  border-radius: 22px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.post-track-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.post-track-card__header strong {
  font-size: 14px;
  color: var(--lw-text-main);
}

.post-track-card__status {
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.post-track-card p {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.post-track-card.status-ready .post-track-card__status {
  background: rgba(var(--lw-primary-rgb), 0.14);
  color: var(--lw-primary);
}

.post-track-card.status-pending .post-track-card__status {
  background: color-mix(in srgb, var(--lw-bg-subtle) 82%, white);
  color: var(--lw-text-muted);
}
</style>
