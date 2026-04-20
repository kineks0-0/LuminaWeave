import { streamText } from 'ai';
import { globalNexusOrchestrator, mapSTSettingsToAISdk } from '@shared/api/llm/NexusOrchestrator.js';
import { NexusGenerationFlow, PersistenceDelegate } from '@shared/api/NexusGenerationFlow.js';
import { IStreamingHandle, IStreamingCallbacks } from '@shared/api/IBridge.js';
import { lwStorage } from '../storage.js';
import { globalXMLInterceptor } from './XMLInterceptor.js';
import { LuminaChatMessage } from '@shared/LuminaMessage.js';

/**
 * LocalNexusHandler
 * 在前端直接运行的生成引擎 (Fallback 模式)
 * 实现 IStreamingHandle 接口以兼容桥接层
 */
export class LocalNexusHandler implements IStreamingHandle {
    private isAborted = false;
    private _isBusy = true;
    private callbacks: IStreamingCallbacks = {};
    private abortController = new AbortController();

    constructor(
        private payload: any,
        private persistenceDelegate: PersistenceDelegate
    ) {
        this._run();
    }

    public isBusy(): boolean { return this._isBusy; }

    public abort(): void {
        this.isAborted = true;
        this._isBusy = false;
        this.abortController.abort();
    }

    public onToken(cb: (t: string) => void): this { this.callbacks.onToken = cb; return this; }
    public onCommitted(cb: (d: any) => void): this { this.callbacks.onCommitted = cb; return this; }
    public onDone(cb: (d: any) => void): this { this.callbacks.onDone = cb; return this; }
    public onError(cb: (e: any) => void): this { this.callbacks.onError = cb; return this; }

    private async _run() {
        try {
            const { chatId, messages, nodes, settings, charName, parentId, characterId } = this.payload;
            const config = lwStorage.get('nexus.apis', [], 'Global');
            
            // 准备 Flow 辅助器
            const flow = new NexusGenerationFlow(
                {
                    chatId,
                    parentId,
                    charName,
                    characterId,
                    policy: {
                        filterChatReply: lwStorage.get('nexus.onlyChatReply', false, 'Global'),
                        allowTopLevel: lwStorage.get('nexus.allowTopLevel', true, 'Global'),
                        implicitThinking: lwStorage.get('nexus.implicitThinking', false, 'Global'),
                        aggressiveThinking: lwStorage.get('nexus.aggressiveThinking', false, 'Global')
                    }
                },
                globalXMLInterceptor,
                this.persistenceDelegate
            );

            const modelMessages = globalNexusOrchestrator.toModelMessages(messages);
            const mappedSettings = mapSTSettingsToAISdk(settings || {});
            
            let fullText = '';

            // 按照节点列表尝试生成 (Fallback 逻辑)
            for (const node of nodes) {
                if (this.isAborted) break;

                try {
                    const apiConfig = config.find((a: any) => a.id === node.provider) || null;
                    const model = globalNexusOrchestrator.getModelForNode(node, apiConfig);

                    const result = await streamText({
                        model,
                        messages: modelMessages,
                        abortSignal: this.abortController.signal,
                        ...mappedSettings
                    });

                    for await (const delta of result.textStream) {
                        if (this.isAborted) return;
                        fullText += delta;
                        flow.pushToken(delta);
                        this.callbacks.onToken?.(delta);
                    }

                    // 生成完成，执行持久化
                    const newNode = await flow.finalize();
                    const txMetadata = newNode.extra.transactionId as any;

                    this.callbacks.onCommitted?.({
                        lastTransactionId: txMetadata?.id,
                        activeLeafId: newNode.id,
                        node: newNode,
                        seq: txMetadata?.seq
                    });

                    this._isBusy = false;
                    this.callbacks.onDone?.({
                        status: 'success',
                        fullText,
                        lastTransactionId: txMetadata?.id,
                        activeLeafId: newNode.id,
                        node: newNode,
                        seq: txMetadata?.seq
                    });

                    return; // 成功后通过 return 退出循环
                } catch (e: any) {
                    console.warn(`[LocalNexus] Node ${node.model} failed:`, e);
                    if (node === nodes[nodes.length - 1]) throw e; // 最后一个也失败了，抛出错误
                }
            }

        } catch (err: any) {
            console.error('[LocalNexus] Generation error:', err);
            this._isBusy = false;
            this.callbacks.onError?.(err);
        }
    }
}
