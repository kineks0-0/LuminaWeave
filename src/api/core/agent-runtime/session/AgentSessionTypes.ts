import type { AgentMessage, AgentTool, StreamFn, ThinkingLevel } from '@earendil-works/pi-agent-core';
import type { Api, JsonValue, Model } from '@earendil-works/pi-ai';
import type { AgentRuntimeApprovalSource, AgentRuntimeEventBus } from '../events/AgentRuntimeEventBus.js';
import type { AgentRuntimeToolResult, AgentToolRegistry } from '../tools/AgentToolRegistry.js';
import type { AgentSessionLog } from './AgentSessionLog.js';
import type { AgentSessionTreeEntry, AgentSessionTreePersistedState } from './AgentSessionTree.js';

/** 适配器为每个回合提供的运行计划。 */
export interface AgentSessionTurnPlan {
    turnId: string;
    systemPrompt: string;
    model: Model<Api>;
    streamFn: StreamFn;
    /** 本轮用户输入之前的历史消息（不含 system 消息）。 */
    history: AgentMessage[];
    /** 本轮用户输入。 */
    prompt: string;
    /** 适配器自有的 pi 工具；SDK registry 中的工具由 session 自动并入，名称冲突时抛错。 */
    tools?: AgentTool[];
    thinkingLevel?: ThinkingLevel;
}

export interface AgentSessionToolCall {
    sessionId: string;
    turnId: string;
    toolCallId: string;
    toolName: string;
    args: unknown;
}

export interface AgentSessionPendingApproval extends AgentSessionToolCall {
    source: AgentRuntimeApprovalSource;
    details?: unknown;
}

/** 适配器工具的审批策略（例如 Forge 的联网授权）；registry 工具的审批由 AgentToolRegistry 自身决定。 */
export interface AgentSessionApprovalPolicy {
    /** 适配器工具执行前调用；返回非 null 即暂停本回合，等待审批。 */
    check(call: AgentSessionToolCall): Promise<{ details?: unknown } | null> | { details?: unknown } | null;
    /** 用户批准后执行原工具调用并返回结果；拒绝时不调用。 */
    execute(call: AgentSessionToolCall): Promise<AgentRuntimeToolResult>;
    /** 重载恢复等待中的审批时调用，供适配器重建自己的待审批状态；之后照常走 execute / 拒绝。 */
    restore?(approval: AgentSessionPendingApproval): Promise<void> | void;
}

/**
 * 适配器附加投影（持久化、领域事件）的观察点；均为同步通知，异常由 session 隔离。
 *
 * 审批回调约定：
 * - onApprovalNeeded 与 onApprovalResolved 成对出现，每个已宣告的审批各一次；
 * - 审批先在总线上宣告（approval_required），onApprovalNeeded 在其之后触发；
 *   onApprovalResolved 晚于总线上的 approval_resolved；
 * - 未宣告的审批（运行中先中止、随后才登记）两者都不触发，总线上也没有对应事件；
 * - 允许在 onApprovalNeeded 中同步处理审批（resolveToolApproval / abort），此时 runTurn 返回重入后的真实结果；
 * - 若总线监听器已在 approval_required 上同步处理了审批，onApprovalNeeded 不再触发，
 *   为保持成对，onApprovalResolved 也不触发（总线上的 approval_required / approval_resolved 照常成对）。
 */
export interface AgentSessionObserver {
    onApprovalNeeded?(approval: AgentSessionPendingApproval): void;
    onApprovalResolved?(input: { approval: AgentSessionPendingApproval; approved: boolean; message?: string }): void;
    /**
     * 每条消息定稿时通知（含 session 补入的审批结果、拒绝结果与中止补齐结果；不含审批占位结果）。
     * 注意顺序：审批结果在批准后才补入，会晚于同批次后续调用的结果到达；
     * 持久化应以 onTurnEnd / AgentSessionTurnResult.messages 的顺序为准。
     */
    onMessageEnd?(input: { turnId: string; message: AgentMessage }): void;
    /**
     * 回合收口时恰好调用一次（completed / error / aborted，含拒绝审批与等待审批时中止）；暂停等待审批不触发。
     * 触发时会话已回到 idle，可在回调中直接开始下一回合。
     */
    onTurnEnd?(result: AgentSessionTurnResult): void;
}

export type AgentSessionTurnStatus = 'completed' | 'awaiting_approval' | 'aborted' | 'error';

export interface AgentSessionTurnResult {
    turnId: string;
    status: AgentSessionTurnStatus;
    errorMessage?: string;
    /**
     * 回合结束（或暂停）时 pi Agent 的消息记录，不含开头的 system 消息。
     * 暂停（awaiting_approval）时，待审批的 toolCall 暂无对应 toolResult，审批处理后才补入。
     */
    messages: AgentMessage[];
    pendingApproval?: AgentSessionPendingApproval;
}

export type AgentSessionApprovalResult = AgentSessionTurnResult | { status: 'not_found' };

export interface AgentSessionOptions {
    sessionId: string;
    events: AgentRuntimeEventBus;
    tools?: AgentToolRegistry;
    approvalPolicy?: AgentSessionApprovalPolicy;
    observer?: AgentSessionObserver;
    /** 会话日志：提供时 session 在回合检查点写入，并可从其分支推导 history、恢复等待中的审批。 */
    log?: AgentSessionLog;
    /** 时间源（user 消息时间戳）；默认 Date.now。runTurn 与 previewTurn 共用，便于测试注入固定时间。 */
    now?: () => number;
}

export interface AgentSessionModelRef {
    provider: string;
    id: string;
}

export type AgentSessionLogKind = 'message' | 'turn' | 'approval' | 'custom';

export type AgentSessionLogPayload =
    | { kind: 'message'; turnId: string; message: AgentMessage }
    | { kind: 'turn'; turnId: string; phase: 'start'; model: AgentSessionModelRef }
    | { kind: 'turn'; turnId: string; phase: 'end'; status: AgentSessionTurnStatus; errorMessage?: string }
    | { kind: 'approval'; approval: AgentSessionPendingApproval; resolution?: { approved: boolean; message?: string } }
    | { kind: 'custom'; turnId?: string; customType: string; data: JsonValue };

export type AgentSessionLogEntry = AgentSessionTreeEntry<AgentSessionLogKind, AgentSessionLogPayload>;

/** 日志的一次增量变更：追加了一个条目（entry 为深拷贝），或仅 head 移动（checkout，entry 为 undefined）。 */
export interface AgentSessionLogChange {
    entry?: AgentSessionLogEntry;
    headId: string | null;
}

export type AgentSessionLogState = AgentSessionTreePersistedState<AgentSessionLogKind, AgentSessionLogPayload>;

export interface AgentSessionRestoreInput {
    /** 当前可用的模型与工具配置；prompt / history 由日志决定。 */
    plan: Omit<AgentSessionTurnPlan, 'prompt' | 'history' | 'turnId'>;
}

export type AgentSessionRestoreResult =
    | { status: 'restored'; approval: AgentSessionPendingApproval; turnId: string }
    | { status: 'nothing_to_restore' }
    | { status: 'model_changed'; recorded: AgentSessionModelRef }
    | { status: 'tool_not_registered'; toolName: string }
    /** 审批来源是适配器策略，但会话没有挂载带 restore 的 approvalPolicy。 */
    | { status: 'policy_not_attached' };
