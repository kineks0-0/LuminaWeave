import {
    Agent,
    type AgentEvent,
    type AgentMessage
} from '@earendil-works/pi-agent-core';
import type { ToolResultMessage } from '@earendil-works/pi-ai';
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
    type ForgePiToolBridge
} from '../tools/ForgePiToolBridge.js';
import { forgeWorkspaceVersionManager } from '../../project/ForgeWorkspaceVersionManager.js';

export interface ForgePiAgentSessionTurnInput {
    command: ForgeUserCommand;
    commandInput?: string;
    context: ForgeRuntimeContext;
    request: ForgeExecutionRequest;
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
}

interface ForgePiPreparedPrompt {
    contextBundle: ForgePiContextBundleSummary;
    source: ForgeRuntimeEventSource;
    tools: ForgePiAgentTool[];
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

export class ForgePiAgentSession {
    private readonly resourceLoader: ForgePiResourceLoader;
    private readonly extensionRunner: ForgePiExtensionRunner;
    private readonly modelRegistry: ForgePiModelRegistry;
    private readonly toolBridge: ForgePiToolBridge;
    private readonly sessionManager: ForgePiSessionManager;
    private agent: Agent | null = null;
    private latestContext: ForgeRuntimeContext | null = null;
    private latestRequest: ForgeExecutionRequest | null = null;
    private latestContextBundle: ForgePiContextBundleSummary | null = null;
    private eventSink: ForgePiEventSink | null = null;

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
    }

    async prompt(input: ForgePiAgentSessionTurnInput): Promise<ForgePiAgentSessionTurnResult> {
        this.latestContext = input.context;
        this.latestRequest = input.request;
        const effects: ForgeRuntimeEffect[] = [];
        const prepared = await this.preparePromptState(input, effects);
        this.latestContextBundle = prepared.contextBundle;
        const userInput = input.commandInput ?? this.resolveCommandInput(input.command);
        const events: ForgeRuntimeEvent[] = [
            {
                type: 'request_started',
                requestId: input.request.requestId,
                requestedAt: Date.now(),
                nodeSummary: input.request.nodeSummary ?? []
            }
        ];

        this.sessionManager.ensureMetadata();
        this.sessionManager.append('context_bundle', 'Context bundle', `${prepared.contextBundle.files.length} files`, {
            contextBundle: prepared.contextBundle
        });

        const agent = this.createAgent({
            systemPrompt: prepared.systemPrompt,
            messages: prepared.branchMessages,
            tools: prepared.tools,
            modelConfig: prepared.modelConfig,
            source: prepared.source,
            events,
            effects,
            request: input.request,
            context: input.context
        });
        this.agent = agent;

        events.push({
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
            firstResponseMarked: false
        };
        await agent.prompt(userMessage);

        const finalText = this.resolveLastAssistantText(agent.state.messages);
        for (const modelTrace of this.resolveModelTraces(input.request.requestId)) {
            events.push({
                type: 'model_request_trace',
                requestId: input.request.requestId,
                trace: modelTrace
            });
        }
        events.push({
            type: 'stream_done',
            requestId: input.request.requestId,
            rawText: finalText,
            displayText: finalText,
            thinkingText: '',
            completedAt: Date.now()
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
        const prepared = await this.preparePromptState(input);
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

    async resolveToolApproval(toolCallId: string, approved: boolean, message?: string): Promise<ForgePiAgentSessionApprovalResult> {
        const resolved = await this.toolBridge.resolveToolApproval(toolCallId, approved, message);
        if (!resolved.resolved) return resolved;

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
        for (const effect of resolved.effects) {
            if (effect.type !== 'stage_from_shell_write') continue;
            const beforeFiles = Object.fromEntries(effect.entries.map(entry => [entry.path, entry.originalContent]));
            const afterFiles = Object.fromEntries(effect.entries.map(entry => [entry.path, entry.content]));
            const patch = forgeWorkspaceVersionManager.createPatch({
                nodeId: this.sessionManager.getActiveNodeId() ?? this.sessionId,
                beforeFiles,
                afterFiles,
                sourceToolCallId: toolCallId
            });
            this.sessionManager.append(
                'workspace_patch',
                'Workspace patch',
                `${patch.changes.length} file change(s)`,
                patch
            );
        }

        if (approved && resolved.toolResultMessage && this.agent && this.latestRequest) {
            this.replacePendingApprovalWithToolResult(resolved.toolResultMessage);
            this.eventSink = {
                source: this.resolveEventSource(this.latestRequest),
                events: resolved.events,
                request: this.latestRequest,
                emitFirstResponse: false,
                firstResponseMarked: true
            };
            await this.agent.continue();
            const finalText = this.resolveLastAssistantText(this.agent.state.messages);
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
                rawText: finalText,
                displayText: finalText,
                thinkingText: '',
                completedAt: Date.now()
            });
        }

        return {
            ...resolved,
            piSessionState: this.sessionManager.getSnapshot()
        };
    }

    abort(): void {
        this.agent?.abort();
    }

    getSnapshot() {
        return this.sessionManager.getSnapshot();
    }

    private async preparePromptState(
        input: ForgePiAgentSessionTurnInput,
        effects?: ForgeRuntimeEffect[]
    ): Promise<ForgePiPreparedPrompt> {
        const contextBundle = await this.resourceLoader.buildContextBundle(input.context);
        const systemFragments = input.request.messages
            .filter(message => message.role === 'system')
            .map(message => message.content);
        const modelConfig = this.modelRegistry.resolveRunConfig({
            request: input.request,
            context: input.context
        });
        const tools = this.extensionRunner.loadTools(
            input.context,
            effects ? nextEffects => effects.push(...nextEffects) : undefined
        );
        const systemPrompt = this.resourceLoader.buildSystemPrompt({ systemFragments, contextBundle });
        const branchMessages = this.sessionManager.getBranchMessages();
        return {
            contextBundle,
            source: this.resolveEventSource(input.request),
            tools,
            modelConfig,
            systemPrompt,
            branchMessages,
            prompt: [{
                role: 'system',
                content: systemPrompt
            }, ...branchMessages],
            activeTools: this.summarizeTools(tools)
        };
    }

    private createAgent(input: {
        systemPrompt: string;
        messages: AgentMessage[];
        tools: ForgePiAgentTool[];
        modelConfig: ReturnType<ForgePiModelRegistry['resolveRunConfig']>;
        source: ForgeRuntimeEventSource;
        events: ForgeRuntimeEvent[];
        effects: ForgeRuntimeEffect[];
        request: ForgeExecutionRequest;
        context: ForgeRuntimeContext;
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
            toolExecution: 'sequential',
            beforeToolCall: async ({ toolCall, args }) => {
                if (!await this.toolBridge.needsApproval(toolCall.name, args, input.context)) return undefined;
                this.toolBridge.registerPendingApproval({
                    requestId: input.request.requestId,
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    args,
                    context: input.context,
                    source: input.source
                });
                const event: ForgeRuntimeEvent = {
                    type: 'tool_approval_needed',
                    requestId: input.request.requestId,
                    approvalId: `approval-${toolCall.id}`,
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    args,
                    reason: `工具 ${toolCall.name} 需要通过 Forge Review Gate 授权后才能执行。`,
                    source: input.source
                };
                input.events.push(event);
                this.sessionManager.append('approval_needed', `Approval · ${toolCall.name}`, event.reason, event);
                return { block: true, reason: '等待 Forge Review Gate 授权。' };
            }
        });

        agent.subscribe((event) => {
            const sink = this.eventSink;
            if (!sink) return;
            this.handleAgentEvent(event, sink, () => {
                if (!sink.emitFirstResponse || sink.firstResponseMarked) return;
                sink.firstResponseMarked = true;
                sink.events.push({
                    type: 'first_response',
                    requestId: sink.request.requestId,
                    firstResponseAt: Date.now()
                });
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
        input: {
            source: ForgeRuntimeEventSource;
            events: ForgeRuntimeEvent[];
            request: ForgeExecutionRequest;
        },
        markFirstResponse: () => void
    ): void {
        if (event.type === 'message_update') {
            markFirstResponse();
            const text = this.extractAssistantText(event.message);
            input.events.push({
                type: 'stream_chunk',
                requestId: input.request.requestId,
                displayText: text,
                thinkingText: '',
                rawText: text
            });
        }
        if (event.type === 'message_end' && event.message.role === 'assistant') {
            const text = this.extractAssistantText(event.message);
            this.sessionManager.append('assistant', 'Assistant', text, {
                agentMessage: event.message,
                text
            });
        }
        if (event.type === 'tool_execution_start') {
            const runtimeEvent: ForgeRuntimeEvent = {
                type: 'tool_call',
                requestId: input.request.requestId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args,
                source: input.source
            };
            input.events.push(runtimeEvent);
            this.sessionManager.append('tool_call', `Tool call · ${event.toolName}`, JSON.stringify(event.args).slice(0, 160), runtimeEvent);
        }
        if (event.type === 'tool_execution_end') {
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
            this.sessionManager.append('tool_result', `Tool result · ${event.toolName}`, JSON.stringify(runtimeEvent.result).slice(0, 160), runtimeEvent);
        }
    }

    private replacePendingApprovalWithToolResult(toolResultMessage: ToolResultMessage): void {
        if (!this.agent) return;
        const messages = this.agent.state.messages;
        const toolCallIndex = [...messages].reverse().findIndex(message => {
            if (message.role !== 'assistant') return false;
            return message.content.some(part => part.type === 'toolCall' && part.id === toolResultMessage.toolCallId);
        });
        if (toolCallIndex === -1) {
            this.agent.state.messages = [...messages, toolResultMessage as AgentMessage];
            return;
        }
        const assistantIndex = messages.length - 1 - toolCallIndex;
        this.agent.state.messages = [
            ...messages.slice(0, assistantIndex + 1),
            toolResultMessage as AgentMessage
        ];
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

    private resolveLastAssistantText(messages: AgentMessage[]): string {
        const lastAssistant = [...messages].reverse().find(message => message.role === 'assistant');
        return lastAssistant ? this.extractAssistantText(lastAssistant) : '';
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

    private extractAssistantText(message: AgentMessage): string {
        if (message.role !== 'assistant') return '';
        return message.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('');
    }
}
