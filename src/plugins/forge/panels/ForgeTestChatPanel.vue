<template>
  <div class="ftc-root">
    <!-- 工具栏 -->
    <div class="ftc-toolbar">
      <div class="ftc-toolbar-left">
        <span class="ftc-title">测试聊天</span>
        <span class="ftc-subtitle">
          {{ entryCount > 0 ? `已加载 ${entryCount} 个虚拟世界书条目` : '虚拟世界书为空' }}
        </span>
      </div>
      <div class="ftc-toolbar-right">
        <!-- 预设切换下拉 -->
        <select
          v-if="service.presets.length > 0"
          class="ftc-preset-select"
          :disabled="service.isStreaming"
          :value="service.activePresetId"
          @change="onPresetChange"
        >
          <option v-for="preset in service.presets" :key="preset.id" :value="preset.id">
            {{ preset.name }}
          </option>
        </select>
        <!-- 清空按钮 -->
        <button
          v-if="service.messages.length > 0"
          class="ftc-clear-btn"
          type="button"
          :disabled="service.isStreaming"
          @click="service.clearMessages()"
          title="清空对话"
        >
          清空
        </button>
      </div>
    </div>

    <!-- 聊天视图 -->
    <SimpleChatView
      :messages="service.messages"
      :is-streaming="service.isStreaming"
      :render-markdown="renderMarkdown"
      @send="service.sendMessage($event)"
      @abort="service.abort()"
    >
      <template #empty>
        <div class="ftc-empty-icon">💬</div>
        <p>在此体验当前虚拟世界书效果</p>
        <p class="ftc-empty-hint">
          {{ entryCount > 0
            ? `当前已有 ${entryCount} 个条目作为世界背景`
            : '前往「世界书」面板添加虚拟条目后再来测试' }}
        </p>
      </template>
    </SimpleChatView>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import SimpleChatView from '../../chat/components/SimpleChatView.vue';

const store = useCardMakerStore();
const service = store.testChatService;

const entryCount = computed(
    () => store.virtualLorebookEntries.filter(e => !e.entry.disable).length
);

const onPresetChange = (event: Event) => {
    const select = event.target as HTMLSelectElement;
    service.setActivePreset(select.value);
};

const renderMarkdown = (text: string): string => {
    if (!text) return '';
    return text
        .split('\n')
        .map(line => {
            if (!line.trim()) return '<div class="empty-line"></div>';
            return `<p>${line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`;
        })
        .join('');
};
</script>

<style scoped>
.ftc-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.ftc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px 8px;
  border-bottom: 1px solid var(--lw-border-base);
  flex-shrink: 0;
}

.ftc-toolbar-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ftc-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ftc-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--lw-text-main);
}

.ftc-subtitle {
  font-size: 11px;
  color: var(--lw-text-muted);
}

.ftc-preset-select {
  font-size: 12px;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  cursor: pointer;
  max-width: 120px;
}

.ftc-preset-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ftc-clear-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--lw-border-base);
  background: transparent;
  color: var(--lw-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms, color 120ms;
}

.ftc-clear-btn:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.ftc-empty-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.ftc-empty-hint {
  font-size: 12px !important;
  color: var(--lw-text-muted) !important;
}
</style>
