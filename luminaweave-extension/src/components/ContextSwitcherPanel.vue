<template>
  <div class="ctx-panel">
    <LuminaNexus :is-compact="true" />
  </div>
</template>

<script setup lang="ts">
import LuminaNexus from './LuminaNexus.vue';
</script>

<style scoped>
.ctx-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  /* 移除原本的 padding，因为 Nexus 内部已经处理了 padding */
}

/* 针对窗口模式的微调 */
:deep(.lumina-nexus) {
  border-right: none;
}
</style>

