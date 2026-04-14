import { StreamState, StreamStatus } from './types.js';
import { Logger } from './logger.js';

/**
 * 后端流式管理器 (StreamingManager)
 * 负责在服务器端缓存当前正在生成的文本。
 */
export class StreamingManager {
    private states: Map<string, StreamState> = new Map();

    getState(chatId: string): StreamState {
        if (!this.states.has(chatId)) {
            this.states.set(chatId, {
                buffer: '',
                rawBuffer: '',
                isGenerating: false,
                generationId: null,
                lastChunkTime: 0,
                nodeIndex: 0,
                status: 'idle',
                errorMessage: null,
                finishedAt: 0,
                lastTransactionId: undefined
            });
        }
        return this.states.get(chatId)!;
    }

    updateBuffer(chatId: string, chunk: string, isFull: boolean = false, rawChunk?: string) {
        const state = this.getState(chatId);
        if (isFull) {
            state.buffer = chunk;
            if (rawChunk !== undefined) state.rawBuffer = rawChunk;
        } else {
            state.buffer += chunk;
            if (rawChunk !== undefined) state.rawBuffer = (state.rawBuffer || '') + rawChunk;
        }
        state.lastChunkTime = Date.now();
    }

    setGenerating(chatId: string, val: boolean, status?: StreamStatus, errorMessage?: string | null, lastTransactionId?: string, generationId?: string | null, activeLeafId?: string | null) {
        const state = this.getState(chatId);
        state.isGenerating = val;
        if (val) {
            state.buffer = '';
            state.rawBuffer = '';
            state.lastChunkTime = Date.now();
            state.status = 'running';
            state.errorMessage = null;
            state.finishedAt = 0;
            state.lastTransactionId = undefined; 
            state.activeLeafId = null;
            state.generationId = generationId || `gen_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
            Logger.info('StreamManager', `生成启动 [Chat: ${chatId}] [GenID: ${state.generationId}]`);
        } else {
            state.status = status || 'success';
            state.errorMessage = errorMessage || null;
            state.finishedAt = Date.now();
            if (lastTransactionId) {
                state.lastTransactionId = lastTransactionId;
            }
            if (activeLeafId) {
                state.activeLeafId = activeLeafId;
            }
            Logger.info('StreamManager', `生成结束 [Chat: ${chatId}] [Status: ${state.status}]`, errorMessage ? { error: errorMessage } : null);
        }
    }
}
