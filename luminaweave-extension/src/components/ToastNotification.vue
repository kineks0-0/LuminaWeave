<template>
    <div class="lw-toast-container">
        <transition-group name="toast-list">
            <div v-for="toast in toasts" :key="toast.id" class="lw-toast" :class="`toast-${toast.type}`">
                <div class="toast-icon" v-html="icons[toast.type] || icons.info"></div>
                <div class="toast-content">
                    <div class="toast-title" v-if="toast.title">{{ toast.title }}</div>
                    <div class="toast-message">{{ toast.message }}</div>
                </div>
                <button class="toast-close" @click="removeToast(toast.id)">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </transition-group>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface Toast {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration: number;
}

const toasts = ref<Toast[]>([]);
let toastIdCounter = 0;

const icons: Record<string, string> = {
    success: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    error: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    warning: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
};

const showToast = (event: Event) => {
    const customEvent = event as CustomEvent;
    const detail = customEvent.detail || {};
    const id = ++toastIdCounter;
    const toast: Toast = {
        id,
        type: detail.type || 'info', 
        title: detail.title || '',
        message: detail.message,
        duration: detail.duration !== undefined ? detail.duration : 3000
    };

    toasts.value.push(toast);

    if (toast.duration > 0) {
        setTimeout(() => {
            removeToast(id);
        }, toast.duration);
    }
};

const removeToast = (id: number) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index !== -1) {
        toasts.value.splice(index, 1);
    }
};

onMounted(() => {
    window.addEventListener('lw:toast', showToast);
});

onUnmounted(() => {
    window.removeEventListener('lw:toast', showToast);
});
</script>

<style scoped>
.lw-toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 100000;
    pointer-events: none;
}

.lw-toast {
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 320px;
    padding: 16px;
    border-radius: 12px;
    background: white;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
}

.lw-toast::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 4px;
}

.toast-success::before {
    background: #10b981;
}

.toast-success .toast-icon {
    color: #10b981;
}

.toast-error::before {
    background: #ef4444;
}

.toast-error .toast-icon {
    color: #ef4444;
}

.toast-warning::before {
    background: #f59e0b;
}

.toast-warning .toast-icon {
    color: #f59e0b;
}

.toast-info::before {
    background: var(--lw-blue);
}

.toast-info .toast-icon {
    color: var(--lw-blue);
}

.toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
}

.toast-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.toast-title {
    font-weight: 600;
    color: #111827;
    font-size: 14px;
}

.toast-message {
    color: #4b5563;
    font-size: 13px;
    line-height: 1.4;
}

.toast-close {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    margin: -4px;
    border-radius: 4px;
    display: flex;
    transition: 0.2s;
}

.toast-close:hover {
    background: #f3f4f6;
    color: #4b5563;
}

/* Transitions */
.toast-list-enter-active,
.toast-list-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-list-enter-from,
.toast-list-leave-to {
    opacity: 0;
    transform: translateX(30px) scale(0.95);
}

.toast-list-leave-active {
    position: absolute;
}
</style>
