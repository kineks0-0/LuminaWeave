export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ModalOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
}

export type HostConfirmHandler = (options: string | ModalOptions) => Promise<boolean>;

interface ToastrLike {
    success?: (message: string, title?: string, options?: { timeOut?: number }) => void;
    error?: (message: string, title?: string, options?: { timeOut?: number }) => void;
    warning?: (message: string, title?: string, options?: { timeOut?: number }) => void;
    info?: (message: string, title?: string, options?: { timeOut?: number }) => void;
}

export class HostInteractionService {
    private confirmHandler: HostConfirmHandler | null = null;

    /** 组合根在 Pinia 安装后注册确认弹窗端口；未注册时 confirm 返回 false。 */
    setConfirmHandler(handler: HostConfirmHandler | null): void {
        this.confirmHandler = handler;
    }

    showToast(message: string, type: ToastType = 'info', title?: string, duration: number = 3000): void {
        console.log(`[LuminaWeave Toast] ${type.toUpperCase()}: ${message}`);
        const toastr = (globalThis as { window?: { toastr?: ToastrLike } }).window?.toastr;
        toastr?.[type]?.(message, title, { timeOut: duration });
    }

    async confirm(opt: string | ModalOptions): Promise<boolean> {
        if (!this.confirmHandler) {
            console.warn('[LuminaWeave] Confirm handler not registered; returning false.');
            return false;
        }
        return await this.confirmHandler(opt);
    }
}
