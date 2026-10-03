import {
    Agent,
    type AgentMessage,
    type BeforeToolCallContext,
    type BeforeToolCallResult
} from '@earendil-works/pi-agent-core';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import type { AgentRuntimeEvent } from '../events/AgentRuntimeEventBus.js';
import { toJsonValue } from '../runtime/AgentJsonValue.js';
import { AgentSessionEventProjector } from './AgentSessionEventProjector.js';
import {
    ABORTED_MESSAGE,
    APPROVAL_PENDING_TEXT,
    NOT_EXECUTED_TEXT,
    SKIPPED_FOR_APPROVAL_TEXT,
    errorOutcome,
    toErrorMessage,
    type AgentSessionActiveTurn,
    type AgentSessionPendingState,
    type AgentSessionPhase,
    type AgentSessionToolOutcome
} from './AgentSessionInternals.js';
import { toBusToolResult, toToolResultMessage } from './AgentSessionContent.js';
import { mergeTools, toToolCall } from './AgentSessionToolBinding.js';
import type {
    AgentSessionApprovalResult,
    AgentSessionOptions,
    AgentSessionPendingApproval,
    AgentSessionToolCall,
    AgentSessionTurnPlan,
    AgentSessionTurnResult,
    AgentSessionTurnStatus
} from './AgentSessionTypes.js';
import {
    fillMissingToolResults,
    insertToolResultAt,
    lastAssistant,
    removeLastToolResult,
    stripSystemMessage
} from './AgentTranscriptEditor.js';

/**
 * 与具体应用无关的 pi Agent 会话。
 *
 * - 总线上的一个“回合”对应 pi 的 agent_start → agent_end（含审批续跑）；
 *   pi 每次 LLM 调用产生的 turn_start/turn_end 是内部细节，不转发，否则续跑会出现多组回合事件。
 * - 每个回合新建一个 pi Agent；审批续跑沿用同一个 Agent 与 turnId。
 * - 同一时刻只允许一个等待中的审批：续跑需要 transcript 以该调用的 toolResult 结尾，
 *   多个并存的审批会让 transcript 处于无法续跑的中间态。同批次后续调用会被跳过并要求模型重发。
 *
 * 本类只持有生命周期状态（phase / turn / pending / inFlight）并编排调用；
 * 事件投影、工具接入、消息记录修补分别在 AgentSessionEventProjector / AgentSessionToolBinding /
 * AgentTranscriptEditor 中，它们不持有会话状态。
 */
export class AgentSession {
    readonly sessionId: string;
    private readonly options: AgentSessionOptions;
    private readonly projector: AgentSessionEventProjector;
    private phase: AgentSessionPhase = 'idle';
    private turn: AgentSessionActiveTurn | undefined;
    private pending: AgentSessionPendingState | undefined;
    private inFlight: Promise<AgentSessionTurnResult> | undefined;

    constructor(options: AgentSessionOptions) {
        this.sessionId = options.sessionId;
        this.options = options;
        this.projector = new AgentSessionEventProjector({
            sessionId: options.sessionId,
            emit: event => this.emit(event),
            isPendingToolCall: toolCallId => this.isPendingToolCall(toolCallId),
            notifyMessageEnd: (turnId, message) => this.notifyMessageEnd(turnId, message)
        });
    }

    async runTurn(plan: AgentSessionTurnPlan): Promise<AgentSessionTurnResult> {
        if (this.phase !== 'idle') throw new Error('AgentSession is busy');
        // pi 只在 messages 不以 system 开头时才用 systemPrompt 生成首条 system 消息；
        // history 混入 system 会静默替换本回合系统提示词或残留旧的工具声明，因此直接拒绝。
        if (plan.history.some(message => message.role === 'system')) {
            throw new Error('AgentSession history must not contain system messages; pass the prompt via plan.systemPrompt.');
        }
        const tools = mergeTools({ turnId: plan.turnId, adapterTools: plan.tools ?? [] }, {
            sessionId: this.sessionId,
            registry: this.options.tools,
            onApprovalRequired: approval => {
                this.pending = { approval };
            }
        });
        const turn: AgentSessionActiveTurn = {
            turnId: plan.turnId,
            agent: new Agent({
                initialState: {
                    systemPrompt: plan.systemPrompt,
                    messages: plan.history,
                    tools: tools.agentTools,
                    model: plan.model,
                    thinkingLevel: plan.thinkingLevel ?? 'off'
                },
                streamFn: plan.streamFn,
                sessionId: this.sessionId,
                // 顺序执行才能保证“先登记的审批之后，同批次其余调用都被跳过”的判断没有竞态。
                toolExecution: 'sequential',
                beforeToolCall: async context => this.handleBeforeToolCall(turn, context),
                // pi 只在整批结果都带 terminate 时才提前结束；批次里先于审批执行的普通工具不带 terminate，
                // 因此这里在有等待审批时强制结束本次循环，避免模型拿着占位结果被再次调用。
                finishTurn: () => this.pending ? { action: 'end' } : undefined
            }),
            registryToolNames: tools.registryToolNames,
            messageSeq: 0,
            abortRequested: false,
            historyEnd: 0
        };
        turn.historyEnd = turn.agent.state.messages.length;
        this.phase = 'running';
        this.turn = turn;
        turn.agent.subscribe(event => {
            if (this.turn !== turn) return;
            this.projector.handle(turn, event);
        });
        this.emit({ type: 'agent_start', sessionId: this.sessionId, turnId: turn.turnId });
        this.emit({ type: 'turn_start', sessionId: this.sessionId, turnId: turn.turnId });
        return this.track(turn, this.drive(turn, () => turn.agent.prompt(plan.prompt)));
    }

    async resolveToolApproval(
        turnId: string,
        toolCallId: string,
        approved: boolean,
        message?: string
    ): Promise<AgentSessionApprovalResult> {
        const pending = this.pending;
        const turn = this.turn;
        if (
            this.phase !== 'awaiting_approval'
            || !pending
            || !turn
            || pending.approval.turnId !== turnId
            || pending.approval.toolCallId !== toolCallId
        ) {
            return { status: 'not_found' };
        }
        this.pending = undefined;
        this.phase = 'running';
        return this.track(turn, this.resolvePending(turn, pending, approved, message));
    }

    async abort(): Promise<void> {
        const turn = this.turn;
        if (this.phase === 'idle' || !turn) return;
        turn.abortRequested = true;
        const pending = this.pending;
        if (this.phase === 'awaiting_approval' && pending) {
            this.pending = undefined;
            this.phase = 'running';
            await this.track(turn, this.cancelPendingAndFinish(turn, pending));
            return;
        }
        // 运行中：pi 的 abort 让 prompt()/continue() 正常返回（不 reject），由 drive 统一按 aborted 收口。
        turn.agent.abort();
        await this.inFlight;
    }

    getPendingApproval(): AgentSessionPendingApproval | undefined {
        return this.pending ? { ...this.pending.approval } : undefined;
    }

    /** 兜底：run promise 意外 reject 时按 error 收口，避免会话永久停在 running、后续回合全部 busy。 */
    private track(turn: AgentSessionActiveTurn, run: Promise<AgentSessionTurnResult>): Promise<AgentSessionTurnResult> {
        const guarded = run.catch((error: unknown) => {
            console.error({ error }, 'Agent session run failed unexpectedly.');
            return this.settleTurn(turn, { status: 'error', errorMessage: toErrorMessage(error) });
        });
        this.inFlight = guarded;
        return guarded;
    }

    /** 跑一次 pi 循环（prompt 或 continue），再决定暂停等待审批还是收口。 */
    private async drive(turn: AgentSessionActiveTurn, run: () => Promise<void>): Promise<AgentSessionTurnResult> {
        try {
            await run();
        } catch (error: unknown) {
            // pi 会把循环内异常编码成 stopReason:error 的消息；走到这里说明是 prompt/continue 前置校验失败。
            return this.settleTurn(turn, { status: 'error', errorMessage: toErrorMessage(error) });
        }
        const pending = this.pending;
        if (!pending) return this.settleTurn(turn);
        // 中止分支也需要先移除占位：拒绝结果要插回占位原位置。
        this.removePlaceholder(turn, pending);
        if (turn.abortRequested) {
            // 审批登记于中止之后：从未宣告，cancelPendingAndFinish 不会发 approval_resolved 或通知观察者。
            this.pending = undefined;
            return this.cancelPendingAndFinish(turn, pending);
        }
        return this.pauseForApproval(turn, pending);
    }

    /**
     * 暂停等待审批：设 phase → 宣告（approval_required）→ 构造返回值 → 最后通知 onApprovalNeeded。
     * 总线监听器（宣告时）与观察者（通知时）都可能同步处理审批（重入 resolveToolApproval / abort）。
     * 因此宣告之后、通知之后各按状态检查一次：已被重入推进就不再通知观察者，
     * 并返回重入产生的运行结果，而不是过时的 awaiting_approval。
     */
    private async pauseForApproval(
        turn: AgentSessionActiveTurn,
        pending: AgentSessionPendingState
    ): Promise<AgentSessionTurnResult> {
        this.phase = 'awaiting_approval';
        this.announceApproval(turn, pending.approval);
        const resolvedOnAnnounce = this.reentrantRun(pending);
        if (resolvedOnAnnounce) return resolvedOnAnnounce;
        const paused: AgentSessionTurnResult = {
            turnId: turn.turnId,
            status: 'awaiting_approval',
            messages: this.transcript(turn),
            pendingApproval: { ...pending.approval }
        };
        const approval = { ...pending.approval };
        if (turn.announcedApproval) turn.announcedApproval.observerNotified = true;
        this.notify(() => this.options.observer?.onApprovalNeeded?.(approval));
        return this.reentrantRun(pending) ?? paused;
    }

    /**
     * 暂停后若审批已被同步重入处理，返回重入产生的运行；仍在等待（含重入返回 not_found）时返回 undefined。
     * 判定看状态而不比较 promise：离开该等待只有 resolveToolApproval / abort 两条路径，
     * 二者都先清 pending、改 phase，再同步经 track 把 inFlight 换成新运行，所以此时 inFlight 就是重入运行。
     */
    private reentrantRun(pending: AgentSessionPendingState): Promise<AgentSessionTurnResult> | undefined {
        if (this.pending === pending && this.phase === 'awaiting_approval') return undefined;
        const run = this.inFlight;
        if (!run) throw new Error('AgentSession left an approval wait without a tracked run.');
        return run;
    }

    private async resolvePending(
        turn: AgentSessionActiveTurn,
        pending: AgentSessionPendingState,
        approved: boolean,
        message?: string
    ): Promise<AgentSessionTurnResult> {
        this.resolveAnnouncedApproval(turn, approved, message);
        if (!approved) {
            await this.denyPending(turn, pending, message);
            return this.settleTurn(turn);
        }
        const outcome = await this.executeApproved(pending.approval, message);
        this.insertAndNotifyToolResult(turn, pending, outcome);
        if (turn.abortRequested) {
            return this.settleTurn(turn, { status: 'aborted', errorMessage: ABORTED_MESSAGE });
        }
        return this.drive(turn, () => turn.agent.continue());
    }

    private async cancelPendingAndFinish(
        turn: AgentSessionActiveTurn,
        pending: AgentSessionPendingState
    ): Promise<AgentSessionTurnResult> {
        this.resolveAnnouncedApproval(turn, false, ABORTED_MESSAGE);
        await this.denyPending(turn, pending, ABORTED_MESSAGE);
        return this.settleTurn(turn, { status: 'aborted', errorMessage: ABORTED_MESSAGE });
    }

    /**
     * 拒绝（或因中止取消）等待中的调用。除了发出 denied 事件，还补一条带拒绝原因的 isError toolResult：
     * 让模型在后续回合看到拒绝原因，并保持持久化的消息记录自洽
     * （否则 pi-ai transformMessages 只会合成一条无信息的 'No result provided'）。
     */
    private async denyPending(
        turn: AgentSessionActiveTurn,
        pending: AgentSessionPendingState,
        reason?: string
    ): Promise<void> {
        const { approval } = pending;
        if (approval.source === 'registry') {
            await this.options.tools?.resolveToolApproval(
                this.sessionId,
                approval.turnId,
                approval.toolCallId,
                false,
                reason
            );
        } else {
            this.emit({
                type: 'tool_execution_end',
                sessionId: this.sessionId,
                turnId: approval.turnId,
                toolCallId: approval.toolCallId,
                toolName: approval.toolName,
                status: 'denied',
                ...(reason !== undefined ? { errorMessage: reason } : {})
            });
        }
        const text = reason ? `Tool call denied: ${reason}` : 'Tool call denied.';
        this.insertAndNotifyToolResult(turn, pending, {
            result: { content: [{ type: 'text', text }], details: undefined },
            isError: true
        });
    }

    private async executeApproved(
        approval: AgentSessionPendingApproval,
        message?: string
    ): Promise<AgentSessionToolOutcome> {
        if (approval.source === 'registry') {
            const tools = this.options.tools;
            if (!tools) return errorOutcome('Agent tool registry is not attached.');
            try {
                const resolution = await tools.resolveToolApproval(
                    this.sessionId,
                    approval.turnId,
                    approval.toolCallId,
                    true,
                    message
                );
                if (resolution.status === 'approved') return { result: resolution.result, isError: false };
                return errorOutcome('Tool approval could not be resolved.');
            } catch (error: unknown) {
                // registry 已发出 failed 的 tool_execution_end；这里只把错误作为工具结果交还模型。
                return errorOutcome(toErrorMessage(error));
            }
        }
        const policy = this.options.approvalPolicy;
        if (!policy) return errorOutcome('Agent approval policy is not attached.');
        try {
            const result = await policy.execute(toToolCall(approval));
            this.emit({
                type: 'tool_execution_end',
                sessionId: this.sessionId,
                turnId: approval.turnId,
                toolCallId: approval.toolCallId,
                toolName: approval.toolName,
                status: 'completed',
                result: toBusToolResult(result)
            });
            return { result, isError: false };
        } catch (error: unknown) {
            const errorMessage = toErrorMessage(error);
            this.emit({
                type: 'tool_execution_end',
                sessionId: this.sessionId,
                turnId: approval.turnId,
                toolCallId: approval.toolCallId,
                toolName: approval.toolName,
                status: 'failed',
                errorMessage
            });
            return errorOutcome(errorMessage);
        }
    }

    /** 回合收口：每个回合恰好一次（幂等）。 */
    private settleTurn(
        turn: AgentSessionActiveTurn,
        override: { status?: AgentSessionTurnStatus; errorMessage?: string } = {}
    ): AgentSessionTurnResult {
        if (turn.result) return turn.result;
        const status = override.status
            ?? (turn.abortRequested ? 'aborted' : statusFromStopReason(lastAssistant(turn.agent.state.messages)));
        const errorMessage = resolveSettleErrorMessage(turn, override, status);
        // 防御性收口：总线上仍挂着已宣告的审批时，先发出拒绝再发 turn_end，保证 approval_required /
        // approval_resolved 成对。当前没有已知触发路径——暂停后只能经 resolvePending / cancelPendingAndFinish
        // 推进回合（观察者重入也走这两条），二者都在任何异步步骤之前结束宣告；保留它是为了将来新增的
        // 收口路径不会在快照里留下悬空的 awaitingApproval。
        this.resolveAnnouncedApproval(turn, false);
        const filled = fillMissingToolResults(
            turn.agent.state.messages,
            turn.historyEnd,
            turn.abortRequested ? ABORTED_MESSAGE : NOT_EXECUTED_TEXT
        );
        if (filled.filled.length > 0) turn.agent.state.messages = filled.messages;
        for (const message of filled.filled) {
            this.notifyMessageEnd(turn.turnId, message);
        }
        this.emit({
            type: 'turn_end',
            sessionId: this.sessionId,
            turnId: turn.turnId,
            ...(errorMessage !== undefined ? { errorMessage } : {})
        });
        this.emit({ type: 'agent_end', sessionId: this.sessionId, turnId: turn.turnId });
        const result: AgentSessionTurnResult = {
            turnId: turn.turnId,
            status,
            ...(errorMessage !== undefined ? { errorMessage } : {}),
            messages: this.transcript(turn)
        };
        turn.result = result;
        if (this.turn === turn) {
            this.turn = undefined;
            this.pending = undefined;
            this.phase = 'idle';
        }
        this.notify(() => this.options.observer?.onTurnEnd?.(result));
        return result;
    }

    private async handleBeforeToolCall(
        turn: AgentSessionActiveTurn,
        context: BeforeToolCallContext
    ): Promise<BeforeToolCallResult | undefined> {
        if (this.pending) {
            // 适配器工具被跳过时总线收到 failed 的 end；registry 工具被跳过时总线无事件（见 AgentSessionEventProjector）。
            return { block: true, reason: SKIPPED_FOR_APPROVAL_TEXT, terminate: true };
        }
        const toolName = context.toolCall.name;
        if (turn.registryToolNames.has(toolName)) return undefined;
        const policy = this.options.approvalPolicy;
        if (!policy) return undefined;
        const call: AgentSessionToolCall = {
            sessionId: this.sessionId,
            turnId: turn.turnId,
            toolCallId: context.toolCall.id,
            toolName,
            args: context.args
        };
        const decision = await policy.check(call);
        if (!decision) return undefined;
        this.pending = {
            approval: {
                ...call,
                source: 'policy',
                ...(decision.details !== undefined ? { details: decision.details } : {})
            }
        };
        return { block: true, reason: APPROVAL_PENDING_TEXT, terminate: true };
    }

    /** 在总线上宣告等待中的审批（approval_required），并记为已宣告。不改 phase，不通知观察者。 */
    private announceApproval(turn: AgentSessionActiveTurn, approval: AgentSessionPendingApproval): void {
        turn.announcedApproval = { approval: { ...approval }, observerNotified: false };
        this.emit({
            type: 'approval_required',
            sessionId: this.sessionId,
            turnId: turn.turnId,
            toolCallId: approval.toolCallId,
            toolName: approval.toolName,
            args: toJsonValue(approval.args),
            source: approval.source
        });
    }

    /**
     * 结束已宣告的审批：先发总线 approval_resolved，再通知观察者 onApprovalResolved，每个宣告恰好一次。
     * 未宣告（审批登记于中止之后）时两者都不发；观察者未收到 onApprovalNeeded（总线监听器在宣告时
     * 已同步处理）时也不通知 onApprovalResolved。总线事件与观察者回调因此各自成对。
     */
    private resolveAnnouncedApproval(turn: AgentSessionActiveTurn, approved: boolean, message?: string): void {
        const announced = turn.announcedApproval;
        if (!announced) return;
        turn.announcedApproval = undefined;
        const { approval } = announced;
        this.emit({
            type: 'approval_resolved',
            sessionId: this.sessionId,
            turnId: turn.turnId,
            toolCallId: approval.toolCallId,
            approved
        });
        if (!announced.observerNotified) return;
        this.notify(() => this.options.observer?.onApprovalResolved?.({
            approval,
            approved,
            ...(message !== undefined ? { message } : {})
        }));
    }

    /** 暂停时移除审批占位 toolResult，并记住位置以便真实结果插回原处（幂等）。 */
    private removePlaceholder(turn: AgentSessionActiveTurn, pending: AgentSessionPendingState): void {
        if (pending.insertIndex !== undefined) return;
        const removed = removeLastToolResult(turn.agent.state.messages, pending.approval.toolCallId);
        if (removed.index === undefined) return;
        turn.agent.state.messages = removed.messages;
        pending.insertIndex = removed.index;
    }

    /** 把审批处理后的结果插回占位原位置（没有占位时追加到末尾），并通知观察者。 */
    private insertAndNotifyToolResult(
        turn: AgentSessionActiveTurn,
        pending: AgentSessionPendingState,
        outcome: AgentSessionToolOutcome
    ): void {
        const message = toToolResultMessage(pending.approval, outcome);
        const messages = turn.agent.state.messages;
        turn.agent.state.messages = insertToolResultAt(messages, pending.insertIndex ?? messages.length, message);
        this.notifyMessageEnd(turn.turnId, message);
    }

    private transcript(turn: AgentSessionActiveTurn): AgentMessage[] {
        return stripSystemMessage(turn.agent.state.messages);
    }

    private isPendingToolCall(toolCallId: string): boolean {
        return this.pending?.approval.toolCallId === toolCallId;
    }

    private emit(event: AgentRuntimeEvent): void {
        this.options.events.emit(event);
    }

    private notifyMessageEnd(turnId: string, message: AgentMessage): void {
        this.notify(() => this.options.observer?.onMessageEnd?.({ turnId, message }));
    }

    private notify(callback: () => void): void {
        try {
            callback();
        } catch (error: unknown) {
            console.error({ error }, 'Agent session observer failed.');
        }
    }
}

/**
 * 收口文案优先级：
 * 1. 按 error 收口（兜底 reject、前置校验失败）且带异常信息：保留真实异常，即使同时请求了中止，
 *    否则真实故障会被中止文案掩盖；
 * 2. 用户主动中止：统一使用 session 的中止文案，不透出 pi 的 'Request was aborted'；
 * 3. 依次取显式传入的文案、pi Agent 记录的错误、aborted 状态的默认中止文案。
 */
const resolveSettleErrorMessage = (
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

const statusFromStopReason = (message: AssistantMessage | undefined): AgentSessionTurnStatus => {
    if (message?.stopReason === 'error') return 'error';
    if (message?.stopReason === 'aborted') return 'aborted';
    return 'completed';
};
