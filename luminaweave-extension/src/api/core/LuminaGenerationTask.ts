import { NexusClient } from './NexusClient.js';
import { GenerationSession } from './GenerationSession.js';
import { CleanedMessage, NexusNode, NexusStatusResponse } from '../../types/nexus.js';
import { lwStorage } from '../storage.js';
import { API_BASE, API_ROUTES } from '@shared/ApiEndpoints.js';
import { STClient } from './st-adapter/STClient.js';

export interface TaskCallbacks {
    onChunk?: (chunk: string, fullText: string) => void;
    onDone?: (finalText: string) => Promise<void> | void;
    onError?: (error: Error, state?: NexusStatusResponse) => void;
    onBackendCommitted?: (info: { lastTransactionId: string; activeLeafId?: string | null; generationId?: string | null }) => Promise<void> | void;
    onActivity?: () => void;
}

/**
 * LuminaGenerationTask
 * 负责执行具体的生成逻辑，将结果写入 GenerationSession。
 */
export class LuminaGenerationTask {
    private nexus: NexusClient;
    private session: GenerationSession;
    private abortController: AbortController;

    constructor(session: GenerationSession) {
        this.session = session;
        this.nexus = new NexusClient();
        this.abortController = new AbortController();
    }

    /**
     * 运行生成任务
     */
    async run(messages: CleanedMessage[], callbacks: TaskCallbacks = {}, settings?: Record<string, any>): Promise<void> {
        const useSSE = lwStorage.get('nexus.useSSE', true, 'Global') === true;
        
        console.log(`[Lumina Task] Starting generation [Session: ${this.session.chatId}] [Mode: ${useSSE ? 'SSE' : 'Polling'}]`);

        if (useSSE) {
            await this._runSSE(messages, callbacks, settings);
        } else {
            await this._runPolling(messages, callbacks, settings);
        }
    }

    /**
     * 终止生成
     */
    abort(): void {
        console.warn(`[Lumina Task] Abort requested for session: ${this.session.chatId}`);
        this.abortController.abort();
        this.session.markAborted();
        
        // 关键修复：显式通知后端中止
        this.nexus.stopGeneration(this.session.chatId);
    }

    private async _runSSE(messages: CleanedMessage[], callbacks: TaskCallbacks, settings?: Record<string, any>): Promise<void> {
        await this.nexus.generateStream({
            chatId: this.session.chatId,
            charName: this.session.charName,
            parentId: this.session.parentId,
            messages,
            nodes: this.session.nodes,
            settings
        }, {
            onChunk: (chunk, fullText) => {
                this.session.finalText = fullText;
                callbacks.onChunk?.(chunk, fullText);
            },
            onDone: (res) => {
                console.log(`[Lumina Task] Finished session: ${this.session.chatId}`);
                this.session.finalText = res.fullText;
                if (res.status === 'success') {
                    this.session.markCompleted();
                    callbacks.onDone?.(res.fullText);
                } else {
                    const err = new Error(res.status === 'aborted' ? '已停止生成' : '后端生成失败');
                    console.warn(`[Lumina Task] Session ended with status: ${res.status}`);
                    this.session.error = err;
                    callbacks.onError?.(err);
                }
            },
            onError: (err, state) => {
                console.error(`[Lumina Task] Error in session ${this.session.chatId}:`, err);
                this.session.error = err;
                callbacks.onError?.(err, state);
            },
            onBackendCommitted: (info) => {
                console.log(`[Lumina Task] Backend committed sequence for session: ${this.session.chatId}`);
                this.session.committedInfo = info;
                callbacks.onBackendCommitted?.(info);
            },
            onActivity: () => {
                callbacks.onActivity?.();
            }
        }, this.abortController.signal);
    }

    private async _runPolling(messages: CleanedMessage[], callbacks: TaskCallbacks, settings?: Record<string, any>): Promise<void> {
        // 由于服务器端目前主要支持 SSE，轮询模式通过 fetch 开启任务后持续拉取 status
        try {
            const endpoint = API_ROUTES.NEXUS.GENERATE;
            const url = `${API_BASE.LUMINA_WEAVE}${endpoint}`;
            await STClient.fetchWithCsrf(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chatId: this.session.chatId,
                    charName: this.session.charName,
                    parentId: this.session.parentId,
                    messages,
                    nodes: this.session.nodes,
                    settings
                }),
                signal: this.abortController.signal
            });

            await this._pollStatus(callbacks);
        } catch (err: any) {
            this.session.error = err;
            callbacks.onError?.(err);
        }
    }

    private async _pollStatus(callbacks: TaskCallbacks): Promise<void> {
        const poll = async () => {
            if (this.session.isCompleted || this.abortController.signal.aborted) return;
            try {
                const res = await this.nexus.fetchStatus(this.session.chatId);
                const currentBuffer = res.rawBuffer !== undefined ? res.rawBuffer : res.buffer;
                
                if (currentBuffer) {
                    console.debug(`[Lumina Task] Polling received content [Chat: ${this.session.chatId}] (${currentBuffer.length} chars)`);
                    this.session.finalText = currentBuffer;
                    callbacks.onChunk?.(currentBuffer, currentBuffer);
                    callbacks.onActivity?.();
                }

                if (!res.isGenerating) {
                    this.session.markCompleted();
                    if (res.status === 'error' || res.status === 'aborted') {
                        const err = new Error(res.errorMessage || '生成失败');
                        this.session.error = err;
                        callbacks.onError?.(err, res);
                    } else {
                        callbacks.onDone?.(currentBuffer || '');
                    }
                } else {
                    setTimeout(poll, 500);
                }
            } catch (err: any) {
                console.error('[Lumina Task] Polling error:', err);
                setTimeout(poll, 1000);
            }
        };
        await poll();
    }
}
