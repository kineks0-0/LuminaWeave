import { useModalStore, type ModalOptions } from '../../stores/useModalStore';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastrLike {
    success?: (message: string, title?: string, options?: { timeOut?: number }) => void;
    error?: (message: string, title?: string, options?: { timeOut?: number }) => void;
    warning?: (message: string, title?: string, options?: { timeOut?: number }) => void;
    info?: (message: string, title?: string, options?: { timeOut?: number }) => void;
}

export class HostInteractionService {
    showToast(message: string, type: ToastType = 'info', title?: string, duration: number = 3000): void {
        console.log(`[LuminaWeave Toast] ${type.toUpperCase()}: ${message}`);
        const toastr = (globalThis as { window?: { toastr?: ToastrLike } }).window?.toastr;
        toastr?.[type]?.(message, title, { timeOut: duration });
    }

    async confirm(opt: string | ModalOptions): Promise<boolean> {
        const modal = useModalStore();
        return await modal.confirm(opt);
    }
}

export type { ModalOptions };
