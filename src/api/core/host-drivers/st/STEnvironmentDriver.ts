import { STGlobalAccessor } from './STGlobalAccessor.js';

export interface STEnvironmentSnapshot {
    hasST: boolean;
    hasEventSource: boolean;
    hasHelper: boolean;
}

export interface STEnvironmentWaitOptions {
    timeoutMs?: number;
    onProgress?: (message: string) => void;
    /** 宿主强依赖未就绪时直接抛错，而不是带病降级运行 */
    requireReady?: boolean;
}

/**
 * ST 宿主环境就绪探测。
 * Facade/Core 只消费这个 driver，不直接访问 STGlobalAccessor。
 */
export class STEnvironmentDriver {
    static get stMain(): typeof SillyTavern | undefined {
        return STGlobalAccessor.stMain;
    }

    static get ctx(): typeof SillyTavern | undefined {
        return STGlobalAccessor.ctx;
    }

    static get stHelper(): typeof TavernHelper | undefined {
        return STGlobalAccessor.stHelper;
    }

    static get stEventSource(): typeof SillyTavern.eventSource | undefined {
        return STGlobalAccessor.stEventSource;
    }

    static get stEventTypes(): Record<string, string> | undefined {
        return STGlobalAccessor.stEventTypes;
    }

    static setSilenceMode(enabled: boolean): void {
        STGlobalAccessor.isSilenceMode = enabled;
    }

    static getCore(): typeof SillyTavern | undefined {
        return this.stMain;
    }

    static getGenerationFlags(): { isGenerating: boolean; isTyping: boolean } {
        const glob = STGlobalAccessor.stGlobal as any;
        return {
            isGenerating: !!glob?.is_generating,
            isTyping: !!glob?.is_typing
        };
    }

    static applyRegex(
        text: string,
        source: 'user_input' | 'ai_output' | 'slash_command' | 'world_info' | 'reasoning',
        destination: 'display' | 'prompt',
        options: Record<string, unknown> = {}
    ): string {
        const helper = this.stHelper as any;
        const fn = typeof helper?.formatAsTavernRegexedString === 'function'
            ? helper.formatAsTavernRegexedString
            : null;
        return fn ? fn(text, source, destination, options) : text;
    }

    static async getHostFunction(funcName: string): Promise<Function | null> {
        let foundFunc: Function | null = null;
        let source = 'none';
        const stApi = this.stMain as any;
        const ctx = this.ctx as any;
        const glob = STGlobalAccessor.stGlobal as any;

        if (stApi && typeof stApi[funcName] === 'function') {
            foundFunc = stApi[funcName];
            source = 'SillyTavern API';
        } else if (glob && typeof glob[funcName] === 'function') {
            foundFunc = glob[funcName];
            source = 'host global';
        } else if (ctx && typeof ctx[funcName] === 'function') {
            foundFunc = ctx[funcName];
            source = 'ctx';
        }

        if (!foundFunc) {
            const aliases = ['generateResponse', 'triggerGenerate', 'generateQuietPrompt'];
            for (const alias of aliases) {
                if (stApi && typeof stApi[alias] === 'function') {
                    console.warn(`[LuminaWeave] [ST_API] 未找到 ${funcName}，但在 stApi 中尝试发现别名: ${alias}`);
                    return stApi[alias].bind(stApi);
                }
            }
        }

        if (foundFunc) {
            console.debug(`[LuminaWeave] [ST_API] 已定位到函数: ${funcName}, 来源: ${source}`);
            if (source === 'SillyTavern API' && stApi) return foundFunc.bind(stApi);
            if (source === 'ctx' && ctx) return foundFunc.bind(ctx);
            if (source === 'host global' && glob) return foundFunc.bind(glob);
            return foundFunc;
        }

        const apiKeys = stApi ? Object.keys(stApi) : [];
        const globalKeys = glob ? Object.keys(glob).filter((key) => key.toLowerCase().includes('generate')) : [];
        console.error(`[LuminaWeave] [ST_API] 无法定位到函数: ${funcName}.`, {
            hasStApi: !!stApi,
            apiKeys: apiKeys.slice(0, 50),
            globalMatchingKeys: globalKeys,
            hasHostST: !!glob?.SillyTavern
        });
        return null;
    }

    static snapshot(): STEnvironmentSnapshot {
        return {
            hasST: !!this.ctx,
            hasEventSource: !!this.stEventSource,
            hasHelper: !!this.stHelper
        };
    }

    static async waitForReady(options: STEnvironmentWaitOptions = {}): Promise<boolean> {
        const timeoutMs = options.timeoutMs ?? 10000;
        const startTime = Date.now();

        console.log('[LuminaWeave] 等待环境就绪 (ST, EventSource, Helper)...');
        options.onProgress?.('等待 TavernHelper 就绪...');

        const helperReady = await STGlobalAccessor.waitForGlobal('TavernHelper', timeoutMs);
        if (!helperReady) {
            console.warn('[LuminaWeave] 等待 TavernHelper 超时！获取世界书或 API 数据可能受限或为空。');
            options.onProgress?.('等待 TavernHelper 超时');
        } else {
            console.log('[LuminaWeave] TavernHelper 已成功就绪。');
            options.onProgress?.('TavernHelper 已就绪');
        }

        options.onProgress?.('等待 ST 核心环境就绪...');
        const ready = await new Promise<boolean>((resolve) => {
            const check = () => {
                const snapshot = this.snapshot();
                if (snapshot.hasST && snapshot.hasEventSource && snapshot.hasHelper) {
                    console.log('[LuminaWeave] 环境就绪检测通过:');
                    options.onProgress?.('环境就绪检测通过');
                    resolve(true);
                    return;
                }

                if (Date.now() - startTime > timeoutMs) {
                    console.warn('[LuminaWeave] 环境探测超时，部分功能可能受限:', snapshot);
                    options.onProgress?.('环境探测超时');
                    resolve(false);
                    return;
                }

                setTimeout(check, 100);
            };
            check();
        });

        if (!ready && options.requireReady) {
            const snapshot = this.snapshot();
            const reason = !snapshot.hasST
                ? '未检测到 SillyTavern 宿主'
                : !snapshot.hasHelper
                    ? '未检测到酒馆助手 (TavernHelper / JS-Slash-Runner)'
                    : 'SillyTavern 事件源未就绪';
            const message = `${reason}。LuminaWeave 在酒馆中强依赖酒馆助手，请安装并启用后重载页面。`;
            this.showHostErrorToast(message);
            throw new Error(`[LuminaWeave] 环境未就绪: ${reason}`);
        }

        return ready;
    }

    private static showHostErrorToast(message: string): void {
        const toastr = (globalThis as {
            window?: { toastr?: { error?: (message: string, title?: string, options?: { timeOut?: number }) => void } };
        }).window?.toastr;
        try {
            toastr?.error?.(message, 'LuminaWeave 启动失败', { timeOut: 10000 });
        } catch {
            // 宿主 toastr 不可用时仅依赖 console 与抛错信息。
        }
    }
}
