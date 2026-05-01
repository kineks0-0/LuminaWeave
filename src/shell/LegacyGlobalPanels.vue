<template>
  <ConflictDiffViewer ref="globalConflictViewer" />
  <SyncReportViewer ref="globalSyncReportViewer" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ConflictDiffViewer from '../plugins/chat/ConflictDiffViewer.vue';
import SyncReportViewer from '../plugins/chat/SyncReportViewer.vue';

const globalConflictViewer = ref<InstanceType<typeof ConflictDiffViewer> | null>(null);
const globalSyncReportViewer = ref<InstanceType<typeof SyncReportViewer> | null>(null);

const openConflictViewer = () => {
  globalConflictViewer.value?.open();
};

const openSyncReportViewer = () => {
  globalSyncReportViewer.value?.open();
};

defineExpose({
  openConflictViewer,
  openSyncReportViewer
});
</script>
