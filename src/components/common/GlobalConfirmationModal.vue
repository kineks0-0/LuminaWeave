<template>
  <transition name="lw-fade-scale">
    <LuminaModalShell v-if="modal.isOpen" @dismiss="modal.handleCancel">
      <div class="tw:flex tw:items-center tw:gap-3 tw:pb-4">
        <div
          :class="[
            'tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lw-sm',
            modal.options.danger ? 'tw:bg-red-50 tw:text-red-500' : 'tw:bg-lw-subtle tw:text-lw-primary'
          ]"
        >
            <svg v-if="modal.options.danger" viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        </div>
        <h3 class="tw:m-0 tw:text-[length:var(--lw-type-title-large-size)] tw:font-bold tw:leading-[var(--lw-type-title-large-line-height)] tw:text-lw-text tw:text-balance">
          {{ modal.options.title }}
        </h3>
      </div>
      <div class="tw:pb-6">
        <p class="tw:m-0 tw:whitespace-pre-line tw:text-sm tw:leading-6 tw:text-lw-text-dim tw:text-pretty">{{ modal.options.message }}</p>
      </div>
      <div class="tw:flex tw:justify-end tw:gap-3">
        <LuminaButton variant="ghost" @click="modal.handleCancel">{{ modal.options.cancelText }}</LuminaButton>
        <LuminaButton :tone="modal.options.danger ? 'danger' : 'primary'" @click="modal.handleConfirm">
          {{ modal.options.confirmText }}
        </LuminaButton>
      </div>
    </LuminaModalShell>
  </transition>
</template>

<script setup lang="ts">
import { useModalStore } from '../../stores/useModalStore.js';
import { LuminaButton, LuminaModalShell } from '../../ui/primitives';

const modal = useModalStore();
</script>

<style scoped>
.lw-fade-scale-enter-active,
.lw-fade-scale-leave-active {
  transition: opacity 160ms ease-out, transform 160ms ease-out;
}

.lw-fade-scale-enter-from,
.lw-fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
