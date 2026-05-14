/**
 * 宿主环境探测器
 * 仅用于识别当前运行所在的物理宿主类型及其核心能力。
 * 不提供具体的宿主对象访问。
 */
export class HostDetector {
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

    /** 探测是否运行在 SillyTavern (插件模式) */
    static get isSillyTavern(): boolean {
        const glob = this.globalScope;
        return !!(glob && (glob.SillyTavern || glob.TavernHelper));
    }

    /** 探测是否运行在 TauriTavern (原生增强模式) */
    static get isTauriTavern(): boolean {
        const glob = this.globalScope;
        if (!glob) return false;

        // 1. 优先检查官方推荐的早期环境标记
        if (glob.__TAURI_RUNNING__ === true) return true;

        // 2. 检查命名空间
        const hasBridge = !!(glob.__TAURITAVERN__ || glob.__TAURI__);

        // 3. 检查具体的调用能力
        const hasInvoke = typeof glob.invoke === 'function' ||
                          (glob.__TAURI__?.core && typeof glob.__TAURI__.core.invoke === 'function') ||
                          (glob.__TAURITAVERN__ && (typeof glob.__TAURITAVERN__.invoke === 'function' || typeof glob.__TAURITAVERN__.invoke?.safeInvoke === 'function'));

        return hasBridge || hasInvoke;
    }

    /** 探测是否为安卓系统 */
    static get isAndroid(): boolean {
        if (typeof navigator === 'undefined') return false;
        return /Android/i.test(navigator.userAgent);
    }

    /** 探测是否为独立模式 (无已知宿主) */
    static get isStandalone(): boolean {
        return !this.isSillyTavern && !this.isTauriTavern;
    }
}
