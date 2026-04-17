import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ModalOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
}

/**
 * useModalStore
 * 统一管理全局异步确认弹窗，解决特定环境下 window.confirm 被禁用的问题
 */
export const useModalStore = defineStore('modal', () => {
    const isOpen = ref(false);
    const options = ref<ModalOptions>({
        title: '确认',
        message: '',
        confirmText: '确定',
        cancelText: '取消',
        danger: false
    });

    let _resolve: ((value: boolean) => void) | null = null;

    const confirm = (opt: string | ModalOptions): Promise<boolean> => {
        if (typeof opt === 'string') {
            options.value = {
                title: '确认',
                message: opt,
                confirmText: '确定',
                cancelText: '取消',
                danger: false
            };
        } else {
            options.value = {
                title: opt.title || '确认',
                message: opt.message,
                confirmText: opt.confirmText || '确定',
                cancelText: opt.cancelText || '取消',
                danger: !!opt.danger
            };
        }

        isOpen.value = true;

        return new Promise<boolean>((resolve) => {
            _resolve = resolve;
        });
    };

    const handleConfirm = () => {
        isOpen.value = false;
        if (_resolve) {
            _resolve(true);
            _resolve = null;
        }
    };

    const handleCancel = () => {
        isOpen.value = false;
        if (_resolve) {
            _resolve(false);
            _resolve = null;
        }
    };

    return {
        isOpen,
        options,
        confirm,
        handleConfirm,
        handleCancel
    };
});
