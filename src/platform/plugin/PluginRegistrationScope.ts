export type RegistrationDisposer = () => void;

/** 插件注册的撤销句柄；dispose 后该插件做出的全部注册都被撤销。 */
export interface RegistrationHandle {
    readonly pluginId: string;
    dispose(): void;
}

const runDisposer = (pluginId: string, disposer: RegistrationDisposer): void => {
    try {
        disposer();
    } catch (error) {
        console.error(`[PluginRegistrationScope] Failed to dispose a registration of plugin ${pluginId}:`, error);
    }
};

/**
 * 插件注册作用域（ADR-0005 决策 11）：插件的每项注册登记一个撤销函数，
 * 卸载或加载失败时按相反顺序全部撤销；单个撤销函数抛错不阻断其余撤销。
 */
export class PluginRegistrationScope {
    private readonly disposers: RegistrationDisposer[] = [];
    private disposed = false;

    constructor(readonly pluginId: string) {}

    get isDisposed(): boolean {
        return this.disposed;
    }

    get size(): number {
        return this.disposers.length;
    }

    add(disposer: RegistrationDisposer): void {
        // 作用域已撤销时，迟到的注册立即撤销，避免留下无主注册。
        if (this.disposed) {
            runDisposer(this.pluginId, disposer);
            return;
        }
        this.disposers.push(disposer);
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (let disposer = this.disposers.pop(); disposer; disposer = this.disposers.pop()) {
            runDisposer(this.pluginId, disposer);
        }
    }
}
