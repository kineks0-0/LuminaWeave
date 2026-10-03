import {
    Agent,
    type AgentEvent,
    type AgentMessage,
    type AgentTool,
    type AgentToolResult,
    type BeforeToolCallContext,
    type BeforeToolCallResult
} from '@earendil-works/pi-agent-core';
import type { AssistantMessage, ImageContent, JsonValue, TextContent, ToolResultMessage } from '@earendil-works/pi-ai';
import type { AgentRuntimeContentBlock, AgentRuntimeEvent } from '../events/AgentRuntimeEventBus.js';
import { toJsonValue } from '../runtime/AgentJsonValue.js';
import type { AgentRuntimeTool, AgentRuntimeToolResult, AgentToolRegistry } from '../tools/AgentToolRegistry.js';
import { blockKey, projectAssistantBlocks } from './AgentMessageProjection.js';
import type {
    AgentSessionApprovalResult,
    AgentSessionOptions,
    AgentSessionPendingApproval,
    AgentSessionToolCall,
    AgentSessionTurnPlan,
    AgentSessionTurnResult,
    AgentSessionTurnStatus
} from './AgentSessionTypes.js';

const APPROVAL_PENDING_TEXT = 'Tool approval pending.';
const ABORTED_MESSAGE = 'Agent runtime aborted.';
const NOT_EXECUTED_TEXT = 'Tool call was not executed.';
const SKIPPED_FOR_APPROVAL_TEXT = 'Tool call skipped: another tool call in this batch is awaiting approval. Re-issue it after the approval is resolved.';

type AgentSessionPhase = 'idle' | 'running' | 'awaiting_approval';

interface AgentSessionStreamingMessage {
    messageId: string;
    /** contentIndex → 上次发出的块 key，用于块级去重。 */
    blockKeys: Map<number, string>;
}

interface AgentSessionActiveTurn {
    turnId: string;
    agent: Agent;
    registryToolNames: ReadonlySet<string>;
    messageSeq: number;
    streaming?: AgentSessionStreamingMessage;
    abortRequested: boolean;
    /** 本回合新消息在 agent.state.messages 中的起点（system + history 之后）。 */
    historyEnd: number;
    result?: AgentSessionTurnResult;
}

interface AgentSessionPendingState {
    approval: AgentSessionPendingApproval;
    /** 占位 toolResult 被移除前的位置；真实结果插回此处，保证紧跟发起调用的 assistant 消息。 */
    insertIndex?: number;
}

interface AgentSessionToolOutcome {
    result: AgentRuntimeToolResult;
    isError: boolean;
}

/**
 * 与具体应用无关的 pi Agent 会话。
 *
 * - 总线上的一个“回合”对应 pi 的 agent_start → agent_end（含审批续跑）；
 *   pi 每次 LLM 调用产生的 turn_start/turn_end 是内部细节，不转发，否则续跑会出现多组回合事件。
 * - 每个回合新建一个 pi Agent；审批续跑沿用同一个 Agent 与 turnId。
 * - 同一时刻只允许一个等待中的审批：续跑需要 transcript 以该调用的 toolResult 结尾，
 *   多个并存的审批会让 transcript 处于无法续跑的中间态。同批次后续调用会被跳过并要求模型重发。
 */
export class AgentSession {
    readonly sessionId: string;
    private readonly options: AgentSessionOptions;
    private phase: AgentSessionPhase = 'idle';
    private turn: AgentSessionActiveTurn | undefined;
    private pending: AgentSessionPendingState | undefined;
    private inFlight: Promise<AgentSessionTurnResult> | undefined;

    constructor(options: AgentSessionOptions) {
        this.sessionId = options.sessionId;
        this.options = options;
    }

    async runTurn(plan: AgentSessionTurnPlan): Promise<AgentSessionTurnResult> {
        if (this.phase !== 'idle') throw new Error('AgentSession is busy');
        // pi 只在 messages 不以 system 开头时才用 systemPrompt 生成首条 system 消息；
        // history 混入 system 会静默替换本回合系统提示词或残留旧的工具声明，因此直接拒绝。
        if (plan.history.some(message => message.role === 'system')) {
            throw new Error('AgentSession history must not contain system messages; pass the prompt via plan.systemPrompt.');
        }
        const tools = this.mergeTools(plan);
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
        turn.agent.subscribe(event => this.handleAgentEvent(turn, event));
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
        this.removePlaceholder(turn, pending);
        if (turn.abortRequested) {
            this.pending = undefined;
            return this.cancelPendingAndFinish(turn, pending);
        }
        this.phase = 'awaiting_approval';
        const approval = { ...pending.approval };
        this.notify(() => this.options.observer?.onApprovalNeeded?.(approval));
        return {
            turnId: turn.turnId,
            status: 'awaiting_approval',
            messages: this.transcript(turn),
            pendingApproval: { ...pending.approval }
        };
    }

    private async resolvePending(
        turn: AgentSessionActiveTurn,
        pending: AgentSessionPendingState,
        approved: boolean,
        message?: string
    ): Promise<AgentSessionTurnResult> {
        const approval = { ...pending.approval };
        this.notify(() => this.options.observer?.onApprovalResolved?.({
            approval,
            approved,
            ...(message !== undefined ? { message } : {})
        }));
        if (!approved) {
            await this.denyPending(turn, pending, message);
            return this.settleTurn(turn);
        }
        const outcome = await this.executeApproved(pending.approval, message);
        this.insertToolResult(turn, pending, outcome);
        if (turn.abortRequested) {
            return this.settleTurn(turn, { status: 'aborted', errorMessage: ABORTED_MESSAGE });
        }
        return this.drive(turn, () => turn.agent.continue());
    }

    private async cancelPendingAndFinish(
        turn: AgentSessionActiveTurn,
        pending: AgentSessionPendingState
    ): Promise<AgentSessionTurnResult> {
        const approval = { ...pending.approval };
        this.notify(() => this.options.observer?.onApprovalResolved?.({
            approval,
            approved: false,
            message: ABORTED_MESSAGE
        }));
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
        this.insertToolResult(turn, pending, {
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
        // 用户主动中止时统一使用 session 的中止文案，不透出 pi 的 'Request was aborted'。
        const errorMessage = turn.abortRequested
            ? ABORTED_MESSAGE
            : override.errorMessage
                ?? turn.agent.state.errorMessage
                ?? (status === 'aborted' ? ABORTED_MESSAGE : undefined);
        this.fillMissingToolResults(turn);
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

    /**
     * 为本回合中缺少结果的 toolCall 补 isError toolResult，保证 result.messages 自洽。
     * 主要来源是中止：pi 顺序执行时在 abort 后直接 break，同批次剩余调用既不执行也不产生结果。
     * 只处理正常结束的 assistant 消息；error/aborted 的 assistant 消息在 pi-ai 重放时整条被跳过，
     * 为它们补结果反而会制造孤立 toolResult。
     */
    private fillMissingToolResults(turn: AgentSessionActiveTurn): void {
        const messages = turn.agent.state.messages;
        const text = turn.abortRequested ? ABORTED_MESSAGE : NOT_EXECUTED_TEXT;
        const next: AgentMessage[] = [];
        const filled: ToolResultMessage[] = [];
        let index = 0;
        while (index < messages.length) {
            const message = messages[index];
            next.push(message);
            index += 1;
            if (
                index <= turn.historyEnd
                || message.role !== 'assistant'
                || message.stopReason === 'error'
                || message.stopReason === 'aborted'
            ) continue;
            const answered = new Set<string>();
            while (index < messages.length) {
                const candidate = messages[index];
                if (candidate.role !== 'toolResult') break;
                answered.add(candidate.toolCallId);
                next.push(candidate);
                index += 1;
            }
            for (const part of message.content) {
                if (part.type !== 'toolCall' || answered.has(part.id)) continue;
                const result = toToolResultMessage({ toolCallId: part.id, toolName: part.name }, errorOutcome(text));
                next.push(result);
                filled.push(result);
            }
        }
        if (filled.length === 0) return;
        turn.agent.state.messages = next;
        for (const message of filled) {
            this.notify(() => this.options.observer?.onMessageEnd?.({ turnId: turn.turnId, message }));
        }
    }

    private handleAgentEvent(turn: AgentSessionActiveTurn, event: AgentEvent): void {
        if (this.turn !== turn) return;
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
                this.emit({
                    type: 'tool_execution_start',
                    sessionId: this.sessionId,
                    turnId: turn.turnId,
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    args: toJsonValue(event.args)
                });
                return;
            case 'tool_execution_update': {
                if (turn.registryToolNames.has(event.toolName)) return;
                const partial: unknown = event.partialResult;
                this.emit({
                    type: 'tool_execution_update',
                    sessionId: this.sessionId,
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
                if (this.isPendingToolCall(event.toolCallId)) return;
                const result = toBusToolResultFromUnknown(event.result);
                this.emit({
                    type: 'tool_execution_end',
                    sessionId: this.sessionId,
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
        const messageId = `agent-message:${this.sessionId}:${turn.turnId}:${turn.messageSeq}`;
        turn.streaming = { messageId, blockKeys: new Map() };
        this.emit({
            type: 'message_start',
            sessionId: this.sessionId,
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
            this.emit({
                type: 'message_update',
                sessionId: this.sessionId,
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
                this.emit({
                    type: 'message_end',
                    sessionId: this.sessionId,
                    turnId: turn.turnId,
                    messageId: streaming.messageId
                });
            }
            turn.streaming = undefined;
        }
        // 审批占位 toolResult 会在暂停时从 transcript 移除，不通知观察者，避免适配器持久化一条假结果。
        if (message.role === 'toolResult' && this.isPendingToolCall(message.toolCallId)) return;
        this.notify(() => this.options.observer?.onMessageEnd?.({ turnId: turn.turnId, message }));
    }

    private async handleBeforeToolCall(
        turn: AgentSessionActiveTurn,
        context: BeforeToolCallContext
    ): Promise<BeforeToolCallResult | undefined> {
        if (this.pending) {
            // 适配器工具被跳过时总线收到 failed 的 end；registry 工具被跳过时总线无事件（见 handleAgentEvent）。
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

    private async executeRegistryTool(
        tools: AgentToolRegistry,
        turnId: string,
        toolName: string,
        toolCallId: string,
        args: unknown
    ): Promise<AgentToolResult> {
        const execution = await tools.execute({ sessionId: this.sessionId, turnId, toolCallId, toolName, args });
        if (execution.status === 'executed') return toPiToolResult(execution.result);
        // 被 registry hook 阻断时 registry 不发任何工具事件，总线上该调用无 start/end；模型仍会收到错误结果。
        if (execution.status === 'blocked') return { ...toPiToolResult(execution.result), isError: true };
        this.pending = {
            approval: {
                sessionId: this.sessionId,
                turnId,
                toolCallId,
                toolName,
                args: execution.approval.args,
                source: 'registry'
            }
        };
        return {
            content: [{ type: 'text', text: APPROVAL_PENDING_TEXT }],
            details: undefined,
            terminate: true
        };
    }

    private mergeTools(plan: AgentSessionTurnPlan): { agentTools: AgentTool[]; registryToolNames: ReadonlySet<string> } {
        const adapterTools = plan.tools ?? [];
        const names = new Set(adapterTools.map(tool => tool.name));
        if (names.size !== adapterTools.length) {
            throw new Error('Agent session adapter tools contain duplicate names.');
        }
        const registry = this.options.tools;
        const registryTools = registry?.listTools() ?? [];
        const registryToolNames = new Set<string>();
        const wrapped: AgentTool[] = [];
        for (const tool of registryTools) {
            if (names.has(tool.name)) {
                throw new Error(`Agent tool already registered: ${tool.name}`);
            }
            names.add(tool.name);
            registryToolNames.add(tool.name);
            if (registry) wrapped.push(this.wrapRegistryTool(registry, plan.turnId, tool));
        }
        return { agentTools: [...adapterTools, ...wrapped], registryToolNames };
    }

    private wrapRegistryTool(registry: AgentToolRegistry, turnId: string, tool: AgentRuntimeTool): AgentTool {
        return {
            name: tool.name,
            label: tool.label ?? tool.name,
            description: tool.description,
            parameters: toToolSchema(tool.parameters),
            execute: async (toolCallId, params) =>
                this.executeRegistryTool(registry, turnId, tool.name, toolCallId, params)
        };
    }

    private removePlaceholder(turn: AgentSessionActiveTurn, pending: AgentSessionPendingState): void {
        if (pending.insertIndex !== undefined) return;
        const messages = turn.agent.state.messages;
        // 必须从末尾向前找：provider 只保证单条 assistant 消息内 toolCallId 唯一，OpenAI 兼容代理与本地模型
        // 常跨回合复用 call_0/call_1，history 里可能有同 id 的旧结果；本回合占位一定是最后出现的那条。
        let index = -1;
        for (let cursor = messages.length - 1; cursor >= 0; cursor -= 1) {
            const message = messages[cursor];
            if (message.role === 'toolResult' && message.toolCallId === pending.approval.toolCallId) {
                index = cursor;
                break;
            }
        }
        if (index < 0) return;
        turn.agent.state.messages = [...messages.slice(0, index), ...messages.slice(index + 1)];
        pending.insertIndex = index;
    }

    private insertToolResult(
        turn: AgentSessionActiveTurn,
        pending: AgentSessionPendingState,
        outcome: AgentSessionToolOutcome
    ): void {
        const message = toToolResultMessage(pending.approval, outcome);
        const messages = turn.agent.state.messages;
        const index = pending.insertIndex ?? messages.length;
        turn.agent.state.messages = [...messages.slice(0, index), message, ...messages.slice(index)];
        this.notify(() => this.options.observer?.onMessageEnd?.({ turnId: turn.turnId, message }));
    }

    private isPendingToolCall(toolCallId: string): boolean {
        return this.pending?.approval.toolCallId === toolCallId;
    }

    private transcript(turn: AgentSessionActiveTurn): AgentMessage[] {
        const messages = turn.agent.state.messages;
        return messages[0]?.role === 'system' ? messages.slice(1) : messages.slice();
    }

    private emit(event: AgentRuntimeEvent): void {
        this.options.events.emit(event);
    }

    private notify(callback: () => void): void {
        try {
            callback();
        } catch (error: unknown) {
            console.error({ error }, 'Agent session observer failed.');
        }
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isContentPart = (value: unknown): value is AgentRuntimeContentBlock =>
    isRecord(value)
    && typeof value.type === 'string'
    && (value.text === undefined || typeof value.text === 'string');

const toErrorMessage = (error: unknown): string =>
    error instanceof Error && error.message.length > 0 ? error.message : String(error);

const errorOutcome = (message: string): AgentSessionToolOutcome => ({
    result: { content: [{ type: 'text', text: message }], details: undefined },
    isError: true
});

const toToolCall = (approval: AgentSessionPendingApproval): AgentSessionToolCall => ({
    sessionId: approval.sessionId,
    turnId: approval.turnId,
    toolCallId: approval.toolCallId,
    toolName: approval.toolName,
    args: approval.args
});

/** registry 只持有跨运行时的 JSON Schema；pi 的 TSchema 是结构空接口，普通对象即可满足。 */
const toToolSchema = (parameters: unknown): AgentTool['parameters'] =>
    isRecord(parameters) ? parameters : { type: 'object' };

/** pi 只接受 text / image 内容；其他块类型无法交给模型，直接丢弃。 */
const toPiContent = (content: AgentRuntimeToolResult['content']): Array<TextContent | ImageContent> =>
    content.flatMap((part): Array<TextContent | ImageContent> => {
        if (part.type === 'text' && typeof part.text === 'string') return [{ type: 'text', text: part.text }];
        if (part.type === 'image' && typeof part.data === 'string' && typeof part.mimeType === 'string') {
            return [{ type: 'image', data: part.data, mimeType: part.mimeType }];
        }
        return [];
    });

const toPiToolResult = (result: AgentRuntimeToolResult): AgentToolResult => ({
    content: toPiContent(result.content),
    details: toJsonValue(result.details)
});

const toToolResultMessage = (
    approval: Pick<AgentSessionPendingApproval, 'toolCallId' | 'toolName'>,
    outcome: AgentSessionToolOutcome
): ToolResultMessage => {
    const details: JsonValue | undefined = toJsonValue(outcome.result.details);
    return {
        role: 'toolResult',
        toolCallId: approval.toolCallId,
        toolName: approval.toolName,
        content: toPiContent(outcome.result.content),
        ...(details !== undefined ? { details } : {}),
        isError: outcome.isError,
        timestamp: Date.now()
    };
};

const toBusContent = (content: unknown): AgentRuntimeContentBlock[] => {
    const json = toJsonValue(content);
    return Array.isArray(json) ? json.filter(isContentPart) : [];
};

const toBusToolResult = (result: AgentRuntimeToolResult): AgentRuntimeToolResult => ({
    content: toBusContent(result.content),
    details: toJsonValue(result.details)
});

const toBusToolResultFromUnknown = (result: unknown): AgentRuntimeToolResult => ({
    content: toBusContent(isRecord(result) ? result.content : undefined),
    details: isRecord(result) ? toJsonValue(result.details) : undefined
});

const summarizeContent = (content: AgentRuntimeToolResult['content']): string =>
    content
        .map(part => part.text)
        .filter((text): text is string => typeof text === 'string' && text.length > 0)
        .join('\n') || 'Tool execution failed.';

const lastAssistant = (messages: AgentMessage[]): AssistantMessage | undefined => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role === 'assistant') return message;
    }
    return undefined;
};

const statusFromStopReason = (message: AssistantMessage | undefined): AgentSessionTurnStatus => {
    if (message?.stopReason === 'error') return 'error';
    if (message?.stopReason === 'aborted') return 'aborted';
    return 'completed';
};
