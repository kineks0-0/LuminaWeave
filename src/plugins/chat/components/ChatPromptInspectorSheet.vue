<template>
  <Transition name="lw-prompt-inspector-sheet">
    <div
      v-if="visible"
      class="lw-prompt-inspector-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="提示词预览"
    >
      <button
        type="button"
        class="lw-prompt-inspector-sheet__backdrop"
        aria-label="关闭"
        @click="emit('close')"
      ></button>
      <section class="lw-prompt-inspector-sheet__panel">
        <header class="lw-prompt-inspector-sheet__header">
          <span class="lw-prompt-inspector-sheet__grabber" aria-hidden="true"></span>
          <div class="lw-prompt-inspector-sheet__bar">
            <strong class="lw-prompt-inspector-sheet__title">提示词预览</strong>
            <button
              ref="closeButton"
              type="button"
              class="lw-prompt-inspector-sheet__close"
              aria-label="关闭"
              @click="emit('close')"
            >
              <X :size="18" :stroke-width="2.4" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div class="lw-prompt-inspector-sheet__body">
          <PromptInspector
            :inspection="inspection"
            :on-probe="onProbe"
            :on-run-edited-prompt="onRunEditedPrompt"
          />
        </div>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import PromptInspector from '../PromptInspector.vue';
import type { ChatPromptInspectionState } from '../application/ChatApplicationController.js';

const props = defineProps<{
  visible: boolean;
  inspection: ChatPromptInspectionState;
  onProbe: () => Promise<boolean>;
  onRunEditedPrompt: (text: string) => Promise<boolean>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const closeButton = ref<HTMLButtonElement | null>(null);

const handleKeydown = (event: KeyboardEvent): void => {
  if (!props.visible || event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  emit('close');
};

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    // preventScroll：面板还在 translateY(100%) 时聚焦会把 overflow 容器滚上去，聊天区就会跟着“上滑”。
    void nextTick(() => closeButton.value?.focus({ preventScroll: true }));
  }
);

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown));
</script>

<style scoped>
.lw-prompt-inspector-sheet {
  position: absolute;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.lw-prompt-inspector-sheet__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: var(--lw-bg-mask);
  cursor: default;
}

.lw-prompt-inspector-sheet__panel {
  position: relative;
  display: flex;
  width: min(100%, 760px);
  height: 92%;
  flex-direction: column;
  overflow: hidden;
  border-radius: 22px 22px 0 0;
  background: var(--lw-bg-subtle);
  box-shadow: 0 -18px 48px color-mix(in srgb, var(--lw-text-main) 14%, transparent);
}

/* 暗色主题的 subtle 层比 surface 更亮，画布回退到 app 才能保持“画布深于卡片”。 */
:global([data-theme='dark']) .lw-prompt-inspector-sheet__panel {
  background: var(--lw-bg-app);
}

.lw-prompt-inspector-sheet__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: calc(8px + var(--lw-content-safe-top, var(--lw-safe-top, 0px))) 14px 10px;
  border-bottom: 1px solid var(--lw-border-subtle);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.lw-prompt-inspector-sheet__grabber {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-text-main) 18%, transparent);
}

.lw-prompt-inspector-sheet__bar {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.lw-prompt-inspector-sheet__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lw-text-main);
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
}

.lw-prompt-inspector-sheet__close {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-text-main) 8%, transparent);
  color: var(--lw-text-main);
  cursor: pointer;
  transition: background-color var(--lw-transition);
}

.lw-prompt-inspector-sheet__close:hover {
  background: color-mix(in srgb, var(--lw-text-main) 14%, transparent);
}

.lw-prompt-inspector-sheet__body {
  display: flex;
  flex: 1;
  min-height: 0;
  padding-bottom: var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px));
}

.lw-prompt-inspector-sheet-enter-active {
  animation: lw-prompt-inspector-sheet-hold 280ms linear both;
}

.lw-prompt-inspector-sheet-enter-active .lw-prompt-inspector-sheet__backdrop {
  animation: lw-prompt-inspector-sheet-fade 200ms linear both;
}

.lw-prompt-inspector-sheet-enter-active .lw-prompt-inspector-sheet__panel {
  animation: lw-prompt-inspector-sheet-rise 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
  will-change: transform;
}

.lw-prompt-inspector-sheet-leave-active {
  animation: lw-prompt-inspector-sheet-hold 220ms linear both;
}

.lw-prompt-inspector-sheet-leave-active .lw-prompt-inspector-sheet__backdrop {
  animation: lw-prompt-inspector-sheet-fade-out 180ms linear both;
}

.lw-prompt-inspector-sheet-leave-active .lw-prompt-inspector-sheet__panel {
  animation: lw-prompt-inspector-sheet-sink 220ms cubic-bezier(0.4, 0, 1, 1) both;
}

/* 面板只滑不闪：这里用一个无视觉变化的动画占用 transition 时长，避免 Vue 提前移除 enter/leave 类。 */
@keyframes lw-prompt-inspector-sheet-hold {
  from { opacity: 1; }
  to { opacity: 1; }
}

@keyframes lw-prompt-inspector-sheet-fade {
  from { opacity: 0; }
}

@keyframes lw-prompt-inspector-sheet-fade-out {
  to { opacity: 0; }
}

@keyframes lw-prompt-inspector-sheet-rise {
  from { transform: translateY(100%); }
}

@keyframes lw-prompt-inspector-sheet-sink {
  to { transform: translateY(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .lw-prompt-inspector-sheet-enter-active,
  .lw-prompt-inspector-sheet-leave-active,
  .lw-prompt-inspector-sheet-enter-active .lw-prompt-inspector-sheet__backdrop,
  .lw-prompt-inspector-sheet-leave-active .lw-prompt-inspector-sheet__backdrop,
  .lw-prompt-inspector-sheet-enter-active .lw-prompt-inspector-sheet__panel,
  .lw-prompt-inspector-sheet-leave-active .lw-prompt-inspector-sheet__panel {
    animation: none;
  }
}

[data-motion='none'] .lw-prompt-inspector-sheet-enter-active,
[data-motion='none'] .lw-prompt-inspector-sheet-leave-active,
[data-motion='none'] .lw-prompt-inspector-sheet-enter-active .lw-prompt-inspector-sheet__backdrop,
[data-motion='none'] .lw-prompt-inspector-sheet-leave-active .lw-prompt-inspector-sheet__backdrop,
[data-motion='none'] .lw-prompt-inspector-sheet-enter-active .lw-prompt-inspector-sheet__panel,
[data-motion='none'] .lw-prompt-inspector-sheet-leave-active .lw-prompt-inspector-sheet__panel {
  animation: none;
}
</style>
