<template>
  <transition name="lw-fade-scale">
    <div v-if="modal.isOpen" class="lw-modal-overlay" @click="modal.handleCancel">
      <div class="lw-modal-content" @click.stop>
        <div class="lw-modal-header">
          <div class="header-icon" :class="{ 'is-danger': modal.options.danger }">
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
          <h3 class="header-title">{{ modal.options.title }}</h3>
        </div>
        <div class="lw-modal-body">
          <p class="body-message">{{ modal.options.message }}</p>
        </div>
        <div class="lw-modal-footer">
          <button class="lw-btn lw-btn-ghost" @click="modal.handleCancel">{{ modal.options.cancelText }}</button>
          <button class="lw-btn" :class="modal.options.danger ? 'lw-btn-danger' : 'lw-btn-primary'" @click="modal.handleConfirm">
            {{ modal.options.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useModalStore } from '../../stores/useModalStore';

const modal = useModalStore();
</script>

<style scoped>
.lw-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--lw-bg-mask, rgba(0, 0, 0, 0.4));
  backdrop-filter: var(--lw-glass-blur, blur(8px));
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lw-modal-content {
  width: 100%;
  max-width: 400px;
  background: var(--lw-bg-surface, #ffffff);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--lw-border-base, #eeeeee);
}

.lw-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.header-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(var(--lw-primary-rgb, 99, 102, 241), 0.1);
  color: var(--lw-primary, #6366f1);
}

.header-icon.is-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.header-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--lw-text-main, #111111);
}

.lw-modal-body {
  margin-bottom: 24px;
}

.body-message {
  margin: 0;
  font-size: 14px;
  color: var(--lw-text-dim, #666666);
  line-height: 1.6;
  white-space: pre-line;
}

.lw-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.lw-btn-danger {
  background: #ef4444;
  color: white;
}

.lw-btn-danger:hover {
  background: #dc2626;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
}

/* Animations */
.lw-fade-scale-enter-active,
.lw-fade-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.lw-fade-scale-enter-from,
.lw-fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
