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
import { useCardMakerStore } from './CardMakerStore.js';
import { useForgeStore } from '../../stores/useForgeStore.js';
import ForgeAuxPanelShell from './app/ForgeAuxPanelShell.vue';

const store = useCardMakerStore();
const forgeStore = useForgeStore();

const trackCards = computed(() => {
  const hasWorkspaceContent = store.virtualLorebookEntries.length > 0 || store.draftTree.nodes.length > 0;
  const hasWorkspaceWrites = forgeStore.piSessionEntries.some(entry => {
    if (entry.kind !== 'tool_result') return false;
    const payload = entry.payload as { result?: unknown };
    const result = payload.result;
    return Boolean(result && typeof result === 'object' && !Array.isArray(result)
      && (result as { workspaceWriteSummary?: unknown }).workspaceWriteSummary);
  });
  const isFinalizing = store.publishState === 'workspace_frozen' || store.workflowSnapshot?.visiblePhase === 'finalize' || store.workflowSnapshot?.visiblePhase === 'output_delivery';

  return [
    {
      id: 'async_tasks',
      title: '异步任务',
      status: hasWorkspaceWrites ? 'ready' : 'pending',
      statusLabel: hasWorkspaceWrites ? '可挂接' : '待积累',
      description: hasWorkspaceWrites
        ? '当前已经有项目文件变更记录，可以继续拆分为独立后续任务。'
        : '先让主流程产出项目 VFS 写入摘要，再决定需要挂起的异步任务。'
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
  font-size: var(--lw-type-title-small-size);
  color: var(--lw-text-main);
}

.post-track-card__status {
  border-radius: 999px;
  padding: 4px 9px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.post-track-card p {
  margin: 10px 0 0;
  font-size: var(--lw-type-body-small-size);
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
