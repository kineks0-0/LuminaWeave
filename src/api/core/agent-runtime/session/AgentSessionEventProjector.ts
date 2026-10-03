import type { AgentEvent, AgentMessage } from '@earendil-works/pi-agent-core';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import type { AgentRuntimeEvent } from '../events/AgentRuntimeEventBus.js';
import { toJsonValue } from '../runtime/AgentJsonValue.js';
import { blockKey, projectAssistantBlocks } from './AgentMessageProjection.js';
import { isRecord, type AgentSessionActiveTurn } from './AgentSessionInternals.js';
import { summarizeContent, toBusContent, toBusToolResultFromUnknown } from './AgentSessionContent.js';

/** 投影器回调会话的窄接口：只能发事件、查询等待中的调用、通知消息定稿，不触碰会话生命周期。 */
export interface AgentSessionEventProjectorHost {
    readonly sessionId: string;
    emit(event: AgentRuntimeEvent): void;
    isPendingToolCall(toolCallId: string): boolean;
    notifyMessageEnd(turnId: string, message: AgentMessage): void;
}

/**
 * 把 pi Agent 事件投影到 SDK 事件总线：assistant 消息开始、块级去重的增量更新、消息结束，
 * 以及适配器工具的 tool_execution_*。回合生命周期事件由 AgentSession 自己发。
 */
export class AgentSessionEventProjector {
    private readonly host: AgentSessionEventProjectorHost;

    constructor(host: AgentSessionEventProjectorHost) {
        this.host = host;
    }

    handle(turn: AgentSessionActiveTurn, event: AgentEvent): void {
        const { host } = this;
        switch (event.type) {
            case 'message_start':
                if (event.message.role === 'assistant') this.startAssistantMessage(turn, event.message);
                return;
            case 'message_update':
                if (event.message.role === 'assistant') this.emitChangedBlocks(turn, event.message);
                return;
            case 'message_end':
                this.endMessage(turn, event.message);
                return;
            case 'tool_execution_start':
                // registry 工具的 start/end 由 AgentToolRegistry 发出。注意：registry 工具若在 beforeToolCall
                // 被跳过（同批已有待审批），根本不会进入 registry，总线上不会出现它的任何工具事件。
                if (turn.registryToolNames.has(event.toolName)) return;
                host.emit({
                    type: 'tool_execution_start',
                    sessionId: host.sessionId,
                    turnId: turn.turnId,
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    args: toJsonValue(event.args)
                });
                return;
            case 'tool_execution_update': {
                if (turn.registryToolNames.has(event.toolName)) return;
                const partial: unknown = event.partialResult;
                host.emit({
                    type: 'tool_execution_update',
                    sessionId: host.sessionId,
                    turnId: turn.turnId,
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    content: toBusContent(isRecord(partial) ? partial.content : undefined)
                });
                return;
            }
            case 'tool_execution_end': {
                // registry 工具的事件由 AgentToolRegistry 自己发；被策略暂停的调用保持 pending，不发 end。
                if (turn.registryToolNames.has(event.toolName)) return;
                if (host.isPendingToolCall(event.toolCallId)) return;
                const result = toBusToolResultFromUnknown(event.result);
                host.emit({
                    type: 'tool_execution_end',
                    sessionId: host.sessionId,
                    turnId: turn.turnId,
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    status: event.isError ? 'failed' : 'completed',
                    result,
                    ...(event.isError ? { errorMessage: summarizeContent(result.content) } : {})
                });
                return;
            }
            default:
                // agent_start / turn_start / turn_end / agent_end：总线回合生命周期由 session 自己发。
                return;
        }
    }

    private startAssistantMessage(turn: AgentSessionActiveTurn, message: AssistantMessage): void {
        turn.messageSeq += 1;
        const messageId = `agent-message:${this.host.sessionId}:${turn.turnId}:${turn.messageSeq}`;
        turn.streaming = { messageId, blockKeys: new Map() };
        this.host.emit({
            type: 'message_start',
            sessionId: this.host.sessionId,
            turnId: turn.turnId,
            message: { id: messageId, turnId: turn.turnId, role: 'assistant', blocks: [] }
        });
        this.emitChangedBlocks(turn, message);
    }

    private emitChangedBlocks(turn: AgentSessionActiveTurn, message: AssistantMessage): void {
        const streaming = turn.streaming;
        if (!streaming) return;
        for (const block of projectAssistantBlocks(message)) {
            const index = block.contentIndex ?? -1;
            const key = blockKey(block);
            if (streaming.blockKeys.get(index) === key) continue;
            streaming.blockKeys.set(index, key);
            this.host.emit({
                type: 'message_update',
                sessionId: this.host.sessionId,
                turnId: turn.turnId,
                messageId: streaming.messageId,
                block
            });
        }
    }

    private endMessage(turn: AgentSessionActiveTurn, message: AgentMessage): void {
        if (message.role === 'assistant') {
            if (!turn.streaming) this.startAssistantMessage(turn, message);
            this.emitChangedBlocks(turn, message);
            const streaming = turn.streaming;
            if (streaming) {
                this.host.emit({
                    type: 'message_end',
                    sessionId: this.host.sessionId,
                    turnId: turn.turnId,
                    messageId: streaming.messageId
                });
            }
            turn.streaming = undefined;
        }
        // 审批占位 toolResult 会在暂停时从 transcript 移除，不通知观察者，避免适配器持久化一条假结果。
        if (message.role === 'toolResult' && this.host.isPendingToolCall(message.toolCallId)) return;
        this.host.notifyMessageEnd(turn.turnId, message);
    }
}
