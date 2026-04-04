<template>
  <!-- 文本渲染块：直接将 Markdown 渲染为 HTML -->
  <div class="lv-text-block" v-html="renderedHtml"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  /** 原始文本内容 */
  text: string;
  /** 外部传入的 Markdown 渲染函数 */
  renderFn: (text: string) => string;
}>();

const renderedHtml = computed(() => {
  return props.renderFn(props.text);
});
</script>

<style scoped>
.lv-text-block {
  /* 继承父级排版样式，不添加额外间距 */
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  letter-spacing: var(--lw-letter-spacing);
}
</style>
