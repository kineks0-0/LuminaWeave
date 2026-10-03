<template>
  <div
    ref="rootRef"
    class="chat-popover-menu"
    role="menu"
    :aria-label="label"
    :data-placement="placement"
    :data-align="align"
    @keydown="handleKeydown"
  >
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      role="menuitem"
      class="chat-popover-menu__item"
      :class="{ 'is-danger': item.danger }"
      :disabled="item.disabled"
      @click="select(item)"
    >
      <component :is="CHAT_MENU_ICONS[item.icon]" :size="21" :stroke-width="1.9" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { ChatMenuItem, ChatMenuPlacement } from '../presentation/chatMenus.js';
import { CHAT_MENU_ICONS } from './chatMenuIcons.js';

withDefaults(defineProps<{
  items: ReadonlyArray<ChatMenuItem>;
  label: string;
  placement?: ChatMenuPlacement;
  align?: 'start' | 'end';
}>(), {
  placement: 'below',
  align: 'end'
});

const emit = defineEmits<{
  select: [id: string];
  close: [];
}>();

const rootRef = ref<HTMLElement | null>(null);

const enabledButtons = (): HTMLButtonElement[] => (
  rootRef.value ? [...rootRef.value.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')] : []
);

const select = (item: ChatMenuItem): void => {
  if (item.disabled) return;
  emit('select', item.id);
};

const moveFocus = (step: number): void => {
  const buttons = enabledButtons();
  if (buttons.length === 0) return;
  const active = rootRef.value?.getRootNode() instanceof ShadowRoot
    ? (rootRef.value.getRootNode() as ShadowRoot).activeElement
    : rootRef.value?.ownerDocument.activeElement;
  const current = buttons.findIndex(button => button === active);
  const next = (current + step + buttons.length) % buttons.length;
  buttons[next]?.focus();
};

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('close');
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveFocus(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveFocus(-1);
  } else if (event.key === 'Tab') {
    emit('close');
  }
};

// 菜单之外的按下即关闭；用 composedPath 以兼容 Shadow DOM
const handleOutsidePointer = (event: PointerEvent): void => {
  const anchor = rootRef.value?.parentElement;
  if (anchor && !event.composedPath().includes(anchor)) emit('close');
};

onMounted(() => {
  rootRef.value?.ownerDocument.addEventListener('pointerdown', handleOutsidePointer, true);
  enabledButtons()[0]?.focus({ preventScroll: true });
});

onBeforeUnmount(() => {
  rootRef.value?.ownerDocument.removeEventListener('pointerdown', handleOutsidePointer, true);
});
</script>

<style scoped>
.chat-popover-menu {
  position: absolute;
  z-index: 20;
  display: grid;
  min-width: 208px;
  padding: 6px 0;
  border: 1px solid var(--lw-chat-floating-border, var(--lw-border-base));
  border-radius: var(--lw-chat-menu-radius, 12px);
  background: var(--lw-chat-menu-bg, var(--lw-bg-elevated));
  box-shadow: var(--lw-chat-menu-shadow, var(--lw-shadow-card));
  backdrop-filter: var(--lw-chat-floating-blur, none);
  -webkit-backdrop-filter: var(--lw-chat-floating-blur, none);
  color: var(--lw-text-main);
  transform-origin: top right;
  animation: chat-popover-in 140ms cubic-bezier(0.25, 1, 0.5, 1);
}

.chat-popover-menu[data-placement='below'] { top: calc(100% + 6px); }
.chat-popover-menu[data-placement='above'] { bottom: calc(100% + 6px); }
.chat-popover-menu[data-align='end'] { right: 0; }
.chat-popover-menu[data-align='start'] { left: 0; transform-origin: top left; }
.chat-popover-menu[data-placement='above'][data-align='end'] { transform-origin: bottom right; }
.chat-popover-menu[data-placement='above'][data-align='start'] { transform-origin: bottom left; }

.chat-popover-menu__item {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 18px;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0 20px 0 18px;
  font: inherit;
  font-size: var(--lw-type-body-large-size, 1rem);
  line-height: 1.3;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.chat-popover-menu__item svg {
  flex: 0 0 auto;
  color: var(--lw-text-secondary);
}

.chat-popover-menu__item:hover:not(:disabled),
.chat-popover-menu__item:focus-visible {
  outline: 0;
  background: var(--lw-bg-hover);
}

.chat-popover-menu__item.is-danger,
.chat-popover-menu__item.is-danger svg {
  color: var(--lw-danger);
}

.chat-popover-menu__item:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

@keyframes chat-popover-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-popover-menu {
    animation: none;
  }
}
</style>
