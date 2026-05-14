import { EventFlow } from '@shared/EventFlow.js';
import { getHostRuntimePort } from './HostRuntimePort.js';

export interface BeforeGenerationPayload {
    chatId: string;
    chatType: 'st' | 'plugin';
    text?: string;
}

/**
 * LuminaWeaveAPI 核心基类
 * 负责事件分发与基础状态维护
 */
export class LuminaWeaveAPIBase {
    protected _events: Record<string, Function[]>;

    // 生成前的统一阻塞等待生命周期流
    public readonly beforeGenerationStartFlow = new EventFlow<BeforeGenerationPayload>();

    /** 核心消息更新流 (取代旧 MESSAGE_RECEIVED)，支持异步监听并阻塞等待同步完成 */
    public readonly messageReceivedFlow = new EventFlow<void>();

    constructor() {
        this._events = {};
    }

    public async waitForEnvironment(timeout: number = 10000): Promise<boolean> {
        return getHostRuntimePort().waitForReady({
            timeoutMs: timeout,
            onProgress: (message) => this.emit('INIT_PROGRESS', message)
        });
    }

    on(event: string, callback: Function): void {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(callback);
    }

    off(event: string, callback: Function): void {
        if (!this._events[event]) return;
        this._events[event] = this._events[event].filter(cb => cb !== callback);
    }

    emit(event: string, ...args: any[]): void {
        if (!this._events[event]) return;
        this._events[event].forEach(callback => callback(...args));
    }
}
