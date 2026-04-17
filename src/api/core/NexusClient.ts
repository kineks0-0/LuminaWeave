import { 
    NexusNode, 
    NexusStatusResponse, 
    CleanedMessage 
} from '../../types/nexus.js';
import { BridgeDispatcher } from '../../../../shared/api/BridgeDispatcher.js';
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
 * 已升级为 Bridge 架构，支持多端适配
 */
export class NexusClient extends LuminaWeaveAPIBase {

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
        let localFullText = '';
        
        const stream = BridgeDispatcher.nexus.generateStream(payload);
        
        // 处理外部信号中止
        if (signal) {
            signal.addEventListener('abort', () => stream.abort());
        }

        return new Promise((resolve) => {
            stream.onToken((delta) => {
                localFullText += delta;
                callbacks.onChunk?.(delta, localFullText);
                callbacks.onDelta?.(delta);
                callbacks.onActivity?.();
            })
            .onCommitted((data) => {
                callbacks.onBackendCommitted?.(data);
            })
            .onDone((data) => {
                callbacks.onDone?.({
                    status: data.status || 'success',
                    fullText: data.fullText || localFullText,
                    ...data
                });
                resolve();
            })
            .onError((err) => {
                callbacks.onError?.(err);
                resolve();
            });
        });
    }

    /**
     * 接入并续传已有的生成流
     */
    async attachStream(params: { chatId: string; generationId: string; from: number; initialText?: string }, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
        let localFullText = params.initialText || '';
        const stream = BridgeDispatcher.nexus.attachStream(params);

        if (signal) {
            signal.addEventListener('abort', () => stream.abort());
        }

        return new Promise((resolve) => {
            stream.onToken((delta) => {
                localFullText += delta;
                callbacks.onChunk?.(delta, localFullText);
                callbacks.onDelta?.(delta);
                callbacks.onActivity?.();
            })
            .onCommitted((data) => {
                callbacks.onBackendCommitted?.(data);
            })
            .onDone((data) => {
                callbacks.onDone?.({
                    status: data.status || 'success',
                    fullText: data.fullText || localFullText,
                    ...data
                });
                resolve();
            })
            .onError((err) => {
                callbacks.onError?.(err);
                resolve();
            });
        });
    }

    /**
     * 获取节点模型列表
     */
    async fetchModels(providerId: string): Promise<string[]> {
        return BridgeDispatcher.nexus.fetchModels(providerId);
    }

    async fetchStatus(chatId: string): Promise<NexusStatusResponse> {
        return BridgeDispatcher.nexus.getStatus(chatId);
    }

    async stopGeneration(chatId: string): Promise<void> {
        await BridgeDispatcher.nexus.stop(chatId);
    }
}
