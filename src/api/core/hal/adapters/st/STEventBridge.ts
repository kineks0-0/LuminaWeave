import { EventBridgeBase } from '../EventBridgeBase.js';
import { STGlobalAccessor } from '../../../host-drivers/st/STGlobalAccessor.js';

/**
 * SillyTavern 宿主的事件桥接实现
 * 负责将 ST 的原生 EventEmitter 事件转发为 Lumina 标准领域事件
 */
export class STEventBridge extends EventBridgeBase {
    private hostListeners: { event: string; handler: Function }[] = [];

    bindHostEvents(): void {
        const source = STGlobalAccessor.stEventSource;
        const types = STGlobalAccessor.stEventTypes;
        if (!source || !types) {
            console.warn('[STEventBridge] Failed to bind host events: stEventSource or stEventTypes not found.');
            return;
        }

        const forward = (hostEvent: string, domainEvent: string) => {
            if (!hostEvent) return;
            const handler = (...args: any[]) => this.emit(domainEvent, ...args);
            source.on(hostEvent, handler);
            this.hostListeners.push({ event: hostEvent, handler });
        };

        // 核心聊天生命周期事件映射
        forward(types.CHAT_CHANGED, 'CHAT_CHANGED');
        forward(types.CHAT_CREATED, 'CHAT_CREATED');
        forward(types.CHAT_DELETED, 'CHAT_DELETED');
        forward(types.DATA_RELOAD, 'DATA_RELOAD');
        forward(types.MESSAGE_RECEIVED, 'MESSAGE_RECEIVED');

        // 映射 Lumina 扩展事件名 (兼容性处理)
        const extendedTypes = types as any;
        if (extendedTypes.TIMELINE_UPDATED) forward(extendedTypes.TIMELINE_UPDATED, 'TIMELINE_UPDATED');
        if (extendedTypes.WORLDLINE_SWITCHED) forward(extendedTypes.WORLDLINE_SWITCHED, 'WORLDLINE_SWITCHED');
        if (extendedTypes.WORLDLINE_ROLLED_BACK) forward(extendedTypes.WORLDLINE_ROLLED_BACK, 'WORLDLINE_ROLLED_BACK');
    }

    unbindHostEvents(): void {
        const source = STGlobalAccessor.stEventSource;
        if (!source) return;

        this.hostListeners.forEach(({ event, handler }) => {
            if (typeof (source as any).removeListener === 'function') {
                (source as any).removeListener(event, handler);
            } else if (typeof (source as any).off === 'function') {
                (source as any).off(event, handler);
            }
        });
        this.hostListeners = [];
    }
}
