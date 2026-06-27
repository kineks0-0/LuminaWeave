import type {
    ForgeExecutionRequest,
    ForgeModelRequestToolEventType,
    ForgeRuntimeContext,
    ForgeRuntimeDecision,
    ForgeRuntimeEffect,
    ForgeRuntimeEvent,
    ForgeUserCommand,
    ForgeToolApprovalResolutionOptions
} from '../../../../types/ForgeRuntimeTypes.js';
import type { ForgeTimelineOperationKind } from '../../../../types/ForgeTimelineTypes.js';
import type {
    ForgePiContextBundleSummary,
    ForgePiSessionEntry,
    ForgePiTreeNode
} from '@shared/ForgePiTypes.js';
import type { AgentRuntimeSnapshot } from '../../agent-runtime/events/AgentRuntimeEventBus.js';
import { ForgeWorkflowGraph } from '../graph/ForgeWorkflowGraph.js';

export interface ForgeRuntimePort {
    getRuntimeContext(command: ForgeUserCommand, latestUserInput?: string): ForgeRuntimeContext;
    applyRuntimeEffects(effects: ForgeRuntimeEffect[]): Promise<void>;
    buildPlannerExecutionRequest(context: ForgeRuntimeContext): Promise<ForgeExecutionRequest>;
    buildAnalystExecutionRequest(context: ForgeRuntimeContext): Promise<ForgeExecutionRequest>;
    buildConversationExecutionRequest(context: ForgeRuntimeContext): Promise<ForgeExecutionRequest>;
    buildExecutorExecutionRequest(params: {
        instruction: string;
        entryId: string;
        originalContent: string;
        sourceCommand: ForgeUserCommand;
    }): Promise<ForgeExecutionRequest>;
    prepareAssistantStream(): void;
    handleRuntimeEvent(event: ForgeRuntimeEvent): void;
    resolveOriginalContent(targetEntryId: string | null): string;
    resolveEntryComment(targetEntryId: string | null): string | null;
}

export interface ForgeRuntimeOrchestratorOptions {
    runPiTurn?: (input: {
        command: ForgeUserCommand;
        commandInput?: string;
        context: ForgeRuntimeContext;
        request: ForgeExecutionRequest;
        onRuntimeEvent?: (event: ForgeRuntimeEvent) => void;
    }) => Promise<{
        events?: ForgeRuntimeEvent[];
        effects?: ForgeRuntimeEffect[];
        agentRuntimeSnapshot?: AgentRuntimeSnapshot;
        piSessionState?: {
            tree: ForgePiTreeNode[];
            entries?: ForgePiSessionEntry[];
            activeNodeId: string | null;
            contextBundleSummary?: ForgePiContextBundleSummary | null;
            loadedExtensions?: string[];
        };
    }>;
    resolvePiToolApproval?: (
        toolCallId: string,
        approved: boolean,
        message?: string,
        options?: ForgeToolApprovalResolutionOptions
    ) => Promise<{
        resolved: boolean;
        events?: ForgeRuntimeEvent[];
        effects?: ForgeRuntimeEffect[];
        agentRuntimeSnapshot?: AgentRuntimeSnapshot;
        piSessionState?: {
            tree: ForgePiTreeNode[];
            entries?: ForgePiSessionEntry[];
            activeNodeId: string | null;
            contextBundleSummary?: ForgePiContextBundleSummary | null;
            loadedExtensions?: string[];
        };
    }>;
}

export class ForgeRuntimeOrchestrator {
    constructor(
        private readonly port: ForgeRuntimePort,
        _legacyExecutionGateway?: unknown,
        _legacyIsolatedSubagent?: unknown,
        private readonly options: ForgeRuntimeOrchestratorOptions = {}
    ) {}

    abortActiveGeneration(): void {
        // The pi runtime owns the active AbortController.
    }

    async resolveToolApproval(
        toolCallId: string,
        approved: boolean,
        message?: string,
        options?: ForgeToolApprovalResolutionOptions
    ): Promise<boolean> {
        if (!this.options.resolvePiToolApproval) return false;
        const result = options === undefined
            ? await this.options.resolvePiToolApproval(toolCallId, approved, message)
            : await this.options.resolvePiToolApproval(toolCallId, approved, message, options);
        if (!result.resolved) return false;

        const context = this.port.getRuntimeContext({ type: 'noop' });
        const effects: ForgeRuntimeEffect[] = [];
        if (result.piSessionState) {
            effects.push({
                type: 'set_forge_pi_session_state',
                tree: result.piSessionState.tree,
                entries: result.piSessionState.entries ?? [],
                activeNodeId: result.piSessionState.activeNodeId,
                contextBundleSummary: result.piSessionState.contextBundleSummary ?? null,
                loadedExtensions: result.piSessionState.loadedExtensions
            });
        }
        if (result.agentRuntimeSnapshot) {
            effects.push({
                type: 'set_agent_runtime_snapshot',
                requestId: this.resolveRequestId(result.events ?? []),
                snapshot: result.agentRuntimeSnapshot
            });
        }
        for (const event of result.events ?? []) {
            this.port.handleRuntimeEvent(event);
            effects.push(...this.buildEventEffects(event, context));
        }
        effects.push(...(result.effects ?? []));
        effects.push({ type: 'refresh_workflow' }, { type: 'persist_session' });
        await this.port.applyRuntimeEffects(effects);
        return true;
    }

    async dispatch(command: ForgeUserCommand): Promise<ForgeRuntimeDecision> {
        const commandInput = this.getCommandInput(command);
        const context = this.port.getRuntimeContext(command, commandInput);
        const decision = await ForgeWorkflowGraph.resolveDecision(context);

        if (decision.effects.length > 0) {
            await this.port.applyRuntimeEffects(decision.effects);
        }

        if (decision.requiresGeneration && command.type !== 'noop') {
            if (decision.executionRequest?.mode === 'conversation') {
                await this.runConversation(command);
            } else if (decision.executionRequest?.mode === 'analyst') {
                await this.runAnalyst(command);
            } else {
                await this.runPlanner(command);
            }
        }

        return decision;
    }

    async runExecutorRewrite(instruction: string, entryId: string, originalContent: string): Promise<void> {
        const command: ForgeUserCommand = { type: 'noop' };
        const context = this.port.getRuntimeContext(command);
        const request = await this.port.buildExecutorExecutionRequest({
            instruction,
            entryId,
            originalContent,
            sourceCommand: command
        });
        await this.runPiRequest(command, this.buildExecutorCommandInput(instruction, entryId, originalContent), context, request);
    }

    private buildExecutorCommandInput(instruction: string, entryId: string, originalContent: string): string {
        return [
            'Executor rewrite request',
            `instruction: ${instruction}`,
            `targetEntryId: "${entryId}"`,
            'originalContent:',
            originalContent
        ].join('\n');
    }

    private async runPlanner(command: ForgeUserCommand): Promise<void> {
        this.port.prepareAssistantStream();
        const commandInput = this.getCommandInput(command);
        const context = this.port.getRuntimeContext(command, commandInput);
        const request = await this.port.buildPlannerExecutionRequest(context);
        await this.runPiRequest(command, commandInput, context, request);
    }

    private async runConversation(command: ForgeUserCommand): Promise<void> {
        this.port.prepareAssistantStream();
        const commandInput = this.getCommandInput(command);
        const context = this.port.getRuntimeContext(command, commandInput);
        const request = await this.port.buildConversationExecutionRequest(context);
        await this.runPiRequest(command, commandInput, context, request);
    }

    private async runAnalyst(command: ForgeUserCommand): Promise<void> {
        const commandInput = this.getCommandInput(command);
        const context = this.port.getRuntimeContext(command, commandInput);
        const request = await this.port.buildAnalystExecutionRequest(context);
        await this.runPiRequest(command, commandInput, context, request);
        await this.runPlanner(command);
    }

    private async runPiRequest(
        command: ForgeUserCommand,
        commandInput: string | undefined,
        context: ForgeRuntimeContext,
        request: ForgeExecutionRequest
    ): Promise<void> {
        if (!this.options.runPiTurn) {
            throw new Error('Forge pi runtime client is not configured.');
        }
        try {
            const liveEvents = new Set<ForgeRuntimeEvent>();
            let liveEffectQueue = Promise.resolve();
            let liveEffectError: unknown = null;
            const applyLiveEvent = (event: ForgeRuntimeEvent): void => {
                liveEvents.add(event);
                this.port.handleRuntimeEvent(event);
                const effects = this.buildEventEffects(event, context);
                if (effects.length === 0) return;
                liveEffectQueue = liveEffectQueue
                    .then(() => this.port.applyRuntimeEffects(effects))
                    .catch((error) => {
                        liveEffectError = error;
                    });
            };
            const result = await this.options.runPiTurn({
                command,
                commandInput,
                context,
                request,
                onRuntimeEvent: applyLiveEvent
            });
            await liveEffectQueue;
            if (liveEffectError) {
                throw liveEffectError;
            }
            const effects: ForgeRuntimeEffect[] = [];
            if (result.piSessionState) {
                effects.push({
                    type: 'set_forge_pi_session_state',
                    tree: result.piSessionState.tree,
                    entries: result.piSessionState.entries ?? [],
                    activeNodeId: result.piSessionState.activeNodeId,
                    contextBundleSummary: result.piSessionState.contextBundleSummary ?? null,
                    loadedExtensions: result.piSessionState.loadedExtensions
                });
            }
            if (result.agentRuntimeSnapshot) {
                effects.push({
                    type: 'set_agent_runtime_snapshot',
                    requestId: request.requestId,
                    snapshot: result.agentRuntimeSnapshot
                });
            }
            for (const event of result.events ?? []) {
                if (liveEvents.has(event)) {
                    continue;
                }
                this.port.handleRuntimeEvent(event);
                effects.push(...this.buildEventEffects(event, context));
            }
            effects.push(...(result.effects ?? []));
            effects.push(
                { type: 'refresh_workflow', userInput: commandInput },
                { type: 'persist_session' }
            );
            await this.port.applyRuntimeEffects(effects);
        } catch (error: any) {
            await this.port.applyRuntimeEffects([{
                type: 'fail_model_request',
                requestId: request.requestId,
                message: error?.message || 'Forge pi runtime 请求失败'
            }]);
            throw error;
        }
    }

    private buildEventEffects(event: ForgeRuntimeEvent, context: ForgeRuntimeContext): ForgeRuntimeEffect[] {
        if (event.type === 'request_started') {
            return [{ type: 'set_active_model_request', requestId: event.requestId }];
        }
        if (event.type === 'prompt_ready') {
            return [{
                type: 'log_operation_prompt',
                dedupeKey: this.getOperationDedupeKey(`pi:${context.workflowSnapshot?.promptMode ?? 'forge'}`),
                prompt: event.prompt
            }];
        }
        if (event.type === 'first_response') {
            return [{ type: 'mark_model_request_first_response', requestId: event.requestId, firstResponseAt: event.firstResponseAt }];
        }
        if (event.type === 'stream_chunk') {
            return [{
                type: 'update_model_request_stream',
                requestId: event.requestId,
                responseRaw: event.rawText,
                responseDisplay: event.displayText,
                responseThinking: event.thinkingText
            }];
        }
        if (event.type === 'stream_done') {
            return [{
                type: 'complete_model_request',
                requestId: event.requestId,
                responseRaw: event.rawText,
                responseDisplay: event.displayText,
                responseThinking: event.thinkingText,
                completedAt: event.completedAt
            }];
        }
        if (event.type === 'stream_error') {
            return [{ type: 'fail_model_request', requestId: event.requestId, message: event.message }];
        }
        if (event.type === 'model_request_trace') {
            return [{
                type: 'set_model_request_pi_trace',
                requestId: event.requestId,
                trace: event.trace
            }];
        }
        if (event.type === 'tool_call') {
            return [
                {
                    type: 'upsert_running_operation',
                    dedupeKey: this.getOperationDedupeKey(`tool:${event.toolCallId}`),
                    operationKind: 'execution',
                    title: `正在调用工具 · ${event.toolName}`,
                    summary: JSON.stringify(event.args).slice(0, 240),
                    detail: JSON.stringify(event.args, null, 2),
                    sourceTag: `tool:${event.toolName}`,
                    layer: context.activeLayer
                },
                this.createModelRequestToolEvent({
                    requestId: event.requestId,
                    type: 'tool_call',
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    payload: event.args
                })
            ];
        }
        if (event.type === 'tool_result') {
            return [
                {
                    type: 'complete_operation',
                    dedupeKey: this.getOperationDedupeKey(`tool:${event.toolCallId}`),
                    operationKind: event.isError ? 'system' : 'execution',
                    title: `${event.isError ? '工具调用失败' : '已完成工具'} · ${event.toolName}`,
                    summary: JSON.stringify(event.result).slice(0, 240),
                    detail: JSON.stringify(event.result, null, 2),
                    sourceTag: `tool:${event.toolName}`,
                    layer: context.activeLayer
                },
                this.createModelRequestToolEvent({
                    requestId: event.requestId,
                    type: 'tool_result',
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    payload: event.result
                })
            ];
        }
        if (event.type === 'tool_approval_needed') {
            return [
                {
                    type: 'add_operation',
                    operationKind: 'gate',
                    status: 'blocked',
                    title: `等待工具授权 · ${event.toolName}`,
                    summary: event.reason,
                    detail: JSON.stringify(event.args, null, 2),
                    sourceTag: `tool:${event.toolName}`,
                    layer: context.activeLayer
                },
                {
                    type: 'upsert_tool_approval',
                    approval: {
                        id: `approval-${event.toolCallId}`,
                        approvalId: event.approvalId ?? null,
                        requestId: event.requestId,
                        toolCallId: event.toolCallId,
                        toolName: event.toolName,
                        args: event.args,
                        reason: event.reason,
                        source: event.source,
                        approvalKind: event.approvalKind,
                        displaySurface: event.displaySurface,
                        shellPermissionRequestId: event.shellPermissionRequestId ?? null,
                        forgeProjectId: event.forgeProjectId ?? null,
                        conversationId: event.conversationId ?? null,
                        sessionId: event.sessionId ?? null,
                        status: 'pending',
                        createdAt: Date.now(),
                        resolvedAt: null,
                        message: null
                    }
                },
                this.createModelRequestToolEvent({
                    requestId: event.requestId,
                    type: 'tool_approval_needed',
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    payload: {
                        approvalId: event.approvalId ?? null,
                        args: event.args,
                        reason: event.reason,
                        source: event.source,
                        approvalKind: event.approvalKind,
                        displaySurface: event.displaySurface,
                        shellPermissionRequestId: event.shellPermissionRequestId ?? null,
                        forgeProjectId: event.forgeProjectId ?? null,
                        conversationId: event.conversationId ?? null,
                        sessionId: event.sessionId ?? null
                    }
                })
            ];
        }
        if (event.type === 'tool_approval_resolved') {
            return [
                {
                    type: 'add_operation',
                    operationKind: 'gate',
                    status: event.approved ? 'completed' : 'cancelled',
                    title: `${event.approved ? '已批准工具调用' : '已拒绝工具调用'} · ${event.toolName}`,
                    summary: event.message || (event.approved ? '工具调用已获批准。' : '工具调用已被拒绝。'),
                    sourceTag: `tool:${event.toolName}`,
                    layer: context.activeLayer
                },
                { type: 'resolve_tool_approval', toolCallId: event.toolCallId, approved: event.approved, message: event.message },
                this.createModelRequestToolEvent({
                    requestId: event.requestId,
                    type: 'tool_approval_resolved',
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    payload: {
                        approvalId: event.approvalId ?? null,
                        approved: event.approved,
                        message: event.message ?? null,
                        source: event.source,
                        approvalKind: event.approvalKind,
                        displaySurface: event.displaySurface,
                        shellPermissionRequestId: event.shellPermissionRequestId ?? null,
                        forgeProjectId: event.forgeProjectId ?? null,
                        conversationId: event.conversationId ?? null,
                        sessionId: event.sessionId ?? null
                    }
                })
            ];
        }
        if (event.type === 'trace') {
            const presentation = this.resolveTracePresentation(event.tag);
            return [{
                type: 'upsert_running_operation',
                dedupeKey: this.getOperationDedupeKey(event.tag),
                operationKind: presentation.operationKind,
                title: presentation.title,
                summary: event.status || 'Forge pi runtime 正在执行中',
                sourceTag: event.tag,
                layer: context.activeLayer
            }];
        }
        return [];
    }

    private createModelRequestToolEvent(input: {
        requestId: string;
        type: ForgeModelRequestToolEventType;
        toolCallId: string;
        toolName: string;
        payload: unknown;
    }): ForgeRuntimeEffect {
        const createdAt = Date.now();
        return {
            type: 'append_model_request_tool_event',
            requestId: input.requestId,
            event: {
                id: `${input.requestId}:${input.toolCallId}:${input.type}:${createdAt}`,
                type: input.type,
                toolCallId: input.toolCallId,
                toolName: input.toolName,
                payload: input.payload,
                createdAt
            }
        };
    }

    private resolveTracePresentation(tagName: string): {
        operationKind: ForgeTimelineOperationKind;
        title: string;
    } {
        const normalized = tagName.toLowerCase();
        if (normalized.includes('context')) return { operationKind: 'context_read', title: '正在读取上下文' };
        if (normalized.includes('memory')) return { operationKind: 'memory_update', title: '正在整理 Forge 记忆' };
        if (normalized.includes('tool')) return { operationKind: 'execution', title: '正在执行工具' };
        return { operationKind: 'system', title: '正在处理 Forge pi runtime 事件' };
    }

    private getOperationDedupeKey(tagOrType: string | null | undefined): string {
        const normalized = String(tagOrType || 'forge').toLowerCase();
        return `forge-operation:${normalized}`;
    }

    private getCommandInput(command: ForgeUserCommand): string | undefined {
        if (command.type === 'send_user_input') return command.input;
        if (command.type === 'submit_form') return command.userInput;
        if (command.type === 'refresh_workflow') return command.userInput;
        return undefined;
    }

    private resolveRequestId(events: ForgeRuntimeEvent[]): string | null {
        return events[0]?.requestId ?? null;
    }
}
