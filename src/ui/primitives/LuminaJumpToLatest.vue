<template>
  <!-- 放在滚动内容末尾：零高度 sticky 容器，不占布局空间 -->
  <div class="lw-jump-to-latest">
    <Transition name="lw-jump">
      <button
        v-if="visible"
        type="button"
        class="lw-jump-to-latest__button"
        :aria-label="label"
        @click="emit('jump')"
      >
        <ArrowDown :size="15" aria-hidden="true" />
        <span>{{ label }}</span>
      </button>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ArrowDown } from 'lucide-vue-next';

withDefaults(defineProps<{
  visible: boolean;
  label?: string;
}>(), {
  label: '回到最新'
});

const emit = defineEmits<{
  jump: [];
}>();
</script>

<style scoped>
.lw-jump-to-latest {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  height: 0;
  justify-content: center;
  overflow: visible;
  pointer-events: none;
}

.lw-jump-to-latest__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--lw-border-base);
  border-radius: 999px;
  background: var(--lw-bg-elevated);
  color: var(--lw-text-secondary);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--lw-text-main) 12%, transparent);
  font-family: var(--lw-font-main);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  cursor: pointer;
  pointer-events: auto;
  transform: translateY(calc(-100% - 12px));
  transition: background var(--lw-transition), color var(--lw-transition);
}

.lw-jump-to-latest__button:hover {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
}

.lw-jump-to-latest__button:focus-visible {
  outline: 2px solid var(--lw-primary);
  outline-offset: 2px;
}

.lw-jump-enter-active,
.lw-jump-leave-active {
  transition: opacity 160ms cubic-bezier(0.25, 1, 0.5, 1);
}

.lw-jump-enter-from,
.lw-jump-leave-to {
  opacity: 0;
}
</style>
