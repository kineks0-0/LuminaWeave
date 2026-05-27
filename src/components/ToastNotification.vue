<template>
    <div class="tw:fixed tw:right-[calc(24px+var(--lw-content-safe-right,var(--lw-safe-right,0px)))] tw:bottom-[calc(24px+var(--lw-content-safe-bottom,var(--lw-safe-bottom,0px)))] tw:z-50 tw:flex tw:pointer-events-none tw:flex-col tw:gap-3">
        <transition-group name="toast-list">
            <div v-for="toast in toasts" :key="toast.id" :class="toastClass(toast.type)">
                <div :class="iconClass(toast.type)" aria-hidden="true">
                    <svg v-if="toast.type === 'success'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <svg v-else-if="toast.type === 'error'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <svg v-else-if="toast.type === 'warning'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </div>
                <div class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
                    <div v-if="toast.title" class="tw:text-[length:var(--lw-type-title-small-size)] tw:font-bold tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text tw:text-balance">{{ toast.title }}</div>
                    <div class="tw:text-xs tw:leading-4 tw:text-lw-text-secondary tw:text-pretty">{{ toast.message }}</div>
                </div>
                <LuminaIconButton ariaLabel="关闭通知" size="sm" variant="ghost" @click="removeToast(toast.id)">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </LuminaIconButton>
            </div>
        </transition-group>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { LuminaIconButton } from '../ui/primitives';
import { cn } from '../ui/cn.js';

interface Toast {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration: number;
}

const toasts = ref<Toast[]>([]);
let toastIdCounter = 0;

const toneClass: Record<Toast['type'], string> = {
    success: 'tw:border-l-emerald-500',
    error: 'tw:border-l-red-500',
    warning: 'tw:border-l-amber-500',
    info: 'tw:border-l-lw-primary'
};

const toneIconClass: Record<Toast['type'], string> = {
    success: 'tw:text-emerald-500',
    error: 'tw:text-red-500',
    warning: 'tw:text-amber-500',
    info: 'tw:text-lw-primary'
};

const toastClass = (type: Toast['type']) => cn(
    'tw:pointer-events-auto tw:relative tw:flex tw:w-80 tw:items-start tw:gap-3 tw:overflow-hidden tw:rounded-lw-sm tw:border tw:border-l-4 tw:border-lw-border tw:bg-lw-elevated tw:p-4 tw:shadow-lw-card',
    toneClass[type] || toneClass.info
);

const iconClass = (type: Toast['type']) => cn(
    'tw:mt-0.5 tw:flex tw:shrink-0 tw:items-center tw:justify-center',
    toneIconClass[type] || toneIconClass.info
);

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
.toast-list-enter-active,
.toast-list-leave-active {
    transition: opacity 160ms ease-out, transform 160ms ease-out;
}

.toast-list-enter-from,
.toast-list-leave-to {
    opacity: 0;
    transform: translateX(20px) scale(0.98);
}

.toast-list-leave-active {
    position: absolute;
}
</style>
