import type { AgentMessage, AgentTool, StreamFn, ThinkingLevel } from '@earendil-works/pi-agent-core';
import type { Api, Model } from '@earendil-works/pi-ai';
import type { AgentRuntimeEventBus } from '../events/AgentRuntimeEventBus.js';
import type { AgentRuntimeToolResult, AgentToolRegistry } from '../tools/AgentToolRegistry.js';

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
    source: 'registry' | 'policy';
    details?: unknown;
}

/** 适配器工具的审批策略（例如 Forge 的联网授权）；registry 工具的审批由 AgentToolRegistry 自身决定。 */
export interface AgentSessionApprovalPolicy {
    /** 适配器工具执行前调用；返回非 null 即暂停本回合，等待审批。 */
    check(call: AgentSessionToolCall): Promise<{ details?: unknown } | null> | { details?: unknown } | null;
    /** 用户批准后执行原工具调用并返回结果；拒绝时不调用。 */
    execute(call: AgentSessionToolCall): Promise<AgentRuntimeToolResult>;
}

/** 适配器附加投影（持久化、领域事件）的观察点；均为同步通知，异常由 session 隔离。 */
export interface AgentSessionObserver {
    onApprovalNeeded?(approval: AgentSessionPendingApproval): void;
    onApprovalResolved?(input: { approval: AgentSessionPendingApproval; approved: boolean; message?: string }): void;
    /**
     * 每条消息定稿时通知（含 session 补入的审批结果、拒绝结果与中止补齐结果；不含审批占位结果）。
     * 注意顺序：审批结果在批准后才补入，会晚于同批次后续调用的结果到达；
     * 持久化应以 onTurnEnd / AgentSessionTurnResult.messages 的顺序为准。
     */
    onMessageEnd?(input: { turnId: string; message: AgentMessage }): void;
    /** 回合收口时恰好调用一次（completed / error / aborted，含拒绝审批与等待审批时中止）；暂停等待审批不触发。 */
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
}
