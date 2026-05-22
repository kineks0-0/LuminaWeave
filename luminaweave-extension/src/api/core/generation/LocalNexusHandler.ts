import type {
    RuntimeStreamingCallbacks,
    RuntimeStreamingHandle
} from '@shared/api/HALRuntimePorts.js';
import type { PersistenceDelegate } from '@shared/api/NexusGenerationFlow.js';

type RuntimeLocalNexusHandler = new (
    payload: any,
    persistenceDelegate: PersistenceDelegate
) => RuntimeStreamingHandle;

export class LocalNexusHandler implements RuntimeStreamingHandle {
    private runtime: RuntimeStreamingHandle | null = null;
    private readonly callbacks: RuntimeStreamingCallbacks = {};
    private pendingAbort = false;
    private loadFailed = false;

    constructor(
        private readonly payload: any,
        private readonly persistenceDelegate: PersistenceDelegate
    ) {
        this.loadRuntime();
    }

    public isBusy(): boolean {
        return !this.loadFailed && (this.runtime?.isBusy() ?? true);
    }

    public abort(): void {
        this.pendingAbort = true;
        this.runtime?.abort();
    }

    public onToken(cb: (t: string) => void): this {
        this.callbacks.onToken = cb;
        this.runtime?.onToken(cb);
        return this;
    }

    public onCommitted(cb: (d: any) => void): this {
        this.callbacks.onCommitted = cb;
        this.runtime?.onCommitted(cb);
        return this;
    }

    public onDone(cb: (d: any) => void): this {
        this.callbacks.onDone = cb;
        this.runtime?.onDone(cb);
        return this;
    }

    public onError(cb: (e: any) => void): this {
        this.callbacks.onError = cb;
        this.runtime?.onError(cb);
        return this;
    }

    private async loadRuntime(): Promise<void> {
        try {
            const { LocalNexusHandler: RuntimeLocalNexusHandler } = await import('./LocalNexusHandlerRuntime.js') as {
                LocalNexusHandler: RuntimeLocalNexusHandler;
            };
            const runtime = new RuntimeLocalNexusHandler(this.payload, this.persistenceDelegate);
            this.runtime = runtime;

            if (this.callbacks.onToken) runtime.onToken(this.callbacks.onToken);
            if (this.callbacks.onCommitted) runtime.onCommitted(this.callbacks.onCommitted);
            if (this.callbacks.onDone) runtime.onDone(this.callbacks.onDone);
            if (this.callbacks.onError) runtime.onError(this.callbacks.onError);
            if (this.pendingAbort) runtime.abort();
        } catch (error) {
            this.loadFailed = true;
            this.callbacks.onError?.(error);
        }
    }
}
