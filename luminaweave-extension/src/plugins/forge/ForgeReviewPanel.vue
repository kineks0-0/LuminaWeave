<template>
  <ForgeAuxPanelShell
    title="审阅中心"
    kicker="Review Queue"
    :subtitle="`待审 ${forgeStore.stagingArea.length} 条，写回准备 ${forgeStore.commitReadyEntries.length} 条。`"
  >
    <div v-if="isEmpty" class="review-empty">
      <strong>当前没有待审内容</strong>
      <p>当 Forge 产出 proposal 或 workspace-ready 草案后，会在这里集中审阅。</p>
    </div>

    <ForgeStagingArea v-else class="review-stage" />
  </ForgeAuxPanelShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useForgeStore } from '../../stores/useForgeStore';
import ForgeAuxPanelShell from './ForgeAuxPanelShell.vue';
import ForgeStagingArea from './ForgeStagingArea.vue';

const forgeStore = useForgeStore();
const isEmpty = computed(() => forgeStore.stagingArea.length === 0 && forgeStore.commitReadyEntries.length === 0);
</script>

<style scoped>
.review-empty {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.review-empty strong {
  display: block;
  margin-bottom: 6px;
  color: var(--lw-text-main);
}

.review-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.review-stage {
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}
</style>
