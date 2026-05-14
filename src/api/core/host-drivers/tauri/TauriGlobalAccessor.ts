/**
 * TauriTavern 原生环境访问器
 * 负责在 Tauri 模式下获取原生 Bridge 和 Invoke 能力。
 * 仅限 host-drivers/tauri 内部使用。
 */
export class TauriGlobalAccessor {
    /** 获取运行宿主的全局变量空间 */
    private static get globalScope(): any {
        if (typeof window !== 'undefined') {
            if ((window as any).SillyTavern) return window;
            try {
                if (window.parent && window.parent !== window && (window.parent as any).SillyTavern) {
                    return window.parent;
                }
            } catch (e) { /* ignore */ }
        }
        return typeof window !== 'undefined' ? window : globalThis;
    }

    /** 获取通用的 Tauri 桥接对象 (__TAURITAVERN__ 或 __TAURI__) */
    static get tauriBridge(): any {
        const glob = this.globalScope;
        if (!glob) return undefined;
        return glob.__TAURITAVERN__ || glob.__TAURI__;
    }

    /** 获取原生就绪信号 Promise */
    static get tauriReady(): Promise<void> | undefined {
        const glob = this.globalScope;
        if (!glob) return undefined;
        // 优先使用官方推荐的 ABI 入口，降级使用旧版就绪标记
        return glob.__TAURITAVERN__?.ready || glob.__TAURITAVERN_MAIN_READY__;
    }

    /** 获取可用的 Tauri Invoke 函数 */
    static get tauriInvoke(): Function | undefined {
        const glob = this.globalScope;
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
