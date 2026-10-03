import {
    Agent,
    type AgentEvent,
    type AgentMessage,
    type AgentToolResult,
    type BeforeToolCallContext,
    type BeforeToolCallResult
} from '@earendil-works/pi-agent-core';
import type { AssistantMessage, JsonObject, ToolResultMessage } from '@earendil-works/pi-ai';
import type { Static, TSchema } from 'typebox';
import type {
    ForgePiBranchFromUserResult,
    ForgePiContextBundleSummary,
    ForgePiSessionEntry,
    ForgePiTreeNode
} from '@shared/ForgePiTypes.js';
import type {
    ForgeExecutionRequest,
    ForgeModelRequestToolSummary,
    ForgeRuntimeContext,
    ForgeRuntimeEffect,
    ForgeRuntimeEvent,
    ForgeRuntimeEventSource,
    ForgeToolApprovalResolutionOptions,
    ForgeUserCommand
} from '../../../../../types/ForgeRuntimeTypes.js';
import {
    forgePiResourceLoader,
    type ForgePiResourceLoader
} from '../resources/ForgePiResourceLoader.js';
import {
    ForgePiSessionManager,
    type ForgePiSessionManagerDeps
} from './ForgePiSessionManager.js';
import { classifyForgePiAssistantMessageForReplay } from './ForgePiMessageSanitizer.js';
import {
    forgePiExtensionRunner,
    type ForgePiExtensionRunner
} from '../extensions/ForgePiExtensionRunner.js';
import {
    forgePiModelRegistry,
    type ForgePiModelRegistry
} from '../model/ForgePiModelRegistry.js';
import {
    forgePiToolBridge,
    type ForgePiAgentTool,
    type ForgePendingToolApproval,
    type ForgePiToolBridge
} from '../tools/ForgePiToolBridge.js';
import { AgentPromptAssembler } from '../../../agent-runtime/prompt/AgentPromptAssembler.js';
import { toJsonObject, toJsonValue } from '../../../agent-runtime/runtime/AgentJsonValue.js';
import {
    type AgentRuntimeContentBlock,
    AgentRuntimeEventBus
} from '../../../agent-runtime/events/AgentRuntimeEventBus.js';
import type { AgentRuntimeToolResult } from '../../../agent-runtime/tools/AgentToolRegistry.js';
import type {
    AgentToolRegistry,
    AgentToolApprovalResolution,
    AgentRuntimeTool
} from '../../../agent-runtime/tools/AgentToolRegistry.js';
import type {
    AgentRuntimeAgentEndEvent,
    AgentRuntimeBeforeAgentStartResult,
    AgentRuntimeCustomMessage,
    AgentRuntimeExtensionRunner
} from '../../../agent-runtime/extensions/AgentRuntimeExtensionRunner.js';

export interface ForgePiAgentSessionTurnInput {
    command: ForgeUserCommand;
    commandInput?: string;
    context: ForgeRuntimeContext;
    request: ForgeExecutionRequest;
    onRuntimeEvent?: (event: ForgeRuntimeEvent) => void;
}

export interface ForgePiAgentSessionTurnResult {
    events: ForgeRuntimeEvent[];
    effects: ForgeRuntimeEffect[];
    piSessionState: {
        tree: ForgePiTreeNode[];
        entries: ForgePiSessionEntry[];
        activeNodeId: string | null;
        contextBundleSummary: ForgePiContextBundleSummary;
        loadedExtensions: string[];
    };
}

export interface ForgePiAgentSessionPromptPreview {
    requestId: string;
    prompt: Array<{
        role: string;
        content?: unknown;
        name?: string;
    }>;
    systemPrompt: string;
    branchMessages: AgentMessage[];
    contextBundleSummary: ForgePiContextBundleSummary;
    loadedExtensions: string[];
    activeTools: ForgeModelRequestToolSummary[];
    piSessionState: {
        tree: ForgePiTreeNode[];
        entries: ForgePiSessionEntry[];
        activeNodeId: string | null;
        contextBundleSummary?: ForgePiContextBundleSummary | null;
        loadedExtensions?: string[];
    };
}

export interface ForgePiAgentSessionApprovalResult {
    resolved: boolean;
    events: ForgeRuntimeEvent[];
    effects: ForgeRuntimeEffect[];
    piSessionState?: {
        tree: ForgePiTreeNode[];
        entries: ForgePiSessionEntry[];
        activeNodeId: string | null;
        contextBundleSummary?: ForgePiContextBundleSummary | null;
        loadedExtensions?: string[];
    };
}

export interface ForgePiAgentSessionDeps extends ForgePiSessionManagerDeps {
    resourceLoader?: ForgePiResourceLoader;
    extensionRunner?: ForgePiExtensionRunner;
    modelRegistry?: ForgePiModelRegistry;
    toolBridge?: ForgePiToolBridge;
}

interface ForgePiEventSink {
    source: ForgeRuntimeEventSource;
    events: ForgeRuntimeEvent[];
    request: ForgeExecutionRequest;
    emitFirstResponse: boolean;
    firstResponseMarked: boolean;
    runtimeEvents: AgentRuntimeEventBus | null;
    runtimeMessageId: string | null;
    runtimeLastText: string | null;
    onRuntimeEvent?: (event: ForgeRuntimeEvent) => void;
}

interface ForgePiAgentRuntimeExtensionContext {
    runner: AgentRuntimeExtensionRunner | null;
    tools: AgentToolRegistry;
}

interface ForgePiAssistantProjection {
    rawText: string;
    finalText: string;
    thinkingBlocks: string[];
    thinkingText: string;
    runtimeBlocks: AgentRuntimeContentBlock[];
    streamKey: string;
}

interface ForgePiPreparedPrompt {
    contextBundle: ForgePiContextBundleSummary;
    source: ForgeRuntimeEventSource;
    modelConfig: ReturnType<ForgePiModelRegistry['resolveRunConfig']>;
    systemPrompt: string;
    branchMessages: AgentMessage[];
    prompt: Array<{
        role: string;
        content?: unknown;
        name?: string;
    }>;
    activeTools: ForgeModelRequestToolSummary[];
}

interface ForgePendingApprovalToolDetails {
    status: 'approval_pending';
    approvalKind: 'network' | 'tool';
    displaySurface: 'composer' | 'review';
    toolCallId: string;
    toolName: string;
    args: unknown;
    shellPermissionRequestId?: string | null;
    reason?: string;
}

type ForgeToolApprovalNeededEvent = Extract<ForgeRuntimeEvent, { type: 'tool_approval_needed' }>;

export class ForgePiAgentSession {
    private static readonly approvalBlockReasonPrefix = 'Forge tool approval pending';
    private readonly resourceLoader: ForgePiResourceLoader;
    private readonly extensionRunner: ForgePiExtensionRunner;
    private readonly modelRegistry: ForgePiModelRegistry;
    private readonly toolBridge: ForgePiToolBridge;
    private readonly sessionManager: ForgePiSessionManager;
    private readonly promptAssembler: AgentPromptAssembler<ForgePiAgentSessionTurnInput, ForgePiPreparedPrompt>;
    private agent: Agent | null = null;
    private latestContext: ForgeRuntimeContext | null = null;
    private latestRequest: ForgeExecutionRequest | null = null;
    private latestContextBundle: ForgePiContextBundleSummary | null = null;
    private eventSink: ForgePiEventSink | null = null;
    private agentRuntimeEvents: AgentRuntimeEventBus | null = null;
    private agentRuntimeExtensionContext: ForgePiAgentRuntimeExtensionContext | null = null;
    private readonly pendingApprovalBlockedToolCallIds = new Set<string>();
    private readonly pendingApprovalWaits = new Map<string, {
        requestId: string;
        toolName: string;
        kind: 'forge' | 'sdk';
        source: ForgeRuntimeEventSource;
        args: unknown;
        approvalId?: string;
    }>();
    private readonly messageSequences = new Map<string, number>();
    private readonly endedTurnIds = new Set<string>();

    constructor(
        private readonly sessionId: string,
        private readonly metadata: {
            forgeProjectId: string;
            conversationId: string;
            workspaceTitle: string;
        },
        deps: ForgePiAgentSessionDeps = {}
    ) {
        this.resourceLoader = deps.resourceLoader ?? forgePiResourceLoader;
        this.extensionRunner = deps.extensionRunner ?? forgePiExtensionRunner;
        this.modelRegistry = deps.modelRegistry ?? forgePiModelRegistry;
        this.toolBridge = deps.toolBridge ?? forgePiToolBridge;
        this.sessionManager = new ForgePiSessionManager({
            sessionId,
            forgeProjectId: metadata.forgeProjectId,
            conversationId: metadata.conversationId,
            workspaceTitle: metadata.workspaceTitle
        }, deps);
        this.promptAssembler = new AgentPromptAssembler({
            assemble: input => this.preparePromptState(input),
            resolveCacheKey: input => input.request.requestId
        });
    }

    setAgentRuntimeEvents(events: AgentRuntimeEventBus): void {
        this.agentRuntimeEvents = events;
    }

    setAgentRuntimeExtensionContext(context: ForgePiAgentRuntimeExtensionContext): void {
        this.agentRuntimeExtensionContext = context;
    }

    async prompt(input: ForgePiAgentSessionTurnInput): Promise<ForgePiAgentSessionTurnResult> {
        this.endedTurnIds.delete(input.request.requestId);
        this.latestContext = input.context;
        this.latestRequest = input.request;
        const effects: ForgeRuntimeEffect[] = [];
        const prepared = await this.promptAssembler.prepareForRun(input);
        this.promptAssembler.invalidate(input);
        const tools = this.loadTools(
            input.context,
            nextEffects => effects.push(...nextEffects)
        );
        this.latestContextBundle = prepared.contextBundle;
        const userInput = input.commandInput ?? this.resolveCommandInput(input.command);
        const events: ForgeRuntimeEvent[] = [];
        const emitEvent = (event: ForgeRuntimeEvent): void => {
            events.push(event);
            input.onRuntimeEvent?.(event);
        };

        emitEvent({
            type: 'request_started',
            requestId: input.request.requestId,
            requestedAt: Date.now(),
            nodeSummary: input.request.nodeSummary ?? []
        });
        this.agentRuntimeEvents?.emit({
            type: 'agent_start',
            sessionId: this.sessionId,
            turnId: input.request.requestId
        });
        this.agentRuntimeEvents?.emit({
            type: 'turn_start',
            sessionId: this.sessionId,
            turnId: input.request.requestId
        });

        this.sessionManager.ensureMetadata();
        this.sessionManager.append('context_bundle', 'Context bundle', `${prepared.contextBundle.files.length} files`, {
            contextBundle: prepared.contextBundle
        });

        const agent = this.createAgent({
            systemPrompt: prepared.systemPrompt,
            messages: prepared.branchMessages,
            tools,
            modelConfig: prepared.modelConfig
        });
        this.agent = agent;

        emitEvent({
            type: 'prompt_ready',
            requestId: input.request.requestId,
            prompt: prepared.prompt
        });

        const userMessage: AgentMessage = {
            role: 'user',
            content: userInput,
            timestamp: Date.now()
        };
        this.sessionManager.append('user', 'User', userInput, { agentMessage: userMessage, text: userInput });

        this.eventSink = {
            source: prepared.source,
            events,
            request: input.request,
            emitFirstResponse: true,
            firstResponseMarked: false,
            runtimeEvents: this.agentRuntimeEvents,
            runtimeMessageId: null,
            runtimeLastText: null,
            onRuntimeEvent: input.onRuntimeEvent
        };
        try {
            await agent.prompt(userMessage);
        } catch (error: unknown) {
            await this.finishAgentRuntimeTurn(
                input.request.requestId,
                this.resolveRuntimeErrorMessage(error)
            );
            throw error;
        }

        if (this.hasPendingApprovalForRequest(input.request.requestId)) {
            for (const modelTrace of this.resolveModelTraces(input.request.requestId)) {
                emitEvent({
                    type: 'model_request_trace',
                    requestId: input.request.requestId,
                    trace: modelTrace
                });
            }
            const snapshot = this.sessionManager.getSnapshot();
            return {
                events,
                effects,
                piSessionState: {
                    tree: snapshot.tree,
                    entries: snapshot.entries,
                    activeNodeId: snapshot.activeNodeId,
                    contextBundleSummary: prepared.contextBundle,
                    loadedExtensions: prepared.contextBundle.loadedExtensions
                }
            };
        }

        const finalMessage = this.resolveLastAssistantMessage(agent.state.messages);
        const finalProjection = finalMessage
            ? this.projectAssistantMessage(finalMessage)
            : this.emptyAssistantProjection();
        for (const modelTrace of this.resolveModelTraces(input.request.requestId)) {
            emitEvent({
                type: 'model_request_trace',
                requestId: input.request.requestId,
                trace: modelTrace
            });
        }
        await this.finishAgentRuntimeTurn(input.request.requestId, undefined, {
            messages: agent.state.messages,
            result: finalProjection
        });

        const snapshot = this.sessionManager.getSnapshot();
        return {
            events,
            effects,
            piSessionState: {
                tree: snapshot.tree,
                entries: snapshot.entries,
                activeNodeId: snapshot.activeNodeId,
                contextBundleSummary: prepared.contextBundle,
                loadedExtensions: prepared.contextBundle.loadedExtensions
            }
        };
    }

    async preparePrompt(input: ForgePiAgentSessionTurnInput): Promise<ForgePiAgentSessionPromptPreview> {
        const prepared = await this.promptAssembler.preview(input);
        const snapshot = this.sessionManager.getSnapshot();
        return {
            requestId: input.request.requestId,
            prompt: prepared.prompt,
            systemPrompt: prepared.systemPrompt,
            branchMessages: prepared.branchMessages,
            contextBundleSummary: prepared.contextBundle,
            loadedExtensions: prepared.contextBundle.loadedExtensions,
            activeTools: prepared.activeTools,
            piSessionState: {
                tree: snapshot.tree,
                entries: snapshot.entries,
                activeNodeId: snapshot.activeNodeId,
                contextBundleSummary: snapshot.contextBundleSummary ?? null,
                loadedExtensions: snapshot.loadedExtensions
            }
        };
    }

    continue(): Promise<void> {
        return this.agent?.continue() ?? Promise.resolve();
    }

    checkout(nodeId: string | null) {
        this.sessionManager.checkout(nodeId);
        return this.sessionManager.getSnapshot();
    }

    branchFromUserNode(userNodeId: string): ForgePiBranchFromUserResult & {
        piSessionState: ReturnType<ForgePiSessionManager['getSnapshot']>;
    } {
        const result = this.sessionManager.createBranchFromUserNode(userNodeId);
        return {
            ...result,
            piSessionState: this.sessionManager.getSnapshot()
        };
    }

    async approveToolCall(turnId: string, toolCallId: string, message?: string): Promise<ForgePiAgentSessionApprovalResult> {
        return this.resolveToolApproval(turnId, toolCallId, true, message);
    }

    async rejectToolCall(turnId: string, toolCallId: string, message?: string): Promise<ForgePiAgentSessionApprovalResult> {
        return this.resolveToolApproval(turnId, toolCallId, false, message);
    }

    async resolveToolApproval(
        turnId: string,
        toolCallId: string,
        approved: boolean,
        message?: string,
        options?: ForgeToolApprovalResolutionOptions
    ): Promise<ForgePiAgentSessionApprovalResult> {
        const pendingWait = this.pendingApprovalWaits.get(toolCallId);
        if (!pendingWait || pendingWait.requestId !== turnId) {
            return { resolved: false, events: [], effects: [] };
        }
        const resolved = pendingWait.kind === 'sdk'
            ? await this.resolveAgentRuntimeToolApproval(pendingWait, turnId, toolCallId, approved, message)
            : await this.toolBridge.resolveToolApproval(
                this.sessionId,
                turnId,
                toolCallId,
                approved,
                message,
                options
            );
        if (!resolved.resolved) return resolved;
        this.pendingApprovalWaits.delete(toolCallId);
        this.pendingApprovalBlockedToolCallIds.delete(toolCallId);

        for (const event of resolved.events) {
            if (event.type === 'tool_approval_resolved') {
                this.sessionManager.append(
                    'approval_resolved',
                    `${event.approved ? 'Approved' : 'Rejected'} · ${event.toolName}`,
                    event.message ?? (event.approved ? '工具调用已获批准。' : '工具调用已被拒绝。'),
                    event
                );
            }
        }

        if (resolved.toolResultMessage) {
            this.sessionManager.append(
                'tool_result',
                `Tool result · ${resolved.toolResultMessage.toolName}`,
                this.summarizeToolResultMessage(resolved.toolResultMessage),
                {
                    toolCallId: resolved.toolResultMessage.toolCallId,
                    toolName: resolved.toolResultMessage.toolName,
                    isError: resolved.toolResultMessage.isError,
                    agentMessage: resolved.toolResultMessage
                }
            );
        }

        if (pendingWait.kind === 'forge') {
            this.agentRuntimeEvents?.emit({
                type: 'tool_execution_end',
                sessionId: this.sessionId,
                turnId,
                toolCallId,
                toolName: pendingWait.toolName,
                status: !approved
                    ? 'denied'
                    : resolved.toolResultMessage?.isError === true
                        ? 'failed'
                        : 'completed',
                result: resolved.toolResultMessage
                    ? this.toAgentRuntimeToolResult(resolved.toolResultMessage)
                    : undefined,
                errorMessage: resolved.toolResultMessage?.isError === true
                    ? this.summarizeToolResultMessage(resolved.toolResultMessage)
                    : message
            });
        }

        if (!approved) {
            await this.finishAgentRuntimeTurn(turnId, undefined, {
                messages: this.agent?.state.messages ?? [],
                result: { approved, toolCallId }
            });
        }

        if (approved && resolved.toolResultMessage && this.agent && this.latestRequest?.requestId === turnId) {
            const restoredToolPair = this.replacePendingApprovalWithToolResult(resolved.toolResultMessage);
            if (!restoredToolPair) {
                await this.finishAgentRuntimeTurn(turnId, 'Forge tool result could not be restored.');
                return {
                    ...resolved,
                    piSessionState: this.sessionManager.getSnapshot()
                };
            }
            this.eventSink = {
                source: this.resolveEventSource(this.latestRequest),
                events: resolved.events,
                request: this.latestRequest,
                emitFirstResponse: false,
                firstResponseMarked: true,
                runtimeEvents: this.agentRuntimeEvents,
                runtimeMessageId: null,
                runtimeLastText: null
            };
            try {
                await this.agent.continue();
            } catch (error: unknown) {
                await this.finishAgentRuntimeTurn(turnId, this.resolveRuntimeErrorMessage(error));
                throw error;
            }
            const finalMessage = this.resolveLastAssistantMessage(this.agent.state.messages);
            const finalProjection = finalMessage
                ? this.projectAssistantMessage(finalMessage)
                : this.emptyAssistantProjection();
            for (const modelTrace of this.resolveModelTraces(this.latestRequest.requestId)) {
                resolved.events.push({
                    type: 'model_request_trace',
                    requestId: this.latestRequest.requestId,
                    trace: modelTrace
                });
            }
            await this.finishAgentRuntimeTurn(turnId, undefined, {
                messages: this.agent.state.messages,
                result: finalProjection
            });
        }

        return {
            ...resolved,
            piSessionState: this.sessionManager.getSnapshot()
        };
    }

    abort(): void {
        this.agent?.abort();
        const turnId = this.latestRequest?.requestId;
        if (turnId) void this.finishAgentRuntimeTurn(turnId, 'Agent runtime aborted.');
    }

    getSnapshot() {
        return this.sessionManager.getSnapshot();
    }

    private async preparePromptState(
        input: ForgePiAgentSessionTurnInput
    ): Promise<ForgePiPreparedPrompt> {
        const contextBundle = await this.resourceLoader.buildContextBundle(input.context);
        const modelConfig = this.modelRegistry.resolveRunConfig({
            request: input.request,
            context: input.context
        });
        const tools = this.loadTools(input.context);
        const baseSystemPrompt = this.resourceLoader.buildSystemPrompt({ systemFragments: [], contextBundle });
        const userInput = input.commandInput ?? this.resolveCommandInput(input.command);
        const beforeAgentStart = await this.emitBeforeAgentStart({
            prompt: userInput,
            systemPrompt: baseSystemPrompt
        });
        const systemPrompt = this.applyStructuredMessageContract(
            this.applyBeforeAgentStartResult(baseSystemPrompt, beforeAgentStart)
        );
        const branchMessages = this.sessionManager.getBranchMessages({
            providerId: modelConfig.model.provider,
            modelId: modelConfig.model.id
        });
        return {
            contextBundle,
            source: this.resolveEventSource(input.request),
            modelConfig,
            systemPrompt,
            branchMessages,
            prompt: [{
                role: 'system',
                content: systemPrompt
            }, ...branchMessages, {
                role: 'user',
                content: userInput
            }],
            activeTools: this.summarizeTools(tools)
        };
    }

    private loadTools(
        context: ForgeRuntimeContext,
        onEffects?: (effects: ForgeRuntimeEffect[]) => void
    ): ForgePiAgentTool[] {
        const forgeTools = this.extensionRunner.loadTools(context, onEffects);
        const runtimeTools = this.agentRuntimeExtensionContext
            ? this.agentRuntimeExtensionContext.tools.listTools().map(tool => this.toForgeAgentTool(tool))
            : [];
        return this.mergeTools(forgeTools, runtimeTools);
    }

    private async emitBeforeAgentStart(input: {
        prompt: string;
        systemPrompt: string;
    }): Promise<AgentRuntimeBeforeAgentStartResult> {
        const forgeResult = await (this.extensionRunner.emitBeforeAgentStart?.(input)
            ?? Promise.resolve({ systemPrompt: input.systemPrompt }));
        const runner = this.agentRuntimeExtensionContext?.runner;
        if (!runner) return forgeResult;
        const runtimeResult = await runner.emitBeforeAgentStart({
            ...input,
            systemPrompt: forgeResult.systemPrompt ?? input.systemPrompt
        });
        return this.mergeBeforeAgentStartResults(input.systemPrompt, forgeResult, runtimeResult);
    }

    private mergeBeforeAgentStartResults(
        baseSystemPrompt: string,
        forgeResult: AgentRuntimeBeforeAgentStartResult,
        runtimeResult: AgentRuntimeBeforeAgentStartResult
    ): AgentRuntimeBeforeAgentStartResult {
        const messages = [
            ...(forgeResult.messages ?? []),
            ...(runtimeResult.messages ?? [])
        ];
        return {
            ...(messages.length > 0 ? { messages } : {}),
            systemPrompt: runtimeResult.systemPrompt ?? forgeResult.systemPrompt ?? baseSystemPrompt
        };
    }

    private toForgeAgentTool(tool: AgentRuntimeTool): ForgePiAgentTool<TSchema> {
        const needsApproval = tool.needsApproval;
        return {
            name: tool.name,
            label: tool.label ?? tool.name,
            description: tool.description,
            parameters: this.toToolSchema(tool.parameters),
            ...(needsApproval !== undefined
                ? {
                    needsApproval: typeof needsApproval === 'function'
                        ? (args: Static<TSchema>) => needsApproval(args)
                        : needsApproval
                }
                : {}),
            execute: async (
                toolCallId: string,
                params: Static<TSchema>
            ): Promise<AgentToolResult<unknown>> => this.executeAgentRuntimeTool(tool.name, toolCallId, params)
        };
    }

    private toToolSchema(parameters: unknown): TSchema {
        // SDK 只持有跨运行时 schema；Forge pi-agent 边界在这里恢复为 pi 可执行工具 schema。
        return parameters as TSchema;
    }

    private async executeAgentRuntimeTool(
        toolName: string,
        toolCallId: string,
        args: unknown
    ): Promise<AgentToolResult<unknown>> {
        const tools = this.agentRuntimeExtensionContext?.tools;
        if (!tools) {
            throw new Error('Agent runtime tool registry is not attached.');
        }
        const turnId = this.latestRequest?.requestId;
        if (!turnId) {
            throw new Error('Agent runtime tool execution has no active turn.');
        }
        const execution = await tools.execute({
            sessionId: this.sessionId,
            turnId,
            toolCallId,
            toolName,
            args
        });
        if (execution.status === 'executed' || execution.status === 'blocked') {
            return this.toPiAgentToolResult(execution.result);
        }
        this.pendingApprovalWaits.set(toolCallId, {
            requestId: turnId,
            toolName,
            kind: 'sdk',
            source: this.eventSink?.source ?? 'system',
            args,
            approvalId: execution.approval.approvalId
        });
        const approvalEvent: ForgeToolApprovalNeededEvent = {
            type: 'tool_approval_needed',
            requestId: turnId,
            approvalId: execution.approval.approvalId,
            toolCallId,
            toolName,
            args: execution.approval.args,
            reason: '工具调用需要用户授权。',
            source: this.eventSink?.source ?? 'system',
            approvalKind: 'tool',
            displaySurface: 'composer',
            forgeProjectId: this.latestContext?.workspaceSessionId ?? null,
            conversationId: this.latestContext?.sessionChatId ?? null,
            sessionId: this.sessionId
        };
        const sink = this.eventSink;
        if (sink) this.emitToolApprovalNeeded(sink, approvalEvent);
        return {
            content: [{
                type: 'text',
                text: '工具调用等待用户授权。'
            }],
            details: {
                status: execution.status,
                approval: execution.approval
            },
            terminate: true
        };
    }

    private async resolveAgentRuntimeToolApproval(
        pending: {
            requestId: string;
            toolName: string;
            source: ForgeRuntimeEventSource;
            args: unknown;
            approvalId?: string;
        },
        turnId: string,
        toolCallId: string,
        approved: boolean,
        message?: string
    ): Promise<{
        resolved: boolean;
        events: ForgeRuntimeEvent[];
        effects: ForgeRuntimeEffect[];
        toolResultMessage?: ToolResultMessage;
    }> {
        const tools = this.agentRuntimeExtensionContext?.tools;
        if (!tools) return { resolved: false, events: [], effects: [] };
        let resolution: AgentToolApprovalResolution;
        try {
            resolution = await tools.resolveToolApproval(
                this.sessionId,
                turnId,
                toolCallId,
                approved,
                message
            );
        } catch (error: unknown) {
            const errorMessage = this.resolveRuntimeErrorMessage(error);
            resolution = {
                status: 'approved',
                approval: {
                    approvalId: pending.approvalId ?? `approval-${toolCallId}`,
                    sessionId: this.sessionId,
                    turnId,
                    toolCallId,
                    toolName: pending.toolName,
                    args: pending.args
                },
                result: {
                    content: [{ type: 'text', text: errorMessage }],
                    details: { error: errorMessage }
                },
                message: errorMessage
            };
            return {
                resolved: true,
                events: [this.createAgentRuntimeToolApprovalResolvedEvent(pending, turnId, toolCallId, approved, message)],
                effects: [],
                toolResultMessage: {
                    role: 'toolResult',
                    toolCallId,
                    toolName: pending.toolName,
                    content: resolution.result.content as AgentToolResult<unknown>['content'],
                    details: toJsonValue(resolution.result.details),
                    isError: true,
                    timestamp: Date.now()
                }
            };
        }
        if (resolution.status === 'not_found') {
            return { resolved: false, events: [], effects: [] };
        }
        const event = this.createAgentRuntimeToolApprovalResolvedEvent(
            pending,
            turnId,
            toolCallId,
            approved,
            message
        );
        if (resolution.status === 'denied') {
            return { resolved: true, events: [event], effects: [] };
        }
        return {
            resolved: true,
            events: [event],
            effects: [],
            toolResultMessage: {
                role: 'toolResult',
                toolCallId,
                toolName: pending.toolName,
                content: resolution.result.content as AgentToolResult<unknown>['content'],
                details: toJsonValue(resolution.result.details),
                isError: false,
                timestamp: Date.now()
            }
        };
    }

    private createAgentRuntimeToolApprovalResolvedEvent(
        pending: {
            source: ForgeRuntimeEventSource;
            approvalId?: string;
            toolName: string;
        },
        turnId: string,
        toolCallId: string,
        approved: boolean,
        message?: string
    ): Extract<ForgeRuntimeEvent, { type: 'tool_approval_resolved' }> {
        return {
            type: 'tool_approval_resolved',
            requestId: turnId,
            approvalId: pending.approvalId ?? `approval-${toolCallId}`,
            toolCallId,
            toolName: pending.toolName,
            approved,
            message,
            source: pending.source,
            approvalKind: 'tool',
            displaySurface: 'composer',
            forgeProjectId: this.latestContext?.workspaceSessionId ?? null,
            conversationId: this.latestContext?.sessionChatId ?? null,
            sessionId: this.sessionId
        };
    }

    private toPiAgentToolResult(result: AgentRuntimeToolResult): AgentToolResult<unknown> {
        return {
            content: result.content.map(content =>
                content as AgentToolResult<unknown>['content'][number]
            ),
            details: result.details
        };
    }

    private mergeTools(...groups: ForgePiAgentTool[][]): ForgePiAgentTool[] {
        const tools: ForgePiAgentTool[] = [];
        const names = new Set<string>();
        for (const group of groups) {
            for (const tool of group) {
                if (names.has(tool.name)) {
                    throw new Error(`Forge agent tool already registered: ${tool.name}`);
                }
                names.add(tool.name);
                tools.push(tool);
            }
        }
        return tools;
    }

    private async emitAgentRuntimeAgentEnd(event: AgentRuntimeAgentEndEvent): Promise<void> {
        await this.agentRuntimeExtensionContext?.runner?.emitAgentEnd(event);
    }

    private applyBeforeAgentStartResult(
        baseSystemPrompt: string,
        result: AgentRuntimeBeforeAgentStartResult
    ): string {
        const systemPrompt = result.systemPrompt ?? baseSystemPrompt;
        const hiddenMessages = (result.messages ?? [])
            .filter(message => message.display === false)
            .map(message => this.renderExtensionHiddenMessage(message));
        if (hiddenMessages.length === 0) return systemPrompt;
        return [
            systemPrompt,
            '# Extension hidden context',
            ...hiddenMessages
        ].join('\n\n');
    }

    private renderExtensionHiddenMessage(message: AgentRuntimeCustomMessage): string {
        return [
            `## ${message.customType}`,
            this.stringifyExtensionMessageContent(message.content)
        ].join('\n');
    }

    private stringifyExtensionMessageContent(content: unknown): string {
        if (typeof content === 'string') return content;
        try {
            const serialized = JSON.stringify(content, null, 2);
            return serialized ?? String(content);
        } catch {
            return String(content);
        }
    }

    private createAgent(input: {
        systemPrompt: string;
        messages: AgentMessage[];
        tools: ForgePiAgentTool[];
        modelConfig: ReturnType<ForgePiModelRegistry['resolveRunConfig']>;
    }): Agent {
        const agent = new Agent({
            initialState: {
                systemPrompt: input.systemPrompt,
                messages: input.messages,
                tools: input.tools,
                model: input.modelConfig.model,
                thinkingLevel: 'off'
            },
            streamFn: input.modelConfig.streamFn,
            sessionId: this.sessionId,
            toolExecution: 'sequential',
            beforeToolCall: async context => this.handleBeforeToolCall(context)
        });

        agent.subscribe((event) => {
            const sink = this.eventSink;
            if (!sink) return;
            this.handleAgentEvent(event, sink, () => {
                if (!sink.emitFirstResponse || sink.firstResponseMarked) return;
                sink.firstResponseMarked = true;
                const runtimeEvent: ForgeRuntimeEvent = {
                    type: 'first_response',
                    requestId: sink.request.requestId,
                    firstResponseAt: Date.now()
                };
                sink.events.push(runtimeEvent);
                sink.onRuntimeEvent?.(runtimeEvent);
            });
        });
        return agent;
    }

    private summarizeTools(tools: Array<{
        name?: string;
        label?: string;
        description?: string | null;
        needsApproval?: boolean | ((args: never) => boolean | Promise<boolean>);
    }>): ForgeModelRequestToolSummary[] {
        return tools
            .filter((tool): tool is {
                name: string;
                label?: string;
                description?: string | null;
                needsApproval?: boolean | ((args: never) => boolean | Promise<boolean>);
            } => Boolean(tool.name))
            .map(tool => ({
                name: tool.name,
                description: tool.description ?? tool.label ?? null,
                needsApproval: typeof tool.needsApproval === 'function' ? 'dynamic' : Boolean(tool.needsApproval)
            }));
    }

    private handleAgentEvent(
        event: AgentEvent,
        input: ForgePiEventSink,
        markFirstResponse: () => void
    ): void {
        if (event.type === 'message_end' && event.message.role === 'toolResult') {
            if (this.discardPendingApprovalToolResult(event.message)) return;
        }
        if (event.type === 'message_start' && event.message.role === 'assistant') {
            this.emitAgentRuntimeMessageStart(input);
        }
        if (event.type === 'message_update') {
            markFirstResponse();
            const projection = this.projectAssistantMessage(event.message);
            this.emitAgentRuntimeTextUpdate(input, projection);
        }
        if (event.type === 'message_end' && event.message.role === 'assistant') {
            const projection = this.projectAssistantMessage(event.message);
            this.emitAgentRuntimeTextUpdate(input, projection);
            this.emitAgentRuntimeMessageStart(input);
            const messageId = input.runtimeMessageId;
            if (messageId) {
                input.runtimeEvents?.emit({
                    type: 'message_end',
                    sessionId: this.sessionId,
                    turnId: input.request.requestId,
                    messageId
                });
                input.runtimeMessageId = null;
                input.runtimeLastText = null;
            }
            for (const processText of projection.thinkingBlocks) {
                this.sessionManager.append('process', 'Process', processText, {
                    role: 'process',
                    text: processText,
                    source: 'provider_native_thinking'
                });
            }
            if (!projection.finalText) return;
            const classified = classifyForgePiAssistantMessageForReplay(event.message, {
                providerId: event.message.provider,
                modelId: event.message.responseModel ?? event.message.model
            });
            this.sessionManager.append('assistant', 'Assistant', projection.finalText, {
                agentMessage: classified.replayMessage,
                replayAgentMessage: classified.replayMessage,
                text: projection.finalText,
                providerReasoningArtifactCount: classified.providerReasoningArtifacts.length,
                unsafeInternalPartCount: classified.unsafeInternalParts.length,
                reasoningSanitizerTrace: {
                    rawPartTypes: this.describeAgentMessageParts(event.message),
                    replayPartTypes: this.describeAgentMessageParts(classified.replayMessage),
                    rawPartCount: this.getAgentMessageContent(event.message).length,
                    replayPartCount: this.getAgentMessageContent(classified.replayMessage).length
                }
            });
        }
        if (event.type === 'tool_execution_start') {
            if (!this.isAgentRuntimeRegisteredTool(event.toolName)) {
                input.runtimeEvents?.emit({
                    type: 'tool_execution_start',
                    sessionId: this.sessionId,
                    turnId: input.request.requestId,
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    args: event.args
                });
            }
            const toolCallRecord = {
                requestId: input.request.requestId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args,
                source: input.source
            };
            const replayAgentMessage = this.createToolCallReplayMessage({
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args
            });
            this.sessionManager.append(
                'tool_call',
                `Tool call · ${event.toolName}`,
                JSON.stringify(event.args).slice(0, 160),
                replayAgentMessage
                    ? { ...toolCallRecord, agentMessage: replayAgentMessage, replayAgentMessage }
                    : toolCallRecord
            );
        }
        if (event.type === 'tool_execution_end') {
            if (this.markPendingApprovalBlockAsTerminating(event)) return;
            const pendingApproval = this.resolvePendingApprovalToolDetails(event.result);
            if (pendingApproval && this.latestContext) {
                const runtimeEvent = this.createToolApprovalNeededEvent({
                    requestId: input.request.requestId,
                    source: input.source,
                    approval: pendingApproval
                });
                this.toolBridge.registerPendingApproval({
                    requestId: input.request.requestId,
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    args: pendingApproval.args,
                    context: this.latestContext,
                    source: input.source,
                    approvalKind: pendingApproval.approvalKind,
                    displaySurface: pendingApproval.displaySurface,
                    shellPermissionRequestId: pendingApproval.shellPermissionRequestId ?? null,
                    forgeProjectId: this.latestContext.workspaceSessionId,
                    conversationId: this.latestContext.sessionChatId,
                    sessionId: this.sessionId
                });
                this.emitToolApprovalNeeded(input, runtimeEvent);
                return;
            }
            if (!this.isAgentRuntimeRegisteredTool(event.toolName)) {
                input.runtimeEvents?.emit({
                    type: 'tool_execution_end',
                    sessionId: this.sessionId,
                    turnId: input.request.requestId,
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    status: event.isError ? 'failed' : 'completed',
                    result: this.toAgentRuntimeToolResult(event.result),
                    errorMessage: event.isError ? 'Tool execution failed.' : undefined
                });
            }
            const toolResultRecord = {
                requestId: input.request.requestId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                result: event.result?.details ?? event.result,
                isError: event.isError,
                source: input.source
            };
            this.sessionManager.append(
                'tool_result',
                `Tool result · ${event.toolName}`,
                JSON.stringify(toolResultRecord.result).slice(0, 160),
                toolResultRecord
            );
        }
    }

    private isAgentRuntimeRegisteredTool(toolName: string): boolean {
        return Boolean(this.agentRuntimeExtensionContext?.tools.listTools().some(tool => tool.name === toolName));
    }

    private handleBeforeToolCall(context: BeforeToolCallContext): BeforeToolCallResult | undefined {
        const sink = this.eventSink;
        const latestContext = this.latestContext;
        if (!sink || !latestContext) return undefined;

        const approval = this.toolBridge.requestToolApproval({
            requestId: sink.request.requestId,
            toolCallId: context.toolCall.id,
            toolName: context.toolCall.name,
            args: context.args,
            context: latestContext,
            source: sink.source,
            forgeProjectId: latestContext.workspaceSessionId,
            conversationId: latestContext.sessionChatId,
            sessionId: this.sessionId
        });
        if (!approval) return undefined;

        this.pendingApprovalBlockedToolCallIds.add(context.toolCall.id);
        this.pendingApprovalWaits.set(context.toolCall.id, {
            requestId: sink.request.requestId,
            toolName: context.toolCall.name,
            kind: 'forge',
            source: sink.source,
            args: context.args
        });
        this.emitToolApprovalNeeded(
            sink,
            this.createToolApprovalNeededEvent({
                requestId: sink.request.requestId,
                source: sink.source,
                approval
            })
        );
        return {
            block: true,
            reason: this.createApprovalBlockReason(context.toolCall.id)
        };
    }

    private createToolApprovalNeededEvent(input: {
        requestId: string;
        source: ForgeRuntimeEventSource;
        approval: ForgePendingToolApproval | ForgePendingApprovalToolDetails;
    }): ForgeToolApprovalNeededEvent {
        return {
            type: 'tool_approval_needed',
            requestId: input.requestId,
            approvalId: `approval-${input.approval.toolCallId}`,
            toolCallId: input.approval.toolCallId,
            toolName: input.approval.toolName,
            args: input.approval.args,
            reason: input.approval.reason ?? '工具调用需要用户授权。',
            source: input.source,
            approvalKind: input.approval.approvalKind,
            displaySurface: input.approval.displaySurface,
            shellPermissionRequestId: input.approval.shellPermissionRequestId ?? null,
            forgeProjectId: this.latestContext?.workspaceSessionId ?? null,
            conversationId: this.latestContext?.sessionChatId ?? null,
            sessionId: this.sessionId
        };
    }

    private emitToolApprovalNeeded(input: ForgePiEventSink, runtimeEvent: ForgeToolApprovalNeededEvent): void {
        input.events.push(runtimeEvent);
        input.onRuntimeEvent?.(runtimeEvent);
        this.sessionManager.append(
            'approval_needed',
            `Approval needed · ${runtimeEvent.toolName}`,
            runtimeEvent.reason,
            runtimeEvent
        );
    }

    private createApprovalBlockReason(toolCallId: string): string {
        return `${ForgePiAgentSession.approvalBlockReasonPrefix}: ${toolCallId}`;
    }

    private markPendingApprovalBlockAsTerminating(
        event: Extract<AgentEvent, { type: 'tool_execution_end' }>
    ): boolean {
        if (!event.isError) return false;
        if (!this.pendingApprovalBlockedToolCallIds.has(event.toolCallId)) return false;
        if (!this.resultTextIncludes(event.result, this.createApprovalBlockReason(event.toolCallId))) return false;
        if (this.isRecord(event.result)) {
            event.result.terminate = true;
        }
        return true;
    }

    private hasPendingApprovalForRequest(requestId: string): boolean {
        for (const pending of this.pendingApprovalWaits.values()) {
            if (pending.requestId === requestId) return true;
        }
        return false;
    }

    private discardPendingApprovalToolResult(message: ToolResultMessage): boolean {
        if (!this.pendingApprovalBlockedToolCallIds.has(message.toolCallId)) return false;
        this.pendingApprovalBlockedToolCallIds.delete(message.toolCallId);
        if (this.agent) {
            this.agent.state.messages = this.agent.state.messages.filter(item =>
                !this.isToolResultForCall(item, message.toolCallId)
            );
        }
        return true;
    }

    private resultTextIncludes(result: unknown, text: string): boolean {
        if (!this.isRecord(result)) return false;
        const content = result.content;
        if (!Array.isArray(content)) return false;
        return content.some(item =>
            this.isRecord(item)
            && item.type === 'text'
            && typeof item.text === 'string'
            && item.text.includes(text)
        );
    }

    private resolvePendingApprovalToolDetails(result: unknown): ForgePendingApprovalToolDetails | null {
        if (!this.isRecord(result)) return null;
        const details = result.details;
        if (!this.isRecord(details)) return null;
        if (details.status !== 'approval_pending') return null;
        if (details.approvalKind !== 'network' && details.approvalKind !== 'tool') return null;
        if (details.displaySurface !== 'composer' && details.displaySurface !== 'review') return null;
        if (typeof details.toolCallId !== 'string') return null;
        if (typeof details.toolName !== 'string') return null;
        return {
            status: 'approval_pending',
            approvalKind: details.approvalKind,
            displaySurface: details.displaySurface,
            toolCallId: details.toolCallId,
            toolName: details.toolName,
            args: details.args,
            shellPermissionRequestId: typeof details.shellPermissionRequestId === 'string'
                ? details.shellPermissionRequestId
                : null,
            reason: typeof details.reason === 'string' ? details.reason : undefined
        };
    }

    private emitAgentRuntimeMessageStart(input: ForgePiEventSink): void {
        if (!input.runtimeEvents || input.runtimeMessageId) return;
        const messageId = this.createAgentRuntimeMessageId(input.request.requestId);
        input.runtimeMessageId = messageId;
        input.runtimeEvents.emit({
            type: 'message_start',
            sessionId: this.sessionId,
            turnId: input.request.requestId,
            message: {
                id: messageId,
                turnId: input.request.requestId,
                role: 'assistant',
                blocks: []
            }
        });
    }

    private emitAgentRuntimeTextUpdate(
        input: ForgePiEventSink,
        projection: ForgePiAssistantProjection
    ): boolean {
        if (projection.streamKey.length === 0 || projection.streamKey === input.runtimeLastText) return false;
        input.runtimeLastText = projection.streamKey;
        if (!input.runtimeEvents) return true;
        this.emitAgentRuntimeMessageStart(input);
        const messageId = input.runtimeMessageId;
        if (!messageId) return false;
        for (const block of projection.runtimeBlocks) {
            input.runtimeEvents.emit({
                type: 'message_update',
                sessionId: this.sessionId,
                turnId: input.request.requestId,
                messageId,
                block
            });
        }
        return true;
    }

    private createAgentRuntimeMessageId(turnId: string): string {
        const sequence = (this.messageSequences.get(turnId) ?? 0) + 1;
        this.messageSequences.set(turnId, sequence);
        return `agent-message:${this.sessionId}:${turnId}:${sequence}`;
    }

    private toAgentRuntimeToolResult(result: unknown): AgentRuntimeToolResult | undefined {
        if (!result || typeof result !== 'object') return undefined;
        const record = result as { content?: unknown; details?: unknown };
        return {
            content: this.toAgentRuntimeContent(record.content),
            details: record.details ?? result
        };
    }

    private toAgentRuntimeContent(content: unknown): AgentRuntimeContentBlock[] {
        if (!Array.isArray(content)) return [];
        return content
            .filter((part): part is AgentRuntimeContentBlock =>
                Boolean(part) && typeof part === 'object' && typeof (part as { type?: unknown }).type === 'string'
            )
            .map(part => ({ ...part }));
    }

    private async finishAgentRuntimeTurn(
        turnId: string,
        errorMessage?: string,
        extensionEvent?: AgentRuntimeAgentEndEvent
    ): Promise<void> {
        if (this.endedTurnIds.has(turnId)) return;
        this.endedTurnIds.add(turnId);
        this.agentRuntimeEvents?.emit({
            type: 'turn_end',
            sessionId: this.sessionId,
            turnId,
            errorMessage
        });
        this.agentRuntimeEvents?.emit({
            type: 'agent_end',
            sessionId: this.sessionId,
            turnId
        });
        await this.emitAgentRuntimeAgentEnd(extensionEvent ?? {
            messages: this.agent?.state.messages ?? [],
            result: errorMessage === undefined ? null : { errorMessage }
        });
    }

    private resolveRuntimeErrorMessage(error: unknown): string {
        if (error instanceof Error && error.message.trim().length > 0) return error.message;
        return 'Forge agent runtime failed.';
    }

    private summarizeToolResultMessage(message: ToolResultMessage): string {
        const text = this.toAgentRuntimeContent(message.content)
            .map(block => block.text)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .join('\n');
        return text || (message.isError ? 'Tool execution failed.' : 'Tool execution completed.');
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    private replacePendingApprovalWithToolResult(toolResultMessage: ToolResultMessage): boolean {
        if (!this.agent) return false;
        const messages = this.agent.state.messages;
        const toolCallIndex = [...messages].reverse().findIndex(message => {
            if (message.role !== 'assistant') return false;
            return message.content.some(part => part.type === 'toolCall' && part.id === toolResultMessage.toolCallId);
        });
        if (toolCallIndex === -1) {
            const replayToolCallMessage = this.findReplayToolCallMessage(toolResultMessage.toolCallId);
            if (!replayToolCallMessage) return false;
            this.agent.state.messages = [
                ...messages.filter(message => !this.isToolResultForCall(message, toolResultMessage.toolCallId)),
                replayToolCallMessage,
                toolResultMessage as AgentMessage
            ];
            return true;
        }
        const assistantIndex = messages.length - 1 - toolCallIndex;
        this.agent.state.messages = [
            ...messages.slice(0, assistantIndex + 1),
            toolResultMessage as AgentMessage
        ];
        return true;
    }

    private createToolCallReplayMessage(input: {
        toolCallId: string;
        toolName: string;
        args: unknown;
    }): AssistantMessage | null {
        const model = this.agent?.state.model;
        if (!model) return null;
        return {
            role: 'assistant',
            content: [{
                type: 'toolCall',
                id: input.toolCallId,
                name: input.toolName,
                arguments: this.toToolCallArguments(input.args)
            }],
            api: model.api,
            provider: model.provider,
            model: model.id,
            responseModel: model.id,
            usage: this.createEmptyUsage(),
            stopReason: 'toolUse',
            timestamp: Date.now()
        };
    }

    private createEmptyUsage(): AssistantMessage['usage'] {
        return {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0
            }
        };
    }

    private toToolCallArguments(args: unknown): JsonObject {
        return toJsonObject(args);
    }

    private findReplayToolCallMessage(toolCallId: string): AgentMessage | null {
        for (const entry of [...this.sessionManager.getEntries()].reverse()) {
            if (entry.kind !== 'tool_call') continue;
            if (!this.isRecord(entry.payload)) continue;
            if (this.isAssistantToolCallMessage(entry.payload.replayAgentMessage, toolCallId)) {
                return entry.payload.replayAgentMessage;
            }
            if (this.isAssistantToolCallMessage(entry.payload.agentMessage, toolCallId)) {
                return entry.payload.agentMessage;
            }
        }
        return null;
    }

    private isAssistantToolCallMessage(value: unknown, toolCallId: string): value is AssistantMessage {
        if (!this.isRecord(value)) return false;
        if (value.role !== 'assistant') return false;
        if (!Array.isArray(value.content)) return false;
        return value.content.some(part =>
            this.isRecord(part) && part.type === 'toolCall' && part.id === toolCallId
        );
    }

    private isToolResultForCall(message: AgentMessage, toolCallId: string): boolean {
        return message.role === 'toolResult' && message.toolCallId === toolCallId;
    }

    private resolveCommandInput(command: ForgeUserCommand): string {
        if (command.type === 'send_user_input') return command.input;
        if (command.type === 'submit_form') return command.userInput ?? '';
        if (command.type === 'refresh_workflow') return command.userInput ?? '';
        return '';
    }

    private resolveEventSource(request: ForgeExecutionRequest): ForgeRuntimeEventSource {
        if (request.traceSource === 'analyst') return 'analyst';
        if (request.traceSource === 'executor') return 'executor';
        if (request.traceSource === 'conversation') return 'conversation';
        return 'planner';
    }

    private resolveModelTraces(requestId: string) {
        const traces = typeof this.modelRegistry.getTraces === 'function'
            ? this.modelRegistry.getTraces(requestId)
            : [];
        if (traces.length > 0) return traces;
        const trace = typeof this.modelRegistry.getTrace === 'function'
            ? this.modelRegistry.getTrace(requestId)
            : null;
        return trace ? [trace] : [];
    }

    private describeAgentMessageParts(message: AgentMessage): string[] {
        return this.getAgentMessageContent(message).map(part => this.describeAgentMessagePart(part));
    }

    private getAgentMessageContent(message: AgentMessage): unknown[] {
        if (!('content' in message) || !Array.isArray(message.content)) return [];
        return message.content;
    }

    private describeAgentMessagePart(part: unknown): string {
        const type = (part as { type?: unknown }).type;
        return typeof type === 'string' && type.length > 0 ? type : 'unknown';
    }

    private resolveLastAssistantMessage(messages: AgentMessage[]): AgentMessage | null {
        return [...messages].reverse().find(message => message.role === 'assistant') ?? null;
    }

    private projectAssistantMessage(message: AgentMessage): ForgePiAssistantProjection {
        if (message.role !== 'assistant') return this.emptyAssistantProjection();
        const finalTextParts: string[] = [];
        const thinkingBlocks: string[] = [];
        const runtimeBlocks: AgentRuntimeContentBlock[] = [];
        this.getAgentMessageContent(message).forEach((part, contentIndex) => {
            if (!this.isRecord(part)) return;
            if (part.type === 'text' && typeof part.text === 'string') {
                finalTextParts.push(part.text);
                runtimeBlocks.push({
                    type: 'text',
                    contentIndex,
                    text: part.text
                });
                return;
            }
            if (part.type === 'thinking' && typeof part.thinking === 'string') {
                if (part.thinking.length > 0) {
                    thinkingBlocks.push(part.thinking);
                }
                runtimeBlocks.push({
                    type: 'thinking',
                    contentIndex,
                    text: part.thinking,
                    redacted: part.redacted === true
                });
                return;
            }
            if (part.type === 'toolCall' && typeof part.id === 'string' && typeof part.name === 'string') {
                runtimeBlocks.push({
                    type: 'toolCall',
                    id: part.id,
                    contentIndex,
                    toolName: part.name,
                    args: part.arguments
                });
            }
        });
        const finalText = finalTextParts.join('');
        const thinkingText = thinkingBlocks.join('\n\n');
        return {
            rawText: finalText,
            finalText,
            thinkingBlocks,
            thinkingText,
            runtimeBlocks,
            streamKey: runtimeBlocks.length > 0 ? JSON.stringify(runtimeBlocks) : ''
        };
    }

    private emptyAssistantProjection(): ForgePiAssistantProjection {
        return {
            rawText: '',
            finalText: '',
            thinkingBlocks: [],
            thinkingText: '',
            runtimeBlocks: [],
            streamKey: ''
        };
    }

    private applyStructuredMessageContract(systemPrompt: string): string {
        if (systemPrompt.includes('Provider-native structured messages')) return systemPrompt;
        return [
            systemPrompt,
            '# Provider-native structured messages',
            'Return the final user-facing reply as provider-native text content.',
            'Use provider-native thinking content for concise public execution progress when the selected provider supports it.',
            'Tool calls, file write summaries, and Git metadata must come from runtime/tool events, not assistant text.'
        ].join('\n\n');
    }
}
