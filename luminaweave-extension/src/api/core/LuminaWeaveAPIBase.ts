import { EnvDetector } from './EnvDetector.js';
import { EventFlow } from '../../../../shared/EventFlow.js';

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

    /** 
     * 自动获取并解析 SillyTavern 上下文镜像 (ctx)
     * 
     * 注意：
     * 1. 该 getter 返回的是 SillyTavern.getContext() 的结果，代表当前时刻的【数据快照】。
     * 2. 快照包含：chat (消息列表), characters (角色列表), user (用户信息), characterId 等。
     * 3. 这里的 ctx 【不一定】包含 generate/regenerate 等核心 API 函数。
     * 4. 如果需要调用 ST 的控制函数，应直接访问 stMain。
     */
    protected get ctx(): typeof SillyTavern | undefined {
        return EnvDetector.ctx;
    }

    /** 获取 SillyTavern 全局 API 对象 (容器/管理器) */
    protected get stMain(): typeof SillyTavern | undefined {
        return EnvDetector.stMain;
    }

    /** 获取 TavernHelper 全局工具集对象 */
    protected get stHelper(): typeof TavernHelper | undefined {
        return EnvDetector.stHelper;
    }

    /** 
     * 获取标准化的 SillyTavern 事件源 (EventEmitter)
     * 探测优先级：Context > Main API > Window (全局)
     */
    protected get stEventSource(): any | undefined {
        return EnvDetector.stEventSource;
    }

    /** 
     * 获取 SillyTavern 事件类型映射
     * 兼容性：eventTypes (新版) / event_types (旧版)
     */
    protected get stEventTypes(): any | undefined {
        return EnvDetector.stEventTypes;
    }

    public async waitForEnvironment(timeout: number = 10000): Promise<boolean> {
        const startTime = Date.now();
        console.log('[LuminaWeave] 等待环境就绪 (ST, EventSource, Helper)...');
        this.emit('INIT_PROGRESS', '等待 TavernHelper 就绪...');

        // 1. 同步阻塞等待：确保 TavernHelper 实体通过 JS-Slash-Runner 回调完成就绪
        const helperReady = await EnvDetector.waitForGlobal('TavernHelper', timeout);
        if (!helperReady) {
            console.warn('[LuminaWeave] 等待 TavernHelper 超时！获取世界书或 API 数据可能受限或为空。');
            this.emit('INIT_PROGRESS', '等待 TavernHelper 超时');
        } else {
            console.log('[LuminaWeave] TavernHelper 已成功就绪。');
            this.emit('INIT_PROGRESS', 'TavernHelper 已就绪');
        }

        this.emit('INIT_PROGRESS', '等待 ST 核心环境就绪...');
        // 2. 检查其余变量 (SillyTavern Core 等) 的加载状态
        return new Promise((resolve) => {
            const check = () => {
                const hasST = !!this.ctx;
                const hasEventSource = !!this.stEventSource;
                const hasHelper = !!this.stHelper;

                if (hasST && hasEventSource && hasHelper) {
                    console.log('[LuminaWeave] 环境就绪检测通过:');
                    this.emit('INIT_PROGRESS', '环境就绪检测通过');
                    resolve(true);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    console.warn('[LuminaWeave] 环境探测超时，部分功能可能受限:', {
                        hasST, hasEventSource, hasHelper
                    });
                    this.emit('INIT_PROGRESS', '环境探测超时');
                    resolve(false);
                    return;
                }

                setTimeout(check, 100);
            };
            check();
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
