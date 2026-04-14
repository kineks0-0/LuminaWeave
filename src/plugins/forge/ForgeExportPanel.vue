<template>
  <ForgeAuxPanelShell
    title="导出发布"
    kicker="Export Delivery"
    :subtitle="publishSubtitle"
  >
    <template #actions>
      <button class="action-btn" type="button" :disabled="freezeDisabled" @click="handleFreeze">
        {{ store.isCommitting ? '冻结中…' : '冻结到虚拟工作区' }}
      </button>
      <button class="action-btn ghost" type="button" :disabled="publishDisabled" @click="handlePublish">
        推送到导出流程
      </button>
    </template>

    <div class="export-grid">
      <article class="export-card">
        <span class="export-card__label">工作区状态</span>
        <strong>{{ store.publishState === 'workspace_frozen' ? '已冻结' : '草稿中' }}</strong>
        <p>{{ store.publishState === 'workspace_frozen' ? '当前虚拟工作区已具备导出前状态。' : '先通过审阅中心把条目推进到写回准备，再冻结。' }}</p>
      </article>

      <article class="export-card">
        <span class="export-card__label">虚拟条目</span>
        <strong>{{ store.virtualLorebookEntries.length }}</strong>
        <p>冻结后的条目会进入 Forge 虚拟世界书，供后续导出和整理。</p>
      </article>

      <article class="export-card">
        <span class="export-card__label">导出来源</span>
        <strong>{{ store.importedLorebookId ? '已绑定' : '未绑定' }}</strong>
        <p>{{ store.importedLorebookId ? `当前来源：${store.importedLorebookId}` : '如需追溯真实世界书来源，可先导入一本世界书作为参考。' }}</p>
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

const freezeDisabled = computed(() => store.isCommitting || forgeStore.commitReadyEntries.length === 0);
const publishDisabled = computed(() => store.isCommitting || store.virtualLorebookEntries.length === 0);
const publishSubtitle = computed(() =>
  `写回准备 ${forgeStore.commitReadyEntries.length} 条，虚拟世界书 ${store.virtualLorebookEntries.length} 条。`
);

const handleFreeze = async () => {
  await store.freezeCommitReadyEntriesToWorkspace();
};

const handlePublish = async () => {
  await store.commitReadyEntriesToLorebook();
};
</script>

<style scoped>
.export-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.export-card {
  padding: 16px;
  border-radius: 22px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.export-card__label {
  display: block;
  margin-bottom: 10px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lw-primary);
}

.export-card strong {
  display: block;
  font-size: 18px;
  color: var(--lw-text-main);
}

.export-card p {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.action-btn {
  border-radius: 999px;
  border: 1px solid #111111;
  background: #111111;
  color: var(--lw-text-inverse);
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.action-btn.ghost {
  border-color: var(--lw-border-base);
  background: var(--lw-bg-surface);
  color: var(--lw-text-secondary);
}

.action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
