/**
 * 环境探测工具
 * 专门用于在复杂的嵌套环境（如 iframe 隔离）和不同的上下文（Shadow DOM等）中探测宿主环境对象。
 */
export class EnvDetector {
    /** 
     * 初始化静默模式标志：设置为 true 时，探测失败不会向控制台打印 Warn/Error。
     * 用于解决冷启动时环境尚未就绪导致的日志爆炸。
     */
    public static isSilenceMode: boolean = true;

    /** 获取运行宿主的全局变量空间 (用于读取 ST 注入在 window/globalThis 的零散变量) */
    static get stGlobal(): any {
        if (typeof window !== 'undefined') {
            if ((window as any).SillyTavern) return window;
            try {
                if (window.parent && window.parent !== window && (window.parent as any).SillyTavern) {
                    return window.parent;
                }
            } catch (e) {
                // 跨域策略拦截，忽略
            }
        }
        if (typeof globalThis !== 'undefined' && (globalThis as any).SillyTavern) {
            return globalThis;
        }
        return typeof window !== 'undefined' ? window : globalThis;
    }

    /**
     * 等待指定全局变量初始化完成（支持 JS-Slash-Runner 的异步机制）
     */
    static async waitForGlobal(key: string, timeoutMs: number = 15000): Promise<boolean> {
        const glob = this.stGlobal;
        if (!glob) return false;

        // 1. 如果变量已明确存在，则直接返回
        if (glob[key] !== undefined && glob[key] !== null) {
            return true;
        }

        // 2. 否则进行异步等待
        return new Promise<boolean>((resolve) => {
            let resolved = false;
            let timeoutId: any = null;

            const finish = (result: boolean) => {
                if (resolved) return;
                resolved = true;
                if (timeoutId) clearTimeout(timeoutId);
                resolve(result);
            };

            // 如果宿主环境中注入了可用的 waitGlobalInitialized（通常由 TavernHelper 本身提供），优先尝试利用它
            // 注意：当 key 就是 'TavernHelper' 时，TavernHelper 还没加载，一定找不到这个方法，自然优雅降级到轮询
            const waitGlobalInit = (glob.TavernHelper as typeof TavernHelper)?.waitGlobalInitialized;

            if (typeof waitGlobalInit === 'function') {
                if (!this.isSilenceMode) console.log(`[EnvDetector] 使用 TavernHelper 提供的 waitGlobalInitialized API 等待 ${key}`);
                waitGlobalInit(key).then(() => finish(true)).catch(() => finish(false));
            } else {
                // 降级：原生 JavaScript 的 window 对象没有提供监听特定全局变量创建的 Hook 机制。
                // 除非强行劫持 window.defineProperty，否则 100ms 一次的轻量轮询 (setInterval) 是业界最安全、跨浏览器且非侵入式的一致性解决方案。
                if (!this.isSilenceMode) console.log(`[EnvDetector] 使用标准轮询等待 ${key}`);
                const intervalId = setInterval(() => {
                    if (glob[key] !== undefined && glob[key] !== null) {
                        clearInterval(intervalId);
                        finish(true);
                    }
                }, 100);
                setTimeout(() => clearInterval(intervalId), timeoutMs);
            }

            // 超时保护
            timeoutId = setTimeout(() => {
                finish(false);
            }, timeoutMs);
        });
    }

    /** 获取 SillyTavern 全局主 API 对象 */
    static get stMain(): typeof SillyTavern | undefined {
        // 1. 尝试直接访问全局变量 (支持直接注入或已声明环境)
        if (typeof SillyTavern !== 'undefined') return SillyTavern;
        // 2. 依托全局空间探测
        const glob = this.stGlobal;
        return glob ? (glob.SillyTavern as typeof SillyTavern) : undefined;
    }

    /** 获取 TavernHelper 全局工具集对象 */
    static get stHelper(): typeof TavernHelper | undefined {
        // 1. 尝试直接访问全局变量
        if (typeof TavernHelper !== 'undefined') return TavernHelper;
        // 2. 依托全局空间探测
        const glob = this.stGlobal;
        return glob ? (glob.TavernHelper as typeof TavernHelper) : undefined;
    }

    /** 获取 SillyTavern 上下文镜像 */
    static get ctx(): typeof SillyTavern | undefined {
        const st = this.stMain;
        if (st && typeof (st as any).getContext === 'function') {
            return (st as any).getContext();
        }
        return st;
    }

    /** 
     * 获取标准化的 SillyTavern 事件源 (EventEmitter)
     * 探测优先级：Context > Main API > Global
     */
    static get stEventSource(): { on: Function; emit: Function; removeListener: Function } | undefined {
        const core = this.ctx as any;
        const main = this.stMain as any;

        let source = core?.eventSource || main?.eventSource;
        if (!source) {
            const glob = this.stGlobal;
            if (glob && glob.eventSource) {
                source = glob.eventSource;
            }
        }

        // 验证是否为 EventEmitter (具备 .on 方法)
        if (source && typeof (source as any).on !== 'function') {
            source = undefined;
        }
        return source as any;
    }

    /** 
     * 获取 SillyTavern 事件类型映射
     * 兼容性：eventTypes (新版) / event_types (旧版)
     */
    static get stEventTypes(): Record<string, string> | undefined {
        const core = this.ctx as any;
        const main = this.stMain as any;

        let types = core?.eventTypes || core?.event_types || main?.eventTypes || main?.event_types;
        if (!types) {
            const glob = this.stGlobal;
            if (glob && (glob.eventTypes || glob.event_types)) {
                types = glob.eventTypes || glob.event_types;
            }
        }

        return types;
    }

    /** 探测是否运行在 TauriTavern 或标准 Tauri 环境 */
    static get isTauriTavern(): boolean {
        const glob = this.stGlobal;
        if (!glob) return false;
        
        // 1. 优先检查官方推荐的早期环境标记
        if (glob.__TAURI_RUNNING__ === true) return true;

        // 2. 检查命名空间
        const hasBridge = !!(glob.__TAURITAVERN__ || glob.__TAURI__);

        // 3. 检查具体的调用能力
        const hasInvoke = typeof glob.invoke === 'function' || 
                          (glob.__TAURI__?.core && typeof glob.__TAURI__.core.invoke === 'function') ||
                          (glob.__TAURITAVERN__ && (typeof glob.__TAURITAVERN__.invoke === 'function' || typeof glob.__TAURITAVERN__.invoke?.safeInvoke === 'function'));
        
        console.log('[EnvDetector] TauriTavern hasBridge:', hasBridge);
        console.log('[EnvDetector] TauriTavern hasInvoke:', hasInvoke);
        return hasBridge || hasInvoke;
    }

    /** 探测是否为安卓系统 (通常在 Tauri 环境下) */
    static get isAndroid(): boolean {
        if (typeof navigator === 'undefined') return false;
        return /Android/i.test(navigator.userAgent);
    }

    /** 获取通用的 Tauri 桥接对象 */
    static get tauriBridge(): any {
        const glob = this.stGlobal;
        if (!glob) return undefined;
        return glob.__TAURITAVERN__ || glob.__TAURI__;
    }

    /** 获取就绪信号 Promise */
    static get tauriReady(): Promise<void> | undefined {
        const glob = this.stGlobal;
        if (!glob) return undefined;
        // 优先使用官方推荐的 ABI 入口，降级使用旧版就绪标记
        return glob.__TAURITAVERN__?.ready || glob.__TAURITAVERN_MAIN_READY__;
    }

    /** 获取可用的 Tauri Invoke 函数 */
    static get tauriInvoke(): Function | undefined {
        const glob = this.stGlobal;
        if (!glob) return undefined;

        // 探测优先级：
        // 1. __TAURITAVERN__.invoke.safeInvoke (官方推荐的稳定 ABI 路径)
        if (typeof glob.__TAURITAVERN__?.invoke?.safeInvoke === 'function') {
            return glob.__TAURITAVERN__.invoke.safeInvoke.bind(glob.__TAURITAVERN__.invoke);
        }

        // 2. 传统的多路径探测 (兼容标准 Tauri 1.x / 2.x)
        const bridges = [glob.__TAURITAVERN__, glob.__TAURI__, (typeof window !== 'undefined' ? window : null)];
        
        for (const b of bridges) {
            if (!b) continue;
            
            // 路径 A: 直接方法 (Tauri 1.0 或自定义 Bridge)
            if (typeof (b as any).invoke === 'function') return (b as any).invoke.bind(b);
            
            // 路径 B: 核心组件方法 (Tauri 2.0 标准)
            if ((b as any).core && typeof (b as any).core.invoke === 'function') {
                return (b as any).core.invoke.bind((b as any).core);
            }
        }
        return undefined;
    }
}
