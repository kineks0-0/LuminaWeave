/**
 * LuminaFetch
 * 跨平台 HTTP 请求工具，解决 Webview 中的 CORS 限制。
 */
export class LuminaFetch {
    /**
     * 判断是否在 Tauri 环境中
     */
    private static isTauri(): boolean {
        if (typeof window === 'undefined') return false;
        const w = window as any;
        return !!(w.__TAURI_RUNNING__ || w.__TAURITAVERN__ || w.__TAURI__ || w.__TAURI_POST_MESSAGE__);
    }

    private static async waitReady(): Promise<void> {
        if (typeof window === 'undefined') return;
        const w = window as any;
        const ready = w.__TAURITAVERN__?.ready || w.__TAURITAVERN_MAIN_READY__;
        if (ready) await ready;
    }

    /**
     * 发起流式请求
     */
    public static async stream(url: string, options: any): Promise<ReadableStream<Uint8Array>> {
        if (this.isTauri()) {
            return this.tauriStream(url, options);
        } else {
            return this.browserStream(url, options);
        }
    }

    /**
     * 标准浏览器 Fetch 流
     */
    private static async browserStream(url: string, options: any): Promise<ReadableStream<Uint8Array>> {
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${error}`);
        }
        return response.body!;
    }

    /**
     * Tauri 原生网桥流
     * 注意：这通常需要后端支持将原生流转换为 Webview 可用的 chunks
     */
    private static async tauriStream(url: string, options: any): Promise<ReadableStream<Uint8Array>> {
        await this.waitReady();

        const w = window as any;
        const bridges = [w.__TAURITAVERN__, w.__TAURI__, w];
        
        let invoke: Function | null = null;
        let listen: Function | null = null;

        for (const b of bridges) {
            if (!b) continue;
            
            // 探测 Invoke (优先支持 TauriTavern safeInvoke)
            if (b.invoke && typeof b.invoke.safeInvoke === 'function') {
                invoke = b.invoke.safeInvoke.bind(b.invoke);
            } else if (typeof b.invoke === 'function') {
                invoke = b.invoke.bind(b);
            } else if (b.core && typeof b.core.invoke === 'function') {
                invoke = b.core.invoke.bind(b.core);
            }
            
            // 探测 Listen
            if (typeof b.listen === 'function') {
                listen = b.listen.bind(b);
            } else if (b.core && typeof b.core.listen === 'function') {
                listen = b.core.listen.bind(b.core);
            }

            if (invoke && listen) break;
        }
        
        if (!invoke || !listen) {
            throw new Error('[LuminaFetch] Tauri bridge or native functions (invoke/listen) not found.');
        }

        // 使用交互式 invoke 发起请求
        const streamId = await invoke('plugin_request_stream', {
            method: options.method || 'POST',
            url: url,
            headers: options.headers || {},
            body: options.body
        });

        // 监听来自 Native 的事件流
        return new ReadableStream({
            start(controller) {
                const unlistenPromise = listen!(`stream-${streamId}`, (event: any) => {
                    const { type, data } = event.payload;
                    if (type === 'token') {
                        // 假设 data 是分块文本或字节
                        const encoder = new TextEncoder();
                        controller.enqueue(encoder.encode(data));
                    } else if (type === 'done') {
                        controller.close();
                        unlistenPromise.then((fn: Function) => fn());
                    } else if (type === 'error') {
                        controller.error(new Error(data.message || 'Stream error'));
                        unlistenPromise.then((fn: Function) => fn());
                    }
                });
            }
        });
    }
}
