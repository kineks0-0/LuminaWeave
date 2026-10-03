import type { Agent } from '@earendil-works/pi-agent-core';
import type { AgentRuntimeToolResult } from '../tools/AgentToolRegistry.js';
import type { AgentSessionPendingApproval, AgentSessionTurnResult } from './AgentSessionTypes.js';

// AgentSession 与其拆出模块共享的内部类型和文案。不进入 SDK 主入口导出。

export const APPROVAL_PENDING_TEXT = 'Tool approval pending.';
export const ABORTED_MESSAGE = 'Agent runtime aborted.';
export const NOT_EXECUTED_TEXT = 'Tool call was not executed.';
export const SKIPPED_FOR_APPROVAL_TEXT = 'Tool call skipped: another tool call in this batch is awaiting approval. Re-issue it after the approval is resolved.';

export type AgentSessionPhase = 'idle' | 'running' | 'awaiting_approval';

export interface AgentSessionStreamingMessage {
    messageId: string;
    /** contentIndex → 上次发出的块 key，用于块级去重。 */
    blockKeys: Map<number, string>;
}

export interface AgentSessionActiveTurn {
    turnId: string;
    agent: Agent;
    registryToolNames: ReadonlySet<string>;
    messageSeq: number;
    streaming?: AgentSessionStreamingMessage;
    abortRequested: boolean;
    /** 本回合新消息在 agent.state.messages 中的起点（system + history 之后）。 */
    historyEnd: number;
    /**
     * 已在总线上发出 approval_required、尚未发出 approval_resolved 的审批。
     * 以“已宣告”而不是 session.pending 为准：pending 在处理审批前就被清空，
     * 而结束宣告时需要知道总线快照里是否还挂着 awaitingApproval、观察者是否收到过 onApprovalNeeded。
     */
    announcedApproval?: AgentSessionAnnouncedApproval;
    result?: AgentSessionTurnResult;
}

export interface AgentSessionAnnouncedApproval {
    approval: AgentSessionPendingApproval;
    /** 是否已通知观察者 onApprovalNeeded；未通知时结束宣告也不通知 onApprovalResolved，保证观察者回调成对。 */
    observerNotified: boolean;
}

export interface AgentSessionPendingState {
    approval: AgentSessionPendingApproval;
    /** 占位 toolResult 被移除前的位置；真实结果插回此处，保证紧跟发起调用的 assistant 消息。 */
    insertIndex?: number;
}

export interface AgentSessionToolOutcome {
    result: AgentRuntimeToolResult;
    isError: boolean;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const toErrorMessage = (error: unknown): string =>
    error instanceof Error && error.message.length > 0 ? error.message : String(error);

export const errorOutcome = (message: string): AgentSessionToolOutcome => ({
    result: { content: [{ type: 'text', text: message }], details: undefined },
    isError: true
});
