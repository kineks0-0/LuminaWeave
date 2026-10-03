<template>
  <div class="chat-composer-menu">
    <button
      type="button"
      class="chat-composer-menu__trigger"
      :class="{ 'is-compact': compact }"
      title="Lumina 工具"
      aria-label="Lumina 工具"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Menu :size="22" :stroke-width="2.2" aria-hidden="true" />
      <span v-if="!compact">菜单</span>
    </button>
    <ChatPopoverMenu
      v-if="open"
      :items="CHAT_CONTEXT_TOOLS"
      label="Lumina 工具"
      placement="above"
      align="start"
      @select="handleSelect"
      @close="open = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Menu } from 'lucide-vue-next';
import { CHAT_CONTEXT_TOOLS } from '../presentation/chatMenus.js';
import ChatPopoverMenu from './ChatPopoverMenu.vue';

const props = defineProps<{
  /** 已输入内容时收成圆形图标键，给输入留出空间（与原版一致） */
  compact: boolean;
  onOpenPanel: (panelId: string) => void;
}>();

const open = ref(false);

const handleSelect = (panelId: string): void => {
  open.value = false;
  props.onOpenPanel(panelId);
};
</script>

<style scoped>
.chat-composer-menu {
  position: relative;
  align-self: end;
}

.chat-composer-menu__trigger {
  display: inline-flex;
  height: 44px;
  min-width: 44px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 999px;
  background: var(--lw-primary);
  color: var(--lw-text-inverse);
  padding: 0 16px 0 12px;
  font: inherit;
  font-size: 1.0625rem;
  font-weight: 600;
  cursor: pointer;
  transition: padding 160ms cubic-bezier(0.25, 1, 0.5, 1), filter var(--lw-transition);
}

.chat-composer-menu__trigger.is-compact {
  padding: 0;
}

.chat-composer-menu__trigger:hover {
  filter: brightness(1.06);
}

.chat-composer-menu__trigger:focus-visible {
  outline: 2px solid var(--lw-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .chat-composer-menu__trigger {
    transition: none;
  }
}
</style>
