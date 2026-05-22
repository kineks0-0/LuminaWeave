<template>
  <ForgeLorebookSidebar
    v-if="kind === 'lorebook'"
    :workspace-session-id="store.workspaceSessionId"
  />
  <ForgeMemoryPanel v-else-if="kind === 'memory'" />
  <ForgeExportPanel v-else-if="kind === 'export'" />
  <ForgeTestChatPanel v-else-if="kind === 'test_chat'" />
  <ForgeModelRequestDebugPanel v-else-if="kind === 'dev_requests'" />
  <ForgeAgentInspectorPanel v-else-if="kind === 'agent_inspector'" />
  <ForgeSemanticVfsPanel v-else-if="kind === 'semantic_vfs'" />
  <ForgeWorkspaceVersionsPanel v-else-if="kind === 'workspace_versions'" />
  <ForgePostTracksPanel v-else />
</template>

<script setup lang="ts">
import { useCardMakerStore } from '../CardMakerStore.js';
import type { ForgeAuxPanelKind } from '../../../types/ForgeWorkflowTypes.js';
import ForgeLorebookSidebar from '../project/ForgeLorebookSidebar.vue';
import ForgeMemoryPanel from '../project/ForgeMemoryPanel.vue';
import ForgeExportPanel from '../project/ForgeExportPanel.vue';
import ForgePostTracksPanel from '../ForgePostTracksPanel.vue';
import ForgeTestChatPanel from '../panels/ForgeTestChatPanel.vue';
import ForgeModelRequestDebugPanel from '../inspector/ForgeModelRequestDebugPanel.vue';
import ForgeAgentInspectorPanel from '../inspector/panels/ForgeAgentInspectorPanel.vue';
import ForgeSemanticVfsPanel from '../project/ForgeSemanticVfsPanel.vue';
import ForgeWorkspaceVersionsPanel from '../project/ForgeWorkspaceVersionsPanel.vue';

withDefaults(defineProps<{
  kind: ForgeAuxPanelKind;
}>(), {
  kind: 'lorebook'
});

const store = useCardMakerStore();
</script>
