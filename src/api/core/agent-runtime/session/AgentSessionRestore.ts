import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { ToolResultMessage } from '@earendil-works/pi-ai';
import { toToolResultMessage } from './AgentSessionContent.js';
import {
    DISCARDED_MESSAGE,
    INTERRUPTED_MESSAGE,
    RESULT_UNKNOWN_TEXT,
    deniedToolText,
    errorOutcome
} from './AgentSessionInternals.js';
import { appendTurnLog, createCursorAtHead } from './AgentSessionTurnLog.js';
import type { AgentSessionLog } from './AgentSessionLog.js';
import type { AgentSessionModelRef, AgentSessionPendingApproval } from './AgentSessionTypes.js';
import {
    fillMissingToolResults,
    findToolResultInsertIndex,
    insertToolResultAt,
    rebuildSkippedToolResults
} from './AgentTranscriptEditor.js';

// 重载恢复的纯计算：只读日志，不碰 registry / 策略 / 会话状态，计算与校验全部完成后调用方才产生副作用。
// 下标均相对“日志消息序列”（不含 pi 补的首条 system 消息），由调用方按实际 Agent 消息记录加偏移。

export interface PendingApprovalPlan {
    approval: AgentSessionPendingApproval;
    turnId: string;
    recorded: AgentSessionModelRef;
    /** 日志分支上的全部消息，等待调用之后被跳过的结果已由 createSkippedToolResult 重建在 insertIndex 之后。 */
    messages: AgentMessage[];
    /** 等待调用的结果应插入的位置，也是日志已提交前缀的末尾。 */
    insertIndex: number;
    /** 该回合之前的消息数，即回合 user 消息的下标（historyEnd 的基准）。 */
    turnStartIndex: number;
    /** 续跑生成的总线 messageId 序号起点：本回合已提交的 assistant 消息数。 */
    messageSeq: number;
    /** 日志已提交的本回合消息数（游标）。 */
    committed: number;
    tailId: string | null;
}

interface PendingApprovalBase {
    approval: AgentSessionPendingApproval;
    turnId: string;
    recorded: AgentSessionModelRef;
    committedMessages: AgentMessage[];
    turnStartIndex: number;
    insertIndex: number | undefined;
}

const readPendingApproval = (log: AgentSessionLog): PendingApprovalBase | undefined => {
    const found = log.findPendingApproval();
    const start = found ? log.getTurnStart(found.turnId) : undefined;
    if (!found || !start) return undefined;
    const committedMessages = log.branchMessages({ maxMessages: 0 });
    return {
        approval: found.approval,
        turnId: found.turnId,
        recorded: start.model,
        committedMessages,
        turnStartIndex: start.messagesBefore,
        insertIndex: findToolResultInsertIndex(committedMessages, found.approval.toolCallId)
    };
};

/**
 * 从日志推导等待中的审批的完整恢复现场；没有等待中的审批返回 undefined。
 * 日志缺少发起该调用的 assistant 消息（日志损坏）时抛错，此时尚无任何副作用。
 */
export const planPendingApproval = (log: AgentSessionLog): PendingApprovalPlan | undefined => {
    const base = readPendingApproval(log);
    if (!base) return undefined;
    const { approval, committedMessages, turnStartIndex, insertIndex } = base;
    if (insertIndex === undefined) {
        throw new Error(`Agent session log has no tool call for the pending approval: ${approval.toolCallId}`);
    }
    return {
        approval,
        turnId: base.turnId,
        recorded: base.recorded,
        messages: rebuildSkippedToolResults(committedMessages, insertIndex, approval.toolCallId),
        insertIndex,
        turnStartIndex,
        messageSeq: committedMessages.slice(turnStartIndex).filter(message => message.role === 'assistant').length,
        committed: committedMessages.length - turnStartIndex,
        tailId: log.getHeadId()
    };
};

export interface RestoreCapabilities {
    currentModel: AgentSessionModelRef;
    hasRegistryTool: (toolName: string) => boolean;
    /** 是否挂载了带 restore 的 approvalPolicy。 */
    hasPolicyRestore: boolean;
}

export type RestorePlan =
    | ({ status: 'ready' } & PendingApprovalPlan)
    | { status: 'nothing_to_restore' }
    | { status: 'model_changed'; recorded: AgentSessionModelRef }
    | { status: 'tool_not_registered'; toolName: string }
    | { status: 'policy_not_attached' };

export const planRestore = (log: AgentSessionLog, capabilities: RestoreCapabilities): RestorePlan => {
    const plan = planPendingApproval(log);
    if (!plan) return { status: 'nothing_to_restore' };
    const { currentModel } = capabilities;
    if (plan.recorded.provider !== currentModel.provider || plan.recorded.id !== currentModel.id) {
        return { status: 'model_changed', recorded: plan.recorded };
    }
    if (plan.approval.source === 'registry') {
        if (!capabilities.hasRegistryTool(plan.approval.toolName)) {
            return { status: 'tool_not_registered', toolName: plan.approval.toolName };
        }
    } else if (!capabilities.hasPolicyRestore) {
        return { status: 'policy_not_attached' };
    }
    return { status: 'ready', ...plan };
};

export interface InterruptedTurnClosePlan {
    turnId: string;
    /** turn:end 的 errorMessage；调用方传入 reason 时也是补齐结果的文案。 */
    reason: string;
    /** 需要补写的 isError 结果。 */
    results: ToolResultMessage[];
}

/**
 * 被中断（有 turn:start、无 turn:end、无未解决审批）的回合的收口计算。
 * 已批准但结果缺失的调用可能已经执行过，用 RESULT_UNKNOWN_TEXT 与普通中断区分。
 * 中断时日志停在本回合最后一条已提交消息，缺结果的调用只可能在末尾的 toolResult 段，补入后仍是追加。
 */
export const planInterruptedTurnClose = (log: AgentSessionLog, reason?: string): InterruptedTurnClosePlan | undefined => {
    const found = log.findInterruptedTurn();
    if (!found) return undefined;
    const { turnId } = found;
    const messagesBefore = log.getTurnStart(turnId)?.messagesBefore ?? 0;
    const turnMessages = log.branchMessages({ maxMessages: 0 }).slice(messagesBefore);
    const approved = new Set(log.getTurnPayloads(turnId).flatMap(payload =>
        payload.kind === 'approval' && payload.resolution?.approved ? [payload.approval.toolCallId] : []
    ));
    const { filled } = fillMissingToolResults(
        turnMessages,
        0,
        toolCallId => reason === undefined && approved.has(toolCallId) ? RESULT_UNKNOWN_TEXT : reason ?? INTERRUPTED_MESSAGE
    );
    return { turnId, reason: reason ?? INTERRUPTED_MESSAGE, results: filled };
};

export interface DiscardApprovalPlan {
    approval: AgentSessionPendingApproval;
    turnId: string;
    /** 需要补写的消息：拒绝结果在前，其后是被跳过调用的错误结果。 */
    results: AgentMessage[];
}

/**
 * 丢弃等待中的审批：为等待调用补拒绝结果，保证日志里该回合的 toolCall 都有结果。
 * 日志损坏（找不到发起调用）时没有结果可补，仍然关闭该回合，这正是损坏日志唯一的出路。
 */
export const planDiscardApproval = (log: AgentSessionLog, message?: string): DiscardApprovalPlan | undefined => {
    const base = readPendingApproval(log);
    if (!base) return undefined;
    const { approval, turnId, committedMessages, insertIndex } = base;
    if (insertIndex === undefined) return { approval, turnId, results: [] };
    const denied = toToolResultMessage(approval, errorOutcome(deniedToolText(message)));
    const all = insertToolResultAt(
        rebuildSkippedToolResults(committedMessages, insertIndex, approval.toolCallId),
        insertIndex,
        denied
    );
    return { approval, turnId, results: all.slice(insertIndex) };
};

/** 写入收口条目；任一条失败立即停止（不写 turn:end）并返回 false。 */
export const writeInterruptedTurnClose = (log: AgentSessionLog, plan: InterruptedTurnClosePlan): boolean => {
    const { turnId } = plan;
    const cursor = createCursorAtHead(log);
    for (const message of plan.results) {
        if (!appendTurnLog(log, cursor, { kind: 'message', turnId, message })) return false;
    }
    return appendTurnLog(log, cursor, { kind: 'turn', turnId, phase: 'end', status: 'aborted', errorMessage: plan.reason });
};

export const writeDiscardedApproval = (log: AgentSessionLog, plan: DiscardApprovalPlan, message?: string): boolean => {
    const { approval, turnId } = plan;
    const cursor = createCursorAtHead(log);
    const resolved = appendTurnLog(log, cursor, {
        kind: 'approval',
        approval: { ...approval },
        resolution: { approved: false, ...(message !== undefined ? { message } : {}) }
    });
    if (!resolved) return false;
    for (const result of plan.results) {
        if (!appendTurnLog(log, cursor, { kind: 'message', turnId, message: result })) return false;
    }
    return appendTurnLog(log, cursor, {
        kind: 'turn',
        turnId,
        phase: 'end',
        status: 'aborted',
        errorMessage: message ?? DISCARDED_MESSAGE
    });
};
