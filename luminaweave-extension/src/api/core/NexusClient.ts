import { fetchEventSource } from '@microsoft/fetch-event-source';
import { STClient } from './st-adapter/STClient.js';
import { 
    NexusNode, 
    NexusStatusResponse, 
    CleanedMessage 
} from '../../types/nexus.js';
import { API_BASE, API_ROUTES } from '../../../../shared/ApiEndpoints.js';
import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';

export interface StreamCallbacks {
    onChunk?: (chunk: string, fullText: string) => void;
    onDelta?: (delta: string) => void;
    onDone?: (payload: { 
        status: string; 
        fullText: string; 
        lastTransactionId?: string; 
        activeLeafId?: string; 
        generationId?: string;
        node?: any; 
        seq?: number;
    }) => void;
    onError?: (error: Error, state?: NexusStatusResponse) => void;
    onBackendCommitted?: (info: { 
        lastTransactionId: string; 
        activeLeafId?: string | null; 
        generationId?: string | null;
        node?: any; 
        seq?: number;
    }) => void;
    onActivity?: () => void;
}

/**
 * NexusClient 核心客户端
 * 负责处理 SSE 消息流及状态同步
 * 已升级为 @microsoft/fetch-event-source 工业级方案
 */
export class NexusClient extends LuminaWeaveAPIBase {
    private isInvalidCsrfError(error: unknown): boolean {
        return typeof (STClient as any).isInvalidCsrfError === 'function'
            ? (STClient as any).isInvalidCsrfError(error)
            : false;
    }

    private async isInvalidCsrfResponse(response: Response): Promise<boolean> {
        return typeof (STClient as any).isInvalidCsrfResponse === 'function'
            ? await (STClient as any).isInvalidCsrfResponse(response)
            : false;
    }

    private createInvalidCsrfError(): Error {
        return typeof (STClient as any).createInvalidCsrfError === 'function'
            ? (STClient as any).createInvalidCsrfError()
            : new Error('LW_INVALID_CSRF_TOKEN');
    }

    private async refreshCsrfToken(): Promise<string> {
        return typeof (STClient as any).refreshCsrfToken === 'function'
            ? await (STClient as any).refreshCsrfToken()
            : await STClient.getCsrfToken();
    }
    
    /** 
     * 统一的基础网络调用，注入 CSRF Token 等核心鉴权
     */
    private async baseFetch(url: string, options: RequestInit = {}): Promise<Response> {
        if (typeof (STClient as any).fetchWithCsrf === 'function') {
            return await (STClient as any).fetchWithCsrf(url, options);
        }

        const csrfToken = await STClient.getCsrfToken();
        const headers = {
            'X-CSRF-Token': csrfToken,
            ...(options.headers || {})
        };
        return await fetch(url, { ...options, headers });
    }

    private async runEventStream(
        url: string,
        optionsFactory: (csrfToken: string, isRetry: boolean) => Parameters<typeof fetchEventSource>[1]
    ): Promise<void> {
        const runOnce = async (isRetry: boolean) => {
            const csrfToken = isRetry
                ? await this.refreshCsrfToken()
                : await STClient.getCsrfToken();

            await fetchEventSource(url, optionsFactory(csrfToken, isRetry));
        };

        try {
            await runOnce(false);
        } catch (error) {
            if (!this.isInvalidCsrfError(error)) throw error;
            console.warn('[NexusClient] SSE 请求命中失效 CSRF，刷新 Token 后重试一次');
            try {
                await runOnce(true);
            } catch (retryError) {
                if (this.isInvalidCsrfError(retryError)) {
                    throw new Error('Invalid CSRF token. Please refresh the page and try again.');
                }
                throw retryError;
            }
        }
    }

    /**
     * 发起 SSE 流式生成请求 (由 fetch-event-source 驱动)
     */
    async generateStream(payload: {
        chatId: string;
        charName: string;
        parentId: string | null;
        messages: CleanedMessage[];
        nodes: NexusNode[];
        settings?: Record<string, unknown>;
    }, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
        const endpoint = API_ROUTES.NEXUS.GENERATE_SSE;
        const url = `${API_BASE.LUMINA_WEAVE}${endpoint}`;
        const isInvalidCsrfResponse = this.isInvalidCsrfResponse.bind(this);
        const createInvalidCsrfError = this.createInvalidCsrfError.bind(this);
        const isInvalidCsrfError = this.isInvalidCsrfError.bind(this);

        let localFullText = '';
        let isFinished = false;
        let didReportError = false;

        try {
            await this.runEventStream(url, (csrfToken, isRetry) => {
                if (isRetry) {
                    isFinished = false;
                    localFullText = '';
                }

                return {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(payload),
                    signal,
                    openWhenHidden: true,
                    async onopen(response) {
                        if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
                            return;
                        }

                        if (await isInvalidCsrfResponse(response)) {
                            throw createInvalidCsrfError();
                        }

                        let errorMessage = `服务器响应异常: ${response.status} ${response.statusText}`;
                        if (response.status === 409) {
                            errorMessage = '检测到该会话已有正在进行的生成任务 (409 Conflict)。请稍后重试或尝试手动停止。';
                        }

                        try {
                            const body = await response.text();
                            if (body && !body.includes('<!DOCTYPE')) {
                                errorMessage += ` - ${body}`;
                            }
                        } catch {
                            // ignore
                        }

                        const err = new Error(errorMessage);
                        didReportError = true;
                        callbacks.onError?.(err);
                        isFinished = true;
                        throw err;
                    },
                    async onmessage(ev) {
                        if (isFinished) return;
                        callbacks.onActivity?.();

                        const originalData = ev.data;
                        const rawData = originalData?.trim();
                        if (!originalData || rawData === ': ping' || rawData === ': padding') return;

                        callbacks.onActivity?.();

                        try {
                            const parsed = JSON.parse(rawData);
                            switch (ev.event) {
                                case 'token':
                                case 'chunk':
                                case 'delta': {
                                    const delta = parsed.delta || parsed.token || '';
                                    if (delta) {
                                        console.debug(`[NexusClient] SSE token received [Chat: ${payload.chatId}] (+${delta.length} chars)`);
                                        localFullText += delta;
                                        callbacks.onChunk?.(delta, localFullText);
                                        callbacks.onDelta?.(delta);
                                    }
                                    break;
                                }
                                case 'committed':
                                    console.log('[NexusClient] Backend committed:', parsed);
                                    callbacks.onBackendCommitted?.({
                                        lastTransactionId: parsed.lastTransactionId,
                                        activeLeafId: parsed.activeLeafId,
                                        node: parsed.node,
                                        seq: parsed.seq,
                                        generationId: parsed.generationId
                                    });
                                    break;
                                case 'done':
                                    console.log('[NexusClient] Generation done. Full length:', localFullText.length);
                                    isFinished = true;
                                    callbacks.onDone?.({
                                        status: parsed.status || 'success',
                                        fullText: parsed.fullText || localFullText,
                                        lastTransactionId: parsed.lastTransactionId,
                                        activeLeafId: parsed.activeLeafId,
                                        node: parsed.node,
                                        seq: parsed.seq,
                                        generationId: parsed.generationId
                                    });
                                    break;
                                case 'error':
                                    console.error('[NexusClient] Backend error event:', parsed);
                                    isFinished = true;
                                    didReportError = true;
                                    callbacks.onError?.(new Error(parsed.message || '后端生成异常'), parsed.state);
                                    break;
                            }
                        } catch (e) {
                            if (ev.event === 'token' || ev.event === 'chunk' || !ev.event) {
                                const delta = originalData;
                                localFullText += delta;
                                callbacks.onChunk?.(delta, localFullText);
                                callbacks.onDelta?.(delta);
                            } else {
                                console.warn('[NexusClient] SSE JSON 解析异常:', e, 'Raw Data:', rawData);
                            }
                        }
                    },
                    onclose() {
                        if (!isFinished) {
                            callbacks.onDone?.({
                                status: 'success',
                                fullText: localFullText
                            });
                            isFinished = true;
                        }
                    },
                    onerror(err) {
                        if (!isFinished && !signal?.aborted && !isInvalidCsrfError(err)) {
                            didReportError = true;
                            callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
                        }
                        throw err;
                    }
                };
            });
        } catch (error) {
            if (!signal?.aborted && error instanceof Error && error.message === 'Invalid CSRF token. Please refresh the page and try again.') {
                didReportError = true;
                callbacks.onError?.(error);
                return;
            }
            if (!signal?.aborted && !didReportError) {
                didReportError = true;
                callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
                return;
            }
            throw error;
        }
    }

    /**
     * 接入并续传已有的生成流
     */
    async attachStream(params: { chatId: string; generationId: string; from: number; initialText?: string }, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
        const endpoint = API_ROUTES.NEXUS.STREAM(params.chatId);
        const url = `${API_BASE.LUMINA_WEAVE}${endpoint}?gid=${params.generationId}&from=${params.from || 0}`;
        const isInvalidCsrfResponse = this.isInvalidCsrfResponse.bind(this);
        const createInvalidCsrfError = this.createInvalidCsrfError.bind(this);
        const isInvalidCsrfError = this.isInvalidCsrfError.bind(this);
        let localFullText = params.initialText || '';
        let isFinished = false;
        let didReportError = false;

        try {
            await this.runEventStream(url, (csrfToken, isRetry) => {
                if (isRetry) {
                    isFinished = false;
                    localFullText = params.initialText || '';
                }

                return {
                    method: 'GET',
                    headers: {
                        'X-CSRF-Token': csrfToken
                    },
                    signal,
                    openWhenHidden: true,
                    async onopen(response) {
                        if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
                            return;
                        }
                        if (await isInvalidCsrfResponse(response)) {
                            throw createInvalidCsrfError();
                        }
                        const err = new Error(`吸附流失败: ${response.status}`);
                        didReportError = true;
                        callbacks.onError?.(err);
                        isFinished = true;
                        throw err;
                    },
                    async onmessage(ev) {
                        if (isFinished) return;
                        callbacks.onActivity?.();

                        const rawData = ev.data?.trim();
                        if (!rawData || rawData === ': ping' || rawData === ': padding') return;

                        try {
                            const parsed = JSON.parse(rawData);
                            switch (ev.event) {
                                case 'token':
                                case 'chunk':
                                case 'delta': {
                                    const delta = parsed.delta || parsed.token || '';
                                    if (delta) {
                                        localFullText += delta;
                                        callbacks.onChunk?.(delta, localFullText);
                                        callbacks.onDelta?.(delta);
                                    }
                                    break;
                                }
                                case 'committed':
                                    callbacks.onBackendCommitted?.({
                                        lastTransactionId: parsed.lastTransactionId,
                                        activeLeafId: parsed.activeLeafId,
                                        node: parsed.node,
                                        seq: parsed.seq,
                                        generationId: parsed.generationId
                                    });
                                    break;
                                case 'done':
                                    isFinished = true;
                                    callbacks.onDone?.({
                                        status: parsed.status || 'success',
                                        fullText: parsed.fullText || localFullText,
                                        lastTransactionId: parsed.lastTransactionId,
                                        activeLeafId: parsed.activeLeafId,
                                        node: parsed.node,
                                        seq: parsed.seq,
                                        generationId: parsed.generationId
                                    });
                                    break;
                            }
                        } catch (e) {
                            console.warn('[NexusClient] SSE JSON 解析异常:', e, 'Raw Data:', rawData);
                        }
                    },
                    onclose() {
                        if (!isFinished) {
                            callbacks.onDone?.({
                                status: 'success',
                                fullText: localFullText
                            });
                            isFinished = true;
                        }
                    },
                    onerror(err) {
                        if (!isFinished && !signal?.aborted && !isInvalidCsrfError(err)) {
                            didReportError = true;
                            callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
                        }
                        throw err;
                    }
                };
            });
        } catch (error) {
            if (!signal?.aborted && error instanceof Error && error.message === 'Invalid CSRF token. Please refresh the page and try again.') {
                didReportError = true;
                callbacks.onError?.(error);
                return;
            }
            if (!signal?.aborted && !didReportError) {
                didReportError = true;
                callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
                return;
            }
            throw error;
        }
    }

    /**
     * 获取节点模型列表
     */
    async fetchModels(providerId: string): Promise<string[]> {
        const endpoint = API_ROUTES.NEXUS.MODELS(providerId);
        const response = await this.baseFetch(`${API_BASE.LUMINA_WEAVE}${endpoint}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.models || [];
    }

    /**
     * 查询生成任务状态
     */
    async fetchStatus(chatId: string): Promise<NexusStatusResponse> {
        const endpoint = API_ROUTES.NEXUS.STATUS(chatId);
        const response = await this.baseFetch(`${API_BASE.LUMINA_WEAVE}${endpoint}`);
        return response.json();
    }

    /**
     * 强行中止后端的生成逻辑。
     * @param chatId 
     */
    async stopGeneration(chatId: string): Promise<void> {
        try {
            console.log(`[NexusClient] 发送停止指令 [Chat: ${chatId}]`);
            const endpoint = API_ROUTES.NEXUS.STOP(chatId);
            const response = await this.baseFetch(`${API_BASE.LUMINA_WEAVE}${endpoint}`, {
                method: 'POST'
            });
            if (!response.ok) {
                console.warn(`[NexusClient] 停止指令未获得预期响应: ${response.status}`);
            } else {
                console.log(`[NexusClient] 停止指令已确认 [Chat: ${chatId}]`);
            }
        } catch (error) {
            console.error('[NexusClient] stopGeneration 请求异常:', error);
        }
    }
}
