<template>
  <div class="lv-sep-block">
    <div class="sep-line"></div>
  </div>
</template>

<script setup lang="ts">
/** 分割线组件：无需参数 */
</script>

<style scoped>
.lv-sep-block {
  padding: 16px 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.sep-line {
  width: 100%;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(226, 232, 240, 0) 0%,
    rgba(226, 232, 240, 1) 20%,
    rgba(226, 232, 240, 1) 80%,
    rgba(226, 232, 240, 0) 100%
  );
  opacity: 0.6;
}

/* 暗色模式适配 */
:deep(.lw-chat-stream.theme-dark) .sep-line {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.1) 20%,
    rgba(255, 255, 255, 0.1) 80%,
    rgba(255, 255, 255, 0) 100%
  );
}
</style>
