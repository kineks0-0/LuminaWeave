<template>
  <ForgeLorebookSidebar
    v-if="kind === 'lorebook'"
    :workspace-session-id="store.workspaceSessionId"
  />
  <ForgeMemoryPanel v-else-if="kind === 'memory'" />
  <ForgeReviewPanel v-else-if="kind === 'review'" />
  <ForgeExportPanel v-else-if="kind === 'export'" />
  <ForgeTestChatPanel v-else-if="kind === 'test_chat'" />
  <ForgePostTracksPanel v-else />
</template>

<script setup lang="ts">
import { useCardMakerStore } from './CardMakerStore';
import type { ForgeAuxPanelKind } from '../../types/ForgeWorkflowTypes.js';
import ForgeLorebookSidebar from './ForgeLorebookSidebar.vue';
import ForgeMemoryPanel from './ForgeMemoryPanel.vue';
import ForgeReviewPanel from './ForgeReviewPanel.vue';
import ForgeExportPanel from './ForgeExportPanel.vue';
import ForgePostTracksPanel from './ForgePostTracksPanel.vue';
import ForgeTestChatPanel from './panels/ForgeTestChatPanel.vue';

withDefaults(defineProps<{
  kind: ForgeAuxPanelKind;
}>(), {
  kind: 'lorebook'
});

const store = useCardMakerStore();
</script>
