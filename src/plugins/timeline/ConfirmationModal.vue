<template>
  <transition name="fade-scale">
    <div v-if="isOpen" class="confirm-overlay" @click="$emit('cancel')">
      <div class="confirm-window" @click.stop>
        <div class="confirm-header">
          <div class="icon-warning">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <h3>{{ title }}</h3>
        </div>
        <div class="confirm-body">
          <p>{{ message }}</p>
        </div>
        <div class="confirm-footer">
          <button class="btn-cancel" @click="$emit('cancel')">取消</button>
          <button class="btn-confirm" @click="$emit('confirm')">确定回滚</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
defineProps<{
  isOpen: boolean;
  title: string;
  message: string;
}>();

defineEmits(['confirm', 'cancel']);
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--lw-bg-mask);
  backdrop-filter: var(--lw-glass-blur);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.confirm-window {
  width: 100%;
  max-width: 400px;
  background: var(--lw-bg-surface);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--lw-shadow-hover);
  border: 1px solid var(--lw-border-base);
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.icon-warning {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  padding: 10px;
  border-radius: 12px;
  display: flex;
}

.confirm-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.confirm-body p {
  margin: 0;
  font-size: 14px;
  color: var(--lw-text-dim);
  line-height: 1.6;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

button {
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: var(--lw-bg-app);
  color: var(--lw-text-main);
}

.btn-cancel:hover {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
}

.btn-confirm {
  background: #ef4444;
  color: white;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
}

.btn-confirm:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

.btn-confirm:active {
  transform: scale(0.98);
}

/* Animations */
.fade-scale-enter-active, .fade-scale-leave-active { transition: all 0.3s ease; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; transform: scale(0.95); }
</style>
