import type {
    IMacroResolver,
    ISessionIdNormalizer,
    IEventBridge,
    IHostStorage,
    IHostNetwork,
    IHostResourceProvider,
    IBootstrapStorage,
    ITokenCounter
} from './interfaces.js';
import { DefaultTokenCounter } from './defaults/DefaultTokenCounter.js';
import type { HALRuntimeMode, HALRuntimePorts } from '@shared/api/HALRuntimePorts.js';

/**
 * HAL 运行时上下文
 * 持有所有注入的宿主能力 Provider 实例
 */
export class HALContext {
    private static _instance: HALContext | null = null;
    private _runtime: HALRuntimePorts | null = null;

    /**
     * 获取当前 HAL 上下文实例
     */
    static get instance(): HALContext {
        if (!this._instance) {
            throw new Error('[HALContext] HALContext not initialized. Make sure HALBootstrap.init() is called.');
        }
        return this._instance;
    }

    /**
     * 设置 HAL 上下文实例
     */
    static set instance(value: HALContext) {
        this._instance = value;
    }

    get runtime(): HALRuntimePorts {
        if (!this._runtime) {
            throw new Error('[HALContext] Runtime ports not initialized. Make sure HALBootstrap.init() is called.');
        }
        return this._runtime;
    }

    set runtime(value: HALRuntimePorts) {
        this._runtime = value;
    }

    get runtimeMode(): HALRuntimeMode {
        return this.runtime.mode;
    }

    constructor(
        /** 宏替换能力 */
        public readonly macroResolver: IMacroResolver,
        /** 会话 ID 规范化能力 */
        public readonly sessionIdNormalizer: ISessionIdNormalizer,
        /** 事件总线桥接能力 */
        public readonly eventBridge: IEventBridge,
        /** 基础 KV 存储能力 */
        public readonly storage: IHostStorage,
        /** 网络与生成网关能力 */
        public readonly network: IHostNetwork,
        /** 宿主资源 Provider */
        public readonly resourceProvider: IHostResourceProvider,
        /** 引导存储能力 */
        public readonly bootstrapStorage: IBootstrapStorage,
        /** Token 计数能力 */
        public readonly tokenCounter: ITokenCounter = new DefaultTokenCounter()
    ) {}
}
