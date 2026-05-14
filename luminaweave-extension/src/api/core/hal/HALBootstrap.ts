import { HostDetector } from '../host-drivers/HostDetector.js';
import { HALContext } from './HALContext.js';

/**
 * HAL 启动编排器
 * 负责探测环境、注入 Provider 并建立运行时上下文
 */
export class HALBootstrap {
    private static _initialized = false;
    private static _initPromise: Promise<void> | null = null;
    private static _lastProgress: string = '';

    /**
     * 执行 HAL 初始化
     * 会在系统最早期的引导阶段被 LuminaWeaveAPI 调用
     */
    public static async init(options: { onProgress?: (msg: string) => void } = {}): Promise<void> {
        if (this._initialized) {
            if (this._lastProgress) options.onProgress?.(this._lastProgress);
            return;
        }

        if (this._initPromise) {
            // 如果正在初始化，附加上新的进度监听（通过一个包装函数）
            const originalOnProgress = options.onProgress;
            if (originalOnProgress && this._lastProgress) {
                originalOnProgress(this._lastProgress);
            }
            return this._initPromise;
        }

        this._initPromise = (async () => {
            const reportProgress = (msg: string) => {
                this._lastProgress = msg;
                options.onProgress?.(msg);
            };

            console.log('[HALBootstrap] Starting host detection...');
            reportProgress('探测宿主环境...');

        // 1. 探测宿主环境
        // 探测优先级：TauriTavern (Native) > SillyTavern (Plugin) > Standalone
        const childOptions = { onProgress: reportProgress };
        if (HostDetector.isTauriTavern) {
            console.log('[HALBootstrap] TauriTavern detected. Injecting Tauri providers.');
            await this.initTauriHost(childOptions);
        } else if (HostDetector.isSillyTavern) {
            console.log('[HALBootstrap] SillyTavern detected. Injecting ST providers.');
            await this.initSTHost(childOptions);
        } else {
            console.log('[HALBootstrap] Standalone mode detected. Injecting default providers.');
            await this.initStandaloneHost(childOptions);
        }

        this._initialized = true;

        // 2. 启动事件总线桥接
        reportProgress('启动事件桥接...');
        HALContext.instance.eventBridge.bindHostEvents();

        console.log('[HALBootstrap] HAL initialization complete.');
        reportProgress('HAL 初始化完成');
        })();
        return this._initPromise;
    }

    /**
     * 初始化 SillyTavern 宿主实现
     */
    private static async initSTHost(options: { onProgress?: (msg: string) => void }): Promise<void> {
        options.onProgress?.('加载 ST 宿主驱动...');

        const { registerSTRuntimePorts } = await import('./adapters/st/STRuntimePortRegistration.js');
        registerSTRuntimePorts();

        const { STHostProvider } = await import('./adapters/st/STHostProvider.js');
        HALContext.instance = new STHostProvider().createContext();

        // 执行环境等待 (TavernHelper 探测)
        const { getHostRuntimePort } = await import('../facade/HostRuntimePort.js');
        await getHostRuntimePort().waitForReady({
            onProgress: options.onProgress
        });
    }

    /**
     * 初始化 TauriTavern (Android/Native) 宿主实现
     */
    private static async initTauriHost(options: { onProgress?: (msg: string) => void }): Promise<void> {
        options.onProgress?.('加载 Tauri 宿主驱动...');
        const { registerLocalResourceSource } = await import('./adapters/standalone/LocalResourceSourceProvider.js');
        registerLocalResourceSource();
        const { TauriHostProvider } = await import('./adapters/tauri/TauriHostProvider.js');
        HALContext.instance = new TauriHostProvider().createContext();
    }

    /**
     * 初始化独立/兜底宿主实现
     */
    private static async initStandaloneHost(options: { onProgress?: (msg: string) => void }): Promise<void> {
        options.onProgress?.('初始化独立运行环境...');

        const { registerStandaloneRuntimePorts } = await import('./adapters/standalone/StandaloneRuntimePortRegistration.js');
        registerStandaloneRuntimePorts();

        const { StandaloneHostProvider } = await import('./adapters/standalone/StandaloneHostProvider.js');
        HALContext.instance = new StandaloneHostProvider().createContext();
    }
}
