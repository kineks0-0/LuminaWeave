<template>
  <dialog
    ref="dialogRef"
    class="lw-modal-shell"
    @cancel.prevent="emit('dismiss')"
    @click="handleBackdropClick"
  >
    <div :class="contentClass" @click.stop>
      <slot />
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { cn } from '../cn.js';

const props = withDefaults(defineProps<{
  width?: 'sm' | 'md' | 'lg';
}>(), {
  width: 'sm'
});

const emit = defineEmits<{
  (e: 'dismiss'): void;
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);

onMounted(() => {
  dialogRef.value?.showModal();
});

onUnmounted(() => {
  dialogRef.value?.close();
});

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === dialogRef.value) emit('dismiss');
};

const contentClass = computed(() => cn(
  'tw:w-full tw:rounded-lw-lg tw:border tw:border-lw-border tw:bg-lw-surface tw:p-6 tw:shadow-lw-xl',
  props.width === 'sm' && 'tw:max-w-[400px]',
  props.width === 'md' && 'tw:max-w-[560px]',
  props.width === 'lg' && 'tw:max-w-[720px]'
));
</script>

<style scoped>
.lw-modal-shell {
  padding: 0;
  border: none;
  background: transparent;
  max-width: 100vw;
  max-height: none;
  overflow: visible;
}

.lw-modal-shell::backdrop {
  background: var(--lw-bg-mask, rgba(0, 0, 0, 0.4));
}
</style>
