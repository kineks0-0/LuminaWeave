import type { AgentRuntimeEventBus } from '../events/AgentRuntimeEventBus.js';

export interface AgentRuntimeToolResult<TDetails = unknown> {
    content: Array<{ type: string; text?: string; [key: string]: unknown }>;
    details: TDetails;
}

export interface AgentRuntimeTool<TArgs = unknown, TDetails = unknown> {
    name: string;
    label?: string;
    description: string;
    parameters: unknown;
    needsApproval?: boolean | ((args: TArgs) => boolean | Promise<boolean>);
    execute: (toolCallId: string, args: TArgs) => Promise<AgentRuntimeToolResult<TDetails>>;
}

export interface AgentToolVisibilityContext {
    phaseId?: string;
    capabilities?: string[];
    [key: string]: unknown;
}

export interface AgentToolRegistryOptions {
    visibilityFilter?: (tool: AgentRuntimeTool, context: AgentToolVisibilityContext | undefined) => boolean;
    events?: AgentRuntimeEventBus;
}

export interface AgentToolExecutionInput {
    sessionId: string;
    turnId: string;
    toolCallId: string;
    toolName: string;
    args: unknown;
    visibility?: AgentToolVisibilityContext;
}

export interface AgentToolBeforeCallInput {
    toolCallId: string;
    toolName: string;
    args: unknown;
    visibility?: AgentToolVisibilityContext;
    tool: AgentRuntimeTool;
}

export interface AgentToolBlockResult {
    message: string;
    details?: unknown;
    content?: AgentRuntimeToolResult['content'];
}

export interface AgentToolBeforeCallResult {
    args?: unknown;
    block?: AgentToolBlockResult;
}

export interface AgentToolAfterResultInput {
    toolCallId: string;
    toolName: string;
    args: unknown;
    visibility?: AgentToolVisibilityContext;
    tool: AgentRuntimeTool;
    result: AgentRuntimeToolResult;
}

export type AgentToolBeforeCallHandler = (
    input: AgentToolBeforeCallInput
) => Promise<AgentToolBeforeCallResult | void> | AgentToolBeforeCallResult | void;

export type AgentToolAfterResultHandler = (
    input: AgentToolAfterResultInput
) => Promise<AgentRuntimeToolResult | void> | AgentRuntimeToolResult | void;

export interface AgentToolApprovalRequest {
    approvalId: string;
    sessionId: string;
    turnId: string;
    toolCallId: string;
    toolName: string;
    args: unknown;
}

export type AgentToolExecutionResult =
    | {
        status: 'executed';
        result: AgentRuntimeToolResult;
    }
    | {
        status: 'approval_required';
        approval: AgentToolApprovalRequest;
    }
    | {
        status: 'blocked';
        message: string;
        result: AgentRuntimeToolResult;
    };

export type AgentToolApprovalResolution =
    | {
        status: 'approved';
        approval: AgentToolApprovalRequest;
        result: AgentRuntimeToolResult;
        message?: string;
    }
    | {
        status: 'denied';
        approval: AgentToolApprovalRequest;
        message?: string;
    }
    | {
        status: 'not_found';
        sessionId: string;
        turnId: string;
        toolCallId: string;
    };

interface PendingToolApproval {
    tool: AgentRuntimeTool;
    input: AgentToolExecutionInput;
    approval: AgentToolApprovalRequest;
}

/** registry 审批 id 的约定格式；重载恢复时据此重建 AgentToolApprovalRequest。 */
export const createToolApprovalId = (toolCallId: string): string => `approval-${toolCallId}`;

export class AgentToolRegistry {
    private readonly tools = new Map<string, AgentRuntimeTool>();
    private readonly pendingApprovals = new Map<string, PendingToolApproval>();
    private readonly beforeToolCallHandlers: AgentToolBeforeCallHandler[] = [];
    private readonly afterToolResultHandlers: AgentToolAfterResultHandler[] = [];

    constructor(private readonly options: AgentToolRegistryOptions = {}) {}

    register<TArgs = unknown, TDetails = unknown>(tool: AgentRuntimeTool<TArgs, TDetails>): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`Agent tool already registered: ${tool.name}`);
        }
        this.tools.set(tool.name, tool as AgentRuntimeTool);
    }

    hasTool(toolName: string): boolean {
        return this.tools.has(toolName);
    }

    onBeforeToolCall(handler: AgentToolBeforeCallHandler): void {
        this.beforeToolCallHandlers.push(handler);
    }

    onAfterToolResult(handler: AgentToolAfterResultHandler): void {
        this.afterToolResultHandlers.push(handler);
    }

    listTools(visibility?: AgentToolVisibilityContext): AgentRuntimeTool[] {
        return Array.from(this.tools.values())
            .filter(tool => this.isVisible(tool, visibility));
    }

    getToolSummary(visibility?: AgentToolVisibilityContext): Array<{ name: string; description: string; needsApproval: boolean | 'dynamic' }> {
        return this.listTools(visibility).map(tool => ({
            name: tool.name,
            description: tool.description,
            needsApproval: typeof tool.needsApproval === 'function' ? 'dynamic' : Boolean(tool.needsApproval)
        }));
    }

    async execute(input: AgentToolExecutionInput): Promise<AgentToolExecutionResult> {
        const tool = this.tools.get(input.toolName);
        if (!tool) throw new Error(`Agent tool not registered: ${input.toolName}`);
        if (!this.isVisible(tool, input.visibility)) {
            throw new Error(`Agent tool not visible in this phase: ${input.toolName}`);
        }
        const prepared = await this.runBeforeToolCallHooks(tool, input);
        if (prepared.block) {
            return {
                status: 'blocked',
                message: prepared.block.message,
                result: {
                    content: prepared.block.content ?? [{ type: 'text', text: prepared.block.message }],
                    details: prepared.block.details ?? null
                }
            };
        }
        const preparedInput: AgentToolExecutionInput = {
            ...input,
            args: prepared.args
        };
        const needsApproval = typeof tool.needsApproval === 'function'
            ? Boolean(await tool.needsApproval(preparedInput.args))
            : Boolean(tool.needsApproval);
        if (needsApproval) {
            const approval = this.createApproval(preparedInput);
            this.emitToolStart(tool, preparedInput);
            this.pendingApprovals.set(this.createPendingApprovalKey(preparedInput), { tool, input: preparedInput, approval });
            return {
                status: 'approval_required',
                approval
            };
        }
        return {
            status: 'executed',
            result: await this.executeWithEventProjection(tool, preparedInput)
        };
    }

    async resolveToolApproval(
        sessionId: string,
        turnId: string,
        toolCallId: string,
        approved: boolean,
        message?: string
    ): Promise<AgentToolApprovalResolution> {
        const pendingKey = this.createPendingApprovalKey({ sessionId, turnId, toolCallId });
        const pending = this.pendingApprovals.get(pendingKey);
        if (!pending) return { status: 'not_found', sessionId, turnId, toolCallId };
        this.pendingApprovals.delete(pendingKey);
        if (!approved) {
            this.options.events?.emit({
                type: 'tool_execution_end',
                sessionId,
                turnId,
                toolCallId,
                toolName: pending.tool.name,
                status: 'denied',
                errorMessage: message
            });
            return {
                status: 'denied',
                approval: pending.approval,
                message
            };
        }
        return {
            status: 'approved',
            approval: pending.approval,
            result: await this.executeWithEventProjection(pending.tool, pending.input, false),
            message
        };
    }

    listPendingApprovals(sessionId?: string): AgentToolApprovalRequest[] {
        return Array.from(this.pendingApprovals.values())
            .filter(pending => sessionId === undefined || pending.approval.sessionId === sessionId)
            .map(pending => ({ ...pending.approval }));
    }

    /**
     * 重载后重建等待中的审批，之后照常经 resolveToolApproval 批准或拒绝。
     * 不重新执行 beforeToolCall 钩子与 needsApproval：approval.args 已是钩子处理后的参数，重跑可能产生副作用或不同判定。
     */
    restorePendingApproval(
        approval: AgentToolApprovalRequest,
        visibility?: AgentToolVisibilityContext
    ): 'restored' | 'tool_not_registered' {
        const tool = this.tools.get(approval.toolName);
        if (!tool) return 'tool_not_registered';
        const input: AgentToolExecutionInput = {
            sessionId: approval.sessionId,
            turnId: approval.turnId,
            toolCallId: approval.toolCallId,
            toolName: approval.toolName,
            args: approval.args,
            ...(visibility ? { visibility } : {})
        };
        this.pendingApprovals.set(this.createPendingApprovalKey(input), { tool, input, approval: { ...approval } });
        return 'restored';
    }

    /** 撤销一个等待中的审批（不发事件）；用于恢复流程在副作用之后失败时的回滚。返回是否确有该审批。 */
    discardPendingApproval(sessionId: string, turnId: string, toolCallId: string): boolean {
        return this.pendingApprovals.delete(this.createPendingApprovalKey({ sessionId, turnId, toolCallId }));
    }

    private async runBeforeToolCallHooks(
        tool: AgentRuntimeTool,
        input: AgentToolExecutionInput
    ): Promise<{ args: unknown; block?: AgentToolBlockResult }> {
        let args = input.args;
        for (const handler of this.beforeToolCallHandlers) {
            const result = await handler({
                ...input,
                args,
                tool
            });
            if (!result) continue;
            if (result.args !== undefined) {
                args = result.args;
            }
            if (result.block) {
                return { args, block: result.block };
            }
        }
        return { args };
    }

    private async executeWithAfterHooks(
        tool: AgentRuntimeTool,
        input: AgentToolExecutionInput
    ): Promise<AgentRuntimeToolResult> {
        let result = await tool.execute(input.toolCallId, input.args);
        for (const handler of this.afterToolResultHandlers) {
            const next = await handler({
                ...input,
                tool,
                result
            });
            if (next) {
                result = next;
            }
        }
        return result;
    }

    private async executeWithEventProjection(
        tool: AgentRuntimeTool,
        input: AgentToolExecutionInput,
        emitStart = true
    ): Promise<AgentRuntimeToolResult> {
        if (emitStart) this.emitToolStart(tool, input);
        try {
            const result = await this.executeWithAfterHooks(tool, input);
            if (result.content.length > 0) {
                this.options.events?.emit({
                    type: 'tool_execution_update',
                    sessionId: input.sessionId,
                    turnId: input.turnId,
                    toolCallId: input.toolCallId,
                    toolName: tool.name,
                    content: result.content
                });
            }
            this.options.events?.emit({
                type: 'tool_execution_end',
                sessionId: input.sessionId,
                turnId: input.turnId,
                toolCallId: input.toolCallId,
                toolName: tool.name,
                status: 'completed',
                result
            });
            return result;
        } catch (error) {
            this.options.events?.emit({
                type: 'tool_execution_end',
                sessionId: input.sessionId,
                turnId: input.turnId,
                toolCallId: input.toolCallId,
                toolName: tool.name,
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private emitToolStart(tool: AgentRuntimeTool, input: AgentToolExecutionInput): void {
        this.options.events?.emit({
            type: 'tool_execution_start',
            sessionId: input.sessionId,
            turnId: input.turnId,
            toolCallId: input.toolCallId,
            toolName: tool.name,
            args: input.args
        });
    }

    private createApproval(input: AgentToolExecutionInput): AgentToolApprovalRequest {
        return {
            approvalId: createToolApprovalId(input.toolCallId),
            sessionId: input.sessionId,
            turnId: input.turnId,
            toolCallId: input.toolCallId,
            toolName: input.toolName,
            args: input.args
        };
    }

    private createPendingApprovalKey(input: Pick<AgentToolExecutionInput, 'sessionId' | 'turnId' | 'toolCallId'>): string {
        return JSON.stringify([input.sessionId, input.turnId, input.toolCallId]);
    }

    private isVisible(tool: AgentRuntimeTool, visibility: AgentToolVisibilityContext | undefined): boolean {
        return this.options.visibilityFilter?.(tool, visibility) ?? true;
    }
}
