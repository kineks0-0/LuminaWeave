import type { IEventBridge } from '../interfaces.js';

/**
 * 通用事件桥接基类：管理领域事件订阅表，宿主事件绑定由子类实现。
 */
export abstract class EventBridgeBase implements IEventBridge {
    private handlers = new Map<string, Array<(...args: any[]) => void>>();

    abstract bindHostEvents(): void;
    abstract unbindHostEvents(): void;

    on(event: string, callback: (...args: any[]) => void): void {
        const handlers = this.handlers.get(event) || [];
        handlers.push(callback);
        this.handlers.set(event, handlers);
    }

    off(event: string, callback: (...args: any[]) => void): void {
        const handlers = this.handlers.get(event);
        if (handlers) {
            this.handlers.set(event, handlers.filter(handler => handler !== callback));
        }
    }

    emit(event: string, ...args: any[]): void {
        const handlers = this.handlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(...args));
        }
    }
}
