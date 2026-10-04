/**
 * SillyTavern 全局对象访问器
 * 仅限 host-drivers/st 内部使用，严禁在核心层或业务层直接引用。
 */
export class STGlobalAccessor {
    /**
     * 初始化静默模式标志：设置为 true 时，探测失败不会向控制台打印 Warn/Error。
     */
    public static isSilenceMode: boolean = true;

    /** 获取运行宿主的全局变量空间 */
    static get stGlobal(): Window {
        if (typeof window !== 'undefined') {
            if ((window as any).SillyTavern) return window;
            try {
                if (window.parent && window.parent !== window && (window.parent as any).SillyTavern) {
                    return window.parent as any;
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof globalThis !== 'undefined' && (globalThis as any).SillyTavern) {
            return globalThis as any;
        }
        return (typeof window !== 'undefined' ? window : globalThis) as any;
    }

    /** 获取 SillyTavern 全局主 API 对象 */
    static get stMain(): Window['SillyTavern'] | undefined {
        const glob = this.stGlobal;
        return glob ? glob.SillyTavern : undefined;
    }

    /** 获取 TavernHelper 全局工具集对象 */
    static get stHelper(): typeof TavernHelper | undefined {
        const glob = this.stGlobal;
        return glob ? glob.TavernHelper : undefined;
    }

    /** 获取 SillyTavern 上下文镜像 */
    static get ctx(): typeof SillyTavern | undefined {
        const st = this.stMain;
        if (st && typeof st.getContext === 'function') {
            return st.getContext();
        }
        return st;
    }

    /** 获取标准化的 SillyTavern 事件源 */
    static get stEventSource(): typeof SillyTavern.eventSource | undefined {
        const core = this.ctx;
        const main = this.stMain;

        let source = core?.eventSource || main?.eventSource;
        if (!source) {
            const glob = this.stGlobal;
            if (glob && glob.eventSource) {
                source = glob.eventSource as any;
            }
        }

        if (source && typeof source.on !== 'function') {
            source = undefined;
        }
        return source;
    }

    /** 获取 SillyTavern 事件类型映射 */
    static get stEventTypes(): Record<string, string> | undefined {
        const core = this.ctx;
        const main = this.stMain;

        return core?.eventTypes || this.readLegacyEventTypes(core) || main?.eventTypes || this.readLegacyEventTypes(main);
    }

    /** 旧版宿主将事件类型映射暴露为 event_types，保留运行时兼容 */
    private static readLegacyEventTypes(value: unknown): Record<string, string> | undefined {
        const legacy = (value as { event_types?: unknown } | undefined)?.event_types;
        return legacy && typeof legacy === 'object' ? legacy as Record<string, string> : undefined;
    }

    /** 等待指定全局变量初始化完成 */
    static async waitForGlobal(key: string, timeoutMs: number = 15000): Promise<boolean> {
        const glob = this.stGlobal;
        if (!glob) return false;

        if ((glob as any)[key] !== undefined && (glob as any)[key] !== null) {
            return true;
        }

        return new Promise<boolean>((resolve) => {
            let resolved = false;
            let timeoutId: any = null;

            const finish = (result: boolean) => {
                if (resolved) return;
                resolved = true;
                if (timeoutId) clearTimeout(timeoutId);
                resolve(result);
            };

            const waitGlobalInit = glob.TavernHelper?.waitGlobalInitialized;

            if (typeof waitGlobalInit === 'function') {
                waitGlobalInit(key).then(() => finish(true)).catch(() => finish(false));
            } else {
                const intervalId = setInterval(() => {
                    if ((glob as any)[key] !== undefined && (glob as any)[key] !== null) {
                        clearInterval(intervalId);
                        finish(true);
                    }
                }, 100);
                setTimeout(() => clearInterval(intervalId), timeoutMs);
            }

            timeoutId = setTimeout(() => finish(false), timeoutMs);
        });
    }
}
