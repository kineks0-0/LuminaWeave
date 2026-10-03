<template>
  <div class="chat-toolbar">
    <button
      type="button"
      :title="collapsed ? '展开输入框' : '收起输入框'"
      :aria-label="collapsed ? '展开输入框' : '收起输入框'"
      @click="emit('toggleCollapsed')"
    >
      <ChevronUp v-if="!collapsed" :size="16" />
      <ChevronDown v-else :size="16" />
    </button>
    <button
      type="button"
      :class="{ 'is-active': promptInspectorVisible }"
      :title="promptInspectorVisible ? '隐藏 Prompt Inspector' : '打开 Prompt Inspector'"
      @click="emit('togglePromptInspector')"
    >
      <SearchCode :size="16" />
      <span>Prompt Inspector</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronUp, SearchCode } from 'lucide-vue-next';

defineProps<{
  collapsed: boolean;
  promptInspectorVisible: boolean;
}>();

const emit = defineEmits<{
  toggleCollapsed: [];
  togglePromptInspector: [];
}>();
</script>

<style scoped>
.chat-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chat-toolbar button {
  display: inline-flex;
  min-width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--lw-text-muted);
  padding: 0 8px;
  cursor: pointer;
  font: inherit;
  font-size: var(--lw-type-label-small-size);
}

.chat-toolbar button:hover,
.chat-toolbar button.is-active {
  border-color: var(--lw-border-base);
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}
</style>
