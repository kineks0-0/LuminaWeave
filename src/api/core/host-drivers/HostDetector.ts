/**
 * 宿主环境探测器
 * 仅用于识别当前运行所在的物理宿主类型及其核心能力。
 * 不提供具体的宿主对象访问。
 */
export type RuntimeEnvelope = 'plugin-hosted' | 'standalone-app';

export type PhysicalHost = 'sillytavern' | 'tauritavern' | 'generic-tauri' | 'web';

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

        const hasTauriTavernNamespace = !!glob.__TAURITAVERN__;
        const hasTauriTavernReady = !!glob.__TAURITAVERN_MAIN_READY__;
        const hasTauriTavernInvoke = !!(
            glob.__TAURITAVERN__ &&
            (
                typeof glob.__TAURITAVERN__.invoke === 'function' ||
                typeof glob.__TAURITAVERN__.invoke?.safeInvoke === 'function'
            )
        );

        return hasTauriTavernNamespace || hasTauriTavernReady || hasTauriTavernInvoke;
    }

    /** 探测是否运行在普通 Tauri App，而不是 TauriTavern 宿主 */
    static get isGenericTauriApp(): boolean {
        const glob = this.globalScope;
        if (!glob || this.isTauriTavern) return false;

        const hasTauriRunningMarker = glob.__TAURI_RUNNING__ === true;
        const hasTauriNamespace = !!glob.__TAURI__;
        const hasTauriInvoke = !!(
            typeof glob.invoke === 'function' ||
            typeof glob.__TAURI__?.core?.invoke === 'function'
        );

        return hasTauriRunningMarker || hasTauriNamespace || hasTauriInvoke;
    }

    /** 运行在 ST / TauriTavern 这类插件宿主内 */
    static get isPluginHosted(): boolean {
        return this.isSillyTavern || this.isTauriTavern;
    }

    /** 运行为独立 Web / 普通 Tauri 客户端 */
    static get isStandaloneApp(): boolean {
        return !this.isPluginHosted;
    }

    static get runtimeEnvelope(): RuntimeEnvelope {
        return this.isPluginHosted ? 'plugin-hosted' : 'standalone-app';
    }

    static get physicalHost(): PhysicalHost {
        if (this.isTauriTavern) return 'tauritavern';
        if (this.isSillyTavern) return 'sillytavern';
        if (this.isGenericTauriApp) return 'generic-tauri';
        return 'web';
    }

    /** 探测是否为安卓系统 */
    static get isAndroid(): boolean {
        if (typeof navigator === 'undefined') return false;
        return /Android/i.test(navigator.userAgent);
    }

    /** 探测是否为独立模式 (无已知宿主) */
    static get isStandalone(): boolean {
        return this.isStandaloneApp;
    }
}
