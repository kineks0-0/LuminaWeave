import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { lwStorage } from '../storage.js';
import { globalXMLInterceptor, StreamSemanticState } from './XMLInterceptor.js';
import { ST_EVENT } from './STEvent.js';
import { llmEngine } from '../llmEngine.js';
import { NexusClient } from './NexusClient.js';
import type { NexusStatusResponse } from '../../types/nexus.js';
import { BridgeDispatcher } from '@shared/api/BridgeDispatcher.js';
import { STClient } from './st-adapter/STClient.js';

/**
 * 流式输出的聚合状态 (MVI 模式)
 */
export interface StreamState {
    isGenerating: boolean;
    isSyncing: boolean;
    rawText: string;
    displayText: string;
    filteredCount: number;
    statusText: string;
    activeTag: string | null;
    thinkingText: string;
    lastChunk: string;
}

/**
 * 负责流式输出的拦截、缓冲与平滑分发
 */
export class StreamHandler extends LuminaWeaveAPIBase {
    public responseBuffer: string = "";
    public isSyncing: boolean = false;
    public isGenerating: boolean = false;
    private _smoothRemaining: string = "";
    private _smoothTimer: any = null;
    private _smoothEmitText: string = "";
    private _lastDisplayFullText: string = "";
    /** 已确认显示的文本（无动画），用于流式效果的双层输出 */
    private _confirmedText: string = "";
    private _lastStatusText: string = "";
    private _lastFilteredCount: number = -1;
    private _lastThinkingText: string = "";
    private _initialized: boolean = false;
    private _latestSemanticState: StreamSemanticState = {
        rawText: '',
        displayText: '',
        filteredCount: 0,
        statusText: '',
        activeTag: null,
        thinkingText: ''
    };

    private _lastActivityTime: number = 0;
    private _watchdogTimer: any = null;
    private _syncing = false;
    private _resuming = false;
    private _resumeChatId: string | null = null;
    private _resumeAbort: AbortController | null = null;

    constructor() {
        super();
    }

    init(providedEventSource?: any): void {
        if (this._initialized) return;
        this.handleEnd();
        this._initialized = true;
        this.emitStateUpdate();
    }

    private emitStateUpdate(lastChunk: string = "") {
        const state: StreamState = {
            isGenerating: this.isGenerating,
            isSyncing: this.isSyncing,
            rawText: this.responseBuffer,
            displayText: this._smoothEmitText || this._latestSemanticState.displayText,
            filteredCount: this._latestSemanticState.filteredCount,
            statusText: this._latestSemanticState.statusText,
            activeTag: this._latestSemanticState.activeTag,
            thinkingText: this._latestSemanticState.thinkingText,
            lastChunk: lastChunk
        };
        this.emit('STREAM_STATE_UPDATED', state);
    }

    /**
     * 重置流处理器状态
     * @param options 配置项 { silent?: boolean } 如果为 true，则不设置 isGenerating 标记 (用于探测请求)
     */
    handleRestart(options: { silent?: boolean } = {}): void {
        console.log(`[StreamHandler] Restarting stream (silent: ${!!options.silent})`);
        this.isGenerating = !options.silent;
        this.isSyncing = false;
        this.responseBuffer = "";
        this._smoothRemaining = "";
        this._smoothEmitText = "";
        this._confirmedText = "";
        this._lastDisplayFullText = "";
        this._lastStatusText = "";
        this._lastFilteredCount = -1;
        this._lastThinkingText = "";
        this._latestSemanticState = {
            rawText: '',
            displayText: '',
            filteredCount: 0,
            statusText: '',
            activeTag: null,
            thinkingText: ''
        };
        this.clearSmoothTimer();
        this.startWatchdog();
        this.emitStateUpdate();
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
        const allowTopLevel = lwStorage.get('lumina-chat.allowTopLevelInFilter', true, 'Global');
        const implicitThinking = lwStorage.get('lumina-chat.implicitThinkingInFilter', false, 'Global');
        const aggressiveThinking = lwStorage.get('lumina-chat.aggressiveThinking', false, 'Global');

        if (rawFullText.length < this.responseBuffer.length) {
            console.warn(`[StreamHandler] Raw Buffer Shrank (${this.responseBuffer.length} -> ${rawFullText.length}). Resetting local raw buffer.`);
            this.responseBuffer = rawFullText;
        }

        this.responseBuffer = rawFullText;
        const semanticState = this.resolveDisplayState(rawFullText, { 
            filterChatReply, 
            allowTopLevel, 
            implicitThinking,
            aggressiveThinking
        });
        const displayFullText = semanticState.displayText;
        this._latestSemanticState = semanticState;

        // 检测元数据是否变更
        const metadataChanged = 
            semanticState.statusText !== this._lastStatusText || 
            semanticState.filteredCount !== this._lastFilteredCount ||
            semanticState.thinkingText !== this._lastThinkingText;
        
        this._lastStatusText = semanticState.statusText;
        this._lastFilteredCount = semanticState.filteredCount;
        this._lastThinkingText = semanticState.thinkingText;

        if (displayFullText.length < this._smoothEmitText.length) {
            console.warn(`[StreamHandler] Display Buffer Shrank (${this._smoothEmitText.length} -> ${displayFullText.length}). Resetting smooth queue.`);
            this._smoothEmitText = displayFullText;
            this._smoothRemaining = "";
        }

        if (isSmooth && smoothness > 0) {
            let actualChunk = "";
            if (displayFullText.startsWith(this._lastDisplayFullText)) {
                actualChunk = displayFullText.substring(this._lastDisplayFullText.length);
            } else {
                console.log('[StreamHandler] Output jump detected, resyncing display buffer');
                this._smoothEmitText = displayFullText;
                this._smoothRemaining = "";
                this.emitBufferUpdate(displayFullText);
            }
            this._lastDisplayFullText = displayFullText;
            if (actualChunk.length > 0) {
                this._smoothRemaining += actualChunk;
            }

            if (metadataChanged) {
                this.emitBufferUpdate(this._smoothEmitText);
            }
            
            this.startSmoothTimer(smoothness);
        } else {
            this._smoothEmitText = displayFullText;
            this.emitBufferUpdate(displayFullText);
        }

        // 核心架构：每次 Chunk 到达都同步最新的聚合状态
        this.emitStateUpdate(chunk);
        this._lastActivityTime = Date.now();
    }
    
    notifyActivity(): void {
        this._lastActivityTime = Date.now();
    }

    private emitBufferUpdate(displayFullText: string) {
        this.emit(
            'BUFFER_UPDATED',
            displayFullText,
            this.responseBuffer,
            this._latestSemanticState.filteredCount,
            this._latestSemanticState.statusText,
            this._latestSemanticState.thinkingText,
            ''
        );
    }

    private startSmoothTimer(smoothness: number) {
        if (this._smoothTimer) return;
        this._smoothTimer = setInterval(() => {
            if (this._smoothRemaining.length > 0) {
                const divisor = Math.max(0.1, 8 - smoothness);
                let step = Math.ceil(this._smoothRemaining.length / divisor);

                if (this._smoothRemaining.length > 50) step = Math.max(step, 2);
                if (this._smoothRemaining.length > 150) step = Math.max(step, 5);
                if (this._smoothRemaining.length > 300) step = Math.max(step, 10);

                const maxSpeed = lwStorage.get('lumina-chat.streamingMaxSpeed', 20, 'Global');
                step = Math.min(step, maxSpeed);

                const batch = this._smoothRemaining.substring(0, step);
                this._smoothRemaining = this._smoothRemaining.substring(step);
                this._confirmedText = this._smoothEmitText;
                this._smoothEmitText += batch;

                this.emit(
                    'BUFFER_UPDATED',
                    this._smoothEmitText,
                    this.responseBuffer,
                    this._latestSemanticState.filteredCount,
                    this._latestSemanticState.statusText,
                    this._latestSemanticState.thinkingText,
                    batch
                );
                
                // 平滑吐字时也广播聚合状态
                this.emitStateUpdate(batch);
            } else if (!this.isGenerating) {
                this.clearSmoothTimer();
                this.emit('GENERATION_ENDED', this.responseBuffer);
                this.emitStateUpdate();
            }
        }, 20);
    }

    private resolveDisplayState(rawFullText: string, policy: any): StreamSemanticState {
        return globalXMLInterceptor.deriveStreamState(rawFullText, policy);
    }

    handleEnd(options: { stayActive?: boolean } = {}): void {
        if (options.stayActive) {
            this.isSyncing = true;
            console.log('[StreamHandler] Stream ended via chunk end, entering syncing state...');
        } else {
            console.log('[StreamHandler] Stream ended normally.');
            this.isGenerating = false;
            this.isSyncing = false;
            this.stopWatchdog();
        }

        const isSmooth = lwStorage.get('lumina-chat.streamingSmoothness', false, 'Global');
        if ((!isSmooth || this._smoothRemaining.length === 0) && !options.stayActive) {
            this.clearSmoothTimer();
            this.emit('GENERATION_ENDED', this.responseBuffer);
            this.emitStateUpdate();
        }
    }

    finishSync(): void {
        this.isSyncing = false;
        this.isGenerating = false;
        this.clearSmoothTimer();
        this.stopWatchdog();
        console.log('[StreamHandler] sync finished, releasing generation lock.');
        this.emit('GENERATION_ENDED', this.responseBuffer);
        this.emitStateUpdate();
    }

    clearSmoothTimer(): void {
        if (this._smoothTimer) {
            clearInterval(this._smoothTimer);
            this._smoothTimer = null;
        }
    }

    cancelResume(): void {
        if (this._resumeAbort) {
            this._resumeAbort.abort();
        }
        this._resuming = false;
    }

    private async fetchServerState(chatId: string, signal?: AbortSignal): Promise<NexusStatusResponse | null> {
        try {
            return await BridgeDispatcher.nexus.getStatus(chatId);
        } catch {
            return null;
        }
    }

    private applyServerBuffer(serverBuffer: string, serverIsGenerating: boolean): void {
        if (serverIsGenerating && !this.isGenerating) {
            this.handleRestart({ silent: false });
        }

        if (serverBuffer !== this.responseBuffer) {
            let delta = '';
            if (serverBuffer.startsWith(this.responseBuffer)) {
                delta = serverBuffer.substring(this.responseBuffer.length);
            } else {
                this.responseBuffer = '';
                this._smoothEmitText = '';
                this._smoothRemaining = '';
                this._lastDisplayFullText = '';
                delta = serverBuffer;
            }
            this.isGenerating = serverIsGenerating;
            this.handleChunk(delta, serverBuffer);
        } else {
            this.isGenerating = serverIsGenerating;
        }
    }

    async syncWithServer(chatId: string): Promise<void> {
        if (this._syncing) return;
        this._syncing = true;
        try {
            const state = await this.fetchServerState(chatId);
            if (!state) return;

            const serverBuffer = typeof state.rawBuffer === 'string' ? state.rawBuffer : (typeof state.buffer === 'string' ? state.buffer : "");
            if (!state.isGenerating) {
                if ((state.status === 'error' || state.status === 'aborted') && this.isGenerating) {
                    this.emit('GENERATION_FAILED', state.errorMessage || '后端生成已中断', state.status);
                }
                if (this.isGenerating || serverBuffer !== this.responseBuffer) {
                    const persistenceService = (window as any).LuminaWeave?.chatManager?.persistence;
                    const integratedTxId = persistenceService ? persistenceService.getIntegratedTxId(chatId) : null;

                    if (state.lastTransactionId) {
                        this.emit('TRANSACTION_COMMITTED', {
                            lastTransactionId: state.lastTransactionId,
                            activeLeafId: state.activeLeafId,
                            generationId: state.generationId
                        });

                        if (integratedTxId !== state.lastTransactionId) {
                            setTimeout(() => {
                                (window as any).LuminaWeave?.syncFromST({ forceIndependentLoad: true, skipSave: true });
                            }, 50);
                        }
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
                this.applyServerBuffer(serverBuffer, true);
            }
        } catch (e) {
            console.warn('[StreamHandler] 同步后端状态失败', e);
        } finally {
            this._syncing = false;
        }
    }

    async resumeToTerminal(chatId: string): Promise<void> {
        const normalizedChatId = STClient.normalizeChatId(chatId);
        if (!normalizedChatId) return;
        if (this._resuming && this._resumeChatId === normalizedChatId) return;

        if (this._resumeAbort) {
            this._resumeAbort.abort();
        }
        const controller = new AbortController();
        this._resumeAbort = controller;
        this._resumeChatId = normalizedChatId;
        this._resuming = true;

        try {
            const state = await this.fetchServerState(normalizedChatId, controller.signal);
            if (!state) return;

            const serverBuffer = typeof state.rawBuffer === 'string' ? state.rawBuffer : (typeof state.buffer === 'string' ? state.buffer : '');
            const serverIsGenerating = !!state.isGenerating;
            if (serverBuffer) {
                this.applyServerBuffer(serverBuffer, serverIsGenerating);
            } else if (serverIsGenerating && !this.isGenerating) {
                this.handleRestart({ silent: false });
            }

            if (!serverIsGenerating) {
                if (state.status === 'error' || state.status === 'aborted') {
                    this.emit('GENERATION_FAILED', state.errorMessage || (state.status === 'aborted' ? '已停止生成' : '后端生成失败'), state.status);
                } else if (this.isGenerating) {
                    this.handleEnd();
                }
                return;
            }

            const generationId = typeof state.generationId === 'string' ? state.generationId : '';
            if (!generationId) {
                await this.pollUntilTerminal(normalizedChatId, controller.signal);
                return;
            }

            const nexus = new NexusClient();
            try {
                await nexus.attachStream({
                    chatId: normalizedChatId,
                    generationId,
                    from: this.responseBuffer.length,
                    initialText: this.responseBuffer
                }, {
                    onDelta: (delta: string) => {
                        if (controller.signal.aborted) return;
                        const full = this.responseBuffer + delta;
                        this.isGenerating = true;
                        this.handleChunk(delta, full);
                    },
                    onBackendCommitted: (info) => {
                        if (controller.signal.aborted) return;
                        this.emit('TRANSACTION_COMMITTED', info);
                    },
                    onDone: (res) => {
                        if (controller.signal.aborted) return;
                        if (res.status === 'error' || res.status === 'aborted') {
                            this.isGenerating = false;
                            this.clearSmoothTimer();
                            this.emit('GENERATION_FAILED', res.status === 'aborted' ? '已停止生成' : '后端生成失败', res.status);
                        } else {
                            if (res.lastTransactionId) {
                                this.emit('TRANSACTION_COMMITTED', {
                                    lastTransactionId: res.lastTransactionId,
                                    activeLeafId: res.activeLeafId,
                                    generationId: res.generationId
                                });
                            }
                            this.handleEnd();
                        }
                    },
                    onError: (err) => {
                        if (controller.signal.aborted) return;
                        this.isGenerating = false;
                        this.clearSmoothTimer();
                        this.emit('GENERATION_FAILED', err.message || '连接异常');
                    }
                }, controller.signal);
                return;
            } catch {
                if (!controller.signal.aborted) {
                    await this.pollUntilTerminal(normalizedChatId, controller.signal);
                }
            }
        } finally {
            if (this._resumeAbort === controller) {
                this._resuming = false;
            }
        }
    }

    private async pollUntilTerminal(chatId: string, signal: AbortSignal): Promise<void> {
        let delay = 500;
        while (!signal.aborted) {
            const state = await this.fetchServerState(chatId, signal);
            if (!state) {
                delay = Math.min(2000, delay * 2);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            const serverBuffer = typeof state.rawBuffer === 'string' ? state.rawBuffer : (typeof state.buffer === 'string' ? state.buffer : '');
            this.applyServerBuffer(serverBuffer, !!state.isGenerating);

            if (!state.isGenerating) {
                if (state.status === 'error' || state.status === 'aborted') {
                    this.emit('GENERATION_FAILED', state.errorMessage || (state.status === 'aborted' ? '已停止生成' : '后端生成失败'), state.status);
                    this.clearSmoothTimer();
                } else {
                    this.handleEnd();
                }
                await this.syncWithServer(chatId);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    private startWatchdog(): void {
        this.stopWatchdog();
        this._lastActivityTime = Date.now();
        this._watchdogTimer = setInterval(() => {
            const timeout = 20000;
            if (this.isGenerating && !this.isSyncing && Date.now() - this._lastActivityTime > timeout) {
                const chatId = STClient.normalizeChatId(lwStorage._getContextIds().chatId);
                if (chatId) {
                    console.warn(`[StreamHandler] Watchdog 触发：自动恢复 [Chat: ${chatId}]`);
                    this._lastActivityTime = Date.now();
                    this.resumeToTerminal(chatId);
                }
            }
        }, 5000);
    }

    private stopWatchdog(): void {
        if (this._watchdogTimer) {
            clearInterval(this._watchdogTimer);
            this._watchdogTimer = null;
        }
    }
}
