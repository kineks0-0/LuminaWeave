<template>
  <ForgeAuxPanelShell
    title="审阅中心"
    kicker="Review Queue"
    :subtitle="`工具授权 ${forgeStore.pendingToolApprovals.length} 条，待审 ${forgeStore.stagingArea.length} 条，写回准备 ${forgeStore.commitReadyEntries.length} 条。`"
  >
    <div v-if="isEmpty" class="review-empty">
      <strong>当前没有待审内容</strong>
      <p>当 Forge 产出 proposal 或 workspace-ready 草案后，会在这里集中审阅。</p>
    </div>

    <div v-else class="review-stack">
      <section v-if="forgeStore.pendingToolApprovals.length > 0" class="tool-approval-list">
        <div class="tool-approval-header">
          <span>工具授权</span>
          <span>{{ forgeStore.pendingToolApprovals.length }}</span>
        </div>
        <article
          v-for="approval in forgeStore.pendingToolApprovals"
          :key="approval.toolCallId"
          class="tool-approval-card"
        >
          <div class="tool-approval-topline">
            <span class="tool-name">{{ approval.toolName }}</span>
            <span class="tool-source">{{ approval.source }}</span>
          </div>
          <p class="tool-reason">{{ approval.reason }}</p>
          <div class="tool-detail">
            <div class="tool-target">
              <span>{{ approvalPresentation(approval).targetLabel }}</span>
              <strong>{{ approvalPresentation(approval).targetValue }}</strong>
            </div>
            <p class="tool-summary">{{ approvalPresentation(approval).summary }}</p>
            <div
              v-for="block in approvalPresentation(approval).blocks"
              :key="`${approval.toolCallId}-${block.label}`"
              class="tool-diff-block"
              :class="`tone-${block.tone}`"
            >
              <span>{{ block.label }}</span>
              <pre>{{ block.value }}</pre>
            </div>
          </div>
          <details class="tool-raw">
            <summary>完整参数</summary>
            <pre class="tool-args">{{ approvalPresentation(approval).rawArgs }}</pre>
          </details>
          <div class="tool-actions">
            <button class="tool-action secondary" @click="rejectToolCall(approval.toolCallId)">拒绝并继续</button>
            <button class="tool-action primary" @click="approveToolCall(approval.toolCallId)">批准并继续</button>
          </div>
        </article>
      </section>

      <ForgeStagingArea
        v-if="forgeStore.stagingArea.length > 0 || forgeStore.commitReadyEntries.length > 0"
        class="review-stage"
      />
    </div>
  </ForgeAuxPanelShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useForgeStore } from '../../../stores/useForgeStore.js';
import ForgeAuxPanelShell from '../app/ForgeAuxPanelShell.vue';
import ForgeStagingArea from './ForgeStagingArea.vue';
import { useCardMakerStore } from '../CardMakerStore.js';
import { buildToolApprovalPresentation } from './forgeToolApprovalPresentation.js';
import type { ForgeToolApprovalRequest } from '../../../types/ForgeRuntimeTypes.js';

const forgeStore = useForgeStore();
const cardMakerStore = useCardMakerStore();
const isEmpty = computed(() =>
  forgeStore.pendingToolApprovals.length === 0 &&
  forgeStore.stagingArea.length === 0 &&
  forgeStore.commitReadyEntries.length === 0
);

const approvalPresentation = (approval: ForgeToolApprovalRequest) =>
  buildToolApprovalPresentation(approval.toolName, approval.args);

const approveToolCall = (toolCallId: string): void => {
  void cardMakerStore.resolveToolApproval(toolCallId, true, '已在 Review Gate 批准。');
};

const rejectToolCall = (toolCallId: string): void => {
  void cardMakerStore.resolveToolApproval(toolCallId, false, '已在 Review Gate 拒绝。');
};
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
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.review-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-approval-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-approval-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--lw-primary);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.tool-approval-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 13px;
  border: 1px solid color-mix(in srgb, var(--lw-primary) 18%, var(--lw-border-base));
  border-radius: 18px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, var(--lw-primary) 6%);
}

.tool-approval-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tool-name {
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.tool-source {
  flex: 0 0 auto;
  padding: 3px 8px;
  border: 1px solid var(--lw-border-subtle);
  border-radius: 999px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.tool-reason {
  margin: 0;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.5;
}

.tool-detail {
  display: grid;
  gap: 8px;
}

.tool-target {
  display: grid;
  gap: 4px;
}

.tool-target span,
.tool-diff-block span {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.tool-target strong {
  color: var(--lw-text-main);
  font-family: ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  overflow-wrap: anywhere;
}

.tool-summary {
  margin: 0;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size);
  line-height: 1.5;
}

.tool-diff-block {
  display: grid;
  gap: 5px;
}

.tool-diff-block pre,
.tool-args {
  max-height: 110px;
  margin: 0;
  padding: 10px;
  overflow: auto;
  border: 1px solid var(--lw-border-subtle);
  border-radius: 14px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 86%, white);
  color: var(--lw-text-secondary);
  font-family: ui-monospace, Consolas, monospace;
  font-size: var(--lw-type-label-small-size);
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.tool-diff-block.tone-pending pre {
  color: var(--lw-text-muted);
  font-family: inherit;
}

.tool-raw summary {
  color: var(--lw-text-muted);
  cursor: pointer;
  font-size: var(--lw-type-label-small-size);
}

.tool-raw[open] summary {
  margin-bottom: 6px;
}

.tool-actions {
  display: flex;
  gap: 8px;
}

.tool-action {
  flex: 1 1 110px;
  padding: 8px 10px;
  border-radius: 999px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-label-medium-weight);
  cursor: pointer;
}

.tool-action.primary {
  border: 1px solid #111111;
  background: #111111;
  color: var(--lw-text-inverse);
}

.tool-action.secondary {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
}

.review-stage {
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}
</style>
