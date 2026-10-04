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

    <div ref="pickerRef" class="chat-toolbar__picker">
      <button
        type="button"
        class="preset-chip"
        :class="{ 'is-open': pickerOpen }"
        title="切换提示词预设"
        aria-haspopup="menu"
        :aria-expanded="pickerOpen"
        @click="togglePicker"
      >
        <BookMarked :size="14" />
        <span class="preset-chip__name">{{ activePresetName }}</span>
        <ChevronDown :size="12" />
      </button>

      <div v-if="pickerOpen" class="preset-popover" role="menu" aria-label="提示词预设">
        <input
          v-model="search"
          class="preset-popover__search"
          type="search"
          placeholder="搜索预设…"
          aria-label="搜索预设"
          @keydown.esc="closePicker"
        />
        <div class="preset-popover__list">
          <button
            v-for="preset in filteredPresets"
            :key="preset.id"
            type="button"
            role="menuitem"
            class="preset-popover__item"
            :class="{ 'is-active': preset.id === activePromptPresetId }"
            @click="choosePreset(preset.id)"
          >
            <Check v-if="preset.id === activePromptPresetId" :size="13" aria-hidden="true" />
            <span v-else class="preset-popover__spacer" aria-hidden="true"></span>
            <span class="preset-popover__name">{{ preset.name }}</span>
            <span class="preset-popover__count">{{ preset.promptCount }} 条</span>
          </button>
          <p v-if="filteredPresets.length === 0" class="preset-popover__empty">
            {{ promptPresets.length === 0 ? '还没有预设，先在设置里导入或新建。' : '没有匹配的预设。' }}
          </p>
        </div>
        <button type="button" class="preset-popover__manage" @click="managePresets">
          管理预设…
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BookMarked, Check, ChevronDown, ChevronUp, SearchCode } from 'lucide-vue-next';
import { useOutsidePointer } from '../../../composables/useOutsidePointer.js';
import type { ChatPromptPresetOption } from '../presentation/chatMenus.js';

const props = withDefaults(defineProps<{
  collapsed: boolean;
  promptInspectorVisible: boolean;
  promptPresets?: ChatPromptPresetOption[];
  activePromptPresetId?: string;
}>(), {
  promptPresets: () => [],
  activePromptPresetId: ''
});

const emit = defineEmits<{
  toggleCollapsed: [];
  togglePromptInspector: [];
  selectPromptPreset: [id: string];
  refreshPromptPresets: [];
  managePromptPresets: [];
}>();

const pickerRef = ref<HTMLElement | null>(null);
const pickerOpen = ref(false);
const search = ref('');

const filteredPresets = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return props.promptPresets;
  return props.promptPresets.filter(preset => preset.name.toLowerCase().includes(keyword));
});

const activePresetName = computed(() =>
  props.promptPresets.find(preset => preset.id === props.activePromptPresetId)?.name ?? '默认预设'
);

const togglePicker = (): void => {
  pickerOpen.value = !pickerOpen.value;
  if (pickerOpen.value) {
    search.value = '';
    emit('refreshPromptPresets');
  }
};

const closePicker = (): void => {
  pickerOpen.value = false;
};

const choosePreset = (id: string): void => {
  emit('selectPromptPreset', id);
  closePicker();
};

const managePresets = (): void => {
  emit('managePromptPresets');
  closePicker();
};

useOutsidePointer([pickerRef], () => {
  if (pickerOpen.value) closePicker();
});
</script>

<style scoped>
.chat-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}

.chat-toolbar > button {
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

.chat-toolbar > button:hover,
.chat-toolbar > button.is-active,
.chat-toolbar > button.is-open {
  border-color: var(--lw-border-base);
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.chat-toolbar__picker {
  position: relative;
  margin-left: auto;
}

.preset-chip__name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 60;
  display: flex;
  width: 260px;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-elevated);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
  padding: 8px;
}

.preset-popover__search {
  width: 100%;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-surface);
  color: var(--lw-text-main);
  font: inherit;
  font-size: var(--lw-type-label-small-size, 12px);
  padding: 5px 8px;
  outline: none;
}

.preset-popover__list {
  display: flex;
  max-height: 240px;
  flex-direction: column;
  gap: 2px;
  overflow: auto;
}

.preset-popover__item {
  display: grid;
  width: 100%;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  border: 0;
  border-radius: var(--lw-radius-xs, 8px);
  background: transparent;
  color: var(--lw-text-secondary);
  padding: 5px 6px;
  cursor: pointer;
  font: inherit;
  font-size: var(--lw-type-label-small-size, 12px);
  text-align: left;
}

.preset-popover__item:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.preset-popover__item.is-active {
  color: var(--lw-primary-strong, var(--lw-primary));
}

.preset-popover__spacer {
  width: 13px;
}

.preset-popover__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-popover__count {
  color: var(--lw-text-muted);
  font-size: 10px;
}

.preset-popover__empty {
  margin: 4px 6px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size, 12px);
}

.preset-popover__manage {
  border: 0;
  border-top: 1px solid var(--lw-border-base);
  border-radius: 0;
  background: transparent;
  color: var(--lw-text-secondary);
  padding: 8px 6px 2px;
  cursor: pointer;
  font: inherit;
  font-size: var(--lw-type-label-small-size, 12px);
  text-align: left;
}

.preset-popover__manage:hover {
  color: var(--lw-text-main);
}
</style>
