<template>
  <div
    ref="rootRef"
    class="chat-popover-menu"
    :class="{ 'is-anchored': anchored }"
    role="menu"
    :aria-label="label"
    :data-placement="anchored ? undefined : placement"
    :data-align="anchored ? undefined : align"
    :style="anchored ? anchoredStyle : undefined"
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
      <component :is="CHAT_MENU_ICONS[item.icon]" :size="20" :stroke-width="1.9" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type {
  ChatMenuItem,
  ChatMenuPlacement,
  ChatPopoverAnchorPoint,
  ChatPopoverBounds
} from '../presentation/chatMenus.js';
import { resolveChatPopoverPosition } from '../presentation/chatMenus.js';
import { CHAT_MENU_ICONS } from './chatMenuIcons.js';
import { useOutsidePointer } from '../../../composables/useOutsidePointer.js';

const props = withDefaults(defineProps<{
  items: ReadonlyArray<ChatMenuItem>;
  label: string;
  placement?: ChatMenuPlacement;
  align?: 'start' | 'end';
  /** 指针锚定：提供后在触摸 / 右键位置弹出，空间不足时向左 / 上翻转 */
  anchor?: ChatPopoverAnchorPoint | null;
  /** 指针锚定的可用区域；缺省为窗口视口 */
  bounds?: ChatPopoverBounds | null;
  offset?: number;
}>(), {
  placement: 'below',
  align: 'end',
  anchor: null,
  bounds: null,
  offset: 4
});

const emit = defineEmits<{
  select: [id: string];
  close: [];
}>();

const rootRef = ref<HTMLElement | null>(null);
const anchored = computed(() => props.anchor !== null);
const anchoredStyle = ref<Record<string, string>>({});

const resolveBounds = (): ChatPopoverBounds => props.bounds ?? {
  left: 0,
  top: 0,
  right: window.innerWidth,
  bottom: window.innerHeight
};

const updateAnchoredStyle = (): void => {
  const element = rootRef.value;
  const anchor = props.anchor;
  if (!element || !anchor) return;
  const position = resolveChatPopoverPosition({
    anchor,
    // offsetWidth/offsetHeight 不受入场缩放动画影响，保证翻转判断用的是最终尺寸
    size: { width: element.offsetWidth, height: element.offsetHeight },
    bounds: resolveBounds(),
    offset: props.offset
  });
  // 从最靠近指针的角展开，翻转后原点跟着换边
  const originX = position.left < anchor.x ? 'right' : 'left';
  const originY = position.top < anchor.y ? 'bottom' : 'top';
  anchoredStyle.value = {
    left: `${position.left}px`,
    top: `${position.top}px`,
    transformOrigin: `${originX} ${originY}`
  };
};

watch(() => props.anchor, () => {
  if (anchored.value) void nextTick(updateAnchoredStyle);
});

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

// 菜单之外的按下即关闭
useOutsidePointer([() => rootRef.value?.parentElement ?? null], () => emit('close'));

onMounted(() => {
  updateAnchoredStyle();
  enabledButtons()[0]?.focus({ preventScroll: true });
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

/* 指针锚定：固定在最上层，位置由 resolveChatPopoverPosition 计算 */
.chat-popover-menu.is-anchored {
  position: fixed;
  z-index: 30;
}

.chat-popover-menu__item {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 16px;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0 18px 0 16px;
  font: inherit;
  font-size: var(--lw-type-body-medium-size, 0.875rem);
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
