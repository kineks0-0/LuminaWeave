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
        toolCallId: string;
    };

interface PendingToolApproval {
    tool: AgentRuntimeTool;
    input: AgentToolExecutionInput;
    approval: AgentToolApprovalRequest;
}

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
            this.pendingApprovals.set(preparedInput.toolCallId, { tool, input: preparedInput, approval });
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
        toolCallId: string,
        approved: boolean,
        message?: string
    ): Promise<AgentToolApprovalResolution> {
        const pending = this.pendingApprovals.get(toolCallId);
        if (!pending) return { status: 'not_found', toolCallId };
        this.pendingApprovals.delete(toolCallId);
        if (!approved) {
            this.emitToolStart(pending.tool, pending.input);
            this.options.events?.emit({
                type: 'tool_execution_end',
                toolCallId: toolCallId,
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
            result: await this.executeWithEventProjection(pending.tool, pending.input),
            message
        };
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
        input: AgentToolExecutionInput
    ): Promise<AgentRuntimeToolResult> {
        this.emitToolStart(tool, input);
        try {
            const result = await this.executeWithAfterHooks(tool, input);
            if (result.content.length > 0) {
                this.options.events?.emit({
                    type: 'tool_execution_update',
                    toolCallId: input.toolCallId,
                    content: result.content
                });
            }
            this.options.events?.emit({
                type: 'tool_execution_end',
                toolCallId: input.toolCallId,
                status: 'completed',
                result
            });
            return result;
        } catch (error) {
            this.options.events?.emit({
                type: 'tool_execution_end',
                toolCallId: input.toolCallId,
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private emitToolStart(tool: AgentRuntimeTool, input: AgentToolExecutionInput): void {
        this.options.events?.emit({
            type: 'tool_execution_start',
            toolCallId: input.toolCallId,
            toolName: tool.name,
            args: input.args
        });
    }

    private createApproval(input: AgentToolExecutionInput): AgentToolApprovalRequest {
        return {
            approvalId: `approval-${input.toolCallId}`,
            toolCallId: input.toolCallId,
            toolName: input.toolName,
            args: input.args
        };
    }

    private isVisible(tool: AgentRuntimeTool, visibility: AgentToolVisibilityContext | undefined): boolean {
        return this.options.visibilityFilter?.(tool, visibility) ?? true;
    }
}
