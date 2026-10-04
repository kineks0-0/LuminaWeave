<template>
  <Transition name="lw-prompt-assets-sheet">
    <div
      v-if="target"
      class="lw-prompt-assets-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <button
        type="button"
        class="lw-prompt-assets-sheet__backdrop"
        aria-label="关闭"
        @click="emit('close')"
      ></button>
      <section class="lw-prompt-assets-sheet__panel">
        <header class="lw-prompt-assets-sheet__header">
          <span class="lw-prompt-assets-sheet__grabber" aria-hidden="true"></span>
          <div class="lw-prompt-assets-sheet__bar">
            <strong class="lw-prompt-assets-sheet__title">{{ title }}</strong>
            <button
              ref="closeButton"
              type="button"
              class="lw-prompt-assets-sheet__close"
              aria-label="关闭"
              @click="emit('close')"
            >
              <X :size="18" :stroke-width="2.4" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div class="lw-prompt-assets-sheet__body">
          <component :is="panelComponent" v-if="panelComponent" v-bind="panelProps" />
        </div>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { SETTINGS_PANEL_COMPONENTS } from '../../settings/settingsPanels.js';
import type { ChatPromptAssetsTarget } from '../presentation/chatMenus.js';

const props = defineProps<{
  target: ChatPromptAssetsTarget | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const closeButton = ref<HTMLButtonElement | null>(null);

const title = computed(() => (props.target === 'regex-scripts' ? '消息净化' : '提示词预设'));
const panelComponent = computed(() => {
  if (!props.target) return null;
  return SETTINGS_PANEL_COMPONENTS[
    props.target === 'regex-scripts' ? 'chat-regex-scripts' : 'chat-prompt-presets'
  ];
});

const panelProps = computed<Record<string, unknown>>(() => (
  props.target === 'regex-scripts' ? { embedded: true } : {}
));

const handleKeydown = (event: KeyboardEvent): void => {
  if (!props.target || event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  emit('close');
};

watch(
  () => props.target,
  (target) => {
    if (!target) return;
    void nextTick(() => closeButton.value?.focus({ preventScroll: true }));
  }
);

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown));
</script>

<style scoped>
.lw-prompt-assets-sheet {
  position: absolute;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.lw-prompt-assets-sheet__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: var(--lw-bg-mask);
  cursor: default;
}

.lw-prompt-assets-sheet__panel {
  position: relative;
  display: flex;
  width: min(100%, 760px);
  height: 92%;
  flex-direction: column;
  overflow: hidden;
  border-radius: 22px 22px 0 0;
  background: var(--lw-bg-app);
  box-shadow: 0 -18px 48px color-mix(in srgb, var(--lw-text-main) 14%, transparent);
}

.lw-prompt-assets-sheet__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: calc(8px + var(--lw-content-safe-top, var(--lw-safe-top, 0px))) 14px 10px;
  border-bottom: 1px solid var(--lw-border-subtle);
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
}

.lw-prompt-assets-sheet__grabber {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-text-main) 18%, transparent);
}

.lw-prompt-assets-sheet__bar {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.lw-prompt-assets-sheet__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lw-text-main);
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
}

.lw-prompt-assets-sheet__close {
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

.lw-prompt-assets-sheet__close:hover {
  background: color-mix(in srgb, var(--lw-text-main) 14%, transparent);
}

.lw-prompt-assets-sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 14px calc(16px + var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px)));
  overscroll-behavior: contain;
  background: var(--lw-bg-subtle);
}

.lw-prompt-assets-sheet-enter-active {
  animation: lw-prompt-assets-sheet-fade 260ms cubic-bezier(0.2, 0, 0, 1) both;
}

.lw-prompt-assets-sheet-enter-active .lw-prompt-assets-sheet__panel {
  animation: lw-prompt-assets-sheet-rise 260ms cubic-bezier(0.2, 0, 0, 1) both;
}

.lw-prompt-assets-sheet-leave-active {
  animation: lw-prompt-assets-sheet-fade-out 200ms cubic-bezier(0.2, 0, 0, 1) both;
}

.lw-prompt-assets-sheet-leave-active .lw-prompt-assets-sheet__panel {
  animation: lw-prompt-assets-sheet-sink 200ms cubic-bezier(0.2, 0, 0, 1) both;
}

@keyframes lw-prompt-assets-sheet-fade {
  from { opacity: 0; }
}

@keyframes lw-prompt-assets-sheet-fade-out {
  to { opacity: 0; }
}

@keyframes lw-prompt-assets-sheet-rise {
  from { transform: translateY(100%); }
}

@keyframes lw-prompt-assets-sheet-sink {
  to { transform: translateY(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .lw-prompt-assets-sheet-enter-active,
  .lw-prompt-assets-sheet-leave-active,
  .lw-prompt-assets-sheet-enter-active .lw-prompt-assets-sheet__panel,
  .lw-prompt-assets-sheet-leave-active .lw-prompt-assets-sheet__panel {
    animation: none;
  }
}

[data-motion='none'] .lw-prompt-assets-sheet-enter-active,
[data-motion='none'] .lw-prompt-assets-sheet-leave-active,
[data-motion='none'] .lw-prompt-assets-sheet-enter-active .lw-prompt-assets-sheet__panel,
[data-motion='none'] .lw-prompt-assets-sheet-leave-active .lw-prompt-assets-sheet__panel {
  animation: none;
}
</style>
