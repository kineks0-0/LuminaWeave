import type { Agent } from '@earendil-works/pi-agent-core';
import type { AgentRuntimeToolResult } from '../tools/AgentToolRegistry.js';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import type {
    AgentSessionPendingApproval,
    AgentSessionTurnResult,
    AgentSessionTurnStatus
} from './AgentSessionTypes.js';

// AgentSession 与其拆出模块共享的内部类型和文案。不进入 SDK 主入口导出。

export const APPROVAL_PENDING_TEXT = 'Tool approval pending.';
export const ABORTED_MESSAGE = 'Agent runtime aborted.';
export const NOT_EXECUTED_TEXT = 'Tool call was not executed.';
export const INTERRUPTED_MESSAGE = 'Interrupted by reload.';
/** 已批准但重载时结果尚未写入的调用：可能已经执行过，与普通中断区分。 */
export const RESULT_UNKNOWN_TEXT = 'Tool result unknown after reload.';
export const LOG_WRITE_FAILED = 'Failed to write session log';
export const DISCARDED_MESSAGE = 'Pending approval discarded.';
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
    /** 提供日志时的写入游标；未提供日志时为 undefined。 */
    log?: AgentSessionTurnLogCursor;
}

/**
 * 回合在日志中的写入位置。日志里该回合的 message 条目始终是本回合消息记录（historyEnd 起）的前缀，
 * committed 即已提交前缀的长度；tailId 是本回合最后写入的节点，下一条显式挂在它下面，不依赖日志 head。
 */
export interface AgentSessionTurnLogCursor {
    tailId: string | null;
    committed: number;
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

export const deniedToolText = (reason?: string): string => reason ? `Tool call denied: ${reason}` : 'Tool call denied.';

/**
 * 收口文案优先级：
 * 1. 按 error 收口（兜底 reject、前置校验失败）且带异常信息：保留真实异常，即使同时请求了中止，
 *    否则真实故障会被中止文案掩盖；
 * 2. 用户主动中止：统一使用 session 的中止文案，不透出 pi 的 'Request was aborted'；
 * 3. 依次取显式传入的文案、pi Agent 记录的错误、aborted 状态的默认中止文案。
 */
export const resolveSettleErrorMessage = (
    turn: AgentSessionActiveTurn,
    override: { status?: AgentSessionTurnStatus; errorMessage?: string },
    status: AgentSessionTurnStatus
): string | undefined => {
    if (override.status === 'error' && override.errorMessage !== undefined) return override.errorMessage;
    if (turn.abortRequested) return ABORTED_MESSAGE;
    return override.errorMessage
        ?? turn.agent.state.errorMessage
        ?? (status === 'aborted' ? ABORTED_MESSAGE : undefined);
};

export const statusFromStopReason = (message: AssistantMessage | undefined): AgentSessionTurnStatus => {
    if (message?.stopReason === 'error') return 'error';
    if (message?.stopReason === 'aborted') return 'aborted';
    return 'completed';
};
