import {
    Agent,
    type AgentEvent,
    type AgentMessage,
    type BeforeToolCallContext,
    type BeforeToolCallResult
} from '@earendil-works/pi-agent-core';
import type { AssistantMessage, ToolResultMessage } from '@earendil-works/pi-ai';
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
import {
    type AgentRuntimeContentBlock,
    AgentRuntimeEventBus
} from '../../../agent-runtime/events/AgentRuntimeEventBus.js';
import type { AgentRuntimeToolResult } from '../../../agent-runtime/tools/AgentToolRegistry.js';
import type {
    AgentRuntimeBeforeAgentStartResult,
    AgentRuntimeCustomMessage
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
    runtimeMessageStarted: boolean;
    runtimeLastText: string | null;
    onRuntimeEvent?: (event: ForgeRuntimeEvent) => void;
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
    private readonly pendingApprovalBlockedToolCallIds = new Set<string>();
    private readonly pendingApprovalWaits = new Map<string, { requestId: string }>();

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

    async prompt(input: ForgePiAgentSessionTurnInput): Promise<ForgePiAgentSessionTurnResult> {
        this.latestContext = input.context;
        this.latestRequest = input.request;
        const effects: ForgeRuntimeEffect[] = [];
        const prepared = await this.promptAssembler.prepareForRun(input);
        this.promptAssembler.invalidate(input);
        const tools = this.extensionRunner.loadTools(
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
            sessionId: this.sessionId
        });
        this.agentRuntimeEvents?.emit({
            type: 'turn_start',
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
            runtimeMessageStarted: false,
            runtimeLastText: null,
            onRuntimeEvent: input.onRuntimeEvent
        };
        await agent.prompt(userMessage);

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
        emitEvent({
            type: 'stream_done',
            requestId: input.request.requestId,
            rawText: finalProjection.rawText,
            displayText: finalProjection.finalText,
            thinkingText: finalProjection.thinkingText,
            completedAt: Date.now()
        });
        this.agentRuntimeEvents?.emit({
            type: 'turn_end',
            turnId: input.request.requestId
        });
        this.agentRuntimeEvents?.emit({
            type: 'agent_end',
            sessionId: this.sessionId
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

    async approveToolCall(toolCallId: string, message?: string): Promise<ForgePiAgentSessionApprovalResult> {
        return this.resolveToolApproval(toolCallId, true, message);
    }

    async rejectToolCall(toolCallId: string, message?: string): Promise<ForgePiAgentSessionApprovalResult> {
        return this.resolveToolApproval(toolCallId, false, message);
    }

    async resolveToolApproval(
        toolCallId: string,
        approved: boolean,
        message?: string,
        options?: ForgeToolApprovalResolutionOptions
    ): Promise<ForgePiAgentSessionApprovalResult> {
        const resolved = await this.toolBridge.resolveToolApproval(toolCallId, approved, message, options);
        if (!resolved.resolved) return resolved;
        this.pendingApprovalWaits.delete(toolCallId);

        for (const event of resolved.events) {
            if (event.type === 'tool_approval_resolved') {
                this.sessionManager.append(
                    'approval_resolved',
                    `${event.approved ? 'Approved' : 'Rejected'} · ${event.toolName}`,
                    event.message ?? (event.approved ? '工具调用已获批准。' : '工具调用已被拒绝。'),
                    event
                );
            }
            if (event.type === 'tool_result') {
                this.sessionManager.append(
                    'tool_result',
                    `Tool result · ${event.toolName}`,
                    JSON.stringify(event.result).slice(0, 160),
                    resolved.toolResultMessage?.toolCallId === event.toolCallId
                        ? { ...event, agentMessage: resolved.toolResultMessage }
                        : event
                );
            }
        }

        if (!approved && this.latestRequest) {
            this.agentRuntimeEvents?.emit({
                type: 'turn_end',
                turnId: this.latestRequest.requestId
            });
            this.agentRuntimeEvents?.emit({
                type: 'agent_end',
                sessionId: this.sessionId
            });
        }

        if (approved && resolved.toolResultMessage && this.agent && this.latestRequest) {
            const restoredToolPair = this.replacePendingApprovalWithToolResult(resolved.toolResultMessage);
            if (!restoredToolPair) {
                return {
                    ...resolved,
                    piSessionState: this.sessionManager.getSnapshot()
                };
            }
            this.agentRuntimeEvents?.emit({
                type: 'turn_start',
                turnId: this.latestRequest.requestId
            });
            this.eventSink = {
                source: this.resolveEventSource(this.latestRequest),
                events: resolved.events,
                request: this.latestRequest,
                emitFirstResponse: false,
                firstResponseMarked: true,
                runtimeEvents: this.agentRuntimeEvents,
                runtimeMessageStarted: false,
                runtimeLastText: null
            };
            await this.agent.continue();
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
            resolved.events.push({
                type: 'stream_done',
                requestId: this.latestRequest.requestId,
                rawText: finalProjection.rawText,
                displayText: finalProjection.finalText,
                thinkingText: finalProjection.thinkingText,
                completedAt: Date.now()
            });
            this.agentRuntimeEvents?.emit({
                type: 'turn_end',
                turnId: this.latestRequest.requestId
            });
            this.agentRuntimeEvents?.emit({
                type: 'agent_end',
                sessionId: this.sessionId
            });
        }

        return {
            ...resolved,
            piSessionState: this.sessionManager.getSnapshot()
        };
    }

    abort(): void {
        this.agent?.abort();
        this.agentRuntimeEvents?.emit({
            type: 'agent_end',
            sessionId: this.sessionId
        });
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
        const tools = this.extensionRunner.loadTools(input.context);
        const baseSystemPrompt = this.resourceLoader.buildSystemPrompt({ systemFragments: [], contextBundle });
        const userInput = input.commandInput ?? this.resolveCommandInput(input.command);
        const beforeAgentStart = await (this.extensionRunner.emitBeforeAgentStart?.({
            prompt: userInput,
            systemPrompt: baseSystemPrompt
        }) ?? Promise.resolve({ systemPrompt: baseSystemPrompt }));
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
        if (event.type === 'message_update') {
            markFirstResponse();
            const projection = this.projectAssistantMessage(event.message);
            if (!this.emitAgentRuntimeTextUpdate(input, projection)) return;
            const runtimeEvent: ForgeRuntimeEvent = {
                type: 'stream_chunk',
                requestId: input.request.requestId,
                displayText: projection.finalText,
                thinkingText: projection.thinkingText,
                rawText: projection.rawText
            };
            input.events.push(runtimeEvent);
            input.onRuntimeEvent?.(runtimeEvent);
        }
        if (event.type === 'message_end' && event.message.role === 'assistant') {
            const projection = this.projectAssistantMessage(event.message);
            this.emitAgentRuntimeMessageStart(input);
            input.runtimeEvents?.emit({
                type: 'message_end',
                messageId: input.request.requestId
            });
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
            input.runtimeEvents?.emit({
                type: 'tool_execution_start',
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args
            });
            const runtimeEvent: ForgeRuntimeEvent = {
                type: 'tool_call',
                requestId: input.request.requestId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args,
                source: input.source
            };
            input.events.push(runtimeEvent);
            input.onRuntimeEvent?.(runtimeEvent);
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
                    ? { ...runtimeEvent, agentMessage: replayAgentMessage, replayAgentMessage }
                    : runtimeEvent
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
            input.runtimeEvents?.emit({
                type: 'tool_execution_end',
                toolCallId: event.toolCallId,
                status: event.isError ? 'failed' : 'completed',
                result: this.toAgentRuntimeToolResult(event.result),
                errorMessage: event.isError ? 'Tool execution failed.' : undefined
            });
            const runtimeEvent: ForgeRuntimeEvent = {
                type: 'tool_result',
                requestId: input.request.requestId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                result: event.result?.details ?? event.result,
                isError: event.isError,
                source: input.source
            };
            input.events.push(runtimeEvent);
            input.onRuntimeEvent?.(runtimeEvent);
            this.sessionManager.append('tool_result', `Tool result · ${event.toolName}`, JSON.stringify(runtimeEvent.result).slice(0, 160), runtimeEvent);
        }
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
        this.pendingApprovalWaits.set(context.toolCall.id, { requestId: sink.request.requestId });
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
        if (!input.runtimeEvents || input.runtimeMessageStarted) return;
        input.runtimeMessageStarted = true;
        input.runtimeEvents.emit({
            type: 'message_start',
            message: {
                id: input.request.requestId,
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
        for (const block of projection.runtimeBlocks) {
            input.runtimeEvents.emit({
                type: 'message_update',
                messageId: input.request.requestId,
                block
            });
        }
        return true;
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

    private toToolCallArguments(args: unknown): Record<string, unknown> {
        if (!this.isRecord(args)) return {};
        return { ...args };
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
        if (request.mode === 'analyst') return 'analyst';
        if (request.mode === 'executor') return 'executor';
        if (request.mode === 'conversation') return 'conversation';
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
