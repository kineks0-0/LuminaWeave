import { extractBlocks } from '@shared/TagTokenizer.js';
import { BaseXMLInterceptor } from '@shared/BaseXMLInterceptor.js';
import { llmEngine } from '../../llmEngine.js';
import { lwStorage } from '../../storage.js';
import { LuminaGenerationTask } from '../generation/LuminaGenerationTask.js';
import type {
    ForgeExecutionRequest,
    ForgeExecutionResult,
    ForgeRuntimeEvent,
    ForgeRuntimeEventSource
} from '../../../types/ForgeRuntimeTypes.js';

interface RunExecutionOptions {
    onEvent?: (event: ForgeRuntimeEvent) => void;
}

type ForgeActionType = 'skill' | 'plan' | 'update' | 'memory' | 'context' | 'handoff';

const TAG_TO_ACTION: Record<string, ForgeActionType> = {
    forge_skill: 'skill',
    draft_plan: 'plan',
    entry_update: 'update',
    memory_update: 'memory',
    context_read: 'context',
    analysis_handoff: 'handoff'
};

export class ForgeExecutionGateway {
    private readonly interceptor = new BaseXMLInterceptor();
    private activeTask: LuminaGenerationTask | null = null;

    abortActiveTask(): void {
        this.activeTask?.abort();
        this.activeTask = null;
    }

    private emitEvent(event: ForgeRuntimeEvent, sink: ForgeRuntimeEvent[], onEvent?: (event: ForgeRuntimeEvent) => void): void {
        sink.push(event);
        onEvent?.(event);
    }

    private mapRequestSourceToEventSource(request: ForgeExecutionRequest): ForgeRuntimeEventSource {
        if (request.traceSource === 'analyst') return 'analyst';
        if (request.traceSource === 'executor') return 'executor';
        if (request.traceSource === 'conversation') return 'conversation';
        return 'planner';
    }

    private extractCompletedActionEvents(rawText: string, source: ForgeRuntimeEventSource): ForgeRuntimeEvent[] {
        const blocks = extractBlocks(rawText, new Set(Object.keys(TAG_TO_ACTION)));
        return blocks.map((block) => {
            const normalizedTag = block.tagName.toLowerCase();
            const actionType = TAG_TO_ACTION[normalizedTag];
            return {
                type: 'action_completed',
                actionType,
                raw: rawText.slice(block.outerStart, block.outerEnd),
                content: block.content,
                source
            } as ForgeRuntimeEvent;
        });
    }

    async run(request: ForgeExecutionRequest, options?: RunExecutionOptions): Promise<ForgeExecutionResult> {
        const events: ForgeRuntimeEvent[] = [];
        const requestId = request.requestId;
        const eventSource = this.mapRequestSourceToEventSource(request);

        // 核心诊断日志
        console.log('[Nexus-Gateway] 收到生成请求:', { 
            sessionChatId: request.sessionChatId, 
            requestPresetId: request.presetId,
            storageForgePreset: lwStorage.get('lumina-forge.nexusPreset', '', 'Global'),
            storageChatPreset: lwStorage.get('lumina-chat.nexusPreset', 'Global', 'Global')
        });

        // 层级回退逻辑：制卡专用 -> 聊天全局 (兼容旧版)
        const presetId = request.presetId ||
            lwStorage.get('lumina-forge.nexusPreset', '', 'Global') ||
            lwStorage.get('lumina-chat.nexusPreset', 'Global', 'Global');

        const nodes = llmEngine.resolveNodesFromPreset(presetId);
        console.log('[Nexus-Gateway] 解析出的节点列表:', nodes);

        const lwAPI = (window as any).LuminaWeave;

        // 核心校验：如果解析出的节点列表为空，则阻断生成并通知 UI
        if (nodes.length === 0) {
            const errorMsg = '检测到 Forge 专用或回退模型配置未完成。请前往【设置】检查 Nexus 编排预设。';
            console.error('[Nexus-Gateway] 生成终止: nodes 为空，预设 ID 为:', presetId);
            if (lwAPI?.emit) lwAPI.emit('GENERATION_FAILED', errorMsg, 'config_missing');
            if (lwAPI?.showToast) lwAPI.showToast(errorMsg, 'error', '配置缺失');
            throw new Error(errorMsg);
        }

        const invalidNodes = nodes.filter(n => n.provider !== 'st_current' && !n.model);
        if (invalidNodes.length > 0) {
            console.error('[Nexus-Gateway] 发现无效节点配置:', invalidNodes);
            const errorMsg = `Nexus 预设配置不全：节点 [${invalidNodes[0].provider}] 缺少模型名称。请前往【设置】检查预设内容。`;
            if (lwAPI?.emit) lwAPI.emit('GENERATION_FAILED', errorMsg, 'config_incomplete');
            if (lwAPI?.showToast) lwAPI.showToast(errorMsg, 'error', '配置不全');
            throw new Error(errorMsg);
        }

        const session = llmEngine.createSession({
            chatId: request.sessionChatId,
            charName: request.charName,
            parentId: null,
            nodes
        });

        this.emitEvent({
            type: 'request_started',
            requestId,
            requestedAt: Date.now(),
            nodeSummary: request.nodeSummary
        }, events, options?.onEvent);

        const cleanedMessages = llmEngine.cleanMessages(request.messages);

        // 提示词捕获埋点：子模型启动前记录其上下文
        this.emitEvent({
            type: 'prompt_ready',
            requestId,
            prompt: cleanedMessages,
        }, events, options?.onEvent);

        let finalRawText = '';
        let lastTraceSignature = '';
        let hasEmittedFirstResponse = false;

        const task = new LuminaGenerationTask(session);
        this.activeTask = task;
        try {
            await task.run(cleanedMessages, {
                onChunk: (_chunk: string, fullText: string) => {
                    finalRawText = fullText;
                    const streamState = this.interceptor.deriveStreamState(fullText, {
                        filterChatReply: true,
                        allowTopLevel: true,
                        implicitThinking: false,
                        aggressiveThinking: false
                    });

                    if (!hasEmittedFirstResponse) {
                        hasEmittedFirstResponse = true;
                        this.emitEvent({
                            type: 'first_response',
                            requestId,
                            firstResponseAt: Date.now()
                        }, events, options?.onEvent);
                    }

                    if (streamState.activeTag && Object.keys(TAG_TO_ACTION).includes(streamState.activeTag.toLowerCase())) {
                        const signature = `${streamState.activeTag}:${streamState.statusText}`;
                        if (signature !== lastTraceSignature) {
                            lastTraceSignature = signature;
                            this.emitEvent({
                                type: 'trace',
                                requestId,
                                tag: streamState.activeTag,
                                status: streamState.statusText,
                                timestamp: Date.now()
                            }, events, options?.onEvent);
                        }
                    }

                    this.emitEvent({
                        type: 'stream_chunk',
                        requestId,
                        rawText: fullText,
                        displayText: streamState.displayText,
                        thinkingText: streamState.thinkingText
                    }, events, options?.onEvent);
                },
                onDone: (fullText: string) => {
                    finalRawText = fullText;
                    const finalState = this.interceptor.deriveStreamState(fullText, {
                        filterChatReply: true,
                        allowTopLevel: true,
                        implicitThinking: false,
                        aggressiveThinking: false
                    });
                    this.emitEvent({
                        type: 'stream_done',
                        requestId,
                        rawText: fullText,
                        displayText: finalState.displayText,
                        thinkingText: finalState.thinkingText,
                        completedAt: Date.now()
                    }, events, options?.onEvent);

                    for (const actionEvent of this.extractCompletedActionEvents(fullText, eventSource)) {
                        this.emitEvent(actionEvent, events, options?.onEvent);
                    }
                },
                onError: (error: Error) => {
                    this.emitEvent({
                        type: 'stream_error',
                        requestId,
                        message: error.message
                    }, events, options?.onEvent);
                }
            }, request.generationSettings);
        } finally {
            if (this.activeTask === task) {
                this.activeTask = null;
            }
        }

        return {
            rawText: finalRawText,
            events,
            effects: []
        };
    }
}
