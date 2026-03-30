import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { lwStorage } from '../storage.js';
import { STBridge } from './STBridge.js';
import { globalXMLInterceptor, StreamSemanticState } from './XMLInterceptor.js';

/**
 * 负责流式输出的拦截、缓冲与平滑分发
 */
export class StreamHandler extends LuminaWeaveAPIBase {
    public responseBuffer: string = "";
    public isGenerating: boolean = false;
    private _smoothQueue: string[] = [];
    private _smoothTimer: any = null;
    private _smoothEmitText: string = "";
    private _initialized: boolean = false;
    private _latestSemanticState: StreamSemanticState = {
        rawText: '',
        displayText: '',
        filteredCount: 0,
        statusText: '',
        activeTag: null
    };

    constructor() {
        super();
    }

    init(providedEventSource?: any): void {
        if (this._initialized) return;

        // 核心修复：不再在 StreamHandler 内部直接监听 ST 事件
        // 改为由 LuminaWeaveAPI 统一监听并根据状态（如 _probing）决定是否转发给 StreamHandler
        // 这解决了双重监听以及探测请求误触生成状态的问题
        this.handleEnd();
        this._initialized = true;
    }

    /**
     * 重置流处理器状态
     * @param options 配置项 { silent?: boolean } 如果为 true，则不设置 isGenerating 标记 (用于探测请求)
     */
    handleRestart(options: { silent?: boolean } = {}): void {
        this.isGenerating = !options.silent;
        this.responseBuffer = "";
        this._smoothQueue = [];
        this._smoothEmitText = "";
        this._latestSemanticState = {
            rawText: '',
            displayText: '',
            filteredCount: 0,
            statusText: '',
            activeTag: null
        };
        this.clearSmoothTimer();
    }

    /**
     * 处理新到达的文本
     * @param chunk 增量文本
     * @param rawFullText 截止目前的完整原始文本
     */
    handleChunk(chunk: string, rawFullText: string): void {
        const isSmooth = lwStorage.get('lumina-chat.streamingSmoothness', false, 'Global');
        const smoothness = lwStorage.get('lumina-chat.streamingSmoothnessFactor', 2, 'Global');
        const filterChatReply = lwStorage.get('lumina-chat.filterChatReply', false, 'Global');

        if (rawFullText.length < this.responseBuffer.length) {
            console.warn(`[StreamHandler] Raw Buffer Shrank (${this.responseBuffer.length} -> ${rawFullText.length}). Resetting local raw buffer.`);
            this.responseBuffer = rawFullText;
        }

        this.responseBuffer = rawFullText;
        const semanticState = this.resolveDisplayState(rawFullText, filterChatReply);
        const displayFullText = semanticState.displayText;
        this._latestSemanticState = semanticState;

        if (displayFullText.length < this._smoothEmitText.length) {
            console.warn(`[StreamHandler] Display Buffer Shrank (${this._smoothEmitText.length} -> ${displayFullText.length}). Resetting smooth queue.`);
            this._smoothEmitText = displayFullText;
            this._smoothQueue = [];
        }

        if (chunk.length > 0 && this._smoothQueue.length % 50 === 0) {
            console.log(`[StreamHandler] Chunk received. Raw delta=${chunk.length}, raw total=${rawFullText.length}, display total=${displayFullText.length}, filter=${filterChatReply ? 'on' : 'off'}`);
        }

        if (isSmooth && smoothness > 0) {
            // 待平滑的实际增量，在过滤模式下，我们需要用 displayFullText 和 _smoothEmitText 计算差值
            let actualChunk = "";
            if (displayFullText.startsWith(this._smoothEmitText)) {
                actualChunk = displayFullText.substring(this._smoothEmitText.length);
            } else {
                this._smoothEmitText = displayFullText;
                this._smoothQueue = [];
                this.emit('BUFFER_UPDATED', displayFullText, rawFullText, semanticState.filteredCount, semanticState.statusText);
            }

            if (actualChunk.length > 0) {
                for (const char of actualChunk) {
                    this._smoothQueue.push(char);
                }
            }

            if (!this._smoothTimer) {
                this._smoothTimer = setInterval(() => {
                    if (this._smoothQueue.length > 0) {
                        let step = Math.ceil(this._smoothQueue.length / (8 - smoothness));

                        if (this._smoothQueue.length > 50) step = Math.max(step, 2);
                        if (this._smoothQueue.length > 150) step = Math.max(step, 5);
                        if (this._smoothQueue.length > 300) step = Math.max(step, 10);

                        const maxSpeed = lwStorage.get('lumina-chat.streamingMaxSpeed', 20, 'Global');
                        step = Math.min(step, maxSpeed);

                        const batch = this._smoothQueue.splice(0, step).join('');
                        this._smoothEmitText += batch;

                        this.emit(
                            'BUFFER_UPDATED',
                            this._smoothEmitText,
                            this.responseBuffer,
                            this._latestSemanticState.filteredCount,
                            this._latestSemanticState.statusText
                        );
                    } else if (!this.isGenerating) {
                        this.clearSmoothTimer();
                        this.emit('GENERATION_ENDED', this.responseBuffer);
                    }
                }, 20);
            } else if (this._smoothQueue.length === 0) {
                this.emit('BUFFER_UPDATED', this._smoothEmitText, this.responseBuffer, semanticState.filteredCount, semanticState.statusText);
            }
        } else {
            this.clearSmoothTimer();
            this._smoothEmitText = displayFullText;
            this.emit('BUFFER_UPDATED', displayFullText, rawFullText, semanticState.filteredCount, semanticState.statusText);
        }
    }

    private resolveDisplayState(rawFullText: string, filterChatReply: boolean): StreamSemanticState {
        const semanticState = globalXMLInterceptor.deriveStreamState(rawFullText, filterChatReply);

        if (this._smoothQueue.length % 50 === 0) {
            console.log(
                `[StreamHandler] Resolved stream state. raw=${semanticState.rawText.length}, display=${semanticState.displayText.length}, filtered=${semanticState.filteredCount}, status=${semanticState.statusText || 'idle'}, filter=${filterChatReply ? 'on' : 'off'}`
            );
        }

        return semanticState;
    }

    /**
     * 生成结束处理
     */
    handleEnd(): void {
        this.isGenerating = false;
        console.log('[StreamHandler] generation ended.');

        const isSmooth = lwStorage.get('lumina-chat.streamingSmoothness', false, 'Global');
        // 如果没有开启平滑，或者队列本来就是空的，立即结束
        if (!isSmooth || this._smoothQueue.length === 0) {
            this.clearSmoothTimer();
            // 核心修复：保留 responseBuffer 直到下一次 restart
            // 这样当 UI 收到 GENERATION_ENDED 信号时，即便立即清空了组件内部的 buffer，
            // 如果 formal messages 同步稍有延迟，至少 API 层的数据还是完整的。
            this.emit('GENERATION_ENDED', this.responseBuffer);
            // this.responseBuffer = ""; // 移除这里的清空逻辑
        }
    }

    clearSmoothTimer(): void {
        if (this._smoothTimer) {
            clearInterval(this._smoothTimer);
            this._smoothTimer = null;
        }
    }

    private _syncing = false;
    /**
     * 与后端同步流状态 (用于初始化或断线重连)
     */
    async syncWithServer(chatId: string): Promise<void> {
        if (this._syncing) return;
        this._syncing = true;
        try {
            const csrfToken = await STBridge.getCsrfToken();
            const res = await fetch(`/api/plugins/luminaweave/nexus/status/${chatId}`, {
                headers: { 'X-CSRF-Token': csrfToken }
            });
            if (!res.ok) return;
            const state = await res.json();

            // 核心修复：如果在刚打开插件时，后端由于某些原因（比如历史记录缓存）返回了旧的 buffer
            // 且 isGenerating 为 false，我们不应该盲目触发流式展示
            const serverBuffer = typeof state.rawBuffer === 'string' ? state.rawBuffer : (typeof state.buffer === 'string' ? state.buffer : "");

            if (!state.isGenerating) {
                if ((state.status === 'error' || state.status === 'aborted') && this.isGenerating) {
                    this.emit('GENERATION_FAILED', state.errorMessage || '后端生成已中断', state.status);
                }
                if (this.isGenerating || serverBuffer !== this.responseBuffer) {
                    // 优化：在触发同步前，检查本地集成的事务是否已经与后端对齐
                    const persistenceService = window.LuminaWeave?.chatManager?.persistence;
                    const integratedTxId = persistenceService ? persistenceService.getIntegratedTxId(chatId) : null;

                    if (state.lastTransactionId && integratedTxId === state.lastTransactionId) {
                        console.log(`[StreamHandler] 后端生成已结束且本地集成事务 ID (${integratedTxId}) 已最新，跳过强制拉取。`);
                    } else if (state.lastTransactionId && state.lastTransactionId !== 'undefined' && state.lastTransactionId !== '') {
                        // 仅当后端真的提供了有效的 lastTransactionId，且我们本地落后时，才触发强制拉取
                        console.log(`[StreamHandler] 发现后端有未集成的完成数据 (tx: ${state.lastTransactionId} vs local: ${integratedTxId})，触发同步拉取..`);
                        setTimeout(() => {
                            window.LuminaWeave?.syncFromST({ forceIndependentLoad: true, skipSave: true });
                        }, 50);
                    } else {
                        // 如果后端没返回 transaction ID，说明可能是旧版数据或未初始化，跳过以防无限循环
                        console.log(`[StreamHandler] 后端生成已结束但无事务 ID 记录，跳过强制拉取以防循环。`);
                    }
                }

                if (this.isGenerating) {
                    this.handleEnd();
                }
                return;
            }

            if (!this.isGenerating) {
                this.handleRestart({ silent: false });
            }

            if (serverBuffer !== this.responseBuffer) {
                console.log(`[StreamHandler] 从后端同步 Buffer: ${this.responseBuffer.length} -> ${serverBuffer.length}`);
                let delta = '';
                if (serverBuffer.startsWith(this.responseBuffer)) {
                    delta = serverBuffer.substring(this.responseBuffer.length);
                } else {
                    // 直接将本地环境重置，用后端全量数据覆盖
                    console.warn(`[StreamHandler] 检测到本地 Buffer 与后端断层，执行全量覆盖对齐`);
                    this.responseBuffer = '';
                    this._smoothEmitText = '';
                    this._smoothQueue = [];
                    delta = serverBuffer;
                }
                this.isGenerating = state.isGenerating;
                this.handleChunk(delta, serverBuffer);
            }
        } catch (e) {
            console.warn('[StreamHandler] 同步后端状态失败', e);
        } finally {
            this._syncing = false;
        }
    }
}
